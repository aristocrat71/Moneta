// What the running bundle says about itself. Read from Tauri rather than
// package.json so the About sheet reports the version actually installed —
// which, after an update stages and relaunches, is the only honest source.

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
