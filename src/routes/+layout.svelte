<script lang="ts">
  import '@fontsource-variable/jetbrains-mono';
  import '../app.css';
  import { onMount } from 'svelte';
  import { settings } from '$lib/store/settings.svelte';
  import { theme } from '$lib/store/theme.svelte';
  import { library } from '$lib/store/library.svelte';
  import { session } from '$lib/store/session.svelte';
  import { ui } from '$lib/store/ui.svelte';
  import { appInfo } from '$lib/store/app.svelte';
  import { updater } from '$lib/store/updater.svelte';
  import Toasts from '$lib/ui/Toasts.svelte';
  import SettingsSheet from '$lib/ui/SettingsSheet.svelte';
  import AboutSheet from '$lib/ui/AboutSheet.svelte';

  let { children } = $props();
  let ready = $state(false);

  onMount(async () => {
    theme.init();
    await settings.load();
    ready = true;
    void library.init();
    void appInfo.load();
    // Behind the library scan — a network round trip should never delay paint.
    setTimeout(() => void updater.run(), 3000);
  });

  $effect(() => {
    if (ready) document.documentElement.dataset.theme = theme.resolved;
  });

  // ⌘/ belongs to ShortcutsSheet, which each screen mounts itself. Settings is
  // handled here because the sheet it opens is mounted here too.
  function onKeydown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === ',') {
      e.preventDefault();
      ui.settingsOpen = !ui.settingsOpen;
    }
  }

  // Autosave flush on blur/close — silence means saved.
  function flush() {
    void session.flush();
  }
</script>

<svelte:window
  onkeydown={onKeydown}
  onblur={flush}
  onbeforeunload={flush}
  onvisibilitychange={() => {
    if (document.visibilityState === 'hidden') flush();
  }}
/>

{#if ready}
  {@render children?.()}
{/if}

<Toasts />
<SettingsSheet />
<AboutSheet />
