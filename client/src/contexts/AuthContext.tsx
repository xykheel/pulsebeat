import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { AuthUser } from '../types';

interface AuthContextValue {
  user: AuthUser | null | undefined;
  ready: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch('/api/auth/me', { credentials: 'include' });
      if (r.ok) {
        const d = (await r.json()) as { user: AuthUser };
        setUser(d.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    function onUnauth() {
      setUser(null);
      setReady(true);
    }
    window.addEventListener('pulsebeat:unauthorized', onUnauth);
    return () => window.removeEventListener('pulsebeat:unauthorized', onUnauth);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const r = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = (await r.json().catch(() => ({}))) as { error?: string; user?: AuthUser };
    if (!r.ok) {
      throw new Error(data.error || 'Login failed');
    }
    if (!data.user) {
      throw new Error('Login failed');
    }
    setUser(data.user);
    setReady(true);
  }, []);

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, ready, login, logout, refresh }),
    [user, ready, login, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
