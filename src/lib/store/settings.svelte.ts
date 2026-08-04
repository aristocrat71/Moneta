import { ipc } from '$lib/ipc';
import type { TemplateKind, ToolKind } from '$lib/ink/engine';

export interface IslandPos {
  x: number;
  y: number;
}

export interface SettingsData {
  theme: 'system' | 'light' | 'dark';
  island: IslandPos | null;
  tool: ToolKind;
  penColor: string;
  penWidth: number;
  hlColor: string;
  hlWidth: number;
  eraserRadius: number;
  lastTemplate: TemplateKind;
  pressureGamma: number;
  recentColors: string[];
}

const DEFAULTS: SettingsData = {
  theme: 'system',
  island: null,
  tool: 'pen',
  penColor: 'ink/black',
  penWidth: 3,
  hlColor: 'ink/amber',
  hlWidth: 16,
  eraserRadius: 14,
  lastTemplate: 'ruled',
  pressureGamma: 1,
  recentColors: [],
};

class SettingsStore {
  data = $state<SettingsData>({ ...DEFAULTS });
  loaded = $state(false);
  private timer: ReturnType<typeof setTimeout> | null = null;

  async load(): Promise<void> {
    if (this.loaded) return;
    try {
      const text = await ipc.readSettings();
      if (text) {
        const parsed = JSON.parse(text) as Partial<SettingsData>;
        Object.assign(this.data, { ...DEFAULTS, ...parsed });
      }
    } catch {
      // Missing or corrupt settings fall back to defaults — never fatal.
    }
    this.loaded = true;
  }

  save(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      ipc.writeSettings(JSON.stringify(this.data)).catch(() => {});
    }, 400);
  }
}

export const settings = new SettingsStore();
