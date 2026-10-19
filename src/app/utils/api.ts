import { slugFromPath } from './orgPath';

// Same-origin `/api` by default (Vercel and the Vite dev proxy).
// Set VITE_API_URL only when the API lives on a different origin.
const API_BASE: string = import.meta.env.VITE_API_URL || '/api';

// One token per organization (crm_token:<slug>), so tabs of different
// organizations in the same browser never log each other out.
// The slug comes from the URL; right after login/signup on an app-level page
// (/login, /signup) it comes from the session that was just started.
let activeSlug: string | null = null;
const tokenKey = () => `crm_token:${slugFromPath() ?? activeSlug ?? ''}`;

// "Remember me" keeps the token in localStorage (survives a browser restart);
// otherwise it lives in sessionStorage and ends with the tab.
export const getToken = (): string | null =>
    sessionStorage.getItem(tokenKey()) ?? localStorage.getItem(tokenKey());

export const setToken = (token: string, slug: string, remember = false) => {
    activeSlug = slug;
    const key = tokenKey();
    (remember ? localStorage : sessionStorage).setItem(key, token);
    (remember ? sessionStorage : localStorage).removeItem(key);
    clearApiCache();
};

export const clearToken = () => {
    const key = tokenKey();
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
    activeSlug = null;
    clearApiCache();
};

// Fired when the server rejects our token; AuthContext listens and logs out.
export const AUTH_EXPIRED_EVENT = 'auth:expired';

// --- PERFORMANCE OPTIMIZATIONS ---
// 1. In-memory SWR cache, keyed per token so data never crosses accounts
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL_MS = 15000;

// 2. In-flight request deduplication
const inFlightRequests = new Map<string, Promise<any>>();

// 3. Fetch timeout
const FETCH_TIMEOUT_MS = 30000;

export const clearApiCache = () => {
    cache.clear();
    inFlightRequests.clear();
};

export class ApiError extends Error {
    status: number;
    code?: string;
    /** Full JSON error body, for endpoints that return structured details */
    body?: any;
    constructor(message: string, status: number, code?: string, body?: any) {
        super(message);
        this.status = status;
        this.code = code;
        this.body = body;
    }
}

/**
 * Standardized API fetch wrapper with caching, deduplication and timeouts.
 */
export async function apiFetch(endpoint: string, options: RequestInit = {}) {
    const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const token = getToken();

    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...options.headers,
    };

    const isGet = !options.method || options.method.toUpperCase() === 'GET';
    const cacheKey = `${token ?? 'anon'}:${url}`;

    if (isGet) {
        const cached = cache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
            // Serve instantly, revalidate in the background
            executeNetworkFetch(url, options, headers, cacheKey, isGet, !!token).catch(() => { });
            return cached.data;
        }
    } else {
        // Any mutation invalidates everything; simple and consistent
        cache.clear();
    }

    if (isGet && inFlightRequests.has(cacheKey)) {
        return inFlightRequests.get(cacheKey);
    }

    const fetchPromise = executeNetworkFetch(url, options, headers, cacheKey, isGet, !!token);

    if (isGet) {
        inFlightRequests.set(cacheKey, fetchPromise);
        fetchPromise.finally(() => {
            inFlightRequests.delete(cacheKey);
        }).catch(() => { });
    }

    return fetchPromise;
}

async function executeNetworkFetch(
    url: string,
    options: RequestInit,
    headers: HeadersInit,
    cacheKey: string,
    isGet: boolean,
    sentToken: boolean,
) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
        const response = await fetch(url, { ...options, headers, signal: controller.signal });
        clearTimeout(timeoutId);

        const text = await response.text();
        let data: any = null;
        if (text) {
            try {
                data = JSON.parse(text);
            } catch {
                data = { error: text };
            }
        }

        if (!response.ok) {
            // A rejected token means the session is over; a 401 without one is just bad credentials.
            if (response.status === 401 && sentToken) {
                clearToken();
                window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
            }
            // An empty 5xx comes from the dev proxy / platform, not our API (which always sends JSON)
            const fallback = !data && response.status >= 500
                ? 'Cannot reach the API server. Is it running?'
                : `Request failed (${response.status})`;
            throw new ApiError(data?.error || fallback, response.status, data?.code, data);
        }

        if (isGet) {
            cache.set(cacheKey, { data, timestamp: Date.now() });
        }

        return data ?? { success: true };
    } catch (error: any) {
        clearTimeout(timeoutId);

        // Suppress errors while the page is unloading (aborted requests during navigation)
        if (typeof window !== 'undefined' && (window as any).isUnloading) {
            return new Promise(() => { });
        }

        if (error.name === 'AbortError') {
            throw new Error('The server took too long to respond. Please try again.');
        }

        console.error(`API Error [${url}]:`, error);
        throw error;
    }
}

export const eventsApi = {
    getAll: () => apiFetch('/events'),
    create: (data: unknown) => apiFetch('/events', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string | number, data: unknown) => apiFetch(`/events/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string | number) => apiFetch(`/events/${id}`, { method: 'DELETE' }),
};
