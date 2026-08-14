# PHASE1-004: Отсутствие feedback при real-time обновлениях

**Severity:** Moderate (не влияет на accessibility напрямую, но ухудшает UX)
**Area:** Real-time UX
**Component:** `src/lib/AppContext.tsx`, SSE integration point

## Описание

Система использует Server-Sent Events (SSE) для push-обновлений от AI-агента. Когда задача меняет статус, она мгновенно перемещается в другую колонку без какой-либо визуальной или auditory обратной связи для пользователя.

### Выявленные проблемы

#### 1. Мгновенное перемещение карточки

В текущем прототипе (`AppContext.tsx`):
```tsx
const updateTaskStatus = useCallback((taskId: string, status: Status) => {
  setTasks(prev =>
    prev.map(t => t.id === taskId ? { ...t, status, updatedAt: new Date().toISOString() } : t),
  )
}, [])
```

Карточка исчезает из одной колонки и появляется в другой мгновенно. Это:
- дезориентирует пользователя
- не позволяет заметить изменение
- может быть ошибочно воспринято как баг (карточка «исчезла»)

#### 2. Нет уведомления об изменении

Пользователь не знает:
- Какая задача изменилась
- Что именно произошло (статус, приоритет, назначение)
- Кем было произведено изменение (agent name)

#### 3. Индикатор подключения слабовыражен

В Header.tsx:
```tsx
<div className={`flex items-center gap-1.5 text-xs ${isOnline ? 'text-green-400' : 'text-red-400'}`}>
  <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
  {isOnline ? 'Online' : 'Offline'}
</div>
```

- Точка 2×2px слишком мала для быстрого обнаружения
- Текст "Online"/"Offline" английский — интерфейс на русском
- Нет индикации при потере соединения (auto-reconnect)

### Рекомендации

#### Визуальный feedback

1. **Transition animation при перемещении:**
   ```tsx
   // Использовать Framer Motion или CSS transitions
   // При перемещении: slide animation из старой колонки в новую
   ```

2. **Toast-уведомление при update:**
   ```tsx
   interface Toast {
     id: string
     message: string  // e.g. "Задача авторизации перемещена в Review"
     type: 'info' | 'success' | 'warning'
     duration?: number
   }
   ```
   Позиция: bottom-right (или bottom-left для RTL readiness)

3. **Highlight новой карточки:** Новая созданная карточка подсвечивается (`flash` effect, 2 секунды blue glow)

#### Индикатор подключения

1. Увеличить точку до `w-2.5 h-2.5` минимум
2. Добавить анимацию пульсации при online-состоянии:
   ```css
   @keyframes pulse-online {
     0%, 100% { opacity: 1; }
     50% { opacity: 0.5; }
   }
   ```
3. Локализовать: «Онлайн» / «Оффлайн»
4. Добавить tooltip с временем последнего обновления

#### Конфликты и конфликты данных

Если агент меняет задачу одновременно с действием другого пользователя:
- Показать inline notification в канбан-панели
- Оптимistic update с rollback option

## WCAG Reference

- **WCAG 3.2.1 On Focus** (A) — фокус не вызывает контекстных изменений
- **WCAG 3.3.1 Error Identification** (A) — ошибки/изменения идентифицированы
- **WCAG 3.2.3 Consistent Navigation** (AAA) — навигация последовательна
