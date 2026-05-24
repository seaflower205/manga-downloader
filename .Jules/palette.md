## 2024-05-24 - Add ARIA Labels to Icon-Only Buttons
**Learning:** The `title` attribute alone is sometimes insufficient for screen readers on icon-only buttons. Explicitly adding `aria-label` ensures maximum accessibility and usability for screen reader users.
**Action:** Update the `makeIconButton` utility to automatically assign `aria-label` using the provided title, ensuring all dynamically generated icon buttons are consistently accessible.
