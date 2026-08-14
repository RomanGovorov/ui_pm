// WCAG 2.4.1 Bypass Blocks: Skip-to-content link is NOT required here.
// Rationale: Auth pages are full-page centered forms with no navigation
// sidebar or header. The form IS the only content on the page.
'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/context/auth-context';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  // HIGH-007: autoFocus on email field
  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  // Redirect if already authenticated
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/');
    }
  }, [isLoading, isAuthenticated, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const result = await login(email, password);

    setSubmitting(false);

    if (!result.ok) {
      setError(result.message ?? 'Login failed');
      return;
    }

    // HIGH-006: Use router.replace to remove login from history
    router.replace('/');
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-primary">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-border-primary border-t-accent-blue" aria-hidden="true" />
        <span className="sr-only">Loading...</span>
      </div>
    );
  }

  if (isAuthenticated) {
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-primary px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-blue text-lg font-bold text-white">
            PM
          </div>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-border-primary bg-bg-secondary p-8 shadow-lg">
          <h1 className="mb-6 text-center text-2xl font-bold text-text-primary">
            Sign In
          </h1>

          {/* HIGH-001: Error banner with role="alert" */}
          {error && (
            <div
              role="alert"
              className="mb-4 rounded-lg border border-accent-red bg-accent-red/10 p-3 text-sm text-accent-red"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium text-text-secondary"
              >
                Email
              </label>
              <input
                ref={emailRef}
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@example.com"
                className="w-full rounded-lg border border-border-primary bg-bg-tertiary px-3 py-2.5 text-sm text-text-primary placeholder:text-text-placeholder transition-colors focus:border-accent-blue focus:outline-none focus:ring-2 focus:ring-focus/50"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-text-secondary"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full rounded-lg border border-border-primary bg-bg-tertiary px-3 py-2.5 text-sm text-text-primary placeholder:text-text-placeholder transition-colors focus:border-accent-blue focus:outline-none focus:ring-2 focus:ring-focus/50"
              />
            </div>

            {/* HIGH-004: Loading/disabled submit button */}
            <button
              type="submit"
              disabled={submitting || !email || !password}
              className="flex w-full items-center justify-center rounded-lg bg-accent-blue px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-focus/50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden="true" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-text-muted">
            Don&apos;t have an account?{' '}
            <Link
              href="/register"
              className="font-medium text-accent-blue hover:text-blue-400 transition-colors"
            >
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
