import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiFetch, getToken } from '../utils/api';
import { toast } from 'sonner';

export type RecordingStatus = 'available' | 'processing' | 'failed';

export interface CallRecording {
    id: number;
    agent_id: number;
    agent_name: string;
    client_id: number;
    client_name: string;
    recording_url: string;
    duration_seconds: number;
    transcript: string;
    status: RecordingStatus;
    outcome: 'converted' | 'pending' | 'lost';
    quality_rating: number;
    tags: string[];
    created_at: string;
}

interface RecordingContextType {
    recordings: CallRecording[];
    isLoading: boolean;
    fetchRecordings: () => Promise<void>;
    uploadRecording: (data: any) => Promise<void>;
    updateRecording: (id: number, data: any) => Promise<void>;
    deleteRecording: (id: number) => Promise<void>;
}

const RecordingContext = createContext<RecordingContextType | undefined>(undefined);

export function RecordingProvider({ children }: { children: ReactNode }) {
    const [recordings, setRecordings] = useState<CallRecording[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchRecordings = async () => {
        try {
            const res = await apiFetch('/sales/recordings');
            if (res.success) setRecordings(res.data);
        } catch (error) {
            console.error('Failed to fetch recordings:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const token = getToken();
        if (token) {
            fetchRecordings();
        } else {
            setIsLoading(false);
        }
    }, []);

    const uploadRecording = async (data: any) => {
        try {
            const res = await apiFetch('/sales/recordings', {
                method: 'POST',
                body: JSON.stringify(data)
            });
            if (res.success) {
                fetchRecordings();
                toast.success('Recording uploaded');
            }
        } catch (error) {
            toast.error('Failed to upload recording');
        }
    };

    const deleteRecording = async (id: number) => {
        try {
            const res = await apiFetch(`/sales/recordings/${id}`, { method: 'DELETE' });
            if (res.success) {
                setRecordings(prev => prev.filter(r => r.id !== id));
                toast.success('Recording deleted');
            }
        } catch (error) {
            toast.error('Failed to delete recording');
        }
    };

    const updateRecording = async (id: number, data: any) => {
        try {
            const res = await apiFetch(`/sales/recordings/${id}`, {
                method: 'PUT',
                body: JSON.stringify(data)
            });
            if (res.success) {
                fetchRecordings();
                toast.success('Recording updated');
            }
        } catch (error) {
            toast.error('Failed to update recording');
        }
    };

    return (
        <RecordingContext.Provider value={{ recordings, isLoading, fetchRecordings, uploadRecording, deleteRecording, updateRecording }}>
            {children}
        </RecordingContext.Provider>
    );
}

export function useRecordings() {
    const context = useContext(RecordingContext);
    if (!context) throw new Error('useRecordings must be used within RecordingProvider');
    return context;
}
