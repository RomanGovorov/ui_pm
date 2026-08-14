# PHASE1-006: Модальные окна — управление фокусом

**Severity:** Critical (блокирует доступность модальных форм)
**Area:** Modals / Accessibility
**Components:** `CreateTaskModal.tsx`, `CreateProjectModal.tsx`

## Описание

Модальные окна создаются как простые `div` overlays без каких-либо механизмов управления фокусом. Это критически нарушает accessibility — пользователи скринридеров и клавиатуры не могут корректно взаимодействовать с формами.

### Выявленные проблемы

#### 1. Отсутствие dialog semantics

Обе модалки используют plain `div`:
```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center">
  <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeModal} />
  <div className="relative w-full max-w-lg rounded-xl ...">
```

Не хватает:
| Атрибут | Значение | Статус |
|---------|----------|--------|
| `role` | `"dialog"` | ❌ |
| `aria-modal` | `"true"` | ❌ |
| `aria-labelledby` | ref к h2 заголовку | ❌ |

Backdrop также не имеет `role="none"` или `aria-hidden="true"` — может быть обработан скринридером как интерактивный элемент.

#### 2. Focus trap отсутствует

При открытии модалки:
- Фокус остаётся на элементе, вызвавшем открытие
- Нет механизма захвата фокуса внутри модалки
- Tab выходит из модалки в основной контент
- Shift+Tab не зациклен

#### 3. Автофокус на первом поле

CreateTaskModal имеет `autoFocus` на title input ✅:
```tsx
<input type="text" autoFocus required />
```

Но CreateProjectModal тоже имеет `autoFocus` ✅. Однако при отсутствии focus trap это бесполезно — tab уходит сразу после первого поля.

#### 4. Escape key закрывает модалку

Обе модалки закрываются по клику на backdrop, но нет обработки ESC. Это противоречит user expectation — ESC должен всегда закрывать модалку.

#### 5. Backdrop не интерактивен для клавиатуры

Backdrop (`onClick={closeModal}`) — это div. Его нельзя открыть фокусом, но он перехватывает клик. Это создает проблему: если пользователь случайно нажмёт клик вне модалки, форма будет потеряна.

#### 6. Блокировка scroll основного контента

При открытой модалке нет блокировки scroll body:
```tsx
// Missing: document.body.style.overflow = 'hidden'
```

#### 7. Закрытие модалки — потеря формы

Пользователь заполнил форму наполовину → нажал на backdrop → все данные потеряны. Нет предупреждения о несохранённых изменениях.

### Рекомендации

#### Минимум для Phase 2

1. **Dialog semantics:**
   ```tsx
   <div role="dialog" aria-modal="true" aria-labelledby={`${modalId}-title`} className="fixed inset-0 z-50 flex items-center justify-center">
     <div role="presentation" className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeModal} />
     <div className="relative w-full max-w-lg ..." id={`${modalId}-dialog`}>
       <h2 id={`${modalId}-title`}>{title}</h2>
     </div>
   </div>
   ```

2. **Focus trap hook:**
   ```tsx
   function useFocusTrap(containerRef: RefObject<HTMLElement>) {
     useEffect(() => {
       const el = containerRef.current
       if (!el) return
     
       const firstFocusable = el.querySelector(':focusable') as HTMLElement
       firstFocusable?.focus()
     
       const handler = (e: KeyboardEvent) => {
         if (e.key !== 'Tab') return
         
         const focusableEls = getFocusableElements(el)
         const firstEl = focusableEls[0]
         const lastEl = focusableEls[focusableEls.length - 1]
       
         if (e.shiftKey) {
           if (document.activeElement === firstEl) { e.preventDefault(); lastEl.focus() }
         } else {
           if (document.activeElement === lastEl) { e.preventDefault(); firstEl.focus() }
         }
       }
     
       document.addEventListener('keydown', handler)
       return () => document.removeEventListener('keydown', handler)
     }, [])
   }
   ```

3. **ESC handler:**
   ```tsx
   useEffect(() => {
     const handler = (e: KeyboardEvent) => {
       if (e.key === 'Escape') closeModal()
     }
     document.addEventListener('keydown', handler)
     return () => document.removeEventListener('keydown', handler)
   }, [closeModal])
   ```

4. **Scroll lock:**
   ```tsx
   useEffect(() => {
     document.body.style.overflow = 'hidden'
     return () => { document.body.style.overflow = '' }
   }, [isOpen])
   ```

5. **Unsaved changes warning:** Для более сложных форм — проверка есть ли заполненные обязательные поля перед закрытием.

6. **Prevent backdrop close on form interaction:** Разрешить закрытие только по кнопке «Отмена», backdrop click, или ESC. Не по случайному клику.

## WCAG Reference

- **WCAG 2.4.3 Focus Order** (A) — модалка должна иметь логичный порядок
- **WCAG 2.1.1 Keyboard** (A) — все функции доступны с клавиатуры
- **WCAG 2.4.1 Block Skips** (A) — модалка не должна прерывать flow
- **WCAG 4.1.2 Name, Role, Value** (A) — dialog must have name and role
