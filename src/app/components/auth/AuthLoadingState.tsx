/**
 * MED-005: Auth loading state component.
 * Centered spinner with sr-only text for screen readers.
 * Used during auth session check (prevents FOUC — CRIT-001).
 */
export function AuthLoadingState() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-primary">
      <div className="flex flex-col items-center gap-4">
        <div
          className="h-10 w-10 animate-spin rounded-full border-4 border-border-primary border-t-accent-blue"
          aria-hidden="true"
        />
        <span className="sr-only">Loading...</span>
      </div>
    </div>
  );
}
