import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiFetch } from '../utils/api';
import { useAuth } from './AuthContext';

interface FollowUpLead {
    id: number;
    clientId: number;
    clientName: string;
    agentName: string;
    contactNo: string;
    product: string;
    area: string;
    status: 'pending' | 'contacted' | 'closed';
    dueDate: string;
    notes: string;
    closerName?: string;
    clientNameText?: string;
    contactTime?: string;
    followUpNumber?: number;
}

interface FollowUpContextType {
    leads: FollowUpLead[];
    isLoading: boolean;
    refreshLeads: () => Promise<void>;
}

const FollowUpContext = createContext<FollowUpContextType | undefined>(undefined);

export function FollowUpProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const [leads, setLeads] = useState<FollowUpLead[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const fetchLeads = async () => {
        if (!user || !['sales', 'sales_manager'].includes(user.role)) return;
        setIsLoading(true);
        try {
            const res = await apiFetch('/sales/follow-ups');
            if (res.success) {
                setLeads(res.data.map((l: any) => ({
                    id: Number(l.id),
                    clientId: Number(l.client_id) || 0,
                    clientName: l.client_name,
                    agentName: l.agent_name || 'System',
                    contactNo: l.contact_no,
                    product: l.product,
                    area: l.area,
                    status: l.status,
                    dueDate: l.due_date?.split('T')[0] || '',
                    notes: l.notes,
                    closerName: l.closer_name,
                    clientNameText: l.client_name_text,
                    contactTime: l.contact_time,
                    followUpNumber: l.follow_up_number
                })));
            }
        } catch (error) {
            console.error('Failed to fetch follow-up leads:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchLeads();
    }, [user?.id]);

    return (
        <FollowUpContext.Provider value={{ leads, isLoading, refreshLeads: fetchLeads }}>
            {children}
        </FollowUpContext.Provider>
    );
}

export function useFollowUps() {
    const context = useContext(FollowUpContext);
    if (context === undefined) {
        throw new Error('useFollowUps must be used within a FollowUpProvider');
    }
    return context;
}
