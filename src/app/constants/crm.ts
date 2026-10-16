/**
 * Centralized business constants for the CRM.
 * Move these to a database table eventually for dynamic management.
 */

export const PRODUCTS = [
    'Local SEO Service',
    'Google Business Profile Optimization',
    'Website Design & Development',
    'Social Media Management',
    'Content Marketing',
    'Paid Search (PPC)'
];

export const SERVICE_AREAS = [
    'United States',
    'United Kingdom',
    'Canada',
    'Australia',
    'European Union'
];

export const EVENT_TYPES = [
    'meeting',
    'training',
    'deadline',
    'celebration',
    'other'
];

export const TASK_STATUSES = [
    'pending',
    'in-progress',
    'submitted',
    'approved',
    'rejected',
    'completed',
    'missed'
];

export const TASK_PRIORITIES = [
    'high',
    'medium',
    'low'
];

export const CLIENT_STATUSES = [
    'onboarding',
    'active',
    'flagged',
    'deactivated'
];

export const DEPARTMENT_COLORS: Record<string, string> = {
    sales: 'bg-blue-600',
    cst: 'bg-emerald-600',
    finance: 'bg-slate-700',
    admin: 'bg-indigo-900'
};
