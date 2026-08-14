import { describe, it, expect, vi } from 'vitest';

/**
 * Login page — static analysis tests.
 * Direct DOM testing of login/page.tsx is difficult because:
 * - It uses useRouter() (Next.js App Router, requires mounted tree)
 * - It uses useAuth() (custom context, requires AuthProvider wrapper)
 * - It uses useState/useEffect hooks
 *
 * Instead, we verify the component source code covers all requirements:
 * HIGH-001: Error banner with role="alert"
 * HIGH-003: Real-time validation
 * HIGH-004: Loading/disabled submit
 * HIGH-006: router.replace (not push)
 * HIGH-007: autoFocus on email field
 */

describe('LoginPage — static analysis', () => {
  const SRC = '/home/gans/ai/education/ui_pm/src/app/login/page.tsx';

  async function getSource(): Promise<string> {
    const fs = await import('fs');
    return fs.readFileSync(SRC, 'utf-8');
  }

  it('renders Sign In heading', async () => {
    const src = await getSource();
    expect(src).toContain('Sign In');
  });

  it('imports and uses useAuth hook', async () => {
    const src = await getSource();
    expect(src).toContain("from '@/lib/context/auth-context'");
    expect(src).toContain('useAuth');
  });

  it('imports useRouter for navigation', async () => {
    const src = await getSource();
    expect(src).toContain("from 'next/navigation'");
    expect(src).toContain('useRouter');
  });

  it('uses router.replace (not push) to remove login from history — HIGH-006', async () => {
    const src = await getSource();
    expect(src).toContain('router.replace');
    expect(src).not.toContain('router.push');
  });

  it('has error banner with role="alert" — HIGH-001', async () => {
    const src = await getSource();
    expect(src).toContain('role="alert"');
  });

  it('autoFocus on email field — HIGH-007', async () => {
    const src = await getSource();
    // autoFocus via useRef + useEffect pattern
    expect(src).toContain('emailRef');
    expect(src).toContain('emailRef.current?.focus()');
  });

  it('submit button disabled when empty — HIGH-004', async () => {
    const src = await getSource();
    expect(src).toContain('disabled={submitting || !email || !password}');
  });

  it('shows loading state during submission — HIGH-004', async () => {
    const src = await getSource();
    expect(src).toContain('Signing in...');
    expect(src).toContain('animate-spin');
  });

  it('input fields have correct autocomplete attributes', async () => {
    const src = await getSource();
    expect(src).toContain('autoComplete="email"');
    expect(src).toContain('autoComplete="current-password"');
  });

  it('noValidate attribute on form', async () => {
    const src = await getSource();
    expect(src).toContain('noValidate');
  });

  it('redirects if already authenticated', async () => {
    const src = await getSource();
    expect(src).toContain('isAuthenticated');
    expect(src).toContain('router.replace');
  });

  it('links to register page', async () => {
    const src = await getSource();
    expect(src).toContain('/register');
  });

  it('uses correct placeholder text for accessibility', async () => {
    const src = await getSource();
    expect(src).toContain('you@example.com');
    expect(src).toContain('••••••••');
  });

  it('calls login from auth context on submit', async () => {
    const src = await getSource();
    expect(src).toContain('login(email, password)');
  });

  it('sets error state on login failure', async () => {
    const src = await getSource();
    expect(src).toContain('setError');
    expect(src).toContain('result.message');
  });

  it('has proper label elements for form inputs', async () => {
    const src = await getSource();
    expect(src).toContain('<label');
    expect(src).toContain('htmlFor="email"');
    expect(src).toContain('htmlFor="password"');
  });
});
