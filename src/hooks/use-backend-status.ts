import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type BackendMode = 'backend' | 'cloud' | 'demo';

interface BackendStatusResult {
  mode: BackendMode;
  isConnected: boolean;
  isLoading: boolean;
  retry: () => Promise<void>;
}

// Check if Docker backend is available
async function checkDockerBackend(): Promise<boolean> {
  try {
    const response = await fetch('/api/health', { 
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    });
    
    if (!response.ok) return false;
    
    const text = await response.text();
    
    // Vite returns HTML for unknown routes
    if (text.trimStart().startsWith('<!') || text.trimStart().startsWith('<html')) {
      return false;
    }

    // Try parsing JSON - real backend returns JSON
    try {
      JSON.parse(text);
      return true;
    } catch {
      return false;
    }
  } catch {
    return false;
  }
}

// Check if Lovable Cloud edge functions are available
async function checkCloudBackend(): Promise<boolean> {
  try {
    // Get backend URL from localStorage
    const backendUrl = localStorage.getItem('ctf_backend_url');
    const headers = backendUrl ? { 'x-backend-url': backendUrl } : undefined;
    
    const { data, error } = await supabase.functions.invoke('sandbox-terminal', {
      body: { job_id: 'health-check', tool: 'echo', args: ['ok'] },
      headers,
    });
    
    if (error) return false;
    
    // Check if we got a valid response (exit_code exists)
    return typeof data?.exit_code === 'number';
  } catch {
    return false;
  }
}

// Singleton state to share across components
let globalMode: BackendMode = 'demo';
let globalLoading = true;
let listeners: Set<() => void> = new Set();

function notifyListeners() {
  listeners.forEach(fn => fn());
}

async function detectBackendMode(): Promise<BackendMode> {
  // Check Docker backend first (preferred for local deployment)
  const dockerOk = await checkDockerBackend();
  if (dockerOk) {
    console.log('[Backend] Docker backend detected');
    return 'backend';
  }

  // Check Lovable Cloud next
  const cloudOk = await checkCloudBackend();
  if (cloudOk) {
    console.log('[Backend] Lovable Cloud detected');
    return 'cloud';
  }

  // Fallback to demo mode
  console.log('[Backend] Using demo mode');
  return 'demo';
}

// Initialize detection
let initPromise: Promise<void> | null = null;

function initDetection(): Promise<void> {
  if (initPromise) return initPromise;
  
  initPromise = detectBackendMode().then(mode => {
    globalMode = mode;
    globalLoading = false;
    notifyListeners();
  });
  
  return initPromise;
}

// Start detection immediately
initDetection();

// Re-check every 30 seconds
setInterval(async () => {
  const newMode = await detectBackendMode();
  if (newMode !== globalMode) {
    globalMode = newMode;
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
    
    const newMode = await detectBackendMode();
    globalMode = newMode;
    globalLoading = false;
    notifyListeners();
  }, []);

  return {
    mode: globalMode,
    isConnected: globalMode !== 'demo',
    isLoading: globalLoading,
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
