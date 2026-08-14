import { prisma } from '@/lib/db/client';
import { createUserSchema } from '@/lib/validators/user';
import type { CreateUserInput } from '@/lib/validators/user';
import { hashPassword, verifyPassword } from '@/lib/auth/password';

export const userService = {
  createSchema: createUserSchema,

  async list() {
    return prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        // apiKey and passwordHash intentionally excluded
      },
      orderBy: { name: 'asc' },
    });
  },

  async create(data: CreateUserInput) {
    return prisma.user.create({
      data: {
        name: data.name,
        email: data.email ?? null,
        role: data.role,
        apiKey: data.apiKey ?? null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });
  },

  /**
   * Find user by email (case-insensitive, since email is stored lowercased).
   */
  async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
  },

  /**
   * Register a new user with email/password.
   * Returns the user (without passwordHash/apiKey).
   * Throws if email already exists.
   */
  async register(data: { name: string; email: string; password: string; role?: 'admin' | 'stakeholder' }) {
    const passwordHash = await hashPassword(data.password);
    return prisma.user.create({
      data: {
        name: data.name,
        email: data.email.toLowerCase(),
        passwordHash,
        role: data.role ?? 'stakeholder',
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });
  },

  /**
   * Verify credentials for login.
   * Returns user (without passwordHash/apiKey) if valid, null otherwise.
   */
  async findByCredentials(email: string, password: string) {
    const user = await this.findByEmail(email);
    if (!user || !user.passwordHash) return null;

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) return null;

    // Return safe subset (no passwordHash, no apiKey)
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    };
  },
};
