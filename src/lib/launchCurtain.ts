export const LAUNCH_HOLD_MS = 2200;
export const LAUNCH_EXIT_MS = 240;

/** Count initial loading time once; a slow bundle must not add another wait. */
export function getLaunchWait(elapsedMs: number, reducedMotion = false): number {
  return reducedMotion ? 0 : Math.max(0, LAUNCH_HOLD_MS - Math.max(0, Number.isFinite(elapsedMs) ? elapsedMs : LAUNCH_HOLD_MS));
}

export function createLaunchCurtain(doc: Document, host: Window, now: () => number) {
  const curtain = doc.getElementById('launch-curtain');
  const root = doc.getElementById('root');
  const enter = doc.getElementById('launch-enter') as HTMLButtonElement | null;
  const retry = doc.getElementById('launch-retry');
  const media = host.matchMedia('(prefers-reduced-motion: reduce)');
  let ready = false;
  let active = Boolean(curtain && !curtain.hidden);
  let leaving = false;
  let skipRequested = false;
  let origin: HTMLElement | null = null;
  let previousOverflow = doc.body.style.overflow;
  let holdTimer: number | undefined;
  let exitTimer: number | undefined;

  function clearTimers() { host.clearTimeout(holdTimer); host.clearTimeout(exitTimer); }
  function unlock() {
    root?.removeAttribute('inert');
    root?.removeAttribute('aria-hidden');
    doc.body.style.overflow = previousOverflow;
  }
  function finish(announce = true) {
    if (!active) return;
    clearTimers();
    const focusWasInside = curtain?.contains(doc.activeElement) ?? false;
    active = false;
    leaving = false;
    if (curtain) { curtain.hidden = true; delete curtain.dataset.phase; }
    unlock();
    if (focusWasInside) {
      if (origin?.isConnected) origin.focus({ preventScroll: true });
      else {
        const heading = doc.querySelector<HTMLElement>('main h1');
        if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
      }
    }
    if (announce) doc.dispatchEvent(new Event('mi-vida:welcome-finished'));
  }
  function dismiss() {
    if (!ready) { skipRequested = true; return; }
    if (!active || leaving) return;
    clearTimers();
    leaving = true;
    if (media.matches) { finish(); return; }
    if (curtain) curtain.dataset.phase = 'leaving';
    exitTimer = host.setTimeout(finish, LAUNCH_EXIT_MS);
  }
  function keyDown(event: KeyboardEvent) {
    if (!active) return;
    if (event.key === 'Escape') { event.preventDefault(); dismiss(); }
    // The one actionable control stays reachable while the app behind is inert.
    if (event.key === 'Tab') { event.preventDefault(); (ready && enter ? enter : curtain)?.focus({ preventScroll: true }); }
  }
  function reducedChanged() { if (active && ready && media.matches) { clearTimers(); finish(); } }
  function failedLoad() { finish(false); }
  function lock() {
    previousOverflow = doc.body.style.overflow;
    doc.body.style.overflow = 'hidden';
    root?.setAttribute('inert', '');
    root?.setAttribute('aria-hidden', 'true');
  }
  if (active) lock();
  enter?.addEventListener('click', dismiss);
  doc.addEventListener('keydown', keyDown);
  doc.addEventListener('mi-vida:welcome-failed', failedLoad);
  media.addEventListener('change', reducedChanged);

  return {
    ready() {
      if (ready) return; // React StrictMode may mount effects twice.
      ready = true;
      if (retry) retry.hidden = true;
      if (curtain) curtain.dataset.ready = 'true';
      if (enter) enter.disabled = false;
      // The HTML fallback may already have removed the curtain after a failed load.
      if (curtain?.hidden) { active = false; unlock(); return; }
      if (!active) { unlock(); return; }
      const wait = getLaunchWait(now(), media.matches);
      if (skipRequested || wait === 0) dismiss();
      else { curtain?.focus({ preventScroll: true }); holdTimer = host.setTimeout(dismiss, wait); }
    },
    replay() {
      if (!ready || active || !curtain) return;
      origin = doc.activeElement instanceof HTMLElement ? doc.activeElement : null;
      active = true;
      leaving = false;
      skipRequested = false;
      curtain.hidden = false;
      delete curtain.dataset.phase;
      lock();
      if (media.matches) { finish(); return; }
      curtain.focus({ preventScroll: true });
      holdTimer = host.setTimeout(dismiss, LAUNCH_HOLD_MS);
    },
    destroy() {
      clearTimers();
      if (active) finish();
      enter?.removeEventListener('click', dismiss);
      doc.removeEventListener('keydown', keyDown);
      doc.removeEventListener('mi-vida:welcome-failed', failedLoad);
      media.removeEventListener('change', reducedChanged);
    },
  };
}

let controller: ReturnType<typeof createLaunchCurtain> | undefined;
export function prepareLaunchCurtain() {
  controller ??= createLaunchCurtain(document, window, () => performance.now());
}
export function releaseLaunchCurtain() { controller?.ready(); }
export function replayWelcome() { controller?.replay(); }
