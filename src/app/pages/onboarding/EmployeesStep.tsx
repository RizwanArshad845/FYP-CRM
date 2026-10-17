import { useRef, useState } from 'react';
import Papa from 'papaparse';
import { toast } from 'sonner';
import { Copy, Download, Plus, Trash2, Upload } from 'lucide-react';
import type { PortalConfig, Tier } from '../../types/crm';
import { TIERS } from './PortalEditors';
import { apiFetch, ApiError } from '../../utils/api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert';

interface Row { first_name: string; last_name: string; email: string; portal_key: string; tier: string; department: string }
interface Created { id: number; first_name: string; last_name: string; email: string; portal_key: string; tier: Tier; tempPassword: string }

const emptyRow = (portal_key = '', tier = ''): Row => ({ first_name: '', last_name: '', email: '', portal_key, tier, department: '' });
const NO_DEPARTMENT = '__none__';

// Header names accepted in an uploaded CSV, mapped to row fields.
const CSV_HEADERS: Record<string, keyof Row> = {
  first_name: 'first_name', firstname: 'first_name', 'first name': 'first_name',
  last_name: 'last_name', lastname: 'last_name', 'last name': 'last_name',
  email: 'email', 'email address': 'email',
  portal: 'portal_key', portal_key: 'portal_key', role: 'portal_key',
  tier: 'tier', level: 'tier',
  department: 'department',
};

export function EmployeesStep({ portals, departments, onCreated, onSkip, onBack }: {
  portals: PortalConfig[];
  departments: { id: number; name: string }[];
  onCreated: () => void;
  onSkip: () => void;
  onBack: () => void;
}) {
  const assignable = portals.filter((p) => p.enabled && p.key !== 'admin');
  const defaultPortal = assignable[0]?.key ?? '';
  const portalOf = (key: string) => portals.find((p) => p.key === key);
  const defaultTierOf = (key: string) => portalOf(key)?.defaultTier ?? 'Member';
  // "Account Executive (Member)" when the org renamed the tier, else just "Member"
  const tierName = (key: string, tier: string) => {
    const custom = portalOf(key)?.tierLabels?.[tier as Tier];
    return custom ? `${custom} (${tier})` : tier;
  };
  const newRow = (portal = defaultPortal) => emptyRow(portal, defaultTierOf(portal));
  const [rows, setRows] = useState<Row[]>([newRow()]);
  const [rowErrors, setRowErrors] = useState<{ row: number; error: string }[]>([]);
  const [created, setCreated] = useState<Created[] | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Accept either the portal key or any label the org uses for it.
  const resolvePortal = (value: string) => {
    const v = value.trim().toLowerCase();
    const match = portals.find((p) => [p.key, p.label, p.defaultLabel].some((n) => n.toLowerCase() === v));
    return match?.key ?? value.trim();
  };

  const updateRow = (i: number, field: keyof Row, value: string) =>
    setRows((rs) => rs.map((r, idx) => {
      if (idx !== i) return r;
      // A new portal starts at that portal's default tier
      return field === 'portal_key' ? { ...r, portal_key: value, tier: defaultTierOf(value) } : { ...r, [field]: value };
    }));

  // Accept "manager", "Manager" or the org's own tier title (e.g. "Team Lead")
  const resolveTier = (portalKey: string, value: string) => {
    const v = value.trim().toLowerCase();
    const match = TIERS.find((t) => t.toLowerCase() === v || portalOf(portalKey)?.tierLabels?.[t]?.toLowerCase() === v);
    return match ?? value.trim();
  };

  const handleCsv = (file: File) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
      complete: ({ data, errors }) => {
        if (errors.length) toast.warning(`Some CSV lines could not be read (${errors.length})`);
        const parsed = data.map((raw) => {
          const row = emptyRow();
          for (const [header, value] of Object.entries(raw)) {
            const field = CSV_HEADERS[header];
            if (field) row[field] = String(value ?? '').trim();
          }
          row.portal_key = row.portal_key ? resolvePortal(row.portal_key) : defaultPortal;
          row.tier = row.tier ? resolveTier(row.portal_key, row.tier) : defaultTierOf(row.portal_key);
          return row;
        }).filter((r) => r.first_name || r.last_name || r.email);
        if (!parsed.length) return toast.error('No employees found. Expected columns: first_name, last_name, email, portal, tier, department');
        setRows(parsed);
        setRowErrors([]);
        toast.success(`Loaded ${parsed.length} employee(s) from CSV. Review and submit.`);
      },
    });
  };

  const submit = async () => {
    const filled = rows.filter((r) => r.first_name || r.last_name || r.email);
    if (!filled.length) return toast.error('Add at least one employee, or skip this step');
    setSaving(true);
    setRowErrors([]);
    try {
      const res = await apiFetch('/onboarding/employees', {
        method: 'POST',
        body: JSON.stringify({
          employees: filled.map((r) => ({ ...r, department: r.department || null })),
        }),
      });
      setRows(filled);
      setCreated(res.data.created);
    } catch (error) {
      // The API reports problems per row; rows are 1-based in the submitted list
      const details = error instanceof ApiError ? error.body?.rowErrors : undefined;
      if (details) setRowErrors(details);
      setRows(filled);
      toast.error((error as Error).message || 'Could not add employees');
    } finally {
      setSaving(false);
    }
  };

  const credentialsCsv = () =>
    Papa.unparse((created ?? []).map((c) => ({
      first_name: c.first_name, last_name: c.last_name, email: c.email, portal: c.portal_key, tier: c.tier, temporary_password: c.tempPassword,
    })));

  const download = () => {
    const blob = new Blob([credentialsCsv()], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'employee-temporary-passwords.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (created) {
    return (
      <div className="space-y-6">
        <Alert>
          <AlertTitle>Save these temporary passwords now</AlertTitle>
          <AlertDescription>
            They are shown only once. Share each one privately with its employee; they'll be asked to choose a new password at first sign-in.
          </AlertDescription>
        </Alert>
        <div>
          <Table>
            <TableHeader>
              <TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Portal</TableHead><TableHead>Tier</TableHead><TableHead>Temporary password</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {created.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{c.first_name} {c.last_name}</TableCell>
                  <TableCell>{c.email}</TableCell>
                  <TableCell>{portals.find((p) => p.key === c.portal_key)?.label ?? c.portal_key}</TableCell>
                  <TableCell>{tierName(c.portal_key, c.tier)}</TableCell>
                  <TableCell className="font-mono">{c.tempPassword}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={() => navigator.clipboard.writeText(credentialsCsv()).then(() => toast.success('Copied'))}>
              <Copy className="h-4 w-4" /> Copy
            </Button>
            <Button variant="outline" className="gap-2" onClick={download}>
              <Download className="h-4 w-4" /> Download CSV
            </Button>
          </div>
          <Button onClick={onCreated}>Continue</Button>
        </div>
      </div>
    );
  }

  const errorFor = (i: number) => rowErrors.filter((e) => e.row === i + 1).map((e) => e.error).join('; ');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Add people one by one or upload a CSV with columns <code>first_name, last_name, email, portal, tier, department</code>.
        </p>
        <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCsv(f); e.target.value = ''; }} />
        <Button variant="outline" className="gap-2" onClick={() => fileRef.current?.click()}>
          <Upload className="h-4 w-4" /> Upload CSV
        </Button>
      </div>

      {rowErrors.length > 0 && (
        <Alert variant="destructive">
          <AlertTitle>Nothing was created</AlertTitle>
          <AlertDescription>Fix the highlighted rows and submit again.</AlertDescription>
        </Alert>
      )}

      <div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>First name</TableHead><TableHead>Last name</TableHead><TableHead>Email</TableHead>
              <TableHead>Portal</TableHead><TableHead>Tier</TableHead><TableHead>Department</TableHead><TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => {
              const err = errorFor(i);
              return (
                <TableRow key={i} className={err ? 'bg-destructive/5' : undefined}>
                  <TableCell><Input aria-label="First name" value={r.first_name} onChange={(e) => updateRow(i, 'first_name', e.target.value)} /></TableCell>
                  <TableCell><Input aria-label="Last name" value={r.last_name} onChange={(e) => updateRow(i, 'last_name', e.target.value)} /></TableCell>
                  <TableCell>
                    <Input aria-label="Email" type="email" value={r.email} onChange={(e) => updateRow(i, 'email', e.target.value)} />
                    {err && <p className="mt-1 text-xs text-destructive">{err}</p>}
                  </TableCell>
                  <TableCell>
                    <Select value={r.portal_key} onValueChange={(v) => updateRow(i, 'portal_key', v)}>
                      <SelectTrigger aria-label="Portal" className="min-w-36"><SelectValue placeholder="Portal" /></SelectTrigger>
                      <SelectContent>
                        {assignable.map((p) => <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select value={r.tier} onValueChange={(v) => updateRow(i, 'tier', v)}>
                      <SelectTrigger aria-label="Tier" className="min-w-36"><SelectValue placeholder="Tier" /></SelectTrigger>
                      <SelectContent>
                        {TIERS.map((t) => <SelectItem key={t} value={t}>{tierName(r.portal_key, t)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select value={r.department || NO_DEPARTMENT} onValueChange={(v) => updateRow(i, 'department', v === NO_DEPARTMENT ? '' : v)}>
                      <SelectTrigger aria-label="Department" className="min-w-36"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_DEPARTMENT}>None</SelectItem>
                        {departments.map((d) => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" aria-label="Remove row" disabled={rows.length === 1}
                      onClick={() => setRows((rs) => rs.filter((_, idx) => idx !== i))}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Button variant="outline" className="gap-2" onClick={() => setRows((rs) => [...rs, newRow()])}>
        <Plus className="h-4 w-4" /> Add another
      </Button>

      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack}>Back</Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onSkip}>Skip for now</Button>
          <Button onClick={submit} disabled={saving}>{saving ? 'Adding…' : `Add ${rows.length} employee${rows.length === 1 ? '' : 's'}`}</Button>
        </div>
      </div>
    </div>
  );
}
