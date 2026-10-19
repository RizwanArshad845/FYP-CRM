import { useEffect, useState } from 'react';
import type { PermissionChange, PortalConfig, PortalPermissions, Tier } from '../../types/crm';
import { PORTAL_THEMES } from '../../styles/portal-themes';
import { usePortals } from '../../hooks/usePortals';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Switch } from '../../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { cn } from '../../components/ui/utils';

export const TIERS: Tier[] = ['Member', 'Manager', 'Admin'];

// Portal card text of Figure 4.2; the landing page reuses it.
export const PORTAL_CARDS: Record<string, { name: string; description: string }> = {
  admin: { name: 'Admin', description: 'Employees, tasks, reviews and settings' },
  sales: { name: 'Sales', description: 'Clients, follow ups and calls' },
  sales_manager: { name: 'Sales Manager', description: 'Targets, recordings and imports' },
  cst: { name: 'Customer Success', description: 'Notes, flags, concerns and requests' },
  cst_manager: { name: 'Customer Success Manager', description: 'Assignment, approvals and strategies' },
  finance: { name: 'Finance', description: 'Payroll, salary slips and expenses' },
};

// Used by both the onboarding wizard and Organization Settings. With `tierLabels`
// (wizard Portals step) it also asks for one Member / Manager / Admin label for every portal.
export function PortalsEditor({ portals, onSave, saving, submitLabel, secondaryAction, tierLabels = false }: {
  portals: PortalConfig[];
  onSave: (changes: { key: string; enabled: boolean }[], tierLabels?: Record<Tier, string>) => void;
  saving: boolean;
  submitLabel: string;
  secondaryAction?: React.ReactNode;
  tierLabels?: boolean;
}) {
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [labels, setLabels] = useState<Record<Tier, string>>({ Member: 'Member', Manager: 'Manager', Admin: 'Admin' });
  useEffect(() => {
    setEnabled(Object.fromEntries(portals.map((p) => [p.key, p.enabled])));
    const sample = portals.find((p) => p.enabled && p.key !== 'admin')?.tierLabels ?? {};
    const admin = portals.find((p) => p.key === 'admin')?.tierLabels ?? {};
    setLabels({ Member: sample.Member || 'Member', Manager: sample.Manager || 'Manager', Admin: admin.Admin || 'Admin' });
  }, [portals]);

  return (
    <div>
      <div className="mb-[18px] grid grid-cols-1 gap-3 md:grid-cols-3">
        {portals.map((p) => {
          const locked = p.key === 'admin';
          const on = locked || (enabled[p.key] ?? p.enabled);
          const card = PORTAL_CARDS[p.key] ?? { name: p.defaultLabel, description: p.description };
          return (
            <button
              key={p.key}
              type="button"
              role="checkbox"
              aria-checked={on}
              aria-disabled={locked}
              onClick={() => !locked && setEnabled((s) => ({ ...s, [p.key]: !on }))}
              className={cn(
                'flex items-start gap-[11px] rounded-[9px] border px-[14px] py-[13px] text-left',
                on ? 'border-primary bg-primary-soft' : 'border-[#dfe4ee] bg-card',
                locked ? 'cursor-default' : 'cursor-pointer',
              )}
            >
              <span className={cn(
                'mt-px flex h-[18px] w-[18px] flex-none items-center justify-center rounded-[4px] border-2 text-[12px] font-bold text-white',
                on ? 'border-primary bg-primary' : 'border-[#b9c2d3]',
              )}>{on ? '✓' : ''}</span>
              <span>
                <b className="mb-[3px] block text-[14px]">
                  {card.name}
                  {locked && <span className="ml-1 text-[11px] font-normal text-info">always on</span>}
                </b>
                <small className="text-[12px] text-muted-foreground">{card.description}</small>
              </span>
            </button>
          );
        })}
      </div>

      {tierLabels && (
        <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3">
          {(['Member', 'Manager', 'Admin'] as Tier[]).map((t) => (
            <div key={t}>
              <label htmlFor={`tier-label-${t}`} className="mb-[5px] block text-[12px] font-normal text-muted-foreground">{t} tier label</label>
              <Input
                id={`tier-label-${t}`}
                maxLength={100}
                value={labels[t]}
                placeholder={t}
                onChange={(e) => setLabels((l) => ({ ...l, [t]: e.target.value }))}
                className="h-auto px-3 py-[9px] text-[13.5px]"
              />
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>{secondaryAction}</div>
        <Button
          disabled={saving}
          onClick={() => onSave(
            portals.map((p) => ({ key: p.key, enabled: p.key === 'admin' ? true : (enabled[p.key] ?? p.enabled) })),
            tierLabels ? labels : undefined,
          )}
        >
          {saving ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </div>
  );
}

export function LabelsEditor({ portals, onSave, saving, submitLabel, secondaryAction }: {
  portals: PortalConfig[];
  onSave: (changes: { key: string; custom_label: string; tier_labels: Partial<Record<Tier, string>> }[]) => void;
  saving: boolean;
  submitLabel: string;
  secondaryAction?: React.ReactNode;
}) {
  const enabledPortals = portals.filter((p) => p.enabled);
  const [labels, setLabels] = useState<Record<string, { custom: string; tiers: Record<Tier, string> }>>({});
  useEffect(() => {
    setLabels(Object.fromEntries(portals.map((p) => [p.key, {
      custom: p.customLabel ?? '',
      tiers: Object.fromEntries(TIERS.map((t) => [t, p.tierLabels?.[t] ?? ''])) as Record<Tier, string>,
    }])));
  }, [portals]);

  const setCustom = (key: string, value: string) =>
    setLabels((s) => ({ ...s, [key]: { ...s[key], custom: value } }));
  const setTier = (key: string, tier: Tier, value: string) =>
    setLabels((s) => ({ ...s, [key]: { ...s[key], tiers: { ...s[key].tiers, [tier]: value } } }));

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Rename portals and their tiers to match how your company talks, e.g. Sales → "Revenue", Member → "Account Executive".
        Names are for display only. A tier always means the same thing: <strong>Member</strong> works on their own records,
        <strong> Manager</strong> sees their team, <strong>Admin</strong> sees the whole organization. Leave a field blank to keep the default.
      </p>
      <div className="space-y-4">
        {enabledPortals.map((p) => {
          // The Admin portal only has the Admin tier
          const tiers = p.key === 'admin' ? (['Admin'] as Tier[]) : TIERS;
          return (
            <Card key={p.key} className={cn('border-l-4', PORTAL_THEMES[p.key]?.borderAccent)}>
              <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor={`label-${p.key}`} className="text-xs text-muted-foreground">{p.defaultLabel} portal name</Label>
                  <Input
                    id={`label-${p.key}`}
                    maxLength={100}
                    placeholder={p.defaultLabel}
                    value={labels[p.key]?.custom ?? ''}
                    onChange={(e) => setCustom(p.key, e.target.value)}
                  />
                </div>
                {tiers.map((t) => (
                  <div key={t} className="space-y-1.5">
                    <Label htmlFor={`tier-${p.key}-${t}`} className="text-xs text-muted-foreground">{t} tier title</Label>
                    <Input
                      id={`tier-${p.key}-${t}`}
                      maxLength={100}
                      placeholder={t}
                      value={labels[p.key]?.tiers[t] ?? ''}
                      onChange={(e) => setTier(p.key, t, e.target.value)}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>
      <div className="flex items-center justify-between">
        <div>{secondaryAction}</div>
        <Button
          disabled={saving}
          onClick={() => onSave(enabledPortals.map((p) => ({
            key: p.key,
            custom_label: labels[p.key]?.custom.trim() ?? '',
            tier_labels: Object.fromEntries(
              Object.entries(labels[p.key]?.tiers ?? {}).map(([t, v]) => [t, v.trim()]).filter(([, v]) => v),
            ) as Partial<Record<Tier, string>>,
          })))}
        >
          {saving ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </div>
  );
}

// Two restriction dials per (portal, tier): which data groups they see and which
// actions they may take. Entries come from the fixed server catalog, so an org
// can only switch things off, never invent new permissions.
// Tiers in the order Member, Manager (the Admin tier is never restricted)
const sortTiers = <T extends { tier: Tier }>(tiers: T[]) => [...tiers].sort((a, b) => TIERS.indexOf(a.tier) - TIERS.indexOf(b.tier));
const firstTier = (tiers: { tier: Tier }[]): Tier => sortTiers(tiers)[0]?.tier ?? 'Member';

export function PermissionsEditor({ permissions, onSave, saving }: {
  permissions: PortalPermissions[];
  onSave: (changes: PermissionChange[]) => void;
  saving: boolean;
}) {
  const { tierLabel } = usePortals();
  const [draft, setDraft] = useState<PortalPermissions[]>(permissions);
  const [portalKey, setPortalKey] = useState('');
  const [tier, setTier] = useState<Tier>('Member');
  useEffect(() => {
    setDraft(permissions);
    // Keep the current selection when it still exists, else start at the first portal and tier
    const portal = permissions.find((p) => p.key === portalKey) ?? permissions[0];
    if (portal && portal.key !== portalKey) {
      setPortalKey(portal.key);
      setTier(firstTier(portal.tiers));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permissions]);

  const toggle = (kind: 'actions' | 'fields', key: string, value: boolean) =>
    setDraft((d) => d.map((p) => (p.key !== portalKey ? p : {
      ...p,
      tiers: p.tiers.map((t) => (t.tier !== tier ? t : {
        ...t,
        actions: kind === 'actions' ? t.actions.map((a) => (a.key === key ? { ...a, allowed: value } : a)) : t.actions,
        fields: kind === 'fields' ? t.fields.map((f) => (f.key === key ? { ...f, visible: value } : f)) : t.fields,
      })),
    })));

  // Only eligible entries can be overridden; the rest are fixed by the catalog.
  const changes = (): PermissionChange[] => draft.flatMap((p) => p.tiers.map((t) => ({
    portalKey: p.key,
    tier: t.tier,
    actions: Object.fromEntries(t.actions.filter((a) => a.eligible).map((a) => [a.key, a.allowed])),
    fields: Object.fromEntries(t.fields.filter((f) => f.eligible).map((f) => [f.key, f.visible])),
  })));

  if (!draft.length) return <p className="text-sm text-muted-foreground">Enable a portal other than Admin to configure permissions.</p>;

  const portal = draft.find((p) => p.key === portalKey) ?? draft[0];
  const current = portal.tiers.find((t) => t.tier === tier) ?? portal.tiers[0];
  const tierText = (t: Tier) => {
    const label = tierLabel(portal.key, t);
    return label !== t ? `${t} (${label})` : t;
  };
  const selectBox = 'w-[240px] rounded-[8px] border border-input-border bg-card px-3 py-[9px]';
  const selectTrigger = 'w-full border-0 bg-transparent p-0 text-[13.5px] shadow-none focus-visible:ring-0 data-[size=default]:h-auto dark:bg-transparent';

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-4">
        <div className={selectBox}>
          <label className="mb-[5px] block text-[12px] font-normal text-muted-foreground">Portal</label>
          <Select value={portal.key} onValueChange={(key) => { setPortalKey(key); setTier(firstTier(draft.find((p) => p.key === key)?.tiers ?? [])); }}>
            <SelectTrigger aria-label="Portal" className={selectTrigger}><SelectValue /></SelectTrigger>
            <SelectContent>{draft.map((p) => <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className={selectBox}>
          <label className="mb-[5px] block text-[12px] font-normal text-muted-foreground">Tier</label>
          <Select value={current.tier} onValueChange={(t) => setTier(t as Tier)}>
            <SelectTrigger aria-label="Tier" className={selectTrigger}><SelectValue /></SelectTrigger>
            <SelectContent>{sortTiers(portal.tiers).map((t) => <SelectItem key={t.tier} value={t.tier}>{tierText(t.tier)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-[18px] md:flex-row">
        <PermissionList
          title="Field groups"
          caption="Which data this tier can see, in screens and assistant answers"
          items={current.fields.map((f) => ({ key: f.key, label: f.label, on: f.visible, eligible: f.eligible }))}
          idPrefix={`${portal.key}-${current.tier}-field`}
          onToggle={(key, v) => toggle('fields', key, v)}
        />
        <PermissionList
          title="Actions"
          caption="Which operations this tier can perform"
          items={current.actions.map((a) => ({ key: a.key, label: a.label, on: a.allowed, eligible: a.eligible }))}
          idPrefix={`${portal.key}-${current.tier}-action`}
          onToggle={(key, v) => toggle('actions', key, v)}
        />
      </div>

      <div className="mt-[14px] flex items-center justify-between gap-4 text-[12.5px] text-muted-foreground">
        <span>Both lists come from fixed catalogs; entries can be switched on or off but not created.</span>
        <Button disabled={saving} onClick={() => onSave(changes())}>{saving ? 'Saving…' : 'Save changes'}</Button>
      </div>
    </div>
  );
}

function PermissionList({ title, caption, items, idPrefix, onToggle }: {
  title: string;
  caption: string;
  items: { key: string; label: string; on: boolean; eligible: boolean }[];
  idPrefix: string;
  onToggle: (key: string, value: boolean) => void;
}) {
  return (
    <div className="flex-1 rounded-[10px] border border-border bg-card px-4 py-[14px]">
      <h3 className="mb-1 text-[15px] font-bold tracking-normal">{title}</h3>
      <p className="mb-[10px] text-[12.5px] text-muted-foreground">{caption}</p>
      {items.map((item) => (
        <div key={item.key} className="flex items-center justify-between gap-3 border-b border-row-divider py-[10px] text-[13.5px]">
          <label htmlFor={`${idPrefix}-${item.key}`} className={cn('text-[13.5px] font-normal', !item.eligible && 'text-muted-foreground')}>
            {item.label}
          </label>
          <Switch
            id={`${idPrefix}-${item.key}`}
            checked={item.on}
            disabled={!item.eligible}
            title={item.eligible ? undefined : 'Not available for this tier'}
            onCheckedChange={(v) => onToggle(item.key, v)}
          />
        </div>
      ))}
    </div>
  );
}
