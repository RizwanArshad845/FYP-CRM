import pool, { withTransaction } from '../config/db.js';

// Clock in for the current user
export const clockIn = async (req, res) => {
    const { id: userId, tenantId } = req.user;
    // Tardy check uses Karachi time; the server may run in UTC.
    const karachiHour = parseInt(new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi', hour: 'numeric', hour12: false }));
    const status = karachiHour >= 9 ? 'tardy' : 'on-time';

    const row = await withTransaction(async (db) => {
        // Force-close any forgotten open session first
        await db.query(
            "UPDATE daily_attendance SET clock_out = clock_in + interval '8 hours' WHERE user_id = $1 AND clock_out IS NULL",
            [userId]
        );
        const result = await db.query(
            'INSERT INTO daily_attendance (tenant_id, user_id, clock_in, status, date) VALUES ($1, $2, CURRENT_TIMESTAMP, $3, CURRENT_DATE) RETURNING *',
            [tenantId, userId, status]
        );
        return result.rows[0];
    });
    res.json({ success: true, data: row });
};

// Clock out for the current user (closes any open break too)
export const clockOut = async (req, res) => {
    const row = await withTransaction(async (db) => {
        const open = await db.query(
            'SELECT id FROM daily_attendance WHERE user_id = $1 AND clock_out IS NULL ORDER BY clock_in DESC LIMIT 1',
            [req.user.id]
        );
        if (!open.rows[0]) return null;
        await db.query('UPDATE attendance_breaks SET break_out = CURRENT_TIMESTAMP WHERE attendance_id = $1 AND break_out IS NULL', [open.rows[0].id]);
        const result = await db.query('UPDATE daily_attendance SET clock_out = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *', [open.rows[0].id]);
        return result.rows[0];
    });
    if (!row) return res.status(400).json({ success: false, error: 'No active clock-in session for today' });
    res.json({ success: true, data: row });
};

// Current clock-in / break status for the user
export const getStatus = async (req, res) => {
    const result = await pool.query(
        'SELECT * FROM daily_attendance WHERE user_id = $1 ORDER BY clock_in DESC LIMIT 1',
        [req.user.id]
    );
    const activeSession = result.rows[0] || null;
    const isClockedIn = Boolean(activeSession && activeSession.clock_out === null);

    let activeBreak = null;
    if (activeSession) {
        const breakResult = await pool.query(
            'SELECT * FROM attendance_breaks WHERE attendance_id = $1 AND break_out IS NULL ORDER BY break_in DESC LIMIT 1',
            [activeSession.id]
        );
        activeBreak = breakResult.rows[0] || null;
    }

    res.json({ success: true, isClockedIn, activeSession, onBreak: Boolean(activeBreak), activeBreak });
};

// Attendance log for everyone in the organization
export const getAttendanceAll = async (req, res) => {
    const result = await pool.query(`
        SELECT da.id, da.user_id, u.first_name || ' ' || u.last_name as user_name,
               r.name as department, da.date, da.clock_in, da.clock_out, da.status,
               EXTRACT(EPOCH FROM (da.clock_out - da.clock_in))/3600 as total_hours
        FROM daily_attendance da
        JOIN users u ON da.user_id = u.id
        JOIN roles r ON u.role_id = r.id
        WHERE da.tenant_id = $1
        ORDER BY da.date DESC, da.clock_in DESC
    `, [req.user.tenantId]);
    res.json({ success: true, data: result.rows });
};

export const getHistory = async (req, res) => {
    const result = await pool.query('SELECT * FROM daily_attendance WHERE user_id = $1 ORDER BY date DESC', [req.user.id]);
    res.json({ success: true, data: result.rows });
};

export const breakIn = async (req, res) => {
    const open = await pool.query(
        'SELECT id FROM daily_attendance WHERE user_id = $1 AND clock_out IS NULL ORDER BY clock_in DESC LIMIT 1',
        [req.user.id]
    );
    if (!open.rows[0]) return res.status(400).json({ success: false, error: 'Must be clocked in to take a break' });
    const attendanceId = open.rows[0].id;

    const openBreak = await pool.query('SELECT id FROM attendance_breaks WHERE attendance_id = $1 AND break_out IS NULL', [attendanceId]);
    if (openBreak.rows[0]) return res.status(400).json({ success: false, error: 'Already on break' });

    const result = await pool.query(
        'INSERT INTO attendance_breaks (tenant_id, attendance_id, break_in) VALUES ($1, $2, CURRENT_TIMESTAMP) RETURNING *',
        [req.user.tenantId, attendanceId]
    );
    res.json({ success: true, data: result.rows[0] });
};

export const breakOut = async (req, res) => {
    const result = await pool.query(`
        UPDATE attendance_breaks SET break_out = CURRENT_TIMESTAMP
        WHERE id = (
            SELECT b.id FROM attendance_breaks b
            JOIN daily_attendance da ON da.id = b.attendance_id
            WHERE da.user_id = $1 AND da.clock_out IS NULL AND b.break_out IS NULL
            ORDER BY b.break_in DESC LIMIT 1
        )
        RETURNING *
    `, [req.user.id]);
    if (!result.rows[0]) return res.status(400).json({ success: false, error: 'Not currently on a break' });
    res.json({ success: true, data: result.rows[0] });
};

// Attendance grid for performance reviews (admin)
export const getPerformanceGrid = async (req, res) => {
    const { start_date, end_date } = req.query;
    const params = [req.user.tenantId];
    let dateFilter = "AND da.date >= CURRENT_DATE - INTERVAL '30 days'";
    if (start_date && end_date) {
        params.push(start_date, end_date);
        dateFilter = 'AND da.date BETWEEN $2 AND $3';
    }

    const result = await pool.query(`
        SELECT u.id as user_id, u.first_name, u.last_name, r.name as role, d.name as department,
               da.date, da.status as attendance_status, da.clock_in, da.clock_out
        FROM users u
        LEFT JOIN roles r ON u.role_id = r.id
        LEFT JOIN departments d ON u.department_id = d.id
        LEFT JOIN daily_attendance da ON (da.user_id = u.id ${dateFilter})
        WHERE u.status = 'active' AND u.tenant_id = $1
        ORDER BY r.name, u.first_name, da.date ASC
    `, params);
    res.json({ success: true, data: result.rows });
};
