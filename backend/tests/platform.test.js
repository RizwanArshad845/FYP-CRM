import { describe, it, expect, beforeAll } from 'vitest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';
import { as, clientBody, http, setupOrg, signupOrg, unique } from './helpers.js';

// Platform administrator module (plan 4.5): view only, no access to tenant records.
const PASSWORD = 'PlatformPass123!';
let platform;
let org;
let fresh;
let orgId;

beforeAll(async () => {
    const email = `${unique('ops')}@aicre.example`;
    await pool.query('INSERT INTO platform_admins (name, email, password_hash) VALUES ($1, $2, $3)',
        ['Ops Owner', email, await bcrypt.hash(PASSWORD, 10)]);
    const login = await http().post('/api/platform/auth/login').send({ email, password: PASSWORD });
    expect(login.status).toBe(200);
    platform = login.body.token;

    org = await setupOrg();
    orgId = (await as(org.admin).get('/api/auth/me')).body.data.organization.id;
    await as(org.sales_manager.token).post('/api/clients', clientBody('Secret Client Co', { customerName: 'Hidden Person', email: 'hidden@client.co' }));
    fresh = await signupOrg(unique('Still Onboarding '));
});

describe('platform login', () => {
    it('issues a platform-scoped token', () => {
        expect(jwt.decode(platform)).toMatchObject({ scope: 'platform' });
    });

    it('uses the generic message for a wrong password and for tenant accounts', async () => {
        const wrong = await http().post('/api/platform/auth/login').send({ email: 'nobody@aicre.example', password: 'whatever1' });
        expect(wrong.status).toBe(401);
        expect(wrong.body.error).toBe('Incorrect email or password.');
        const tenant = await http().post('/api/platform/auth/login').send({ email: org.sales.email, password: 'EmployeePass123!' });
        expect(tenant.status).toBe(401);
    });
});

describe('platform API', () => {
    it('reads the organization list with onboarding status, portals and head counts', async () => {
        const res = await as(platform).get('/api/platform/organizations');
        expect(res.status).toBe(200);
        const row = res.body.data.find((o) => o.id === orgId);
        expect(row.onboarding).toEqual({ completed: true, current_step: 'done' });
        expect(row.enabled_portals.map((p) => p.key)).toContain('admin');
        expect(row.employee_count).toEqual({ active: 6, total: 6 });
        const inProgress = res.body.data.find((o) => o.id === fresh.user.organization.id);
        expect(inProgress.onboarding).toEqual({ completed: false, current_step: 'portals' });
    });

    it('filters by search and onboarding status', async () => {
        const slug = fresh.user.organization.slug;
        const search = await as(platform).get(`/api/platform/organizations?search=${slug}`);
        expect(search.body.data.map((o) => o.slug)).toEqual([slug]);
        const completed = await as(platform).get('/api/platform/organizations?status=completed');
        expect(completed.body.data.every((o) => o.onboarding.completed)).toBe(true);
        const onboarding = await as(platform).get('/api/platform/organizations?status=in_progress');
        expect(onboarding.body.data.every((o) => !o.onboarding.completed)).toBe(true);
    });

    it('shows one organization with every portal type and its employee count', async () => {
        const res = await as(platform).get(`/api/platform/organizations/${orgId}`);
        expect(res.status).toBe(200);
        expect(res.body.data.portals).toHaveLength(6);
        expect(res.body.data.portals.find((p) => p.key === 'sales')).toMatchObject({ enabled: true, employee_count: 1 });
        expect((await as(platform).get('/api/platform/organizations/999999')).status).toBe(404);
    });

    it('summarizes organizations by onboarding status', async () => {
        const res = await as(platform).get('/api/platform/summary');
        expect(res.body.data.total).toBe(res.body.data.completed + res.body.data.onboarding);
        expect(res.body.data.onboarding).toBeGreaterThan(0);
    });

    it('responses contain no user email, user name or client fields', async () => {
        const bodies = await Promise.all([
            as(platform).get('/api/platform/organizations'),
            as(platform).get(`/api/platform/organizations/${orgId}`),
            as(platform).get('/api/platform/summary'),
        ]);
        for (const { body } of bodies) {
            const text = JSON.stringify(body);
            for (const secret of [org.sales.email, 'Tester', 'Ada', 'Secret Client Co', 'Hidden Person', 'hidden@client.co', 'base_salary', 'password']) {
                expect(text).not.toContain(secret);
            }
        }
    });
});

describe('token separation', () => {
    it('a tenant token gets 401 on /api/platform/*', async () => {
        for (const path of ['/api/platform/organizations', `/api/platform/organizations/${orgId}`, '/api/platform/summary']) {
            expect((await as(org.admin).get(path)).status).toBe(401);
        }
    });

    it('a platform token gets 401 on tenant routes', async () => {
        for (const path of ['/api/clients', '/api/users', '/api/auth/me', '/api/organization']) {
            expect((await as(platform).get(path)).status).toBe(401);
        }
    });

    it('an inactive platform admin is refused', async () => {
        const email = `${unique('off')}@aicre.example`;
        await pool.query("INSERT INTO platform_admins (name, email, password_hash, status) VALUES ('Off', $1, $2, 'inactive')",
            [email, await bcrypt.hash(PASSWORD, 10)]);
        expect((await http().post('/api/platform/auth/login').send({ email, password: PASSWORD })).status).toBe(401);
    });
});
