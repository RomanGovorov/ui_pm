# PHASE1-001: Цветовой контраст — тёмная тема

**Severity:** Serious (нарушает WCAG 1.4.3)
**Area:** Themes / Accessibility
**Component:** AppShell, Sidebar, Header, TaskCard, Modals

## Описание

В текущем прототипе (`src/components/*.tsx`, `src/App.tsx`) используются цвета Tailwind CSS для тёмной темы, которые не гарантируют минимальный контраст 4.5:1 по WCAG 2.1 AA для обычного текста.

### Выявленные нарушения

| Элемент | Текущий цвет (dark) | WCAG min contrast | Проблема |
|---------|-------------------|-------------------|----------|
| `.text-gray-400` на `bg-gray-800` | ~3.9:1 (на серый фон) | 4.5:1 | Description в TaskCard, footer assignee text |
| `.text-gray-400` на `bg-gray-900` | ~4.53:1 ✅ | 4.5:1 | Border-side only, acceptable |
| `.text-gray-500` на `bg-gray-800` | ~2.9:1 | 4.5:1 | Footer date в TaskCard — **FAIL** |
| `.text-gray-500` на `bg-gray-900` | ~3.55:1 | 4.5:1 | Section labels в Sidebar — **FAIL** |
| `.text-gray-600` на `bg-white` | ~5.9:1 ✅ | 4.5:1 | Light mode — ok |
| `.text-gray-400` заголовки колонок | ~4.86:1 | 4.5:1 | Acceptable borderline |

### Детали

**TaskCard.tsx** — строка с датой обновлений использует `text-gray-500` на `bg-gray-800`:
```tsx
<span className={`text-[11px] ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
  {formatDate(task.updatedAt)}
</span>
```

**Sidebar.tsx** — label «Проекты» использует `text-gray-500` на `bg-gray-900`:
```tsx
<div className={`text-xs font-semibold uppercase tracking-wider px-2 mb-2 ${
  theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
}`}>
```

**KanbanColumn.tsx** — счётчик задач использует `text-gray-400` на `bg-gray-700`:
```tsx
className={theme === 'dark' ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'}
```

## Рекомендации

1. Для основного body-текста использовать `gray-300` (против `gray-400`) где требуется ≥4.5:1
2. Для secondary/meta-текста (даты, подписи) — допустим `gray-400` если шрифт ≥18px/bold (WCAG Large Text = 3:1), иначе `gray-300`
3. Определить дизайн-токены в `globals.css` с гарантированными парами:
   ```css
   /* --text-primary: #E5E7EB (gray-200) → contrast 12.6:1 on gray-950 */
   /* --text-secondary: #D1D5DB (gray-300) → contrast 7.5:1 on gray-950 */
   /* --text-muted: #9CA3AF (gray-400) → contrast 5.7:1 on gray-950 */
   ```
4. Протестировать светлую тему отдельно (хотя она выглядит корректно)

## WCAG Reference

- **WCAG 1.4.3 Contrast (Minimum)** AA — 4.5:1 для normal text (<18px)
- **WCAG 1.4.6 Contrast (Enhanced)** AAA — 7:1 для normal text
