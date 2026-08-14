import { describe, it, expect } from 'vitest';
import { registerSchema, loginSchema } from '@/lib/validators/auth';

describe('auth validators', () => {
  describe('registerSchema', () => {
    it('accepts valid registration data', () => {
      const result = registerSchema.safeParse({
        name: 'Test User',
        email: 'test@example.com',
        password: 'Str0ngP@ssw0rd!',
        confirmPassword: 'Str0ngP@ssw0rd!',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('test@example.com');
      }
    });

    it('lowercases email', () => {
      const result = registerSchema.safeParse({
        name: 'Test',
        email: 'TEST@Example.COM',
        password: 'Str0ngP@ssw0rd!',
        confirmPassword: 'Str0ngP@ssw0rd!',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('test@example.com');
      }
    });

    it('rejects missing name', () => {
      const result = registerSchema.safeParse({
        name: '',
        email: 'test@example.com',
        password: 'Str0ngP@ssw0rd!',
        confirmPassword: 'Str0ngP@ssw0rd!',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid email', () => {
      const result = registerSchema.safeParse({
        name: 'Test',
        email: 'not-an-email',
        password: 'Str0ngP@ssw0rd!',
        confirmPassword: 'Str0ngP@ssw0rd!',
      });
      expect(result.success).toBe(false);
    });

    it('rejects password shorter than 8 characters', () => {
      const result = registerSchema.safeParse({
        name: 'Test',
        email: 'test@example.com',
        password: 'short',
        confirmPassword: 'short',
      });
      expect(result.success).toBe(false);
    });

    it('rejects mismatched passwords', () => {
      const result = registerSchema.safeParse({
        name: 'Test',
        email: 'test@example.com',
        password: 'Str0ngP@ssw0rd!',
        confirmPassword: 'DifferentPass1!',
      });
      expect(result.success).toBe(false);
    });

    // AUTH-005: Common password blocklist
    it('rejects common password "password"', () => {
      const result = registerSchema.safeParse({
        name: 'Test',
        email: 'test@example.com',
        password: 'password',
        confirmPassword: 'password',
      });
      expect(result.success).toBe(false);
    });

    it('rejects common password "12345678"', () => {
      const result = registerSchema.safeParse({
        name: 'Test',
        email: 'test@example.com',
        password: '12345678',
        confirmPassword: '12345678',
      });
      expect(result.success).toBe(false);
    });

    it('rejects common password case-insensitively', () => {
      const result = registerSchema.safeParse({
        name: 'Test',
        email: 'test@example.com',
        password: 'PASSWORD',
        confirmPassword: 'PASSWORD',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('loginSchema', () => {
    it('accepts valid login data', () => {
      const result = loginSchema.safeParse({
        email: 'test@example.com',
        password: 'anypassword',
      });
      expect(result.success).toBe(true);
    });

    it('lowercases email on login', () => {
      const result = loginSchema.safeParse({
        email: 'TEST@Example.COM',
        password: 'anypassword',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('test@example.com');
      }
    });

    it('rejects missing email', () => {
      const result = loginSchema.safeParse({
        email: '',
        password: 'anypassword',
      });
      expect(result.success).toBe(false);
    });

    it('rejects missing password', () => {
      const result = loginSchema.safeParse({
        email: 'test@example.com',
        password: '',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid email format', () => {
      const result = loginSchema.safeParse({
        email: 'not-an-email',
        password: 'anypassword',
      });
      expect(result.success).toBe(false);
    });
  });
});
