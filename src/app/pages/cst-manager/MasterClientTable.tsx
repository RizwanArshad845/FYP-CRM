import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/table';
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Search, List } from 'lucide-react';
import { useClients } from '../../context/ClientContext';
import { ClientViewToggle, PipelineKanbanBoard, type ClientView } from '../../components/shared/PipelineKanbanBoard';
import { ClientFieldCell, tableFields } from '../../components/shared/ClientFieldCell';

export function MasterClientTable() {
  const { clients, clientFields } = useClients();
  const columns = tableFields(clientFields);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<ClientView>('table');

  // Filter: Assigned clients (both new and existing)
  // According to user: "when the client is assigned to someone"
  const assignedClients = clients.filter(c => c.cst_agent_id !== null || c.sales_agent_id !== null);

  const filtered = assignedClients.filter(c => 
    !search || 
    c.company_name.toLowerCase().includes(search.toLowerCase()) || 
    c.customer_name.toLowerCase().includes(search.toLowerCase()) ||
    (c.cin && c.cin.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <Card className="shadow-lg border-primary/30 ">
      <CardHeader className="bg-primary-soft/50 border-b">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-soft rounded-lg">
              <List className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle>Client Table</CardTitle>
              <CardDescription>Comprehensive view of all assigned clients across the team</CardDescription>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search by company, person or CIN..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              className="pl-9 h-10 w-full md:w-[300px] bg-background shadow-sm"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="px-6 pt-4"><ClientViewToggle view={view} onChange={setView} /></div>
        {view === 'kanban' ? <div className="px-6 pb-6"><PipelineKanbanBoard clients={filtered} /></div> : (
        <div className="overflow-x-auto max-h-[700px]">
          <Table className="w-full text-[11px] text-left border-collapse">
            <TableHeader className="bg-muted sticky top-0 z-20 shadow-sm">
              <TableRow className="border-b border-border">
                {['Status', ...columns.map((f) => f.label), 'Assigned To', 'Stage', 'Last contact', 'Date'].map((h, i) => (
                  <TableHead key={i} className="px-4 py-3 font-bold text-foreground uppercase tracking-wider border-r border-border last:border-r-0 min-w-[130px] whitespace-nowrap bg-muted">
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border bg-background text-foreground">
              {filtered.map((c, idx) => (
                <TableRow key={c.id} className={`hover:bg-muted/50 transition-colors ${idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}`}>
                  <TableCell className="px-4 py-3 border-r border-border">
                    <Badge 
                        variant={c.status === 'active' ? 'default' : c.status === 'flagged' ? 'destructive' : 'secondary'} 
                        className="text-[9px] uppercase font-bold"
                    >
                        {c.status === 'flagged' && c.flag_type ? `${c.status}: ${c.flag_type.replace('-', ' ')}` : c.status}
                    </Badge>
                  </TableCell>
                  {columns.map((f) => <ClientFieldCell key={f.key} field={f} client={c} className="px-4 py-3 border-r border-border" />)}
                  <TableCell className="px-4 py-3 border-r border-border font-semibold text-primary ">{c.assigned_name || 'Unassigned'}</TableCell>
                  <TableCell className="px-4 py-3 border-r border-border">{c.stage_name || '—'}</TableCell>
                  <TableCell className="px-4 py-3 border-r border-border whitespace-nowrap">{c.last_contact ? new Date(c.last_contact).toLocaleDateString() : '—'}</TableCell>
                  <TableCell className="px-4 py-3 border-r border-border whitespace-nowrap">{new Date(c.created_at).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={columns.length + 5} className="text-center py-24 text-muted-foreground bg-muted/20">
                    <div className="flex flex-col items-center gap-2">
                        <Search className="h-8 w-8 opacity-20" />
                        <p className="text-sm font-medium">No assigned clients found matching your search.</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        )}
      </CardContent>
    </Card>
  );
}
