import { describe, it, expect, beforeAll } from 'vitest';
import pool from '../config/db.js';
import { as, addActiveEmployees, setupOrg, signupOrg } from './helpers.js';

// Policy chokepoint: catalog ceiling + per-org restriction dials.
let org;
let other;
let clientId;

const tierEntry = (data, portalKey, tier) =>
    data.find((p) => p.key === portalKey).tiers.find((t) => t.tier === tier);

beforeAll(async () => {
    const { token: admin } = await signupOrg();
    org = { admin, ...await addActiveEmployees(admin, [
        'sales', 'sales_manager', 'cst', 'cst_manager', 'finance',
        { key: 'cstLead', portal_key: 'cst', tier: 'Manager' },
    ]) };
    await as(admin).post('/api/onboarding/complete');
    other = await setupOrg();
    const res = await as(org.sales_manager.token).post('/api/clients', {
        companyName: 'Policy Co', customerName: 'Pat', email: 'pat@policy.co', contactNo1: '123',
        paymentAmount: 500, sales_agent_id: org.sales.id,
    });
    clientId = res.body.data.id;
    await as(org.cst_manager.token).patch(`/api/clients/${clientId}/assign`, { agentId: org.cst.id });
});

describe('catalog guards', () => {
    it('only admins can read everyone\'s attendance', async () => {
        expect((await as(org.sales.token).get('/api/attendance/all')).status).toBe(403);
        expect((await as(org.admin).get('/api/attendance/all')).status).toBe(200);
    });

    it('session lists the actions the user may perform', async () => {
        const me = await as(org.cst_manager.token).get('/api/auth/me');
        expect(me.body.data.allowedActions).toContain('client.discard');
        expect(me.body.data.allowedActions).not.toContain('payroll.manage');
    });

    it('a user in a disabled portal is rejected', async () => {
        const { rows } = await pool.query(
            `SELECT op.id FROM organization_portals op JOIN user_portal_access upa ON upa.organization_portal_id = op.id
             WHERE upa.user_id = $1`, [org.finance.id]);
        await pool.query('UPDATE organization_portals SET enabled = false WHERE id = $1', [rows[0].id]);
        try {
            const res = await as(org.finance.token).get('/api/finance/expenses');
            expect(res.status).toBe(403);
            expect(res.body.code).toBe('PORTAL_DISABLED');
            expect((await as(org.finance.token).get('/api/auth/me')).status).toBe(200);
        } finally {
            await pool.query('UPDATE organization_portals SET enabled = true WHERE id = $1', [rows[0].id]);
        }
    });
});

describe('permission settings', () => {
    it('lists the fixed catalog per portal and tier, marking entries above the ceiling as not eligible', async () => {
        const res = await as(org.admin).get('/api/organization/permissions');
        expect(res.status).toBe(200);
        expect(res.body.data.map((p) => p.key)).not.toContain('admin');
        const cstMember = tierEntry(res.body.data, 'cst', 'Member');
        const action = (key) => cstMember.actions.find((a) => a.key === key);
        const field = (key) => cstMember.fields.find((f) => f.key === key);

        // The five field groups and the mockup's action labels (Figure 4.6)
        expect(cstMember.fields.map((f) => f.label)).toEqual([
            'Client contact details', 'Payment details', 'Salary and payroll', 'Call recordings and transcripts', 'Internal notes',
        ]);
        for (const [key, label] of [['note.add', 'Add client note'], ['client.flag', 'Flag client'], ['deactivation.request', 'Request deactivation'],
            ['deactivation.resolve', 'Approve deactivation'], ['client.assign', 'Reassign client'], ['client.move_stage', 'Move client stage']]) {
            expect(action(key).label).toBe(label);
        }
        expect(action('client.set_status')).toMatchObject({ eligible: true, allowed: true });
        expect(action('note.add')).toMatchObject({ eligible: true, allowed: true });
        expect(action('client.discard')).toMatchObject({ eligible: false, allowed: false });
        expect(field('user.compensation')).toMatchObject({ eligible: false, visible: false });
        // Sales-only actions are not part of the CST list at all
        expect(action('sales_target.manage')).toBeUndefined();

        const salesManager = tierEntry(res.body.data, 'sales_manager', 'Manager');
        expect(salesManager.actions.find((a) => a.key === 'client.import')).toMatchObject({ label: 'Import clients', eligible: true });
        expect(tierEntry(res.body.data, 'finance', 'Member').actions.find((a) => a.key === 'payroll.manage').label).toBe('Run payroll');
    });

    it('note, flag and deactivation request actions guard their routes', async () => {
        const set = (actions) => as(org.admin).put('/api/organization/permissions', { permissions: [{ portalKey: 'cst', tier: 'Member', actions }] });
        await set({ 'note.add': false, 'client.flag': false, 'deactivation.request': false });

        expect((await as(org.cst.token).post('/api/cst/notes', { client_id: clientId, note_text: 'x' })).status).toBe(403);
        expect((await as(org.cst.token).post('/api/cst/flags', { client_id: clientId, flag_type: 'red' })).status).toBe(403);
        expect((await as(org.cst.token).patch(`/api/clients/${clientId}/status`, { status: 'flagged', flag_type: 'red' })).status).toBe(403);
        expect((await as(org.cst.token).post('/api/cst/deactivation-requests', { client_id: clientId, reason: 'x' })).status).toBe(403);
        // Same portal, Manager tier: unaffected
        expect((await as(org.cstLead.token).post('/api/cst/notes', { client_id: clientId, note_text: 'lead note' })).status).toBe(201);

        await set({ 'note.add': true, 'client.flag': true, 'deactivation.request': true });
        expect((await as(org.cst.token).post('/api/cst/notes', { client_id: clientId, note_text: 'back' })).status).toBe(201);
    });

    it('only the org admin can read or change permissions', async () => {
        expect((await as(org.cst_manager.token).get('/api/organization/permissions')).status).toBe(403);
        expect((await as(org.cst_manager.token).put('/api/organization/permissions', {
            permissions: [{ portalKey: 'cst_manager', tier: 'Manager', actions: { 'client.discard': true } }],
        })).status).toBe(403);
    });

    it('denying an action blocks it; re-allowing restores it', async () => {
        const deny = await as(org.admin).put('/api/organization/permissions', {
            permissions: [{ portalKey: 'cst_manager', tier: 'Manager', actions: { 'client.discard': false } }],
        });
        expect(deny.status).toBe(200);
        expect(tierEntry(deny.body.data, 'cst_manager', 'Manager').actions.find((a) => a.key === 'client.discard').allowed).toBe(false);

        const blocked = await as(org.cst_manager.token).patch(`/api/clients/${clientId}/discard`, { reason: 'x' });
        expect(blocked.status).toBe(403);
        expect((await as(org.cst_manager.token).get('/api/auth/me')).body.data.allowedActions).not.toContain('client.discard');
        // Admin tier is never restricted
        expect((await as(org.admin).get('/api/auth/me')).body.data.allowedActions).toContain('client.discard');

        await as(org.admin).put('/api/organization/permissions', {
            permissions: [{ portalKey: 'cst_manager', tier: 'Manager', actions: { 'client.discard': true } }],
        });
        const ok = await as(org.cst_manager.token).patch(`/api/clients/${clientId}/discard`, { reason: 'x' });
        expect(ok.status).toBe(200);
    });

    it('an override cannot grant beyond the catalog ceiling', async () => {
        const res = await as(org.admin).put('/api/organization/permissions', {
            permissions: [{ portalKey: 'cst', tier: 'Member', actions: { 'client.discard': true } }],
        });
        expect(res.status).toBe(400);
        expect((await as(org.cst.token).patch(`/api/clients/${clientId}/discard`, { reason: 'x' })).status).toBe(403);
    });

    it('rejects unknown actions, field groups, portals and fixed tiers', async () => {
        const put = (entry) => as(org.admin).put('/api/organization/permissions', { permissions: [entry] });
        expect((await put({ portalKey: 'cst', tier: 'Member', actions: { 'client.nuke': false } })).status).toBe(400);
        expect((await put({ portalKey: 'cst', tier: 'Member', fields: { 'client.secret': false } })).status).toBe(400);
        expect((await put({ portalKey: 'cst', tier: 'Member', fields: { 'user.compensation': true } })).status).toBe(400);
        expect((await put({ portalKey: 'admin', tier: 'Manager', actions: { 'user.manage': false } })).status).toBe(400);
        expect((await put({ portalKey: 'cst', tier: 'Admin', actions: {} })).status).toBe(400);
    });

    it('settings are per organization', async () => {
        await as(other.admin).put('/api/organization/permissions', {
            permissions: [{ portalKey: 'cst_manager', tier: 'Manager', actions: { 'client.assign': false } }],
        });
        const res = await as(org.cst_manager.token).patch(`/api/clients/${clientId}/assign`, { agentId: org.cst.id });
        expect(res.status).toBe(200);
        await as(other.admin).put('/api/organization/permissions', {
            permissions: [{ portalKey: 'cst_manager', tier: 'Manager', actions: { 'client.assign': true } }],
        });
    });
});

describe('field visibility', () => {
    it('hidden field groups are stripped for that portal and tier only', async () => {
        const hide = await as(org.admin).put('/api/organization/permissions', {
            permissions: [{ portalKey: 'cst', tier: 'Member', fields: { 'client.contact': false, 'client.financial': false } }],
        });
        expect(hide.status).toBe(200);

        const member = (await as(org.cst.token).get('/api/clients')).body.data.find((c) => c.id === clientId);
        expect(member.company_name).toBe('Policy Co');
        expect(member).not.toHaveProperty('email');
        expect(member).not.toHaveProperty('contact_no_1');
        expect(member).not.toHaveProperty('payment_amount');

        const active = (await as(org.cst.token).get('/api/cst/active-clients')).body.data;
        expect(active.every((c) => !('email' in c) && !('payment_amount' in c))).toBe(true);

        // Same portal, Manager tier: unaffected
        const lead = (await as(org.cstLead.token).get('/api/clients')).body.data.find((c) => c.id === clientId);
        expect(lead.email).toBe('pat@policy.co');
        // Admin always sees everything
        const admin = (await as(org.admin).get('/api/clients')).body.data.find((c) => c.id === clientId);
        expect(admin.payment_amount).toBeTruthy();
    });

    it('internal notes and call transcripts are field groups too', async () => {
        await as(org.admin).put('/api/organization/permissions', {
            permissions: [{ portalKey: 'sales', tier: 'Member', fields: { 'call.transcript': false, 'client.internal_notes': false } }],
        });
        const upload = await as(org.sales.token).post('/api/sales/recordings', {
            client_id: clientId, recording_url: 'https://rec.example/1', transcript: 'secret words',
        });
        expect(upload.status).toBe(201);
        expect(upload.body.data).not.toHaveProperty('transcript');
        expect(upload.body.data).not.toHaveProperty('recording_url');
        const list = (await as(org.sales.token).get('/api/sales/recordings')).body.data;
        expect(list.every((r) => !('transcript' in r))).toBe(true);
        const client = (await as(org.sales.token).get('/api/clients')).body.data.find((c) => c.id === clientId);
        expect(client).not.toHaveProperty('notes');

        // The manager of the same team still sees them
        const managerView = (await as(org.sales_manager.token).get('/api/sales/recordings')).body.data;
        expect(managerView.find((r) => r.id === upload.body.data.id).transcript).toBe('secret words');
    });

    it('write responses are filtered too', async () => {
        const res = await as(org.cst.token).patch(`/api/clients/${clientId}/status`, { status: 'flagged', flag_type: 'red' });
        expect(res.status).toBe(200);
        expect(res.body.data).not.toHaveProperty('email');
    });
});
