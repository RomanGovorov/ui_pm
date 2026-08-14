'use client';

import type { ReactNode } from 'react';

interface AppShellProps {
  children: ReactNode;
  sidebar: ReactNode;
}

/**
 * AppShell — main layout wrapper with ARIA landmarks.
 * UI-002: Uses semantic <aside>, <main>, <header> with proper roles.
 */
export function AppShell({ children, sidebar }: AppShellProps) {
  return (
    <div className="flex h-screen overflow-hidden">
      <aside
        aria-label="Sidebar"
        className="w-64 flex-shrink-0 border-r border-border-primary bg-bg-secondary"
      >
        {sidebar}
      </aside>
      <main
        id="main-content"
        role="main"
        aria-label="Dashboard content"
        className="flex flex-1 flex-col overflow-hidden"
      >
        {children}
      </main>
    </div>
  );
}
