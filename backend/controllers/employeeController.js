const { object, email, text, id, page, fail } = require("../lib/http");
const { userDto } = require("../services/mappers");
const { issueInvitation } = require("../services/invitationService");
const { audit } = require("../services/auditService");
function createEmployeeController({ store, config, now }) {
  return {
    async add(req, res) {
      const body = object(req.body);
      const address = email(body.email);
      const name = text(body.name, "Employee name");
      const instant = now();
      const companyId = req.user.company_id;
      let invitationResult = null;
      const user = await store.transaction(async (tx) => {
        const existing = await tx.get(
          "SELECT * FROM users WHERE normalized_email=? FOR UPDATE",
          [address]
        );
        if (existing) {
          if (
            existing.role === "employee" &&
            !existing.is_active && !existing.archived_at &&
            (existing.company_id === null || existing.company_id === companyId)
          ) {
            await tx.run(
              "UPDATE users SET company_id=?, invited_at=? WHERE id=?",
              [companyId, instant.toISOString(), existing.id]
            );
            const reusedEmployee = {
              id: existing.id,
              name: existing.name,
              email: address,
              company_id: companyId,
              role: "employee",
              is_active: false,
            };
            invitationResult = await issueInvitation(
              tx,
              config,
              reusedEmployee,
              "invitation",
              req.user.id,
              instant
            );
            await audit(
              tx,
              {
                companyId,
                actorId: req.user.id,
                subjectId: existing.id,
                type: "employee.invited",
              },
              instant.toISOString()
            );
            return reusedEmployee;
          }
          fail(
            409,
            "An account already uses this email. For a pending employee in your organization, use Resend invitation.",
            "ACCOUNT_EXISTS"
          );
        }
        const created = await tx.run(
          "INSERT INTO users(name,email,normalized_email,role,company_id,created_at) VALUES(?,?,?,'employee',?,?) RETURNING id",
          [name, address, address, companyId, instant.toISOString()]
        );
        const employee = {
          id: created.id,
          name,
          email: address,
          company_id: companyId,
          role: "employee",
          is_active: false,
        };
        invitationResult = await issueInvitation(
          tx,
          config,
          employee,
          "invitation",
          req.user.id,
          instant
        );
        await audit(
          tx,
          {
            companyId,
            actorId: req.user.id,
            subjectId: employee.id,
            type: "employee.invited",
          },
          instant.toISOString()
        );
        return employee;
      });
      const payload = {
        employee: userDto(user),
        message: "Employee invited. An invitation email is queued.",
        delivery: config.emailEnabled ? "queued" : "disabled",
      };
      if (!config.emailEnabled && invitationResult && invitationResult.token) {
        payload.activationUrl = `${config.frontendUrl}/#/activate/${invitationResult.token}`;
      }
      res.status(201).json(payload);
    },
    async list(req, res) {
      const { limit, offset } = page(req.query);
      const companyId = req.user.company_id;
      const result = await store.read(async (tx) => ({
        items: (
          await tx.all(
            "SELECT u.*,i.expires_at AS invitation_expires_at FROM users u LEFT JOIN invitations i ON i.user_id=u.id AND i.kind='invitation' AND i.consumed_at IS NULL AND i.revoked_at IS NULL WHERE u.company_id=? AND u.role='employee' AND u.archived_at IS NULL ORDER BY u.name,u.id LIMIT ? OFFSET ?",
            [companyId, limit, offset]
          )
        ).map((u) => ({
          ...userDto(u),
          invitationExpiresAt: u.invitation_expires_at || null,
        })),
        total: (
          await tx.get(
            "SELECT COUNT(*) AS n FROM users WHERE company_id=? AND role='employee' AND archived_at IS NULL",
            [companyId]
          )
        ).n,
      }));
      res.json({ ...result, limit, offset });
    },
    async resend(req, res) {
      const employeeId = id(req.params.id);
      const instant = now();
      await store.transaction(async (tx) => {
        const user = await tx.get(
          "SELECT * FROM users WHERE id=? AND company_id=? AND role='employee' AND archived_at IS NULL FOR UPDATE",
          [employeeId, req.user.company_id]
        );
        if (!user) fail(404, "Employee not found.", "NOT_FOUND");
        if (user.is_active)
          fail(409, "This employee is already active.", "ALREADY_ACTIVE");
        const previous = await tx.get(
          "SELECT created_at FROM invitations WHERE user_id=? AND kind='invitation' ORDER BY id DESC LIMIT 1",
          [user.id]
        );
        if (
          previous?.created_at &&
          instant.getTime() - Date.parse(previous.created_at) < 60000
        )
          fail(
            429,
            "Please wait one minute before sending another invitation.",
            "RESEND_COOLDOWN"
          );
        await issueInvitation(
          tx,
          config,
          user,
          "invitation",
          req.user.id,
          instant
        );
        await audit(
          tx,
          {
            companyId: req.user.company_id,
            actorId: req.user.id,
            subjectId: user.id,
            type: "employee.invitation_resent",
          },
          instant.toISOString()
        );
      });
      res.json({
        message:
          "A replacement invitation is queued. Previous links are no longer valid.",
        delivery: config.emailEnabled ? "queued" : "disabled",
      });
    },
    async remove(req, res) {
      const employeeId = id(req.params.id);
      const time = now().toISOString();
      await store.transaction(async (tx) => {
        const user = await tx.get(
          "SELECT id FROM users WHERE id=? AND company_id=? AND role='employee' AND archived_at IS NULL FOR UPDATE",
          [employeeId, req.user.company_id]
        );
        if (!user) fail(404, "Employee not found.", "NOT_FOUND");
        if (
          await tx.get(
            "SELECT id FROM attendance WHERE employee_id=? AND check_out_time IS NULL",
            [employeeId]
          )
        )
          fail(
            409,
            "This employee has open attendance. Resolve it before archiving their account.",
            "OPEN_ATTENDANCE"
          );
        await tx.run(
          "UPDATE users SET archived_at=?,is_active=false WHERE id=? AND company_id=?",
          [time, employeeId, req.user.company_id]
        );
        await tx.run(
          "UPDATE sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL",
          [time, employeeId]
        );
        await tx.run(
          "UPDATE invitations SET revoked_at=? WHERE user_id=? AND consumed_at IS NULL AND revoked_at IS NULL",
          [time, employeeId]
        );
        await tx.run(
          "UPDATE email_outbox SET status='cancelled',payload_encrypted=NULL WHERE invitation_id IN (SELECT id FROM invitations WHERE user_id=?) AND status IN ('pending','failed')",
          [employeeId]
        );
        await audit(
          tx,
          {
            companyId: req.user.company_id,
            actorId: req.user.id,
            subjectId: employeeId,
            type: "employee.archived",
          },
          time
        );
      });
      res.json({
        message: "Employee archived. Attendance history has been preserved.",
      });
    },
  };
}
module.exports = { createEmployeeController };
