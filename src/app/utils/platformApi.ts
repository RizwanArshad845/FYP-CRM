// Platform administrator session (plan 4.2): its own sessionStorage key, separate
// from the tenant tokens (crm_token:<slug>), and its own fetch helper.
import { ApiError } from './api';

const API_BASE: string = import.meta.env.VITE_API_URL || '/api';
const TOKEN_KEY = 'aicre_platform_token';
const ADMIN_KEY = 'aicre_platform_admin';

export interface PlatformAdmin { id: number; name: string; email: string }

export const getPlatformToken = (): string | null => sessionStorage.getItem(TOKEN_KEY);

export const getPlatformAdmin = (): PlatformAdmin | null => {
  try {
    return JSON.parse(sessionStorage.getItem(ADMIN_KEY) ?? 'null');
  } catch {
    return null;
  }
};

export const setPlatformSession = (token: string, admin: PlatformAdmin) => {
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(ADMIN_KEY, JSON.stringify(admin));
};

export const clearPlatformSession = () => {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(ADMIN_KEY);
};

/** GET/POST under /api/platform. A rejected token ends the platform session. */
export async function platformFetch(path: string, options: RequestInit = {}) {
  const token = getPlatformToken();
  const response = await fetch(`${API_BASE}/platform${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && token) clearPlatformSession();
    throw new ApiError(data?.error || `Request failed (${response.status})`, response.status, data?.code, data);
  }
  return data;
}
