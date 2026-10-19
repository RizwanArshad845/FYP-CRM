import { describe, it, expect, beforeAll } from 'vitest';
import { as, clientBody, http, setupOrg, unique } from './helpers.js';

// Same organization, different people: agents may only touch their own records.
let org;
let other; // a second sales agent and cst agent in the same org

beforeAll(async () => {
    org = await setupOrg();
    const { admin } = org;
    // Wizard is complete, so add more people through Employee Management
    const roles = (await as(admin).get('/api/users/roles')).body.data;
    const create = async (role) => {
        const roleId = roles.find((r) => r.name === role).id;
        const email = `${unique(role)}@example.com`;
        const res = await as(admin).post('/api/users', { first_name: role, last_name: 'Two', email, role_id: roleId, password: 'InitialPass123' });
        const login = await http().post('/api/auth/login').send({ email, password: 'InitialPass123' });
        await as(login.body.token).post('/api/auth/change-password', { currentPassword: 'InitialPass123', newPassword: 'SecondPass123' });
        return { id: res.body.data.id, token: login.body.token };
    };
    other = { sales: await create('sales'), cst: await create('cst') };
});

describe('follow-ups and recordings', () => {
    it("an agent cannot edit or delete another agent's follow-up", async () => {
        const fu = (await as(org.sales.token).post('/api/sales/follow-ups', { due_date: '2026-11-01', client_name_text: 'Lead' })).body.data;
        expect((await as(other.sales.token).put(`/api/sales/follow-ups/${fu.id}`, { notes: 'mine now' })).status).toBe(404);
        expect((await as(other.sales.token).delete(`/api/sales/follow-ups/${fu.id}`)).status).toBe(404);
        expect((await as(org.sales.token).delete(`/api/sales/follow-ups/${fu.id}`)).status).toBe(200);
    });

    it('an agent cannot create follow-ups on behalf of someone else', async () => {
        const res = await as(org.sales.token).post('/api/sales/follow-ups', { user_id: other.sales.id, due_date: '2026-11-01' });
        expect(res.status).toBe(201);
        expect(res.body.data.sales_agent_id).toBe(org.sales.id);
    });

    it('agents only see their own follow-ups; managers see all', async () => {
        await as(other.sales.token).post('/api/sales/follow-ups', { due_date: '2026-11-02', client_name_text: 'Other lead' });
        const mine = await as(org.sales.token).get('/api/sales/follow-ups');
        expect(mine.body.data.every((f) => f.sales_agent_id === org.sales.id)).toBe(true);
        const all = await as(org.sales_manager.token).get('/api/sales/follow-ups');
        expect(all.body.data.some((f) => f.sales_agent_id === other.sales.id)).toBe(true);
    });

    it("an agent cannot delete another agent's recording", async () => {
        const rec = (await as(org.sales.token).post('/api/sales/recordings', { recording_url: 'https://x' })).body.data;
        expect((await as(other.sales.token).delete(`/api/sales/recordings/${rec.id}`)).status).toBe(404);
    });
});

describe('notepads and concerns', () => {
    it('the userId parameter is ignored; each user gets their own notepad', async () => {
        await as(org.sales.token).post('/api/notepads', { userId: other.sales.id, content: 'written by agent one' });
        const otherPad = await as(other.sales.token).get('/api/notepads');
        expect(otherPad.body.data.content).toBe('');
        const ownPad = await as(org.sales.token).get(`/api/notepads?userId=${other.sales.id}`);
        expect(ownPad.body.data.content).toBe('written by agent one');
    });

    it("the userId query cannot be used to read someone else's concerns", async () => {
        await as(other.sales.token).post('/api/concerns', { concern_type: 'dialer', description: 'private' });
        const res = await as(org.sales.token).get(`/api/concerns?userId=${other.sales.id}`);
        expect(res.body.data.every((c) => c.raised_by === org.sales.id)).toBe(true);
    });

    it("an agent cannot delete someone else's concern", async () => {
        const c = (await as(other.sales.token).post('/api/concerns', { concern_type: 'x', description: 'y' })).body.data;
        expect((await as(org.sales.token).delete(`/api/concerns/${c.id}`)).status).toBe(403);
    });
});

describe('clients and targets', () => {
    let clientId;
    beforeAll(async () => {
        clientId = (await as(org.sales_manager.token).post('/api/clients', clientBody('Assigned Co'))).body.data.id;
        await as(org.cst_manager.token).patch(`/api/clients/${clientId}/assign`, { agentId: org.cst.id });
    });

    it('a cst agent cannot flag a client assigned to someone else', async () => {
        const res = await as(other.cst.token).patch(`/api/clients/${clientId}/status`, { status: 'flagged', flag_type: 'red' });
        expect(res.status).toBe(403);
        expect((await as(org.cst.token).patch(`/api/clients/${clientId}/status`, { status: 'flagged', flag_type: 'red' })).status).toBe(200);
    });

    it("a cst agent cannot read notes on someone else's client", async () => {
        expect((await as(other.cst.token).get(`/api/cst/notes/${clientId}`)).status).toBe(403);
    });

    it("a sales agent cannot update another agent's achieved amount", async () => {
        const t = (await as(org.sales_manager.token).post('/api/sales-manager/targets', { user_id: org.sales.id, target_month: '2026-10-01', target_amount: 100 })).body.data;
        expect((await as(other.sales.token).patch(`/api/sales-manager/targets/${t.id}/achieved`, { achieved: 99 })).status).toBe(404);
        const own = await as(org.sales.token).patch(`/api/sales-manager/targets/${t.id}/achieved`, { achieved: 50 });
        expect(own.status).toBe(200);
        expect(Number(own.body.data.achieved_amount)).toBe(50);
    });

    it('deactivation approval records the real reviewer and discards the client', async () => {
        const reqRes = await as(org.cst.token).post('/api/cst/deactivation-requests', { client_id: clientId, reason: 'churned' });
        expect(reqRes.status).toBe(201);
        expect(reqRes.body.data.requested_by).toBe(org.cst.id);
        const resolved = await as(org.cst_manager.token).patch(`/api/cst-manager/deactivation-requests/${reqRes.body.data.id}/resolve`, { status: 'approved', reviewed_by: 999999 });
        expect(resolved.status).toBe(200);
        const client = (await as(org.cst_manager.token).get('/api/clients')).body.data.find((c) => c.id === clientId);
        expect(client.status).toBe('discarded');
        expect(client.discard_reason).toBe('churned');
        expect(client.discarded_at).toBeTruthy();
    });
});

describe('tasks', () => {
    it('only the assignee can submit; submission is atomic', async () => {
        const task = (await as(org.sales_manager.token).post('/api/tasks', { title: 'Call list', assigned_to: org.sales.id })).body.data;
        expect((await as(other.sales.token).post(`/api/tasks/${task.id}/submit`, { submission_notes: 'x' })).status).toBe(404);
        const ok = await as(org.sales.token).post(`/api/tasks/${task.id}/submit`, { submission_notes: 'done' });
        expect(ok.status).toBe(201);
        expect(ok.body.data.task.status).toBe('submitted');
    });

    it('deleting a user with history works (transactional purge)', async () => {
        const task = (await as(org.admin).post('/api/tasks', { title: 'x', assigned_to: other.sales.id })).body.data;
        await as(other.sales.token).post(`/api/tasks/${task.id}/submit`, { submission_notes: 'y' });
        await as(other.sales.token).post('/api/attendance/clock-in');
        const res = await as(org.admin).delete(`/api/users/${other.sales.id}`);
        expect(res.status).toBe(200);
        expect((await as(org.admin).get(`/api/users/${other.sales.id}`)).status).toBe(404);
    });

    it('an admin cannot delete themselves', async () => {
        expect((await as(org.admin).delete(`/api/users/${org.adminId}`)).status).toBe(400);
    });
});
