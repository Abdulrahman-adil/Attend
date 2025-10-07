const { db } = require('../db/database');
const { isWithinRange, getLocationsForCompany } = require('../services/locationService');
const { sendAttendanceNotificationEmail } = require('../services/emailService');

const clockInOut = async (req, res, next) => {
    const { latitude, longitude, locationId } = req.body;
    const employeeId = req.user.id;
    const companyId = req.user.company_id;

    if (latitude === undefined || longitude === undefined || locationId === undefined) {
        res.status(400);
        return next(new Error('Location data (latitude, longitude) and locationId are required'));
    }

    try {
        const locations = await getLocationsForCompany(companyId);
        const selectedLocation = locations.find(loc => loc.id === locationId);

        if (!selectedLocation) {
            res.status(400);
            return next(new Error('The selected work location is not valid for your company.'));
        }

        if (!isWithinRange(latitude, longitude, [selectedLocation])) {
            res.status(403);
            return next(new Error(`You are not within the range of the selected location: ${selectedLocation.name}.`));
        }

        const latestRecordSql = `SELECT * FROM attendance WHERE employee_id = ? ORDER BY check_in_time DESC LIMIT 1`;
        db.get(latestRecordSql, [employeeId], (err, latestRecord) => {
            if (err) return next(err);

            let action;
            if (!latestRecord || latestRecord.check_out_time) {
                // Clock In
                action = 'Check-In';
                const sql = `INSERT INTO attendance (employee_id, location_id, check_in_time, check_in_latitude, check_in_longitude) VALUES (?, ?, ?, ?, ?)`;
                db.run(sql, [employeeId, locationId, new Date().toISOString(), latitude, longitude], function(err) {
                    if (err) return next(err);
                    notifyManager(employeeId, companyId, action, new Date());
                    res.status(201).json({ message: 'Checked in successfully' });
                });
            } else {
                // Clock Out
                action = 'Check-Out';
                const sql = `UPDATE attendance SET check_out_time = ?, check_out_latitude = ?, check_out_longitude = ? WHERE id = ?`;
                db.run(sql, [new Date().toISOString(), latitude, longitude, latestRecord.id], function(err) {
                    if (err) return next(err);
                    notifyManager(employeeId, companyId, action, new Date());
                    res.json({ message: 'Checked out successfully' });
                });
            }
        });

    } catch (error) {
        next(error);
    }
};

const getAttendance = (req, res, next) => {
    const { employeeId } = req.params;
    const managerCompanyId = req.user.company_id;

    const checkEmployeeSql = `SELECT company_id FROM users WHERE id = ?`;
    db.get(checkEmployeeSql, [employeeId], (err, employee) => {
        if(err) return next(err);
        if (!employee || employee.company_id !== managerCompanyId) {
            res.status(403);
            return next(new Error('You are not authorized to view this employee\'s records.'));
        }

        const attendanceSql = `SELECT a.*, l.name as locationName 
                               FROM attendance a
                               LEFT JOIN locations l ON a.location_id = l.id
                               WHERE a.employee_id = ? 
                               ORDER BY a.check_in_time DESC`;
        db.all(attendanceSql, [employeeId], (err, rows) => {
            if (err) return next(err);
            res.json(rows);
        });
    });
};

const getEmployeeDashboard = (req, res, next) => {
    const employeeId = req.user.id;
    const companyId = req.user.company_id;

    const companySql = 'SELECT * FROM companies WHERE id = ?';
    const locationsSql = 'SELECT * FROM locations WHERE company_id = ?';
    const attendanceSql = 'SELECT * FROM attendance WHERE employee_id = ? ORDER BY check_in_time DESC LIMIT 1';

    Promise.all([
        new Promise((resolve, reject) => db.get(companySql, [companyId], (err, row) => err ? reject(err) : resolve(row))),
        new Promise((resolve, reject) => db.all(locationsSql, [companyId], (err, rows) => err ? reject(err) : resolve(rows))),
        new Promise((resolve, reject) => db.get(attendanceSql, [employeeId], (err, row) => err ? reject(err) : resolve(row))),
    ]).then(([company, locations, latestAttendance]) => {
        res.json({ company, locations, latestAttendance });
    }).catch(err => next(err));
};

const notifyManager = (employeeId, companyId, action, time) => {
    const employeeSql = 'SELECT name FROM users WHERE id = ?';
    const managerSql = 'SELECT u.email FROM users u JOIN companies c ON u.id = c.owner_id WHERE c.id = ?';

    db.get(employeeSql, [employeeId], (err, employee) => {
        if (err || !employee) return console.error("Could not find employee for notification");
        db.get(managerSql, [companyId], (err, manager) => {
            if(err || !manager) return console.error("Could not find manager for notification");
            sendAttendanceNotificationEmail(manager.email, employee.name, action, time)
                .catch(err => console.error("Failed to send attendance email:", err));
        });
    });
};

module.exports = { clockInOut, getAttendance, getEmployeeDashboard };
