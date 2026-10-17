import request from 'supertest';
import app from '../app.js';

let counter = 0;
export const unique = (prefix = 'x') => `${prefix}${Date.now().toString(36)}${(counter++).toString(36)}`;

export const http = () => request(app);

// supertest request with a bearer token
export const as = (token) => ({
    get: (url) => request(app).get(url).set('Authorization', `Bearer ${token}`),
    post: (url, body) => request(app).post(url).set('Authorization', `Bearer ${token}`).send(body ?? {}),
    put: (url, body) => request(app).put(url).set('Authorization', `Bearer ${token}`).send(body ?? {}),
    patch: (url, body) => request(app).patch(url).set('Authorization', `Bearer ${token}`).send(body ?? {}),
    delete: (url) => request(app).delete(url).set('Authorization', `Bearer ${token}`),
});

export const ADMIN_PASSWORD = 'AdminPass123!';
export const EMPLOYEE_PASSWORD = 'EmployeePass123!';

// Signs up a new organization; returns { token, user, adminEmail }
export const signupOrg = async (name = unique('Org ')) => {
    const adminEmail = `${unique('admin')}@example.com`;
    const res = await http().post('/api/onboarding/organization').send({
        organization: { name, industry: 'Software', size: '11-50' },
        admin: { first_name: 'Ada', last_name: 'Admin', email: adminEmail, password: ADMIN_PASSWORD },
    });
    if (res.status !== 201) throw new Error(`signup failed: ${res.status} ${JSON.stringify(res.body)}`);
    return { token: res.body.token, user: res.body.user, adminEmail };
};

// Creates employees through the wizard and activates them (password changed).
// Returns a map portal_key -> { id, email, token }
export const addActiveEmployees = async (adminToken, portalKeys) => {
    const employees = portalKeys.map((portal_key) => ({
        first_name: portal_key, last_name: 'Tester', email: `${unique(portal_key)}@example.com`, portal_key,
    }));
    const res = await as(adminToken).post('/api/onboarding/employees', { employees });
    if (res.status !== 201) throw new Error(`addEmployees failed: ${res.status} ${JSON.stringify(res.body)}`);

    const out = {};
    for (const emp of res.body.data.created) {
        const login = await http().post('/api/auth/login').send({ email: emp.email, password: emp.tempPassword });
        const change = await as(login.body.token).post('/api/auth/change-password', {
            currentPassword: emp.tempPassword, newPassword: EMPLOYEE_PASSWORD,
        });
        if (change.status !== 200) throw new Error(`activate failed: ${JSON.stringify(change.body)}`);
        out[emp.portal_key] = { id: emp.id, email: emp.email, token: login.body.token };
    }
    return out;
};

// A fully set-up org: admin plus one active employee per portal, onboarding complete.
export const setupOrg = async () => {
    const { token: admin, user } = await signupOrg();
    const people = await addActiveEmployees(admin, ['sales', 'sales_manager', 'cst', 'cst_manager', 'finance']);
    await as(admin).post('/api/onboarding/complete');
    return { admin, adminId: user.id, ...people };
};
