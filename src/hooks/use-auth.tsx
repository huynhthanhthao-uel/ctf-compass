import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { User } from '@/lib/types';
import * as api from '@/lib/api';

interface AuthContextType {
  user: User;
  login: (password: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
  isBackendConnected: boolean;
  retryBackendConnection: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Demo password for mock auth
const DEMO_PASSWORD = 'admin';

// Auto-retry intervals (in ms)
const RETRY_INTERVALS = [5000, 10000, 30000, 60000]; // 5s, 10s, 30s, 1min
const MAX_RETRY_INTERVAL = 60000;

// Check if backend is available (must return JSON, not HTML)
async function checkBackend(): Promise<boolean> {
  try {
    const response = await fetch('/api/health', { method: 'GET' });
    if (!response.ok) return false;
    
    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('application/json')) return false;
    
    const data = await response.json();
    return data.status === 'healthy' || data.status === 'ok';
  } catch {
    return false;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User>({ isAuthenticated: false });
  const [isLoading, setIsLoading] = useState(true);
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Retry backend connection with exponential backoff
  const retryBackendConnection = useCallback(async (): Promise<boolean> => {
    const backendAvailable = await checkBackend();
    
    if (backendAvailable) {
      setIsBackendConnected(true);
      retryCountRef.current = 0; // Reset retry count on success
      
      // Check if we have a valid session
      try {
        const session = await api.checkSession();
        if (session.authenticated) {
          setUser({ isAuthenticated: true, username: 'admin' });
        }
      } catch {
        // Not authenticated, but backend is available
      }
      return true;
    }
    
    return false;
  }, []);

  // Auto-retry logic when backend is not connected
  useEffect(() => {
    if (isBackendConnected || isLoading) return;

    const scheduleRetry = () => {
      const retryIndex = Math.min(retryCountRef.current, RETRY_INTERVALS.length - 1);
      const interval = RETRY_INTERVALS[retryIndex] || MAX_RETRY_INTERVAL;
      
      retryTimeoutRef.current = setTimeout(async () => {
        const connected = await retryBackendConnection();
        
        if (!connected) {
          retryCountRef.current++;
          scheduleRetry(); // Schedule next retry
        }
      }, interval);
    };

    scheduleRetry();

    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [isBackendConnected, isLoading, retryBackendConnection]);

  // Check session on mount
  useEffect(() => {
    const initAuth = async () => {
      const backendAvailable = await checkBackend();
      setIsBackendConnected(backendAvailable);
      
      if (backendAvailable) {
        try {
          const session = await api.checkSession();
          if (session.authenticated) {
            setUser({ isAuthenticated: true, username: 'admin' });
          }
        } catch {
          // Not authenticated
        }
      }
      
      setIsLoading(false);
    };
    
    initAuth();
  }, []);

  const login = useCallback(async (password: string): Promise<boolean> => {
    setIsLoading(true);
    
    if (isBackendConnected) {
      try {
        await api.login(password);
        setUser({ isAuthenticated: true, username: 'admin' });
        setIsLoading(false);
        return true;
      } catch (error) {
        console.error('Login failed:', error);
        setIsLoading(false);
        return false;
      }
    }
    
    // Fallback to mock auth
    await new Promise(resolve => setTimeout(resolve, 800));
    
    if (password === DEMO_PASSWORD) {
      setUser({ isAuthenticated: true, username: 'admin' });
      setIsLoading(false);
      return true;
    }
    
    setIsLoading(false);
    return false;
  }, [isBackendConnected]);

  const logout = useCallback(async () => {
    if (isBackendConnected) {
      try {
        await api.logout();
      } catch {
        // Ignore logout errors
      }
    }
    setUser({ isAuthenticated: false });
  }, [isBackendConnected]);

  const value: AuthContextType = {
    user,
    login,
    logout,
    isLoading,
    isBackendConnected,
    retryBackendConnection
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
