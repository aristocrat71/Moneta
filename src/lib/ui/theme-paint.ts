// Resolves the engine's paint colors from the CSS tokens, so no hex value
// lives outside app.css. A hidden probe element scoped to [data-theme] lets
// us read either theme's tokens regardless of the active one.

import type { ThemePaint } from '$lib/ink/engine';

const cache = new Map<string, ThemePaint>();

export function getThemePaint(dark: boolean): ThemePaint {
  const key = dark ? 'dark' : 'light';
  const hit = cache.get(key);
  if (hit) return hit;
  const probe = document.createElement('div');
  probe.dataset.theme = key;
  probe.style.position = 'absolute';
  probe.style.visibility = 'hidden';
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe);
  const read = (name: string) => cs.getPropertyValue(name).trim();
  const paint: ThemePaint = {
    dark,
    canvas: read('--canvas'),
    templateLine: read('--template-line'),
    accent: read('--accent'),
  };
  probe.remove();
  cache.set(key, paint);
  return paint;
}
