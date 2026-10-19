import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import app from '../app.js';
import pool from '../config/db.js';
import { as, clientBody, http, setupOrg, signupOrg, unique, EMPLOYEE_PASSWORD } from './helpers.js';

// Whole-API sweep. Part 1 calls every route once as a user who may use it, with a
// valid body, and expects success. Part 2 throws bad ids, other organizations' ids
// and junk bodies at every route as every kind of caller, and expects no 5xx ever.

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Every route, read from app.js mounts and the route files, so new routes are swept too.
const ROUTES = (() => {
    const appSrc = fs.readFileSync(path.join(backendDir, 'app.js'), 'utf8');
    const out = [];
    for (const [, mount, name] of appSrc.matchAll(/app\.use\('(\/api\/[a-z/-]+)',\s*(?:protect,\s*)?(\w+Routes)\)/g)) {
        const src = fs.readFileSync(path.join(backendDir, 'routes', `${name}.js`), 'utf8');
        for (const [, method, sub] of src.matchAll(/router\.(get|post|put|patch|delete)\('([^']*)'/g)) {
            out.push({ method, path: (mount + sub).replace(/\/$/, '') });
        }
    }
    return out;
})();

const ok = (res) => res.status >= 200 && res.status < 300;
const show = (res) => `${res.status} ${JSON.stringify(res.body).slice(0, 200)}`;

let org;
let other;
let platform;
const ids = {};
const otherIds = {};

const send = (token, method, url, body) => {
    const req = request(app)[method](url);
    if (token) req.set('Authorization', `Bearer ${token}`);
    return method === 'get' || method === 'delete' ? req : req.send(body ?? {});
};

// Data both organizations need so ids exist for every resource
const seed = async (o, store) => {
    const client = (await as(o.sales_manager.token).post('/api/clients', clientBody('Sweep Co', { customerName: 'Sam', sales_agent_id: o.sales.id }))).body.data;
    store.client = client.id;
    await as(o.cst_manager.token).patch(`/api/clients/${client.id}/assign`, { agentId: o.cst.id });
    store.followUp = (await as(o.sales.token).post('/api/sales/follow-ups', { client_id: client.id, due_date: '2026-12-01' })).body.data.id;
    store.recording = (await as(o.sales.token).post('/api/sales/recordings', { client_id: client.id, recording_url: 'https://r/1', transcript: 't' })).body.data.id;
    store.important = (await as(o.sales.token).post('/api/sales/important-recordings', { client_id: client.id, recording_url: 'https://r/2' })).body.data.id;
    store.note = (await as(o.cst.token).post('/api/cst/notes', { client_id: client.id, note_text: 'n' })).body.data.id;
    store.schedule = (await as(o.cst.token).post('/api/cst/schedules', { title: 's', start_time: '2026-12-01T10:00:00Z', end_time: '2026-12-01T11:00:00Z' })).body.data.id;
    store.concern = (await as(o.sales.token).post('/api/concerns', { concern_type: 'billing', description: 'd' })).body.data.id;
    store.internal = (await as(o.cst.token).post('/api/concerns/internal', { concern_type: 'tools', description: 'd' })).body.data.id;
    store.template = (await as(o.cst_manager.token).post('/api/templates', { title: 't', content: 'c', type: 'email' })).body.data.id;
    store.board = (await as(o.cst_manager.token).post('/api/boards', { title: 'b', board_state: {} })).body.data.id;
    store.event = (await as(o.admin).post('/api/events', { title: 'e', date: '2026-12-05', type: 'meeting' })).body.data.id;
    store.task = (await as(o.admin).post('/api/tasks', { title: 't', assigned_to: o.sales_manager.id, due_date: '2026-12-10', priority: 'high' })).body.data.id;
    store.salesTarget = (await as(o.sales_manager.token).post('/api/sales-manager/targets', { user_id: o.sales.id, target_month: '2026-12-01', target_amount: 1000 })).body.data.id;
    store.cstTarget = (await as(o.cst_manager.token).post('/api/cst-manager/targets', { agent_id: o.cst.id, target_month: '2026-12', target_clients: 3, target_amount: 900 })).body.data.id;
    store.expense = (await as(o.finance.token).post('/api/finance/expenses', { category: 'rent', amount: 100, expense_date: '2026-12-01', status: 'pending' })).body.data.id;
    store.field = (await as(o.admin).post('/api/organization/custom-fields', { field_name: 'Plan', field_type: 'dropdown', options: ['A', 'B'] })).body.data.id;
    store.stage = (await as(o.admin).post('/api/organization/pipeline-stages', { stage_name: 'New' })).body.data.id;
    store.request = (await as(o.cst.token).post('/api/cst/deactivation-requests', { client_id: client.id, reason: 'r' })).body.data.id;
    for (const [k, v] of Object.entries(store)) expect(v, `seed ${k}`).toBeTruthy();
};

beforeAll(async () => {
    org = await setupOrg();
    other = await setupOrg();
    await seed(org, ids);
    await seed(other, otherIds);
    const email = `${unique('sweep')}@aicre.example`;
    await pool.query('INSERT INTO platform_admins (name, email, password_hash) VALUES ($1, $2, $3)', ['Sweep', email, await bcrypt.hash('PlatformPass1!', 10)]);
    platform = (await http().post('/api/platform/auth/login').send({ email, password: 'PlatformPass1!' })).body.token;
}, 120000);

describe('part 1: every route succeeds for a user allowed to use it', () => {
    it('covers every route in the route files', () => {
        expect(ROUTES.length).toBeGreaterThanOrEqual(146);
    });

    // [method, url, actor, body]; actor is a key of org, 'platform' or 'anon'. Run in order.
    const STEPS = () => {
        const c = ids.client;
        return [
            // Auth and onboarding
            ['get', '/api/auth/me', 'sales'],
            ['get', `/api/auth/organization/${org.slug}`, 'anon'],
            ['post', '/api/auth/login', 'anon', { email: org.sales.email, password: EMPLOYEE_PASSWORD }],
            ['post', '/api/platform/auth/login', 'anon', null], // filled in the platform block below
            ['get', '/api/platform/summary', 'platform'],
            ['get', '/api/platform/organizations?search=a&status=all', 'platform'],
            ['get', `/api/platform/organizations/${org.orgId}`, 'platform'],
            // Registration and the onboarding wizard on a brand new organization
            ['post', '/api/onboarding/organization', 'anon', () => ({
                organization: { name: 'Wizard Co' }, admin: { first_name: 'W', last_name: 'Z', email: `${unique('wiz')}@example.com`, password: 'WizardPass1!' },
            })],
            ['get', '/api/onboarding/state', 'fresh'],
            ['put', '/api/onboarding/portals', 'fresh', { portals: [{ key: 'finance', enabled: false }], tier_labels: { Member: 'Agent' } }],
            ['put', '/api/onboarding/labels', 'fresh', { portals: [{ key: 'sales', custom_label: 'Revenue' }] }],
            ['post', '/api/onboarding/employees', 'fresh', () => ({ employees: [{ first_name: 'E', last_name: 'One', email: `${unique('e1')}@example.com`, portal_key: 'sales' }] })],
            ['post', '/api/onboarding/employees/skip', 'fresh'],
            ['post', '/api/onboarding/complete', 'fresh'],
            // Organization settings
            ['get', '/api/organization', 'admin'],
            ['put', '/api/organization', 'admin', { name: 'Sweep Org', industry: 'Software', size: '11-50' }],
            ['put', '/api/organization/portals', 'admin', { portals: [{ key: 'finance', enabled: true }] }],
            ['put', '/api/organization/labels', 'admin', { portals: [{ key: 'sales', custom_label: 'Revenue', tier_labels: { Member: 'Rep' } }] }],
            ['get', '/api/organization/permissions', 'admin'],
            ['put', '/api/organization/permissions', 'admin', { permissions: [{ portalKey: 'cst', tier: 'Member', fields: { 'client.financial': true } }] }],
            ['get', '/api/organization/client-fields', 'admin'],
            ['put', '/api/organization/client-fields/cin', 'admin', { label: 'Tax ID' }],
            ['put', '/api/organization/client-fields/order', 'admin', { keys: ['digital_presence'] }],
            ['get', '/api/organization/custom-fields', 'admin'],
            ['put', '/api/organization/custom-fields/order', 'admin', { ids: [ids.field] }],
            ['post', '/api/organization/custom-fields', 'admin', { field_name: 'Seats', field_type: 'number' }],
            ['put', `/api/organization/custom-fields/${ids.field}`, 'admin', { options: ['A', 'B', 'C'] }],
            ['get', '/api/organization/pipeline-stages', 'admin'],
            ['put', '/api/organization/pipeline-stages/order', 'admin', { ids: [ids.stage] }],
            ['post', '/api/organization/pipeline-stages', 'admin', { stage_name: 'Won' }],
            ['put', `/api/organization/pipeline-stages/${ids.stage}`, 'admin', { stage_name: 'New Lead' }],
            // Users
            ['get', '/api/users', 'admin'],
            ['get', '/api/users/roles', 'admin'],
            ['get', '/api/users/departments', 'admin'],
            ['get', '/api/users/performance', 'admin'],
            ['get', `/api/users/${org.sales.id}`, 'admin'],
            ['post', '/api/users', 'admin', () => ({ first_name: 'New', last_name: 'Hire', email: `${unique('nh')}@example.com`, role_id: org.roles.sales })],
            ['post', '/api/users/import', 'admin', () => ({ employees: [{ first_name: 'Csv', last_name: 'Hire', email: `${unique('csv')}@example.com`, portal_key: 'cst' }] })],
            ['put', `/api/users/${org.sales.id}`, 'admin', { first_name: 'sales', last_name: 'Tester', email: org.sales.email, role_id: org.roles.sales, base_salary: 40000 }],
            ['patch', `/api/users/${org.spare}/status`, 'admin', { status: 'inactive' }],
            ['delete', `/api/users/${org.spare}`, 'admin'],
            // Clients
            ['get', '/api/clients', 'cst_manager'],
            ['get', '/api/clients/custom-fields', 'sales'],
            ['get', '/api/clients/fields', 'sales'],
            ['get', '/api/clients/pipeline-stages', 'cst'],
            ['get', '/api/clients/deactivation-requests', 'cst_manager'],
            ['post', '/api/clients', 'sales_manager', clientBody('Fresh Co', { customFields: { Plan: 'A' } })],
            ['post', '/api/clients/import', 'sales_manager', { clients: [clientBody('Imported Co')] }],
            ['put', `/api/clients/${c}`, 'sales_manager', { notes: 'updated' }],
            ['patch', `/api/clients/${c}/status`, 'cst', { status: 'flagged', flag_type: 'red-flag' }],
            ['patch', `/api/clients/${c}/stage`, 'cst', { stage_id: ids.stage }],
            ['patch', `/api/clients/${c}/unassign`, 'cst_manager'],
            ['patch', `/api/clients/${c}/assign`, 'cst_manager', { agentId: org.cst.id }],
            // CST
            ['get', '/api/cst/active-clients', 'cst'],
            ['post', '/api/cst/flags', 'cst', () => ({ client_id: c, tag_id: org.tag })],
            ['get', '/api/cst/schedules', 'cst'],
            ['post', '/api/cst/schedules', 'cst', { title: 'call', start_time: '2026-12-02T10:00:00Z', end_time: '2026-12-02T11:00:00Z' }],
            ['put', `/api/cst/schedules/${ids.schedule}`, 'cst', { title: 'moved' }],
            ['get', `/api/cst/notes/${c}`, 'cst'],
            ['post', '/api/cst/notes', 'cst', { client_id: c, note_text: 'second' }],
            ['put', `/api/cst/notes/${ids.note}`, 'cst', { note_text: 'edited' }],
            ['post', '/api/cst/deactivation-requests', 'cst', { client_id: c, reason: 'again' }],
            // CST manager
            ['get', '/api/cst-manager/unassigned-clients', 'cst_manager'],
            ['patch', `/api/cst-manager/clients/${c}/unassign-cst`, 'cst_manager'],
            ['patch', `/api/cst-manager/clients/${c}/assign-cst`, 'cst_manager', { cst_agent_id: org.cst.id }],
            ['get', '/api/cst-manager/targets', 'cst_manager'],
            ['post', '/api/cst-manager/targets', 'cst_manager', { agent_id: org.cst.id, target_month: '2027-01', target_clients: 2, target_amount: 500 }],
            ['put', `/api/cst-manager/targets/${ids.cstTarget}`, 'cst_manager', { target_amount: 950, target_clients: 4 }],
            ['patch', `/api/cst-manager/targets/${ids.cstTarget}/achieved`, 'cst', { achieved: 300 }],
            ['patch', `/api/cst-manager/targets/${ids.cstTarget}/achieved-clients`, 'cst', { achieved: 1 }],
            ['get', '/api/cst-manager/strategies', 'cst_manager'],
            ['post', '/api/cst-manager/strategies', 'cst_manager', { client_id: c, strategy_text: 'grow' }],
            ['get', '/api/cst-manager/agent-performance', 'cst_manager'],
            ['patch', `/api/cst-manager/deactivation-requests/${ids.request}/resolve`, 'cst_manager', { status: 'rejected' }],
            ['post', '/api/cst-manager/deactivation-requests/resolve-bulk', 'cst_manager', () => ({ ids: [org.pendingRequest], decision: 'rejected' })],
            ['delete', `/api/cst-manager/strategies/${c}`, 'cst_manager'],
            ['delete', `/api/cst-manager/targets/${ids.cstTarget}`, 'cst_manager'],
            // Sales
            ['get', '/api/sales/follow-ups', 'sales'],
            ['post', '/api/sales/follow-ups', 'sales', { client_id: c, due_date: '2026-12-09' }],
            ['put', `/api/sales/follow-ups/${ids.followUp}`, 'sales', { status: 'contacted' }],
            ['get', '/api/sales/recordings', 'sales'],
            ['post', '/api/sales/recordings', 'sales', { client_id: c, recording_url: 'https://r/3' }],
            ['put', `/api/sales/recordings/${ids.recording}`, 'sales', { outcome: 'won' }],
            ['get', '/api/sales/important-recordings', 'sales'],
            ['post', '/api/sales/important-recordings', 'sales', { recording_url: 'https://r/4' }],
            ['put', `/api/sales/important-recordings/${ids.important}`, 'sales', { outcome: 'won' }],
            ['get', '/api/sales/monthly-review', 'sales'],
            ['patch', `/api/sales/targets/${ids.salesTarget}/achieved`, 'sales', { achieved_amount: 200 }],
            // Sales manager
            ['get', '/api/sales-manager/targets', 'sales_manager'],
            ['post', '/api/sales-manager/targets', 'sales_manager', { user_id: org.sales.id, target_month: '2027-01-01', target_amount: 800 }],
            ['put', `/api/sales-manager/targets/${ids.salesTarget}`, 'sales_manager', { target_amount: 1200 }],
            ['patch', `/api/sales-manager/targets/${ids.salesTarget}/achieved`, 'sales_manager', { achieved: 400 }],
            ['get', '/api/sales-manager/agent-performance', 'sales_manager'],
            ['delete', `/api/sales-manager/targets/${ids.salesTarget}`, 'sales_manager'],
            // Finance
            ['get', '/api/finance/employees', 'finance'],
            ['patch', `/api/finance/salary/${org.sales.id}`, 'finance', { base_salary: 40000, advance_payments: 500, accrued_payments: 1000, payment_status: 'pending' }],
            ['get', `/api/finance/salary-slip/${org.sales.id}`, 'finance'],
            ['post', '/api/finance/payroll/run', 'finance', { month: '2026-12' }],
            ['get', '/api/finance/salary-slips?month=2026-12', 'finance'],
            ['get', '/api/finance/expenses', 'finance'],
            ['post', '/api/finance/expenses', 'finance', { category: 'travel', amount: 50, expense_date: '2026-12-02', status: 'paid' }],
            ['put', `/api/finance/expenses/${ids.expense}`, 'finance', { category: 'rent', amount: 120, expense_date: '2026-12-01', status: 'paid' }],
            // Tasks, events, attendance, admin, notepad, concerns, templates, boards
            ['get', '/api/tasks', 'sales_manager'],
            ['post', '/api/tasks', 'admin', { title: 'second', assigned_to: org.sales_manager.id, due_date: '2026-12-11' }],
            ['put', `/api/tasks/${ids.task}`, 'admin', { title: 'renamed' }],
            ['patch', `/api/tasks/${ids.task}/status`, 'sales_manager', { status: 'in-progress' }],
            ['post', `/api/tasks/${ids.task}/submit`, 'sales_manager', { submission_notes: 'done' }],
            ['get', '/api/events', 'sales'],
            ['post', '/api/events', 'admin', { title: 'party', date: '2026-12-20', type: 'celebration' }],
            ['put', `/api/events/${ids.event}`, 'admin', { title: 'meeting moved', date: '2026-12-06', type: 'meeting' }],
            ['post', '/api/attendance/clock-in', 'cst'],
            ['get', '/api/attendance/status', 'cst'],
            ['post', '/api/attendance/break-in', 'cst'],
            ['post', '/api/attendance/break-out', 'cst'],
            ['post', '/api/attendance/clock-out', 'cst'],
            ['get', '/api/attendance/history', 'cst'],
            ['get', '/api/attendance/all', 'admin'],
            ['get', '/api/attendance/performance-grid', 'admin'],
            ['get', '/api/admin/performance-stats', 'admin'],
            ['get', '/api/admin/company-metrics', 'admin'],
            ['get', '/api/admin/task-details', 'admin'],
            ['get', '/api/notepads', 'sales'],
            ['post', '/api/notepads', 'sales', { content: 'remember' }],
            ['get', '/api/concerns', 'sales'],
            ['post', '/api/concerns', 'sales', { concern_type: 'tools', description: 'slow' }],
            ['put', `/api/concerns/${ids.concern}`, 'admin', { status: 'resolved' }],
            ['get', '/api/concerns/internal', 'cst'],
            ['post', '/api/concerns/internal', 'cst', { concern_type: 'process', description: 'x' }],
            ['put', `/api/concerns/internal/${ids.internal}`, 'cst', { description: 'edited' }],
            ['get', '/api/templates', 'cst'],
            ['post', '/api/templates', 'cst_manager', { title: 'welcome', content: 'hi', type: 'email' }],
            ['put', `/api/templates/${ids.template}`, 'cst_manager', { title: 'welcome 2', content: 'hello', type: 'email' }],
            ['get', '/api/boards', 'cst_manager'],
            ['get', '/api/boards/list', 'cst_manager'],
            ['post', '/api/boards', 'cst_manager', { id: ids.board, title: 'saved', board_state: { shapes: [] } }],
            // Deletes and destructive steps last
            ['delete', `/api/sales/follow-ups/${ids.followUp}`, 'sales'],
            ['delete', `/api/sales/recordings/${ids.recording}`, 'sales'],
            ['delete', `/api/sales/important-recordings/${ids.important}`, 'sales'],
            ['delete', `/api/cst/notes/${ids.note}`, 'cst'],
            ['delete', `/api/cst/schedules/${ids.schedule}`, 'cst'],
            ['delete', `/api/concerns/${ids.concern}`, 'admin'],
            ['delete', `/api/concerns/internal/${ids.internal}`, 'cst'],
            ['delete', `/api/templates/${ids.template}`, 'cst_manager'],
            ['delete', `/api/boards/${ids.board}`, 'cst_manager'],
            ['delete', `/api/events/${ids.event}`, 'admin'],
            ['delete', `/api/tasks/${ids.task}`, 'admin'],
            ['delete', `/api/finance/expenses/${ids.expense}`, 'finance'],
            ['delete', '/api/notepads', 'sales'],
            ['patch', `/api/clients/${c}/discard`, 'cst_manager', { reason: 'test over' }],
            ['post', '/api/auth/change-password', 'finance', { currentPassword: EMPLOYEE_PASSWORD, newPassword: 'FinanceNew123!' }],
        ];
    };

    beforeAll(async () => {
        const me = (await as(org.admin).get('/api/auth/me')).body.data;
        org.slug = me.organization.slug;
        org.orgId = me.organization.id;
        org.roles = Object.fromEntries((await as(org.admin).get('/api/users/roles')).body.data.map((r) => [r.name, r.id]));
        org.fresh = (await signupOrg(unique('Fresh '))).token;
        org.spare = (await as(org.admin).post('/api/users', { first_name: 'Spare', last_name: 'User', email: `${unique('spare')}@example.com`, role_id: org.roles.sales })).body.data.id;
        org.tag = (await pool.query("INSERT INTO tags (tenant_id, name) VALUES ((SELECT tenant_id FROM users WHERE id = $1), 'VIP') RETURNING id", [org.sales.id])).rows[0].id;
        const extra = (await as(org.sales_manager.token).post('/api/clients', clientBody('Bulk Co', { sales_agent_id: org.sales.id }))).body.data;
        await as(org.cst_manager.token).patch(`/api/clients/${extra.id}/assign`, { agentId: org.cst.id });
        org.pendingRequest = (await as(org.cst.token).post('/api/cst/deactivation-requests', { client_id: extra.id, reason: 'bulk' })).body.data.id;
    });

    it('runs every step successfully', async () => {
        const failures = [];
        const called = [];
        for (const [method, url, actor, rawBody, expected] of STEPS()) {
            const body = typeof rawBody === 'function' ? rawBody() : rawBody;
            if (url === '/api/platform/auth/login') continue; // covered in beforeAll and platform.test.js
            const token = actor === 'anon' ? null : actor === 'platform' ? platform : actor === 'fresh' ? org.fresh
                : (actor === 'admin' ? org.admin : org[actor].token);
            const res = await send(token, method, url, body);
            const good = expected ? res.status === expected : ok(res);
            if (!good) failures.push(`${method.toUpperCase()} ${url} as ${actor}: ${show(res)}`);
            called.push([method, url.replace(/\?.*$/, '')]);
        }
        expect(failures).toEqual([]);

        // Every route in the route files was called at least once
        const missed = ROUTES.filter((r) => r.path !== '/api/platform/auth/login' && !called.some(([m, u]) =>
            m === r.method && new RegExp(`^${r.path.replace(/:[a-zA-Z_]+/g, '[^/]+')}$`).test(u)));
        expect(missed.map((r) => `${r.method.toUpperCase()} ${r.path}`)).toEqual([]);
    }, 120000);
});

describe('part 2: no route ever answers 5xx', () => {
    const JUNK = {
        id: 'abc', status: 'nope', client_id: 'abc', user_id: 'abc', agent_id: -1, agentId: 'x', cst_agent_id: 1.5,
        due_date: 'not-a-date', date: 'x', start_time: 'x', end_time: 'x', target_month: 'x', month: 'x', amount: 'abc',
        stage_id: 'x', ids: ['x'], decision: 'maybe', employees: 'x', clients: 'x', portals: 'x', permissions: 'x',
        email: 12, password: ['x'], companyName: { a: 1 }, title: 'x'.repeat(5000), achieved: 'lots', board_state: 'x',
        base_salary: 'abc', field_name: null, field_type: 'x', options: 'x', stage_name: '', tier_labels: 'x',
    };
    // Path params: non-numeric, out of range, missing, another organization's real record,
    // and (except for deletes) the caller's own records with partial and junk bodies
    const idFor = (store, o) => (p) => {
        const map = [
            ['/clients', store.client], ['/cst/notes', store.note], ['/cst/schedules', store.schedule],
            ['/sales/follow-ups', store.followUp], ['/sales/recordings', store.recording], ['/sales/important-recordings', store.important],
            ['/concerns/internal', store.internal], ['/concerns', store.concern], ['/templates', store.template], ['/boards', store.board],
            ['/events', store.event], ['/tasks', store.task], ['/sales-manager/targets', store.salesTarget], ['/sales/targets', store.salesTarget],
            ['/cst-manager/targets', store.cstTarget], ['/cst-manager/deactivation-requests', store.request], ['/cst-manager/clients', store.client],
            ['/cst-manager/strategies', store.client], ['/finance/expenses', store.expense], ['/finance/salary', o.sales.id],
            ['/users', o.sales.id], ['/organization/custom-fields', store.field], ['/organization/pipeline-stages', store.stage],
            ['/platform/organizations', 1], ['/auth/organization', 'no-such-org'],
        ];
        return map.find(([prefix]) => p.includes(prefix))?.[1] ?? 1;
    };

    it.each(ROUTES.map((r) => [r.method.toUpperCase(), r.path, r]))('%s %s', async (_m, _p, route) => {
        const callers = { admin: org.admin, sales: org.sales.token, sales_manager: org.sales_manager.token, cst: org.cst.token,
            cst_manager: org.cst_manager.token, finance: org.finance.token, platform, anon: null };
        const own = idFor(ids, org)(route.path);
        const params = !route.path.includes(':') ? [null]
            : ['abc', '999999999', '-1', String(idFor(otherIds, other)(route.path)), ...(route.method === 'delete' ? [] : [String(own)])];
        const bodies = [{}, JUNK, [], { title: 'only a title' }, { status: 'pending' }];
        const crashes = [];
        for (const [who, token] of Object.entries(callers)) {
            for (const param of params) {
                const url = param == null ? route.path : route.path.replace(/:[a-zA-Z_]+/g, param);
                const query = route.method === 'get' ? '?month=x&assigned_to=abc&search=%25&status=x&id=abc&is_internal=maybe' : '';
                for (const body of route.method === 'get' || route.method === 'delete' ? [undefined] : bodies) {
                    const res = await send(token, route.method, url + query, body);
                    if (res.status >= 500) crashes.push(`${who} ${url} ${JSON.stringify(body)?.slice(0, 60)}: ${show(res)}`);
                }
            }
        }
        expect(crashes).toEqual([]);
    }, 120000);

    it("other organizations' records are untouched by all of the above", async () => {
        const clients = (await as(other.cst_manager.token).get('/api/clients')).body.data;
        expect(clients.find((c) => c.id === otherIds.client)).toMatchObject({ company_name: 'Sweep Co', status: 'active' });
        expect((await as(other.sales.token).get('/api/sales/follow-ups')).body.data.map((f) => f.id)).toContain(otherIds.followUp);
        expect((await as(other.finance.token).get('/api/finance/expenses')).body.data.map((e) => e.id)).toContain(otherIds.expense);
        expect((await as(other.admin).get('/api/organization/custom-fields')).body.data[0].field_name).toBe('Plan');
    });
});
