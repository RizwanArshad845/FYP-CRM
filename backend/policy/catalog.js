// Fixed, build-time permission catalog. Organizations never add entries; they can
// only switch an eligible action/field group off for a (portal, tier) pair.
//
// `portals` + `minTier` are the ceiling: no override can grant beyond them.

export const TIERS = ['Admin', 'Manager', 'Member'];
export const TIER_RANK = { Member: 1, Manager: 2, Admin: 3 };

const action = (label, portals, minTier = 'Member') => ({ label, portals, minTier });

// Labels are the plain UI texts of the permissions screen (Figure 4.6, plan 6.5).
export const ACTIONS = {
    'admin.dashboard': action('View admin dashboards', ['admin']),
    'org.settings': action('Manage organization settings', ['admin']),
    'user.manage': action('Manage employees', ['admin']),
    'event.manage': action('Manage events', ['admin']),
    'attendance.view_all': action('View all attendance', ['admin']),

    'note.add': action('Add client note', ['cst', 'cst_manager', 'admin']),
    'client.flag': action('Flag client', ['cst', 'cst_manager', 'admin']),
    'deactivation.request': action('Request deactivation', ['cst', 'cst_manager', 'admin']),
    'deactivation.resolve': action('Approve deactivation', ['cst_manager', 'admin'], 'Manager'),
    'client.assign': action('Reassign client', ['cst_manager', 'admin'], 'Manager'),
    'client.move_stage': action('Move client stage', ['cst', 'cst_manager', 'admin']),
    'client.import': action('Import clients', ['sales_manager', 'admin'], 'Manager'),
    'client.create': action('Add client', ['sales', 'sales_manager', 'cst_manager', 'admin']),
    'client.update': action('Edit client', ['sales_manager', 'cst_manager', 'admin'], 'Manager'),
    'client.set_status': action('Change client status', ['cst', 'cst_manager', 'admin']),
    'client.discard': action('Discard client', ['cst_manager', 'admin'], 'Manager'),
    'strategy.manage': action('Write client strategies', ['cst_manager', 'admin'], 'Manager'),
    'cst_target.manage': action('Set CST targets', ['cst_manager', 'admin'], 'Manager'),
    'cst_target.update_achieved': action('Update CST results', ['cst', 'cst_manager', 'admin']),

    'sales_target.manage': action('Set sales targets', ['sales_manager', 'admin'], 'Manager'),
    'sales_target.update_achieved': action('Update sales results', ['sales', 'sales_manager', 'admin']),
    'task.delegate': action('Delegate tasks', ['admin', 'sales_manager', 'cst_manager'], 'Manager'),

    'payroll.manage': action('Run payroll', ['finance', 'admin']),
    'expense.manage': action('Manage expenses', ['finance', 'admin']),
};

// Column groups an org can hide per (portal, tier). `portals` limits who can ever see them.
export const FIELD_GROUPS = {
    'client.contact': {
        label: 'Client contact details',
        objectType: 'client',
        columns: ['email', 'email_2', 'phone', 'contact_no_1', 'contact_no_2'],
        portals: null, // every portal
    },
    'client.financial': {
        label: 'Payment details',
        objectType: 'client',
        columns: ['payment_amount', 'payment_gateway'],
        portals: null,
    },
    'user.compensation': {
        label: 'Salary and payroll',
        objectType: 'user',
        columns: ['base_salary'],
        portals: ['admin', 'finance'],
    },
    // call_recordings and important_call_recordings
    'call.transcript': {
        label: 'Call recordings and transcripts',
        objectType: 'call_recording',
        columns: ['transcript', 'recording_url'],
        portals: ['sales', 'sales_manager', 'cst', 'cst_manager', 'admin'],
    },
    'client.internal_notes': {
        label: 'Internal notes',
        objectType: 'client',
        columns: ['notes', 'tips_for_tech', 'client_concerns'],
        portals: null,
    },
};
