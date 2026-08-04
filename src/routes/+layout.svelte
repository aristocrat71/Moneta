<script lang="ts">
  import '@fontsource-variable/jetbrains-mono';
  import '../app.css';
  import { onMount } from 'svelte';
  import { settings } from '$lib/store/settings.svelte';
  import { theme } from '$lib/store/theme.svelte';
  import { library } from '$lib/store/library.svelte';
  import { session } from '$lib/store/session.svelte';
  import { ui } from '$lib/store/ui.svelte';
  import { checkForUpdate } from '$lib/update';
  import Toasts from '$lib/ui/Toasts.svelte';
  import SettingsSheet from '$lib/ui/SettingsSheet.svelte';

  let { children } = $props();
  let ready = $state(false);

  onMount(async () => {
    theme.init();
    await settings.load();
    ready = true;
    void library.init();
    // Behind the library scan — a network round trip should never delay paint.
    setTimeout(() => void checkForUpdate(), 3000);
  });

  $effect(() => {
    if (ready) document.documentElement.dataset.theme = theme.resolved;
  });

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
