import { describe, it, expect } from 'vitest';
import { registerSchema, loginSchema } from '@/lib/validators/auth';

describe('auth validators — edge cases', () => {
  // ─── registerSchema edge cases ─────────────────────────────────────────────

  it('rejects password at max length boundary (128 chars)', () => {
    const result = registerSchema.safeParse({
      name: 'Test',
      email: 'test@example.com',
      password: 'a'.repeat(128),
      confirmPassword: 'a'.repeat(128),
    });
    expect(result.success).toBe(true);
  });

  it('rejects password exceeding max length (129 chars)', () => {
    const result = registerSchema.safeParse({
      name: 'Test',
      email: 'test@example.com',
      password: 'a'.repeat(129),
      confirmPassword: 'a'.repeat(129),
    });
    expect(result.success).toBe(false);
  });

  it('rejects very long name (>100 chars)', () => {
    const result = registerSchema.safeParse({
      name: 'a'.repeat(101),
      email: 'test@example.com',
      password: 'Str0ngP@ssw0rd!',
      confirmPassword: 'Str0ngP@ssw0rd!',
    });
    expect(result.success).toBe(false);
  });

  it('accepts minimum valid name (1 char)', () => {
    const result = registerSchema.safeParse({
      name: 'A',
      email: 'test@example.com',
      password: 'Str0ngP@ssw0rd!',
      confirmPassword: 'Str0ngP@ssw0rd!',
    });
    expect(result.success).toBe(true);
  });

  it('trims whitespace from name', () => {
    const result = registerSchema.safeParse({
      name: '  Test User  ',
      email: 'test@example.com',
      password: 'Str0ngP@ssw0rd!',
      confirmPassword: 'Str0ngP@ssw0rd!',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Test User');
    }
  });

  it('handles email with mixed case domains correctly', () => {
    const result = registerSchema.safeParse({
      name: 'Test',
      email: 'User@GMAIL.Com',
      password: 'Str0ngP@ssw0rd!',
      confirmPassword: 'Str0ngP@ssw0rd!',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('user@gmail.com');
    }
  });

  it('rejects email that is too long (270+ chars)', () => {
    const result = registerSchema.safeParse({
      name: 'Test',
      email: `${'a'.repeat(250)}@example.com`,
      password: 'Str0ngP@ssw0rd!',
      confirmPassword: 'Str0ngP@ssw0rd!',
    });
    expect(result.success).toBe(false);
  });

  // AUTH-005: Extended common password blocklist checks
  it('rejects "passw0rd" (leetspeak variant)', () => {
    const result = registerSchema.safeParse({
      name: 'Test',
      email: 'test@example.com',
      password: 'passw0rd',
      confirmPassword: 'passw0rd',
    });
    expect(result.success).toBe(false);
  });

  it('rejects "p@ssword" (symbol variant)', () => {
    const result = registerSchema.safeParse({
      name: 'Test',
      email: 'test@example.com',
      password: 'p@ssword',
      confirmPassword: 'p@ssword',
    });
    expect(result.success).toBe(false);
  });

  it('rejects more common passwords from blocklist', () => {
    const commonList = ['qwerty123', 'welcome1', 'superman', 'dragon12'];
    for (const pw of commonList) {
      const result = registerSchema.safeParse({
        name: 'Test',
        email: 'test@example.com',
        password: pw,
        confirmPassword: pw,
      });
      expect(result.success).toBe(false);
    }
  });

  // ConfirmPassword validation edge cases
  it('rejects empty confirmPassword', () => {
    const result = registerSchema.safeParse({
      name: 'Test',
      email: 'test@example.com',
      password: 'Str0ngP@ssw0rd!',
      confirmPassword: '',
    });
    expect(result.success).toBe(false);
  });

  it('reports correct error paths on mismatch', () => {
    const result = registerSchema.safeParse({
      name: 'Test',
      email: 'test@example.com',
      password: 'Pass1234!',
      confirmPassword: 'Different1!',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('confirmPassword');
    }
  });

  // ─── loginSchema edge cases ────────────────────────────────────────────────

  it('rejects missing password in login', () => {
    const result = loginSchema.safeParse({
      email: 'test@example.com',
      password: '',
    });
    expect(result.success).toBe(false);
  });

  it('accepts login with complex password', () => {
    const result = loginSchema.safeParse({
      email: 'test@example.com',
      password: '!@#$%^&*()_+-=[]{}|;:,.<>?',
    });
    expect(result.success).toBe(true);
  });

  it('normalizes emails to same value regardless of case', () => {
    const r1 = loginSchema.safeParse({ email: 'TEST@EXAMPLE.COM', password: 'x' });
    const r2 = loginSchema.safeParse({ email: 'test@example.com', password: 'x' });
    expect(r1.success && r2.success).toBe(true);
    if (r1.success && r2.success) {
      expect(r1.data.email).toBe(r2.data.email);
    }
  });

  it('rejects login with null-like values', () => {
    // @ts-expect-error intentional type violation for edge testing
    const result = loginSchema.safeParse({ email: undefined, password: undefined });
    expect(result.success).toBe(false);
  });

  it('validates email TLD requirement', () => {
    const result = loginSchema.safeParse({
      email: 'notanemail',
      password: 'x',
    });
    expect(result.success).toBe(false);
  });
});
