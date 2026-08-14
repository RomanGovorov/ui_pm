// WCAG 2.4.1 Bypass Blocks: Skip-to-content link is NOT required here.
// Rationale: Auth pages are full-page centered forms with no navigation
// sidebar or header. The form IS the only content on the page.
'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/context/auth-context';
import Link from 'next/link';

export default function RegisterPage() {
  const router = useRouter();
  const { register, isAuthenticated, isLoading } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  // HIGH-007: autoFocus on name field
  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  // Redirect if already authenticated
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/');
    }
  }, [isLoading, isAuthenticated, router]);

  // HIGH-003: Real-time confirm password match indicator
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  // Real-time password requirements validation
  const passwordLength = password.length >= 8;
  const passwordHasLetter = /[a-zA-Z]/.test(password);
  const passwordHasDigit = /[0-9]/.test(password);
  const passwordValid = password.length === 0 || (passwordLength && passwordHasLetter && passwordHasDigit);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const result = await register(name, email, password, confirmPassword);

    setSubmitting(false);

    if (!result.ok) {
      setError(result.message ?? 'Registration failed');
      return;
    }

    // Successful registration — redirect to dashboard
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
            Create Account
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
                htmlFor="name"
                className="mb-1.5 block text-sm font-medium text-text-secondary"
              >
                Name
              </label>
              <input
                ref={nameRef}
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
                placeholder="Your name"
                className="w-full rounded-lg border border-border-primary bg-bg-tertiary px-3 py-2.5 text-sm text-text-primary placeholder:text-text-placeholder transition-colors focus:border-accent-blue focus:outline-none focus:ring-2 focus:ring-focus/50"
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium text-text-secondary"
              >
                Email
              </label>
              <input
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
                autoComplete="new-password"
                placeholder="Min 8 chars, letter + digit"
                minLength={8}
                className={`w-full rounded-lg border bg-bg-tertiary px-3 py-2.5 text-sm text-text-primary placeholder:text-text-placeholder transition-colors focus:outline-none focus:ring-2 focus:ring-focus/50 ${
                  password.length === 0
                    ? 'border-border-primary focus:border-accent-blue'
                    : passwordValid
                      ? 'border-accent-green focus:border-accent-green'
                      : 'border-accent-red focus:border-accent-red'
                }`}
              />
              {/* Password requirements hint */}
              {password.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs" aria-live="polite">
                  <li className={passwordLength ? 'text-accent-green' : 'text-text-muted'}>
                    {passwordLength ? '✓' : '○'} At least 8 characters
                  </li>
                  <li className={passwordHasLetter ? 'text-accent-green' : 'text-text-muted'}>
                    {passwordHasLetter ? '✓' : '○'} At least one letter
                  </li>
                  <li className={passwordHasDigit ? 'text-accent-green' : 'text-text-muted'}>
                    {passwordHasDigit ? '✓' : '○'} At least one digit
                  </li>
                </ul>
              )}
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="mb-1.5 block text-sm font-medium text-text-secondary"
              >
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  placeholder="Repeat your password"
                  className={`w-full rounded-lg border bg-bg-tertiary px-3 py-2.5 pr-10 text-sm text-text-primary placeholder:text-text-placeholder transition-colors focus:outline-none focus:ring-2 focus:ring-focus/50 ${
                    passwordsMatch
                      ? 'border-accent-green focus:border-accent-green'
                      : passwordsMismatch
                        ? 'border-accent-red focus:border-accent-red'
                        : 'border-border-primary focus:border-accent-blue'
                  }`}
                />
                {/* HIGH-003: Real-time match indicator */}
                {confirmPassword.length > 0 && (
                  <span
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    aria-live="polite"
                    aria-label={passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
                  >
                    {passwordsMatch ? (
                      <span className="text-accent-green" aria-hidden="true">✓</span>
                    ) : (
                      <span className="text-accent-red" aria-hidden="true">✗</span>
                    )}
                  </span>
                )}
              </div>
              {passwordsMismatch && (
                <p className="mt-1 text-xs text-accent-red" role="alert">
                  Passwords do not match
                </p>
              )}
            </div>

            {/* HIGH-004: Loading/disabled submit button */}
            <button
              type="submit"
              disabled={submitting || !name || !email || !password || !confirmPassword || !passwordValid || !passwordsMatch}
              className="flex w-full items-center justify-center rounded-lg bg-accent-blue px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-focus/50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden="true" />
                  Creating account...
                </>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-text-muted">
            Already have an account?{' '}
            <Link
              href="/login"
              className="font-medium text-accent-blue hover:text-blue-400 transition-colors"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
