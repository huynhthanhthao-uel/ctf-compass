import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { User } from '@/lib/types';
import { getBackendUrlFromStorage } from '@/lib/backend-url';
import * as api from '@/lib/api';

interface AuthContextType {
  user: User;
  login: (password: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
  isBackendConnected: boolean;
  retryBackendConnection: () => Promise<boolean>;
}

// Default context value for safety
const defaultAuthContext: AuthContextType = {
  user: { isAuthenticated: false },
  login: async () => false,
  logout: () => {},
  isLoading: true,
  isBackendConnected: false,
  retryBackendConnection: async () => false,
};

const AuthContext = createContext<AuthContextType>(defaultAuthContext);

// Demo password for mock auth
const DEMO_PASSWORD = 'admin';

// Auto-retry intervals (in ms)
const RETRY_INTERVALS = [5000, 10000, 30000, 60000];
const MAX_RETRY_INTERVAL = 60000;

// Check if backend is available
async function checkBackend(): Promise<boolean> {
  try {
    const backendUrl = getBackendUrlFromStorage();
    if (!backendUrl) return false;

    const response = await fetch(`${backendUrl}/api/health`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
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
  const isMountedRef = useRef(true);

  // Retry backend connection
  const retryBackendConnection = useCallback(async (): Promise<boolean> => {
    const backendAvailable = await checkBackend();
    
    if (!isMountedRef.current) return false;
    
    if (backendAvailable) {
      setIsBackendConnected(true);
      retryCountRef.current = 0;
      
      try {
        const session = await api.checkSession();
        if (isMountedRef.current && session.authenticated) {
          setUser({ isAuthenticated: true, username: 'admin' });
        }
      } catch {
        // Not authenticated
      }
      return true;
    }
    
    return false;
  }, []);

  // Auto-retry logic
  useEffect(() => {
    if (isBackendConnected || isLoading) return;

    const scheduleRetry = () => {
      const retryIndex = Math.min(retryCountRef.current, RETRY_INTERVALS.length - 1);
      const interval = RETRY_INTERVALS[retryIndex] || MAX_RETRY_INTERVAL;
      
      retryTimeoutRef.current = setTimeout(async () => {
        if (!isMountedRef.current) return;
        
        const connected = await retryBackendConnection();
        
        if (!connected && isMountedRef.current) {
          retryCountRef.current++;
          scheduleRetry();
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

  // Initialize auth on mount
  useEffect(() => {
    isMountedRef.current = true;
    
    const initAuth = async () => {
      const backendAvailable = await checkBackend();
      
      if (!isMountedRef.current) return;
      
      setIsBackendConnected(backendAvailable);
      
      if (backendAvailable) {
        try {
          const session = await api.checkSession();
          if (isMountedRef.current && session.authenticated) {
            setUser({ isAuthenticated: true, username: 'admin' });
          }
        } catch {
          // Not authenticated
        }
      }
      
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    };
    
    initAuth();
    
    return () => {
      isMountedRef.current = false;
    };
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
        // Ignore
      }
    }
    setUser({ isAuthenticated: false });
  }, [isBackendConnected]);

  const contextValue: AuthContextType = {
    user,
    login,
    logout,
    isLoading,
    isBackendConnected,
    retryBackendConnection,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

// useAuth hook - now always returns a valid context (never throws)
export function useAuth(): AuthContextType {
  return useContext(AuthContext);
}
