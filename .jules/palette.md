## 2024-05-18 - Accessibility Improvements

**Learning:** When evaluating ARIA support for a component built without native elements, it is important to check whether the component is fully accessible with the keyboard or if any extra properties might be required.
**Action:** Always check the element type when considering ARIA attributes, e.g., using `role` on non-interactive elements, or avoiding unnecessary `aria-labels` on textual content.
