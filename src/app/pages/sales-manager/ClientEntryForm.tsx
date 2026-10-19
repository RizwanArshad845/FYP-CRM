import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { toast } from 'sonner';
import { Download, Save, Send, Upload, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { usePortals } from '../../hooks/usePortals';
import { parseCsvFile, SkippedRows } from '../onboarding/EmployeesStep';
import type { ClientField } from '../../types/crm';
import { cls } from '../../styles/classes';
import { useAuth } from '../../context/AuthContext';
import { useClients } from '../../context/ClientContext';
import { ClientFieldsForm } from '../../components/shared/ClientFieldsForm';
import { useClientInbox } from '../../context/ClientInboxContext';
import { apiFetch } from '../../utils/api';
import { formatValue, missingRequired, toClientBody, visibleFields, type ClientFormValues } from '../../utils/clientFields';

// Client entry for the Sales Manager. The fields, their names, order and required
// marks come from the organization's client layout (Organization settings > Client fields).
export function ClientEntryForm() {
  const [values, setValues] = useState<ClientFormValues>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingClients, setPendingClients] = useState<any[]>([]);
  const { user } = useAuth();
  const { fetchData, clientFields } = useClients();
  const [importOpen, setImportOpen] = useState(false);
  const { can } = usePortals();
  const { fetchData: fetchInbox } = useClientInbox();

  // Fetch pending submissions on mount — show all onboarding clients
  useEffect(() => {
    apiFetch('/clients').then(res => {
      if (res.success) {
        setPendingClients(res.data.filter((c: any) => c.status === 'onboarding'));
      }
    }).catch(() => { });
  }, []);

  const handleSaveDraft = () => toast.success('Draft saved successfully!');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const missing = missingRequired(clientFields, values);
    if (missing.length) {
      toast.error(`Please fill in: ${missing.join(', ')}`);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiFetch('/clients', {
        method: 'POST',
        body: JSON.stringify({ ...toClientBody(clientFields, values), sales_agent_id: user?.id }),
      });

      if (res.success) {
        toast.success('Client submitted successfully!');
        setValues({});
        setPendingClients(prev => [res.data, ...prev]);

        // Trigger global refresh so CST Manager or Admin dashboards see it instantly
        fetchData();
        fetchInbox();
      } else {
        console.error(res);
        toast.error(res.error || 'Failed to submit client');
      }
    } catch (error: any) {
      toast.error(error.message || 'Connection error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClear = () => {
    if (confirm('Clear the form?')) {
      setValues({});
      toast.info('Form cleared');
    }
  };

  // Two fields of the layout shown on each pending card, when switched on
  const summary = visibleFields(clientFields).filter((f) => ['product_sold', 'payment_amount'].includes(f.key));

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>Sales Information Entry for CST Team</CardTitle>
            <CardDescription>Enter client information and sales details</CardDescription>
          </div>
          {can('client.import') && (
            <Button type="button" variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />Import CSV
            </Button>
          )}
        </CardHeader>
        <CardContent className={cls.page}>
          <ClientFieldsForm fields={clientFields} values={values} onChange={setValues} />

          {/* Actions */}
          <div className={`${cls.actions} pt-4`}>
            <Button type="button" variant="outline" onClick={handleSaveDraft} className="flex-1">
              <Save className="h-4 w-4 mr-2" />Save Draft
            </Button>
            <Button type="submit" className="flex-1" disabled={isSubmitting}>
              <Send className="h-4 w-4 mr-2" />{isSubmitting ? 'Submitting...' : 'Submit for Review'}
            </Button>
            <Button type="button" variant="destructive" onClick={handleClear} disabled={isSubmitting}>
              <X className="h-4 w-4 mr-2" />Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Pending Submissions */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-lg">Pending Submissions</CardTitle>
          <CardDescription>Clients awaiting CST onboarding</CardDescription>
        </CardHeader>
        <CardContent>
          {pendingClients.length === 0 ? (
            <div className="text-center p-6 border-2 border-dashed rounded-lg text-muted-foreground">
              <p>No pending submissions currently.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {pendingClients.map((client) => (
                <Card key={client.id} className="shadow-sm border-l-4 border-warning">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{client.company_name}</CardTitle>
                    <CardDescription className="text-xs">{client.customer_name}</CardDescription>
                  </CardHeader>
                  <CardContent className="text-sm">
                    {summary.map((f) => (
                      <div key={f.key} className="flex justify-between gap-3 mb-1">
                        <span className={cls.hint}>{f.label}:</span>
                        <span className="font-medium truncate max-w-[140px]">{formatValue(f, client)}</span>
                      </div>
                    ))}
                    <div className="flex justify-end mt-2">
                      <span className="text-xs font-semibold px-2 py-1 bg-warning-bg text-warning rounded-full">
                        ONBOARDING PENDING
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <ClientImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        fields={clientFields}
        onImported={() => { fetchData(); fetchInbox(); }}
      />
    </form>
  );
}

const asCustomValue = (field: ClientField, value: string) =>
  field.type === 'checkbox' ? ['true', 'yes', '1'].includes(value.toLowerCase()) : value;

// A CSV column matches a field by its key (e.g. company_name) or its label.
const csvHeader = (f: ClientField) => (f.kind === 'custom' ? f.label : f.key);

// Client CSV import (plan 7.5): template download, then the server validates every row
// with the client form's rules and reports the rows it skipped.
function ClientImportDialog({ open, onOpenChange, fields, onImported }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fields: ClientField[];
  onImported: () => void;
}) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [result, setResult] = useState<{ created: number; skipped: { row: number; label?: string; error: string }[] } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!open) { setRows([]); setResult(null); } }, [open]);

  const downloadTemplate = () => {
    const headers = visibleFields(fields).map(csvHeader);
    const csv = headers.map((h) => (/[",\n]/.test(h) ? `"${h.replace(/"/g, '""')}"` : h)).join(',') + '\n';
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'client-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFile = (file: File) => parseCsvFile(file, (data) => {
    const byHeader = new Map<string, ClientField>();
    for (const f of visibleFields(fields)) {
      byHeader.set(f.key.toLowerCase(), f);
      byHeader.set(f.label.toLowerCase(), f);
    }
    const parsed = data.map((raw) => {
      const row: Record<string, unknown> = {};
      const custom: Record<string, unknown> = {};
      for (const [header, rawValue] of Object.entries(raw)) {
        const value = String(rawValue ?? '').trim();
        if (!value) continue;
        const f = byHeader.get(header);
        if (!f) continue;
        if (f.kind === 'custom') custom[f.name!] = asCustomValue(f, value);
        else row[f.body!] = value;
      }
      if (Object.keys(custom).length) row.customFields = custom;
      return row;
    }).filter((r) => Object.keys(r).length);
    if (!parsed.length) { toast.error('No clients found in the file'); return; }
    setRows(parsed);
    setResult(null);
  });

  const submit = async () => {
    setBusy(true);
    try {
      const res = await apiFetch('/clients/import', { method: 'POST', body: JSON.stringify({ clients: rows }) });
      setResult({ created: res.data.created.length, skipped: res.data.rowErrors.map((e: any) => ({ ...e, label: String(rows[e.row - 1]?.companyName ?? '') })) });
      onImported();
    } catch (error: any) {
      const rowErrors = error.body?.rowErrors;
      if (rowErrors) setResult({ created: 0, skipped: rowErrors.map((e: any) => ({ ...e, label: String(rows[e.row - 1]?.companyName ?? '') })) });
      else toast.error(error.message || 'Import failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Import clients</DialogTitle>
          <DialogDescription>Rows are checked with the same rules as the client form. Valid rows are saved; the others are listed.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Button type="button" variant="link" className="h-auto px-0" onClick={downloadTemplate}>
            <Download className="h-4 w-4" />Download template
          </Button>
          <Input type="file" accept=".csv,text/csv" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFile(file); e.target.value = ''; }} />
          {rows.length > 0 && !result && <p className="text-sm">{rows.length} row{rows.length === 1 ? '' : 's'} ready to import.</p>}
          {result && (
            <>
              <p className="text-sm">
                <strong>{result.created}</strong> client{result.created === 1 ? '' : 's'} imported
                {result.skipped.length > 0 && <>, <strong>{result.skipped.length}</strong> row{result.skipped.length === 1 ? '' : 's'} skipped</>}.
              </p>
              <SkippedRows rows={result.skipped} />
            </>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button type="button" disabled={busy || !rows.length || !!result} onClick={submit}>{busy ? 'Importing…' : 'Import'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
