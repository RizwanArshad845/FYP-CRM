import { describe, it, expect, beforeAll } from 'vitest';
import { as, setupOrg } from './helpers.js';

// Org B creates one of everything; Org A (every role) must never see or touch it.
let A;
let B;
const b = {};

const ids = (res) => (res.body.data || []).map((r) => r.id);

beforeAll(async () => {
    A = await setupOrg();
    B = await setupOrg();

    const client = await as(B.sales_manager.token).post('/api/clients', {
        companyName: 'B Corp', customerName: 'Bob', email: 'bob@b.com', sales_agent_id: B.sales.id,
    });
    b.client = client.body.data.id;
    await as(B.cst_manager.token).patch(`/api/clients/${b.client}/assign`, { agentId: B.cst.id });

    b.followUp = (await as(B.sales.token).post('/api/sales/follow-ups', { client_id: b.client, due_date: '2026-11-01', notes: 'B secret' })).body.data.id;
    b.recording = (await as(B.sales.token).post('/api/sales/recordings', { client_id: b.client, recording_url: 'https://b/rec' })).body.data.id;
    b.note = (await as(B.cst.token).post('/api/cst/notes', { client_id: b.client, note_text: 'B note' })).body.data.id;
    b.schedule = (await as(B.cst.token).post('/api/cst/schedules', { title: 'B meeting', start_time: '2026-11-01T10:00:00Z', end_time: '2026-11-01T11:00:00Z' })).body.data.id;
    b.task = (await as(B.admin).post('/api/tasks', { title: 'B task', assigned_to: B.sales.id })).body.data.id;
    b.event = (await as(B.admin).post('/api/events', { title: 'B party', date: '2026-12-01', type: 'holiday' })).body.data.id;
    b.expense = (await as(B.finance.token).post('/api/finance/expenses', { category: 'Rent', amount: 999, expense_date: '2026-10-01' })).body.data.id;
    b.template = (await as(B.cst.token).post('/api/templates', { title: 'B tpl', content: 'hi' })).body.data.id;
    b.board = (await as(B.cst.token).post('/api/boards', { title: 'B board', board_state: {} })).body.data.id;
    b.concern = (await as(B.sales.token).post('/api/concerns', { concern_type: 'dialer', description: 'B issue' })).body.data.id;
    b.salesTarget = (await as(B.sales_manager.token).post('/api/sales-manager/targets', { user_id: B.sales.id, target_month: '2026-10-01', target_amount: 5000 })).body.data.id;
    b.cstTarget = (await as(B.cst_manager.token).post('/api/cst-manager/targets', { agent_id: B.cst.id, target_month: '2026-10', target_clients: 5 })).body.data.id;
    await as(B.sales.token).post('/api/notepads', { content: 'B private notes' });

    for (const [k, v] of Object.entries(b)) {
        if (!v) throw new Error(`seeding Org B failed for ${k}`);
    }
});

describe('cross-tenant isolation: reads', () => {
    const LISTS = [
        ['/api/clients', 'client'], ['/api/cst/active-clients', 'client'], ['/api/sales/follow-ups', 'followUp'],
        ['/api/sales/recordings', 'recording'], ['/api/cst/schedules', 'schedule'], ['/api/tasks', 'task'],
        ['/api/events', 'event'], ['/api/templates', 'template'], ['/api/boards/list', 'board'],
        ['/api/concerns', 'concern'], ['/api/sales-manager/targets', 'salesTarget'], ['/api/cst-manager/targets', 'cstTarget'],
    ];
    const ROLES = ['admin', 'sales', 'sales_manager', 'cst', 'cst_manager', 'finance'];

    it.each(LISTS)('%s never returns Org B rows', async (url, key) => {
        for (const role of ROLES) {
            const token = role === 'admin' ? A.admin : A[role].token;
            const res = await as(token).get(url);
            if (res.status === 403) continue;
            expect(res.status, `${role} ${url}`).toBe(200);
            expect(ids(res), `${role} ${url}`).not.toContain(b[key]);
        }
    });

    it('user list only contains own org', async () => {
        const res = await as(A.admin).get('/api/users');
        const bIds = [B.adminId, B.sales.id, B.cst.id];
        expect(ids(res).some((id) => bIds.includes(id))).toBe(false);
        expect((await as(A.admin).get(`/api/users/${B.sales.id}`)).status).toBe(404);
    });

    it('finance data only contains own org', async () => {
        const emp = await as(A.finance.token).get('/api/finance/employees');
        expect(ids(emp)).not.toContain(B.sales.id);
        expect(ids(await as(A.finance.token).get('/api/finance/expenses'))).not.toContain(b.expense);
        expect((await as(A.finance.token).get(`/api/finance/salary-slip/${B.sales.id}`)).status).toBe(404);
    });

    it('client notes of another org are not readable', async () => {
        expect((await as(A.cst_manager.token).get(`/api/cst/notes/${b.client}`)).status).toBe(404);
    });

    it('notepad is per user', async () => {
        const res = await as(A.sales.token).get(`/api/notepads?userId=${B.sales.id}`);
        expect(res.body.data.content).not.toBe('B private notes');
    });

    it('company metrics only count own org', async () => {
        const res = await as(A.admin).get('/api/admin/company-metrics');
        expect(Number(res.body.data.total_employees)).toBe(6);
    });
});

describe('cross-tenant isolation: writes', () => {
    it('cannot update or delete Org B records', async () => {
        const attempts = [
            as(A.cst_manager.token).put(`/api/clients/${b.client}`, { companyName: 'pwned' }),
            as(A.cst_manager.token).patch(`/api/clients/${b.client}/discard`, { reason: 'x' }),
            as(A.cst_manager.token).patch(`/api/clients/${b.client}/status`, { status: 'deactivated' }),
            as(A.sales_manager.token).put(`/api/sales/follow-ups/${b.followUp}`, { notes: 'pwned' }),
            as(A.sales_manager.token).delete(`/api/sales/follow-ups/${b.followUp}`),
            as(A.sales_manager.token).delete(`/api/sales/recordings/${b.recording}`),
            as(A.cst_manager.token).put(`/api/cst/notes/${b.note}`, { note_text: 'pwned' }),
            as(A.cst_manager.token).delete(`/api/cst/schedules/${b.schedule}`),
            as(A.admin).put(`/api/tasks/${b.task}`, { title: 'pwned' }),
            as(A.admin).delete(`/api/tasks/${b.task}`),
            as(A.admin).put(`/api/events/${b.event}`, { title: 'pwned', date: '2026-12-01' }),
            as(A.admin).delete(`/api/events/${b.event}`),
            as(A.finance.token).delete(`/api/finance/expenses/${b.expense}`),
            as(A.cst_manager.token).delete(`/api/templates/${b.template}`),
            as(A.cst.token).delete(`/api/boards/${b.board}`),
            as(A.admin).put(`/api/concerns/${b.concern}`, { status: 'resolved' }),
            as(A.sales_manager.token).delete(`/api/sales-manager/targets/${b.salesTarget}`),
            as(A.cst_manager.token).delete(`/api/cst-manager/targets/${b.cstTarget}`),
            as(A.admin).delete(`/api/users/${B.sales.id}`),
            as(A.admin).patch(`/api/users/${B.sales.id}/status`, { status: 'inactive' }),
        ];
        const results = await Promise.all(attempts);
        results.forEach((res) => expect(res.status, res.req.path).toBe(404));
    });

    it('cannot reference Org B users or clients in new records', async () => {
        const res = await Promise.all([
            as(A.cst_manager.token).patch(`/api/clients/${b.client}/assign`, { agentId: A.cst.id }),
            as(A.sales_manager.token).post('/api/sales-manager/targets', { user_id: B.sales.id, target_month: '2026-10-01', target_amount: 1 }),
            as(A.admin).post('/api/tasks', { title: 't', assigned_to: B.sales.id }),
            as(A.sales.token).post('/api/sales/follow-ups', { client_id: b.client, due_date: '2026-11-01' }),
            as(A.cst.token).post('/api/cst/notes', { client_id: b.client, note_text: 'x' }),
            as(A.finance.token).patch(`/api/finance/salary/${B.sales.id}`, { base_salary: 1 }),
        ]);
        expect(res.map((r) => r.status)).toEqual([404, 400, 400, 404, 404, 400]);
    });

    it('Org B data is untouched afterwards', async () => {
        const clients = await as(B.sales_manager.token).get('/api/clients');
        const client = clients.body.data.find((c) => c.id === b.client);
        expect(client.company_name).toBe('B Corp');
        expect(client.status).toBe('active');
        expect(ids(await as(B.admin).get('/api/events'))).toContain(b.event);
    });
});
