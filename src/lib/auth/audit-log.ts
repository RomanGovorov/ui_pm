/**
 * AUTH-007: Structured auth event logging.
 * Server-side only. NEVER log passwords or tokens.
 */

export type AuthEventType =
  | 'login_success'
  | 'login_failure'
  | 'register'
  | 'logout'
  | 'auth_error';

interface AuthLogEntry {
  timestamp: string;
  event: AuthEventType;
  email?: string;
  ip: string;
  reason?: string;
}

/**
 * Log an auth event to stdout (structured JSON for production log aggregation).
 * Never logs passwords, tokens, or sensitive data.
 */
export function logAuthEvent(entry: AuthLogEntry): void {
  console.log(JSON.stringify({
    level: entry.event === 'login_failure' || entry.event === 'auth_error' ? 'warn' : 'info',
    ...entry,
  }));
}
