// The recent-ink strip: one list, one cap, wherever a custom colour is picked from.

import { settings } from '$lib/store/settings.svelte';

const KEEP = 6;

/** Newest first; picking one again moves it back to the front. */
export function rememberColor(color: string): void {
  const recents = settings.data.recentColors.filter((c) => c !== color);
  recents.unshift(color);
  settings.data.recentColors = recents.slice(0, KEEP);
  settings.save();
}

export function forgetColor(color: string): void {
  settings.data.recentColors = settings.data.recentColors.filter((c) => c !== color);
  settings.save();
}
