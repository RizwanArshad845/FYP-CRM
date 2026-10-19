import pool from '../config/db.js';
import { httpError } from '../utils/tenant.js';
import { getFieldDefinitions } from './customFieldService.js';

// The client record as each organization sees it (plan 6.1), in the way of other CRMs:
// every field has a fixed key (the column, never renamed) and a label the admin edits.
//   core     - needed by AICRE itself (names, contact, revenue): rename only, never off
//   standard - built-in columns an organization can rename, reorder, require or switch off
//   custom   - the organization's own fields (field_definitions), kept in clients.custom_fields
//   system   - set by AICRE, not typed into forms (status, owners, stage, dates); listed only

export const CLIENT_SECTIONS = ['client', 'contact', 'online', 'notes', 'custom'];

// `body` is the request key the client forms and CSV import send (POST /clients).
export const STANDARD_CLIENT_FIELDS = [
    { key: 'company_name', body: 'companyName', label: 'Company name', type: 'text', section: 'client', core: true, required: true },
    { key: 'customer_name', body: 'customerName', label: 'Customer name', type: 'text', section: 'client', core: true, required: true },
    { key: 'payment_amount', body: 'paymentAmount', label: 'Payment amount', type: 'number', section: 'client', core: true, required: true },
    {
        key: 'product_sold', body: 'productSold', label: 'Products sold', type: 'multiselect', section: 'client', required: true,
        options: ['Local SEO Service', 'Google Business Profile Optimization', 'Website Design & Development', 'Social Media Management', 'Content Marketing', 'Paid Search (PPC)'],
    },
    { key: 'service_area', body: 'serviceArea', label: 'Service area', type: 'text', section: 'client', options: ['United States', 'United Kingdom', 'Canada', 'Australia', 'European Union'] },
    { key: 'client_services', body: 'clientServices', label: 'Client services', type: 'text', section: 'client' },
    { key: 'cin', body: 'cin', label: 'CIN', type: 'text', section: 'client' },
    { key: 'payment_gateway', body: 'paymentGateway', label: 'Payment gateway', type: 'dropdown', section: 'client', options: ['Zelle', 'Cash App', 'Stripe', 'Square', 'Card Charge'] },
    { key: 'email', body: 'email', label: 'Email', type: 'email', section: 'contact', core: true, required: true },
    { key: 'email_2', body: 'email_2', label: 'Email 2', type: 'email', section: 'contact' },
    { key: 'contact_no_1', body: 'contactNo1', label: 'Contact no. 1', type: 'phone', section: 'contact', core: true, required: true },
    { key: 'contact_no_2', body: 'contactNo2', label: 'Contact no. 2', type: 'phone', section: 'contact' },
    { key: 'digital_presence', body: 'digitalPresence', label: 'Online presence', type: 'textarea', section: 'online' },
    { key: 'client_concerns', body: 'clientConcerns', label: 'Client concerns', type: 'textarea', section: 'notes' },
    { key: 'tips_for_tech', body: 'tipsForTech', label: 'Tips for the CST team', type: 'textarea', section: 'notes' },
    { key: 'notes', body: 'notes', label: 'General notes', type: 'textarea', section: 'notes' },
];

// Company name is the record's name: always shown and always required.
export const ALWAYS_REQUIRED = 'company_name';

export const SYSTEM_CLIENT_FIELDS = [
    { key: 'status', label: 'Status', type: 'system' },
    { key: 'sales_agent_id', label: 'Sales agent', type: 'system' },
    { key: 'cst_agent_id', label: 'CST agent', type: 'system' },
    { key: 'stage_id', label: 'Pipeline stage', type: 'system' },
    { key: 'created_at', label: 'Created on', type: 'system' },
];

export const STANDARD_BY_KEY = new Map(STANDARD_CLIENT_FIELDS.map((f) => [f.key, f]));

/**
 * Every client field of the organization in form order: standard fields with the
 * organization's overrides applied, then its custom fields. Hidden fields are included
 * (flagged) so settings and old records can still show them.
 */
export const getClientFields = async (tenantId, db = pool) => {
    const [{ rows: settings }, definitions] = await Promise.all([
        db.query('SELECT field_key, label, hidden, required, display_order, options FROM client_field_settings WHERE tenant_id = $1', [tenantId]),
        getFieldDefinitions(tenantId, 'client', db),
    ]);
    const byKey = new Map(settings.map((s) => [s.field_key, s]));
    const standard = STANDARD_CLIENT_FIELDS.map((f, i) => {
        const s = byKey.get(f.key) ?? {};
        return {
            key: f.key,
            body: f.body,
            kind: f.core ? 'core' : 'standard',
            label: s.label || f.label,
            default_label: f.label,
            type: f.type,
            section: f.section,
            hidden: f.core ? false : Boolean(s.hidden),
            required: f.key === ALWAYS_REQUIRED ? true : (s.required ?? Boolean(f.required)),
            options: f.options ? (s.options ?? f.options) : null,
            display_order: s.display_order ?? i + 1,
        };
    });
    const sectionRank = (f) => CLIENT_SECTIONS.indexOf(f.section);
    standard.sort((a, b) => sectionRank(a) - sectionRank(b) || a.display_order - b.display_order);

    const custom = definitions.map((d) => ({
        key: `cf_${d.id}`,
        id: d.id,
        name: d.field_name,
        kind: 'custom',
        label: d.field_name,
        default_label: d.field_name,
        type: d.field_type,
        section: 'custom',
        hidden: d.hidden,
        required: d.required,
        options: d.options,
        display_order: d.display_order,
    }));
    return [...standard, ...custom];
};

const isEmpty = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

/**
 * Applies the organization's layout to one client body (POST, CSV row or PUT).
 * Values of switched-off fields are dropped, so they never overwrite kept data.
 * Required fields must be filled; on a partial update only the fields sent are checked.
 * Returns the body to save; throws a 400 naming the first missing field.
 */
export const applyClientLayout = (fields, input, { partial = false } = {}) => {
    const body = { ...input };
    const custom = body.customFields && typeof body.customFields === 'object' && !Array.isArray(body.customFields)
        ? { ...body.customFields } : body.customFields;
    for (const f of fields) {
        if (f.kind === 'custom') {
            if (!custom || typeof custom !== 'object') {
                if (f.required && !f.hidden && !partial) throw httpError(400, `${f.label} is required`);
                continue;
            }
            if (f.hidden) { delete custom[f.name]; continue; }
            // Custom values are sent as a whole object, so a sent object is checked in full
            if (f.required && isEmpty(custom[f.name])) throw httpError(400, `${f.label} is required`);
            continue;
        }
        if (f.hidden) { delete body[f.body]; continue; }
        if (f.required && isEmpty(body[f.body]) && (!partial || f.body in body)) throw httpError(400, `${f.label} is required`);
    }
    if (custom !== undefined) body.customFields = custom;
    return body;
};

/** The custom fields in the shape validateCustomFields() reads. */
export const customDefinitions = (fields) => fields
    .filter((f) => f.kind === 'custom')
    .map((f) => ({ id: f.id, field_name: f.name, field_type: f.type, options: f.options }));
