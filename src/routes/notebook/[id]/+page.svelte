<script lang="ts">
  // The canvas screen. Job: disappear (DESIGN.md §4).
  import { onMount, tick } from 'svelte';
  import { goto } from '$app/navigation';
  import { page as route } from '$app/state';
  import {
    InkEngine,
    INKS,
    MAX_BACKING,
    cachedStrokeBounds,
    rectUnion,
    type Mat,
    type PageWindow,
    type Rect,
    type StrokeData,
    type TemplateKind,
  } from '$lib/ink/engine';
  import {
    cmdAddPage,
    cmdAddStroke,
    cmdAddStrokes,
    cmdDeletePage,
    cmdEraseStrokes,
    cmdRecolorStrokes,
    cmdReorderPages,
    cmdSplitStrokes,
    cmdTransformStrokes,
    transformPoints,
  } from '$lib/doc/commands';
  import { newPage, type DocPage } from '$lib/doc/model';
  import { session } from '$lib/store/session.svelte';
  import { settings } from '$lib/store/settings.svelte';
  import { theme } from '$lib/store/theme.svelte';
  import { toasts } from '$lib/store/toast.svelte';
  import { getThemePaint } from '$lib/ui/theme-paint';
  import CanvasTopBar from '$lib/ui/canvas/CanvasTopBar.svelte';
  import ToolIsland from '$lib/ui/canvas/ToolIsland.svelte';
  import PageSheet from '$lib/ui/canvas/PageSheet.svelte';
  import PageOverview from '$lib/ui/canvas/PageOverview.svelte';
  import SelectionOverlay from '$lib/ui/canvas/SelectionOverlay.svelte';
  import DevHud from '$lib/ui/canvas/DevHud.svelte';
  import { HL_PRESETS, PEN_PRESETS, type ToolState } from '$lib/ui/canvas/tool-state';

  const GUTTER = 24;
  const PAD_TOP = 56;
  const PAD_BOTTOM = 140;
  const GHOST_H = 180;

  let scroller = $state<HTMLDivElement | null>(null);
  let wetCanvas = $state<HTMLCanvasElement | null>(null);
  let ready = $state(false);
  let zoom = $state(1);
  let dpr = 1;
  let scrollTick = $state(0);
  let visFrom = $state(0);
  let visTo = $state(0);
  let overviewOpen = $state(false);
  let barHidden = $state(false);
  let spaceDown = $state(false);
  let panning = $state(false);
  let zoomFlash = $state<string | null>(null);
  let ghostMenu = $state(false);
  let selection = $state<{ pageId: string; ids: string[]; bounds: Rect } | null>(null);

  const devMode = $derived(route.url.searchParams.has('dev'));
  const notebookId = route.params.id ?? '';

  const tools = $state<ToolState>({
    tool:
      settings.data.tool === 'eraser' || settings.data.tool === 'lasso'
        ? settings.data.tool
        : settings.data.tool === 'highlighter'
          ? 'highlighter'
          : 'pen',
    penColor: settings.data.penColor,
    penWidth: settings.data.penWidth,
    hlColor: settings.data.hlColor,
    hlWidth: settings.data.hlWidth,
  });

  // ————— engine —————

  let hidingSelection = false;

  const engine = new InkEngine({
    onCommitStroke(pageId, stroke) {
      session.apply(cmdAddStroke(pageId, stroke), false);
    },
    onEraseCommit(pageId, edits) {
      session.apply(cmdSplitStrokes(pageId, edits), false);
    },
    onLassoSelect(pageId, ids) {
      selection = ids.length > 0 ? { pageId, ids, bounds: boundsOf(pageId, ids) } : null;
    },
    onStrokeStart() {
      if (selection) clearSelection();
      if (liftTimer) clearTimeout(liftTimer);
      penTimer = setTimeout(() => (barHidden = true), 200);
    },
    onStrokeEnd() {
      if (penTimer) clearTimeout(penTimer);
      liftTimer = setTimeout(() => (barHidden = false), 1000);
    },
  });

  let penTimer: ReturnType<typeof setTimeout> | null = null;
  let liftTimer: ReturnType<typeof setTimeout> | null = null;

  $effect(() => {
    engine.tool = tools.tool;
    settings.data.tool = tools.tool;
    settings.save();
  });
  $effect(() => {
    engine.pen = { color: tools.penColor, width: tools.penWidth };
    settings.data.penColor = tools.penColor;
    settings.data.penWidth = tools.penWidth;
    settings.save();
  });
  $effect(() => {
    engine.highlighter = { color: tools.hlColor, width: tools.hlWidth };
    settings.data.hlColor = tools.hlColor;
    settings.data.hlWidth = tools.hlWidth;
    settings.save();
  });
  $effect(() => {
    engine.setPaint(getThemePaint(theme.dark));
  });
  $effect(() => {
    engine.setTuning({ pressureGamma: settings.data.pressureGamma });
  });

  session.onPagesChanged = (pageIds) => {
    for (const id of pageIds) engine.repaintPage(id);
    refreshSelection();
  };

  // ————— geometry —————

  const pageW = $derived(session.doc?.pages[0]?.size.w ?? 1240);
  const pageH = $derived(session.doc?.pages[0]?.size.h ?? 1754);
  const pageCount = $derived(session.pageCount);
  const rowH = $derived(pageH * zoom + GUTTER);
  const contentH = $derived(PAD_TOP + pageCount * rowH + GHOST_H + PAD_BOTTOM);
  const contentMinW = $derived(pageW * zoom + 64);

  function pageOffset(i: number): number {
    return PAD_TOP + i * rowH;
  }

  function pageLeftIn(contentW: number): number {
    return (Math.max(contentW, contentMinW) - pageW * zoom) / 2;
  }

  function windowFor(index: number, p: DocPage): PageWindow {
    const scale = zoom * dpr;
    if (p.size.w * scale <= MAX_BACKING && p.size.h * scale <= MAX_BACKING) {
      return { rect: { x: 0, y: 0, w: p.size.w, h: p.size.h }, scale };
    }
    const s = scroller;
    if (!s) return { rect: { x: 0, y: 0, w: p.size.w, h: p.size.h }, scale };
    const M = 320; // page-unit slack around the viewport
    const left = pageLeftIn(s.clientWidth);
    const top = pageOffset(index);
    let x0 = (s.scrollLeft - left) / zoom - M;
    let y0 = (s.scrollTop - top) / zoom - M;
    let x1 = (s.scrollLeft + s.clientWidth - left) / zoom + M;
    let y1 = (s.scrollTop + s.clientHeight - top) / zoom + M;
    x0 = Math.max(0, x0);
    y0 = Math.max(0, y0);
    x1 = Math.min(p.size.w, x1);
    y1 = Math.min(p.size.h, y1);
    let w = Math.max(1, x1 - x0);
    let h = Math.max(1, y1 - y0);
    // When the margin-padded slice exceeds the backing cap, shrink it but
    // keep it centered on the viewport so the visible region stays covered.
    if (w * scale > MAX_BACKING) {
      w = MAX_BACKING / scale;
      x0 = Math.min(Math.max(0, (x0 + x1) / 2 - w / 2), p.size.w - w);
    }
    if (h * scale > MAX_BACKING) {
      h = MAX_BACKING / scale;
      y0 = Math.min(Math.max(0, (y0 + y1) / 2 - h / 2), p.size.h - h);
    }
    return { rect: { x: x0, y: y0, w, h }, scale };
  }

  function updateVisible(): void {
    const s = scroller;
    if (!s || !session.doc) return;
    const from = Math.max(0, Math.floor((s.scrollTop - PAD_TOP) / rowH) - 1);
    const to = Math.min(
      pageCount - 1,
      Math.ceil((s.scrollTop + s.clientHeight - PAD_TOP) / rowH) + 1,
    );
    visFrom = from;
    visTo = to;
    const centered = Math.round((s.scrollTop + s.clientHeight / 2 - PAD_TOP - rowH / 2) / rowH);
    session.setCurrentPage(Math.max(0, Math.min(pageCount - 1, centered)));
  }

  let scrollRaf = 0;
  function onScroll(): void {
    engine.notifyScrolled();
    if (scrollRaf) return;
    scrollRaf = requestAnimationFrame(() => {
      scrollRaf = 0;
      scrollTick++;
      updateVisible();
      const doc = session.doc;
      if (!doc) return;
      for (let i = visFrom; i <= visTo && i < doc.pages.length; i++) {
        engine.refreshWindow(doc.pages[i].id);
      }
    });
  }

  // ————— zoom & pan —————

  let rasterTimer: ReturnType<typeof setTimeout> | null = null;
  let flashTimer: ReturnType<typeof setTimeout> | null = null;

  function setZoom(z: number, anchor?: { x: number; y: number }): void {
    z = Math.min(4, Math.max(0.25, z));
    const s = scroller;
    if (!s || Math.abs(z - zoom) < 1e-4) return;
    const prev = zoom;
    const ax = anchor?.x ?? s.clientWidth / 2;
    const ay = anchor?.y ?? s.clientHeight / 2;
    const cx = s.scrollLeft + ax;
    const cy = s.scrollTop + ay;
    zoom = z;
    zoomFlash = `${Math.round(z * 100)}%`;
    if (flashTimer) clearTimeout(flashTimer);
    flashTimer = setTimeout(() => (zoomFlash = null), 800);
    void tick().then(() => {
      s.scrollLeft = (cx / prev) * z - ax;
      s.scrollTop = ((cy - PAD_TOP) / prev) * z + PAD_TOP - ay;
      updateVisible();
      engine.notifyScrolled();
      if (rasterTimer) clearTimeout(rasterTimer);
      rasterTimer = setTimeout(() => engine.repaintAll(), 140);
    });
  }

  function fitWidth(): void {
    const s = scroller;
    if (!s) return;
    setZoom((s.clientWidth - 96) / pageW);
  }

  function scrollToPage(i: number, smooth = true): void {
    scroller?.scrollTo({
      top: Math.max(0, pageOffset(i) - 16),
      behavior: smooth ? 'smooth' : 'auto',
    });
  }

  /**
   * Resume where the ink left off: jump to the most recent stroke on the last
   * open page (searching back for the nearest page that has ink), so reopening
   * a long notebook lands on the writing rather than the top of the sheet.
   */
  function scrollToResume(): void {
    const s = scroller;
    const doc = session.doc;
    if (!s || !doc) return;
    const start = Math.min(Math.max(0, session.currentPage), doc.pages.length - 1);
    let target = -1;
    for (let i = start; i >= 0; i--) {
      if (doc.pages[i].strokes.length > 0) {
        target = i;
        break;
      }
    }
    if (target < 0) {
      scrollToPage(start, false);
      return;
    }
    const strokes = doc.pages[target].strokes;
    const last = strokes[strokes.length - 1];
    let maxY = 0;
    for (let i = 1; i < last.points.length; i += 3) {
      if (last.points[i] > maxY) maxY = last.points[i];
    }
    // Put the stroke's lower edge just under the middle of the viewport.
    const top = pageOffset(target) + maxY * zoom - s.clientHeight * 0.55;
    s.scrollTo({
      top: Math.max(0, Math.min(top, s.scrollHeight - s.clientHeight)),
      behavior: 'auto',
    });
  }

  function onWheel(e: WheelEvent): void {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const r = scroller!.getBoundingClientRect();
      setZoom(zoom * Math.exp(-e.deltaY * 0.01), {
        x: e.clientX - r.left,
        y: e.clientY - r.top,
      });
    }
  }

  // Safari/WKWebView trackpad pinch.
  let gestureStartZoom = 1;
  function onGestureStart(e: Event): void {
    e.preventDefault();
    gestureStartZoom = zoom;
  }
  function onGestureChange(e: Event): void {
    e.preventDefault();
    const scale = (e as unknown as { scale?: number }).scale;
    if (typeof scale === 'number') setZoom(gestureStartZoom * scale);
  }

  function onPanPointerDown(e: PointerEvent): void {
    const pan = spaceDown || e.button === 1 || (e.buttons & 2) !== 0;
    if (!pan || !scroller) return;
    e.preventDefault();
    e.stopPropagation();
    panning = true;
    const s = scroller;
    let lastX = e.clientX;
    let lastY = e.clientY;
    s.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      s.scrollLeft -= ev.clientX - lastX;
      s.scrollTop -= ev.clientY - lastY;
      lastX = ev.clientX;
      lastY = ev.clientY;
    };
    const up = () => {
      panning = false;
      s.removeEventListener('pointermove', move);
      s.removeEventListener('pointerup', up);
      s.removeEventListener('pointercancel', up);
    };
    s.addEventListener('pointermove', move);
    s.addEventListener('pointerup', up);
    s.addEventListener('pointercancel', up);
  }

  // ————— selection —————

  function boundsOf(pageId: string, ids: string[]): Rect {
    const strokes = strokesOf(pageId, ids);
    let rect: Rect | null = null;
    for (const s of strokes) {
      const b = cachedStrokeBounds(s);
      rect = rect ? rectUnion(rect, b) : { ...b };
    }
    return rect ?? { x: 0, y: 0, w: 0, h: 0 };
  }

  function strokesOf(pageId: string, ids: string[]): StrokeData[] {
    const page = session.doc?.pages.find((p) => p.id === pageId);
    if (!page) return [];
    const set = new Set(ids);
    return page.strokes.filter((s) => set.has(s.id));
  }

  function clearSelection(): void {
    if (hidingSelection && selection) {
      engine.setHidden(selection.pageId, null);
      hidingSelection = false;
      engine.clearWet();
    }
    selection = null;
  }

  function refreshSelection(): void {
    if (!selection) return;
    const strokes = strokesOf(selection.pageId, selection.ids);
    if (strokes.length === 0) {
      clearSelection();
      return;
    }
    selection = {
      ...selection,
      ids: strokes.map((s) => s.id),
      bounds: boundsOf(selection.pageId, selection.ids),
    };
  }

  function previewTransform(m: Mat | null): void {
    if (!selection) return;
    if (m) {
      if (!hidingSelection) {
        engine.setHidden(selection.pageId, new Set(selection.ids));
        hidingSelection = true;
      }
      engine.drawSelectionPreview(
        selection.pageId,
        strokesOf(selection.pageId, selection.ids),
        m,
      );
    } else {
      engine.setHidden(selection.pageId, null);
      hidingSelection = false;
      engine.clearWet();
    }
  }

  function commitTransform(m: Mat): void {
    if (!selection) return;
    const { pageId, ids } = selection;
    session.apply(cmdTransformStrokes(pageId, ids, m));
    engine.setHidden(pageId, null);
    hidingSelection = false;
    engine.clearWet();
    selection = { pageId, ids, bounds: boundsOf(pageId, ids) };
  }

  function deleteSelection(): void {
    if (!selection) return;
    session.apply(cmdEraseStrokes(selection.pageId, selection.ids, 'Delete selection'));
    selection = null;
  }

  function duplicateSelection(): void {
    if (!selection) return;
    const { pageId } = selection;
    const clones = strokesOf(pageId, selection.ids).map((s) => ({
      ...s,
      id: crypto.randomUUID(),
      points: transformPoints(s.points, { a: 1, b: 0, c: 0, d: 1, e: 24, f: 24 }),
    }));
    session.apply(cmdAddStrokes(pageId, clones, 'Duplicate'));
    selection = {
      pageId,
      ids: clones.map((s) => s.id),
      bounds: boundsOf(
        pageId,
        clones.map((s) => s.id),
      ),
    };
  }

  function recolorSelection(color: string): void {
    if (!selection) return;
    session.apply(cmdRecolorStrokes(selection.pageId, selection.ids, color));
  }

  const selOrigin = $derived.by(() => {
    void scrollTick;
    void zoom;
    if (!selection || !scroller || !session.doc) return null;
    const i = session.doc.pages.findIndex((p) => p.id === selection!.pageId);
    if (i < 0) return null;
    return {
      x: pageLeftIn(scroller.clientWidth) - scroller.scrollLeft,
      y: pageOffset(i) - scroller.scrollTop,
    };
  });

  function toPagePoint(clientX: number, clientY: number): { x: number; y: number } {
    const s = scroller;
    if (!s || !selOrigin) return { x: 0, y: 0 };
    const r = s.getBoundingClientRect();
    return {
      x: (clientX - r.left - selOrigin.x) / zoom,
      y: (clientY - r.top - selOrigin.y) / zoom,
    };
  }

  // ————— pages —————

  function appendPage(template: TemplateKind): void {
    ghostMenu = false;
    settings.data.lastTemplate = template;
    settings.save();
    const count = session.doc?.pages.length ?? 0;
    session.apply(cmdAddPage(count, newPage(template)));
    void tick().then(() => {
      updateVisible();
      scrollToPage(count);
    });
  }

  function deletePage(pageId: string): void {
    if ((session.doc?.pages.length ?? 0) <= 1) return;
    clearSelection();
    session.apply(cmdDeletePage(pageId));
    void tick().then(updateVisible);
  }

  function reorderPages(from: number, to: number): void {
    clearSelection();
    session.apply(cmdReorderPages(from, to));
  }

  let ghostPressTimer: ReturnType<typeof setTimeout> | null = null;
  function ghostDown(): void {
    ghostPressTimer = setTimeout(() => {
      ghostPressTimer = null;
      ghostMenu = true;
    }, 500);
  }
  function ghostUp(): void {
    if (ghostPressTimer) {
      clearTimeout(ghostPressTimer);
      ghostPressTimer = null;
      appendPage(settings.data.lastTemplate);
    }
  }

  // ————— keyboard —————

  function stepWidth(dir: number): void {
    const hl = tools.tool === 'highlighter';
    const presets = hl ? HL_PRESETS : PEN_PRESETS;
    const cur = hl ? tools.hlWidth : tools.penWidth;
    let nearest = 0;
    for (let i = 1; i < presets.length; i++) {
      if (Math.abs(presets[i] - cur) < Math.abs(presets[nearest] - cur)) nearest = i;
    }
    const next = presets[Math.max(0, Math.min(presets.length - 1, nearest + dir))];
    if (hl) tools.hlWidth = next;
    else tools.penWidth = next;
  }

  function setColorForCurrent(color: string): void {
    if (tools.tool === 'highlighter') tools.hlColor = color;
    else tools.penColor = color;
  }

  function doUndo(): void {
    clearSelection();
    session.undo();
  }
  function doRedo(): void {
    clearSelection();
    session.redo();
  }

  function onKeyDown(e: KeyboardEvent): void {
    const t = e.target as HTMLElement;
    if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) return;
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) doRedo();
      else doUndo();
      return;
    }
    if (mod && (e.key === '=' || e.key === '+')) {
      e.preventDefault();
      setZoom(zoom * 1.25);
      return;
    }
    if (mod && e.key === '-') {
      e.preventDefault();
      setZoom(zoom / 1.25);
      return;
    }
    if (mod && e.key === '0') {
      e.preventDefault();
      fitWidth();
      return;
    }
    if (mod) return;
    switch (e.key) {
      case ' ':
        e.preventDefault();
        spaceDown = true;
        break;
      case 'p':
        tools.tool = 'pen';
        break;
      case 'h':
        tools.tool = 'highlighter';
        break;
      case 'e':
        tools.tool = 'eraser';
        break;
      case 's':
        tools.tool = 'lasso';
        break;
      case '[':
        stepWidth(-1);
        break;
      case ']':
        stepWidth(1);
        break;
      case 'Escape':
        clearSelection();
        overviewOpen = false;
        ghostMenu = false;
        break;
      case 'Backspace':
      case 'Delete':
        if (selection) {
          e.preventDefault();
          deleteSelection();
        }
        break;
      default: {
        const n = Number(e.key);
        if (n >= 1 && n <= 9 && INKS[n - 1]) setColorForCurrent(INKS[n - 1].id);
      }
    }
  }

  function onKeyUp(e: KeyboardEvent): void {
    if (e.key === ' ') spaceDown = false;
  }

  function onPointerMove(e: PointerEvent): void {
    if (barHidden && e.clientY < 60) barHidden = false;
  }

  function onResize(): void {
    const s = scroller;
    if (!s) return;
    engine.setViewportSize(s.clientWidth, s.clientHeight, dpr);
    updateVisible();
  }

  // ————— lifecycle —————

  onMount(() => {
    dpr = window.devicePixelRatio || 1;
    let cancelled = false;
    void (async () => {
      try {
        await session.open(notebookId);
      } catch (e) {
        toasts.show(`Couldn't open notebook · ${e}`);
        void goto('/');
        return;
      }
      if (cancelled) return;
      ready = true;
      await tick();
      if (wetCanvas) engine.attachWet(wetCanvas);
      onResize();
      fitWidth();
      await tick();
      scrollToResume();
      updateVisible();
    })();

    const s = scroller;
    s?.addEventListener('wheel', onWheel, { passive: false });
    s?.addEventListener('pointerdown', onPanPointerDown, true);
    s?.addEventListener('gesturestart', onGestureStart as EventListener);
    s?.addEventListener('gesturechange', onGestureChange as EventListener);

    return () => {
      cancelled = true;
      s?.removeEventListener('wheel', onWheel);
      s?.removeEventListener('pointerdown', onPanPointerDown, true);
      s?.removeEventListener('gesturestart', onGestureStart as EventListener);
      s?.removeEventListener('gesturechange', onGestureChange as EventListener);
      engine.destroy();
      session.onPagesChanged = () => {};
      void session.close();
    };
  });
</script>

<svelte:window
  onkeydown={onKeyDown}
  onkeyup={onKeyUp}
  onpointermove={onPointerMove}
  onresize={onResize}
/>

<div class="screen">
  <CanvasTopBar hidden={barHidden} bind:overviewOpen />

  <div class="viewport">
    <div
      class="scroller"
      class:space={spaceDown}
      class:panning
      role="presentation"
      bind:this={scroller}
      onscroll={onScroll}
      oncontextmenu={(e) => e.preventDefault()}
    >
      {#if ready && session.doc}
        <div
          class="content"
          style:height={`${contentH}px`}
          style:min-width={`${contentMinW}px`}
        >
          {#key session.rev}
            {#each session.doc.pages as p, i (p.id)}
              <div class="slot" style:top={`${pageOffset(i)}px`}>
                <PageSheet
                  page={p}
                  index={i}
                  {zoom}
                  {engine}
                  {windowFor}
                  active={i >= visFrom && i <= visTo}
                />
              </div>
            {/each}
          {/key}

          <div class="slot" style:top={`${pageOffset(pageCount)}px`}>
            <div
              class="ghost"
              style:width={`${pageW * zoom}px`}
              role="button"
              tabindex="0"
              aria-label="Add page"
              onpointerdown={ghostDown}
              onpointerup={ghostUp}
              onpointerleave={() => {
                if (ghostPressTimer) {
                  clearTimeout(ghostPressTimer);
                  ghostPressTimer = null;
                }
              }}
              onkeydown={(e) => {
                if (e.key === 'Enter') appendPage(settings.data.lastTemplate);
              }}
            >
              <span class="plus">+</span>
              {#if ghostMenu}
                <div class="ghost-menu">
                  {#each ['blank', 'ruled', 'grid', 'dotted'] as t (t)}
                    <button
                      onpointerdown={(e) => e.stopPropagation()}
                      onpointerup={(e) => e.stopPropagation()}
                      onclick={() => appendPage(t as TemplateKind)}
                    >
                      {t}
                    </button>
                  {/each}
                </div>
              {/if}
            </div>
          </div>
        </div>
      {/if}
    </div>

    <canvas class="wet" bind:this={wetCanvas}></canvas>

    {#if selection && selOrigin}
      <SelectionOverlay
        bounds={selection.bounds}
        origin={selOrigin}
        {zoom}
        selectedColor={strokesOf(selection.pageId, selection.ids)[0]?.color ?? 'ink/black'}
        onPreview={previewTransform}
        onCommit={commitTransform}
        onDelete={deleteSelection}
        onDuplicate={duplicateSelection}
        onRecolor={recolorSelection}
        {toPagePoint}
      />
    {/if}

    {#if zoomFlash}
      <div class="zoom-flash">{zoomFlash}</div>
    {/if}
  </div>

  <ToolIsland {tools} />

  <PageOverview
    bind:open={overviewOpen}
    onJump={scrollToPage}
    onAddPage={appendPage}
    onDeletePage={deletePage}
    onReorder={reorderPages}
  />

  {#if devMode}
    <DevHud {engine} />
  {/if}
</div>

<style>
  .screen {
    position: relative;
    height: 100vh;
    overflow: hidden;
  }
  .viewport {
    position: absolute;
    inset: 0;
  }
  .scroller {
    position: absolute;
    inset: 0;
    overflow: auto;
  }
  .scroller.space {
    cursor: grab;
  }
  .scroller.panning {
    cursor: grabbing;
  }
  .content {
    position: relative;
    width: 100%;
  }
  .slot {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
  }
  .ghost {
    display: grid;
    place-items: center;
    position: relative;
    height: 160px;
    border: 1px dashed var(--border);
    border-radius: 2px;
    color: var(--text-muted);
    cursor: pointer;
  }
  .ghost:hover {
    border-color: var(--text-muted);
    color: var(--text);
  }
  .plus {
    font-size: 22px;
    font-weight: 400;
    opacity: 0.7;
  }
  .ghost-menu {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    gap: 2px;
    padding: 4px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: var(--shadow-card);
    animation: rise 160ms ease-out;
  }
  @keyframes rise {
    from {
      opacity: 0;
      transform: translate(-50%, calc(-50% + 8px));
    }
  }
  .ghost-menu button {
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 12px;
    text-transform: capitalize;
  }
  .ghost-menu button:hover {
    background: var(--surface-2);
  }
  .wet {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 10;
  }
  .zoom-flash {
    position: absolute;
    top: 48px;
    right: 16px;
    z-index: 25;
    padding: 4px 10px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 999px;
    font-size: 12px;
    color: var(--text-muted);
    box-shadow: var(--shadow-card);
  }
</style>
