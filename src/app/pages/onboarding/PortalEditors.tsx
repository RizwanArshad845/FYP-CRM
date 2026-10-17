import { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import type { PermissionChange, PortalConfig, PortalPermissions, Tier } from '../../types/crm';
import { PORTAL_THEMES } from '../../styles/portal-themes';
import { usePortals } from '../../hooks/usePortals';
import { Checkbox } from '../../components/ui/checkbox';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent } from '../../components/ui/card';
import { Switch } from '../../components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { cn } from '../../components/ui/utils';

export const TIERS: Tier[] = ['Member', 'Manager', 'Admin'];

// Used by both the onboarding wizard and Organization Settings.

export function PortalsEditor({ portals, onSave, saving, submitLabel, secondaryAction }: {
  portals: PortalConfig[];
  onSave: (changes: { key: string; enabled: boolean }[]) => void;
  saving: boolean;
  submitLabel: string;
  secondaryAction?: React.ReactNode;
}) {
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  useEffect(() => {
    setEnabled(Object.fromEntries(portals.map((p) => [p.key, p.enabled])));
  }, [portals]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {portals.map((p) => {
          const locked = p.key === 'admin';
          const on = enabled[p.key] ?? p.enabled;
          return (
            <label
              key={p.key}
              htmlFor={`portal-${p.key}`}
              className={cn(
                'flex gap-3 rounded-xl border bg-card p-4 transition-colors border-l-4',
                PORTAL_THEMES[p.key]?.borderAccent,
                on ? 'shadow-sm' : 'opacity-60',
                locked ? 'cursor-default' : 'cursor-pointer hover:bg-accent/40',
              )}
            >
              <Checkbox
                id={`portal-${p.key}`}
                checked={on}
                disabled={locked}
                onCheckedChange={(v) => setEnabled((s) => ({ ...s, [p.key]: Boolean(v) }))}
                className="mt-0.5"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{p.defaultLabel}</span>
                  <Badge variant="secondary" className="text-[10px]">default: {p.defaultTier}</Badge>
                  {locked && <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-label="Always enabled" />}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
              </div>
            </label>
          );
        })}
      </div>
      <div className="flex items-center justify-between">
        <div>{secondaryAction}</div>
        <Button
          disabled={saving}
          onClick={() => onSave(portals.map((p) => ({ key: p.key, enabled: p.key === 'admin' ? true : (enabled[p.key] ?? p.enabled) })))}
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
export function PermissionsEditor({ permissions, onSave, saving }: {
  permissions: PortalPermissions[];
  onSave: (changes: PermissionChange[]) => void;
  saving: boolean;
}) {
  const { tierLabel } = usePortals();
  const [draft, setDraft] = useState<PortalPermissions[]>(permissions);
  useEffect(() => setDraft(permissions), [permissions]);

  const toggle = (portalKey: string, tier: Tier, kind: 'actions' | 'fields', key: string, value: boolean) =>
    setDraft((d) => d.map((p) => (p.key !== portalKey ? p : {
      ...p,
      tiers: p.tiers.map((t) => (t.tier !== tier ? t : {
        ...t,
        actions: kind === 'actions' ? t.actions.map((a) => (a.key === key ? { ...a, allowed: value } : a)) : t.actions,
        fields: kind === 'fields' ? t.fields.map((f) => (f.key === key ? { ...f, visible: value } : f)) : t.fields,
      })),
    })));

  const changes = (): PermissionChange[] => draft.flatMap((p) => p.tiers.map((t) => ({
    portalKey: p.key,
    tier: t.tier,
    actions: Object.fromEntries(t.actions.map((a) => [a.key, a.allowed])),
    fields: Object.fromEntries(t.fields.map((f) => [f.key, f.visible])),
  })));

  if (!draft.length) return <p className="text-sm text-muted-foreground">Enable a portal other than Admin to configure permissions.</p>;

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Restrict what each tier can see and do. Everything is on by default and nothing here can grant more than the tier
        already allows. Admins are never restricted.
      </p>
      <div className="space-y-4">
        {draft.map((p) => (
          <Card key={p.key} className={cn('border-l-4', PORTAL_THEMES[p.key]?.borderAccent)}>
            <CardContent className="pt-6 space-y-3">
              <h3 className="font-semibold">{p.label}</h3>
              <Tabs defaultValue={p.tiers[0]?.tier}>
                <TabsList>
                  {p.tiers.map((t) => <TabsTrigger key={t.tier} value={t.tier}>{tierLabel(p.key, t.tier)}</TabsTrigger>)}
                </TabsList>
                {p.tiers.map((t) => (
                  <TabsContent key={t.tier} value={t.tier} className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                    <PermissionList
                      title="Can see"
                      items={t.fields.map((f) => ({ key: f.key, label: f.label, on: f.visible }))}
                      idPrefix={`${p.key}-${t.tier}-field`}
                      onToggle={(key, v) => toggle(p.key, t.tier, 'fields', key, v)}
                    />
                    <PermissionList
                      title="Can do"
                      items={t.actions.map((a) => ({ key: a.key, label: a.label, on: a.allowed }))}
                      idPrefix={`${p.key}-${t.tier}-action`}
                      onToggle={(key, v) => toggle(p.key, t.tier, 'actions', key, v)}
                    />
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="flex justify-end">
        <Button disabled={saving} onClick={() => onSave(changes())}>{saving ? 'Saving…' : 'Save permissions'}</Button>
      </div>
    </div>
  );
}

function PermissionList({ title, items, idPrefix, onToggle }: {
  title: string;
  items: { key: string; label: string; on: boolean }[];
  idPrefix: string;
  onToggle: (key: string, value: boolean) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      {items.length === 0 && <p className="text-sm text-muted-foreground">Nothing to configure.</p>}
      {items.map((item) => (
        <div key={item.key} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
          <Label htmlFor={`${idPrefix}-${item.key}`} className="font-normal">{item.label}</Label>
          <Switch id={`${idPrefix}-${item.key}`} checked={item.on} onCheckedChange={(v) => onToggle(item.key, v)} />
        </div>
      ))}
    </div>
  );
}
