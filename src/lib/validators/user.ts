import { z } from 'zod';

export const createUserSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  email: z.string().trim().email('Invalid email').max(255).optional().nullable(),
  role: z.enum(['admin', 'stakeholder', 'agent']).default('stakeholder'),
  apiKey: z.string().trim().min(32).max(255).optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
