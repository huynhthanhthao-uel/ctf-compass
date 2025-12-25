import { useState, useEffect, useCallback } from 'react';
import { getBackendUrlFromStorage } from '@/lib/backend-url';

export type BackendMode = 'backend' | 'demo';

interface BackendStatusResult {
  mode: BackendMode;
  isConnected: boolean;
  isLoading: boolean;
  backendUrl: string | null;
  error: string | null;
  retry: () => Promise<void>;
}

// Check if Docker backend is available
async function checkDockerBackend(): Promise<{ ok: boolean; error: string | null }> {
  try {
    const backendUrl = getBackendUrlFromStorage();
    if (!backendUrl) {
      return { ok: false, error: 'No backend URL configured. Go to Settings to configure.' };
    }

    const response = await fetch(`${backendUrl}/api/health`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      return { ok: false, error: `Backend returned HTTP ${response.status}` };
    }

    const data = await response.json().catch(() => null);
    if (data?.status === 'healthy') {
      return { ok: true, error: null };
    }
    
    return { ok: false, error: 'Backend not reporting healthy status' };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Connection failed';
    return { ok: false, error: message };
  }
}

let globalMode: BackendMode = 'demo';
let globalLoading = true;
let globalError: string | null = null;
let listeners: Set<() => void> = new Set();

function notifyListeners() {
  listeners.forEach(fn => fn());
}

async function detectBackendMode(): Promise<{ mode: BackendMode; error: string | null }> {
  const backendUrl = getBackendUrlFromStorage();
  
  if (!backendUrl) {
    console.log('[Backend] No backend URL configured - demo mode');
    return { mode: 'demo', error: 'No backend URL configured. Go to Settings → Docker Backend URL.' };
  }

  const result = await checkDockerBackend();
  if (result.ok) {
    console.log('[Backend] Docker backend connected:', backendUrl);
    return { mode: 'backend', error: null };
  }

  console.log('[Backend] Docker backend not available:', result.error);
  return { mode: 'demo', error: result.error };
}

// Initialize detection
let initPromise: Promise<void> | null = null;

function initDetection(): Promise<void> {
  if (initPromise) return initPromise;
  
  initPromise = detectBackendMode().then(({ mode, error }) => {
    globalMode = mode;
    globalError = error;
    globalLoading = false;
    notifyListeners();
  });
  
  return initPromise;
}

// Start detection immediately
initDetection();

// Re-check every 30 seconds
setInterval(async () => {
  const { mode, error } = await detectBackendMode();
  if (mode !== globalMode || error !== globalError) {
    globalMode = mode;
    globalError = error;
    notifyListeners();
  }
}, 30000);

export function useBackendStatus(): BackendStatusResult {
  const [, forceUpdate] = useState({});

  useEffect(() => {
    const listener = () => forceUpdate({});
    listeners.add(listener);
    
    // Ensure initialization
    initDetection();
    
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const retry = useCallback(async () => {
    globalLoading = true;
    notifyListeners();
    
    const { mode, error } = await detectBackendMode();
    globalMode = mode;
    globalError = error;
    globalLoading = false;
    notifyListeners();
  }, []);

  return {
    mode: globalMode,
    isConnected: globalMode === 'backend',
    isLoading: globalLoading,
    backendUrl: getBackendUrlFromStorage(),
    error: globalError,
    retry,
  };
}

// Export functions for use in non-hook contexts
export async function getBackendMode(): Promise<BackendMode> {
  await initDetection();
  return globalMode;
}

export function getCurrentBackendMode(): BackendMode {
  return globalMode;
}

// Force re-check backend status
export async function refreshBackendStatus(): Promise<{ mode: BackendMode; error: string | null }> {
  const result = await detectBackendMode();
  globalMode = result.mode;
  globalError = result.error;
  globalLoading = false;
  notifyListeners();
  return result;
}
