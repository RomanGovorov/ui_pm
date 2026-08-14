import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { validateApiKey } from '@/lib/auth';

describe('validateApiKey', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    process.env.API_KEY = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
    delete process.env.API_KEY_SECONDARY;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('accepts valid primary key', () => {
    const result = validateApiKey(process.env.API_KEY!);
    expect(result).toBe(true);
  });

  it('rejects null key', () => {
    expect(validateApiKey(null)).toBe(false);
  });

  it('rejects empty string', () => {
    expect(validateApiKey('')).toBe(false);
  });

  it('rejects wrong key', () => {
    expect(validateApiKey('wrong-key-value-1234567890abcdef')).toBe(false);
  });

  it('accepts secondary key when set', () => {
    process.env.API_KEY_SECONDARY = 'secondary-key-1234567890abcdef1234567890abcdef12345678';
    expect(validateApiKey(process.env.API_KEY_SECONDARY)).toBe(true);
  });

  it('rejects when API_KEY env is not set', () => {
    delete process.env.API_KEY;
    expect(validateApiKey('some-key')).toBe(false);
  });
});
