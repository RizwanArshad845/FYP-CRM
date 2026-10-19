import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/table';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Plus, Edit, Trash2, Phone, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cls } from '../../styles/classes';
import { apiFetch, ApiError } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { PRODUCTS, SERVICE_AREAS } from '../../constants/crm';
import { LoadingScreen } from '../../components/shared/LoadingScreen';
import { useFollowUps } from '../../context/FollowUpContext';

type FollowUpStatus = 'pending' | 'contacted' | 'closed';

interface FollowUpLead {
    id: number;
    clientId: number;
    clientName: string;
    agentName: string;
    contactNo: string;
    product: string;
    area: string;
    status: FollowUpStatus;
    dueDate: string;
    notes: string;
    closerName?: string;
    clientNameText?: string;
    contactTime?: string;
    followUpNumber?: number;
}

const STATUS_COLORS: Record<FollowUpStatus, string> = {
    pending: 'bg-warning-bg text-warning ',
    contacted: 'bg-primary-soft text-primary ',
    closed: 'bg-success-bg text-success ',
};

// Client details used to fill a new follow up (UC3)
interface ClientOption {
    id: number;
    name: string;
    customer_name?: string | null;
    company_name?: string | null;
    product_sold?: string | null;
    service_area?: string | null;
    phone?: string | null;
    contact_no_1?: string | null;
}

const NO_CLIENT = '__none__';

const EMPTY: Omit<FollowUpLead, 'id'> = {
    clientId: 0, clientName: '', agentName: '', contactNo: '', product: '',
    area: '', status: 'pending', dueDate: '', notes: '',
    closerName: '', clientNameText: '', contactTime: '', followUpNumber: 1
};

export function FollowUpLeads() {
    const { user } = useAuth();
    const { leads, refreshLeads, isLoading: contextLoading } = useFollowUps();
    const [clients, setClients] = useState<ClientOption[]>([]);
    const [duplicateId, setDuplicateId] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isOpen, setIsOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editing, setEditing] = useState<FollowUpLead | null>(null);
    const [form, setForm] = useState<Omit<FollowUpLead, 'id'>>(EMPTY);
    const [filterAgent, setFilterAgent] = useState('all');

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const clientsRes = await apiFetch('/clients');
            if (clientsRes.success) {
                setClients(clientsRes.data.map((c: any) => ({ ...c, id: Number(c.id), name: c.name || c.company_name })));
            }
        } catch (error) {
            toast.error('Failed to load clients');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        refreshLeads();
    }, []);

    const set = (k: keyof typeof EMPTY, v: any) => setForm(prev => ({ ...prev, [k]: v }));

    // Selecting a client fills name, product, area and contact number (the server does the same)
    const selectClient = (value: string) => {
        setDuplicateId(null);
        const c = clients.find(x => String(x.id) === value);
        if (!c) { setForm(prev => ({ ...prev, clientId: 0 })); return; }
        setForm(prev => ({
            ...prev,
            clientId: c.id,
            clientNameText: c.customer_name || c.company_name || '',
            product: c.product_sold || '',
            area: c.service_area || '',
            contactNo: c.phone || c.contact_no_1 || '',
        }));
    };

    const openAdd = () => { setDuplicateId(null); setEditing(null); setForm({ ...EMPTY, agentName: user?.first_name ? `${user.first_name} ${user.last_name || ''}` : '' }); setIsOpen(true); };
    const openEdit = (l: FollowUpLead) => { setEditing(l); setForm(l); setIsOpen(true); };

    const handleSave = async () => {
        const today = new Date().toLocaleDateString('en-CA');
        if (!form.clientNameText && !form.clientId) { toast.error('Client name is required'); return; }
        if (!form.dueDate) { toast.error('Due date is required'); return; }
        if (form.dueDate < today) { toast.error('Due date cannot be in the past'); return; }

        if (isSubmitting) return;

        setIsSubmitting(true);
        setDuplicateId(null);
        try {
            const method = editing ? 'PUT' : 'POST';
            const url = editing ? `/sales/follow-ups/${editing.id}` : '/sales/follow-ups';
            
            const res = await apiFetch(url, {
                method,
                body: JSON.stringify({
                    client_id: form.clientId || null,
                    user_id: user?.id,
                    due_date: form.dueDate,
                    notes: form.notes,
                    status: form.status,
                    product: form.product,
                    area: form.area,
                    closer_name: form.closerName,
                    client_name_text: form.clientNameText,
                    contact_time: form.contactTime,
                    contact_no: form.contactNo
                })
            });

            if (res.success) {
                toast.success(editing ? 'Follow-up updated!' : 'Follow-up added!');
                refreshLeads();
                setIsOpen(false);
            }
        } catch (error) {
            // Duplicate for the same client and day: the server names the existing follow up
            if (error instanceof ApiError && error.status === 409 && error.body?.existingId) setDuplicateId(error.body.existingId);
            else toast.error((error as Error).message || 'Failed to save follow-up');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Delete this follow-up?')) return;
        try {
            const res = await apiFetch(`/sales/follow-ups/${id}`, { method: 'DELETE' });
            if (res.success) {
                toast.success('Deleted!');
                refreshLeads();
            }
        } catch (error) {
            toast.error('Failed to delete');
        }
    };

    return (
        <Card className="shadow-sm">
            <CardHeader>
                <div className={cls.row}>
                    <div>
                        <CardTitle>Follow-Up Leads</CardTitle>
                        <CardDescription>Track and manage client follow-ups</CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <Select value={filterAgent} onValueChange={setFilterAgent}>
                            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Filter by agent" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Agents</SelectItem>
                                {[...new Set(leads.map(l => l.agentName))].map(a => (
                                    <SelectItem key={a} value={a}>{a}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" />Add Follow-Up</Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <LoadingScreen fullScreen={false} message="Fetching leads from Supabase..." />
                ) : (
                    <div className="overflow-x-auto">
                        <Table className="w-full text-sm">
                            <TableHeader className="bg-muted/50 sticky top-0">
                                <TableRow>
                                    {['#', 'Client', 'Agent', 'Closer', 'Contact', 'Product', 'Area', 'Due Date', 'Time', 'Status', 'Actions'].map(h => (
                                        <TableHead key={h} className={cls.tableHead}>{h}</TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody className="divide-y">
                                {leads.filter(l => filterAgent === 'all' || l.agentName === filterAgent).map(l => (
                                    <TableRow key={l.id} className={`${cls.tableRow} ${leads.indexOf(l) % 2 !== 0 ? 'bg-muted/20' : ''}`}>
                                        <TableCell className={cls.tableCell}>{l.followUpNumber || '-'}</TableCell>
                                        <TableCell className={`${cls.tableCell} ${cls.heading}`}>{l.clientName || l.clientNameText}</TableCell>
                                        <TableCell className={cls.tableCell}>{l.agentName}</TableCell>
                                        <TableCell className={cls.tableCell}>{l.closerName || '-'}</TableCell>
                                        <TableCell className={cls.tableCell}>
                                            <div className={cls.inline}><Phone className="h-3 w-3 text-muted-foreground" /><span>{l.contactNo || '-'}</span></div>
                                        </TableCell>
                                        <TableCell className={cls.tableCell}>{l.product || '-'}</TableCell>
                                        <TableCell className={cls.tableCell}>{l.area || '-'}</TableCell>
                                        <TableCell className={`${cls.tableCell} ${cls.mono} text-xs`}>{l.dueDate}</TableCell>
                                        <TableCell className={`${cls.tableCell} ${cls.mono} text-xs`}>{l.contactTime || '-'}</TableCell>
                                        <TableCell className={cls.tableCell}>
                                            <Badge className={`${STATUS_COLORS[l.status]} border-0`}>{l.status}</Badge>
                                        </TableCell>
                                        <TableCell className={cls.tableCell}>
                                            <div className={cls.iconRow}>
                                                <Button variant="outline" size="sm" onClick={() => openEdit(l)}><Edit className="h-4 w-4" /></Button>
                                                <Button variant="outline" size="sm" onClick={() => handleDelete(l.id)}><Trash2 className="h-4 w-4 text-danger" /></Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {leads.length === 0 && (
                                    <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No follow-ups yet</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                        <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{editing ? 'Edit Follow-Up' : 'Add Follow-Up'}</DialogTitle>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3 py-2">
                        {duplicateId && (
                            <div className="col-span-2 rounded-[8px] border border-danger-border bg-danger-bg px-3 py-2 text-[13px] text-danger">
                                A follow up for this client already exists on this day.{' '}
                                {leads.some(l => l.id === duplicateId) && (
                                    <button type="button" className="font-bold underline" onClick={() => { const l = leads.find(x => x.id === duplicateId); setDuplicateId(null); if (l) openEdit(l); }}>
                                        Open the existing follow up
                                    </button>
                                )}
                            </div>
                        )}
                        {!editing && (
                            <div className={`${cls.field} col-span-2`}>
                                <Label>Client</Label>
                                <Select value={form.clientId ? String(form.clientId) : NO_CLIENT} onValueChange={selectClient}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={NO_CLIENT}>New lead (not a client yet)</SelectItem>
                                        {clients.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        <div className={cls.field}>
                            <Label>Client Name *</Label>
                            <Input 
                                value={form.clientNameText} 
                                onChange={e => set('clientNameText', e.target.value)} 
                                placeholder="Enter lead name" 
                            />
                        </div>
                        <div className={cls.field}>
                            <Label>Agent Name</Label>
                            <Input value={form.agentName} disabled className="bg-muted/30" />
                        </div>

                        <div className={cls.field}>
                            <Label>Due Date *</Label>
                            <Input 
                                type="date" 
                                value={form.dueDate} 
                                onChange={e => set('dueDate', e.target.value)} 
                                min={new Date().toLocaleDateString('en-CA')}
                            />
                        </div>

                        <div className={cls.field}>
                            <Label>Product</Label>
                            <Select value={form.product} onValueChange={v => set('product', v)}>
                                <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                                <SelectContent>{[...new Set([form.product, ...PRODUCTS].filter(Boolean))].map((p: string) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className={cls.field}>
                            <Label>Area</Label>
                            <Select value={form.area} onValueChange={v => set('area', v)}>
                                <SelectTrigger><SelectValue placeholder="Select area" /></SelectTrigger>
                                <SelectContent>{[...new Set([form.area, ...SERVICE_AREAS].filter(Boolean))].map((a: string) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>

                        <div className={cls.field}>
                            <Label>Status</Label>
                            <Select value={form.status} onValueChange={v => set('status', v as FollowUpStatus)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="pending">Pending</SelectItem>
                                    <SelectItem value="contacted">Contacted</SelectItem>
                                    <SelectItem value="closed">Closed</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className={cls.field}>
                            <Label>Contact Time</Label>
                            <Input 
                                type="time" 
                                value={form.contactTime} 
                                onChange={e => set('contactTime', e.target.value)} 
                            />
                        </div>

                        <div className={cls.field}>
                            <Label>Closer Name</Label>
                            <Input value={form.closerName} onChange={e => set('closerName', e.target.value)} placeholder="e.g. Mike" />
                        </div>
                        <div className={cls.field}>
                            <Label>Contact Number</Label>
                            <Input value={form.contactNo} onChange={e => set('contactNo', e.target.value)} placeholder="e.g. +1 234 567" />
                        </div>

                        <div className={`${cls.field} col-span-2`}>
                            <Label>Notes</Label>
                            <Textarea rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any notes..." />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isSubmitting}>Cancel</Button>
                        <Button onClick={handleSave} disabled={isSubmitting}>
                            {isSubmitting ? 'Saving...' : (editing ? 'Save Changes' : 'Add Follow-Up')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
