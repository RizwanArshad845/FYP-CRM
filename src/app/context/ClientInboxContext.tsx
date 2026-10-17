import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { apiFetch, getToken } from '../utils/api';
import { toast } from 'sonner';
import { useClients } from './ClientContext';

// ── Types ──────────────────────────────────────────────────────────────────────
export type InboxStatus = 'onboarding' | 'active' | 'flagged' | 'deactivated' | 'new' | 'existing' | 'discarded';

export interface InboxClient {
    id: number;
    company_name: string;
    customer_name: string;
    payment_amount: number;
    product_sold?: string;
    email: string;
    service_area?: string;
    contact_no_1: string;
    contact_no_2?: string;
    client_concerns?: string;
    tips_for_tech?: string;
    notes?: string;
    submitted_by_name?: string;
    created_at: string;
    status: InboxStatus;
    cst_agent_id?: number;
    assigned_name?: string;
}

export interface ClientStrategy {
    client_id: number;
    strategy_text: string;
    created_at: string;
}

export interface CSTAgentTarget {
    id: number;
    agent_id: number;
    agent_name: string;
    target_month: string;
    target_clients: number;
    achieved_clients: number;
    target_amount: number;
    achieved_amount: number;
}

// ── Mapping Helpers ───────────────────────────────────────────────────────────
function mapBackendToClient(b: any): InboxClient {
    return {
        ...b,
        id: Number(b.id),
        payment_amount: Number(b.payment_amount || 0),
        submitted_by_name: b.submitted_by_name || 'System'
    };
}

function mapBackendToStrategy(b: any): ClientStrategy {
    return {
        client_id: b.client_id,
        strategy_text: b.strategy_text || '',
        created_at: b.created_at || b.updated_at
    };
}

function mapBackendToTarget(b: any): CSTAgentTarget {
    const formatMonth = (dateStr: string) => {
        if (!dateStr) return '';
        const parseableStr = dateStr.length === 7 ? `${dateStr}-01` : dateStr;
        const d = new Date(parseableStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    };

    return {
        id: b.id,
        agent_id: b.agentId || b.agent_id,
        agent_name: b.agentName || b.agent_name,
        target_month: formatMonth(b.month || b.target_month),
        target_clients: b.targetClients || b.target_clients,
        achieved_clients: b.achievedClients || b.achieved_clients || 0,
        target_amount: Number(b.targetAmount || b.target_amount) || 0,
        achieved_amount: Number(b.achievedAmount || b.achieved_amount) || 0
    };
}

// ── Context ────────────────────────────────────────────────────────────────────
interface ClientInboxContextType {
    inboxClients: InboxClient[];
    strategies: ClientStrategy[];
    targets: CSTAgentTarget[];
    assignClient: (clientId: number, agentId: number, agentName: string) => void;
    unassignClient: (clientId: number) => void;
    updateStrategy: (clientId: number, strategyText: string) => void;
    deleteStrategy: (clientId: number) => void;
    upsertTarget: (agentId: number, agentName: string, month: string, targetClients: number, targetAmount: number) => void;
    deleteTarget: (targetId: number) => void;
    discardInboxClient: (clientId: number, reason: string) => Promise<boolean>;
    fetchData: () => Promise<void>;
}

const ClientInboxContext = createContext<ClientInboxContextType | null>(null);

export function ClientInboxProvider({ children }: { children: ReactNode }) {
    const [inboxClients, setInboxClients] = useState<InboxClient[]>([]);
    const [strategies, setStrategies] = useState<ClientStrategy[]>([]);
    const [targets, setTargets] = useState<CSTAgentTarget[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const { fetchData: fetchActiveClients } = useClients();

    const fetchData = async () => {
        const token = getToken();
        if (!token) {
            setIsLoading(false);
            return;
        }

        try {
            const [clientsRes, strategiesRes, targetsRes] = await Promise.all([
                apiFetch('/clients'),
                apiFetch('/cst-manager/strategies'),
                apiFetch('/cst-manager/targets')
            ]);

            if (clientsRes.success) setInboxClients(clientsRes.data.map(mapBackendToClient));
            if (strategiesRes.success) setStrategies(strategiesRes.data.map(mapBackendToStrategy));
            if (targetsRes.success) setTargets(targetsRes.data.map(mapBackendToTarget));
        } catch (error: any) {
            console.error('Failed to fetch inbox data:', error);
            toast.error('Error: ' + (error.message || 'Could not load data'));
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const assignClient = async (clientId: number, agentId: number, agentName: string) => {
        try {
            const res = await apiFetch(`/clients/${clientId}/assign`, {
                method: 'PATCH',
                body: JSON.stringify({ agentId })
            });

            if (res.success) {
                setInboxClients(prev =>
                    prev.map(c => c.id === clientId
                        ? { ...c, status: 'active' as InboxStatus, cst_agent_id: agentId, assigned_name: agentName }
                        : c)
                );
                // Refresh both the inbox and the active clients list
                await Promise.all([fetchData(), fetchActiveClients()]); 
                toast.success(`Assigned to ${agentName}`);
            }
        } catch (error) {
            toast.error('Assignment failed');
        }
    };

    const unassignClient = async (clientId: number) => {
        try {
            const res = await apiFetch(`/clients/${clientId}/unassign`, {
                method: 'PATCH'
            });

            if (res.success) {
                setInboxClients(prev =>
                    prev.map(c => c.id === clientId
                        ? { ...c, status: 'onboarding' as InboxStatus, cst_agent_id: undefined, assigned_name: undefined }
                        : c)
                );
                await fetchActiveClients();
                toast.success('Client unassigned');
            }
        } catch (error) {
            toast.error('Failed to unassign client');
        }
    };

    const updateStrategy = async (clientId: number, strategyText: string) => {
        try {
            const res = await apiFetch('/cst-manager/strategies', {
                method: 'POST',
                body: JSON.stringify({
                    client_id: clientId,
                    strategy_text: strategyText
                })
            });

            if (res.success) {
                fetchData(); // Refresh strategies
                toast.success('Strategy saved');
            }
        } catch (error) {
            toast.error('Failed to save strategy');
        }
    };

    const deleteStrategy = async (clientId: number) => {
        try {
            const res = await apiFetch(`/cst-manager/strategies/${clientId}`, {
                method: 'DELETE'
            });

            if (res.success) {
                setStrategies(prev => prev.filter(s => s.client_id !== clientId));
                toast.success('Strategy deleted');
            }
        } catch (error) {
            toast.error('Failed to delete strategy');
        }
    };

    const upsertTarget = async (agentId: number, agentName: string, month: string, targetClients: number, targetAmount: number) => {
        try {
            // Ensure month is YYYY-MM format for backend
            const now = new Date();
            const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

            const res = await apiFetch('/cst-manager/targets', {
                method: 'POST',
                body: JSON.stringify({
                    agent_id: agentId,
                    target_month: monthStr,
                    target_clients: targetClients,
                    target_amount: targetAmount
                })
            });

            if (res.success) {
                fetchData(); // Refresh to get active/achieved counts
                toast.success('Target updated');
            }
        } catch (error) {
            toast.error('Failed to update target');
        }
    };

    const deleteTarget = async (targetId: number) => {
        try {
            const res = await apiFetch(`/cst-manager/targets/${targetId}`, {
                method: 'DELETE'
            });

            if (res.success) {
                setTargets(prev => prev.filter(t => t.id !== targetId));
                toast.success('Target deleted');
            }
        } catch (error) {
            toast.error('Failed to delete target');
        }
    };

    const discardInboxClient = async (clientId: number, reason: string) => {
        try {
            const res = await apiFetch(`/clients/${clientId}/discard`, {
                method: 'PATCH',
                body: JSON.stringify({ reason })
            });

            if (res.success) {
                setInboxClients(prev => prev.filter(c => c.id !== clientId));
                // Refresh the master client list so they appear in Discarded panels
                await fetchActiveClients();
                toast.success('Client discarded successfully');
                return true;
            }
            return false;
        } catch (error) {
            toast.error('Failed to discard client');
            return false;
        }
    };

    return (
        <ClientInboxContext.Provider value={{
            inboxClients, strategies, targets,
            assignClient, unassignClient, updateStrategy, deleteStrategy, upsertTarget, deleteTarget, discardInboxClient, fetchData
        }}>
            {children}
        </ClientInboxContext.Provider>
    );
}

export function useClientInbox() {
    const ctx = useContext(ClientInboxContext);
    if (!ctx) throw new Error('useClientInbox must be used inside ClientInboxProvider');
    return ctx;
}
