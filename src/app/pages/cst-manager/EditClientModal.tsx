import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Checkbox } from '../../components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Edit } from 'lucide-react';
import { cls } from '../../styles/classes';
import { PRODUCTS, SERVICE_AREAS } from '../../constants/crm';
import { useClients } from '../../context/ClientContext';
import { CustomFieldInputs } from '../../components/shared/CustomFieldInputs';
import { useClientInbox } from '../../context/ClientInboxContext';

interface EditClientModalProps {
    client: any;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
}

export function EditClientModal({ client, open, onOpenChange, onSuccess }: EditClientModalProps) {
    const [editForm, setEditForm] = useState<any>(null);
    const [isSaving, setIsSaving] = useState(false);
    const { updateClient, fieldDefinitions } = useClients();
    const { fetchData: fetchInbox } = useClientInbox();

    useEffect(() => {
        if (client) {
            setEditForm({
                company_name: client.company_name || client.name,
                customer_name: client.customer_name || client.name,
                email: client.email,
                email_2: client.email_2,
                payment_amount: client.payment_amount,
                product_sold: typeof client.product_sold === 'string' ? client.product_sold.split(', ') : (client.product_sold || []),
                service_area: client.service_area,
                contact_no_1: client.contact_no_1,
                contact_no_2: client.contact_no_2,
                client_concerns: client.client_concerns,
                tips_for_tech: client.tips_for_tech,
                notes: client.notes,
                custom_fields: client.custom_fields ?? {},
            });
        }
    }, [client]);

    const handleUpdate = async () => {
        if (!client || !editForm) return;
        setIsSaving(true);
        const data = {
            ...editForm,
            product_sold: Array.isArray(editForm.product_sold) ? editForm.product_sold.join(', ') : editForm.product_sold
        };
        const success = await updateClient(client.id, data);
        if (success) {
            onOpenChange(false);
            fetchInbox();
            if (onSuccess) onSuccess();
        }
        setIsSaving(false);
    };

    if (!editForm) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className={cls.inline}><Edit className="h-5 w-5 text-primary" />Edit Client Information</DialogTitle>
                    <DialogDescription>Correct any errors in the client information.</DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                    <div className={cls.field}>
                        <Label>Company Name</Label>
                        <Input value={editForm.company_name} onChange={e => setEditForm({...editForm, company_name: e.target.value})} />
                    </div>
                    <div className={cls.field}>
                        <Label>Customer Name</Label>
                        <Input value={editForm.customer_name} onChange={e => setEditForm({...editForm, customer_name: e.target.value})} />
                    </div>
                    <div className={cls.field}>
                        <Label>Email 1</Label>
                        <Input value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} />
                    </div>
                    <div className={cls.field}>
                        <Label>Email 2</Label>
                        <Input value={editForm.email_2 || ''} onChange={e => setEditForm({...editForm, email_2: e.target.value})} />
                    </div>
                    <div className={cls.field}>
                        <Label>Payment Amount ($)</Label>
                        <Input type="number" value={editForm.payment_amount} onChange={e => setEditForm({...editForm, payment_amount: e.target.value})} />
                    </div>
                    <div className={cls.field}>
                        <Label>Service Area</Label>
                        <Select value={editForm.service_area} onValueChange={v => setEditForm({...editForm, service_area: v})}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {SERVICE_AREAS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className={cls.field}>
                        <Label>Primary Contact</Label>
                        <Input value={editForm.contact_no_1} onChange={e => setEditForm({...editForm, contact_no_1: e.target.value})} />
                    </div>
                    <div className="md:col-span-2">
                        <Label className="mb-2 block">Products</Label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {PRODUCTS.map(p => (
                                <div key={p} className="flex items-center space-x-2">
                                    <Checkbox 
                                        id={`edit-prod-modal-${p}`} 
                                        checked={editForm.product_sold.includes(p)}
                                        onCheckedChange={(checked) => {
                                            if (checked) setEditForm({...editForm, product_sold: [...editForm.product_sold, p]});
                                            else setEditForm({...editForm, product_sold: editForm.product_sold.filter((i: string) => i !== p)});
                                        }}
                                    />
                                    <label htmlFor={`edit-prod-modal-${p}`} className="text-xs">{p}</label>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="md:col-span-2">
                        <Label>Client Concerns</Label>
                        <Textarea value={editForm.client_concerns} onChange={e => setEditForm({...editForm, client_concerns: e.target.value})} />
                    </div>
                    <div className="md:col-span-2">
                        <Label>Tips for Tech</Label>
                        <Textarea value={editForm.tips_for_tech} onChange={e => setEditForm({...editForm, tips_for_tech: e.target.value})} />
                    </div>
                </div>
                <CustomFieldInputs
                    idPrefix="edit-cf"
                    definitions={fieldDefinitions}
                    values={editForm.custom_fields}
                    onChange={(custom_fields) => setEditForm({ ...editForm, custom_fields })}
                />
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancel</Button>
                    <Button onClick={handleUpdate} disabled={isSaving} className="bg-primary hover:bg-primary text-white min-w-[120px]">
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
