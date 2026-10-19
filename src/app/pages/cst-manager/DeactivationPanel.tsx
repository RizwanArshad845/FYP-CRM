import { useEffect, useState } from 'react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Checkbox } from '../../components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { CheckCircle2 } from 'lucide-react';
import { cls } from '../../styles/classes';
import { useClients } from '../../context/ClientContext';
import { usePortals } from '../../hooks/usePortals';
import { cn } from '../../components/ui/utils';

// Flag tag of plan 9.2: Red / Yellow, Black uses the danger pair, none is a green "None".
function FlagTag({ flag }: { flag?: string | null }) {
  if (flag?.includes('red')) return <Badge variant="danger">Red</Badge>;
  if (flag?.includes('yellow')) return <Badge variant="warning">Yellow</Badge>;
  if (flag?.includes('black')) return <Badge variant="danger">Black</Badge>;
  return <Badge variant="success">None</Badge>;
}

// Deactivation requests, Figure 4.5 (plan 7.3): select several, approve or reject in one transaction.
export function DeactivationPanel() {
  const { deactivationRequests, resolveDeactivationRequests } = useClients();
  const { can } = usePortals();
  const canResolve = can('deactivation.resolve');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);

  // Drop selections for requests that are gone
  useEffect(() => {
    setSelected((s) => new Set([...s].filter((id) => deactivationRequests.some((r) => r.id === id))));
  }, [deactivationRequests]);

  const allSelected = deactivationRequests.length > 0 && selected.size === deactivationRequests.length;
  const toggle = (id: number, on: boolean) => setSelected((s) => {
    const next = new Set(s);
    if (on) next.add(id); else next.delete(id);
    return next;
  });

  const resolve = async (approve: boolean) => {
    setBusy(true);
    if (await resolveDeactivationRequests([...selected], approve)) setSelected(new Set());
    setBusy(false);
  };

  if (deactivationRequests.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-emerald-400 opacity-60" />
          <h3 className="text-lg font-semibold text-foreground mb-1">All Clear!</h3>
          <p className="text-sm text-muted-foreground">No pending deactivation requests from CST agents.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cls.section}>
      <div className="mb-[14px] flex flex-wrap items-center justify-between gap-3">
        <span className="text-[13px] text-muted-foreground">
          {deactivationRequests.length} pending request{deactivationRequests.length === 1 ? '' : 's'} · {selected.size} selected
        </span>
        {canResolve && (
          <div className="flex gap-2">
            <Button variant="dangerOutline" disabled={busy || !selected.size} onClick={() => resolve(false)}>Reject selected</Button>
            <Button disabled={busy || !selected.size} onClick={() => resolve(true)}>Approve selected ({selected.size})</Button>
          </div>
        )}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            {canResolve && (
              <TableHead className="w-10">
                <Checkbox
                  aria-label="Select all"
                  checked={allSelected}
                  onCheckedChange={(v) => setSelected(v === true ? new Set(deactivationRequests.map((r) => r.id)) : new Set())}
                />
              </TableHead>
            )}
            <TableHead>Client</TableHead>
            <TableHead>Requested by</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead>Flag</TableHead>
            <TableHead>Requested on</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {deactivationRequests.map((req) => {
            const on = selected.has(req.id);
            return (
              <TableRow key={req.id} className={cn(on && 'bg-primary-soft hover:bg-primary-soft')}>
                {canResolve && (
                  <TableCell>
                    <Checkbox aria-label={`Select ${req.client_name}`} checked={on} onCheckedChange={(v) => toggle(req.id, v === true)} />
                  </TableCell>
                )}
                <TableCell>{req.client_name}</TableCell>
                <TableCell>{req.requested_by}</TableCell>
                <TableCell className="whitespace-normal">{req.reason || '—'}</TableCell>
                <TableCell><FlagTag flag={req.flag_type} /></TableCell>
                <TableCell>{new Date(req.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</TableCell>
                <TableCell><Badge variant="warning">Pending</Badge></TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <p className="mt-[14px] text-[12.5px] text-muted-foreground">
        Approving marks each request approved and each client discarded in one transaction; rejected clients stay active.
      </p>
    </div>
  );
}
