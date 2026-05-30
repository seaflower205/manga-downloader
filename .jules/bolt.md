## 2024-05-30 - Optimize MutationObserver to prevent starvation
**Learning:** Continuous DOM observers like `MutationObserver` in vanilla JS run frequently and can cause callback starvation and block the main thread.
**Action:** Throttle the MutationObserver callback using `requestAnimationFrame` and a boolean flag. This ensures efficient batching of DOM reads without causing starvation during continuous page animations or dynamically loading elements.
