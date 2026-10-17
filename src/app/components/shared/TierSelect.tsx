import type { Tier } from '../../types/crm';
import { usePortals } from '../../hooks/usePortals';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

const TIERS: Tier[] = ['Member', 'Manager', 'Admin'];
const DEFAULT = '__default__';

/**
 * Tier picker for one portal, showing the org's tier titles.
 * '' means "use the portal's default tier". The Admin portal is always Admin.
 */
export function TierSelect({ portalKey, value, onChange, id }: {
  portalKey: string | undefined;
  value: string;
  onChange: (tier: string) => void;
  id?: string;
}) {
  const { portals, tierLabel } = usePortals();
  const portal = portals.find((p) => p.key === portalKey);
  const name = (t: Tier) => {
    const custom = portalKey ? tierLabel(portalKey, t) : t;
    return custom !== t ? `${custom} (${t})` : t;
  };

  if (portalKey === 'admin') {
    return (
      <Select value="Admin" disabled>
        <SelectTrigger id={id}><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="Admin">{name('Admin')}</SelectItem></SelectContent>
      </Select>
    );
  }

  return (
    <Select value={value || DEFAULT} onValueChange={(v) => onChange(v === DEFAULT ? '' : v)} disabled={!portalKey}>
      <SelectTrigger id={id}><SelectValue placeholder="Select a tier" /></SelectTrigger>
      <SelectContent>
        <SelectItem value={DEFAULT}>Portal default{portal ? ` (${name(portal.defaultTier)})` : ''}</SelectItem>
        {TIERS.map((t) => <SelectItem key={t} value={t}>{name(t)}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
