import { describe, it, expect, vi } from 'vitest';

/**
 * Register page — static analysis tests.
 * Direct DOM testing is difficult because of Next.js App Router + AuthProvider context.
 * Verifies component source covers all requirements:
 * HIGH-001: Error banner with role="alert"
 * HIGH-003: Real-time password match indicator
 * HIGH-004: Loading/disabled submit
 * HIGH-006: router.replace (not push)
 * HIGH-007: autoFocus on name field
 */

describe('RegisterPage — static analysis', () => {
  const SRC = '/home/gans/ai/education/ui_pm/src/app/register/page.tsx';

  async function getSource(): Promise<string> {
    const fs = await import('fs');
    return fs.readFileSync(SRC, 'utf-8');
  }

  it('renders Create Account heading', async () => {
    const src = await getSource();
    expect(src).toContain('Create Account');
  });

  it('imports and uses useAuth hook', async () => {
    const src = await getSource();
    expect(src).toContain("from '@/lib/context/auth-context'");
    expect(src).toContain('useAuth');
  });

  it('uses router.replace (not push) — HIGH-006', async () => {
    const src = await getSource();
    expect(src).toContain('router.replace');
    expect(src).not.toContain('router.push');
  });

  it('has error banner with role="alert" — HIGH-001', async () => {
    const src = await getSource();
    expect(src).toContain('role="alert"');
  });

  it('autoFocus on name field — HIGH-007', async () => {
    const src = await getSource();
    expect(src).toContain('nameRef');
    expect(src).toContain('nameRef.current?.focus()');
  });

  it('submit button disabled when incomplete — HIGH-004', async () => {
    const src = await getSource();
    expect(src).toContain('disabled={submitting || !name || !email || !password || !confirmPassword}');
  });

  it('shows loading state during submission — HIGH-004', async () => {
    const src = await getSource();
    expect(src).toContain('Creating account...');
    expect(src).toContain('animate-spin');
  });

  // HIGH-003: Password match indicator
  it('has real-time password match check — HIGH-003', async () => {
    const src = await getSource();
    expect(src).toContain('passwordsMatch');
    expect(src).toContain('passwordsMismatch');
    expect(src).toContain('password === confirmPassword');
  });

  it('shows green border when passwords match', async () => {
    const src = await getSource();
    expect(src).toContain('border-accent-green');
  });

  it('shows red border when passwords mismatch', async () => {
    const src = await getSource();
    expect(src).toContain('border-accent-red');
  });

  it('has aria-live for match indicator accessibility', async () => {
    const src = await getSource();
    expect(src).toContain('aria-live');
  });

  it('displays "Passwords do not match" error text', async () => {
    const src = await getSource();
    expect(src).toContain('Passwords do not match');
  });

  it('input fields have correct autocomplete attributes', async () => {
    const src = await getSource();
    expect(src).toContain('autoComplete="name"');
    expect(src).toContain('autoComplete="email"');
    expect(src).toContain('autoComplete="new-password"');
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

  it('links to login page', async () => {
    const src = await getSource();
    expect(src).toContain('/login');
  });

  it('has four required fields: name, email, password, confirmPassword', async () => {
    const src = await getSource();
    expect(src).toContain('const [name, setName]');
    expect(src).toContain('const [email, setEmail]');
    expect(src).toContain('const [password, setPassword]');
    expect(src).toContain('const [confirmPassword, setConfirmPassword]');
  });

  it('calls register from auth context on submit', async () => {
    const src = await getSource();
    expect(src).toContain('register(name, email, password, confirmPassword)');
  });

  it('sets minLength={8} on password input', async () => {
    const src = await getSource();
    expect(src).toContain('minLength={8}');
  });

  it('has proper label elements for form inputs', async () => {
    const src = await getSource();
    expect(src).toContain('htmlFor="name"');
    expect(src).toContain('htmlFor="email"');
    expect(src).toContain('htmlFor="password"');
    expect(src).toContain('htmlFor="confirmPassword"');
  });
});
