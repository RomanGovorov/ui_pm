import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '@/lib/auth/password';

describe('auth/password', () => {
  it('hashes a password and returns a bcrypt hash', async () => {
    const hash = await hashPassword('mySecurePassword123');
    expect(hash).toBeTruthy();
    expect(hash.startsWith('$2')).toBe(true); // bcrypt hash prefix
  });

  it('verifies a correct password', async () => {
    const hash = await hashPassword('mySecurePassword123');
    const valid = await verifyPassword('mySecurePassword123', hash);
    expect(valid).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('mySecurePassword123');
    const valid = await verifyPassword('wrongPassword', hash);
    expect(valid).toBe(false);
  });

  it('produces different hashes for same password (random salt)', async () => {
    const hash1 = await hashPassword('samePassword');
    const hash2 = await hashPassword('samePassword');
    expect(hash1).not.toBe(hash2);
  });
});
