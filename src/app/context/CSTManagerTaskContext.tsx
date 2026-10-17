import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { apiFetch, getToken } from '../utils/api';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';

export type CSTTaskPriority = 'high' | 'medium' | 'low';
export type CSTTaskStatus   = 'pending' | 'in-progress' | 'completed' | 'missed';
export type CSTTaskOrigin   = 'self' | 'admin';

export interface CSTManagerTask {
    id: number;
    title: string;
    priority: CSTTaskPriority;
    status: CSTTaskStatus;
    dueDate: string;
    category: string;
    notes: string;
    assignedBy: CSTTaskOrigin;
    month: string;
}

// ── Context ────────────────────────────────────────────────────────────────────
interface CSTManagerTaskContextType {
    tasks: CSTManagerTask[];
    loading: boolean;
    addTask: (task: Omit<CSTManagerTask, 'id' | 'month'>, targetUserId?: number) => Promise<void>;
    updateTaskStatus: (id: number, status: CSTTaskStatus) => Promise<void>;
}

const CSTManagerTaskContext = createContext<CSTManagerTaskContextType | null>(null);

export function CSTManagerTaskProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const [tasks, setTasks] = useState<CSTManagerTask[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        if (!user) return;
        try {
            const res = await apiFetch(`/tasks?assigned_to=${user.id}`);
            if (res.success) {
                const mapped: CSTManagerTask[] = res.data.map((t: any) => ({
                    id: Number(t.id),
                    title: t.title,
                    priority: (t.priority || 'medium') as CSTTaskPriority,
                    status: t.status as CSTTaskStatus,
                    dueDate: t.due_date?.split('T')[0] || '',
                    category: t.category || 'General',
                    notes: t.description || '',
                    assignedBy: t.assigned_by !== user.id ? 'admin' : 'self',
                    month: t.due_date ? new Date(t.due_date).toLocaleString('en-US', { month: 'long', year: 'numeric' }) : ''
                }));
                setTasks(mapped);
            }
        } catch (error) {
            console.error('Failed to fetch tasks:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const token = getToken();
        if (token && user) {
            fetchData();
        } else {
            setTasks([]);
            setLoading(false);
        }
    }, [user]);

    const addTask = async (task: Omit<CSTManagerTask, 'id' | 'month'>, targetUserId?: number) => {
        try {
            const res = await apiFetch('/tasks', {
                method: 'POST',
                body: JSON.stringify({
                    title: task.title,
                    description: task.notes,
                    priority: task.priority,
                    category: task.category,
                    due_date: task.dueDate,
                    assigned_by: task.assignedBy,
                    assigned_to: targetUserId || user?.id
                })
            });

            if (res.success) {
                fetchData();
                toast.success('Task created');
            }
        } catch (error) {
            toast.error('Failed to create task');
        }
    };

    const updateTaskStatus = async (id: number, status: CSTTaskStatus) => {
        try {
            const res = await apiFetch(`/tasks/${id}/status`, {
                method: 'PATCH',
                body: JSON.stringify({ status })
            });

            if (res.success) {
                setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t));
                toast.success('Task updated');
            }
        } catch (error) {
            toast.error('Failed to update status');
        }
    };

    return (
        <CSTManagerTaskContext.Provider value={{ tasks, loading, addTask, updateTaskStatus }}>
            {children}
        </CSTManagerTaskContext.Provider>
    );
}


export function useCSTManagerTasks() {
    const ctx = useContext(CSTManagerTaskContext);
    if (!ctx) throw new Error('useCSTManagerTasks must be used inside CSTManagerTaskProvider');
    return ctx;
}
