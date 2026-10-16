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
import { apiFetch } from '../../utils/api';
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
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
    contacted: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
    closed: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
};

const EMPTY: Omit<FollowUpLead, 'id'> = {
    clientId: 0, clientName: '', agentName: '', contactNo: '', product: '',
    area: '', status: 'pending', dueDate: '', notes: '',
    closerName: '', clientNameText: '', contactTime: '', followUpNumber: 1
};

export function FollowUpLeads() {
    const { user } = useAuth();
    const { leads, refreshLeads, isLoading: contextLoading } = useFollowUps();
    const [clients, setClients] = useState<{ id: number, name: string }[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isOpen, setIsOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editing, setEditing] = useState<FollowUpLead | null>(null);
    const [form, setForm] = useState<Omit<FollowUpLead, 'id'>>(EMPTY);
    const [filterAgent, setFilterAgent] = useState('all');
    const [isExistingClient, setIsExistingClient] = useState(true);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const clientsRes = await apiFetch('/clients');
            if (clientsRes.success) {
                setClients(clientsRes.data.map((c: any) => ({
                    id: Number(c.id),
                    name: c.name || c.company_name
                })));
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

    const openAdd = () => { setEditing(null); setForm({ ...EMPTY, agentName: user?.first_name ? `${user.first_name} ${user.last_name || ''}` : '' }); setIsOpen(true); };
    const openEdit = (l: FollowUpLead) => { setEditing(l); setForm(l); setIsOpen(true); };

    const handleSave = async () => {
        const today = new Date().toLocaleDateString('en-CA');
        if (!form.clientNameText && !form.clientId) { toast.error('Client name is required'); return; }
        if (!form.dueDate) { toast.error('Due date is required'); return; }
        if (form.dueDate < today) { toast.error('Due date cannot be in the past'); return; }
        if ((form.followUpNumber || 0) < 1) { toast.error('Follow-up number must be at least 1'); return; }

        // Check for duplicates (same client + same follow-up number)
        const duplicate = leads.find(l => 
            l.id !== editing?.id && 
            (l.clientNameText === form.clientNameText || l.clientName === form.clientName) &&
            l.followUpNumber === form.followUpNumber
        );
        if (duplicate) {
            toast.error(`Follow-up #${form.followUpNumber} already exists for this client`);
            return;
        }

        if (isSubmitting) return;

        setIsSubmitting(true);
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
                    follow_up_number: form.followUpNumber,
                    contact_no: form.contactNo
                })
            });

            if (res.success) {
                toast.success(editing ? 'Follow-up updated!' : 'Follow-up added!');
                refreshLeads();
                setIsOpen(false);
            }
        } catch (error) {
            toast.error('Failed to save follow-up');
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
                    <div className="overflow-x-auto rounded-lg border">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50 sticky top-0">
                                <tr>
                                    {['#', 'Client', 'Agent', 'Closer', 'Contact', 'Product', 'Area', 'Due Date', 'Time', 'Status', 'Actions'].map(h => (
                                        <th key={h} className={cls.tableHead}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {leads.filter(l => filterAgent === 'all' || l.agentName === filterAgent).map(l => (
                                    <tr key={l.id} className={`${cls.tableRow} ${leads.indexOf(l) % 2 !== 0 ? 'bg-muted/20' : ''}`}>
                                        <td className={cls.tableCell}>{l.followUpNumber || '-'}</td>
                                        <td className={`${cls.tableCell} ${cls.heading}`}>{l.clientName || l.clientNameText}</td>
                                        <td className={cls.tableCell}>{l.agentName}</td>
                                        <td className={cls.tableCell}>{l.closerName || '-'}</td>
                                        <td className={cls.tableCell}>
                                            <div className={cls.inline}><Phone className="h-3 w-3 text-muted-foreground" /><span>{l.contactNo || '-'}</span></div>
                                        </td>
                                        <td className={cls.tableCell}>{l.product || '-'}</td>
                                        <td className={cls.tableCell}>{l.area || '-'}</td>
                                        <td className={`${cls.tableCell} ${cls.mono} text-xs`}>{l.dueDate}</td>
                                        <td className={`${cls.tableCell} ${cls.mono} text-xs`}>{l.contactTime || '-'}</td>
                                        <td className={cls.tableCell}>
                                            <Badge className={`${STATUS_COLORS[l.status]} border-0`}>{l.status}</Badge>
                                        </td>
                                        <td className={cls.tableCell}>
                                            <div className={cls.iconRow}>
                                                <Button variant="outline" size="sm" onClick={() => openEdit(l)}><Edit className="h-4 w-4" /></Button>
                                                <Button variant="outline" size="sm" onClick={() => handleDelete(l.id)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {leads.length === 0 && (
                                    <tr><td colSpan={9} className="text-center py-8 text-muted-foreground">No follow-ups yet</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </CardContent>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                        <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{editing ? 'Edit Follow-Up' : 'Add Follow-Up'}</DialogTitle>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3 py-2">
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
                            <Label>Follow-up #</Label>
                            <Input 
                                type="number"
                                min="1"
                                value={form.followUpNumber} 
                                onChange={e => set('followUpNumber', Number(e.target.value))} 
                                placeholder="e.g. 1"
                            />
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
                                <SelectContent>{PRODUCTS.map((p: string) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className={cls.field}>
                            <Label>Area</Label>
                            <Select value={form.area} onValueChange={v => set('area', v)}>
                                <SelectTrigger><SelectValue placeholder="Select area" /></SelectTrigger>
                                <SelectContent>{SERVICE_AREAS.map((a: string) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
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
