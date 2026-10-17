import { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import type { PortalConfig, Tier } from '../../types/crm';
import { PORTAL_THEMES } from '../../styles/portal-themes';
import { Checkbox } from '../../components/ui/checkbox';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent } from '../../components/ui/card';
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
