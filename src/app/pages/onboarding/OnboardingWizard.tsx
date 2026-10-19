import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Check } from 'lucide-react';
import { useAuth, nextRouteFor, useOrgPath } from '../../context/AuthContext';
import { apiFetch } from '../../utils/api';
import type { Organization, PortalConfig } from '../../types/crm';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { cn } from '../../components/ui/utils';
import { SetupShell } from './SetupShell';
import { LabelsEditor, PortalsEditor } from './PortalEditors';
import { EmployeesStep } from './EmployeesStep';

interface WizardState {
  step: 'portals' | 'labels' | 'employees' | 'review' | 'done';
  completed: boolean;
  organization: Organization;
  portals: PortalConfig[];
  employees: { id: number; first_name: string; last_name: string; email: string; portal_key: string; department: string | null; tier: string }[];
  departments: { id: number; name: string }[];
}

const STEPS = [
  { key: 'portals', title: 'Portals', hint: 'Choose the workspaces your company needs.' },
  { key: 'labels', title: 'Team names', hint: 'Optionally rename portals and role titles.' },
  { key: 'employees', title: 'Employees', hint: 'Invite your team.' },
  { key: 'review', title: 'Review', hint: 'Check everything and finish.' },
] as const;
type StepKey = typeof STEPS[number]['key'];

export function OnboardingWizard() {
  const { user, isLoading, applySession } = useAuth();
  const navigate = useNavigate();
  const to = useOrgPath();
  const [state, setState] = useState<WizardState | null>(null);
  const [view, setView] = useState<StepKey>('portals');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!user) { navigate(to('/login')); return; }
    const next = nextRouteFor(user);
    if (next !== to('/onboarding')) navigate(next);
  }, [user, isLoading, navigate, to]);

  const load = useCallback(async (resume: boolean) => {
    try {
      const res = await apiFetch('/onboarding/state');
      setState(res.data);
      if (resume) setView(res.data.step === 'done' ? 'review' : res.data.step);
    } catch (error: any) {
      toast.error(error.message || 'Could not load setup');
    }
  }, []);

  useEffect(() => {
    if (user?.role === 'admin' && user.onboardingCompleted === false) load(true);
  }, [user?.role, user?.onboardingCompleted, load]);

  // Save a step, keep the session's portal labels in sync, and move on.
  const save = async (url: string, body: unknown, nextView: StepKey) => {
    setSaving(true);
    try {
      const res = await apiFetch(url, { method: url.endsWith('/skip') ? 'POST' : 'PUT', body: JSON.stringify(body) });
      setState(res.data);
      applySession({ ...user, portals: res.data.portals });
      setView(nextView);
    } catch (error: any) {
      toast.error(error.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const finish = async () => {
    setSaving(true);
    try {
      const res = await apiFetch('/onboarding/complete', { method: 'POST' });
      applySession(res.data);
      toast.success('Your organization is ready');
      navigate(to('/clock-in'));
    } catch (error: any) {
      toast.error(error.message || 'Could not finish setup');
    } finally {
      setSaving(false);
    }
  };

  if (!user || !state) {
    return <SetupShell title="Setting up…" wide><div className="animate-pulse text-muted-foreground">Loading…</div></SetupShell>;
  }

  const current = STEPS.findIndex((s) => s.key === view);
  const reached = STEPS.findIndex((s) => s.key === (state.step === 'done' ? 'review' : state.step));
  const labelOf = (key: string) => state.portals.find((p) => p.key === key)?.label ?? key;
  const tierOf = (key: string, tier: string) =>
    state.portals.find((p) => p.key === key)?.tierLabels?.[tier as keyof PortalConfig['tierLabels']] || tier;

  return (
    <SetupShell title={`Set up ${state.organization.name}`} subtitle={STEPS[current].hint} wide>
      <ol className="mb-8 grid grid-cols-4 gap-2">
        {STEPS.map((s, i) => {
          const done = i < current;
          const clickable = i <= reached && !saving;
          return (
            <li key={s.key}>
              <button
                type="button"
                disabled={!clickable}
                onClick={() => setView(s.key)}
                className={cn(
                  'w-full text-left rounded-lg border-t-4 pt-2 text-sm transition-colors',
                  i === current ? 'border-blue-600 text-foreground font-medium' : done ? 'border-blue-300 text-muted-foreground' : 'border-gray-200 text-muted-foreground',
                  clickable ? 'cursor-pointer' : 'cursor-default',
                )}
              >
                <span className="flex items-center gap-1.5">
                  {done && <Check className="h-3.5 w-3.5 text-blue-600" />}
                  {i + 1}. {s.title}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {view === 'portals' && (
        <PortalsEditor
          portals={state.portals}
          saving={saving}
          submitLabel="Continue"
          onSave={(portals) => save('/onboarding/portals', { portals }, 'labels')}
        />
      )}

      {view === 'labels' && (
        <LabelsEditor
          portals={state.portals}
          saving={saving}
          submitLabel="Continue"
          secondaryAction={<Button variant="ghost" onClick={() => setView('portals')}>Back</Button>}
          onSave={(portals) => save('/onboarding/labels', { portals }, 'employees')}
        />
      )}

      {view === 'employees' && (
        <EmployeesStep
          portals={state.portals}
          departments={state.departments}
          onBack={() => setView('labels')}
          onSkip={() => save('/onboarding/employees/skip', {}, 'review')}
          onCreated={async () => { await load(false); setView('review'); }}
        />
      )}

      {view === 'review' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Organization</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-1">
                <div className="font-medium">{state.organization.name}</div>
                {state.organization.industry && <div className="text-muted-foreground">{state.organization.industry}</div>}
                {state.organization.size && <div className="text-muted-foreground">{state.organization.size} employees</div>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Enabled portals</CardTitle></CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {state.portals.filter((p) => p.enabled).map((p) => (
                  <Badge key={p.key} variant="secondary">
                    {p.label}
                  </Badge>
                ))}
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader><CardTitle className="text-base">Team ({state.employees.length})</CardTitle></CardHeader>
            <CardContent>
              <ul className="divide-y text-sm">
                {state.employees.map((e) => (
                  <li key={e.id} className="flex items-center justify-between py-2">
                    <span>{e.first_name} {e.last_name} <span className="text-muted-foreground">· {e.email}</span></span>
                    <Badge variant="outline">{labelOf(e.portal_key)} · {tierOf(e.portal_key, e.tier)}</Badge>
                  </li>
                ))}
              </ul>
              <Button variant="link" className="px-0" onClick={() => setView('employees')}>Add more employees</Button>
            </CardContent>
          </Card>
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => setView('employees')}>Back</Button>
            <Button onClick={finish} disabled={saving}>{saving ? 'Finishing…' : 'Finish setup'}</Button>
          </div>
        </div>
      )}
    </SetupShell>
  );
}
