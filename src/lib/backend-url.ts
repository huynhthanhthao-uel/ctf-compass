// Utility helpers for storing and passing the Docker backend URL (user-configurable)

const STORAGE_KEY = 'ctf_backend_url';

function stripTrailingSlash(url: string) {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

/**
 * Normalizes and validates a backend URL.
 * - Accepts full URLs: https://example.com:8000
 * - Accepts host[:port] and auto-adds http://
 * Returns a normalized absolute URL without trailing slash, or null if invalid.
 */
export function normalizeBackendUrl(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  const withScheme = raw.startsWith('http://') || raw.startsWith('https://') ? raw : `http://${raw}`;

  try {
    const url = new URL(withScheme);
    if (!url.hostname) return null;
    return stripTrailingSlash(url.toString());
  } catch {
    return null;
  }
}

export function getBackendUrlFromStorage(): string | null {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return null;

  const normalized = normalizeBackendUrl(stored);
  if (!normalized) {
    // Clean bad old values like "bimat"
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }

  // Keep storage normalized
  if (normalized !== stored) {
    localStorage.setItem(STORAGE_KEY, normalized);
  }

  return normalized;
}

export function setBackendUrlToStorage(value: string) {
  const normalized = normalizeBackendUrl(value);
  if (!normalized) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  localStorage.setItem(STORAGE_KEY, normalized);
}

export function getBackendUrlHeaders(): Record<string, string> | undefined {
  const backendUrl = getBackendUrlFromStorage();
  return backendUrl ? { 'x-backend-url': backendUrl } : undefined;
}
