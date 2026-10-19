import { z } from 'zod';

// One client's fields as the client form sends them (camelCase). Shared by
// POST /clients and the client CSV import (plan 7.5) so both apply the same rules.
// Custom field values are checked separately by validateCustomFields().

const text = (max) => z.string().trim().max(max).optional().nullable();
const optionalEmail = z.union([z.literal(''), z.string().trim().email('invalid email').max(255)]).optional().nullable();
const optionalId = z.union([z.literal(''), z.coerce.number().int().positive()]).optional().nullable()
    .transform((v) => (v === '' ? null : v));

export const clientSchema = z.object({
    companyName: z.string({ required_error: 'company name is required' }).trim().min(1, 'company name is required').max(255),
    customerName: text(255),
    email: optionalEmail,
    email_2: optionalEmail,
    paymentAmount: z.union([z.literal(''), z.coerce.number().min(0, 'payment must be 0 or more')]).optional().nullable()
        .transform((v) => (v === '' ? null : v)),
    productSold: text(255),
    serviceArea: text(255),
    contactNo1: text(50),
    contactNo2: text(50),
    cin: text(100),
    paymentGateway: text(100),
    clientConcerns: text(5000),
    tipsForTech: text(5000),
    notes: text(5000),
    digitalPresence: text(5000),
    clientServices: text(5000),
    sales_agent_id: optionalId,
    cst_agent_id: optionalId,
    customFields: z.record(z.string(), z.unknown()).optional().nullable(),
});

export const clientImportSchema = z.object({
    clients: z.array(z.unknown()).min(1).max(500),
});
