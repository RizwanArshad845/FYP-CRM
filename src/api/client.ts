/**
 * Base API Client connecting the React Frontend to the Local Express Backend.
 * The backend port is assigned dynamically by Electron to avoid port conflicts.
 */

// ── Dynamic Port Resolution ──
let _resolvedBaseUrl: string | null = null;
let _portPromise: Promise<string> | null = null;

async function resolveBaseUrl(): Promise<string> {
  if (_resolvedBaseUrl) return _resolvedBaseUrl;
  _resolvedBaseUrl = 'https://crm-iota-olive.vercel.app/api';
  return _resolvedBaseUrl;
}

function getBaseUrlPromise(): Promise<string> {
  if (!_portPromise) {
    _portPromise = resolveBaseUrl();
  }
  return _portPromise;
}
// Kick off immediately
getBaseUrlPromise();

export const apiClient = {
  async get(endpoint: string) {
    const BASE_URL = await getBaseUrlPromise();
    const token = sessionStorage.getItem('crm_token');
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    });
    if (!res.ok) throw new Error(`GET ${endpoint} failed with status ${res.status}`);
    return res.json();
  },

  async post(endpoint: string, body: any) {
    const BASE_URL = await getBaseUrlPromise();
    const token = sessionStorage.getItem('crm_token');
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`POST ${endpoint} failed with status ${res.status}`);
    return res.json();
  },

  async patch(endpoint: string, body: any) {
    const BASE_URL = await getBaseUrlPromise();
    const token = sessionStorage.getItem('crm_token');
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`PATCH ${endpoint} failed with status ${res.status}`);
    return res.json();
  },

  async put(endpoint: string, body: any) {
    const BASE_URL = await getBaseUrlPromise();
    const token = sessionStorage.getItem('crm_token');
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`PUT ${endpoint} failed with status ${res.status}`);
    return res.json();
  },

  async delete(endpoint: string) {
    const BASE_URL = await getBaseUrlPromise();
    const token = sessionStorage.getItem('crm_token');
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'DELETE',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    });
    if (!res.ok) throw new Error(`DELETE ${endpoint} failed with status ${res.status}`);
    return res.json();
  }
};

export const eventsApi = {
  getAll: () => apiClient.get('/events'),
  create: (data: any) => apiClient.post('/events', data),
  update: (id: string | number, data: any) => apiClient.put(`/events/${id}`, data),
  delete: (id: string | number) => apiClient.delete(`/events/${id}`),
};
