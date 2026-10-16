import pool from './config/db.js';

async function debugZain() {
    try {
        const userRes = await pool.query("SELECT id, first_name, last_name, role_id FROM users WHERE first_name ILIKE '%Zain%'");
        console.log("Users matching 'Zain':");
        console.table(userRes.rows);

        if (userRes.rows.length > 0) {
            const zainId = userRes.rows[0].id;
            const targetRes = await pool.query("SELECT * FROM cst_agent_targets WHERE agent_id = $1", [zainId]);
            console.log("Targets for Zain (ID: " + zainId + "):");
            console.table(targetRes.rows);
        }
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}

debugZain();
