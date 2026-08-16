// Pointer-side pickers close on Escape or an outside press, swallowed before the
// canvas can turn it into a dot.

import type { Action } from 'svelte/action';

export const dismissOutside: Action<HTMLElement, () => void> = (node, onclose) => {
  const onDown = (e: PointerEvent) => {
    if (node.contains(e.target as Node)) return;
    e.preventDefault();
    e.stopPropagation();
    // preventDefault suppresses the blur a typed hex commits on.
    const focused = document.activeElement;
    if (focused instanceof HTMLElement && node.contains(focused)) focused.blur();
    onclose();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onclose();
    }
  };
  window.addEventListener('pointerdown', onDown, true);
  window.addEventListener('keydown', onKey, true);
  return {
    destroy() {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey, true);
    },
  };
};
