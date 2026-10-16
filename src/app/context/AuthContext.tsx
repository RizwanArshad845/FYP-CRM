import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types/crm';
import { apiFetch } from '../utils/api';
import { toast } from 'sonner';

interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    staleSession: { name: string; clockInTime: string } | null;
    login: (email: string, password: string) => Promise<boolean>;
    logout: (clockOutAlso?: boolean) => Promise<void>;
    clockIn: () => Promise<boolean>;
    clockOut: (silent?: boolean) => Promise<boolean>;
    breakIn: () => Promise<boolean>;
    breakOut: () => Promise<boolean>;
    clearStaleSession: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const SESSION_KEY = 'crm_clock_session';
const TOKEN_KEY = 'crm_token';

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [staleSession, setStaleSession] = useState<{ name: string; clockInTime: string } | null>(null);

    // Initial load: check for token and get user profile
    useEffect(() => {
        const checkAuth = async () => {
            const token = sessionStorage.getItem(TOKEN_KEY);
            if (!token) {
                setIsLoading(false);
                return;
            }

            try {
                // Parallelize profile and status check
                const [profileRes, statusRes] = await Promise.all([
                    apiFetch('/auth/me'),
                    apiFetch('/attendance/status')
                ]);

                if (profileRes.success) {
                    const u = profileRes.data;
                    setUser({
                        id: u.id,
                        first_name: u.first_name,
                        last_name: u.last_name,
                        name: `${u.first_name} ${u.last_name}`,
                        email: u.email,
                        role_id: u.role_id,
                        role: u.role as any,
                        department: u.department,
                        status: u.status as any,
                        clockedIn: statusRes.success && statusRes.isClockedIn,
                        clockInTime: statusRes.activeSession?.clock_in,
                        onBreak: statusRes.success && statusRes.onBreak,
                        breakInTime: statusRes.activeBreak?.break_in
                    });
                }
            } catch (error) {
                console.error('Auth check failed:', error);
                sessionStorage.removeItem(TOKEN_KEY);
            } finally {
                setIsLoading(false);
            }
        };
        checkAuth();
    }, []);


    const login = async (email: string, password: string): Promise<boolean> => {
        try {
            const res = await apiFetch('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email, password })
            });

            if (res.success) {
                sessionStorage.setItem(TOKEN_KEY, res.token);
                const u = res.user;

                // Check status for this newly logged in user
                const statusRes = await apiFetch('/attendance/status', {
                    headers: { 'Authorization': `Bearer ${res.token}` }
                });

                setUser({
                    id: u.id,
                    first_name: u.first_name,
                    last_name: u.last_name,
                    name: `${u.first_name} ${u.last_name}`,
                    email: u.email,
                    role_id: u.role_id,
                    role: u.role as any,
                    department: u.department,
                    status: u.status as any,
                    clockedIn: statusRes.success && statusRes.isClockedIn,
                    clockInTime: statusRes.activeSession?.clock_in,
                    onBreak: statusRes.success && statusRes.onBreak,
                    breakInTime: statusRes.activeBreak?.break_in
                });
                toast.success(`Welcome back, ${u.first_name}!`);
                return true;
            } else {
                toast.error(res.error || 'Invalid credentials');
                return false;
            }
        } catch (error: any) {
            toast.error(error.message || 'Invalid credentials');
            return false;
        }
    };

    const logout = async (clockOutAlso = true) => {
        const token = sessionStorage.getItem(TOKEN_KEY);

        // 1. INSTANT UI RESET: Don't wait for the server
        sessionStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(SESSION_KEY);
        setUser(null);
        toast.info('Logged out successfully');

        // 2. BACKGROUND WORK: Clock out silently if needed
        if (token && clockOutAlso) {
            // Pass token explicitly because sessionStorage might be cleared by the time the request starts
            apiFetch('/attendance/clock-out', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            }).catch(e => console.error('Silent logout clockout failed', e));
        }
    };

    const clockIn = async (): Promise<boolean> => {
        if (!user) return false;
        try {
            const res = await apiFetch('/attendance/clock-in', { method: 'POST' });
            if (res.success) {
                const now = res.data.clock_in; // Correct field name
                localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: user.id, name: user.name, clockInTime: now }));
                setUser({ ...user, clockedIn: true, clockInTime: now, clockOutTime: undefined });
                toast.success('Shift started');
                return true;
            } else {
                toast.error(res.error || 'Could not clock in');
                return false;
            }
        } catch (error: any) {
            toast.error(error.message || 'Could not clock in');
            return false;
        }
    };

    const clockOut = async (silent = false): Promise<boolean> => {
        if (!user) return false;
        try {
            const res = await apiFetch('/attendance/clock-out', { method: 'POST' });
            if (res.success) {
                localStorage.removeItem(SESSION_KEY);
                setUser({ ...user, clockedIn: false, clockOutTime: res.data.clock_out, onBreak: false, breakInTime: undefined });
                if (!silent) toast.success('Shift completed');
                return true;
            } else {
                if (!silent) toast.error(res.error || 'Could not clock out');
                return false;
            }
        } catch (error: any) {
            if (!silent) toast.error(error.message || 'Could not clock out');
            return false;
        }
    };

    const breakIn = async (): Promise<boolean> => {
        if (!user) return false;
        try {
            const res = await apiFetch('/attendance/break-in', { method: 'POST' });
            if (res.success) {
                const now = res.data.break_in;
                setUser({ ...user, onBreak: true, breakInTime: now });
                toast.success('Break started');
                return true;
            } else {
                toast.error(res.error || 'Could not start break');
                return false;
            }
        } catch (error: any) {
            toast.error(error.message || 'Could not start break');
            return false;
        }
    };

    const breakOut = async (): Promise<boolean> => {
        if (!user) return false;
        try {
            const res = await apiFetch('/attendance/break-out', { method: 'POST' });
            if (res.success) {
                setUser({ ...user, onBreak: false, breakInTime: undefined });
                toast.success('Break ended');
                return true;
            } else {
                toast.error(res.error || 'Could not end break');
                return false;
            }
        } catch (error: any) {
            toast.error(error.message || 'Could not end break');
            return false;
        }
    };

    const clearStaleSession = () => {
        localStorage.removeItem(SESSION_KEY);
        setStaleSession(null);
    };

    return (
        <AuthContext.Provider value={{ user, isLoading, staleSession, login, logout, clockIn, clockOut, breakIn, breakOut, clearStaleSession }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
    return context;
}