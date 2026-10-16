import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { apiFetch } from '../utils/api';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';

export interface AgentTarget {
    id: number;
    type: 'sales' | 'cst';
    agentId: number;
    agentName: string;
    month: string;
    target: number;
    achieved: number;
    targetClients?: number;
    achievedClients?: number;
    targetAmount?: number;
    achievedAmount?: number;
}

interface AgentTargetContextType {
    targets: AgentTarget[];
    assignTarget: (agentName: string, agentId: number, amount: number) => void;
    updateTarget: (targetId: number, agentId: number, amount: number, achieved?: number) => void;
    updateAchieved: (targetId: number, achieved: number, type?: 'sales' | 'cst') => void;
    updateAchievedClients: (targetId: number, achieved: number) => void;
    deleteTarget: (targetId: number) => Promise<boolean>;
}

const AgentTargetContext = createContext<AgentTargetContextType | null>(null);

export function AgentTargetProvider({ children }: { children: ReactNode }) {
    const [targets, setTargets] = useState<AgentTarget[]>([]);
    const { user } = useAuth();

    const fetchData = async () => {
        try {
            const [salesRes, cstRes] = await Promise.allSettled([
                apiFetch('/sales-manager/targets'),
                apiFetch('/cst-manager/targets')
            ]);
            
            const formatMonth = (dateStr: string) => {
                if (!dateStr) return '';
                // Handle YYYY-MM by appending -01 for reliable parsing
                const parseableStr = dateStr.length === 7 ? `${dateStr}-01` : dateStr;
                const d = new Date(parseableStr);
                if (isNaN(d.getTime())) return dateStr;
                return d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
            };

            let allTargets: AgentTarget[] = [];
            
            if (salesRes.status === 'fulfilled' && salesRes.value.success) {
                const salesMapped = salesRes.value.data.map((t: any) => ({
                    id: t.id,
                    type: 'sales',
                    agentId: Number(t.user_id),
                    agentName: t.agent_name || 'Sales Agent',
                    month: formatMonth(t.target_month),
                    target: Number(t.target_amount),
                    achieved: Number(t.achieved_amount) || 0,
                    targetAmount: Number(t.target_amount),
                    achievedAmount: Number(t.achieved_amount) || 0
                }));
                allTargets = [...allTargets, ...salesMapped];
            }
            
            if (cstRes.status === 'fulfilled' && cstRes.value.success) {
                const cstMapped = cstRes.value.data.map((t: any) => ({
                    id: t.id,
                    type: 'cst',
                    agentId: Number(t.agentId || t.agent_id || t.user_id),
                    agentName: t.agentName || t.agent_name || 'CST Agent',
                    month: formatMonth(t.month || t.target_month),
                    target: Number(t.targetClients || t.target_clients || t.target_amount),
                    achieved: Number(t.achievedClients || t.achieved_amount) || 0,
                    targetClients: Number(t.targetClients || t.target_clients || 0),
                    achievedClients: Number(t.achievedClients || 0),
                    targetAmount: Number(t.targetAmount || t.target_amount || 0),
                    achievedAmount: Number(t.achievedAmount || t.achieved_amount || 0)
                }));
                allTargets = [...allTargets, ...cstMapped];
            }
            
            setTargets(allTargets);
        } catch (error) {
            console.error('Failed to fetch targets:', error);
        }
    };

    useEffect(() => {
        const token = sessionStorage.getItem('crm_token');
        if (token) {
            fetchData();
        }
    }, []);

    const assignTarget = async (agentName: string, agentId: number, amount: number) => {
        const now = new Date();
        const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        
        try {
            const res = await apiFetch('/sales-manager/targets', {
                method: 'POST',
                body: JSON.stringify({
                    user_id: agentId,
                    assigned_by: user?.id,
                    target_month: monthStr,
                    target_amount: amount
                })
            });

            if (res.success) {
                fetchData();
                toast.success(`Target set for ${agentName}`);
            }
        } catch (error) {
            toast.error('Failed to assign target');
        }
    };

    const updateTarget = async (targetId: number, agentId: number, amount: number, achieved?: number) => {
        const now = new Date();
        const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        
        try {
            const bodyData: any = {
                user_id: agentId,
                target_month: monthStr,
                target_amount: amount
            };
            if (achieved !== undefined) {
                bodyData.achieved_amount = achieved;
            }
            
            const res = await apiFetch(`/sales-manager/targets/${targetId}`, {
                method: 'PUT',
                body: JSON.stringify(bodyData)
            });

            if (res.success) {
                fetchData();
                toast.success('Target updated successfully');
            }
        } catch (error) {
            toast.error('Failed to update target');
        }
    };

    const updateAchieved = async (targetId: number, achieved: number, type: 'sales' | 'cst' = 'sales') => {
        try {
            const endpoint = type === 'cst' 
                ? `/cst-manager/targets/${targetId}/achieved` 
                : `/sales-manager/targets/${targetId}/achieved`;
            const res = await apiFetch(endpoint, {
                method: 'PATCH',
                body: JSON.stringify({ achieved })
            });
            if (res.success) {
                setTargets(prev => prev.map(t => t.id === targetId ? { ...t, achieved, achievedAmount: achieved } : t));
                toast.success('Revenue progress updated');
            }
        } catch (error) {
            toast.error('Failed to update progress');
        }
    };

    const updateAchievedClients = async (targetId: number, achieved: number) => {
        try {
            const res = await apiFetch(`/cst-manager/targets/${targetId}/achieved-clients`, {
                method: 'PATCH',
                body: JSON.stringify({ achieved })
            });
            if (res.success) {
                setTargets(prev => prev.map(t => t.id === targetId ? { ...t, achievedClients: achieved } : t));
                toast.success('Client progress updated');
            }
        } catch (error) {
            toast.error('Failed to update client progress');
        }
    };

    const deleteTarget = async (targetId: number) => {
        try {
            const res = await apiFetch(`/sales-manager/targets/${targetId}`, {
                method: 'DELETE'
            });
            if (res.success) {
                setTargets(prev => prev.filter(t => t.id !== targetId));
                toast.success('Target removed');
                return true;
            }
            return false;
        } catch (error) {
            toast.error('Failed to remove target');
            return false;
        }
    };

    return (
        <AgentTargetContext.Provider value={{ targets, assignTarget, updateTarget, updateAchieved, updateAchievedClients, deleteTarget }}>
            {children}
        </AgentTargetContext.Provider>
    );
}

export function useAgentTargets() {
    const ctx = useContext(AgentTargetContext);
    if (!ctx) throw new Error('useAgentTargets must be used inside AgentTargetProvider');
    return ctx;
}
