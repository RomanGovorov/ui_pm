'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import type { AuthUser, UserRole } from '@/lib/types';

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; message?: string }>;
  register: (name: string, email: string, password: string, confirmPassword: string) => Promise<{ ok: boolean; message?: string; redirect?: boolean }>;
  logout: () => Promise<void>;
  /** Call after login to reconnect SSE (triggers re-mount of SSE hook) */
  authVersion: number;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authVersion, setAuthVersion] = useState(0);

  // On mount: check existing session via /api/auth/me
  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        }
      } catch {
        // Network error — treat as unauthenticated
      } finally {
        setIsLoading(false);
      }
    }
    checkSession();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        return {
          ok: false,
          message: data.error?.message ?? 'Login failed',
        };
      }

      setUser(data.user);
      setAuthVersion((v) => v + 1);
      return { ok: true };
    } catch {
      return { ok: false, message: 'Network error. Please try again.' };
    }
  }, []);

  const register = useCallback(async (
    name: string,
    email: string,
    password: string,
    confirmPassword: string,
  ) => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ name, email, password, confirmPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Show specific validation errors if available
        if (data.error?.details && Array.isArray(data.error.details)) {
          const messages = data.error.details.map((d: { message: string }) => d.message);
          return { ok: false, message: messages.join('. ') };
        }
        return {
          ok: false,
          message: data.error?.message ?? 'Registration failed',
        };
      }

      // AUTH-002: Generic response for duplicate emails — has message but no user
      if (data.message && !data.user) {
        return { ok: false, message: data.message };
      }

      // Successful registration with user data
      if (data.user) {
        setUser(data.user);
        setAuthVersion((v) => v + 1);
        return { ok: true, redirect: true };
      }

      return { ok: false, message: 'Registration failed. Please try again.' };
    } catch {
      return { ok: false, message: 'Network error. Please try again.' };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
      });
    } catch {
      // Best effort — clear local state regardless
    }
    setUser(null);
    setAuthVersion((v) => v + 1);
  }, []);

  const isAdmin = user?.role === ('admin' as UserRole);
  const isAuthenticated = user !== null;

  const value: AuthContextValue = {
    user,
    isLoading,
    isAuthenticated,
    isAdmin,
    login,
    register,
    logout,
    authVersion,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
