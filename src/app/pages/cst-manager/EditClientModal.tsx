import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Edit } from 'lucide-react';
import { cls } from '../../styles/classes';
import { useClients } from '../../context/ClientContext';
import { ClientFieldsForm } from '../../components/shared/ClientFieldsForm';
import { useClientInbox } from '../../context/ClientInboxContext';
import { clientToValues, missingRequired, toClientBody, type ClientFormValues } from '../../utils/clientFields';

interface EditClientModalProps {
    client: any;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
}

// Edits every switched-on field of the organization's client layout.
export function EditClientModal({ client, open, onOpenChange, onSuccess }: EditClientModalProps) {
    const [values, setValues] = useState<ClientFormValues | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const { updateClient, clientFields } = useClients();
    const { fetchData: fetchInbox } = useClientInbox();

    useEffect(() => {
        if (client) setValues(clientToValues(clientFields, client));
    }, [client, clientFields]);

    const handleUpdate = async () => {
        if (!client || !values) return;
        const missing = missingRequired(clientFields, values);
        if (missing.length) {
            toast.error(`Please fill in: ${missing.join(', ')}`);
            return;
        }
        setIsSaving(true);
        const success = await updateClient(client.id, toClientBody(clientFields, values));
        if (success) {
            onOpenChange(false);
            fetchInbox();
            if (onSuccess) onSuccess();
        }
        setIsSaving(false);
    };

    if (!values) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className={cls.inline}><Edit className="h-5 w-5 text-primary" />Edit Client Information</DialogTitle>
                    <DialogDescription>Correct any errors in the client information.</DialogDescription>
                </DialogHeader>
                <div className="space-y-6 py-2">
                    <ClientFieldsForm fields={clientFields} values={values} onChange={setValues} idPrefix="edit-client" />
                </div>
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
