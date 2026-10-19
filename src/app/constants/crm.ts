/**
 * Centralized business constants for the CRM.
 * Move these to a database table eventually for dynamic management.
 */

// Client products and service areas are per organization now: the options of
// those client fields (backend/services/clientFieldService.js).

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
