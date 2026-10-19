export interface Task {
  id: number;
  title: string;
  description: string;
  status: 'pending' | 'in-progress' | 'submitted' | 'approved' | 'rejected' | 'completed' | 'missed';
  priority: 'low' | 'medium' | 'high';
  assignedTo: number;
  department: string;
  dueDate: string;
  category: string;
}

export interface User {
  id: number;
  first_name: string;
  last_name: string;
  name: string; // Combined first + last
  email: string;
  role_id: number;
  role: 'admin' | 'sales' | 'sales_manager' | 'finance' | 'cst' | 'cst_manager';
  department: string;
  status: 'active' | 'inactive' | 'on_leave';
  clockedIn?: boolean;
  clockInTime?: string;
  clockOutTime?: string;
  onBreak?: boolean;
  breakInTime?: string;
  tier?: Tier;
  mustChangePassword?: boolean;
  onboardingCompleted?: boolean;
  organization?: Organization;
  portals?: PortalConfig[];
  allowedActions?: string[]; // policy action keys (UI hint; the server re-checks)
}

export type PortalKey = User['role'];
export type Tier = 'Admin' | 'Manager' | 'Member';

export interface Organization {
  id: number;
  name: string;
  slug: string;
  industry?: string | null;
  size?: string | null;
}

// One entry of the fixed portal catalog, as configured by this organization
export interface PortalConfig {
  key: PortalKey;
  label: string;
  defaultLabel: string;
  customLabel: string | null;
  description: string;
  defaultTier: Tier;
  enabled: boolean;
  tierLabels: Partial<Record<Tier, string>>;
}

// Permission dials for one (portal, tier): fixed catalog entries with this org's values
// Organization-defined client field (plan 6.1); field_name is also the key in custom_fields
export interface FieldDefinition {
  id: number;
  field_name: string;
  field_type: 'text' | 'number' | 'dropdown' | 'date' | 'checkbox';
  options: string[] | null;
  display_order: number;
}

// Organization-defined pipeline stage (plan 6.2)
export interface PipelineStage {
  id: number;
  stage_name: string;
  stage_order: number;
}

export interface TierPermissions {
  tier: Tier;
  actions: { key: string; label: string; allowed: boolean }[];
  fields: { key: string; label: string; visible: boolean }[];
}

export interface PortalPermissions {
  key: PortalKey;
  label: string;
  tiers: TierPermissions[];
}

export interface PermissionChange {
  portalKey: string;
  tier: Tier;
  actions: Record<string, boolean>;
  fields: Record<string, boolean>;
}

export interface Event {
  id: number;
  title: string;
  date: string;
  type: 'meeting' | 'training' | 'deadline' | 'celebration' | 'other';
  created_by_user_id: number;
}

export interface Client {
  id: number;
  name: string;
  email: string;
  phone: string;
  status: 'onboarding' | 'active' | 'flagged' | 'deactivated';
  sales_agent_id?: number;
  cst_agent_id?: number;
  healthScore?: number;
  lastInteraction?: string;
  nextCheckIn?: string;
  onboardingProgress?: number;
  isActive: boolean;
}

export interface Employee {
  id: number;
  name: string;
  employee_id: string; // Formatting like EMP001
  email: string;
  department: string;
  role: string;
  tier?: Tier;
  status: string;
  base_salary: number;
  advance_payments: number;
  accrued_payments: number;
  total_salary: number;
  hire_date?: string;
  payment_status: 'paid' | 'pending' | 'partial';
}

export interface AttendanceRecord {
  id: number;
  user_id: number;
  user_name: string;
  department: string;
  date: string;
  clock_in: string | null;
  clock_out: string | null;
  status: 'on-time' | 'tardy' | 'absent';
  total_hours: number | null;
}