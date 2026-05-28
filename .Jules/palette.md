## 2024-10-24 - Custom icon-only UI button accessibility
**Learning:** Custom vanilla JS UI elements (like dynamic icon-only buttons for pin, delete, open in `makeIconButton`) require explicit ARIA attributes since there is no underlying framework managing them.
**Action:** Always verify dynamically generated DOM buttons without text content receive `btn.setAttribute('aria-label', ...)` alongside their `title` attribute.
