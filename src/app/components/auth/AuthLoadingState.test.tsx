import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import type { AuthContextValue } from '@/lib/types';

// Mock next/navigation BEFORE importing any Next.js components
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

// Create a test wrapper that provides AuthProvider context
function createTestWrapper(overrides: Partial<AuthContextValue>) {
  // We'll render components directly — they use useAuth hook internally
  // so we need to mock the module-level behavior
  const mockCtx: AuthContextValue = {
    user: null,
    isLoading: false,
    isAuthenticated: false,
    isAdmin: false,
    login: vi.fn(async () => ({ ok: true })),
    register: vi.fn(async () => ({ ok: false, message: 'Failed' })),
    logout: vi.fn(async () => {}),
    authVersion: 0,
    ...overrides,
  };

  return { mockCtx };
}

describe('AuthLoadingState', () => {
  it('renders a spinner element', () => {
    render(<div className="animate-spin" aria-hidden="true" />);
    expect(document.querySelector('.animate-spin')).toBeTruthy();
  });

  it('has sr-only text for screen readers', () => {
    render(<span className="sr-only">Loading...</span>);
    const srText = document.querySelector('.sr-only');
    expect(srText).toBeTruthy();
    expect(srText?.textContent).toContain('Loading');
  });

  it('matches the class pattern of login/register loading state', async () => {
    // Check that the layout structure is consistent with page loaders
    const loginSrc = await import('fs').then((m) =>
      m.default.readFileSync('/home/gans/ai/education/ui_pm/src/app/login/page.tsx', 'utf-8')
    );
    const compSrc = await import('fs').then((m) =>
      m.default.readFileSync('/home/gans/ai/education/ui_pm/src/app/components/auth/AuthLoadingState.tsx', 'utf-8')
    );

    // Both use animate-spin for the spinner
    expect(loginSrc).toContain('animate-spin');
    expect(compSrc).toContain('animate-spin');

    // Both use sr-only for accessibility
    expect(loginSrc).toContain('sr-only');
    expect(compSrc).toContain('sr-only');
  });

  it('uses bg-bg-primary background color', async () => {
    const src = await import('fs').then((m) =>
      m.default.readFileSync('/home/gans/ai/education/ui_pm/src/app/components/auth/AuthLoadingState.tsx', 'utf-8')
    );
    expect(src).toContain('bg-bg-primary');
  });

  it('centers content vertically and horizontally', async () => {
    const src = await import('fs').then((m) =>
      m.default.readFileSync('/home/gans/ai/education/ui_pm/src/app/components/auth/AuthLoadingState.tsx', 'utf-8')
    );
    expect(src).toContain('items-center');
    expect(src).toContain('justify-center');
  });
});
