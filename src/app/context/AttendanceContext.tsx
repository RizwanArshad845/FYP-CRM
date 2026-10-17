import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiFetch, getToken } from '../utils/api';
import { toast } from 'sonner';

export interface AttendanceRecord {
    id: number;
    user_id: number;
    user_name: string;
    department: string;
    date: string;
    clock_in_time: string | null;
    clock_out_time: string | null;
    total_hours: number | null;
    status: 'on-time' | 'tardy' | 'absent';
}

interface AttendanceContextType {
    records: AttendanceRecord[];
    isLoading: boolean;
    fetchRecords: (params?: { department?: string; date?: string }) => Promise<void>;
}

const AttendanceContext = createContext<AttendanceContextType | undefined>(undefined);

export function AttendanceProvider({ children }: { children: ReactNode }) {
    const [records, setRecords] = useState<AttendanceRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchRecords = async (params?: { department?: string; date?: string }) => {
        setIsLoading(true);
        try {
            let url = '/attendance/all'; // Assuming an endpoint that returns all logs for admin
            const query = new URLSearchParams();
            if (params?.department) query.append('department', params.department);
            if (params?.date) query.append('date', params.date);
            if (query.toString()) url += `?${query.toString()}`;

            const res = await apiFetch(url);
            if (res.success) {
                // Map backend to frontend types
                const mapped = res.data.map((r: any) => ({
                    id: r.id,
                    user_id: r.user_id,
                    user_name: r.user_name,
                    department: r.department,
                    date: r.date.split('T')[0],
                    clock_in_time: r.clock_in ? new Date(r.clock_in).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }) : null,
                    clock_out_time: r.clock_out ? new Date(r.clock_out).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }) : null,
                    total_hours: r.total_hours != null ? Number(r.total_hours) : null,
                    status: r.status
                }));
                setRecords(mapped);
            }
        } catch (error) {
            console.error('Failed to fetch attendance:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const token = getToken();
        if (token) {
            fetchRecords();
        } else {
            setIsLoading(false);
        }
    }, []);

    return (
        <AttendanceContext.Provider value={{ records, isLoading, fetchRecords }}>
            {children}
        </AttendanceContext.Provider>
    );
}

export function useAttendance() {
    const context = useContext(AttendanceContext);
    if (!context) throw new Error('useAttendance must be used within AttendanceProvider');
    return context;
}
