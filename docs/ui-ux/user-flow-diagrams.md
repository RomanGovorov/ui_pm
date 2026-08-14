# User Flow Diagrams — Project Manager UI v1

**Version:** 1.0
**Author:** ui-ux-accessibility-specialist (Phase 1 Audit)
**Date:** 2026-08-13

---

## 1. Stakeholder — View Dashboard (Primary Flow)

```
┌─────────────────────┐
│   Open Dashboard    │
│   in Browser        │
└──────────┬──────────┘
           │
           ▼
┌──────────────────────────────┐
│  App loads, connects to SSE  │
│  Sidebar: project list       │
│  Header: current project     │
│  Board: task cards by status │
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│  Stakeholder views board     │
│  Scans columns left→right    │
│  Reads card titles + priority│
│  Sees assignee + dates       │
└──────────────────────────────┘
```

### Decision Points
| Decision | If Yes → | If No → |
|----------|----------|---------|
| Want to see different project? | Click sidebar project (§2) | Stay on current view |
| Want to see subproject filter? | Use subproject selector | View all tasks |

### Error Paths
| Error | Recovery |
|-------|----------|
| Network failure | Error banner appears; retry button |
| API timeout | Skeleton loading → error banner |
| SSE disconnect | Connection indicator turns red; reconnect auto |

---

## 2. Stakeholder — Switch Projects

```
┌──────────────────┐
│ Click project    │
│ in Sidebar       │
└───────┬──────────┘
        │
        ▼
┌──────────────────────────────────┐
│ Sidebar: active state changes    │
│   - Old: gray text, transparent  │
│   - New: blue bg, blue text      │
│   - focus-visible ring shows     │
└───────┬──────────────────────────┘
        │
        ▼
┌──────────────────────────────────┐
│ Board: re-renders                │
│   - tasks filtered by new proj   │
│   - brief fade animation 150ms   │
└───────┬──────────────────────────┘
        │
        ▼
┌──────────────────────────────────┐
│ Header: updates                  │
│   - new project name             │
│   - subproject selector updated  │
│   - task counts refreshed        │
└──────────────────────────────────┘
```

---

## 3. Stakeholder — Create Task

```
┌──────────────────┐
│ Click "Создать"  │
│ задачу (Header)  │
└───────┬──────────┘
        │
        ▼
┌──────────────────────────────────┐
│ Modal opens                      │
│   - backdrop with blur           │
│   - body scroll locked           │
│   - focus on title input         │
│   - screen reader announced      │
│     "Dialog: Создать задача"     │
└───────┬──────────────────────────┘
        │
        ▼
┌──────────────────────────────────┐
│ Fill form fields                 │
│   - Название *                   │
│   - Ответственный *              │
│   - Приоритет (default: Medium)  │
│   - Описание (optional)          │
│                                  │
│ Validation:                      │
│   - Empty required field: red    │
│     border + inline error        │
│   - Title > 200 chars: char      │
│     counter warning              │
└───────┬──────────────────────────┘
        │ Submit
        ▼
┌──────────────────────────────────┐
│ OPTIMISTIC UPDATE                │
│ Card appears in In Work column   │
│ (blue flash highlight 2s)        │
└───────┬──────────────────────────┘
        │
        ├── POST /api/tasks ──Success──▶
        │   │                            │
        │   │                            ▼
        │   │                     Toast: "Задача создана"
        │   │                     Auto-dismiss 5s
        │   │
        │   └─Error─────────────────▶
        │                            │
        │                            ▼
        │                     Rollback: remove card
        │                     Toast: "Ошибка создания"
        │                     Retry available
        │
        ▼
┌──────────────────────────────────┐
│ Modal closes                     │
│ Focus returns to trigger button  │
└──────────────────────────────────┘
```

---

## 4. Stakeholder — Real-time Task Status Update

```
┌────────────────────────────────┐
│ Agent calls API:               │
│ PATCH /api/tasks/:id           │
│ { status: 'review' }           │
└──────────┬─────────────────────┘
           │
           ▼
┌────────────────────────────────┐
│ Server processes update        │
│ Emits SSE event:               │
│ task_updated: { id, status }   │
└──────────┬─────────────────────┘
           │ SSE Push
           ▼
┌────────────────────────────────┐
│ Browser receives event         │
│ (EventSource)                  │
└──────────┬─────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────┐
│ Client-side processing:                       │
│                                               │
│ 1. Find task in local state                   │
│ 2. Update task.status + updatedAt             │
│ 3. Animate card OUT of old column             │
│    (slide transition 300ms ease-out)          │
│ 4. Animate card IN to new column              │
│    (slide transition 300ms ease-in)           │
│ 5. Announce to SR: "Задача X перемещена в Y" │
│    via aria-live="polite" region              │
│ 6. Show toast notification                    │
│    Bottom-right corner                        │
└───────────────────────────────────────────────┘
```

---

## 5. Stakeholder — Change Theme

```
┌──────────────────┐
│ Click theme      │
│ toggle (Sidebar) │
└───────┬──────────┘
        │
        ▼
┌──────────────────────────────────┐
│ State toggles: dark ↔ light      │
│ html.class toggled               │
└───────┬──────────────────────────┘
        │
        ▼
┌──────────────────────────────────┐
│ Tailwind dark mode activates     │
│ All elements transition (200ms)  │
│   - backgrounds shift            │
│   - text colors swap             │
│   - borders adapt                │
│   - shadows change               │
└───────┬──────────────────────────┘
        │
        ▼
┌──────────────────────────────────┐
│ localStorage updated             │
│ Persisted across page refresh    │
└──────────────────────────────────┘
```

---

## 6. Stakeholder — Keyboard Navigation Flow

```
┌──────────────────────────────┐
│ User presses Tab             │
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│ SKIP TO CONTENT LINK activated   │
│ (hidden visually, visible on     │
│  :focus-within)                  │
└───────┬──────────────────────────┘
        │ Enter
        ▼
┌──────────────────────────────────┐
│ FOCUS on Main content area       │
│ (#main-content anchor)           │
└───────┬──────────────────────────┘
        │ Tab...Tab...Tab
        ▼
┌──────────────────────────────────┐
│ TAB ORDER:                      │
│ 1. Sidebar: projects list (each  │
│    project is a tabbable btn)    │
│ 2. Sidebar: "Создать проект"     │
│ 3. Sidebar: theme toggle switch  │
│ 4. Header: subproject selector   │
│ 5. Header: "Создать задачу" btn  │
│ 6. Kanban board cards (if any)   │
│    Each card is a groupable div  │
│    with accessible info          │
└──────────────────────────────────┘
        │ Tab wraps to top or
        │ reaches end of page
        ▼
┌──────────────────────────────────┐
│ End of tabbable elements reached │
│ Focus may wrap or reach end      │
│ depending on browser defaults    │
└──────────────────────────────────┘
```

---

## 7. Stakeholder — Modal Workflow (Create/Close)

```
┌───────────────────────────────┐
│ User clicks modal trigger     │
│ ("Создать задачу" or          │
│  "Создать проект")            │
└───────┬───────────────────────┘
        │
        ▼
┌──────────────────────────────────┐
│ MODAL STATE CHANGE:              │
│   - Backdrop renders             │
│   - Modal shell renders          │
│   - First input gets autofocus   │
│   - Body overflow = hidden       │
│   - Root app gets aria-hidden    │
│     ="true" for screen readers   │
│   - aria-modal="true" set        │
│   - aria-labelledby linked       │
└───────┬──────────────────────────┘
        │
        ├── ESC pressed ──▶ Close modal (with unsaved warning)
        │
        ├── Background click ──▶ Close modal (with unsaved warning)
        │
        └── Form submitted ──▶
                │
                ▼
        ┌──────────────────────────────┐
        │ Form validation:             │
        │   Required fields checked    │
        │   Inline error messages      │
        │   On success: API call       │
        │   On error: rollback + toast │
        └──────────────────────────────┘
                │
                ▼
        ┌──────────────────────────────┐
        │ Modal closes:                │
        │   - Backdrop removed         │
        │   - Body overflow restored   │
        │   - Focus returned to trigger│
        │   - aria-hidden cleared      │
        └──────────────────────────────┘
```

---

## 8. Connection Status States

```
┌───────────────────────┐
│ SSE connected          │
├───────────────────────┤
│ ● Green dot            │
│ "Онлайн"              │
│ Pulse animation        │
└───────────────────────┘
         │
    SSE event received
         │
         ▼
┌───────────────────────┐
│ Task data updated      │
│ Board re-rendered      │
│ Toast shown            │
│ Live region announced  │
└───────────────────────┘

...time passes...

┌───────────────────────┐
│ SSE connection lost    │
├───────────────────────┤
│ ● Red dot              │
│ "Оффлайн"              │
│ No pulse animation     │
└───────────────────────┘
         │
    Reconnect attempt
         │
         ▼
┌───────────────────────┐
│ SSE reconnecting...    │
│ EventSource auto-retry │
│ Exponential backoff    │
├───────────────────────┤
│ ● Orange pulsing dot   │
│ "Переподключение..."   │
└───────────────────────┘
         │
         ▼
┌───────────────────────┐
│ SSE reconnected ✅     │
│ Data refetched         │
│ Board refreshed        │
│ Green dot restored     │
└───────────────────────┘
```

---

## 9. Error Recovery Flows

### 9.1 API Failure on Task Creation

```
Form Submitted
     │
     ▼
POST /api/tasks → 500 Internal Server Error
     │
     ▼
Optimistic card added → Immediately removed (rollback)
     │
     ▼
Toast: "Не удалось создать задачу. Попробуйте ещё раз."
     │
     ▼
User sees: filled form still open with errors highlighted
     │
     ▼
Options:
  a) Fix errors → Resubmit
  b) Click "Отмена" → Clear form, close modal
  c) Retry (same data) → POST again
```

### 9.2 SSE Disconnection During Active Session

```
SSE Stream drops
     │
     ▼
Connection indicator → Red "Оффлайн"
     │
     ▼
EventSource auto-reconnects (built-in behavior)
     │
     ▼
If reconnect succeeds within 5s: seamless recovery
     │
     ▼
If reconnect fails after 3 attempts (>30s):
  Banner: "Потеряно подключение к серверу. Данные могут быть устаревшими."
  Button: "Обновить вручную" → refetch all tasks
```

---

## 10. Accessibility-specific Flows

### 10.1 Screen Reader Navigation Through Kanban Board

```
Screen reader announces:
  "KanbanBoard section"
  
  Then for each column:
  "In Work column, 3 задач, heading level 2"
  
  Then each card in column:
  "Card: Реализовать экран авторизации, 
   Приоритет: высокий, 
   Иван Иванов, 
   2 ч. назад"
   
  "Review column, 2 задач, heading level 2"
  "Done column, 1 задач, heading level 2"
  
Finally header stats:
  "Статистика: In Work 3, Review 2, Done 1"
  "Статус подключения: онлайн"
```

```

---

## 11. Authentication Flows (TSK-018)

### 11.1 First-Time User — Registration Flow

```
┌───────────────────────────┐
│   Open /register in       │
│   browser                 │
└───────────┬───────────────┘
            │
            ▼
┌───────────────────────────┐
│   Register page loads     │
│   • Card centered on      │
│     dark background       │
│   • Heading: "Create      │
│     Account" (h1)         │
│   • Focus moves to name   │
│     field (autoFocus)     │
└───────────┬───────────────┘
            │
            ▼
┌───────────────────────────────────┐
│   Fill registration form          │
│                                   │
│   ┌───────────────────────────┐   │
│   │ Name *                    │   │
│   │ [___________________]     │   │
│   │                           │   │
│   │ Email *                   │   │
│   │ [___________________]     │   │
│   │                           │   │
│   │ Password *                │   │
│   │ [___________________]     │   │
│   │ ▓▓▓░░ Strength: good   ✓ │   │ ← strength meter
│   │                           │   │
│   │ Confirm password *        │   │
│   │ [___________________]     │   │
│   │                            │   │ ← real-time checkmark
│   │                            │   │   ✓ when matching
│   │                            │   │   ✗ when not
│   │                           │   │
│   │ [ Create Account ]        │   │
│   │                           │   │
│   │ Already have an account?  │   │
│   │ Sign in                   │   │
│   └───────────────────────────┘   │
└───────────┬───────────────────────┘
            │ Submit (Enter or click)
            ▼
┌───────────────────────────────────┐
│   Loading state                   │
│   • Button: "Creating..."         │
│   • Button disabled               │
│   • Spinner optional              │
└───────────┬───────────────────────┘
            │
            ├── POST success (201) ──▶
            │                       │
            │                       ▼
            │                ┌──────────────────────┐
            │                │ Toast: "Account      │
            │                │ created successfully"│
            │                │ (green, 5s auto-dismiss)│
            │                │                      │
            │                │ Redirect to / (dashboard)│
            │                └──────────────────────┘
            │
            └── POST error (409/400) ──▶
                                          │
                                          ▼
                                   ┌──────────────────────┐
                                   │ Error banner top-of-form│
                                   │ "Email already exists" │
                                   │ Red border on email     │
                                   │ field + inline error    │
                                   │ Toast: "Error" (red,7s) │
                                   └────────────────────────┘
```

**Accessibility during this flow:**
- Screen reader announces: "Create Account heading level 1. Form with 4 fields."
- Each label is read before corresponding input
- On focus, screen reader announces: "Name, edit text, required"
- When strength meter changes: "Password strength changed to good" (aria-live)
- When confirm matches: "Passwords match" (aria-live polite)
- On submit: button announces "Creating account, button, disabled"
- After redirect: "You have been registered successfully. Navigating to dashboard." (aria-live assertive)

---

### 11.2 Returning User — Login Flow

```
┌───────────────────────────┐
│   Navigate to /login      │
│   (or redirected from /)  │
└───────────┬───────────────┘
            │
            ▼
┌───────────────────────────┐
│   Login page loads        │
│   • Card centered         │
│   • Heading: "Sign In"    │
│   • Focus on email field  │
└───────────┬───────────────┘
            │
            ▼
┌───────────────────────────────────┐
│   Fill login form                 │
│                                   │
│   ┌───────────────────────────┐   │
│   │ Email *                   │   │
│   │ [_______________]         │   │
│   │                           │   │
│   │ Password *                │   │
│   │ [_______________]         │   │
│   │                           │   │
│   │ [ Login ]                 │   │
│   │                           │   │
│   │ Don't have an account?    │   │
│   │ Sign up                   │   │
│   └───────────────────────────┘   │
└───────────┬───────────────────────┘
            │ Submit
            ▼
┌───────────────────────────────────┐
│   VALIDATION ERROR path           │
│   • Empty field → red border +    │
│     inline error                  │
│   • Invalid email → same          │
│   • Focus reverts to first error  │
│   Button remains enabled (retry)  │
└───────────┬───────────────────────┘
            │ Retry
            ▼
┌───────────────────────────────────┐
│   SERVER ERROR path               │
│   • Wrong credentials →           │
│     Top-of-form banner:           │
│     "Invalid email or password"   │
│   • Button shows "Signing in..."  │
│     then returns to "Login" after │
│     ~300ms bcrypt time            │
│   • Toast: error type (red, 7s)   │
└───────────┬───────────────────────┘
            │ Rate limited
            ▼
┌───────────────────────────────────┐
│   RATE LIMITED path               │
│   • Warning banner: amber         │
│   • "Too many attempts. Wait Xs"  │
│   • Countdown timer               │
│   • Button disabled during wait   │
└───────────┬───────────────────────┘
            │ Correct credentials
            ▼
┌───────────────────────────────────┐
│   SUCCESS path                    │
│   • JWT cookie set (httpOnly)     │
│   • AuthContext updates           │
│   • router.replace('/')           │
│   • Dashboard renders             │
│   • Keyboard focus on main area   │
│   • Screen reader: "Logged in"    │
└───────────────────────────────────┘
```

---

### 11.3 Session Restoration (Page Load Without Auth)

```
┌───────────────────────────────┐
│ User opens app in browser     │
│ (previously logged in session)│
└───────────┬───────────────────┘
            │ GET /
            ▼
┌───────────────────────────────┐
│ Middleware checks JWT cookie  │
│                             │
│ Cookie present + valid?       │
│   YES → pass through          │
│   NO → redirect /login        │
└───────────┬───────────────────┘
            │ Pass through
            ▼
┌───────────────────────────────┐
│ AppShell renders              │
│ AuthProvider mounts           │
│ isLoading = true              │
│ Minimal spinner shown         │
│ (DO NOT show dashboard       │
│  skeleton — prevents FOUC)    │
└───────────┬───────────────────┘
            │ useEffect mount
            ▼
┌───────────────────────────────┐
│ GET /api/auth/me              │
│ (cookie sent automatically)   │
└───────────┬───────────────────┘
            │
            ├── Success (200) ──▶
            │                    │
            │                    ▼
            │             ┌──────────────────────┐
            │             │ AuthContext:          │
            │             │ user = {id, email,   │
            │             │  name, role}          │
            │             │ isAdmin = true/false  │
            │             │ isLoading = false     │
            │             │                       │
            │             │ Dashboard renders     │
            │             │ Sidebar adapts to     │
            │             │ role (admin buttons   │
            │             │ visible for admin)    │
            │             └──────────────────────┘
            │
            └── Failure (401) ──▶
                                  │
                                  ▼
                           ┌──────────────────────┐
                           │ AuthContext:          │
                           │ user = null           │
                           │ isLoading = false     │
                           │                       │
                           │ useEffect detects     │
                           │ user === null         │
                           │ → router.push('/login')│
                           └──────────────────────┘
```

---

### 11.4 Logout Flow

```
┌───────────────────────────────┐
│ User clicks Logout in sidebar │
└───────────┬───────────────────┘
            │
            ▼
┌───────────────────────────────┐
│ POST /api/auth/logout         │
│ Cookie: auth_token=<JWT>      │
└───────────┬───────────────────┘
            │
            ▼
┌───────────────────────────────┐
│ Server clears cookie:         │
│ Set-Cookie: auth_token=;      │
│   Max-Age=0; Path=/           │
└───────────┬───────────────────┘
            │ Response 200 OK
            ▼
┌───────────────────────────────┐
│ AuthContext:                  │
│ user = null                   │
│ isLoading = false             │
└───────────┬───────────────────┘
            │ useEffect watches
            │ user === null
            ▼
┌───────────────────────────────┐
│ router.push('/login')         │
│ Page navigates to login       │
│ Sidebar/header no longer      │
│ rendered (unauthenticated     │
│ shell, just full-page form)   │
└───────────────────────────────┘
```

---

### 11.5 Role-Based UI Adaptation

```
┌───────────────────────────────────────────┐
│ Admin logs in                             │
│ role = 'admin'                            │
├───────────────────────────────────────────┤
│ SIDEBAR:                                  │
│ • Projects list                           │
│ • [+ New Project]                         │  ← VISIBLE
│ • Theme toggle                            │
│ • Logout                                  │  ← VISIBLE
├───────────────────────────────────────────┤
│ HEADER:                                   │
│ • Project info                            │
│ • Stats                                   │
│ • Connection status                       │
│ • [+ Create Task]                         │  ← VISIBLE
└───────────┬───────────────────────────────┘
            │ Logs out, registers as stakeholder
            ▼
┌───────────────────────────────────────────┐
│ Stakeholder logs in                       │
│ role = 'stakeholder'                      │
├───────────────────────────────────────────┤
│ SIDEBAR:                                  │
│ • Projects list                           │
│ • (no "+ New Project")                    │  ← OMITTED FROM DOM
│ • Theme toggle                            │
│ • User email (non-focusable div)          │  ← NEW
│ • (no Logout... oh wait, should have one)│  ← FIX NEEDED
├───────────────────────────────────────────┤
│ HEADER:                                   │
│ • Project info                            │
│ • Stats                                   │
│ • Connection status                       │
│ • (no "+ Create Task")                    │  ← OMITTED FROM DOM
└───────────────────────────────────────────┘

⚠️ NOTE: Logout button MUST be visible for ALL authenticated users
(admin AND stakeholder). Implementation plan step 6.17 says
"show logged-in user email + logout button" — both are always
shown when authenticated, regardless of role.
```

**Tab order comparison:**

| State | Tab Order |
|-------|-----------|
| Admin | Projects → [+NewProject] → Toggle → Logout |
| Stakeholder | Projects → Toggle → Email(div non-focusable) → Logout |

The key difference is `+NewProject` is removed from DOM, so tab order naturally shifts. No artificial gaps. ✅

---

### 11.6 Auth Pages — Mobile Responsive Flow

```
┌─────────────────────────────┐
│ User opens /login on phone  │
│ (iPhone SE: 375px width)    │
└───────────┬─────────────────┘
            │
            ▼
┌───────────────────────────────────┐
│ Card adapts:                      │
│ - max-w-md → w-full mx-4         │
│ - p-8 → p-4                     │
│ - font-size: 16px on inputs      │
│   (prevents iOS zoom-on-focus)   │
│ - min-height: 44px on button     │
└───────────┬───────────────────────┘
            │
            ▼
┌───────────────────────────────────┐
│ User fills form via touch         │
│ All tap targets ≥ 44×44px         │
│ No horizontal scroll              │
│ Everything readable               │
└───────────────────────────────────┘
```

---

### 11.7 Keyboard Navigation Through Auth Forms

```
[Page loads]
  ↓
[FOCUS on #login-email] ← autofocus (announced by SR: "email, edit text")
  ↓ TAB
[#login-password] ← announced: "password, edit text, secure text"
  ↓ TAB
[#submit-button] ← announced: "Login, button"
  ↓ TAB
[#register-link] ← announced: "Don't have an account? Sign up, link"
  ↓ TAB
[wildcard / wraps back to top depending on browser]

During form validation error:
  ↓
[Submit clicked → errors found]
  ↓
[FOCUS restored to first invalid field]
  e.g., if email empty → focus back to #login-email
  ↓
[User fixes email, Tab→password, Enter-submit]
  ↓
[Loading state: button disabled, "Signing in..."]
  ↓
[Success → redirect]
  ↓
[Main content receives logical focus]
```

---

## 12. Accessibility-specific Flows Extension

### 12.1 Screen Reader Experience — Login Page

```
Screen reader reads:
  "Project Manager — Sign In webpage"
  "Create Account link" (from meta/title context)
  
  Then page content:
  "Sign In heading level 1"
  
  "Form"
  "Email, edit text, required"
  "(empty)"
  
  "Password, edit text, secure text, required"
  "(empty)"
  
  "Login, button"
  
  "Don't have an account? Sign up, link"
  
If user focuses and submits without filling:
  "Invalid email, alert" (role="alert" fires immediately)
  Focus returns to email field
  
After fixing and submitting wrong credentials:
  "Invalid email or password, alert" (top-of-form banner)
  "Alert, You have been logged in successfully" (after success redirect)
```

### 12.2 Screen Reader Experience — Role-Based Sidebar

```
Admin sees sidebar:
  "Projects heading level 3"
  "Project Alpha, button, currently selected"
  "Project Beta, button"
  ...
  "New project, button"
  "Toggle light theme, switch, off"
  "Logout, button"

Stakeholder sees sidebar:
  "Projects heading level 3"
  "Project Alpha, button, currently selected"
  "Project Beta, button"
  ...
  (no "New project" button)
  "Toggle light theme, switch, on"
  "user@example.com" (just text, not interactive)
  "Logout, button"

Note: The absence of "New project" button means the
stakeholder's tab traversal has one fewer stop. This is
correct behavior — the element doesn't exist in the DOM.
```


```
[Outside] Press Tab from last sidebar element
     ↓
[FIRST FOCUSABLE] Modal overlay/backdrop NOT tabbable
     ↓ [Esc]
[INSIDE MODAL] Title input receives focus
     ↓ [Tab]
Description textarea
     ↓ [Tab]
Priority select
     ↓ [Tab]
Assignee input
     ↓ [Tab]
Cancel button
     ↓ [Tab]
Submit button
     ↓ [Tab] ← WRAPS BACK
Title input (first focusable)
     ↓ [Shift+Tab]
Submit button
     ↓ [Shift+Tab]
Cancel button
     ...and so on cycling through modal focusable elements...
```
