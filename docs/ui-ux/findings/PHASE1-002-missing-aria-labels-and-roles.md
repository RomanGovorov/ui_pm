# PHASE1-002: Отсутствие ARIA-атрибутов и landmark-ролей

**Severity:** Critical (блокирует доступность для screen reader пользователей)
**Area:** Accessibility
**Components:** All (AppShell, Sidebar, KanbanBoard, TaskCard, Header, Modals)

## Описание

Прототип не содержит никаких ARIA-атрибутов. Это критическая проблема, так как без семантической разметки пользователи скринридеров не могут ориентироваться в интерфейсе.

### Выявленные проблемы

#### 1. Нет landmark-ролей

| Элемент HTML | Требуемая роль | Статус |
|-------------|---------------|--------|
| `<aside>` (Sidebar) | Already has implicit role ✅ | OK |
| Main content area (`<div>`) | `role="main"` | ❌ Missing |
| `<header>` | Already has implicit role ✅ | OK |
| `<form>` (modals) | Already has implicit role ✅ | OK |
| Modal overlay | `role="dialog"` | ❌ Missing |

#### 2. Нет ARIA-меток

| Элемент | Требуемый атрибут | Статус |
|---------|------------------|--------|
| Sidebar button items | `aria-current="page"` для активного | ❌ |
| Kanban column headers | `aria-label` с описанием колонки | ❌ |
| Priority badge | `aria-label` с текстовым эквивалентом | ❌ |
| Theme toggle | `aria-label` ("Switch to light/dark theme") | ❌ |
| Close modal button | `aria-label="Close"` или текстовая альтернатива | ❌ |
| Empty state icon | `aria-hidden="true"` | ❌ |
| SVG иконки (decorative) | `aria-hidden="true"` | ❌ |
| Connection status | `aria-live="polite"` region | ❌ |
| Online/Offline indicator | `aria-label` со статусом | ❌ |

#### 3. Нет live-regions

Реальные обновления задач приходят через SSE (в продакшене). В прототипе симуляция через `setInterval`. Пользователи скринридеров не узнают об изменениях без:
```tsx
<div aria-live="polite" aria-atomic="true">
  Задача "{task.title}" перемещена в "Review"
</div>
```

#### 4. Модальные окна

Обертка модального окна (`div` с `fixed inset-0`) не имеет:
- `role="dialog"`
- `aria-modal="true"`
- `aria-labelledby` (ссылка на заголовок h2)
- Focus trap (первый элемент фокуса внутри модалки должен получать focus при open)
- Скрытие контента от скринридеров (`aria-hidden="true"` на app root при открытой модалке)

## Рекомендации

### Минимум для Phase 2 реализации

1. **Landmark roles:**
   ```tsx
   <main role="main" id="main-content">...</main>
   <div role="dialog" aria-modal="true" aria-labelledby="modal-title">...</div>
   ```

2. **ARIA-метки:**
   ```tsx
   // Active sidebar item
   <button aria-current="page" {...}>Проект</button>
   
   // Column headers
   <h2 aria-label={`In Work — ${count} задач`}>In Work</h2>
   
   // Priority badge
   <span aria-label={`Приоритет: High`}>High</span>
   
   // Theme toggle
   <button aria-label={theme === 'dark' ? 'Переключить на светлую тему' : 'Переключить на тёмную тему'}>
   
   // Decorative SVGs
   <svg aria-hidden="true" focusable="false">
   ```

3. **Live region:**
   ```tsx
   <div aria-live="polite" className="sr-only" id="task-updates">
     {lastUpdateMessage}
   </div>
   ```

4. **Modal focus management:**
   - При открытии: сохранить предыдущий focus element
   - Переместить focus на первый input поля
   - Закрыть ESC
   - При закрытии: вернуть focus

5. **Skip-to-content link:**
   ```html
   <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 z-[9999] bg-blue-600 text-white px-4 py-2 rounded">
     Перейти к содержимому
   </a>
   ```

## WCAG Reference

- **WCAG 1.3.1 Info and Relationships** (A) — информация не передается только визуально
- **WCAG 2.4.1 Block Skips** (A) — возможность пропустить навигацию
- **WCAG 2.4.2 Page Titled** (A) — страница должна иметь title
- **WCAG 2.4.3 Focus Order** (A) — логичный порядок фокуса
- **WCAG 2.4.6 Headings and Labels** (A) — описательные заголовки и метки
- **WCAG 2.4.7 Focus Visible** (AA) — видимый индикатор фокуса
- **WCAG 4.1.2 Name, Role, Value** (A) — имя, роль и значение для UI компонентов
