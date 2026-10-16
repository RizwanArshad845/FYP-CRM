import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Globe, PowerOff, Power, AlertTriangle, CheckCircle2, Search, Edit } from 'lucide-react';
import { cls } from '../../styles/classes';
import { toast } from 'sonner';
import { useClients, ManagedClient } from '../../context/ClientContext';
import { EditClientModal } from './EditClientModal';

export function ActiveClientsPanel() {
    const { clients, deactivationRequests, toggleActive, resolveDeactivationRequest } = useClients();
    const [search, setSearch] = useState('');

    return (
        <div className={cls.page}>
            {/* Pending Deactivation Requests from CST Agents */}
            {deactivationRequests.length > 0 && (
                <Card className="border-2 border-yellow-300 dark:border-yellow-700">
                    <CardHeader>
                        <CardTitle className={`${cls.inline} text-yellow-700 dark:text-yellow-400`}>
                            <AlertTriangle className="h-5 w-5" />
                            Pending Deactivation Requests
                        </CardTitle>
                        <CardDescription>Requests submitted by CST agents — approve or dismiss</CardDescription>
                    </CardHeader>
                    <CardContent className={cls.list}>
                        {deactivationRequests.map(req => (
                                <div key={req.client_id} className={`${cls.item} border-yellow-200`}>
                                    <div className={`${cls.row} mb-3 flex-wrap gap-2`}>
                                        <div>
                                            <p className={cls.heading}>{req.client_name}</p>
                                            <p className={cls.hint}>
                                                Requested by <strong>{req.requested_by}</strong>
                                                {' · '}{new Date(req.created_at).toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                    <div className={`${cls.actions} flex-wrap`}>
                                        <Button
                                            size="sm"
                                            variant="destructive"
                                            onClick={() => {
                                                resolveDeactivationRequest(req.id, true, req.client_id);
                                                toast.success(`${req.client_name} has been deactivated.`);
                                            }}
                                        >
                                            <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />Approve &amp; Deactivate
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => {
                                                resolveDeactivationRequest(req.id, false, req.client_id);
                                                toast.info(`Request for ${req.client_name} dismissed.`);
                                            }}
                                        >
                                            Dismiss
                                        </Button>
                                    </div>
                                </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            {/* All clients table with Activate / Deactivate */}
            <Card>
                <CardHeader>
                    <div className={cls.row}>
                        <div>
                            <CardTitle className={cls.inline}>
                                <Globe className="h-5 w-5" />Active Clients
                            </CardTitle>
                            <CardDescription>Activate or deactivate clients directly</CardDescription>
                        </div>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Search clients..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm w-[250px]" />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto rounded-lg border">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50">
                                <tr>
                                    {['Client', 'Assigned Agent', 'Status', 'Action'].map(h => (
                                        <th key={h} className={cls.tableHead}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {clients.filter(c => !search || c.company_name.toLowerCase().includes(search.toLowerCase()) || c.customer_name.toLowerCase().includes(search.toLowerCase())).map(c => (
                                    <tr key={c.id} className={`${cls.tableRow} ${!c.isActive ? 'opacity-60' : ''}`}>
                                        <td className={`${cls.tableCell} ${cls.heading}`}>{c.company_name}</td>
                                        <td className={cls.tableCell}>{c.assigned_name || 'Unassigned'}</td>
                                        <td className={cls.tableCell}>
                                            <Badge variant={c.isActive ? 'default' : 'secondary'}>
                                                {c.isActive ? 'Active' : 'Inactive'}
                                            </Badge>
                                        </td>
                                        <td className={cls.tableCell}>
                                            <Button
                                                size="sm"
                                                variant={c.isActive ? 'destructive' : 'default'}
                                                onClick={() => {
                                                    toggleActive(c.id);
                                                    toast.success(`${c.company_name} ${c.isActive ? 'deactivated' : 'activated'}.`);
                                                }}
                                                title={c.assigned_name === 'Unassigned' ? "Assign client from Inbox first" : ""}
                                            >
                                                {c.isActive
                                                    ? <><PowerOff className="h-3.5 w-3.5 mr-1.5" />Deactivate</>
                                                    : <><Power className="h-3.5 w-3.5 mr-1.5" />Activate</>}
                                            </Button>
                                            {(c.status === 'onboarding' || c.assigned_name === 'Unassigned') && (
                                                <p className="text-[10px] text-muted-foreground mt-1">Assign first</p>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
