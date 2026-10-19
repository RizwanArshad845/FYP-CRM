import pool from '../config/db.js';
import { httpError } from '../utils/tenant.js';

export const FIELD_TYPES = ['text', 'number', 'dropdown', 'date', 'checkbox'];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The organization's active client field definitions, in display order. */
export const getFieldDefinitions = async (tenantId, objectType = 'client', db = pool) => {
    const { rows } = await db.query(
        `SELECT id, field_name, field_type, options, display_order FROM field_definitions
         WHERE tenant_id = $1 AND object_type = $2 ORDER BY display_order, id`,
        [tenantId, objectType]
    );
    return rows;
};

const valid = {
    text: (v) => typeof v === 'string' && v.length <= 1000,
    number: (v) => (typeof v === 'number' && Number.isFinite(v)) || (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))),
    date: (v) => typeof v === 'string' && ISO_DATE.test(v) && !Number.isNaN(Date.parse(v)),
    checkbox: (v) => typeof v === 'boolean',
    dropdown: (v, def) => typeof v === 'string' && Array.isArray(def.options) && def.options.includes(v),
};

/**
 * Checks custom field values against the definitions (plan 6.1) and returns the
 * cleaned object. Unknown keys are rejected; empty values (null, '') are dropped.
 * Throws a 400 naming the field on the first problem.
 */
export const validateCustomFields = (definitions, values) => {
    if (values == null) return {};
    if (typeof values !== 'object' || Array.isArray(values)) throw httpError(400, 'Custom fields must be an object');
    const byName = new Map(definitions.map((d) => [d.field_name, d]));
    const out = {};
    for (const [name, value] of Object.entries(values)) {
        const def = byName.get(name);
        if (!def) throw httpError(400, `Unknown custom field "${name}"`);
        if (value === null || value === '') continue;
        if (!valid[def.field_type](value, def)) {
            const expected = { text: 'text up to 1000 characters', number: 'a number', date: 'a date (YYYY-MM-DD)', checkbox: 'true or false', dropdown: 'one of the listed options' };
            throw httpError(400, `${name}: must be ${expected[def.field_type]}`);
        }
        out[name] = def.field_type === 'number' ? Number(value) : value;
    }
    return out;
};
