import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { User } from '@/lib/types';
import * as api from '@/lib/api';

interface AuthContextType {
  user: User;
  login: (password: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
  isBackendConnected: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Demo password for mock auth
const DEMO_PASSWORD = 'admin';

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

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading, isBackendConnected }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
