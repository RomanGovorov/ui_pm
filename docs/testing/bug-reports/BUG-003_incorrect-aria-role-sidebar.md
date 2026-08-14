# BUG-003: Incorrect ARIA Role on Sidebar Aside Element

| Field | Value |
|-------|-------|
| **Severity** | MEDIUM |
| **Status** | FIXED (2026-08-13, code-implementer) |
| **Priority** | P2 |
| **Component** | `app/src/app/components/layout/AppShell.tsx` |
| **Reported By** | comprehensive-test-engineer (T45a) |
| **Date** | 2026-08-13 |
| **Original Finding** | Code review MEDIUM-003 |
| **Verification** | Static analysis confirms role="navigation" on <aside> |

---

## Description

The `<aside>` element in `AppShell.tsx` has `role="navigation"`, creating a semantic mismatch:

```tsx
<aside role="navigation" aria-label="Project navigation">
```

An `<aside>` element has an implicit ARIA role of `complementary`. Setting `role="navigation"` conflicts with this implicit role and misleads screen readers.

Furthermore, the sidebar contains:
1. A brand/logo block (not navigational)
2. A `<nav aria-label="Project list">` (already a proper navigation landmark)
3. A theme toggle switch (not navigational)

This creates two "navigation" landmarks where only one is actual navigation.

## Impact

- Screen readers announce the sidebar as a "navigation" landmark → confusion
- WCAG 1.3.1 (Info and Relationships) violation — roles don't match content
- Users with assistive technology get misleading structural information

## Recommended Fix

Remove `role="navigation"` from `<aside>` — let it keep its implicit `complementary` role:

```tsx
<aside aria-label="Sidebar" className="...">
```

The existing `<nav aria-label="Project list">` inside it is the correct navigation landmark.

## Test Evidence

Accessibility static analysis test `TC-A11Y-AS003` confirmed:
- Source file `app/components/layout/AppShell.tsx` contains `role="navigation"` on `<aside>`
- Actual `<nav>` element exists inside for proper project list navigation
