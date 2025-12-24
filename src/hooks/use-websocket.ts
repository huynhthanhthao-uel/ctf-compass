import { useEffect, useRef, useState, useCallback } from 'react';

export interface JobUpdate {
  type: 'job_update' | 'job_log';
  job_id: string;
  data: {
    status?: string;
    progress?: number;
    message?: string;
    completed?: boolean;
    flag_candidates?: Array<{ value: string; confidence: number; source: string }>;
    error_message?: string;
    level?: string;
  };
}

interface UseWebSocketOptions {
  /** Specific job ID to subscribe to, or null for all jobs */
  jobId?: string | null;
  /** Callback when job update is received */
  onJobUpdate?: (update: JobUpdate) => void;
  /** Auto reconnect on disconnect */
  autoReconnect?: boolean;
  /** Reconnect interval in ms */
  reconnectInterval?: number;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  lastMessage: JobUpdate | null;
  error: Error | null;
  reconnect: () => void;
}

/**
 * Hook for connecting to WebSocket for real-time job updates
 */
export function useJobWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const {
    jobId = null,
    onJobUpdate,
    autoReconnect = true,
    reconnectInterval = 3000,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<JobUpdate | null>(null);
  const [error, setError] = useState<Error | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const getWebSocketUrl = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const path = jobId ? `/ws/jobs/${jobId}` : '/ws/jobs';
    return `${protocol}//${host}${path}`;
  }, [jobId]);

  const cleanup = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    cleanup();
    
    try {
      const url = getWebSocketUrl();
      console.log('[WS] Connecting to:', url);
      
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WS] Connected');
        setIsConnected(true);
        setError(null);
        
        // Start ping interval to keep connection alive
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send('ping');
          }
        }, 30000);
      };

      ws.onmessage = (event) => {
        if (event.data === 'pong') {
          return; // Ignore pong responses
        }
        
        try {
          const message = JSON.parse(event.data) as JobUpdate;
          console.log('[WS] Received:', message);
          setLastMessage(message);
          onJobUpdate?.(message);
        } catch (e) {
          console.error('[WS] Failed to parse message:', e);
        }
      };

      ws.onerror = (event) => {
        console.error('[WS] Error:', event);
        setError(new Error('WebSocket connection error'));
      };

      ws.onclose = (event) => {
        console.log('[WS] Disconnected:', event.code, event.reason);
        setIsConnected(false);
        
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }
        
        // Auto reconnect if enabled and not a normal close
        if (autoReconnect && event.code !== 1000) {
          console.log(`[WS] Reconnecting in ${reconnectInterval}ms...`);
          reconnectTimeoutRef.current = setTimeout(connect, reconnectInterval);
        }
      };
    } catch (e) {
      console.error('[WS] Failed to connect:', e);
      setError(e instanceof Error ? e : new Error('Failed to connect'));
      
      if (autoReconnect) {
        reconnectTimeoutRef.current = setTimeout(connect, reconnectInterval);
      }
    }
  }, [getWebSocketUrl, cleanup, onJobUpdate, autoReconnect, reconnectInterval]);

  const reconnect = useCallback(() => {
    console.log('[WS] Manual reconnect');
    connect();
  }, [connect]);

  useEffect(() => {
    connect();
    return cleanup;
  }, [connect, cleanup]);

  return {
    isConnected,
    lastMessage,
    error,
    reconnect,
  };
}

/**
 * Hook for managing job state with WebSocket updates
 */
export function useJobsWithWebSocket() {
  const [jobUpdates, setJobUpdates] = useState<Map<string, JobUpdate['data']>>(new Map());

  const handleJobUpdate = useCallback((update: JobUpdate) => {
    if (update.type === 'job_update') {
      setJobUpdates(prev => {
        const newMap = new Map(prev);
        newMap.set(update.job_id, update.data);
        return newMap;
      });
    }
  }, []);

  const { isConnected, error, reconnect } = useJobWebSocket({
    onJobUpdate: handleJobUpdate,
  });

  const getJobUpdate = useCallback((jobId: string) => {
    return jobUpdates.get(jobId);
  }, [jobUpdates]);

  const clearJobUpdate = useCallback((jobId: string) => {
    setJobUpdates(prev => {
      const newMap = new Map(prev);
      newMap.delete(jobId);
      return newMap;
    });
  }, []);

  return {
    isConnected,
    error,
    reconnect,
    jobUpdates,
    getJobUpdate,
    clearJobUpdate,
  };
}
