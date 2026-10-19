import type { ClientField, ClientSection } from '../types/crm';

// Helpers around the organization's client layout (plan 6.1): forms, tables and
// detail views read fields from here instead of naming client columns themselves.

export const CLIENT_SECTION_ORDER: ClientSection[] = ['client', 'contact', 'online', 'notes', 'custom'];

export const CLIENT_SECTION_TITLES: Record<ClientSection, string> = {
  client: 'Client information',
  contact: 'Contact details',
  online: 'Online presence',
  notes: 'Notes',
  custom: 'Additional fields',
};

/** Form values keyed by field key; multi-select values are kept as "a, b, c". */
export type ClientFormValues = Record<string, string | boolean>;

type ClientRow = Record<string, any> & { custom_fields?: Record<string, unknown> | null };

export const visibleFields = (fields: ClientField[]) => fields.filter((f) => !f.hidden);

/** Finds a switched-on field by key; undefined when the organization switched it off. */
export const fieldLookup = (fields: ClientField[]) => {
  const byKey = new Map(visibleFields(fields).map((f) => [f.key, f]));
  return (key: string) => byKey.get(key);
};

export const fieldsBySection = (fields: ClientField[]) =>
  CLIENT_SECTION_ORDER
    .map((section) => ({ section, title: CLIENT_SECTION_TITLES[section], fields: fields.filter((f) => f.section === section) }))
    .filter((s) => s.fields.length > 0);

/** The stored value of a field on a client row. */
export const rawValue = (field: ClientField, client: ClientRow): unknown =>
  field.kind === 'custom' ? client.custom_fields?.[field.name!] : client[field.key];

/** A value ready for tables and detail views; '—' when empty. */
export const formatValue = (field: ClientField, client: ClientRow): string => {
  const value = rawValue(field, client);
  if (value === undefined || value === null || value === '') return '—';
  if (field.type === 'checkbox') return value === true ? 'Yes' : 'No';
  if (field.key === 'payment_amount') return `$${Number(value).toLocaleString()}`;
  if (field.type === 'date' && typeof value === 'string') return new Date(`${value}T00:00:00`).toLocaleDateString();
  return String(value);
};

export const clientToValues = (fields: ClientField[], client: ClientRow): ClientFormValues =>
  Object.fromEntries(fields.map((f) => {
    const value = rawValue(f, client);
    if (f.type === 'checkbox') return [f.key, value === true];
    return [f.key, value === undefined || value === null ? '' : String(value)];
  }));

const isBlank = (v: string | boolean | undefined) => v === undefined || v === false || (typeof v === 'string' && v.trim() === '');

/** Labels of the visible required fields that are still empty. */
export const missingRequired = (fields: ClientField[], values: ClientFormValues) =>
  visibleFields(fields).filter((f) => f.required && isBlank(values[f.key])).map((f) => f.label);

/** The POST/PUT /clients body for the visible fields (switched-off fields are never sent). */
export const toClientBody = (fields: ClientField[], values: ClientFormValues) => {
  const body: Record<string, unknown> = {};
  const customFields: Record<string, string | boolean> = {};
  for (const f of visibleFields(fields)) {
    const value = values[f.key];
    if (f.kind === 'custom') {
      if (!isBlank(value)) customFields[f.name!] = typeof value === 'string' ? value.trim() : value;
    } else {
      const text = typeof value === 'string' ? value.trim() : '';
      // numbers are never sent as '' (the column is numeric)
      body[f.body!] = f.type === 'number' && text === '' ? null : text;
    }
  }
  body.customFields = customFields;
  return body;
};

// Multi-select values: the listed options that are ticked, plus free text for the rest.
export const splitMulti = (value: string, options: string[]) => {
  const parts = value.split(',').map((p) => p.trim()).filter(Boolean);
  return { chosen: parts.filter((p) => options.includes(p)), other: parts.filter((p) => !options.includes(p)).join(', ') };
};
export const joinMulti = (chosen: string[], other: string) => [...chosen, other.trim()].filter(Boolean).join(', ');
