# PHASE1-005: Боковое меню — отсутствие фокус-рингов для клавиатуры

**Severity:** Serious (блокирует доступность клавиатурной навигации)
**Area:** Sidebar / Accessibility
**Component:** `src/components/Sidebar.tsx`

## Описание

Весь интерактивный контент sidebar не имеет видимых индикаторов фокуса. При навигации с клавиатуры (Tab) невозможно определить текущий активный элемент.

### Выявленные проблемы

#### 1. Кнопки проектов без focus-visible

```tsx
<button
  onClick={() => setCurrentProjectId(project.id)}
  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
    project.id === currentProjectId
      ? theme === 'dark' ? 'bg-blue-600/20 text-blue-400 border border-blue-600/30'
        : 'bg-blue-50 text-blue-700 border border-blue-200'
      : theme === 'dark' ? 'text-gray-300 hover:bg-gray-800 border border-transparent'
        : 'text-gray-600 hover:bg-gray-100 border border-transparent'
  }`}
>
```

Активное состояние определено через `border`, но нет `focus-visible:` стиля. Пользователь клавиатуры не увидит разницы между «проехал» и «остановился».

#### 2. Кнопка создания проекта

```tsx
<button
  onClick={() => openModal('project')}
  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
    theme === 'dark' ? 'text-gray-300 hover:bg-gray-800 border border-dashed border-gray-600'
      : 'text-gray-600 hover:bg-gray-100 border border-dashed border-gray-300'
  }`}
>
```

Нет `focus-visible:ring` — кнопка с пунктирной границей требует усиленного визуального индикатора фокуса.

#### 3. Theme toggle switch

Тоггл темы — кастомный UI элемент (div-based toggle). Нет фокус-ринга:
```tsx
<button onClick={toggleTheme} className={`...`}>
```

Кроме того, кастомный toggle switch не имеет:
- `role="switch"` + `aria-checked`
- Клавиатурного управления (Space/Enter)
- Состояния checked

#### 4. Tab order

Sidebar использует `<aside>` tag, что правильно. Но:
- В проекте 5+ элементов навигации
- Нет `tabindex="-1"` на decorative элементах
- Нет logical order в DOM — кнопки идут подряд ✅ (это хорошо)

### Рекомендации

1. **Unified focus ring design token:**
   ```css
   /* globals.css */
   .focus-visible { outline: 2px solid var(--color-blue-500); outline-offset: 2px; border-radius: inherit; }
   
   /* Или Tailwind v4 syntax: */
   @layer base {
     *:focus-visible {
       outline: 2px solid var(--color-blue-500);
       outline-offset: 2px;
       border-radius: var(--radius);
     }
   }
   ```

2. **Sidebar buttons — добавить focus-visible:**
   ```tsx
   // К проектам
   className={`... focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${...}}
   ```

3. **Theme toggle — переделать в accessible switch:**
   ```tsx
   <button
     role="switch"
     aria-checked={theme === 'light'}
     aria-label={theme === 'dark' ? 'Переключить на светлую тему' : 'Переключить на тёмную тему'}
     onClick={toggleTheme}
     className={`...`}
   >
   ```

4. **Focus ring offset:** Добавить `focus-visible:ring-offset-2` с учётом bg color чтобы кольцо было видно

5. **Global CSS rule:**
   ```css
   /* Удалить cursor-default из карточек или заменить на cursor-pointer если кликабельны в будущем */
   /* Добавить global focus styles */
   @starting-style { :focus-visible { outline-offset: 2px; } }
   ```

## WCAG Reference

- **WCAG 2.4.7 Focus Visible** (AA) — пользователь должен видеть где находится фокус
- **WCAG 4.1.2 Name, Role, Value** (A) — custom switch требует role и aria-checked
