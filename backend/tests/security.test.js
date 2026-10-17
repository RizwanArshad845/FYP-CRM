import { describe, it, expect, beforeAll } from 'vitest';
import jwt from 'jsonwebtoken';
import { http, as, setupOrg } from './helpers.js';

const PROTECTED_GETS = [
    '/api/users', '/api/clients', '/api/tasks', '/api/cst/active-clients', '/api/sales/follow-ups',
    '/api/cst-manager/targets', '/api/sales-manager/targets', '/api/finance/employees', '/api/events',
    '/api/attendance/status', '/api/admin/company-metrics', '/api/notepads', '/api/concerns',
    '/api/templates', '/api/boards/list', '/api/organization', '/api/onboarding/state', '/api/auth/me',
];

describe('authentication', () => {
    it.each(PROTECTED_GETS)('%s rejects requests without a token', async (url) => {
        const res = await http().get(url);
        expect(res.status).toBe(401);
    });

    it('rejects a bare "Bearer" header without crashing', async () => {
        const res = await http().get('/api/users').set('Authorization', 'Bearer');
        expect(res.status).toBe(401);
    });

    it('rejects a token signed with the old hardcoded fallback secret', async () => {
        const forged = jwt.sign({ id: 1 }, 'crm_fallback_secret');
        const res = await http().get('/api/users').set('Authorization', `Bearer ${forged}`);
        expect(res.status).toBe(401);
    });

    it('rejects unauthenticated user creation (was open before)', async () => {
        const res = await http().post('/api/users').send({ first_name: 'x' });
        expect(res.status).toBe(401);
    });

    it('returns JSON 404 for unknown API routes', async () => {
        const res = await http().get('/api/does-not-exist');
        expect(res.status).toBe(404);
        expect(res.body.success).toBe(false);
    });
});

describe('login', () => {
    let org;
    beforeAll(async () => { org = await setupOrg(); });

    it('wrong password gets 401 with a generic message', async () => {
        const res = await http().post('/api/auth/login').send({ email: 'nobody@example.com', password: 'whatever1' });
        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Invalid email or password');
    });

    it('missing fields get 400', async () => {
        const res = await http().post('/api/auth/login').send({});
        expect(res.status).toBe(400);
    });

    it('/auth/me returns the session with organization and portals', async () => {
        const res = await as(org.sales.token).get('/api/auth/me');
        expect(res.status).toBe(200);
        expect(res.body.data.role).toBe('sales');
        expect(res.body.data.tier).toBe('Member');
        expect(res.body.data.organization.name).toBeTruthy();
        expect(res.body.data.portals).toHaveLength(6);
        expect(res.body.data).not.toHaveProperty('password_hash');
    });
});

describe('role guards', () => {
    let org;
    beforeAll(async () => { org = await setupOrg(); });

    it('non-admin cannot create users', async () => {
        const res = await as(org.sales.token).post('/api/users', {
            first_name: 'a', last_name: 'b', email: 'a@b.com', role_id: 1,
        });
        expect(res.status).toBe(403);
    });

    it('sales agent cannot read finance data', async () => {
        expect((await as(org.sales.token).get('/api/finance/employees')).status).toBe(403);
    });

    it('finance can read finance data', async () => {
        expect((await as(org.finance.token).get('/api/finance/employees')).status).toBe(200);
    });

    it('cst agent cannot resolve deactivation requests', async () => {
        const res = await as(org.cst.token).patch('/api/cst-manager/deactivation-requests/1/resolve', { status: 'approved' });
        expect(res.status).toBe(403);
    });

    it('non-admins do not see salaries in the user list', async () => {
        const res = await as(org.sales.token).get('/api/users');
        expect(res.status).toBe(200);
        expect(res.body.data.every((u) => !('base_salary' in u))).toBe(true);
        const adminView = await as(org.admin).get('/api/users');
        expect(adminView.body.data.every((u) => 'base_salary' in u)).toBe(true);
    });

    it('invalid numeric id gives 400, not 500', async () => {
        const res = await as(org.admin).get('/api/users/not-a-number');
        expect(res.status).toBe(400);
    });
});
