/**
 * Color theme per portal dashboard.
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

// Every portal shares the report's palette (plan Section 9.2); the per-portal
// mechanism stays so a portal could get its own look later without code changes.
const AICRE_PALETTE = {
  headerGradient: 'linear-gradient(135deg, #1e2a44 0%, #2f4170 55%, #3b6fe0 100%)',
  accent: '#3b6fe0',
  accentLight: '#f2f6ff',
  accentDark: '#1e2a44',
  iconBg: 'bg-primary-soft',
  iconText: 'text-primary',
  borderAccent: 'border-l-primary',
  badgeBg: 'bg-info-bg',
  badgeText: 'text-info',
};

export const PORTAL_THEMES: Record<PortalRole, PortalTheme> = {
  admin: { role: 'admin', label: 'Admin Portal', ...AICRE_PALETTE },
  sales: { role: 'sales', label: 'Sales Portal', ...AICRE_PALETTE },
  sales_manager: { role: 'sales_manager', label: 'Sales Manager Portal', ...AICRE_PALETTE },
  finance: { role: 'finance', label: 'Finance Portal', ...AICRE_PALETTE },
  cst: { role: 'cst', label: 'CST Portal', ...AICRE_PALETTE },
  cst_manager: { role: 'cst_manager', label: 'CST Manager Portal', ...AICRE_PALETTE },
};

export function getPortalTheme(role?: string): PortalTheme {
  return PORTAL_THEMES[(role as PortalRole)] ?? PORTAL_THEMES.admin;
}
