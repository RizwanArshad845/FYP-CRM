import { describe, it, expect, beforeAll } from 'vitest';
import { http, as, signupOrg, addActiveEmployees, unique, ADMIN_PASSWORD } from './helpers.js';

describe('organization signup', () => {
    it('creates org, all portals, default departments, admin and wizard state', async () => {
        const { token, user, adminEmail } = await signupOrg('Acme Inc');
        expect(user.role).toBe('admin');
        expect(user.tier).toBe('Admin');
        expect(user.organization.name).toBe('Acme Inc');
        expect(user.onboardingCompleted).toBe(false);
        expect(user.onboardingStep).toBe('portals');
        expect(user.mustChangePassword).toBe(false);

        const state = await as(token).get('/api/onboarding/state');
        expect(state.status).toBe(200);
        expect(state.body.data.portals.map((p) => p.key)).toEqual(['admin', 'sales', 'sales_manager', 'cst', 'cst_manager', 'finance']);
        expect(state.body.data.departments.map((d) => d.name)).toContain('Administration');
        expect(state.body.data.employees).toHaveLength(1);

        const login = await http().post('/api/auth/login').send({ email: adminEmail, password: ADMIN_PASSWORD });
        expect(login.status).toBe(200);
    });

    it('gives the second org with the same name a distinct slug', async () => {
        const a = await signupOrg('Same Name');
        const b = await signupOrg('Same Name');
        expect(a.user.organization.slug).not.toBe(b.user.organization.slug);
    });

    it('rejects a duplicate admin email with 409', async () => {
        const { adminEmail } = await signupOrg();
        const res = await http().post('/api/onboarding/organization').send({
            organization: { name: 'Dupe Co' },
            admin: { first_name: 'A', last_name: 'B', email: adminEmail, password: 'Password123' },
        });
        expect(res.status).toBe(409);
    });

    it('validates input', async () => {
        const res = await http().post('/api/onboarding/organization').send({
            organization: { name: 'X' }, admin: { first_name: 'A', last_name: 'B', email: 'bad', password: 'short' },
        });
        expect(res.status).toBe(400);
    });
});

describe('wizard steps', () => {
    let token;
    beforeAll(async () => { ({ token } = await signupOrg()); });

    it('cannot disable the admin portal', async () => {
        const res = await as(token).put('/api/onboarding/portals', { portals: [{ key: 'admin', enabled: false }] });
        expect(res.status).toBe(400);
    });

    it('disables portals and advances to labels', async () => {
        const res = await as(token).put('/api/onboarding/portals', {
            portals: [{ key: 'finance', enabled: false }, { key: 'cst_manager', enabled: false }],
        });
        expect(res.status).toBe(200);
        expect(res.body.data.step).toBe('labels');
        const finance = res.body.data.portals.find((p) => p.key === 'finance');
        expect(finance.enabled).toBe(false);
    });

    it('saves display labels and advances to employees', async () => {
        const res = await as(token).put('/api/onboarding/labels', {
            portals: [{ key: 'sales', custom_label: 'Revenue', tier_labels: { Member: 'Account Executive' } }],
        });
        expect(res.status).toBe(200);
        expect(res.body.data.step).toBe('employees');
        const sales = res.body.data.portals.find((p) => p.key === 'sales');
        expect(sales.label).toBe('Revenue');
        expect(sales.tierLabels.Member).toBe('Account Executive');
    });

    it('resumes at the saved step', async () => {
        const res = await as(token).get('/api/onboarding/state');
        expect(res.body.data.step).toBe('employees');
    });

    it('rejects the whole batch with per-row errors, creating nothing', async () => {
        const res = await as(token).post('/api/onboarding/employees', {
            employees: [
                { first_name: 'Ok', last_name: 'Row', email: `${unique('ok')}@example.com`, portal_key: 'sales' },
                { first_name: 'Bad', last_name: 'Portal', email: `${unique('fin')}@example.com`, portal_key: 'finance' },
                { first_name: '', last_name: 'NoName', email: 'not-an-email', portal_key: 'sales' },
            ],
        });
        expect(res.status).toBe(400);
        expect(res.body.rowErrors.map((e) => e.row)).toEqual([2, 3]);

        const state = await as(token).get('/api/onboarding/state');
        expect(state.body.data.employees).toHaveLength(1); // only the admin
    });

    it('creates employees with one-time temporary passwords', async () => {
        const email = `${unique('rep')}@example.com`;
        const res = await as(token).post('/api/onboarding/employees', {
            employees: [{ first_name: 'Rita', last_name: 'Rep', email, portal_key: 'sales', department: 'sales' }],
        });
        expect(res.status).toBe(201);
        const [created] = res.body.data.created;
        expect(created.tempPassword).toMatch(/^[A-Za-z0-9]{12}$/);
        expect(res.body.data.state.step).toBe('review');

        // Temp password works, but only for changing the password
        const login = await http().post('/api/auth/login').send({ email, password: created.tempPassword });
        expect(login.status).toBe(200);
        expect(login.body.user.mustChangePassword).toBe(true);
        expect(login.body.user.tier).toBe('Member');

        const blocked = await as(login.body.token).get('/api/clients');
        expect(blocked.status).toBe(403);
        expect(blocked.body.code).toBe('PASSWORD_CHANGE_REQUIRED');

        expect((await as(login.body.token).get('/api/auth/me')).status).toBe(200);

        const change = await as(login.body.token).post('/api/auth/change-password', {
            currentPassword: created.tempPassword, newPassword: 'BrandNewPass1',
        });
        expect(change.status).toBe(200);
        expect(change.body.data.mustChangePassword).toBe(false);
        expect((await as(login.body.token).get('/api/clients')).status).toBe(200);
    });

    it('rejects an employee whose email already exists', async () => {
        const first = await addActiveEmployees(token, ['sales']);
        const res = await as(token).post('/api/onboarding/employees', {
            employees: [{ first_name: 'X', last_name: 'Y', email: first.sales.email, portal_key: 'sales' }],
        });
        expect(res.status).toBe(400);
        expect(res.body.rowErrors[0].error).toMatch(/already exists/);
    });

    it('only an admin can run the wizard', async () => {
        const emp = await addActiveEmployees(token, ['sales']);
        expect((await as(emp.sales.token).get('/api/onboarding/state')).status).toBe(403);
    });

    it('completes, then locks the wizard', async () => {
        const res = await as(token).post('/api/onboarding/complete');
        expect(res.status).toBe(200);
        expect(res.body.data.onboardingCompleted).toBe(true);
        expect((await as(token).get('/api/onboarding/state')).status).toBe(409);
    });
});

describe('organization settings', () => {
    let token;
    let people;
    beforeAll(async () => {
        ({ token } = await signupOrg());
        people = await addActiveEmployees(token, ['sales']);
        await as(token).post('/api/onboarding/complete');
    });

    it('refuses to disable a portal that has active users', async () => {
        const res = await as(token).put('/api/organization/portals', { portals: [{ key: 'sales', enabled: false }] });
        expect(res.status).toBe(409);
    });

    it('disables an unused portal and drops it from the role picker', async () => {
        const before = await as(token).get('/api/users/roles');
        const financeRoleId = before.body.data.find((r) => r.name === 'finance').id;

        const res = await as(token).put('/api/organization/portals', { portals: [{ key: 'finance', enabled: false }] });
        expect(res.status).toBe(200);

        const roles = await as(token).get('/api/users/roles');
        expect(roles.body.data.map((r) => r.name)).not.toContain('finance');

        // Creating an employee on the disabled portal is refused
        const create = await as(token).post('/api/users', {
            first_name: 'Fin', last_name: 'Ance', email: `${unique('fin')}@example.com`, role_id: financeRoleId,
        });
        expect(create.status).toBe(400);
    });

    it('relabels portals after onboarding', async () => {
        const res = await as(token).put('/api/organization/labels', { portals: [{ key: 'cst', custom_label: 'Success Team' }] });
        expect(res.status).toBe(200);
        expect(res.body.data.portals.find((p) => p.key === 'cst').label).toBe('Success Team');
    });

    it('non-admins cannot change settings', async () => {
        expect((await as(people.sales.token).put('/api/organization', { name: 'Hacked' })).status).toBe(403);
    });

    it('admin user creation returns a temp password and forces a change', async () => {
        const roles = await as(token).get('/api/users/roles');
        const salesRole = roles.body.data.find((r) => r.name === 'sales');
        const email = `${unique('new')}@example.com`;
        const res = await as(token).post('/api/users', { first_name: 'New', last_name: 'Hire', email, role_id: salesRole.id });
        expect(res.status).toBe(201);
        expect(res.body.tempPassword).toBeTruthy();
        const login = await http().post('/api/auth/login').send({ email, password: res.body.tempPassword });
        expect(login.body.user.mustChangePassword).toBe(true);
    });
});
