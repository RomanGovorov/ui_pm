'use client';

import { useState } from 'react';
import { useAppContext } from '@/lib/context/app-context';
import { useAuth } from '@/lib/context/auth-context';
import { useRouter } from 'next/navigation';
import { CreateProjectModal } from '@/app/components/modals/CreateProjectModal';

/**
 * Sidebar — project navigation + theme toggle + user info.
 * CRIT-003: Role-based UI — admin sees "+ New Project", all users see logout.
 * MED-004: Logout button with icon aria-hidden + text label.
 */
export function Sidebar() {
  const { projects, currentProjectId, setCurrentProjectId, theme, toggleTheme } =
    useAppContext();
  const { user, isAdmin, logout } = useAuth();
  const router = useRouter();
  const [showCreateProject, setShowCreateProject] = useState(false);

  async function handleLogout() {
    await logout();
    router.replace('/login');
  }

  return (
    <div className="flex h-full flex-col">
      {/* Logo / Brand */}
      <div className="flex items-center gap-2.5 border-b border-border-primary px-5 py-5">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent-blue text-xs font-bold text-white">
          PM
        </div>
        <span className="text-base font-semibold text-text-primary">
          Project Manager
        </span>
      </div>

      {/* Project List */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
          Projects
        </p>
        <nav aria-label="Project list">
          <ul className="space-y-1" role="listbox" aria-label="Select project">
            {projects.map((project) => {
              const isActive = project.id === currentProjectId;
              return (
                <li key={project.id} role="option" aria-selected={isActive}>
                  <button
                    onClick={() => setCurrentProjectId(project.id)}
                    aria-current={isActive ? 'true' : undefined}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors duration-150 ${
                      isActive
                        ? 'border border-blue-600/30 bg-blue-600/20 text-blue-400'
                        : 'border border-transparent text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
                    }`}
                  >
                    <span className="block truncate">{project.name}</span>
                    {project._count && (
                      <span className="mt-0.5 block text-xs text-text-muted">
                        {project._count.tasks} tasks
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* CRIT-003: Create Project Button — admin/agent only */}
        {(isAdmin || user?.role === 'agent') && (
          <button
            onClick={() => setShowCreateProject(true)}
            className="mt-3 w-full rounded-lg border border-dashed border-border-primary px-3 py-2 text-left text-sm text-text-muted transition-colors hover:bg-bg-tertiary hover:text-text-secondary"
            aria-label="Create new project"
          >
            + New Project
          </button>
        )}
      </div>

      {/* User info + Logout */}
      {user && (
        <div className="border-t border-border-primary px-5 py-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-text-primary">
                {user.name}
              </p>
              <p className="truncate text-xs text-text-muted">
                {user.email}
              </p>
            </div>
          </div>
          {/* MED-004: Logout button — icon aria-hidden + text label */}
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-text-primary"
            aria-label="Logout"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Logout
          </button>
        </div>
      )}

      {/* Theme Toggle */}
      <div className="border-t border-border-primary px-5 py-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-secondary">
            {theme === 'dark' ? 'Dark mode' : 'Light mode'}
          </span>
          <button
            role="switch"
            aria-checked={theme === 'light'}
            aria-label="Toggle light theme"
            onClick={toggleTheme}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 ${
              theme === 'light' ? 'bg-gray-300' : 'bg-blue-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white transition-transform duration-200 ${
                theme === 'light' ? 'translate-x-4' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </div>

      {showCreateProject && (
        <CreateProjectModal onClose={() => setShowCreateProject(false)} />
      )}
    </div>
  );
}
