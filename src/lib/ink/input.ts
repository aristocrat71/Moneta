// Low-level pointer plumbing: capture lifecycle + coalesced/predicted event
// access. Nothing here may await, defer, or debounce — this is the pen path.

export const BUTTONS_BARREL = 2; // pen barrel button (mapped to pan by the shell)
export const BUTTONS_ERASER = 32; // pen eraser end

export interface CaptureHandlers {
  /** Return false to ignore the gesture (e.g. barrel-button pan). */
  onDown(e: PointerEvent): boolean;
  onMove(e: PointerEvent): void;
  onUp(e: PointerEvent): void;
  onCancel(e: PointerEvent): void;
}

export function attachPointer(el: HTMLElement, handlers: CaptureHandlers): () => void {
  let activeId: number | null = null;

  const down = (e: PointerEvent) => {
    if (activeId !== null) return;
    if (e.pointerType === 'touch') return; // touch scrolls; pen + mouse draw
    if (!handlers.onDown(e)) return;
    activeId = e.pointerId;
    el.setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  const move = (e: PointerEvent) => {
    if (e.pointerId !== activeId) return;
    handlers.onMove(e);
  };
  const up = (e: PointerEvent) => {
    if (e.pointerId !== activeId) return;
    activeId = null;
    handlers.onUp(e);
  };
  const cancel = (e: PointerEvent) => {
    if (e.pointerId !== activeId) return;
    activeId = null;
    handlers.onCancel(e);
  };

  el.addEventListener('pointerdown', down);
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', cancel);
  return () => {
    el.removeEventListener('pointerdown', down);
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerup', up);
    el.removeEventListener('pointercancel', cancel);
  };
}

export function coalescedEvents(e: PointerEvent): readonly PointerEvent[] {
  if (typeof e.getCoalescedEvents === 'function') {
    const events = e.getCoalescedEvents();
    if (events.length > 0) return events;
  }
  return [e];
}

/** Up to `max` predicted events for the wet-stroke tail. */
export function predictedEvents(e: PointerEvent, max: number): readonly PointerEvent[] {
  if (typeof e.getPredictedEvents === 'function') {
    const events = e.getPredictedEvents();
    return events.length > max ? events.slice(0, max) : events;
  }
  return [];
}
