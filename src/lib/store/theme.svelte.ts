import { settings } from './settings.svelte';

class ThemeStore {
  private system = $state<'light' | 'dark'>('light');
  private initialized = false;

  init(): void {
    if (this.initialized) return;
    this.initialized = true;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    this.system = mq.matches ? 'dark' : 'light';
    mq.addEventListener('change', (e) => {
      this.system = e.matches ? 'dark' : 'light';
    });
  }

  get resolved(): 'light' | 'dark' {
    const pref = settings.data.theme;
    return pref === 'system' ? this.system : pref;
  }

  get dark(): boolean {
    return this.resolved === 'dark';
  }

  /** 150ms crossfade — nothing moves, only material changes. */
  private crossfade(): void {
    const root = document.documentElement;
    root.classList.add('theme-xfade');
    setTimeout(() => root.classList.remove('theme-xfade'), 200);
  }

  setPref(pref: 'system' | 'light' | 'dark'): void {
    if (settings.data.theme === pref) return;
    this.crossfade();
    settings.data.theme = pref;
    settings.save();
  }

  toggle(): void {
    this.setPref(this.resolved === 'light' ? 'dark' : 'light');
  }
}

export const theme = new ThemeStore();
