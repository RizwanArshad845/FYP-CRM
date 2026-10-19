import { describe, it, expect, beforeAll } from 'vitest';
import { as, setupOrg } from './helpers.js';

// Custom client fields (plan 6.1) and pipeline stages (plan 6.2)
describe('custom client fields', () => {
    let org;
    let fields;
    beforeAll(async () => {
        org = await setupOrg();
        const defs = [
            { field_name: 'Website', field_type: 'text' },
            { field_name: 'Seats', field_type: 'number' },
            { field_name: 'Plan', field_type: 'dropdown', options: ['Basic', 'Pro'] },
            { field_name: 'Renewal', field_type: 'date' },
            { field_name: 'VIP', field_type: 'checkbox' },
        ];
        fields = [];
        for (const d of defs) {
            const res = await as(org.admin).post('/api/organization/custom-fields', d);
            expect(res.status).toBe(201);
            fields.push(res.body.data);
        }
    });

    it('stores all five types in display order', async () => {
        const res = await as(org.admin).get('/api/organization/custom-fields');
        expect(res.body.data.map((f) => [f.field_name, f.field_type])).toEqual([
            ['Website', 'text'], ['Seats', 'number'], ['Plan', 'dropdown'], ['Renewal', 'date'], ['VIP', 'checkbox'],
        ]);
        expect(res.body.data[2].options).toEqual(['Basic', 'Pro']);
    });

    it('rejects a dropdown without options and an unknown type', async () => {
        expect((await as(org.admin).post('/api/organization/custom-fields', { field_name: 'X', field_type: 'dropdown' })).status).toBe(400);
        expect((await as(org.admin).post('/api/organization/custom-fields', { field_name: 'Y', field_type: 'colour' })).status).toBe(400);
    });

    it('only the org admin manages definitions; everyone in the org can read them for forms', async () => {
        expect((await as(org.sales_manager.token).post('/api/organization/custom-fields', { field_name: 'Z', field_type: 'text' })).status).toBe(403);
        const res = await as(org.sales.token).get('/api/clients/custom-fields');
        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(5);
    });

    it('saves valid values into clients.custom_fields', async () => {
        const res = await as(org.sales_manager.token).post('/api/clients', {
            companyName: 'Custom Co', customerName: 'Cara',
            customFields: { Website: 'custom.example', Seats: '12', Plan: 'Pro', Renewal: '2026-12-01', VIP: true },
        });
        expect(res.status).toBe(201);
        expect(res.body.data.custom_fields).toEqual({ Website: 'custom.example', Seats: 12, Plan: 'Pro', Renewal: '2026-12-01', VIP: true });

        const update = await as(org.sales_manager.token).put(`/api/clients/${res.body.data.id}`, { customFields: { Plan: 'Basic' } });
        expect(update.status).toBe(200);
        expect(update.body.data.custom_fields).toEqual({ Plan: 'Basic' });

        const untouched = await as(org.sales_manager.token).put(`/api/clients/${res.body.data.id}`, { notes: 'hi' });
        expect(untouched.body.data.custom_fields).toEqual({ Plan: 'Basic' });
    });

    it.each([
        [{ Seats: 'many' }], [{ Plan: 'Gold' }], [{ Renewal: '01/12/2026' }], [{ VIP: 'yes' }],
        [{ Website: 'x'.repeat(1001) }], [{ Unknown: 'value' }],
    ])('rejects invalid values %j', async (customFields) => {
        const res = await as(org.sales_manager.token).post('/api/clients', { companyName: 'Bad Co', customFields });
        expect(res.status).toBe(400);
    });

    it('renaming a field keeps the stored values', async () => {
        const created = await as(org.sales_manager.token).post('/api/clients', { companyName: 'Rename Co', customFields: { Website: 'keep.me' } });
        const rename = await as(org.admin).put(`/api/organization/custom-fields/${fields[0].id}`, { field_name: 'Web address' });
        expect(rename.status).toBe(200);
        const clients = await as(org.sales_manager.token).get('/api/clients');
        const client = clients.body.data.find((c) => c.id === created.body.data.id);
        expect(client.custom_fields).toEqual({ 'Web address': 'keep.me' });
    });

    it('reorders fields and refuses an incomplete order', async () => {
        const ids = fields.map((f) => f.id).reverse();
        const res = await as(org.admin).put('/api/organization/custom-fields/order', { ids });
        expect(res.status).toBe(200);
        expect(res.body.data.map((f) => f.id)).toEqual(ids);
        expect((await as(org.admin).put('/api/organization/custom-fields/order', { ids: ids.slice(1) })).status).toBe(400);
    });

    it("another organization can't see or edit these fields", async () => {
        const other = await setupOrg();
        expect((await as(other.admin).get('/api/organization/custom-fields')).body.data).toHaveLength(0);
        expect((await as(other.admin).put(`/api/organization/custom-fields/${fields[1].id}`, { field_name: 'Hijack' })).status).toBe(404);
    });
});

describe('pipeline stages', () => {
    let org;
    beforeAll(async () => { org = await setupOrg(); });

    it('adds, renames and reorders stages', async () => {
        const names = ['New Lead', 'Contacted', 'Proposal Sent', 'Won'];
        const ids = [];
        for (const stage_name of names) {
            const res = await as(org.admin).post('/api/organization/pipeline-stages', { stage_name });
            expect(res.status).toBe(201);
            ids.push(res.body.data.id);
        }
        const rename = await as(org.admin).put(`/api/organization/pipeline-stages/${ids[1]}`, { stage_name: 'First call' });
        expect(rename.body.data.stage_name).toBe('First call');

        const order = await as(org.admin).put('/api/organization/pipeline-stages/order', { ids: [ids[3], ids[0], ids[1], ids[2]] });
        expect(order.body.data.map((s) => s.stage_name)).toEqual(['Won', 'New Lead', 'First call', 'Proposal Sent']);

        const board = await as(org.cst.token).get('/api/clients/pipeline-stages');
        expect(board.body.data.map((s) => s.stage_order)).toEqual([1, 2, 3, 4]);
    });

    it('rejects a duplicate name and has no delete', async () => {
        expect((await as(org.admin).post('/api/organization/pipeline-stages', { stage_name: 'Won' })).status).toBe(409);
        const stages = await as(org.admin).get('/api/organization/pipeline-stages');
        expect((await as(org.admin).delete(`/api/organization/pipeline-stages/${stages.body.data[0].id}`)).status).toBe(404);
    });

    it('only the org admin manages stages', async () => {
        expect((await as(org.cst_manager.token).post('/api/organization/pipeline-stages', { stage_name: 'Lost' })).status).toBe(403);
    });
});
