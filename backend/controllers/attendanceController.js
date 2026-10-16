import pool from '../config/db.js';

// Clock in for the current user
export const clockIn = async (req, res) => {
    try {
        const userId = req.user.id;

        // 1. Check if already clocked in today
        const checkResult = await pool.query(
            'SELECT id FROM daily_attendance WHERE user_id = $1 AND clock_out IS NULL',
            [userId]
        );

        // 1. Force-close any older open sessions for this user first
        await pool.query(
            'UPDATE daily_attendance SET clock_out = clock_in + interval \'8 hours\' WHERE user_id = $1 AND clock_out IS NULL',
            [userId]
        );

        // 2. Insert new daily_attendance record
        // Use Karachi timezone for tardy check — server may be UTC
        const karachiHour = parseInt(new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi', hour: 'numeric', hour12: false }));
        const status = karachiHour >= 9 ? 'tardy' : 'on-time';

        const result = await pool.query(
            'INSERT INTO daily_attendance (user_id, clock_in, status, date) VALUES ($1, CURRENT_TIMESTAMP, $2, CURRENT_DATE) RETURNING *',
            [userId, status]
        );

        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Clock-in error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Database error', 
            details: error.message 
        });
    }
};

// Clock out for the current user
export const clockOut = async (req, res) => {
    try {
        const userId = req.user.id;

        // 1. Find today's record
        const checkResult = await pool.query(
            'SELECT id FROM daily_attendance WHERE user_id = $1 AND clock_out IS NULL ORDER BY clock_in DESC LIMIT 1',
            [userId]
        );

        if (checkResult.rows.length === 0) {
            return res.status(400).json({ success: false, error: 'No active clock-in session for today' });
        }

        const attendanceId = checkResult.rows[0].id;

        // 2. Update clock-out time
        const result = await pool.query(
            'UPDATE daily_attendance SET clock_out = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
            [attendanceId]
        );

        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Clock-out error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Database error', 
            details: error.message 
        });
    }
};

// Get current clock-in status for the user
export const getStatus = async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await pool.query(
            'SELECT * FROM daily_attendance WHERE user_id = $1 ORDER BY clock_in DESC LIMIT 1',
            [userId]
        );

        const activeSession = result.rows.length > 0 ? result.rows[0] : null;
        const isClockedIn = activeSession && activeSession.clock_out === null;
        
        let onBreak = false;
        let activeBreak = null;
        
        if (activeSession) {
            try {
                const breakResult = await pool.query(
                    'SELECT * FROM attendance_breaks WHERE attendance_id = $1 AND break_out IS NULL ORDER BY break_in DESC LIMIT 1',
                    [activeSession.id]
                );
                if (breakResult.rows.length > 0) {
                    onBreak = true;
                    activeBreak = breakResult.rows[0];
                }
            } catch (tableError) {
                console.warn('attendance_breaks table might be missing, skipping:', tableError.message);
            }
        }

        res.json({
            success: true,
            isClockedIn,
            activeSession,
            onBreak,
            activeBreak
        });
    } catch (error) {
        console.error('Get status error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Database error', 
            details: error.message 
        });
    }
};

// Get attendance history (Admin View - All users)
export const getAttendanceAll = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                da.id, 
                da.user_id, 
                u.first_name || ' ' || u.last_name as user_name,
                r.name as department,
                da.date, 
                da.clock_in, 
                da.clock_out, 
                da.status,
                EXTRACT(EPOCH FROM (da.clock_out - da.clock_in))/3600 as total_hours
            FROM daily_attendance da
            JOIN users u ON da.user_id = u.id
            JOIN roles r ON u.role_id = r.id
            ORDER BY da.date DESC, da.clock_in DESC
        `);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Get all attendance error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Database error', 
            details: error.message 
        });
    }
};

// Get history for a specific user
export const getHistory = async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await pool.query(
            'SELECT * FROM daily_attendance WHERE user_id = $1 ORDER BY date DESC',
            [userId]
        );
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Get history error:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
};

// Break In
export const breakIn = async (req, res) => {
    try {
        const userId = req.user.id;
        // Find current open attendance
        const checkResult = await pool.query(
            'SELECT id FROM daily_attendance WHERE user_id = $1 AND clock_out IS NULL ORDER BY clock_in DESC LIMIT 1',
            [userId]
        );
        if (checkResult.rows.length === 0) {
            return res.status(400).json({ success: false, error: 'Must be clocked in to take a break' });
        }
        const attendanceId = checkResult.rows[0].id;
        
        // Check if already on break
        const openBreak = await pool.query(
            'SELECT id FROM attendance_breaks WHERE attendance_id = $1 AND break_out IS NULL',
            [attendanceId]
        );
        if (openBreak.rows.length > 0) {
            return res.status(400).json({ success: false, error: 'Already on break' });
        }

        const result = await pool.query(
            'INSERT INTO attendance_breaks (attendance_id, break_in) VALUES ($1, CURRENT_TIMESTAMP) RETURNING *',
            [attendanceId]
        );
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Break in error:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
};

// Break Out
export const breakOut = async (req, res) => {
    try {
        const userId = req.user.id;
        const checkResult = await pool.query(
            'SELECT id FROM daily_attendance WHERE user_id = $1 AND clock_out IS NULL ORDER BY clock_in DESC LIMIT 1',
            [userId]
        );
        if (checkResult.rows.length === 0) {
            return res.status(400).json({ success: false, error: 'No active clock-in session' });
        }
        const attendanceId = checkResult.rows[0].id;
        
        // Find open break
        const openBreak = await pool.query(
            'SELECT id FROM attendance_breaks WHERE attendance_id = $1 AND break_out IS NULL ORDER BY break_in DESC LIMIT 1',
            [attendanceId]
        );
        if (openBreak.rows.length === 0) {
            return res.status(400).json({ success: false, error: 'Not currently on a break' });
        }
        
        const result = await pool.query(
            'UPDATE attendance_breaks SET break_out = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
            [openBreak.rows[0].id]
        );
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Break out error:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
};

// Get Performance Review Grid Data
export const getPerformanceGrid = async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        
        let dateFilter = "";
        const params = [];
        
        if (start_date && end_date) {
            dateFilter = `AND da.date BETWEEN $1 AND $2`;
            params.push(start_date, end_date);
        } else {
            dateFilter = `AND da.date >= CURRENT_DATE - INTERVAL '30 days'`;
        }

        const query = `
            SELECT 
                u.id as user_id, 
                u.first_name, 
                u.last_name, 
                r.name as role, 
                d.name as department,
                da.date, 
                da.status as attendance_status, 
                da.clock_in, 
                da.clock_out
            FROM users u
            LEFT JOIN roles r ON u.role_id = r.id
            LEFT JOIN departments d ON u.department_id = d.id
            LEFT JOIN daily_attendance da ON (da.user_id = u.id ${dateFilter})
            WHERE u.status = 'active'
            ORDER BY r.name, u.first_name, da.date ASC
        `;

        const result = await pool.query(query, params);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Performance grid error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Database error', 
            details: error.message 
        });
    }
};
