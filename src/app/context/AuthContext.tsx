import { createContext, useCallback, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types/crm';
import { apiFetch, getToken, setToken, clearToken, AUTH_EXPIRED_EVENT } from '../utils/api';
import { toast } from 'sonner';
import { orgPath, slugFromPath } from '../utils/orgPath';

interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    staleSession: { name: string; clockInTime: string } | null;
    /** `organization` is the slug of an organization's own login URL, if any */
    login: (email: string, password: string, remember?: boolean, organization?: string) => Promise<User | null>;
    /** Begin a session from a token + session profile (login or signup response) */
    startSession: (token: string, sessionUser: any, remember?: boolean) => Promise<User>;
    /** Merge a fresh session profile from the server (e.g. after a password change) */
    applySession: (sessionUser: any) => void;
    logout: (clockOutAlso?: boolean) => Promise<void>;
    clockIn: () => Promise<boolean>;
    clockOut: (silent?: boolean) => Promise<boolean>;
    breakIn: () => Promise<boolean>;
    breakOut: () => Promise<boolean>;
    clearStaleSession: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const SESSION_KEY = 'crm_clock_session';

// Profile fields from the server session (everything except clock state).
const sessionFields = (u: any) => ({
    id: u.id,
    first_name: u.first_name,
    last_name: u.last_name,
    name: `${u.first_name} ${u.last_name}`,
    email: u.email,
    role_id: u.role_id,
    role: u.role,
    department: u.department,
    status: u.status,
    tier: u.tier,
    mustChangePassword: Boolean(u.mustChangePassword),
    onboardingCompleted: u.onboardingCompleted !== false,
    organization: u.organization,
    portals: u.portals ?? [],
    allowedActions: u.allowedActions,
});

// Builds the client-side user from a session profile plus the attendance status response.
const toUser = (u: any, statusRes: any): User => ({
    ...sessionFields(u),
    clockedIn: Boolean(statusRes?.success && statusRes.isClockedIn),
    clockInTime: statusRes?.activeSession?.clock_in,
    onBreak: Boolean(statusRes?.success && statusRes.onBreak),
    breakInTime: statusRes?.activeBreak?.break_in,
});

// Attendance is blocked until a temporary password is changed, so skip it then.
const fetchStatus = (u: any) =>
    u.mustChangePassword ? Promise.resolve(null) : apiFetch('/attendance/status').catch(() => null);

// The next step in order: password change, onboarding, clock-in, dashboard.
const nextStepFor = (user: User): string => {
    if (user.mustChangePassword) return '/change-password';
    if (user.role === 'admin' && user.onboardingCompleted === false) return '/onboarding';
    if (!user.clockedIn) return '/clock-in';
    return '/dashboard';
};

/** Where a signed-in user must go next, under their organization's URL. */
export const nextRouteFor = (user: User): string => orgPath(user.organization?.slug, nextStepFor(user));

/** A blocking pre-dashboard step (password change / onboarding), or null. */
export const pendingSetupRoute = (user: User): string | null => {
    const step = nextStepFor(user);
    return step === '/change-password' || step === '/onboarding' ? orgPath(user.organization?.slug, step) : null;
};

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [staleSession, setStaleSession] = useState<{ name: string; clockInTime: string } | null>(null);

    // Initial load: check for token and get user profile
    useEffect(() => {
        const checkAuth = async () => {
            if (!getToken()) {
                setIsLoading(false);
                return;
            }

            try {
                const profileRes = await apiFetch('/auth/me');
                if (profileRes.success) {
                    setUser(toUser(profileRes.data, await fetchStatus(profileRes.data)));
                }
            } catch (error) {
                console.error('Auth check failed:', error);
                clearToken();
            } finally {
                setIsLoading(false);
            }
        };
        checkAuth();
    }, []);

    // apiFetch signals a rejected token; drop the session so pages redirect to /login.
    useEffect(() => {
        const onExpired = () => {
            localStorage.removeItem(SESSION_KEY);
            setUser((prev) => {
                if (prev) toast.error('Your session has expired. Please log in again.');
                return null;
            });
        };
        window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
        return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
    }, []);

    const startSession = async (token: string, sessionUser: any, remember = false): Promise<User> => {
        setToken(token, sessionUser.organization?.slug ?? '', remember);
        const next = toUser(sessionUser, await fetchStatus(sessionUser));
        setUser(next);
        return next;
    };

    const applySession = (sessionUser: any) => {
        setUser((prev) => (prev ? { ...prev, ...sessionFields(sessionUser) } : prev));
    };

    const login = async (email: string, password: string, remember = false, organization?: string): Promise<User | null> => {
        try {
            const res = await apiFetch('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email, password, ...(organization && { organization }) })
            });
            const next = await startSession(res.token, res.user, remember);
            toast.success(`Welcome back, ${res.user.first_name}!`);
            return next;
        } catch (error: any) {
            toast.error(error.message || 'Invalid credentials');
            return null;
        }
    };

    const logout = async (clockOutAlso = true) => {
        const token = getToken();

        // 1. INSTANT UI RESET: Don't wait for the server
        clearToken();
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
        <AuthContext.Provider value={{ user, isLoading, staleSession, login, startSession, applySession, logout, clockIn, clockOut, breakIn, breakOut, clearStaleSession }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
    return context;
}

/** Builds app paths under the current organization's URL (/<slug>/...). */
export function useOrgPath() {
    const { user } = useAuth();
    const slug = user?.organization?.slug;
    return useCallback((path: string) => orgPath(slug ?? slugFromPath(), path), [slug]);
}
