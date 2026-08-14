import { describe, it, expect } from 'vitest';
import { createProjectSchema } from '@/lib/validators/project';

describe('createProjectSchema', () => {
  it('accepts valid input', () => {
    const result = createProjectSchema.safeParse({
      name: 'My Project',
      description: 'A great project',
    });
    expect(result.success).toBe(true);
  });

  it('accepts name without description', () => {
    const result = createProjectSchema.safeParse({ name: 'My Project' });
    expect(result.success).toBe(true);
  });

  it('rejects empty name', () => {
    const result = createProjectSchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });

  it('rejects name over 255 chars', () => {
    const result = createProjectSchema.safeParse({ name: 'a'.repeat(256) });
    expect(result.success).toBe(false);
  });

  it('trims whitespace', () => {
    const result = createProjectSchema.safeParse({ name: '  My Project  ' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('My Project');
    }
  });
});
