// What the running bundle says about itself. Read from Tauri, not package.json,
// so the version is the one actually installed.

import { getVersion } from '@tauri-apps/api/app';

class AppInfo {
  readonly name = 'Moneta';
  readonly description = 'Minimalist handwriting notes for drawing tablets';
  version = $state('');

  async load(): Promise<void> {
    try {
      this.version = await getVersion();
    } catch {
      // Browser preview, or the permission is missing — the sheet just omits it.
      this.version = '';
    }
  }
}

export const appInfo = new AppInfo();
