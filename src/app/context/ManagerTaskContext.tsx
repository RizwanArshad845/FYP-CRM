import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { apiFetch } from '../utils/api';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';

export type TaskPriority = 'high' | 'medium' | 'low';
export type TaskStatus   = 'pending' | 'in-progress' | 'completed' | 'missed';
export type TaskOrigin   = 'self' | 'admin';

export interface ManagerTask {
    id: number;
    title: string;
    priority: TaskPriority;
    status: TaskStatus;
    dueDate: string;
    category: string;
    notes: string;
    assignedBy: TaskOrigin;
    month: string; // "March 2026"
}

// ── Seed data ──────────────────────────────────────────────────────────────────
// ── Context ────────────────────────────────────────────────────────────────────
interface ManagerTaskContextType {
    tasks: ManagerTask[];
    loading: boolean;
    addTask: (task: Omit<ManagerTask, 'id' | 'month'>, targetUserId?: number) => Promise<void>;
    updateTask: (task: ManagerTask) => Promise<void>;
    updateTaskStatus: (id: number, status: TaskStatus) => Promise<void>;
    deleteTask: (id: number) => Promise<void>;
}

const ManagerTaskContext = createContext<ManagerTaskContextType | null>(null);

export function ManagerTaskProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const [tasks, setTasks] = useState<ManagerTask[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchTasks = async () => {
        if (!user) return;
        try {
            const res = await apiFetch(`/tasks?assigned_to=${user.id}`);
            if (res.success) {
                const mapped: ManagerTask[] = res.data.map((t: any) => ({
                    id: Number(t.id),
                    title: t.title,
                    priority: (t.priority || 'medium') as TaskPriority,
                    status: t.status as TaskStatus,
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
        const token = sessionStorage.getItem('crm_token');
        if (token && user) {
            fetchTasks();
        } else if (!token) {
            setLoading(false);
        }
    }, [user]);

    const addTask = async (task: Omit<ManagerTask, 'id' | 'month'>, targetUserId?: number) => {
        try {
            const res = await apiFetch('/tasks', {
                method: 'POST',
                body: JSON.stringify({
                    title: task.title,
                    description: task.notes,
                    priority: task.priority,
                    category: task.category,
                    due_date: task.dueDate,
                    assigned_by: user?.id,
                    assigned_to: targetUserId || user?.id
                })
            });

            if (res.success) {
                fetchTasks();
                toast.success('Task created');
            }
        } catch (error) {
            toast.error('Failed to create task');
        }
    };

    const updateTask = async (task: ManagerTask) => {
        try {
            const res = await apiFetch(`/tasks/${task.id}`, {
                method: 'PUT',
                body: JSON.stringify({
                    title: task.title,
                    description: task.notes, // Backend expects 'description'
                    priority: task.priority,
                    category: task.category,
                    due_date: task.dueDate   // Backend expects 'due_date'
                })
            });

            if (res.success) {
                fetchTasks();
                toast.success('Task updated');
            }
        } catch (error) {
            toast.error('Failed to update task');
        }
    };

    const updateTaskStatus = async (id: number, status: TaskStatus) => {
        try {
            const res = await apiFetch(`/tasks/${id}/status`, {
                method: 'PATCH',
                body: JSON.stringify({ status })
            });

            if (res.success) {
                setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t));
                toast.success('Status updated');
            }
        } catch (error) {
            toast.error('Failed to update status');
        }
    };

    const deleteTask = async (id: number) => {
        try {
            const res = await apiFetch(`/tasks/${id}`, { method: 'DELETE' });
            if (res.success) {
                setTasks(prev => prev.filter(t => t.id !== id));
                toast.success('Task deleted');
            }
        } catch (error) {
            toast.error('Failed to delete task');
        }
    };

    return (
        <ManagerTaskContext.Provider value={{ 
            tasks, 
            loading, 
            addTask, 
            updateTask,
            updateTaskStatus,
            deleteTask
        }}>
            {children}
        </ManagerTaskContext.Provider>
    );
}


export function useManagerTasks() {
    const ctx = useContext(ManagerTaskContext);
    if (!ctx) throw new Error('useManagerTasks must be used inside ManagerTaskProvider');
    return ctx;
}
