import { useEffect, useRef, useState, useCallback } from 'react';
import { useNotifications } from './use-notifications';

export interface JobUpdate {
  type: 'job_update' | 'job_log';
  job_id: string;
  job_title?: string;
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
  /** Enable notifications for job status changes */
  enableNotifications?: boolean;
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
    enableNotifications = false,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<JobUpdate | null>(null);
  const [error, setError] = useState<Error | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevStatusRef = useRef<Map<string, string>>(new Map());

  // Get notification functions - will be null if not wrapped in provider
  let addNotification: ((notification: { type: 'success' | 'error' | 'info' | 'warning'; title: string; message: string }) => void) | null = null;
  try {
    const notifications = useNotifications();
    addNotification = notifications.addNotification;
  } catch {
    // Not wrapped in NotificationProvider, notifications disabled
  }

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

  const handleStatusChange = useCallback((update: JobUpdate) => {
    if (!enableNotifications || !addNotification) return;
    if (update.type !== 'job_update') return;
    
    const { status, error_message, flag_candidates } = update.data;
    const jobTitle = update.job_title || `Job ${update.job_id.slice(0, 8)}`;
    const prevStatus = prevStatusRef.current.get(update.job_id);
    
    // Only notify on status change
    if (status && status !== prevStatus) {
      prevStatusRef.current.set(update.job_id, status);
      
      switch (status) {
        case 'completed':
        case 'done':
          const flagCount = flag_candidates?.length || 0;
          addNotification({
            type: 'success',
            title: 'Analysis Complete',
            message: `${jobTitle} finished successfully${flagCount > 0 ? `. Found ${flagCount} flag candidate(s)` : ''}`,
          });
          break;
          
        case 'failed':
          addNotification({
            type: 'error',
            title: 'Analysis Failed',
            message: `${jobTitle} failed${error_message ? `: ${error_message}` : ''}`,
          });
          break;
          
        case 'running':
          if (!prevStatus || prevStatus === 'queued' || prevStatus === 'pending') {
            addNotification({
              type: 'info',
              title: 'Analysis Started',
              message: `${jobTitle} is now running`,
            });
          }
          break;
      }
    }
  }, [enableNotifications, addNotification]);

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
          handleStatusChange(message);
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
  }, [getWebSocketUrl, cleanup, onJobUpdate, handleStatusChange, autoReconnect, reconnectInterval]);

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
 * Hook for managing job state with WebSocket updates and notifications
 */
export function useJobsWithWebSocket(enableNotifications = true) {
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
    enableNotifications,
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
