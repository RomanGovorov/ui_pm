---
name: Authentication Guide
version: 1.1.0
date: 2026-08-14
author: tech-docs-writer
type: user-guide
audience: stakeholder
---

# Authentication Guide

> **Version**: 1.1.0  
> **Last Updated**: 2026-08-14

This guide explains how authentication works in the Project Manager UI — from logging in and out to understanding your role-based permissions.

---

## Table of Contents

- [How Authentication Works](#how-authentication-works)
- [Logging In](#logging-in)
- [Registering a New Account](#registering-a-new-account)
- [Session Management](#session-management)
- [Roles and Permissions](#roles-and-permissions)
- [Security Notes](#security-notes)
- [Troubleshooting](#troubleshooting)

---

## How Authentication Works

The Project Manager UI supports two types of users:

| User Type | How They Access | Purpose |
|-----------|----------------|---------|
| **Browser Users** (stakeholders, admins) | Email + password via the web UI | Review project status, view tasks |
| **AI Agents** (programmatic access) | API key sent as `X-API-Key` header | Create/update tasks programmatically |

When you log in through the browser, you receive a session cookie that persists for **7 days**. During this time, you can navigate between pages without re-entering credentials.

### The Auth Flow

```
Visit dashboard → No valid cookie → Redirected to /login
                    ↓
Enter email + password → Server verifies → JWT cookie set (7 days)
                    ↓
Redirected to dashboard → Can access all data
```

---

## Logging In

1. Navigate to the login page (`/login`) if you are not already logged in.
2. Enter your registered email address.
3. Enter your password.
4. Click **"Login"**.

If credentials are correct, you will be redirected to the dashboard. Your session persists for 7 days.

### Login Page Features

- **Auto-focus** on the email field
- **Error messages** displayed in a red banner at the top of the form
- **Loading state**: button shows "Signing in..." while authenticating (prevents double-submission)
- **Rate limiting**: After 10 failed attempts within 60 seconds, you must wait before trying again

### If You Forget Your Password

Contact your project administrator to reset your credentials. There is no self-service password reset in v1.

---

## Registering a New Account

Open registration is available by default. Anyone who can access the application URL can create an account.

1. Navigate to the register page (`/register`).
2. Fill in your display name, email address, and choose a password.
3. Confirm your password by typing it again.
4. Click **"Create Account"**.

### Password Requirements

| Requirement | Rule |
|-------------|------|
| Length | At least 8 characters, at most 128 |
| Common passwords | Cannot use any of the ~100 most common passwords (e.g., "password", "12345678") |
| Match | Must match the confirmation field exactly |

Registration indicator appears next to the confirm password field:
- ✅ Green checkmark when passwords match
- ❌ Red X when they don't match

### Registration Disabled

Your administrator may disable open registration after initial setup. If you see a message saying "Registration is currently disabled," contact your admin to request an account.

---

## Session Management

### Automatic Session Expiry

Your session expires **7 days** after login. When it expires, you will need to log in again. There is no automatic refresh or "remember me" feature in v1.

### Manual Logout

Click **"Logout"** in the sidebar to end your session immediately:

1. Find the logout button in the left sidebar (below your email address).
2. Click it — you will be redirected to the login page.

### Session State After Logout

- The server clears the session cookie.
- The browser's local auth state is cleared immediately.
- You can still visit `/login` to authenticate again.
- The back button does not return to the previous page (uses `router.replace()`).

---

## Roles and Permissions

Each user has one of three roles. Your role determines what you can do in the application:

| Role | Can View Dashboard | Can Create Tasks | Can Edit Tasks | Can Delete Tasks | Can Manage Users |
|------|--------------------|------------------|----------------|------------------|------------------|
| **Admin** (`admin`) | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **Stakeholder** (`stakeholder`) | ✅ Yes (read-only view) | ❌ No | ❌ No | ❌ No | ❌ No |
| **Agent** (`agent`) | N/A (API only) | ✅ Yes | ✅ Yes | ✅ Yes | N/A (API only) |

### What Each Role Sees

**Admin users** see:
- Full Kanban board with drag-and-drop task management
- "Create Project" and "Create Task" buttons
- User management capabilities (via API)

**Stakeholder users** see:
- The same Kanban board layout
- Projects and tasks visible but not editable
- No "Create Project" or "Create Task" buttons in the interface
- Real-time event stream updates (SSE) — new tasks appear as agents create them

**Agent users**:
- Do not use the browser interface
- Interact exclusively via the REST API using their API key
- Have full read/write access to all resources

### Role Changes

If your role is changed by an administrator (e.g., from `stakeholder` to `admin`), the change takes effect **immediately** on the server side. However, your existing JWT cookie contains your old role. The change becomes visible after:
- You log in again, OR
- Your 7-day cookie expires and you re-authenticate

---

## Security Notes

### Why You Can't See Your Own Registered Emails

When you try to register with an email that's already taken, you receive a generic success message rather than an error. This is intentional — it prevents attackers from discovering which emails are registered in the system.

After registering with an email you know exists, you should:
1. Note the success message: *"If an account with this email exists, you can sign in at /login"*
2. Go to `/login` instead of trying to register again

### How Your Session Cookie Works

The session cookie (`auth_token`) has these protections:

| Protection | What It Does |
|------------|-------------|
| **HttpOnly** | JavaScript cannot read the cookie — protects against XSS attacks |
| **sameSite=Lax** | The cookie is only sent with same-site navigation — reduces CSRF risk |
| **Secure** (production) | Only sent over HTTPS — prevents interception on public networks |
| **7-day expiry** | Limiting session duration reduces impact if the cookie is compromised |

### Rate Limiting

To protect against brute-force attacks:
- Maximum 10 failed login attempts per IP per minute
- After reaching the limit, you'll see a "Too many failed login attempts" message
- Wait 60 seconds before retrying

### Audit Logging

All authentication events are logged for security monitoring:
- Successful logins
- Failed login attempts
- Account registrations
- Logouts
- Errors

Logs include timestamp, event type, email address, and IP address. Passwords and tokens are never stored in logs.

---

## Troubleshooting

### "Invalid email or password" but I'm sure my credentials are correct

Possible causes:

1. **Caps lock is on** — Passwords are case-sensitive. Check Caps Lock and keyboard language.
2. **You registered with a different email** — Try other email addresses you might have used.
3. **Your account hasn't been created yet** — Make sure you completed registration first. If you see the generic message during registration but no confirmation, go to `/login` — your account may already exist.
4. **Account was deleted** — Contact your admin to verify your account status.

### "Too many failed login attempts"

You've exceeded 10 failed login attempts in the last 60 seconds. Wait at least 60 seconds before trying again. If this keeps happening:

- Check Caps Lock
- Verify you're using the correct email
- Contact your admin — there may be a locked account issue

### Session keeps expiring too quickly

Sessions expire after 7 days automatically. If you're finding yourself logging out sooner than expected:

1. Check browser settings — cookies may be blocked or cleared by privacy extensions
2. Check if you're clearing site data regularly
3. On shared machines, other users may be clearing cookies

### SSE events not updating

The real-time event stream requires authentication. If you're connected to `/api/events` but not receiving events:

1. Verify you're logged in — navigate to `/api/auth/me` (in browser, this shows your user data or a 401)
2. Refresh the page to reconnect the SSE stream
3. Clear browser cache and cookies, then log in again

---

For more detailed information about the auth endpoints, see the [Auth API Reference](../api/auth.md).
