import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../utils/api';
import type { Organization, PortalConfig } from '../../types/crm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Button } from '../../components/ui/button';
import { LabelsEditor, PortalsEditor } from '../onboarding/PortalEditors';

// Re-exposes the onboarding portal and naming steps after setup.
export function OrganizationSettings() {
  const { user, applySession } = useAuth();
  const [org, setOrg] = useState<Organization | null>(null);
  const [portals, setPortals] = useState<PortalConfig[]>([]);
  const [details, setDetails] = useState({ name: '', industry: '', size: '' });
  const [saving, setSaving] = useState<'details' | 'portals' | 'labels' | null>(null);

  const apply = (data: { organization: Organization; portals: PortalConfig[] }) => {
    setOrg(data.organization);
    setPortals(data.portals);
    setDetails({ name: data.organization.name, industry: data.organization.industry ?? '', size: data.organization.size ?? '' });
    // Keep sidebar/labels in sync without a reload
    applySession({ ...user, organization: data.organization, portals: data.portals });
  };

  useEffect(() => {
    apiFetch('/organization')
      .then((res) => apply(res.data))
      .catch((error) => toast.error(error.message || 'Could not load organization settings'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async (kind: 'details' | 'portals' | 'labels', url: string, body: unknown) => {
    setSaving(kind);
    try {
      const res = await apiFetch(url, { method: 'PUT', body: JSON.stringify(body) });
      apply(res.data);
      toast.success('Saved');
    } catch (error: any) {
      toast.error(error.message || 'Could not save');
    } finally {
      setSaving(null);
    }
  };

  if (!org) return <div className="p-6 text-muted-foreground animate-pulse">Loading organization…</div>;

  return (
    <div className="space-y-6 p-1">
      <Card>
        <CardHeader>
          <CardTitle>Organization details</CardTitle>
          <CardDescription>Shown in the sidebar for everyone in {org.name}.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end"
            onSubmit={(e) => {
              e.preventDefault();
              save('details', '/organization', { name: details.name, industry: details.industry || null, size: details.size || null });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="org-name">Name</Label>
              <Input id="org-name" required minLength={2} value={details.name} onChange={(e) => setDetails({ ...details, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-industry">Industry</Label>
              <Input id="org-industry" value={details.industry} onChange={(e) => setDetails({ ...details, industry: e.target.value })} />
            </div>
            <div className="flex gap-3 items-end">
              <div className="space-y-2 flex-1">
                <Label htmlFor="org-size">Size</Label>
                <Input id="org-size" value={details.size} onChange={(e) => setDetails({ ...details, size: e.target.value })} />
              </div>
              <Button type="submit" disabled={saving === 'details'}>{saving === 'details' ? 'Saving…' : 'Save'}</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Portals</CardTitle>
          <CardDescription>
            Turn workspaces on or off. A portal can't be turned off while active employees are assigned to it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PortalsEditor
            portals={portals}
            saving={saving === 'portals'}
            submitLabel="Save portals"
            onSave={(changes) => save('portals', '/organization/portals', { portals: changes })}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Team names</CardTitle>
        </CardHeader>
        <CardContent>
          <LabelsEditor
            portals={portals}
            saving={saving === 'labels'}
            submitLabel="Save names"
            onSave={(changes) => save('labels', '/organization/labels', { portals: changes })}
          />
        </CardContent>
      </Card>
    </div>
  );
}
