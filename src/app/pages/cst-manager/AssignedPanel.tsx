import { useState } from 'react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Search, Edit } from 'lucide-react';
import { cls } from '../../styles/classes';
import { toast } from 'sonner';
import { useClientInbox, type InboxClient } from '../../context/ClientInboxContext';
import { useClients, ManagedClient } from '../../context/ClientContext';
import { EditClientModal } from './EditClientModal';

function statusBadge(status: InboxClient['status']) {
    if (status === 'onboarding') return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    if (status === 'active') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (status === 'flagged') return 'bg-red-100 text-red-700 border-red-200';
    return 'bg-blue-100 text-blue-700 border-blue-200';
}

export function AssignedPanel() {
    const { inboxClients, unassignClient } = useClientInbox();
    const [search, setSearch] = useState('');

    const assigned = inboxClients.filter(c => c.status === 'active' || c.status === 'flagged')
        .filter(c => !search || c.company_name.toLowerCase().includes(search.toLowerCase()) || c.customer_name.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className={cls.page}>
            <div className="flex items-center gap-3 mb-2 flex-wrap">
                <h2 className="text-lg font-semibold">Assigned Clients</h2>
                <Badge variant="outline">{assigned.length} total</Badge>
                <div className="relative ml-auto">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search assigned..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm w-[250px]" />
                </div>
            </div>

            {assigned.length === 0 ? (
                <p className={`${cls.hint} py-8 text-center`}>No clients assigned yet.</p>
            ) : (
                <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                            <tr>
                                {['Company', 'Contact', 'Product', 'Payment', 'Submitted By', 'Assigned To', 'Date', 'Status', 'Action'].map(h => (
                                    <th key={h} className={cls.tableHead}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {assigned.map(c => (
                                <tr key={c.id} className={cls.tableRow}>
                                    <td className={`${cls.tableCell} ${cls.heading}`}>{c.company_name}</td>
                                    <td className={cls.tableCell}>{c.customer_name}</td>
                                    <td className={cls.tableCell}>{c.product_sold}</td>
                                    <td className={`${cls.tableCell} font-mono`}>${Number(c.payment_amount || 0).toLocaleString()}</td>
                                    <td className={cls.tableCell}>{c.submitted_by_name}</td>
                                    <td className={`${cls.tableCell} font-semibold text-primary`}>{c.assigned_name ?? '—'}</td>
                                    <td className={`${cls.tableCell} text-xs font-mono`}>{c.created_at ? new Date(c.created_at).toLocaleDateString() : 'N/A'}</td>
                                    <td className={cls.tableCell}>
                                        <Badge className={`border text-xs ${statusBadge(c.status)}`}>{c.status}</Badge>
                                    </td>
                                    <td className={cls.tableCell}>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 text-xs"
                                            onClick={() => {
                                                unassignClient(c.id);
                                                toast.success(`${c.company_name} moved back to inbox`);
                                            }}
                                        >
                                            ↩ Unassign
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
