// Fixed, build-time permission catalog. Organizations never add entries; they can
// only switch an eligible action/field group off for a (portal, tier) pair.
//
// `portals` + `minTier` are the ceiling: no override can grant beyond them.

export const TIERS = ['Admin', 'Manager', 'Member'];
export const TIER_RANK = { Member: 1, Manager: 2, Admin: 3 };

const action = (label, portals, minTier = 'Member') => ({ label, portals, minTier });

export const ACTIONS = {
    'admin.dashboard': action('View admin dashboards', ['admin']),
    'org.settings': action('Manage organization settings', ['admin']),
    'user.manage': action('Create, edit and deactivate employees', ['admin']),
    'event.manage': action('Manage company events', ['admin']),
    'attendance.view_all': action('View everyone\'s attendance', ['admin']),

    'client.create': action('Add new clients', ['sales', 'sales_manager', 'cst_manager', 'admin']),
    'client.update': action('Edit client details', ['sales_manager', 'cst_manager', 'admin'], 'Manager'),
    'client.set_status': action('Flag / unflag clients', ['cst', 'cst_manager', 'admin']),
    'client.assign': action('Assign / unassign clients to agents', ['cst_manager', 'admin'], 'Manager'),
    'client.discard': action('Discard clients', ['cst_manager', 'admin'], 'Manager'),
    'deactivation.resolve': action('Approve / reject deactivation requests', ['cst_manager', 'admin'], 'Manager'),
    'strategy.manage': action('Write client strategies', ['cst_manager', 'admin'], 'Manager'),
    'cst_target.manage': action('Set CST targets', ['cst_manager', 'admin'], 'Manager'),
    'cst_target.update_achieved': action('Update achieved CST targets', ['cst', 'cst_manager', 'admin']),

    'sales_target.manage': action('Set sales targets', ['sales_manager', 'admin'], 'Manager'),
    'sales_target.update_achieved': action('Update achieved sales targets', ['sales', 'sales_manager', 'admin']),
    'task.delegate': action('Delegate tasks', ['admin', 'sales_manager', 'cst_manager'], 'Manager'),

    'payroll.manage': action('Manage payroll and salary slips', ['finance', 'admin']),
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
        label: 'Client payment details',
        objectType: 'client',
        columns: ['payment_amount', 'payment_gateway'],
        portals: null,
    },
    'user.compensation': {
        label: 'Employee salaries',
        objectType: 'user',
        columns: ['base_salary'],
        portals: ['admin', 'finance'],
    },
};
