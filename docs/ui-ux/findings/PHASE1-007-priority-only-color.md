# PHASE1-007: Индикатор приоритета — только цвет

**Severity:** Serious (нарушает WCAG 1.4.1)
**Area:** TaskCard / Accessibility
**Component:** `src/components/TaskCard.tsx`, `src/lib/mockData.ts`

## Описание

Индикатор приоритета в карточке задачи передаётся исключительно через цвет фона бейджа и точку. Пользователи с дальтонизмом или аномалиями цветоощущения не смогут различить высокий, средний и низкий приоритеты.

### Выявленные проблемы

#### 1. Badge основан только на цвете

```tsx
const pc = priorityColors[task.priority]
<span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${pc.bg} ${pc.text}`}>
  <span className={`w-1.5 h-1.5 rounded-full ${pc.dot}`} />
  {task.priority === 'high' ? 'High' : task.priority === 'medium' ? 'Medium' : 'Low'}
</span>
```

Содержит текстовый label ✅ («High»/«Medium»/«Low»), но:
- Текстовый label зависит от `task.priority` enum, который сам кодируется цветом
- При плохом зрении текст на красном/жёлтом фоне может быть неразличим

#### 2. Точка-индикатор — только цвет

```tsx
<span className={`w-1.5 h-1.5 rounded-full ${pc.dot}`} />
```

Это decorative dot наряду с текстовым label — не добавляет ценности и даже ухудшает contrast если точка тёмная на тёмном фоне.

#### 3. PriorityColors в mockData

```tsx
export const priorityColors: Record<string, { bg: string; text: string; dot: string }> = {
  high: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', dot: 'bg-red-500' },
  medium: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400', dot: 'bg-yellow-500' },
  low: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', dot: 'bg-green-500' },
}
```

Жёлтый на белом/светлом фоне: `text-yellow-700` — контраст ~3.5:1 (FAIL AA для normal text).

#### 4. Column headers — цветные точки

```tsx
{ id: 'in_work', title: 'In Work', color: 'bg-blue-500' },
{ id: 'review', title: 'Review', color: 'bg-yellow-500' },
{ id: 'done', title: 'Done', color: 'bg-green-500' },
```

Цвет точек + текстовый label — здесь OK так как label текстовый. Но point-цвет дублирует info из text.

### Рекомендации

1. **Сохранить текстовый label** (уже есть ✅), но усилить его:
   ```tsx
   <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ...`}>
     {/* Цветовой индикатор — декоративный */}
     <span className={`w-1.5 h-1.5 rounded-full ${pc.dot}`} aria-hidden="true" />
     {label}
   </span>
   ```

2. **Добавить icon/text паттерн:**
   ```tsx
   const priorityMap = {
     high: { icon: '⚠', label: 'Высокий', colors: { ... }},
     medium: { icon: '●', label: 'Средний', colors: { ... }},
     low: { icon: '○', label: 'Низкий', colors: { ... }},
   }
   ```

3. **Yellow contrast fix:** Заменить `text-yellow-700` → `text-amber-700` (контраст ~5.7:1):
   ```tsx
   medium: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500' },
   ```

4. **Screen reader only text:** Для полной однозначности:
   ```tsx
   <span aria-label={`Приоритет: ${task.priority === 'high' ? 'высокий' : task.priority === 'medium' ? 'средний' : 'низкий'}`}>
   ```

5. **Color-blind friendly palette consideration:** Для production — рассмотреть палитру, которая работает при всех типах дальтонизма (проверить через https://www.color-blindness.com/coblis-color-blindness-simulator/)

### Проверка для column statuses

Status column uses color + text. Here is acceptable because:
- Text label is descriptive ("In Work", "Review", "Done")
- Color point is auxiliary decoration (`aria-hidden="true"`)
- Users can always read the text

## WCAG Reference

- **WCAG 1.4.1 Use of Color** (A) — цвет не является единственным средством передачи информации
- **WCAG 1.4.3 Contrast (Minimum)** (AA) — yellow text requires ≥4.5:1
