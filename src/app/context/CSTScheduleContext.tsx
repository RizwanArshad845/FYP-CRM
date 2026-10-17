import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiFetch, getToken } from '../utils/api';
import { toast } from 'sonner';

export interface Schedule {
    id: number;
    user_id: number;
    user_name?: string;
    title: string;
    description: string;
    start_time: string;
    end_time: string;
    status?: 'scheduled' | 'completed' | 'cancelled';
}

interface CSTScheduleContextType {
    schedules: Schedule[];
    isLoading: boolean;
    fetchSchedules: () => Promise<void>;
    addSchedule: (schedule: Omit<Schedule, 'id'>) => Promise<void>;
    updateSchedule: (id: number, data: Partial<Schedule>) => Promise<void>;
    deleteSchedule: (id: number) => Promise<void>;
}

const CSTScheduleContext = createContext<CSTScheduleContextType | undefined>(undefined);

export function CSTScheduleProvider({ children }: { children: ReactNode }) {
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchSchedules = async () => {
        const token = getToken();
        if (!token) {
            setIsLoading(false);
            return;
        }

        try {
            const res = await apiFetch('/cst/schedules');
            if (res.success) setSchedules(res.data);
        } catch (error: any) {
            console.error('Failed to fetch schedules:', error);
            toast.error('Could not sync schedule data');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchSchedules();
    }, []);

    const addSchedule = async (schedule: Omit<Schedule, 'id'>) => {
        try {
            const res = await apiFetch('/cst/schedules', {
                method: 'POST',
                body: JSON.stringify(schedule)
            });
            if (res.success) {
                fetchSchedules();
                toast.success('Schedule entry added');
            }
        } catch (error) {
            toast.error('Failed to add schedule');
        }
    };

    const updateSchedule = async (id: number, data: Partial<Schedule>) => {
        try {
            const res = await apiFetch(`/cst/schedules/${id}`, {
                method: 'PUT',
                body: JSON.stringify(data)
            });
            if (res.success) {
                setSchedules(prev => prev.map(s => s.id === id ? { ...s, ...data } : s));
                toast.success('Schedule updated');
            }
        } catch (error) {
            toast.error('Failed to update schedule');
        }
    };

    const deleteSchedule = async (id: number) => {
        try {
            const res = await apiFetch(`/cst/schedules/${id}`, { method: 'DELETE' });
            if (res.success) {
                setSchedules(prev => prev.filter(s => s.id !== id));
                toast.success('Schedule deleted');
            }
        } catch (error) {
            toast.error('Failed to delete schedule');
        }
    };

    return (
        <CSTScheduleContext.Provider value={{ schedules, isLoading, fetchSchedules, addSchedule, updateSchedule, deleteSchedule }}>
            {children}
        </CSTScheduleContext.Provider>
    );
}

export function useCSTSchedule() {
    const context = useContext(CSTScheduleContext);
    if (!context) throw new Error('useCSTSchedule must be used within CSTScheduleProvider');
    return context;
}
