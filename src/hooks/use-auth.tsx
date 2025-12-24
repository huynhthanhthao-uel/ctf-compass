import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { User } from '@/lib/types';

interface AuthContextType {
  user: User;
  login: (password: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Demo password for mock auth
const DEMO_PASSWORD = 'admin';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User>({ isAuthenticated: false });
  const [isLoading, setIsLoading] = useState(false);

  const login = useCallback(async (password: string): Promise<boolean> => {
    setIsLoading(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Mock validation - in production this calls the backend
    if (password === DEMO_PASSWORD) {
      setUser({ isAuthenticated: true, username: 'admin' });
      setIsLoading(false);
      return true;
    }
    
    setIsLoading(false);
    return false;
  }, []);

  const logout = useCallback(() => {
    setUser({ isAuthenticated: false });
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
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
