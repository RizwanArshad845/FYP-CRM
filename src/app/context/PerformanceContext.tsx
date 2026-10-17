import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiFetch, getToken } from '../utils/api';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';

export interface SalesStat {
    id: number;
    name: string;
    role: string;
    monthly_revenue: number;
    target_revenue: number;
    deals_closed: number;
    calls_made: number;
    tasks_completed: number;
    tasks_missed: number;
    daily_attendance_score: number;
    weekly_attendance_score: number;
    monthly_attendance_score: number;
}

export interface CSTStat {
    id: number;
    name: string;
    role: string;
    clients_managed: number;
    satisfaction_score: number;
    tasks_completed: number;
    tasks_missed: number;
    daily_attendance_score: number;
    weekly_attendance_score: number;
    monthly_attendance_score: number;
}

export interface FinanceStat {
    id: number;
    name: string;
    role: string;
    payments_processed: number;
    tasks_completed: number;
    tasks_missed: number;
    daily_attendance_score: number;
    weekly_attendance_score: number;
    monthly_attendance_score: number;
}

export interface TaskDetail {
    id: number;
    employee_name: string;
    title: string;
    priority: 'high' | 'medium' | 'low';
    status: 'completed' | 'in-progress' | 'missed' | 'pending';
    due_date: string;
    category: string;
}

export interface CompanyMetrics {
    total_revenue: number;
    revenue_target: number;
    active_clients: number;
    total_employees: number;
    client_retention: number;
    employee_satisfaction: number;
}

interface PerformanceContextType {
    stats: {
        sales: SalesStat[];
        cst: CSTStat[];
        finance: FinanceStat[];
    };
    taskDetails: TaskDetail[];
    companyMetrics: CompanyMetrics | null;
    attendanceGrid: any[];
    isLoading: boolean;
    fetchStats: () => Promise<void>;
    fetchTaskDetails: () => Promise<void>;
    fetchCompanyMetrics: () => Promise<void>;
    fetchPerformanceGrid: () => Promise<void>;
}

const PerformanceContext = createContext<PerformanceContextType | undefined>(undefined);

export function PerformanceProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const [stats, setStats] = useState<{ sales: SalesStat[]; cst: CSTStat[]; finance: FinanceStat[] }>({
        sales: [],
        cst: [],
        finance: []
    });
    const [taskDetails, setTaskDetails] = useState<TaskDetail[]>([]);
    const [companyMetrics, setCompanyMetrics] = useState<CompanyMetrics | null>(null);
    const [attendanceGrid, setAttendanceGrid] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchStats = async () => {
        setIsLoading(true);
        try {
            const res = await apiFetch('/admin/performance-stats');
            if (res.success) {
                setStats(res.data);
            }
        } catch (error: any) {
            console.error('Failed to fetch performance stats:', error);
            toast.error(error.message || 'Failed to load performance stats');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchTaskDetails = async () => {
        try {
            const res = await apiFetch('/admin/task-details');
            if (res.success) {
                setTaskDetails(res.data);
            }
        } catch (error: any) {
            console.error('Failed to fetch task details:', error);
            toast.error('Could not load task breakdown');
        }
    };

    const fetchCompanyMetrics = async () => {
        try {
            const res = await apiFetch('/admin/company-metrics');
            if (res.success) {
                setCompanyMetrics(res.data);
            }
        } catch (error: any) {
            console.error('Failed to fetch company metrics:', error);
            toast.error('Failed to load company overview');
        }
    };

    const fetchPerformanceGrid = async () => {
        try {
            const res = await apiFetch('/attendance/performance-grid');
            if (res.success) {
                setAttendanceGrid(res.data);
            }
        } catch (error: any) {
            console.error('Failed to fetch attendance grid:', error);
            const msg = error.details || 'Attendance grid data failed to load';
            toast.error(msg);
        }
    };

    useEffect(() => {
        // Admin-only reports; other roles would just get 403s.
        if (getToken() && user?.role === 'admin') {
            fetchStats();
            fetchTaskDetails();
            fetchCompanyMetrics();
            fetchPerformanceGrid();
        } else {
            setIsLoading(false);
        }
    }, []);

    return (
        <PerformanceContext.Provider value={{ 
            stats, 
            taskDetails, 
            companyMetrics, 
            attendanceGrid,
            isLoading, 
            fetchStats, 
            fetchTaskDetails, 
            fetchCompanyMetrics,
            fetchPerformanceGrid
        }}>
            {children}
        </PerformanceContext.Provider>
    );
}

export function usePerformance() {
    const context = useContext(PerformanceContext);
    if (!context) throw new Error('usePerformance must be used within PerformanceProvider');
    return context;
}
