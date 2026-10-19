import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Input } from '../../components/ui/input';
import { UserCheck, CheckCircle2, Search, Edit, XCircle } from 'lucide-react';
import { cls } from '../../styles/classes';
import { toast } from 'sonner';
import { useClientInbox, type InboxClient } from '../../context/ClientInboxContext';
import { useEmployees } from '../../context/EmployeeContext';
import { useClients } from '../../context/ClientContext';
import { EditClientModal } from './EditClientModal';
import { usePortals } from '../../hooks/usePortals';
import { apiFetch } from '../../utils/api';

type Suggestion = { id: number; name: string; active_count: number };

function statusBadge(status: InboxClient['status']) {
    if (status === 'onboarding') return 'bg-warning-bg text-warning border-warning/30';
    if (status === 'active') return 'bg-success-bg text-success border-success/30';
    if (status === 'flagged') return 'bg-danger-bg text-danger border-danger-border';
    return 'bg-primary-soft text-primary border-primary/30';
}

export function InboxPanel() {
    const { inboxClients, assignClient, discardInboxClient } = useClientInbox();
    const { employees } = useEmployees();
    const { can } = usePortals();
    const [search, setSearch] = useState('');

    // Filter for all unassigned clients (except discarded and deactivated) to show in inbox
    const pending = inboxClients.filter(c => !c.cst_agent_id && c.status !== 'discarded' && c.status !== 'deactivated')
        .filter(c => !search || c.company_name.toLowerCase().includes(search.toLowerCase()) || c.customer_name.toLowerCase().includes(search.toLowerCase()));

    const cstAgents = employees.filter(e => e.role === 'cst' || e.role === 'cst_manager');

    const [dialogOpen, setDialogOpen] = useState(false);
    const [selected, setSelected] = useState<InboxClient | null>(null);
    const [agentId, setAgentId] = useState<number | null>(null);

    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [editForm, setEditForm] = useState<any>(null);
    const { updateClient, fetchData: fetchClients } = useClients();
    const { fetchData: fetchInbox } = useClientInbox();

    // UC4: the least loaded CST agent for each unassigned client (server-side)
    const [suggestions, setSuggestions] = useState<Record<number, Suggestion | null>>({});
    const canAssign = can('client.assign');
    useEffect(() => {
        if (!canAssign) return;
        apiFetch('/cst-manager/unassigned-clients')
            .then((res) => setSuggestions(Object.fromEntries(res.data.map((c: any) => [Number(c.id), c.suggested_agent]))))
            .catch(() => setSuggestions({}));
    }, [inboxClients, canAssign]);

    const acceptSuggestion = async (client: InboxClient, agent: Suggestion) => {
        try {
            await apiFetch(`/cst-manager/clients/${client.id}/assign-cst`, { method: 'PATCH', body: JSON.stringify({ cst_agent_id: agent.id }) });
            toast.success(`${client.company_name} assigned to ${agent.name}`);
            await Promise.all([fetchInbox(), fetchClients()]);
        } catch (error: any) {
            toast.error(error.message || 'Assignment failed');
        }
    };

    const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
    const [discardReason, setDiscardReason] = useState('');

    const openAssign = (client: InboxClient) => {
        setSelected(client);
        setAgentId(null);
        setDialogOpen(true);
    };

    const openEdit = (client: InboxClient) => {
        setSelected(client);
        setEditDialogOpen(true);
    };

    const openDiscard = (client: InboxClient) => {
        setSelected(client);
        setDiscardReason('');
        setDiscardDialogOpen(true);
    };

    const handleAssign = () => {
        if (!agentId || !selected) { toast.error('Please select an agent'); return; }
        const agent = cstAgents.find(a => a.id === agentId);
        assignClient(selected.id, agentId, agent?.name ?? '');
        toast.success(`${selected.company_name} assigned to ${agent?.name}!`);
        setDialogOpen(false);
        setSelected(null);
    };

    const handleUpdate = async () => {
        if (!selected || !editForm) return;
        const data = {
            ...editForm,
            product_sold: editForm.product_sold.join(', ')
        };
        const success = await updateClient(selected.id, data);
        if (success) {
            setEditDialogOpen(false);
            fetchInbox(); // Refresh inbox list
        }
    };

    const handleDiscard = async () => {
        if (!selected || !discardReason.trim()) {
            toast.error('Please provide a reason for discarding');
            return;
        }
        const success = await discardInboxClient(selected.id, discardReason);
        if (success) {
            setDiscardDialogOpen(false);
            setSelected(null);
        }
    };

    return (
        <div className={cls.page}>
            <div className="flex items-center gap-3 mb-2 flex-wrap">
                <h2 className="text-lg font-semibold">Pending Client Submissions</h2>
                <Badge className="bg-warning-bg text-warning border border-warning/30">
                    {pending.length} pending
                </Badge>
                <div className="relative ml-auto">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search pending..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm w-[250px]" />
                </div>
            </div>

            {pending.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center py-12 gap-3 text-muted-foreground">
                        <CheckCircle2 className="h-10 w-10 text-success" />
                        <p className="font-medium">All clients have been reviewed!</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {pending.map(client => (
                        <Card key={client.id} className="border-2 hover:border-primary/40 transition-colors">
                            <CardHeader className="pb-3">
                                <div className={cls.row}>
                                    <div>
                                        <CardTitle className="text-base">{client.company_name}</CardTitle>
                                        <CardDescription>{client.customer_name}</CardDescription>
                                    </div>
                                    <Badge className={`border text-xs ${statusBadge(client.status)}`}>
                                        {client.status}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className={cls.list}>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div><p className={cls.hintXs}>Product</p><p className={cls.heading}>{client.product_sold}</p></div>
                                    <div><p className={cls.hintXs}>Payment</p><p className={cls.heading}>${Number(client.payment_amount || 0).toLocaleString()}</p></div>
                                    <div><p className={cls.hintXs}>Area</p><p className={cls.heading}>{client.service_area}</p></div>
                                    <div><p className={cls.hintXs}>Submitted By</p><p className={cls.heading}>{client.submitted_by_name}</p></div>
                                    <div><p className={cls.hintXs}>Contact</p><p className={cls.heading}>{client.contact_no_1}</p></div>
                                    <div><p className={cls.hintXs}>Date</p><p className={cls.heading}>{client.created_at ? new Date(client.created_at).toLocaleDateString() : 'N/A'}</p></div>
                                </div>
                                {client.client_concerns && (
                                    <div className={cls.muted}>
                                        <p className={cls.hintXs}>Client Concerns</p>
                                        <p className="text-sm mt-1">{client.client_concerns}</p>
                                    </div>
                                )}
                                {client.tips_for_tech && (
                                    <div className={`${cls.muted} bg-primary-soft`}>
                                        <p className={cls.hintXs}>Tips for Tech</p>
                                        <p className="text-sm mt-1">{client.tips_for_tech}</p>
                                    </div>
                                )}
                                {canAssign && suggestions[client.id] && (
                                    <div className="flex items-center justify-between gap-2 rounded-[8px] border border-border bg-primary-soft px-3 py-2 text-[13px]">
                                        <span>Suggested: <strong>{suggestions[client.id]!.name}</strong> ({suggestions[client.id]!.active_count} active)</span>
                                        <Button size="sm" onClick={() => acceptSuggestion(client, suggestions[client.id]!)}>Accept</Button>
                                    </div>
                                )}
                                <div className="flex gap-2">
                                    {can('client.update') && (
                                        <Button variant="outline" className="flex-1" onClick={() => openEdit(client)}>
                                            <Edit className="h-4 w-4 mr-2" />Edit Info
                                        </Button>
                                    )}
                                    {can('client.discard') && (
                                        <Button variant="outline" className="flex-1 text-danger border-danger-border hover:bg-danger-bg" onClick={() => openDiscard(client)}>
                                            <XCircle className="h-4 w-4 mr-2" />Discard
                                        </Button>
                                    )}
                                    {can('client.assign') && (
                                        <Button className="flex-1" onClick={() => openAssign(client)}>
                                            <UserCheck className="h-4 w-4 mr-2" />Assign
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Assign Client to CST Agent</DialogTitle>
                        <DialogDescription>
                            {selected && `Assign ${selected.company_name} (${selected.customer_name}) to a team member`}
                        </DialogDescription>
                    </DialogHeader>
                    <div className={cls.section}>
                        {selected && (
                            <div className={cls.muted}>
                                <p className={cls.label}>{selected.company_name}</p>
                                <p className={cls.hintXs}>Product: {selected.product_sold} · Payment: ${Number(selected.payment_amount || 0).toLocaleString()}</p>
                            </div>
                        )}
                        <div className={cls.field}>
                            <Label>Select CST Agent *</Label>
                            <Select value={agentId !== null ? String(agentId) : ''} onValueChange={v => setAgentId(Number(v))}>
                                <SelectTrigger><SelectValue placeholder="Choose an agent" /></SelectTrigger>
                                <SelectContent>
                                    {cstAgents.map(a => (
                                        <SelectItem key={a.id} value={String(a.id)}>
                                            {a.name} — {a.role}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleAssign}><UserCheck className="h-4 w-4 mr-2" />Assign</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={discardDialogOpen} onOpenChange={setDiscardDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-danger flex items-center gap-2"><XCircle className="h-5 w-5" />Discard Client Submission</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to reject and discard {selected?.company_name}? This will remove them from the inbox permanently.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className={cls.field}>
                            <Label>Discard Reason *</Label>
                            <Input placeholder="e.g. Invalid contact info, unresponsive..." value={discardReason} onChange={e => setDiscardReason(e.target.value)} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDiscardDialogOpen(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleDiscard}>Discard Client</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <EditClientModal 
                client={selected} 
                open={editDialogOpen} 
                onOpenChange={setEditDialogOpen} 
            />
        </div>
    );
}
