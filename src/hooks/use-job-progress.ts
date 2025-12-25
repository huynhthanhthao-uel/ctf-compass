import { useState, useEffect, useCallback, useRef } from 'react';

export interface ProgressStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: string;
  completedAt?: string;
  output?: string;
}

export interface JobProgress {
  jobId: string;
  status: 'pending' | 'running' | 'analyzing' | 'completed' | 'failed';
  progress: number;
  currentStep: string;
  steps: ProgressStep[];
  logs: string[];
  startedAt: string;
  updatedAt: string;
  error?: string;
}

interface UseJobProgressOptions {
  jobId: string;
  enabled?: boolean;
  onComplete?: (progress: JobProgress) => void;
  onError?: (error: string) => void;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export function useJobProgress({
  jobId,
  enabled = true,
  onComplete,
  onError,
}: UseJobProgressOptions) {
  const [progress, setProgress] = useState<JobProgress | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  // Update a step locally (for optimistic updates)
  const updateStep = useCallback((stepId: string, status: ProgressStep['status'], output?: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'update_step',
        stepId,
        status,
        output,
      }));
    }
  }, []);

  // Add a log message
  const addLog = useCallback((message: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'add_log',
        message,
      }));
    }
  }, []);

  // Set overall status
  const setStatus = useCallback((status: JobProgress['status'], error?: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'set_status',
        status,
        error,
      }));
    }
  }, []);

  // Update progress
  const updateProgress = useCallback((payload: Partial<JobProgress>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'update_progress',
        payload,
      }));
    }
  }, []);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (!enabled || !jobId || !SUPABASE_URL) return;

    // Clean up existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }

    // Build WebSocket URL
    const wsUrl = SUPABASE_URL
      .replace('https://', 'wss://')
      .replace('http://', 'ws://');
    const fullUrl = `${wsUrl}/functions/v1/job-progress?job_id=${jobId}`;

    console.log('[useJobProgress] Connecting to:', fullUrl);

    try {
      const ws = new WebSocket(fullUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[useJobProgress] Connected for job:', jobId);
        setIsConnected(true);
        setConnectionError(null);
        reconnectAttempts.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[useJobProgress] Received:', data.type);

          if (data.type === 'connected' || data.type === 'progress') {
            setProgress(data.data);

            // Check for completion
            if (data.data.status === 'completed' && onComplete) {
              onComplete(data.data);
            }

            // Check for error
            if (data.data.status === 'failed' && data.data.error && onError) {
              onError(data.data.error);
            }
          } else if (data.type === 'pong') {
            // Heartbeat response
          }
        } catch (e) {
          console.error('[useJobProgress] Parse error:', e);
        }
      };

      ws.onclose = (event) => {
        console.log('[useJobProgress] Connection closed:', event.code, event.reason);
        setIsConnected(false);
        wsRef.current = null;

        // Attempt reconnect if not intentionally closed
        if (enabled && reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 10000);
          console.log(`[useJobProgress] Reconnecting in ${delay}ms...`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            connect();
          }, delay);
        }
      };

      ws.onerror = (error) => {
        console.error('[useJobProgress] WebSocket error:', error);
        setConnectionError('Connection error');
      };

    } catch (e) {
      console.error('[useJobProgress] Failed to create WebSocket:', e);
      setConnectionError(e instanceof Error ? e.message : 'Connection failed');
    }
  }, [jobId, enabled, onComplete, onError]);

  // Disconnect
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
  }, []);

  // Send heartbeat
  useEffect(() => {
    if (!isConnected) return;

    const interval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [isConnected]);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return {
    progress,
    isConnected,
    connectionError,
    updateStep,
    addLog,
    setStatus,
    updateProgress,
    reconnect: connect,
    disconnect,
  };
}

// Helper to post progress updates from outside WebSocket (e.g., from API calls)
export async function postProgressUpdate(
  jobId: string,
  type: 'update_progress' | 'update_step' | 'add_log' | 'set_status',
  payload: Record<string, unknown>
): Promise<boolean> {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/job-progress`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          job_id: jobId,
          type,
          ...payload,
        }),
      }
    );
    return response.ok;
  } catch (e) {
    console.error('[postProgressUpdate] Error:', e);
    return false;
  }
}
