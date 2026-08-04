// Auto-update against GitHub Releases. Checks once at launch, downloads and
// stages the new build in the background, then offers a restart — an
// unannounced relaunch in the middle of a page would be worse than waiting.
// If the restart is declined, the staged build is what launches next time.

import { relaunch } from '@tauri-apps/plugin-process';
import { check } from '@tauri-apps/plugin-updater';
import { session } from './store/session.svelte';
import { toasts } from './store/toast.svelte';

export async function checkForUpdate(): Promise<void> {
  let update;
  try {
    update = await check();
    if (!update) return;
    await update.downloadAndInstall();
  } catch {
    // Offline, no release yet, or a dev build with no signing key configured.
    // None of that is the user's problem — stay quiet and try again next launch.
    return;
  }

  toasts.show(`Moneta ${update.version} is ready to install`, {
    sticky: true,
    action: {
      label: 'Restart',
      run: () => {
        void (async () => {
          // Never trade unsaved ink for an update. A failed flush has already
          // put its own "Couldn't save · …" toast on screen with a Retry, so
          // stay open and let that win — the update is staged either way.
          await session.flush();
          if (session.saveFailed) return;
          await relaunch();
        })();
      },
    },
  });
}
