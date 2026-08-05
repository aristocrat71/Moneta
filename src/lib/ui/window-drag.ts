// Explicit window-drag for the chromeless bars: `data-tauri-drag-region` proved
// unreliable in WKWebView, so the bars call startDragging directly.

import { getCurrentWindow } from '@tauri-apps/api/window';

export function beginWindowDrag(e: MouseEvent): void {
  if (e.button !== 0) return;
  if (e.target !== e.currentTarget) return;
  const win = getCurrentWindow();
  if (e.detail === 2) {
    void win.toggleMaximize();
  } else {
    void win.startDragging();
  }
}
