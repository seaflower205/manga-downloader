## 2024-05-18 - Popup Tabs and Search Accessibility
**Learning:** Found that custom tab implementations often miss proper ARIA roles (`tablist`, `tab`, `aria-selected`, `aria-controls`) out of the box, breaking screen reader navigation. Search inputs with only placeholders also lacked explicit labels.
**Action:** Always verify custom tab components implement the full WAI-ARIA tab pattern, and ensure icon-only inputs or placeholder-only inputs have `aria-label` attributes.
