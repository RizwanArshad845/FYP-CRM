import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, Pencil, Plus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useClients } from '../../context/ClientContext';
import { apiFetch } from '../../utils/api';
import type {
  FieldDefinition, Organization, PermissionChange, PipelineStage, PortalConfig, PortalPermissions,
} from '../../types/crm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Button } from '../../components/ui/button';
import { Textarea } from '../../components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '../../components/ui/dialog';
import { LabelsEditor, PermissionsEditor, PortalsEditor } from '../onboarding/PortalEditors';

// Settings tabs of Figure 4.6: navy active tab, white inactive tabs with a border.
const TAB_CLASS = 'flex-none h-auto rounded-[8px] border border-border bg-card px-[14px] py-2 text-[13px] font-normal text-foreground shadow-none data-[state=active]:border-navy data-[state=active]:bg-navy data-[state=active]:text-white dark:data-[state=active]:bg-navy dark:data-[state=active]:border-navy';

const FIELD_TYPE_LABELS: Record<FieldDefinition['field_type'], string> = {
  text: 'Text', number: 'Number', dropdown: 'Dropdown', date: 'Date', checkbox: 'Checkbox',
};

// One option per line (commas also work), trimmed, blanks dropped.
const parseOptions = (text: string) => text.split(/[\n,]/).map((o) => o.trim()).filter(Boolean);

// Moves item `i` one place up or down and returns the new id order.
const moved = <T extends { id: number }>(list: T[], i: number, dir: -1 | 1) => {
  const ids = list.map((x) => x.id);
  [ids[i], ids[i + dir]] = [ids[i + dir], ids[i]];
  return ids;
};

function OrderButtons({ index, count, onMove, disabled }: {
  index: number; count: number; onMove: (dir: -1 | 1) => void; disabled: boolean;
}) {
  return (
    <div className="flex gap-1">
      <Button variant="outline" size="icon" aria-label="Move up" disabled={disabled || index === 0} onClick={() => onMove(-1)}>
        <ArrowUp className="h-4 w-4" />
      </Button>
      <Button variant="outline" size="icon" aria-label="Move down" disabled={disabled || index === count - 1} onClick={() => onMove(1)}>
        <ArrowDown className="h-4 w-4" />
      </Button>
    </div>
  );
}

// Custom client fields (plan 6.1): add, edit name/options, reorder. No delete.
function CustomFieldsEditor() {
  const { fetchData: refreshClients } = useClients();
  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<{ field?: FieldDefinition; name: string; type: FieldDefinition['field_type']; options: string } | null>(null);

  useEffect(() => {
    apiFetch('/organization/custom-fields')
      .then((res) => setFields(res.data))
      .catch((error) => toast.error(error.message || 'Could not load custom fields'));
  }, []);

  const run = async (request: () => Promise<any>, onDone: (data: any) => void, message: string) => {
    setBusy(true);
    try {
      const res = await request();
      onDone(res.data);
      refreshClients();
      toast.success(message);
      return true;
    } catch (error: any) {
      toast.error(error.message || 'Could not save');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const reorder = (ids: number[]) => run(
    () => apiFetch('/organization/custom-fields/order', { method: 'PUT', body: JSON.stringify({ ids }) }),
    setFields, 'Order saved',
  );

  const submitDialog = async () => {
    if (!dialog) return;
    const options = parseOptions(dialog.options);
    const ok = dialog.field
      ? await run(
        () => apiFetch(`/organization/custom-fields/${dialog.field!.id}`, {
          method: 'PUT',
          body: JSON.stringify({ field_name: dialog.name, ...(dialog.type === 'dropdown' && { options }) }),
        }),
        (row) => setFields((fs) => fs.map((f) => (f.id === row.id ? row : f))), 'Field saved',
      )
      : await run(
        () => apiFetch('/organization/custom-fields', {
          method: 'POST',
          body: JSON.stringify({ field_name: dialog.name, field_type: dialog.type, ...(dialog.type === 'dropdown' && { options }) }),
        }),
        (row) => setFields((fs) => [...fs, row]), 'Field added',
      );
    if (ok) setDialog(null);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle>Custom fields</CardTitle>
          <CardDescription>Extra fields shown under "Additional fields" on client forms.</CardDescription>
        </div>
        <Button onClick={() => setDialog({ name: '', type: 'text', options: '' })}><Plus className="h-4 w-4" />Add field</Button>
      </CardHeader>
      <CardContent>
        {fields.length === 0 ? (
          <p className="text-sm text-muted-foreground">No custom fields yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Options</TableHead><TableHead>Order</TableHead><TableHead /></TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((f, i) => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">{f.field_name}</TableCell>
                  <TableCell>{FIELD_TYPE_LABELS[f.field_type]}</TableCell>
                  <TableCell className="whitespace-normal text-muted-foreground">{f.options?.join(', ') || '—'}</TableCell>
                  <TableCell><OrderButtons index={i} count={fields.length} disabled={busy} onMove={(dir) => reorder(moved(fields, i, dir))} /></TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => setDialog({ field: f, name: f.field_name, type: f.field_type, options: (f.options ?? []).join('\n') })}>
                      <Pencil className="h-4 w-4" />Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={!!dialog} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{dialog?.field ? 'Edit field' : 'Add field'}</DialogTitle>
            <DialogDescription>The name is the label shown on client forms.</DialogDescription>
          </DialogHeader>
          {dialog && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cf-name">Name</Label>
                <Input id="cf-name" maxLength={100} value={dialog.name} onChange={(e) => setDialog({ ...dialog, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={dialog.type} disabled={!!dialog.field} onValueChange={(type) => setDialog({ ...dialog, type: type as FieldDefinition['field_type'] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(FIELD_TYPE_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {dialog.type === 'dropdown' && (
                <div className="space-y-2">
                  <Label htmlFor="cf-options">Options (one per line)</Label>
                  <Textarea id="cf-options" rows={4} value={dialog.options} onChange={(e) => setDialog({ ...dialog, options: e.target.value })} />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button disabled={busy || !dialog?.name.trim()} onClick={submitDialog}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// Pipeline stages (plan 6.2): add, rename, reorder. No delete.
function PipelineStagesEditor() {
  const { fetchData: refreshClients } = useClients();
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [names, setNames] = useState<Record<number, string>>({});
  const [newStage, setNewStage] = useState('');
  const [busy, setBusy] = useState(false);

  const apply = (list: PipelineStage[]) => {
    setStages(list);
    setNames(Object.fromEntries(list.map((s) => [s.id, s.stage_name])));
  };

  useEffect(() => {
    apiFetch('/organization/pipeline-stages')
      .then((res) => apply(res.data))
      .catch((error) => toast.error(error.message || 'Could not load stages'));
  }, []);

  const run = async (request: () => Promise<any>, onDone: (data: any) => void, message: string) => {
    setBusy(true);
    try {
      const res = await request();
      onDone(res.data);
      refreshClients();
      toast.success(message);
    } catch (error: any) {
      toast.error(error.message || 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  const add = () => run(
    () => apiFetch('/organization/pipeline-stages', { method: 'POST', body: JSON.stringify({ stage_name: newStage }) }),
    (row) => { apply([...stages, row]); setNewStage(''); }, 'Stage added',
  );
  const rename = (stage: PipelineStage) => run(
    () => apiFetch(`/organization/pipeline-stages/${stage.id}`, { method: 'PUT', body: JSON.stringify({ stage_name: names[stage.id] }) }),
    (row) => apply(stages.map((s) => (s.id === row.id ? row : s))), 'Stage renamed',
  );
  const reorder = (ids: number[]) => run(
    () => apiFetch('/organization/pipeline-stages/order', { method: 'PUT', body: JSON.stringify({ ids }) }),
    apply, 'Order saved',
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pipeline stages</CardTitle>
        <CardDescription>Columns of the client Kanban board, in order. Moving a client between stages never changes its status.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {stages.length === 0 && <p className="text-sm text-muted-foreground">No stages yet.</p>}
        <ol className="space-y-2">
          {stages.map((s, i) => {
            const changed = (names[s.id] ?? '').trim() !== s.stage_name;
            return (
              <li key={s.id} className="flex items-center gap-3">
                <span className="w-6 text-right text-sm text-muted-foreground">{i + 1}.</span>
                <Input aria-label="Stage name" maxLength={100} className="max-w-sm" value={names[s.id] ?? ''} onChange={(e) => setNames({ ...names, [s.id]: e.target.value })} />
                <Button variant="outline" size="sm" disabled={busy || !changed || !(names[s.id] ?? '').trim()} onClick={() => rename(s)}>Rename</Button>
                <OrderButtons index={i} count={stages.length} disabled={busy} onMove={(dir) => reorder(moved(stages, i, dir))} />
              </li>
            );
          })}
        </ol>
        <form className="flex items-center gap-3" onSubmit={(e) => { e.preventDefault(); add(); }}>
          <Input aria-label="New stage" maxLength={100} className="max-w-sm" placeholder="New stage name" value={newStage} onChange={(e) => setNewStage(e.target.value)} />
          <Button type="submit" disabled={busy || !newStage.trim()}><Plus className="h-4 w-4" />Add stage</Button>
        </form>
      </CardContent>
    </Card>
  );
}

// Organization Settings (Figure 4.6): four tabs reusing the onboarding editors.
export function OrganizationSettings() {
  const { user, applySession } = useAuth();
  const [org, setOrg] = useState<Organization | null>(null);
  const [portals, setPortals] = useState<PortalConfig[]>([]);
  const [details, setDetails] = useState({ name: '', industry: '', size: '' });
  const [permissions, setPermissions] = useState<PortalPermissions[]>([]);
  const [saving, setSaving] = useState<'details' | 'portals' | 'labels' | 'permissions' | null>(null);

  const apply = (data: { organization: Organization; portals: PortalConfig[] }) => {
    setOrg(data.organization);
    setPortals(data.portals);
    setDetails({ name: data.organization.name, industry: data.organization.industry ?? '', size: data.organization.size ?? '' });
    // Keep sidebar/labels in sync without a reload
    applySession({ ...user, organization: data.organization, portals: data.portals });
  };

  const loadPermissions = () =>
    apiFetch('/organization/permissions')
      .then((res) => setPermissions(res.data))
      .catch((error) => toast.error(error.message || 'Could not load permissions'));

  useEffect(() => {
    apiFetch('/organization')
      .then((res) => apply(res.data))
      .catch((error) => toast.error(error.message || 'Could not load organization settings'));
    loadPermissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async (kind: 'details' | 'portals' | 'labels', url: string, body: unknown) => {
    setSaving(kind);
    try {
      const res = await apiFetch(url, { method: 'PUT', body: JSON.stringify(body) });
      apply(res.data);
      // Enabling/disabling portals changes which permission cards exist
      if (kind === 'portals') loadPermissions();
      toast.success('Saved');
    } catch (error: any) {
      toast.error(error.message || 'Could not save');
    } finally {
      setSaving(null);
    }
  };

  const savePermissions = async (changes: PermissionChange[]) => {
    setSaving('permissions');
    try {
      const res = await apiFetch('/organization/permissions', { method: 'PUT', body: JSON.stringify({ permissions: changes }) });
      setPermissions(res.data);
      toast.success('Permissions saved');
    } catch (error: any) {
      toast.error(error.message || 'Could not save permissions');
    } finally {
      setSaving(null);
    }
  };

  if (!org) return <div className="p-6 text-muted-foreground animate-pulse">Loading organization…</div>;

  return (
    <Tabs defaultValue="portals" className="gap-4">
      <TabsList className="h-auto gap-[6px] bg-transparent p-0">
        <TabsTrigger value="portals" className={TAB_CLASS}>Portals and Labels</TabsTrigger>
        <TabsTrigger value="fields" className={TAB_CLASS}>Custom Fields</TabsTrigger>
        <TabsTrigger value="stages" className={TAB_CLASS}>Pipeline Stages</TabsTrigger>
        <TabsTrigger value="permissions" className={TAB_CLASS}>Permissions</TabsTrigger>
      </TabsList>

      <TabsContent value="portals" className="space-y-6">
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
      </TabsContent>

      <TabsContent value="fields"><CustomFieldsEditor /></TabsContent>

      <TabsContent value="stages"><PipelineStagesEditor /></TabsContent>

      <TabsContent value="permissions">
        <Card>
          <CardHeader>
            <CardTitle>Permissions</CardTitle>
            <CardDescription>What each tier can see and do in its portal.</CardDescription>
          </CardHeader>
          <CardContent>
            <PermissionsEditor permissions={permissions} saving={saving === 'permissions'} onSave={savePermissions} />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
