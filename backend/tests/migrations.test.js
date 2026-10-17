import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { TEST_DB } from '../../vitest.config.js';

// Simulates upgrading a pre-tenancy database (today's production shape):
// apply 001, insert legacy rows, then 002 + 003, and check the backfill.
const DB = 'crm_backfill';
const url = (db) => `postgres://${TEST_DB.user}:${TEST_DB.password}@localhost:${TEST_DB.port}/${db}`;
const sql = (file) => fs.readFileSync(path.resolve('backend/migrations', file), 'utf8');

let client;

beforeAll(async () => {
    const admin = new pg.Client({ connectionString: url('postgres') });
    await admin.connect();
    await admin.query(`DROP DATABASE IF EXISTS ${DB}`);
    await admin.query(`CREATE DATABASE ${DB}`);
    await admin.end();

    client = new pg.Client({ connectionString: url(DB) });
    await client.connect();
    await client.query(sql('001_baseline.sql'));

    // Legacy single-tenant data
    await client.query(`
        INSERT INTO users (first_name, last_name, email, password_hash, role_id, department_id)
        VALUES
          ('Old', 'Admin', 'old.admin@nexuswave.com', 'x', (SELECT id FROM roles WHERE name='admin'), (SELECT id FROM departments WHERE name='Administration')),
          ('Sam', 'Sales', 'sam@nexuswave.com', 'x', (SELECT id FROM roles WHERE name='sales'), (SELECT id FROM departments WHERE name='Sales')),
          ('Cara', 'CST', 'cara@nexuswave.com', 'x', (SELECT id FROM roles WHERE name='cst_manager'), NULL);
        INSERT INTO clients (company_name, sales_agent_id) VALUES ('Legacy Client', (SELECT id FROM users WHERE email='sam@nexuswave.com'));
        INSERT INTO daily_attendance (user_id, clock_in) VALUES ((SELECT id FROM users WHERE email='sam@nexuswave.com'), NOW());
        INSERT INTO attendance_breaks (attendance_id, break_in) VALUES ((SELECT MAX(id) FROM daily_attendance), NOW());
    `);

    await client.query(sql('002_tenancy.sql'));
    await client.query(sql('003_onboarding.sql'));
});

afterAll(async () => {
    await client?.end();
});

describe('upgrade of a legacy database', () => {
    it('creates organization #1 and assigns every existing row to it', async () => {
        const org = await client.query('SELECT id, name FROM organizations');
        expect(org.rows).toEqual([{ id: 1, name: 'NexusWave' }]);

        for (const table of ['users', 'clients', 'departments', 'daily_attendance', 'attendance_breaks']) {
            const { rows } = await client.query(`SELECT COUNT(*)::int AS n FROM ${table} WHERE tenant_id IS DISTINCT FROM 1`);
            expect(rows[0].n, table).toBe(0);
        }
    });

    it('makes tenant_id NOT NULL', async () => {
        await expect(client.query("INSERT INTO clients (company_name) VALUES ('no tenant')")).rejects.toThrow(/tenant_id/);
    });

    it('keeps existing users working: portals enabled, access mapped from role, onboarding complete', async () => {
        const portals = await client.query('SELECT COUNT(*)::int AS n FROM organization_portals WHERE tenant_id = 1 AND enabled');
        expect(portals.rows[0].n).toBe(6);

        const access = await client.query(`
            SELECT u.email, pt.key, upa.tier FROM user_portal_access upa
            JOIN users u ON u.id = upa.user_id
            JOIN organization_portals op ON op.id = upa.organization_portal_id
            JOIN portal_types pt ON pt.id = op.portal_type_id
            ORDER BY u.email
        `);
        expect(access.rows).toEqual([
            { email: 'cara@nexuswave.com', key: 'cst_manager', tier: 'Manager' },
            { email: 'old.admin@nexuswave.com', key: 'admin', tier: 'Admin' },
            { email: 'sam@nexuswave.com', key: 'sales', tier: 'Member' },
        ]);

        const state = await client.query('SELECT completed FROM onboarding_state WHERE tenant_id = 1');
        expect(state.rows[0].completed).toBe(true);
    });

    it('scopes department names per organization', async () => {
        await client.query("INSERT INTO organizations (name, slug) VALUES ('Second', 'second')");
        const second = (await client.query("SELECT id FROM organizations WHERE slug='second'")).rows[0].id;
        await client.query('INSERT INTO departments (tenant_id, name) VALUES ($1, $2)', [second, 'Sales']);
        await expect(client.query("INSERT INTO departments (tenant_id, name) VALUES (1, 'Sales')")).rejects.toThrow(/duplicate/);
    });

    it('is idempotent: re-running 002 and 003 changes nothing', async () => {
        await client.query(sql('002_tenancy.sql'));
        await client.query(sql('003_onboarding.sql'));
        const access = await client.query('SELECT COUNT(*)::int AS n FROM user_portal_access');
        expect(access.rows[0].n).toBe(3);
    });
});
