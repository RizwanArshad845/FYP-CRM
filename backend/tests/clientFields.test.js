import { describe, it, expect, beforeAll } from 'vitest';
import { as, clientBody, setupOrg } from './helpers.js';

// The organization's client layout (plan 6.1): every standard and custom field,
// renamed, reordered, required or switched off per organization.
describe('client field layout', () => {
    let org;
    let other;
    const fieldsOf = async (who = org.sales_manager.token) => (await as(who).get('/api/clients/fields')).body.data;
    const field = (list, key) => list.find((f) => f.key === key);
    const clientById = async (id) => (await as(org.admin).get('/api/clients')).body.data.find((c) => c.id === id);

    beforeAll(async () => {
        org = await setupOrg();
        other = await setupOrg();
    });

    it('lists every standard field with its defaults, plus the system fields for admins', async () => {
        const list = await fieldsOf();
        expect(list.map((f) => f.key)).toEqual(expect.arrayContaining([
            'company_name', 'customer_name', 'email', 'contact_no_1', 'payment_amount', 'product_sold',
            'service_area', 'client_services', 'cin', 'payment_gateway', 'email_2', 'contact_no_2',
            'digital_presence', 'client_concerns', 'tips_for_tech', 'notes',
        ]));
        expect(field(list, 'company_name')).toMatchObject({ kind: 'core', required: true, hidden: false, label: 'Company name' });
        expect(field(list, 'email')).toMatchObject({ kind: 'core', required: true });
        expect(field(list, 'cin')).toMatchObject({ kind: 'standard', required: false });
        expect(field(list, 'payment_gateway').options).toContain('Stripe');

        const admin = (await as(org.admin).get('/api/organization/client-fields')).body.data;
        expect(admin.system.map((f) => f.key)).toEqual(['status', 'sales_agent_id', 'cst_agent_id', 'stage_id', 'created_at']);
    });

    it('renames any field by label only; an empty label goes back to the default', async () => {
        await as(org.admin).put('/api/organization/client-fields/company_name', { label: 'Business name' });
        await as(org.admin).put('/api/organization/client-fields/cin', { label: 'Tax ID' });
        let list = await fieldsOf();
        expect(field(list, 'company_name')).toMatchObject({ label: 'Business name', default_label: 'Company name' });
        expect(field(list, 'cin').label).toBe('Tax ID');
        // other organizations keep their own labels
        expect(field(await fieldsOf(other.sales_manager.token), 'cin').label).toBe('CIN');

        await as(org.admin).put('/api/organization/client-fields/company_name', { label: '' });
        list = await fieldsOf();
        expect(field(list, 'company_name').label).toBe('Company name');
        expect(field(list, 'cin').label).toBe('Tax ID');
    });

    it('never switches off a core field or makes company name optional', async () => {
        expect((await as(org.admin).put('/api/organization/client-fields/email', { hidden: true })).status).toBe(400);
        expect((await as(org.admin).put('/api/organization/client-fields/company_name', { required: false })).status).toBe(400);
        expect((await as(org.admin).put('/api/organization/client-fields/cin', { options: ['A'] })).status).toBe(400);
        expect((await as(org.admin).put('/api/organization/client-fields/not_a_field', { label: 'x' })).status).toBe(404);
    });

    it('a switched-off field keeps its data, ignores new values and comes back when switched on', async () => {
        const created = (await as(org.sales_manager.token).post('/api/clients', clientBody('Keep Co', { cin: 'C-1' }))).body.data;
        expect((await as(org.admin).put('/api/organization/client-fields/cin', { hidden: true })).status).toBe(200);
        expect(field(await fieldsOf(), 'cin').hidden).toBe(true);

        await as(org.cst_manager.token).put(`/api/clients/${created.id}`, { cin: 'C-2', companyName: 'Keep Co 2' });
        let stored = await clientById(created.id);
        expect(stored).toMatchObject({ cin: 'C-1', company_name: 'Keep Co 2' });

        const fresh = (await as(org.sales_manager.token).post('/api/clients', clientBody('Fresh Co', { cin: 'C-9' }))).body.data;
        expect(fresh.cin).toBeNull();

        await as(org.admin).put('/api/organization/client-fields/cin', { hidden: false });
        stored = await clientById(created.id);
        expect(stored.cin).toBe('C-1');
    });

    it('enforces required fields on the form and the CSV import; core fields can be made optional', async () => {
        await as(org.admin).put('/api/organization/client-fields/service_area', { required: true });
        const missing = await as(org.sales_manager.token).post('/api/clients', clientBody('No Area Co'));
        expect(missing.status).toBe(400);
        expect(missing.body.error).toMatch(/Service area is required/);
        const imported = await as(org.sales_manager.token).post('/api/clients/import', {
            clients: [clientBody('Area Co', { serviceArea: 'Canada' }), clientBody('No Area Import')],
        });
        expect(imported.body.data.created.map((c) => c.company_name)).toEqual(['Area Co']);
        expect(imported.body.data.rowErrors).toEqual([{ row: 2, error: 'Service area is required' }]);
        // clearing a required field on edit is refused; leaving it out is fine
        const id = imported.body.data.created[0].id;
        expect((await as(org.cst_manager.token).put(`/api/clients/${id}`, { serviceArea: '' })).status).toBe(400);
        expect((await as(org.cst_manager.token).put(`/api/clients/${id}`, { notes: 'ok' })).status).toBe(200);
        await as(org.admin).put('/api/organization/client-fields/service_area', { required: false });

        await as(org.admin).put('/api/organization/client-fields/email', { required: false });
        const noEmail = await as(org.sales_manager.token).post('/api/clients', clientBody('No Email Co', { email: '' }));
        expect(noEmail.status).toBe(201);
    });

    it('custom fields can be required and switched off without losing values', async () => {
        const def = (await as(org.admin).post('/api/organization/custom-fields', { field_name: 'Account code', field_type: 'text', required: true })).body.data;
        expect(def).toMatchObject({ required: true, hidden: false });
        expect((await as(org.sales_manager.token).post('/api/clients', clientBody('No Code Co'))).status).toBe(400);
        const created = (await as(org.sales_manager.token).post('/api/clients', clientBody('Code Co', { customFields: { 'Account code': 'AC-7' } }))).body.data;

        await as(org.admin).put(`/api/organization/custom-fields/${def.id}`, { hidden: true });
        expect(field(await fieldsOf(), `cf_${def.id}`).hidden).toBe(true);
        // editing the client without the switched-off field keeps its value
        await as(org.cst_manager.token).put(`/api/clients/${created.id}`, { customFields: {} });
        expect((await clientById(created.id)).custom_fields).toEqual({ 'Account code': 'AC-7' });
        // and a switched-off required field no longer blocks new clients
        expect((await as(org.sales_manager.token).post('/api/clients', clientBody('After Co'))).status).toBe(201);
    });

    it('orders the fields of one section', async () => {
        const contact = (await fieldsOf()).filter((f) => f.section === 'contact').map((f) => f.key);
        const reversed = [...contact].reverse();
        const res = await as(org.admin).put('/api/organization/client-fields/order', { keys: reversed });
        expect(res.status).toBe(200);
        expect(res.body.data.filter((f) => f.section === 'contact').map((f) => f.key)).toEqual(reversed);
        expect((await as(org.admin).put('/api/organization/client-fields/order', { keys: reversed.slice(1) })).status).toBe(400);
        expect((await as(org.admin).put('/api/organization/client-fields/order', { keys: ['email', 'cin'] })).status).toBe(400);
    });

    it('edits picklist options of standard fields', async () => {
        const res = await as(org.admin).put('/api/organization/client-fields/payment_gateway', { options: ['PayPal', 'Bank transfer'] });
        expect(field(res.body.data, 'payment_gateway').options).toEqual(['PayPal', 'Bank transfer']);
    });

    it('only admins change the layout; only the Sales Manager adds clients', async () => {
        expect((await as(org.sales_manager.token).put('/api/organization/client-fields/cin', { label: 'x' })).status).toBe(403);
        expect((await as(org.sales_manager.token).get('/api/organization/client-fields')).status).toBe(403);
        for (const who of [org.cst_manager.token, org.cst.token, org.sales.token, org.admin]) {
            expect((await as(who).post('/api/clients', clientBody('Not Allowed Co'))).status).toBe(403);
        }
    });
});
