// Auto-update against GitHub Releases: check, stage in the background, offer a
// restart. The launch check stays quiet when it finds nothing; a download that
// starts and then fails always speaks, whoever asked for it.

import { relaunch } from '@tauri-apps/plugin-process';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { session } from './session.svelte';
import { toasts } from './toast.svelte';

export type UpdateStatus =
  'idle' | 'checking' | 'downloading' | 'ready' | 'current' | 'unreachable' | 'failed';

class UpdaterStore {
  status = $state<UpdateStatus>('idle');
  /** The version being downloaded or staged — null unless one was found. */
  version = $state<string | null>(null);
  /** 0–1 while downloading; -1 when the server sent no content length. */
  progress = $state(0);
  error = $state<string | null>(null);

  get busy(): boolean {
    return this.status === 'checking' || this.status === 'downloading';
  }

  /** `manual` = a person pressed a button, so silence is not an answer. */
  async run(manual = false): Promise<void> {
    if (this.busy) return;
    // Already staged: the restart offer is the only thing left to give.
    if (this.status === 'ready' && this.version) {
      if (manual) this.offerRestart(this.version);
      return;
    }

    this.error = null;
    this.status = 'checking';
    let update: Update | null;
    try {
      update = await check();
    } catch (e) {
      // Offline, no release yet, or a dev build with no bundle to replace.
      this.status = 'unreachable';
      this.error = String(e);
      console.warn('[updater] check failed:', e);
      if (manual) toasts.show(`Couldn't check for updates · ${e}`);
      return;
    }

    if (!update) {
      this.status = 'current';
      if (manual) toasts.show("You're on the latest version");
      return;
    }

    this.version = update.version;
    this.status = 'downloading';
    this.progress = 0;
    const toastId = toasts.show(`Downloading Moneta ${update.version}…`, { sticky: true });

    let total = 0;
    let got = 0;
    try {
      await update.downloadAndInstall((e) => {
        if (e.event === 'Started') {
          total = e.data.contentLength ?? 0;
          this.progress = total > 0 ? 0 : -1;
        } else if (e.event === 'Progress') {
          got += e.data.chunkLength;
          if (total > 0) {
            this.progress = Math.min(1, got / total);
            toasts.update(
              toastId,
              `Downloading Moneta ${this.version} · ${Math.round(this.progress * 100)}%`,
            );
          }
        } else if (e.event === 'Finished') {
          this.progress = 1;
          toasts.update(toastId, `Installing Moneta ${this.version}…`);
        }
      });
    } catch (e) {
      // Never silent: this is the state that reads as "auto-update doesn't work".
      this.status = 'failed';
      this.error = String(e);
      console.error('[updater] download/install failed:', e);
      toasts.dismiss(toastId);
      toasts.show(`Couldn't install Moneta ${update.version} · ${e}`, { sticky: true });
      return;
    }

    this.status = 'ready';
    this.progress = 1;
    toasts.dismiss(toastId);
    this.offerRestart(update.version);
  }

  private offerRestart(version: string): void {
    toasts.show(`Moneta ${version} is ready to install`, {
      sticky: true,
      action: { label: 'Restart', run: () => void this.restart() },
    });
  }

  /** Never trade unsaved ink for an update — a failed flush has its own toast,
   *  and the update is staged either way. */
  async restart(): Promise<void> {
    await session.flush();
    if (session.saveFailed) return;
    await relaunch();
  }
}

export const updater = new UpdaterStore();
