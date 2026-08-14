'use client';

import { useEffect } from 'react';
import { redirect } from 'next/navigation';
import { useAuth } from '@/lib/context/auth-context';
import { AppProvider, useAppContext } from '@/lib/context/app-context';
import { AppShell } from '@/app/components/layout/AppShell';
import { Sidebar } from '@/app/components/layout/Sidebar';
import { Header } from '@/app/components/layout/Header';
import { KanbanBoard } from '@/app/components/kanban/KanbanBoard';
import { ToastContainer } from '@/app/components/ui/ToastContainer';
import { AuthLoadingState } from '@/app/components/auth/AuthLoadingState';

/**
 * DashboardContent — fetches initial data and renders the kanban board.
 * Only rendered after auth is confirmed (CRIT-001 FOUC prevention).
 */
function DashboardContent() {
  const {
    setProjects,
    setTasks,
    currentProjectId,
    setCurrentProjectId,
  } = useAppContext();

  // Fetch initial data on mount
  useEffect(() => {
    async function loadData() {
      try {
        const [projectsRes, tasksRes] = await Promise.all([
          fetch('/api/projects'),
          fetch('/api/tasks'),
        ]);

        if (projectsRes.ok) {
          const projectsData = await projectsRes.json();
          const projectsList = projectsData.data ?? [];
          setProjects(projectsList);

          // Auto-select first project if none selected
          if (!currentProjectId && projectsList.length > 0) {
            setCurrentProjectId(projectsList[0].id);
          }
        }

        if (tasksRes.ok) {
          const tasksData = await tasksRes.json();
          setTasks(tasksData.data ?? []);
        }
      } catch (err) {
        console.error('Failed to load initial data:', err);
      }
    }

    loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {/* UI-002: Skip-to-content link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[9999] focus:rounded-md focus:bg-accent-blue focus:px-4 focus:py-2 focus:text-sm focus:text-white"
      >
        Skip to content
      </a>

      <AppShell sidebar={<Sidebar />}>
        <Header />
        <KanbanBoard />
      </AppShell>

      <ToastContainer />

      {/* UI-002: aria-live region for screen reader announcements */}
      <div aria-live="polite" aria-atomic="true" className="sr-only" id="a11y-announcements" />
    </>
  );
}

/**
 * CRIT-001: FOUC prevention — check isLoading before rendering.
 * Redirect to /login if not authenticated.
 */
function AuthGate() {
  const { user, isLoading, isAuthenticated } = useAuth();

  // Show spinner until auth check completes
  if (isLoading) {
    return <AuthLoadingState />;
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated || !user) {
    redirect('/login');
  }

  // Auth confirmed — render dashboard
  return (
    <AppProvider>
      <DashboardContent />
    </AppProvider>
  );
}

export default function Home() {
  return <AuthGate />;
}
