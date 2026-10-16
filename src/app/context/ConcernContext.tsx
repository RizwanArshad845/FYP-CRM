import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiFetch } from '../utils/api';
import { toast } from 'sonner';

export interface Concern {
    id: number;
    concern_type: string;
    description: string;
    status: 'open' | 'pending' | 'in-progress' | 'resolved';
    raised_by: number;
    raised_by_name: string;
    assigned_to?: number;
    assigned_to_name?: string;
    created_at: string;
}

interface ConcernContextType {
    externalConcerns: Concern[];
    internalConcerns: Concern[];
    isLoading: boolean;
    refreshConcerns: () => Promise<void>;
    updateStatus: (id: number, status: string, isInternal: boolean) => Promise<void>;
    deleteConcern: (id: number, isInternal: boolean) => Promise<void>;
}

const ConcernContext = createContext<ConcernContextType | undefined>(undefined);

export function ConcernProvider({ children }: { children: ReactNode }) {
    const [externalConcerns, setExternalConcerns] = useState<Concern[]>([]);
    const [internalConcerns, setInternalConcerns] = useState<Concern[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchConcerns = async (isInternal: boolean) => {
        try {
            const res = await apiFetch(`/concerns?is_internal=${isInternal}`);
            if (res.success) {
                if (isInternal) setInternalConcerns(res.data);
                else setExternalConcerns(res.data);
            }
        } catch (error: any) {
            console.error('Failed to load concerns:', error);
        }
    };

    const refreshConcerns = async () => {
        setIsLoading(true);
        await Promise.all([fetchConcerns(false), fetchConcerns(true)]);
        setIsLoading(false);
    };

    useEffect(() => {
        refreshConcerns();
    }, []);

    const updateStatus = async (id: number, status: string, isInternal: boolean) => {
        try {
            const res = await apiFetch(`/concerns/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ status, is_internal: isInternal })
            });
            if (res.success) {
                toast.success('Status updated');
                fetchConcerns(isInternal);
            }
        } catch (error) {
            toast.error('Failed to update status');
        }
    };

    const deleteConcern = async (id: number, isInternal: boolean) => {
        try {
            const res = await apiFetch(`/concerns/${id}?is_internal=${isInternal}`, {
                method: 'DELETE'
            });
            if (res.success) {
                toast.success('Concern deleted');
                fetchConcerns(isInternal);
            }
        } catch (error) {
            toast.error('Failed to delete concern');
        }
    };

    return (
        <ConcernContext.Provider value={{
            externalConcerns,
            internalConcerns,
            isLoading,
            refreshConcerns,
            updateStatus,
            deleteConcern
        }}>
            {children}
        </ConcernContext.Provider>
    );
}

export function useConcerns() {
    const context = useContext(ConcernContext);
    if (context === undefined) {
        throw new Error('useConcerns must be used within a ConcernProvider');
    }
    return context;
}
