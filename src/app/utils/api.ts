// ── Dynamic Port Resolution ──
// In Electron, the backend port is assigned dynamically.
// In dev mode (browser), fall back to 5000.
let _resolvedBaseUrl: string | null = null;
let _portPromise: Promise<string> | null = null;

async function resolveBaseUrl(): Promise<string> {
    if (_resolvedBaseUrl) return _resolvedBaseUrl;

    // Use the deployed Vercel backend URL
    _resolvedBaseUrl = 'https://crm-iota-olive.vercel.app/api';
    return _resolvedBaseUrl;
}

// Eagerly start resolution so it's ready by the time the first API call happens
function getBaseUrlPromise(): Promise<string> {
    if (!_portPromise) {
        _portPromise = resolveBaseUrl();
    }
    return _portPromise;
}
// Kick off immediately on module load
getBaseUrlPromise();

// --- PERFORMANCE OPTIMIZATIONS ---
// 1. In-Memory Cache for SWR (Stale-While-Revalidate) pattern
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL_MS = 15000; // 15 seconds

// 2. In-Flight Request Deduplication
const inFlightRequests = new Map<string, Promise<any>>();

// 3. Fetch Timeout
const FETCH_TIMEOUT_MS = 30000; // 30 seconds

/**
 * Standardized API fetch wrapper for Electron environment.
 * Includes Caching, Deduplication, and Timeouts for maximum performance.
 */
export async function apiFetch(endpoint: string, options: RequestInit = {}) {
    const baseUrl = await getBaseUrlPromise();
    const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

    // Get token from sessionStorage
    const token = sessionStorage.getItem('crm_token');

    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...options.headers,
    };

    const isGet = !options.method || options.method.toUpperCase() === 'GET';
    const cacheKey = url; // Simple cache key, assuming headers don't strictly vary per user session in this context

    // --- 1. SWR CACHE CHECK ---
    if (isGet) {
        const cached = cache.get(cacheKey);
        // If we have a recent cache, return it instantly to make UI feel snappy
        if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
            // Silently revalidate in background (fire and forget)
            // This ensures the NEXT time they click, it has the absolute latest data
            executeNetworkFetch(url, options, headers, cacheKey, isGet).catch(() => { });
            return cached.data;
        }
    } else {
        // If it's a POST, PUT, DELETE, clear the entire cache so fresh data is fetched next time
        // This is a brutal but effective way to ensure consistency after a mutation
        cache.clear();
    }

    // --- 2. IN-FLIGHT DEDUPLICATION ---
    if (isGet && inFlightRequests.has(cacheKey)) {
        return inFlightRequests.get(cacheKey); // Share the exact same promise!
    }

    // --- 3. EXECUTE NETWORK REQUEST ---
    const fetchPromise = executeNetworkFetch(url, options, headers, cacheKey, isGet);

    if (isGet) {
        inFlightRequests.set(cacheKey, fetchPromise);
        fetchPromise.finally(() => {
            inFlightRequests.delete(cacheKey);
        });
    }

    return fetchPromise;
}

/**
 * The actual network logic, wrapped to be reused by standard fetch and background SWR
 */
async function executeNetworkFetch(url: string, options: RequestInit, headers: any, cacheKey: string, isGet: boolean) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
        const response = await fetch(url, {
            ...options,
            headers,
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        const data = await response.json();

        if (!response.ok) {
            let errorMsg = data.error || `HTTP error! status: ${response.status}`;
            if (data.detail) errorMsg += ` (Details: ${data.detail})`;
            throw new Error(errorMsg);
        }

        // Save successful GET requests to cache
        if (isGet) {
            cache.set(cacheKey, { data, timestamp: Date.now() });
        }

        return data;
    } catch (error: any) {
        clearTimeout(timeoutId);

        // Suppress errors if the window is currently unloading/reloading
        // This prevents scary "Failed to fetch" toasts when Chromium aborts requests during navigation
        if (typeof window !== 'undefined' && (window as any).isUnloading) {
            return new Promise(() => { });
        }

        if (error.name === 'AbortError') {
            console.error(`API Timeout [${url}]: The database took too long to respond.`);
            throw new Error('Database connection timed out. Please try again.');
        }

        console.error(`API Error [${url}]:`, error);
        throw error;
    }
}
