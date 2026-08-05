<script lang="ts">
  import { goto } from '$app/navigation';
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { ArrowLeft, Maximize2, Minimize2 } from '@lucide/svelte';
  import { session } from '$lib/store/session.svelte';
  import { beginWindowDrag } from '$lib/ui/window-drag';
  import BackgroundPicker from './BackgroundPicker.svelte';
  import type { TemplateKind } from '$lib/ink/engine';

  let {
    hidden,
    dimmed = false,
    background,
    onBackground,
    glass,
    glassOpacity,
    onGlass,
    onGlassOpacity,
    onPassThrough,
  }: {
    hidden: boolean;
    /** Click-through is on: the bar stays put but nothing in it responds. */
    dimmed?: boolean;
    background: TemplateKind;
    onBackground: (t: TemplateKind) => void;
    glass: boolean;
    glassOpacity: number;
    onGlass: (on: boolean) => void;
    onGlassOpacity: (v: number) => void;
    onPassThrough: () => void;
  } = $props();

  let renaming = $state(false);
  let draft = $state('');
  let input = $state<HTMLInputElement | null>(null);
  /** Zoom, not macOS full screen: the window fills the screen but stays a
   *  window — same Space, menu bar and traffic lights still there. */
  let maximized = $state(false);

  $effect(() => {
    if (renaming) input?.select();
  });

  $effect(refreshMaximized);

  async function toggleMaximize() {
    const win = getCurrentWindow();
    await win.toggleMaximize();
    maximized = await win.isMaximized();
  }

  /** The green button and a double-click on the bar change this too. */
  function refreshMaximized() {
    void getCurrentWindow()
      .isMaximized()
      .then((v) => (maximized = v));
  }

  function commitRename() {
    renaming = false;
    if (draft.trim()) session.rename(draft);
  }
</script>

<svelte:window onresize={refreshMaximized} />

<header
  class="bar"
  class:hidden
  class:dimmed
  class:glass
  role="presentation"
  onmousedown={beginWindowDrag}
>
  <button class="back" onclick={() => void goto('/')}>
    <ArrowLeft size={16} strokeWidth={1.5} />
    <span>Library</span>
  </button>

  <div class="center">
    {#if renaming}
      <input
        bind:this={input}
        bind:value={draft}
        class="rename"
        onkeydown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') commitRename();
          if (e.key === 'Escape') renaming = false;
        }}
        onblur={commitRename}
      />
    {:else}
      <button
        class="title"
        title="Rename notebook"
        onclick={() => {
          draft = session.title;
          renaming = true;
        }}
      >
        {session.title}
      </button>
    {/if}
  </div>

  <div class="right">
    <button
      class="fs"
      title={maximized ? 'Restore size' : 'Fill screen'}
      aria-label={maximized ? 'Restore size' : 'Fill screen'}
      onclick={toggleMaximize}
    >
      {#if maximized}
        <Minimize2 size={16} strokeWidth={1.5} />
      {:else}
        <Maximize2 size={16} strokeWidth={1.5} />
      {/if}
    </button>
    <BackgroundPicker
      template={background}
      onpick={onBackground}
      {glass}
      {glassOpacity}
      passThrough={dimmed}
      onglass={onGlass}
      onopacity={onGlassOpacity}
      onpassthrough={onPassThrough}
    />
  </div>
</header>

<style>
  .bar {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    z-index: 20;
    display: flex;
    align-items: center;
    height: 40px;
    padding: 0 12px 0 84px;
    transition: opacity 200ms ease-out;
  }
  .bar.hidden {
    opacity: 0;
    pointer-events: none;
  }
  /* Click-through: still there so you can read the state, but plainly inert. */
  .bar.dimmed {
    opacity: 0.5;
  }
  /* Over glass the page gives the chrome nothing to sit on, so the bar brings
     its own — enough to read the controls, not enough to hide the source. */
  .bar.glass {
    background: color-mix(in srgb, var(--bg) 90%, transparent);
  }
  .back {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 8px;
    border-radius: 6px;
    font-size: 13px;
    color: var(--text-muted);
  }
  .back:hover {
    background: var(--surface-2);
    color: var(--text);
  }
  .center {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 2px;
    max-width: 40%;
  }
  .title {
    padding: 4px 6px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 550;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .title:hover {
    background: var(--surface-2);
  }
  .rename {
    width: 220px;
    padding: 3px 8px;
    font-size: 13px;
    font-weight: 550;
    text-align: center;
    background: var(--surface);
    border: 1px solid var(--accent);
    border-radius: 6px;
  }
  .rename:focus {
    outline: none;
  }
  .right {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 2px;
  }
  .fs {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border-radius: 6px;
    color: var(--text-muted);
  }
  .fs:hover {
    background: var(--surface-2);
    color: var(--text);
  }
</style>
