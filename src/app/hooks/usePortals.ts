import { useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import type { PortalConfig, PortalKey, Tier } from '../types/crm';
import { PORTAL_THEMES } from '../styles/portal-themes';

/**
 * The organization's portal configuration: which portals are enabled and what
 * they (and their tiers) are called. Labels are display-only; permissions never
 * depend on them.
 */
export function usePortals() {
  const { user } = useAuth();
  const portals: PortalConfig[] = useMemo(() => user?.portals ?? [], [user?.portals]);

  const byKey = useMemo(() => new Map(portals.map((p) => [p.key, p])), [portals]);

  // Without portal data (e.g. before the session loads) treat everything as enabled.
  const isEnabled = useCallback((key: string) => byKey.get(key as PortalKey)?.enabled ?? true, [byKey]);

  const labelFor = useCallback(
    (key: string) => byKey.get(key as PortalKey)?.label ?? PORTAL_THEMES[key as PortalKey]?.label ?? key,
    [byKey],
  );

  const tierLabel = useCallback(
    (key: string, tier: Tier) => byKey.get(key as PortalKey)?.tierLabels?.[tier] || tier,
    [byKey],
  );

  // Policy action check for showing/hiding controls. Before the session lists
  // actions, allow everything and let the server decide.
  const allowed = useMemo(() => (user?.allowedActions ? new Set(user.allowedActions) : null), [user?.allowedActions]);
  const can = useCallback((action: string) => !allowed || allowed.has(action), [allowed]);

  return { portals, enabledPortals: portals.filter((p) => p.enabled), isEnabled, labelFor, tierLabel, can };
}
