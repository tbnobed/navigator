/**
 * Resolves the base URL of the Indoora sites API, which is served by the
 * wayfinder-web server (NOT the api-server artifact).
 *
 * Production builds of the mobile app must talk to the self-hosted server —
 * set EXPO_PUBLIC_API_URL (e.g. https://nav.obtv.io) at build time.
 *
 * In development, `EXPO_PUBLIC_DOMAIN` (the Replit dev domain) is injected by
 * the dev script; the web artifact lives under its `/go` base path there.
 */
export function getApiUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_API_URL;
  if (explicit) return explicit.replace(/\/$/, '');
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) {
    const clean = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
    return `https://${clean}/go`;
  }
  // Web fallback (running through the proxy): relative URLs resolve correctly.
  return '';
}

/** Base URL for the sites API, e.g. https://<domain>/api */
export const API_BASE = `${getApiUrl()}/api`;

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers:
      init?.body && !(init.body instanceof FormData)
        ? { 'Content-Type': 'application/json' }
        : undefined,
    ...init,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  }
  return data as T;
}

/** Build the URL for an uploaded floor-plan / poster asset. */
export function uploadUrl(imageFile: string): string {
  return `${API_BASE}/uploads/${imageFile}`;
}
