# BUG-001: Tailwind Dark Mode Classes Purged in Production

| Field | Value |
|-------|-------|
| **Severity** | HIGH |
| **Status** | FIXED (2026-08-13, code-implementer) |
| **Priority** | P1 |
| **Component** | `app/src/app/components/kanban/TaskCard.tsx` |
| **Reported By** | comprehensive-test-engineer (T45a) |
| **Date** | 2026-08-13 |
| **Original Finding** | Code review HIGH-001 |
| **Verification** | Static analysis confirms dynamic `dark:` class construction |

---

## Description

The priority badge in `TaskCard.tsx` uses dynamic template literal construction to apply Tailwind classes:

```tsx
className={`... dark:${priorityStyle!.dark} ${priorityStyle!.light}`}
```

Where `priorityStyle.dark` is a string like `'bg-red-900/30 text-red-400'`. This produces classes at runtime (`dark:bg-red-900/30`), but the **complete string** `dark:bg-red-900/30` never appears literally in source code.

Tailwind's JIT content scanner only detects **complete class name strings present in source files** — it does NOT parse template literals or dynamic expressions. Therefore, all `dark:` prefixed classes are never generated in production builds.

### Additional Issue

The `dark` style contains TWO classes (`bg-red-900/30 text-red-400`), but applying `dark:` prefix only to the first one means `text-red-400` applies unconditionally in both light AND dark modes, potentially conflicting with `text-red-700` from the light variant.

## Impact

- Priority badges render with **wrong colors in dark mode** (the default theme)
- `text-*` color variants bleed between light/dark modes
- Visual consistency broken in the most common deployment scenario

## Reproduction

1. Build the app in production mode: `npm run build`
2. Run the production server: `node .next/server/app/page.js`
3. Default browser theme is dark → check priority badge colors
4. Observe: red/amber/green text labels are missing or incorrect

## Recommended Fix

Replace dynamic class construction with a static lookup table:

```tsx
const PRIORITY_CLASSES: Record<string, string> = {
  high: 'dark:bg-red-900/30 dark:text-red-400 bg-red-100 text-red-700',
  medium: 'dark:bg-amber-900/30 dark:text-amber-400 bg-amber-100 text-amber-700',
  low: 'dark:bg-green-900/30 dark:text-green-400 bg-green-100 text-green-700',
};

// In component:
className={`rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_CLASSES[task.priority] ?? PRIORITY_CLASSES['medium']}`}
```

Alternatively, add the specific patterns to `safelist` in `tailwind.config.ts`.

## Test Evidence

Static analysis test `TC-A11Y-TC008` confirms the pattern exists in source:
- File contains `dark:` combined with `priorityStyle` variable
- Template literal `${priorityStyle` is used for class composition
