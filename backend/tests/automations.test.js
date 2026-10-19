import { describe, it, expect, beforeAll } from 'vitest';
import pool from '../config/db.js';
import { as, addActiveEmployees, clientBody, setupOrg, signupOrg } from './helpers.js';

const newClient = async (org, companyName, extra = {}) =>
    (await as(org.sales_manager.token).post('/api/clients', clientBody(companyName, { customerName: `${companyName} Owner`, ...extra }))).body.data;

// UC3 (plan 7.1)
describe('follow up auto fill, duplicate check and numbering', () => {
    let org;
    let client;
    beforeAll(async () => {
        org = await setupOrg();
        client = await newClient(org, 'Nova Foods', {
            productSold: 'Local SEO Service', serviceArea: 'Canada', contactNo1: '555-0100', sales_agent_id: org.sales.id,
        });
    });

    it('fills name, product, area and contact number from the client when omitted', async () => {
        const res = await as(org.sales.token).post('/api/sales/follow-ups', { client_id: client.id, due_date: '2026-11-01' });
        expect(res.status).toBe(201);
        expect(res.body.data).toMatchObject({
            client_name_text: 'Nova Foods Owner', product: 'Local SEO Service', area: 'Canada', contact_no: '555-0100', follow_up_number: 1,
        });
    });

    it('rejects a second follow up for the same client and day, pointing at the first', async () => {
        const first = (await as(org.sales.token).get('/api/sales/follow-ups')).body.data.find((f) => f.client_id === client.id);
        const res = await as(org.sales.token).post('/api/sales/follow-ups', { client_id: client.id, due_date: '2026-11-01', notes: 'again' });
        expect(res.status).toBe(409);
        expect(res.body.error).toBe('A follow up for this client already exists on this day.');
        expect(res.body.existingId).toBe(first.id);
    });

    it('numbers follow ups per client on the server, ignoring any number sent', async () => {
        const second = await as(org.sales.token).post('/api/sales/follow-ups', { client_id: client.id, due_date: '2026-11-02', follow_up_number: 99 });
        const third = await as(org.sales.token).post('/api/sales/follow-ups', { client_id: client.id, due_date: '2026-11-03' });
        expect(second.body.data.follow_up_number).toBe(2);
        expect(third.body.data.follow_up_number).toBe(3);

        const other = await newClient(org, 'Bolt Gyms');
        const fresh = await as(org.sales.token).post('/api/sales/follow-ups', { client_id: other.id, due_date: '2026-11-01' });
        expect(fresh.body.data.follow_up_number).toBe(1);
    });

    it("refuses another organization's client", async () => {
        const other = await setupOrg();
        const foreign = await newClient(other, 'Foreign Co');
        expect((await as(org.sales.token).post('/api/sales/follow-ups', { client_id: foreign.id, due_date: '2026-11-05' })).status).toBe(404);
    });
});

// UC4 (plan 7.2)
describe('least loaded agent suggestion', () => {
    let org;
    beforeAll(async () => {
        const { token: admin } = await signupOrg();
        org = { admin, ...await addActiveEmployees(admin, ['sales_manager', 'cst', 'cst_manager', { key: 'cst2', portal_key: 'cst' }]) };
        await as(admin).post('/api/onboarding/complete');
        // The first CST agent gets one active client, so the second is the least loaded
        const busy = await newClient(org, 'Busy Co');
        await as(org.cst_manager.token).patch(`/api/cst-manager/clients/${busy.id}/assign-cst`, { cst_agent_id: org.cst.id });
        await newClient(org, 'Waiting Co');
    });

    it('suggests the agent with the fewest active clients', async () => {
        const res = await as(org.cst_manager.token).get('/api/cst-manager/unassigned-clients');
        expect(res.status).toBe(200);
        const waiting = res.body.data.find((c) => c.company_name === 'Waiting Co');
        expect(waiting.suggested_agent).toEqual({ id: org.cst2.id, name: 'cst2 Tester', active_count: 0 });
        expect(res.body.data.find((c) => c.company_name === 'Busy Co')).toBeUndefined();
    });

    it('accepting the suggestion assigns the client', async () => {
        const waiting = (await as(org.cst_manager.token).get('/api/cst-manager/unassigned-clients')).body.data.find((c) => c.company_name === 'Waiting Co');
        const res = await as(org.cst_manager.token).patch(`/api/cst-manager/clients/${waiting.id}/assign-cst`, { cst_agent_id: waiting.suggested_agent.id });
        expect(res.status).toBe(200);
        expect(res.body.data).toMatchObject({ cst_agent_id: org.cst2.id, status: 'active' });
    });

    it("refuses an agent of another organization, and members can't see suggestions", async () => {
        const other = await setupOrg();
        const client = await newClient(org, 'Guarded Co');
        expect((await as(org.cst_manager.token).patch(`/api/cst-manager/clients/${client.id}/assign-cst`, { cst_agent_id: other.cst.id })).status).toBe(400);
        expect((await as(org.cst.token).get('/api/cst-manager/unassigned-clients')).status).toBe(403);
    });
});

// UC5 (plan 7.3)
describe('bulk deactivation approval', () => {
    let org;
    const requestFor = async (name, reason) => {
        const client = await newClient(org, name);
        await as(org.cst_manager.token).patch(`/api/clients/${client.id}/assign`, { agentId: org.cst.id });
        const req = await as(org.cst.token).post('/api/cst/deactivation-requests', { client_id: client.id, reason });
        return { client, request: req.body.data };
    };
    const clientById = async (id) => (await as(org.cst_manager.token).get('/api/clients')).body.data.find((c) => c.id === id);
    beforeAll(async () => { org = await setupOrg(); });

    it('approves several requests in one call; each client is discarded with the reason', async () => {
        const a = await requestFor('Acme Travel', 'Closed the business');
        const b = await requestFor('Peak Autos', 'No payment for three months');
        const res = await as(org.cst_manager.token).post('/api/cst-manager/deactivation-requests/resolve-bulk', {
            ids: [a.request.id, b.request.id], decision: 'approved',
        });
        expect(res.status).toBe(200);
        expect(res.body.data.map((r) => r.status)).toEqual(['approved', 'approved']);
        expect(res.body.data.every((r) => r.reviewed_by === org.cst_manager.id)).toBe(true);
        for (const { client, request } of [a, b]) {
            const c = await clientById(client.id);
            expect(c).toMatchObject({ status: 'discarded', discard_reason: request.reason });
            expect(c.discarded_at).toBeTruthy();
        }
        const pending = (await as(org.cst_manager.token).get('/api/clients/deactivation-requests')).body.data;
        expect(pending.find((r) => r.id === a.request.id)).toBeUndefined();
    });

    it('rejecting keeps the clients active', async () => {
        const c = await requestFor('Orbit Media', 'Duplicate account');
        const res = await as(org.cst_manager.token).post('/api/cst-manager/deactivation-requests/resolve-bulk', { ids: [c.request.id], decision: 'rejected' });
        expect(res.body.data[0].status).toBe('rejected');
        expect((await clientById(c.client.id)).status).toBe('active');
    });

    it('is all or nothing: one request that is not pending fails the whole call', async () => {
        const ok = await requestFor('Zen Clinics', 'Requested by the client');
        const done = await requestFor('Lumen Studio', 'Moved');
        await as(org.cst_manager.token).post('/api/cst-manager/deactivation-requests/resolve-bulk', { ids: [done.request.id], decision: 'rejected' });
        const res = await as(org.cst_manager.token).post('/api/cst-manager/deactivation-requests/resolve-bulk', {
            ids: [ok.request.id, done.request.id], decision: 'approved',
        });
        expect(res.status).toBe(400);
        expect((await clientById(ok.client.id)).status).toBe('active');
    });

    it("refuses users without approval permission and other organizations' requests", async () => {
        const c = await requestFor('Bright Co', 'x');
        expect((await as(org.cst.token).post('/api/cst-manager/deactivation-requests/resolve-bulk', { ids: [c.request.id], decision: 'approved' })).status).toBe(403);
        const other = await setupOrg();
        expect((await as(other.cst_manager.token).post('/api/cst-manager/deactivation-requests/resolve-bulk', { ids: [c.request.id], decision: 'approved' })).status).toBe(400);
    });
});

// UC6 (plan 7.4)
describe('payroll run and all salary slips', () => {
    let org;
    const MONTH = '2026-11';
    const rowsFor = async (tenantUserIds) => (await pool.query(
        "SELECT user_id, net_pay, base_salary, bonuses, deductions FROM payrolls WHERE user_id = ANY($1::int[]) AND TO_CHAR(pay_period_start, 'YYYY-MM') = $2",
        [tenantUserIds, MONTH]
    )).rows;
    beforeAll(async () => {
        org = await setupOrg();
        await pool.query('UPDATE users SET base_salary = 50000 WHERE id = ANY($1::int[])', [[org.sales.id, org.cst.id]]);
        await pool.query('UPDATE users SET base_salary = 0 WHERE id = $1', [org.finance.id]);
    });

    it('pays every active employee with a base salary and lists the ones without', async () => {
        const res = await as(org.finance.token).post('/api/finance/payroll/run', { month: MONTH });
        expect(res.status).toBe(200);
        const paid = res.body.data.processed.map((p) => p.user_id);
        expect(paid).toEqual(expect.arrayContaining([org.sales.id, org.cst.id]));
        expect(res.body.data.skipped).toEqual(expect.arrayContaining([
            { user_id: org.finance.id, name: 'finance Tester', reason: 'No base salary' },
        ]));
        expect(res.body.data.processed.find((p) => p.user_id === org.sales.id).net_pay).toBe('50000');
    });

    it('a rerun updates the month instead of duplicating, keeping bonus and advances', async () => {
        await pool.query(
            "UPDATE payrolls SET bonuses = 5000, deductions = 2000 WHERE user_id = $1 AND TO_CHAR(pay_period_start, 'YYYY-MM') = $2",
            [org.sales.id, MONTH]
        );
        await as(org.finance.token).post('/api/finance/payroll/run', { month: MONTH });
        const rows = await rowsFor([org.sales.id, org.cst.id]);
        expect(rows.filter((r) => r.user_id === org.sales.id)).toHaveLength(1);
        expect(rows.filter((r) => r.user_id === org.cst.id)).toHaveLength(1);
        expect(rows.find((r) => r.user_id === org.sales.id).net_pay).toBe('53000'); // 50000 + 5000 - 2000
    });

    it('is atomic: one failing employee saves nothing for the month', async () => {
        const month = '2026-12';
        await pool.query(`
            CREATE OR REPLACE FUNCTION fail_payroll() RETURNS trigger AS $$
            BEGIN IF NEW.user_id = ${Number(org.cst.id)} THEN RAISE EXCEPTION 'boom'; END IF; RETURN NEW; END $$ LANGUAGE plpgsql;
            CREATE TRIGGER fail_payroll BEFORE INSERT ON payrolls FOR EACH ROW EXECUTE FUNCTION fail_payroll();
        `);
        try {
            const res = await as(org.finance.token).post('/api/finance/payroll/run', { month });
            expect(res.status).toBe(500);
            const { rows } = await pool.query("SELECT 1 FROM payrolls WHERE tenant_id = (SELECT tenant_id FROM users WHERE id = $1) AND TO_CHAR(pay_period_start, 'YYYY-MM') = $2", [org.sales.id, month]);
            expect(rows).toHaveLength(0);
        } finally {
            await pool.query('DROP TRIGGER IF EXISTS fail_payroll ON payrolls; DROP FUNCTION IF EXISTS fail_payroll();');
        }
    });

    it('returns every slip of the month, and only finance or admin may run payroll', async () => {
        const slips = await as(org.finance.token).get(`/api/finance/salary-slips?month=${MONTH}`);
        expect(slips.status).toBe(200);
        expect(slips.body.data.map((s) => s.user_id)).toEqual(expect.arrayContaining([org.sales.id, org.cst.id]));
        expect(slips.body.data.every((s) => s.pay_period_start)).toBe(true);
        expect((await as(org.sales.token).post('/api/finance/payroll/run', { month: MONTH })).status).toBe(403);
        expect((await as(org.finance.token).post('/api/finance/payroll/run', { month: '2026-13' })).status).toBe(400);
    });
});

// Plan 7.5: client CSV import for sales managers
describe('client CSV import', () => {
    let org;
    beforeAll(async () => {
        org = await setupOrg();
        await as(org.admin).post('/api/organization/custom-fields', { field_name: 'Plan', field_type: 'dropdown', options: ['Basic', 'Pro'] });
    });

    it('saves valid rows as new clients and lists invalid rows with reasons', async () => {
        const res = await as(org.sales_manager.token).post('/api/clients/import', {
            clients: [
                clientBody('Csv One', { customerName: 'Ann', email: 'ann@csv.one', paymentAmount: '1200', customFields: { Plan: 'Pro' } }),
                clientBody('', { customerName: 'No Company' }),
                clientBody('Bad Email', { email: 'not-an-email' }),
                clientBody('Bad Plan', { customFields: { Plan: 'Gold' } }),
                clientBody('Negative', { paymentAmount: -5 }),
                clientBody('Csv Two'),
            ],
        });
        expect(res.status).toBe(201);
        expect(res.body.data.created.map((c) => c.company_name)).toEqual(['Csv One', 'Csv Two']);
        expect(res.body.data.created[0]).toMatchObject({ status: 'new', sales_agent_id: org.sales_manager.id, custom_fields: { Plan: 'Pro' } });
        expect(res.body.data.rowErrors.map((e) => e.row)).toEqual([2, 3, 4, 5]);
        expect(res.body.data.rowErrors[0].error).toMatch(/company name is required/);
    });

    it('applies the same validation to the client form endpoint', async () => {
        expect((await as(org.sales_manager.token).post('/api/clients', { companyName: '' })).status).toBe(400);
        expect((await as(org.sales_manager.token).post('/api/clients', clientBody('Ok', { email: 'nope' }))).status).toBe(400);
    });

    it('refuses agents of another organization, Members and an empty file', async () => {
        const other = await setupOrg();
        const res = await as(org.sales_manager.token).post('/api/clients/import', {
            clients: [clientBody('Foreign Agent', { cst_agent_id: other.cst.id }), clientBody('Fine Co')],
        });
        expect(res.body.data.rowErrors).toEqual([{ row: 1, error: expect.stringMatching(/organization/) }]);
        expect((await as(org.sales.token).post('/api/clients/import', { clients: [clientBody('X')] })).status).toBe(403);
        expect((await as(org.sales_manager.token).post('/api/clients/import', { clients: [] })).status).toBe(400);
    });
});
