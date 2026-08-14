/**
 * Auth validators — registration and login schemas.
 * AUTH-005: Common password blocklist.
 */
import { z } from 'zod';

/**
 * AUTH-005: Common passwords from well-known breach lists.
 * Rejecting the ~100 most common passwords prevents trivially weak credentials.
 */
const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', '12345678', '123456789',
  '1234567890', 'qwerty123', 'qwertyuiop', 'abcdefgh', 'abc12345',
  'letmein1', 'welcome1', 'monkey123', 'dragon12', 'master12',
  'login123', 'princess', 'football', 'shadow12', 'sunshine',
  'trustno1', 'iloveyou', 'baseball', 'whatever', 'freedom1',
  'charlie1', 'superman', 'michael1', 'jennifer', 'jessica1',
  'ashley12', 'bailey12', 'passw0rd', '1q2w3e4r', 'qwerty12',
  'password1234', 'pass1234', 'admin123', 'admin1234', 'admin12345',
  'root1234', 'toor1234', 'test1234', 'test12345', 'guest123',
  'changeme', 'changeme1', 'welcome12', 'welcome123', 'p@ssword',
  'p@ssw0rd', 'passw0rd1', 'pass12345', 'abcdef12', 'abcdef123',
  '11111111', '00000000', '12341234', '12344321', 'qwer1234',
  'asdf1234', 'zxcv1234', 'passpass', 'password01', 'password00',
  '1qaz2wsx', '1q2w3e', 'q1w2e3r4', 'a1b2c3d4', 'passpass1',
  'internet', 'mustang1', 'access12', 'flower12', 'hello123',
  'hottie12', 'loveme12', 'pepper12', 'robert12', 'matthew1',
  'jordan12', 'daniel12', 'starwars', 'ranger12', 'thomas12',
  'buster12', 'soccer12', 'hockey12', 'george12', 'andrew12',
  'andrea123', 'thunder1', 'cowboy12', 'camaro12', 'matrix12',
  'falcon12', 'summer12', 'winter12', 'spring12', 'autumn12',
]);

export const registerSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(100),
    email: z
      .string()
      .trim()
      .min(1, 'Email is required')
      .email('Invalid email format')
      .max(255)
      .transform((v) => v.toLowerCase()),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password must be at most 128 characters')
      .regex(/[a-zA-Z]/, 'Password must contain at least one letter')
      .regex(/[0-9]/, 'Password must contain at least one digit')
      .refine(
        (pw) => !COMMON_PASSWORDS.has(pw.toLowerCase()),
        'This password is too common. Please choose a stronger password.',
      ),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email is required')
    .email('Invalid email format')
    .max(255)
    .transform((v) => v.toLowerCase()),
  password: z.string().min(1, 'Password is required'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
