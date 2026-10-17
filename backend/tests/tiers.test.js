import { describe, it, expect, beforeAll } from 'vitest';
import { as, http, signupOrg, unique, EMPLOYEE_PASSWORD } from './helpers.js';

// Tier = row scope inside a portal: Member own, Manager team (portal family), Admin org.

const activate = async (created) => {
    const login = await http().post('/api/auth/login').send({ email: created.email, password: created.tempPassword });
    await as(login.body.token).post('/api/auth/change-password', { currentPassword: created.tempPassword, newPassword: EMPLOYEE_PASSWORD });
    return { id: created.id, token: login.body.token, tier: created.tier };
};

let admin;
const p = {};

beforeAll(async () => {
    ({ token: admin } = await signupOrg());
    const rows = [
        ['salesMember', 'sales', 'Member'],
        ['salesMember2', 'sales', 'Member'],
        ['salesLead', 'sales', 'Manager'],     // Manager tier inside the Sales portal
        ['weakManager', 'sales_manager', 'Member'], // manager portal, but Member tier
        ['cstMember', 'cst', undefined],        // defaults to the portal's tier
        ['orgWideSales', 'sales', 'Admin'],
    ];
    const res = await as(admin).post('/api/onboarding/employees', {
        employees: rows.map(([key, portal_key, tier]) => ({
            first_name: key, last_name: 'T', email: `${unique(key)}@example.com`, portal_key, ...(tier && { tier }),
        })),
    });
    expect(res.status).toBe(201);
    for (const [i, [key]] of rows.entries()) p[key] = await activate(res.body.data.created[i]);
    await as(admin).post('/api/onboarding/complete');
});

describe('tier assignment', () => {
    it('stores the chosen tier and defaults to the portal tier', async () => {
        expect(p.salesLead.tier).toBe('Manager');
        expect(p.weakManager.tier).toBe('Member');
        expect(p.cstMember.tier).toBe('Member');
        expect((await as(p.salesLead.token).get('/api/auth/me')).body.data.tier).toBe('Manager');
    });

    it('the Admin portal is always Admin tier', async () => {
        const roles = (await as(admin).get('/api/users/roles')).body.data;
        const adminRole = roles.find((r) => r.name === 'admin');
        const res = await as(admin).post('/api/users', {
            first_name: 'Second', last_name: 'Admin', email: `${unique('adm')}@example.com`, role_id: adminRole.id, tier: 'Member',
        });
        expect(res.status).toBe(201);
        expect(res.body.data.tier).toBe('Admin');
    });

    it('an admin can change a tier and it is kept when not sent', async () => {
        const roles = (await as(admin).get('/api/users/roles')).body.data;
        const salesRole = roles.find((r) => r.name === 'sales');
        const users = (await as(admin).get('/api/users')).body.data;
        const target = users.find((u) => u.id === p.salesMember2.id);
        const body = { first_name: target.first_name, last_name: target.last_name, email: target.email, role_id: salesRole.id };

        const promoted = await as(admin).put(`/api/users/${target.id}`, { ...body, tier: 'Manager' });
        expect(promoted.body.data.tier).toBe('Manager');
        const kept = await as(admin).put(`/api/users/${target.id}`, body);
        expect(kept.body.data.tier).toBe('Manager');
        const demoted = await as(admin).put(`/api/users/${target.id}`, { ...body, tier: 'Member' });
        expect(demoted.body.data.tier).toBe('Member');
    });
});

describe('row scope by tier', () => {
    beforeAll(async () => {
        await as(p.salesMember.token).post('/api/sales/follow-ups', { due_date: '2026-11-01', client_name_text: 'Member lead' });
        await as(p.salesMember2.token).post('/api/sales/follow-ups', { due_date: '2026-11-02', client_name_text: 'Member2 lead' });
        await as(p.salesMember.token).post('/api/concerns', { concern_type: 'dialer', description: 'sales issue' });
        await as(p.cstMember.token).post('/api/concerns/internal', { concern_type: 'Client', description: 'cst issue' });
        await as(p.cstMember.token).post('/api/concerns', { concern_type: 'workstation', description: 'cst external issue' });
    });

    const agentIds = (res) => new Set(res.body.data.map((f) => f.sales_agent_id));

    it('Member sees only their own follow-ups', async () => {
        const ids = agentIds(await as(p.salesMember.token).get('/api/sales/follow-ups'));
        expect([...ids]).toEqual([p.salesMember.id]);
    });

    it('Manager tier sees the whole team, even inside the Sales portal', async () => {
        const ids = agentIds(await as(p.salesLead.token).get('/api/sales/follow-ups'));
        expect(ids.has(p.salesMember.id) && ids.has(p.salesMember2.id)).toBe(true);
    });

    it('a Member in a manager portal is limited to their own records', async () => {
        const res = await as(p.weakManager.token).get('/api/sales/follow-ups');
        expect(res.body.data).toEqual([]);
    });

    it('Manager scope stops at the team: sales lead cannot see CST concerns; Admin tier sees all', async () => {
        const lead = await as(p.salesLead.token).get('/api/concerns');
        expect(lead.body.data.some((c) => c.description === 'sales issue')).toBe(true);
        expect(lead.body.data.some((c) => c.description === 'cst external issue')).toBe(false);

        const orgWide = await as(p.orgWideSales.token).get('/api/concerns');
        expect(orgWide.body.data.some((c) => c.description === 'cst external issue')).toBe(true);
    });

    it("Manager can edit a teammate's follow-up; Member cannot", async () => {
        const fu = (await as(p.salesMember2.token).get('/api/sales/follow-ups')).body.data[0];
        expect((await as(p.salesMember.token).put(`/api/sales/follow-ups/${fu.id}`, { notes: 'x' })).status).toBe(404);
        expect((await as(p.salesLead.token).put(`/api/sales/follow-ups/${fu.id}`, { notes: 'coached' })).status).toBe(200);
    });

    it('Manager can act for a teammate but not for someone outside the team', async () => {
        const forTeammate = await as(p.salesLead.token).post('/api/sales/follow-ups', { user_id: p.salesMember.id, due_date: '2026-11-03' });
        expect(forTeammate.body.data.sales_agent_id).toBe(p.salesMember.id);
        const outside = await as(p.salesLead.token).post('/api/sales/follow-ups', { user_id: p.cstMember.id, due_date: '2026-11-03' });
        expect(outside.status).toBe(400);
    });
});

describe('manager actions need Manager tier', () => {
    it('Member tier in the Sales Manager portal cannot assign targets', async () => {
        const res = await as(p.weakManager.token).post('/api/sales-manager/targets', {
            user_id: p.salesMember.id, target_month: '2026-10-01', target_amount: 100,
        });
        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/Manager tier/);
    });

    it('Member tier cannot delegate tasks', async () => {
        expect((await as(p.weakManager.token).post('/api/tasks', { title: 'x', assigned_to: p.salesMember.id })).status).toBe(403);
    });
});

describe('tier labels', () => {
    it('saves display labels for all three tiers of a portal', async () => {
        const { token } = await signupOrg();
        const res = await as(token).put('/api/onboarding/labels', {
            portals: [{ key: 'sales', custom_label: 'Revenue', tier_labels: { Admin: 'VP Sales', Manager: 'Team Lead', Member: 'Account Executive' } }],
        });
        expect(res.status).toBe(200);
        expect(res.body.data.portals.find((x) => x.key === 'sales').tierLabels).toEqual({
            Admin: 'VP Sales', Manager: 'Team Lead', Member: 'Account Executive',
        });
    });

    it('rejects an invalid tier in the employee batch', async () => {
        const { token } = await signupOrg();
        const res = await as(token).post('/api/onboarding/employees', {
            employees: [{ first_name: 'A', last_name: 'B', email: `${unique('t')}@example.com`, portal_key: 'sales', tier: 'Boss' }],
        });
        expect(res.status).toBe(400);
        expect(res.body.rowErrors[0].error).toMatch(/tier/);
    });

    it('accepts lower-case tiers (CSV)', async () => {
        const { token } = await signupOrg();
        const res = await as(token).post('/api/onboarding/employees', {
            employees: [{ first_name: 'A', last_name: 'B', email: `${unique('t')}@example.com`, portal_key: 'sales', tier: 'manager' }],
        });
        expect(res.status).toBe(201);
        expect(res.body.data.created[0].tier).toBe('Manager');
    });
});
