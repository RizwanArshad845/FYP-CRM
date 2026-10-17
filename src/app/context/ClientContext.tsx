import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { apiFetch, getToken } from '../utils/api';
import { toast } from 'sonner';

// ── Types ──────────────────────────────────────────────────────────────────────
export interface ManagedClient {
    id: number;
    company_name: string;
    customer_name: string;
    email: string;
    email_2?: string;
    payment_amount: number;
    product_sold?: string;
    service_area?: string;
    contact_no_1: string;
    contact_no_2?: string;
    client_concerns?: string;
    tips_for_tech?: string;
    notes?: string;
    digital_presence?: string;
    sales_agent_id?: number;
    cst_agent_id?: number;
    status: string;
    client_services?: string;
    cin: string;
    payment_gateway: string;
    created_at: string;
    updated_at: string;
    discard_reason?: string;
    discarded_at?: string;
    flag_type?: string;

    // Virtual/UI fields
    assigned_name?: string;
    isActive: boolean;
    is_active: boolean;
    health_score?: number;
    last_interaction?: string;
    next_checkin?: string;
    onboarding_progress?: number;
    stage?: string;
}

export interface DeactivationRequest {
    id: number;
    client_id: number;
    client_name: string;
    requested_by: string;  // agent name
    created_at: string;  // ISO string
    requestedAt?: string; // For backward compatibility
}

interface ClientContextType {
    clients: ManagedClient[];
    deactivationRequests: DeactivationRequest[];
    toggleActive: (id: number) => void;
    requestDeactivation: (clientId: number, clientName: string, agentName: string) => void;
    resolveDeactivationRequest: (requestId: number, approve: boolean, clientId: number) => void;
    flagClient: (id: number, type: string, reason: string) => Promise<void>;
    unflagClient: (id: number) => Promise<void>;
    updateClient: (id: number, data: any) => Promise<boolean>;
    getClientNotes: (clientId: number) => Promise<any[]>;
    addClientNote: (clientId: number, noteText: string, userId: number) => Promise<boolean>;
    updateClientNote: (noteId: number, noteText: string) => Promise<boolean>;
    deleteClientNote: (noteId: number) => Promise<boolean>;
    fetchData: () => Promise<void>;
    isLoading: boolean;
}

const CLIENT_UPDATE_KEYS: Record<string, string> = {
    company_name: 'companyName',
    customer_name: 'customerName',
    payment_amount: 'paymentAmount',
    product_sold: 'productSold',
    service_area: 'serviceArea',
    contact_no_1: 'contactNo1',
    contact_no_2: 'contactNo2',
    client_concerns: 'clientConcerns',
    tips_for_tech: 'tipsForTech',
    digital_presence: 'digitalPresence',
    client_services: 'clientServices',
    payment_gateway: 'paymentGateway',
};

// ── Context ────────────────────────────────────────────────────────────────────
const ClientContext = createContext<ClientContextType | null>(null);

export function ClientProvider({ children }: { children: ReactNode }) {
    const [clients, setClients] = useState<ManagedClient[]>([]);
    const [deactivationRequests, setDeactivationRequests] = useState<DeactivationRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchData = async () => {
        const token = getToken();
        if (!token) {
            setIsLoading(false);
            return;
        }

        try {
            const [clientsRes, requestsRes] = await Promise.all([
                apiFetch('/clients'),
                apiFetch('/clients/deactivation-requests')
            ]);

            if (clientsRes.success) {
                const mapped: ManagedClient[] = clientsRes.data.map((c: any) => ({
                    ...c,
                    id: Number(c.id),
                    isActive: c.status !== 'deactivated',
                    is_active: c.status !== 'deactivated',
                    payment_amount: Number(c.payment_amount || 0)
                }));
                setClients(mapped);
            }

            if (requestsRes.success) {
                const mapped = requestsRes.data.map((r: any) => ({
                    id: Number(r.id),
                    client_id: Number(r.client_id),
                    client_name: r.company_name,
                    requested_by: r.requested_by,
                    created_at: r.created_at,
                    requestedAt: r.created_at
                }));
                setDeactivationRequests(mapped);
            }
        } catch (error: any) {
            console.error('Failed to fetch clients:', error);
            toast.error('Error loading clients: ' + (error.message || 'Unknown error'));
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const toggleActive = async (id: number) => {
        const client = clients.find(c => c.id === id);
        if (!client) return;

        try {
            const res = await apiFetch(`/clients/${id}/status`, {
                method: 'PATCH',
                body: JSON.stringify({ status: client.isActive ? 'deactivated' : 'active' })
            });

            if (res.success) {
                setClients(prev => prev.map(c => c.id === id ? { ...c, isActive: !c.isActive, status: client.isActive ? 'deactivated' : 'active' } : c));
                toast.success(`Client ${client.isActive ? 'deactivated' : 'activated'}`);
            }
        } catch (error) {
            toast.error('Failed to update status');
        }
    };

    const requestDeactivation = async (clientId: number, clientName: string, agentName: string) => {
        try {
            const res = await apiFetch(`/cst/deactivation-requests`, {
                method: 'POST',
                body: JSON.stringify({
                    client_id: clientId,
                    requested_by: agentName,
                    reason: 'Requested by agent'
                })
            });

            if (res.success) {
                // We'll refetch to get the ID from DB
                await fetchData();
                toast.success('Deactivation request sent to manager');
            }
        } catch (error) {
            toast.error('Failed to send request');
        }
    };

    const resolveDeactivationRequest = async (requestId: number, approve: boolean, clientId: number) => {
        try {
            const res = await apiFetch(`/cst-manager/deactivation-requests/${requestId}/resolve`, {
                method: 'PATCH',
                body: JSON.stringify({
                    status: approve ? 'approved' : 'rejected',
                    reviewed_by: 1 // Defaulting to admin review for now
                })
            });

            if (res.success) {
                if (approve) {
                    setClients(prev => prev.map(c => c.id === clientId ? { ...c, isActive: false, status: 'deactivated' } : c));
                }
                setDeactivationRequests(prev => prev.filter(r => r.id !== requestId));
                toast.success(`Request ${approve ? 'approved' : 'rejected'}`);
            }
        } catch (error) {
            console.error('Resolution error:', error);
            toast.error('Failed to resolve request');
        }
    };

    const flagClient = async (id: number, type: string, reason: string) => {
        try {
            const res = await apiFetch(`/clients/${id}/status`, {
                method: 'PATCH',
                body: JSON.stringify({ status: 'flagged', flag_type: type, reason })
            });

            if (res.success) {
                setClients(prev => prev.map(c => c.id === id ? { ...c, status: 'flagged', flag_type: type as any } : c));
                toast.success('Client flagged successfully');
            }
        } catch (error) {
            toast.error('Failed to flag client');
        }
    };

    const unflagClient = async (id: number) => {
        try {
            const res = await apiFetch(`/clients/${id}/status`, {
                method: 'PATCH',
                body: JSON.stringify({ status: 'active', flag_type: null })
            });

            if (res.success) {
                setClients(prev => prev.map(c => c.id === id ? { ...c, status: 'active', flag_type: undefined } : c));
                toast.success('Client flag resolved');
            }
        } catch (error) {
            toast.error('Failed to unflag client');
        }
    };

    const updateClient = async (id: number, data: any) => {
        try {
            // Edit forms hold DB column names; PUT /clients/:id reads camelCase (like POST).
            const body = Object.fromEntries(
                Object.entries(data).map(([key, value]) => [CLIENT_UPDATE_KEYS[key] ?? key, value])
            );
            const res = await apiFetch(`/clients/${id}`, {
                method: 'PUT',
                body: JSON.stringify(body)
            });
            if (res.success) {
                toast.success('Client updated successfully');
                fetchData();
                return true;
            }
            toast.error(res.error || 'Update failed');
            return false;
        } catch (error) {
            toast.error('Connection error');
            return false;
        }
    };

    const getClientNotes = async (clientId: number) => {
        try {
            const res = await apiFetch(`/cst/notes/${clientId}`);
            return res.success ? res.data : [];
        } catch (error) {
            return [];
        }
    };

    const addClientNote = async (client_id: number, note_text: string, created_by: number) => {
        try {
            const res = await apiFetch('/cst/notes', {
                method: 'POST',
                body: JSON.stringify({ client_id, note_text, created_by })
            });
            if (res.success) {
                toast.success('Note added');
                return true;
            }
            return false;
        } catch (error) {
            return false;
        }
    };

    const updateClientNote = async (id: number, note_text: string) => {
        try {
            const res = await apiFetch(`/cst/notes/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ note_text })
            });
            if (res.success) {
                toast.success('Note updated');
                return true;
            }
            return false;
        } catch (error) {
            return false;
        }
    };

    const deleteClientNote = async (id: number) => {
        try {
            const res = await apiFetch(`/cst/notes/${id}`, {
                method: 'DELETE'
            });
            if (res.success) {
                toast.success('Note deleted');
                return true;
            }
            return false;
        } catch (error) {
            return false;
        }
    };

    return (
        <ClientContext.Provider value={{
            clients, deactivationRequests, toggleActive, requestDeactivation,
            resolveDeactivationRequest, flagClient, unflagClient, updateClient,
            getClientNotes, addClientNote, updateClientNote, deleteClientNote,
            fetchData, isLoading
        }}>
            {children}
        </ClientContext.Provider>
    );
}

export function useClients() {
    const ctx = useContext(ClientContext);
    if (!ctx) throw new Error('useClients must be used inside ClientProvider');
    return ctx;
}
