import type { ComponentType } from 'react';
import {
  LayoutDashboard, Clock, AlertTriangle, Globe, Users, BookOpen, CalendarIcon, TrendingUp, UserCog,
  ClipboardList, AlertCircle, Target, StickyNote, Flag, Mic, FileText, PhoneCall, ClipboardCheck, Building2,
  type LucideIcon,
} from 'lucide-react';
import type { PortalKey } from '../types/crm';
import { AdminDashboard } from '../pages/admin/AdminDashboard';
import { SalesDashboard } from '../pages/sales/SalesDashboard';
import { SalesManagerDashboard } from '../pages/sales-manager/SalesManagerDashboard';
import { FinanceDashboard } from '../pages/finance/FinanceDashboard';
import { CSTDashboard } from '../pages/cst/CSTDashboard';
import { CSTManagerDashboard } from '../pages/cst-manager/CSTManagerDashboard';

// Badge counts come from the existing contexts; AppSidebar computes one number per key.
export type NavBadge =
  | 'cstInbox' | 'cstManagerTasks' | 'deactivations' | 'cstPortfolio' | 'internalConcerns'
  | 'salesManagerTasks' | 'pendingFollowUps' | 'teamConcerns' | 'ownConcerns' | 'allConcerns';

export interface NavItem {
  /** Dashboard module (?module=...); omit for the dashboard's default view */
  module?: string;
  /** A page outside the dashboard instead of a module */
  page?: '/clock-in';
  label: string;
  icon: LucideIcon;
  /** Hidden unless the user may perform this policy action */
  actionKey?: string;
  badge?: NavBadge;
  /** Shown as active when the dashboard is opened without a module */
  isDefault?: boolean;
}

export interface PortalNav {
  component: ComponentType;
  items: NavItem[];
}

/**
 * Fixed mapping from portal type to its dashboard and navigation (plan 5.2).
 * A new portal type needs one entry here, never a role comparison elsewhere.
 */
export const PORTAL_NAV: Record<PortalKey, PortalNav> = {
  admin: {
    component: AdminDashboard,
    items: [
      { module: 'overview', label: 'Overview', icon: TrendingUp },
      { module: 'employees', label: 'Employees', icon: UserCog, actionKey: 'user.manage', isDefault: true },
      { module: 'performance', label: 'Performance', icon: ClipboardList },
      { module: 'tasks', label: 'Task Delegation', icon: Target, actionKey: 'task.delegate' },
      { module: 'clients', label: 'Active Clients', icon: Globe },
      { module: 'concerns', label: 'Concerns', icon: AlertCircle, badge: 'allConcerns' },
      { module: 'events', label: 'Events', icon: CalendarIcon },
      { module: 'org-settings', label: 'Organization', icon: Building2, actionKey: 'org.settings' },
    ],
  },
  sales: {
    component: SalesDashboard,
    items: [
      { module: 'team-performance', label: 'Team Performance', icon: Users, isDefault: true },
      { module: 'followup', label: 'Follow-up Leads', icon: PhoneCall, badge: 'pendingFollowUps' },
      { module: 'comms', label: 'Communication', icon: Mic },
      { module: 'performance', label: 'Performance', icon: TrendingUp },
      { module: 'notepad', label: 'Personal Notepad', icon: StickyNote },
      { module: 'concerns', label: 'Concerns', icon: AlertCircle, badge: 'ownConcerns' },
    ],
  },
  sales_manager: {
    component: SalesManagerDashboard,
    items: [
      { module: 'overview', label: 'Overview', icon: LayoutDashboard, isDefault: true },
      { module: 'entry', label: 'Client Entry', icon: FileText, actionKey: 'client.create' },
      { module: 'team', label: 'Team Management', icon: Users },
      { module: 'mytasks', label: 'Manager Tasks', icon: ClipboardCheck, badge: 'salesManagerTasks' },
      { module: 'followup', label: 'Team Follow-ups', icon: PhoneCall, badge: 'pendingFollowUps' },
      { module: 'recordings', label: 'Important Calls', icon: Mic },
      { module: 'self', label: 'My Target', icon: UserCog },
      { module: 'notepad', label: 'Personal Notepad', icon: StickyNote },
      { module: 'concerns', label: 'Concerns', icon: AlertCircle, badge: 'teamConcerns' },
    ],
  },
  cst: {
    component: CSTDashboard,
    items: [
      { module: 'overview', label: 'Overview', icon: LayoutDashboard, isDefault: true },
      { module: 'clients', label: 'Client Portfolio', icon: Users, badge: 'cstPortfolio' },
      { module: 'docs', label: 'Notes', icon: StickyNote },
      { module: 'calendar', label: 'Calendar', icon: CalendarIcon },
      { module: 'targets', label: 'Monthly Targets', icon: Flag },
      { module: 'concerns', label: 'Internal Concerns', icon: AlertTriangle, badge: 'internalConcerns' },
    ],
  },
  cst_manager: {
    component: CSTManagerDashboard,
    items: [
      { module: 'client-ops', label: 'Client Operations', icon: Globe, badge: 'cstInbox', isDefault: true },
      { module: 'agent-management', label: 'Agent Management', icon: Users, badge: 'cstManagerTasks' },
      { module: 'strategy-resources', label: 'Strategy & Resources', icon: BookOpen },
      { module: 'requests-actions', label: 'Requests & Actions', icon: AlertTriangle, badge: 'deactivations' },
      { module: 'calendar', label: 'Team Calendar', icon: CalendarIcon },
    ],
  },
  finance: {
    component: FinanceDashboard,
    items: [
      { label: 'Dashboard', icon: LayoutDashboard, isDefault: true },
      { page: '/clock-in', label: 'Attendance', icon: Clock },
    ],
  },
};

/** App path of a nav item, before the organization prefix. */
export const navItemPath = (item: NavItem): string =>
  item.page ?? (item.module ? `/dashboard?module=${item.module}` : '/dashboard');

/** The nav item for the current location, if any. */
export const activeNavItem = (portal: PortalKey | undefined, pathname: string, search: string): NavItem | undefined => {
  const items = portal ? PORTAL_NAV[portal]?.items ?? [] : [];
  if (pathname.endsWith('/clock-in')) return items.find((i) => i.page === '/clock-in');
  if (!pathname.endsWith('/dashboard')) return undefined;
  const module = new URLSearchParams(search).get('module');
  return module ? items.find((i) => i.module === module) : items.find((i) => i.isDefault);
};
