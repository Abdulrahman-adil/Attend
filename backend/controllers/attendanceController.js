const { object, text, id, page, hash, fail } = require("../lib/http");
const { position, validateLocation } = require("../services/locationService");
const {
  attendanceDto,
  companyDto,
  locationDto,
} = require("../services/mappers");
const { audit } = require("../services/auditService");
const { queueEmail } = require("../services/emailService");
function createAttendanceController({ store, config, now }) {
  function command(action) {
    return async (req, res) => {
      const body = object(req.body);
      const sample = position(body);
      const requestKey = text(
        req.get("Idempotency-Key"),
        "Idempotency-Key",
        16,
        128
      );
      if (!/^[a-zA-Z0-9_-]+$/.test(requestKey))
        fail(400, "Invalid Idempotency-Key.", "VALIDATION");
      const attendanceId =
        action === "check-out" ? id(body.attendanceId) : null;
      const fingerprint = hash(
        JSON.stringify({ action, ...sample, attendanceId })
      );
      const result = await store.transaction(async (tx) => {
        const current = await tx.get(
          "SELECT id FROM users WHERE id=? AND company_id=? AND role='employee' AND is_active=TRUE AND archived_at IS NULL",
          [req.user.id, req.user.company_id]
        );
        if (!current)
          fail(403, "Employee account is no longer active.", "FORBIDDEN");
        const existing = await tx.get(
          "SELECT * FROM attendance_requests WHERE company_id=? AND user_id=? AND request_key=?",
          [req.user.company_id, req.user.id, requestKey]
        );
        if (existing) {
          if (existing.request_hash !== fingerprint)
            fail(
              409,
              "This request key has already been used for a different action.",
              "IDEMPOTENCY_CONFLICT"
            );
          return {
            status: existing.status_code,
            body: JSON.parse(existing.response_json),
            replayed: true,
          };
        }
        let record;
        if (action === "check-in") {
          if (
            await tx.get(
              "SELECT id FROM attendance WHERE employee_id=? AND check_out_time IS NULL",
              [req.user.id]
            )
          )
            fail(
              409,
              "You are already checked in. Refresh your attendance status.",
              "ALREADY_CHECKED_IN"
            );
          await validateLocation(tx, req.user.company_id, sample);
          const time = now().toISOString();
          const added = await tx.run(
            "INSERT INTO attendance(employee_id,company_id,location_id,check_in_time,check_in_latitude,check_in_longitude) VALUES(?,?,?,?,?,?)RETURNING id",
            [
              req.user.id,
              req.user.company_id,
              sample.locationId,
              time,
              sample.latitude,
              sample.longitude,
            ]
          );
          record = await tx.get("SELECT * FROM attendance WHERE id=?", [
            added.lastID,
          ]);
        } else {
          record = await tx.get(
            "SELECT * FROM attendance WHERE id=? AND employee_id=? AND company_id=?",
            [attendanceId, req.user.id, req.user.company_id]
          );
          if (!record) fail(404, "Attendance record not found.", "NOT_FOUND");
          if (record.check_out_time)
            fail(
              409,
              "This attendance record is already closed.",
              "ALREADY_CHECKED_OUT"
            );
          if (record.location_id !== sample.locationId)
            fail(
              400,
              "Check out from the same work location.",
              "LOCATION_MISMATCH"
            );
          await validateLocation(tx, req.user.company_id, sample, {
            allowRetired: true,
          });
          const time = now().toISOString();
          if (time < record.check_in_time)
            fail(
              503,
              "Server clock is inconsistent. Please contact support.",
              "CLOCK_UNAVAILABLE"
            );
          const updated = await tx.run(
            "UPDATE attendance SET check_out_time=?,check_out_latitude=?,check_out_longitude=? WHERE id=? AND check_out_time IS NULL",
            [time, sample.latitude, sample.longitude, record.id]
          );
          if (updated.changes !== 1)
            fail(
              409,
              "Attendance changed. Refresh and try again.",
              "ATTENDANCE_CONFLICT"
            );
          record = {
            ...record,
            check_out_time: time,
            check_out_latitude: sample.latitude,
            check_out_longitude: sample.longitude,
          };
        }
        const time =
          action === "check-in" ? record.check_in_time : record.check_out_time;
        await audit(
          tx,
          {
            companyId: req.user.company_id,
            actorId: req.user.id,
            subjectId: req.user.id,
            type:
              action === "check-in"
                ? "attendance.checked_in"
                : "attendance.checked_out",
            details: { attendanceId: record.id },
          },
          time
        );
        const owner = await tx.get(
          "SELECT u.email FROM users u JOIN companies c ON c.owner_id=u.id WHERE c.id=?",
          [req.user.company_id]
        );
        if (owner)
          await queueEmail(
            tx,
            config,
            {
              eventKey: `attendance:${record.id}:${action}`,
              companyId: req.user.company_id,
              kind: "attendance",
              payload: { to: owner.email, name: req.user.name, action, time },
            },
            time
          );
        const payload = {
          message:
            action === "check-in"
              ? "Checked in successfully."
              : "Checked out successfully.",
          attendance: attendanceDto(record),
          serverTime: time,
        };
        const status = action === "check-in" ? 201 : 200;
        await tx.run(
          "INSERT INTO attendance_requests(company_id,user_id,request_key,request_hash,response_json,status_code,created_at) VALUES(?,?,?,?,?,?,?)",
          [
            req.user.company_id,
            req.user.id,
            requestKey,
            fingerprint,
            JSON.stringify(payload),
            status,
            time,
          ]
        );
        return { status, body: payload, replayed: false };
      });
      if (result.replayed) res.set("Idempotency-Replayed", "true");
      res.status(result.status).json(result.body);
    };
  }
  return {
    checkIn: command("check-in"),
    checkOut: command("check-out"),
    async dashboard(req, res) {
      const data = await store.read(async (tx) => {
        const company = await tx.get("SELECT * FROM companies WHERE id=?", [
          req.user.company_id,
        ]);
        const locations = await tx.all(
          "SELECT * FROM locations WHERE company_id=? AND retired_at IS NULL ORDER BY name LIMIT 100",
          [req.user.company_id]
        );
        const latest = await tx.get(
          "SELECT a.*,l.name AS location_name FROM attendance a LEFT JOIN locations l ON l.id=a.location_id WHERE a.employee_id=? AND a.company_id=? ORDER BY a.check_in_time DESC,a.id DESC LIMIT 1",
          [req.user.id, req.user.company_id]
        );
        return {
          company: companyDto(company),
          locations: locations.map(locationDto),
          latestAttendance: attendanceDto(latest),
          serverTime: now().toISOString(),
        };
      });
      res.json(data);
    },
    async history(req, res) {
      const employeeId = id(req.params.employeeId);
      const { limit, offset } = page(req.query);
      const data = await store.read(async (tx) => {
        if (
          !(await tx.get(
            "SELECT id FROM users WHERE id=? AND company_id=? AND role='employee'",
            [employeeId, req.user.company_id]
          ))
        )
          fail(404, "Employee not found.", "NOT_FOUND");
        const rows = await tx.all(
          "SELECT a.*,l.name AS location_name FROM attendance a LEFT JOIN locations l ON l.id=a.location_id WHERE a.employee_id=? AND a.company_id=? ORDER BY a.check_in_time DESC,a.id DESC LIMIT ? OFFSET ?",
          [employeeId, req.user.company_id, limit, offset]
        );
        return {
          items: rows.map(attendanceDto),
          total: (
            await tx.get(
              "SELECT COUNT(*) AS n FROM attendance WHERE employee_id=? AND company_id=?",
              [employeeId, req.user.company_id]
            )
          ).n,
          limit,
          offset,
        };
      });
      res.json(data);
    },
  };
}
module.exports = { createAttendanceController };
