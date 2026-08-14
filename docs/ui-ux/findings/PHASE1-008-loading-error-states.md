# PHASE1-008: Отсутствие состояний загрузки и ошибок

**Severity:** Moderate (ухудшает usability)
**Area:** KanbanBoard / Loading States
**Component:** `src/components/KanbanBoard.tsx`, API routes

## Описание

Интерфейс не отображает состояния загрузки, ошибок сети, пустые результаты (кроме empty state kanban) и конфликты данных. Пользователь видит только «работает» или «не работает» — нет промежуточных состояний.

### Выявленные проблемы

#### 1. Нет skeleton/ shimmer loading

При загрузке задач (первый рендер страницы или переключение проекта):
```tsx
// KanbanBoard.tsx
const tasks = getProjectTasks()
```

Если `tasks` пуст (загрузка ещё не завершилась), пользователь видит пустую канбан-доску с тремя колонками. Нет понимания, загружаются ли данные или их действительно нет.

Рекомендуемые skeleton-карточки:
```tsx
<div className="flex-1 overflow-x-auto p-6">
  <div className="flex gap-5 h-full">
    {columns.map(col => (
      <div key={col.id} className="flex-1 min-w-[280px] max-w-[380px]">
        <SkeletonColumn isLoading={!tasksLoaded} />
      </div>
    ))}
  </div>
</div>
```

#### 2. Нет error boundary

Нет обёртки компонента для обработки ошибок рендеринга:
```tsx
// Missing: ErrorBoundary wrapper
```

При ошибке JS (например, null reference в компоненте), весь интерфейс ломается без сообщения об ошибке.

#### 3. Нет error state для API

При неудачном запросе к API (5xx, network error):
- Нет banner/alert с сообщением об ошибке
- Нет retry button
- Нет offline indicator (кроме SSE connection status)

#### 4. Нет optimistic update rollback

При создании задачи через модалку:
```tsx
// Optimistic add — no rollback on error
addTask(newTask)
closeModal()
```

Если `POST /api/tasks` вернёт ошибку, задача останется в интерфейсе бесконечно.

#### 5. Empty state слишком простой

```tsx
{grouped[col.id].length === 0 ? (
  <div className={`flex flex-col items-center justify-center py-8 text-center`}>
    <svg className="w-10 h-10 mb-2 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
      <path strokeLinecap="round" strokeLinejoin="round" d="..." />
    </svg>
    <span className="text-xs">Нет задач</span>
  </div>
) : ...}
```

OK для MVP, но стоит дополнить:
- Icon + text — уже реализовано ✅
- Можно добавить tooltip explaining why (e.g., «Задачи перемещены в другую колонку»)
- Нет distinction между «загружено пусто» и «нет данных»

### Рекомендации

1. **Skeleton loader for Kanban columns:**
   ```tsx
   // Skeleton placeholder at same height as card content
   function SkeletonColumn() {
     return (
       <>
         <SkeletonCard />
         <SkeletonCard />
         <SkeletonCard />
       </>
     )
   }
   ```

2. **Error boundary wrapper:**
   ```tsx
   class ErrorBoundary extends React.Component {
     state = { hasError: false }
     static getDerivedStateFromError() { return { hasError: true } }
     render() {
       if (this.state.hasError) return <ErrorFallback message="Произошла ошибка при загрузке данных" />
       return this.props.children
     }
   }
   ```

3. **Network error notification:**
   ```tsx
   // Banner at top of page when offline/error
   <Banner variant="error" action={{ label: 'Повторить', onClick: retry }}>
     Не удалось загрузить данные. Проверьте подключение.
   </Banner>
   ```

4. **Optimistic update with rollback:**
   ```tsx
   try {
     addTask(newTask) // optimistic
     await api.createTask(newTask) // actual API call
   } catch (err) {
     removeTask(newTask.id) // rollback
     showError('Не удалось создать задачу')
   }
   ```

5. **Loading state variable:**
   ```tsx
   // Add to AppState
   interface AppState {
     // ...existing
     isLoading: boolean
     error: Error | null
   }
   ```

## WCAG Reference

- **WCAG 3.3.1 Error Identification** (A) — ошибки идентифицированы и описаны
- **WCAG 3.3.3 Error Suggestion** (A) — предложены suggestions для исправления
- **WCAG 3.2.5 Change on Request** (AAA) — изменения по запросу пользователя
