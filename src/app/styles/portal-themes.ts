/**
 * Portal-specific color themes for each role dashboard.
 * Each portal gets a unique identity with gradient header, accent colors, and semantic tokens.
 */

export type PortalRole = 'admin' | 'sales' | 'sales_manager' | 'finance' | 'cst' | 'cst_manager';

export interface PortalTheme {
  role: PortalRole;
  label: string;
  /** Gradient CSS for the header background */
  headerGradient: string;
  /** Primary accent color (hex) for borders, icons, highlights */
  accent: string;
  /** Lighter tint for backgrounds */
  accentLight: string;
  /** Darker shade for text */
  accentDark: string;
  /** Icon background class */
  iconBg: string;
  /** Icon text class */
  iconText: string;
  /** Border accent class */
  borderAccent: string;
  /** Badge/chip background */
  badgeBg: string;
  /** Badge text */
  badgeText: string;
}

export const PORTAL_THEMES: Record<PortalRole, PortalTheme> = {
  admin: {
    role: 'admin',
    label: 'Admin Portal',
    headerGradient: 'linear-gradient(135deg, hsl(229 47% 20%) 0%, hsl(243 47% 35%) 50%, hsl(255 40% 45%) 100%)',
    accent: '#6366f1',
    accentLight: 'hsl(243 75% 97%)',
    accentDark: 'hsl(243 47% 25%)',
    iconBg: 'bg-indigo-100 dark:bg-indigo-900/30',
    iconText: 'text-indigo-600 dark:text-indigo-400',
    borderAccent: 'border-l-indigo-500',
    badgeBg: 'bg-indigo-100 dark:bg-indigo-900/40',
    badgeText: 'text-indigo-700 dark:text-indigo-300',
  },
  sales: {
    role: 'sales',
    label: 'Sales Portal',
    headerGradient: 'linear-gradient(135deg, hsl(160 40% 18%) 0%, hsl(168 45% 28%) 50%, hsl(172 50% 38%) 100%)',
    accent: '#10b981',
    accentLight: 'hsl(160 60% 96%)',
    accentDark: 'hsl(160 40% 20%)',
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
    iconText: 'text-emerald-600 dark:text-emerald-400',
    borderAccent: 'border-l-emerald-500',
    badgeBg: 'bg-emerald-100 dark:bg-emerald-900/40',
    badgeText: 'text-emerald-700 dark:text-emerald-300',
  },
  sales_manager: {
    role: 'sales_manager',
    label: 'Sales Manager Portal',
    headerGradient: 'linear-gradient(135deg, hsl(210 50% 18%) 0%, hsl(200 55% 30%) 50%, hsl(195 60% 40%) 100%)',
    accent: '#0ea5e9',
    accentLight: 'hsl(200 60% 96%)',
    accentDark: 'hsl(200 55% 20%)',
    iconBg: 'bg-sky-100 dark:bg-sky-900/30',
    iconText: 'text-sky-600 dark:text-sky-400',
    borderAccent: 'border-l-sky-500',
    badgeBg: 'bg-sky-100 dark:bg-sky-900/40',
    badgeText: 'text-sky-700 dark:text-sky-300',
  },
  finance: {
    role: 'finance',
    label: 'Finance Portal',
    headerGradient: 'linear-gradient(135deg, hsl(270 40% 18%) 0%, hsl(265 45% 30%) 50%, hsl(258 50% 42%) 100%)',
    accent: '#8b5cf6',
    accentLight: 'hsl(265 60% 97%)',
    accentDark: 'hsl(265 40% 22%)',
    iconBg: 'bg-violet-100 dark:bg-violet-900/30',
    iconText: 'text-violet-600 dark:text-violet-400',
    borderAccent: 'border-l-violet-500',
    badgeBg: 'bg-violet-100 dark:bg-violet-900/40',
    badgeText: 'text-violet-700 dark:text-violet-300',
  },
  cst: {
    role: 'cst',
    label: 'CST Portal',
    headerGradient: 'linear-gradient(135deg, hsl(190 45% 18%) 0%, hsl(195 55% 30%) 50%, hsl(200 60% 42%) 100%)',
    accent: '#0891b2',
    accentLight: 'hsl(190 70% 96%)',
    accentDark: 'hsl(190 50% 22%)',
    iconBg: 'bg-cyan-100 dark:bg-cyan-900/30',
    iconText: 'text-cyan-600 dark:text-cyan-400',
    borderAccent: 'border-l-cyan-500',
    badgeBg: 'bg-cyan-100 dark:bg-cyan-900/40',
    badgeText: 'text-cyan-700 dark:text-cyan-300',
  },
  cst_manager: {
    role: 'cst_manager',
    label: 'CST Manager Portal',
    headerGradient: 'linear-gradient(135deg, hsl(340 40% 18%) 0%, hsl(345 45% 30%) 50%, hsl(350 50% 42%) 100%)',
    accent: '#f43f5e',
    accentLight: 'hsl(345 60% 97%)',
    accentDark: 'hsl(340 40% 22%)',
    iconBg: 'bg-rose-100 dark:bg-rose-900/30',
    iconText: 'text-rose-600 dark:text-rose-400',
    borderAccent: 'border-l-rose-500',
    badgeBg: 'bg-rose-100 dark:bg-rose-900/40',
    badgeText: 'text-rose-700 dark:text-rose-300',
  },
};

export function getPortalTheme(role?: string): PortalTheme {
  return PORTAL_THEMES[(role as PortalRole)] ?? PORTAL_THEMES.admin;
}
