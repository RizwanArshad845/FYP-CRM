import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Search, List } from 'lucide-react';
import { useClients } from '../../context/ClientContext';

export function MasterClientTable() {
  const { clients } = useClients();
  const [search, setSearch] = useState('');

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
    <Card className="shadow-lg border-blue-100 dark:border-blue-900/20">
      <CardHeader className="bg-blue-50/50 dark:bg-blue-900/10 border-b">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
              <List className="h-6 w-6 text-blue-600" />
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
        <div className="overflow-x-auto max-h-[700px]">
          <table className="w-full text-[11px] text-left border-collapse">
            <thead className="bg-muted sticky top-0 z-20 shadow-sm">
              <tr className="border-b border-border">
                {[
                  'Status', 'Cin', 'Company Name', 'Customer Name', 'Service AREA', 
                  'Contact No.1', 'Contact No.2', 'Email', 
                  'Assigned To', 'Date', '$', 'Gateway', 
                  'SERVICES'
                ].map(h => (
                  <th key={h} className="px-4 py-3 font-bold text-foreground uppercase tracking-wider border-r border-border last:border-r-0 min-w-[130px] whitespace-nowrap bg-muted">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-background text-foreground">
              {filtered.map((c, idx) => (
                <tr key={c.id} className={`hover:bg-muted/50 transition-colors ${idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}`}>
                  <td className="px-4 py-3 border-r border-border">
                    <Badge 
                        variant={c.status === 'active' ? 'default' : c.status === 'flagged' ? 'destructive' : 'secondary'} 
                        className="text-[9px] uppercase font-bold"
                    >
                        {c.status === 'flagged' && c.flag_type ? `${c.status}: ${c.flag_type.replace('-', ' ')}` : c.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 border-r border-border font-medium text-blue-600 dark:text-blue-400">{c.cin || '—'}</td>
                  <td className="px-4 py-3 border-r border-border font-bold text-foreground sticky left-0 bg-inherit shadow-[1px_0_0_0_rgba(0,0,0,0.1)] dark:shadow-[1px_0_0_0_rgba(255,255,255,0.1)]">{c.company_name}</td>
                  <td className="px-4 py-3 border-r border-border">{c.customer_name}</td>
                  <td className="px-4 py-3 border-r border-border">{c.service_area || '—'}</td>
                  <td className="px-4 py-3 border-r border-border">{c.contact_no_1}</td>
                  <td className="px-4 py-3 border-r border-border">{c.contact_no_2 || '—'}</td>
                  <td className="px-4 py-3 border-r border-border">{c.email}</td>
                  <td className="px-4 py-3 border-r border-border font-semibold text-blue-700 dark:text-blue-400">{c.assigned_name || 'Unassigned'}</td>
                  <td className="px-4 py-3 border-r border-border whitespace-nowrap">{new Date(c.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 border-r border-border font-bold text-emerald-600 dark:text-emerald-400">${c.payment_amount}</td>
                  <td className="px-4 py-3 border-r border-border font-medium uppercase text-[10px]"><Badge variant="outline">{c.payment_gateway || '—'}</Badge></td>
                  <td className="px-4 py-3 border-r border-border">{c.client_services || '—'}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={13} className="text-center py-24 text-muted-foreground bg-muted/20">
                    <div className="flex flex-col items-center gap-2">
                        <Search className="h-8 w-8 opacity-20" />
                        <p className="text-sm font-medium">No assigned clients found matching your search.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
