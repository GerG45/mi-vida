import {useEffect, useRef, type RefObject} from 'react';

// Deliberately excludes rows, live counters, dialogs and floating controls.
const CARD_SELECTOR = [
  '.focus-card', '.wake-card', '.timeline-card', '.family-card', '.food-card',
  '.panel', '.journal-inspiration', '.journal-book-quote', '.habits-intro',
  '.calendar-day',
  '.training-day-entry', '.work-checklist-entry', '.daily-inspiration',
  '.gym-welcome', '.gym-preview-card', '.gym-exercise-card', '.gym-chart-panel',
  '.gym-history-list', '.gym-weekly-stats', '.gym-custom-intro', '.gym-builder',
  '.gym-saved-routines',
].join(',');

/** Reveal below-the-fold cards once, without ever hiding waiting content. */
export function useSoftMotion(
  rootRef: RefObject<HTMLElement | null>,
  refreshKey: string,
  enabled = true,
): void {
  const revealed = useRef(new WeakSet<HTMLElement>());

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !enabled) return;

    let disposed = false;
    let generation = 0;
    let intersection: IntersectionObserver | null = null;
    let mutations: MutationObserver | null = null;
    let welcomeTimeout: number | undefined;
    const waiting = new Set<HTMLElement>();
    const playing = new Map<HTMLElement, number>();
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)');

    root.classList.add('soft-motion-root');

    const finish = (card: HTMLElement) => {
      const timeout = playing.get(card);
      if (timeout !== undefined) window.clearTimeout(timeout);
      playing.delete(card);
      card.classList.remove('soft-scroll-enter');
    };
    const finishWelcome = () => {
      if (welcomeTimeout !== undefined) window.clearTimeout(welcomeTimeout);
      welcomeTimeout = undefined;
      root.classList.remove('soft-welcome-enter');
    };

    const eligible = (card: HTMLElement) => {
      if (!root.contains(card) || !card.isConnected ||
          card.closest('dialog, [role="dialog"], [hidden], [aria-hidden="true"], [data-soft-motion="off"]')) return false;
      // A nested card inherits its containing card's entrance, avoiding stacked slides.
      const containingCard = card.parentElement?.closest(CARD_SELECTOR);
      if (containingCard && root.contains(containingCard)) return false;
      for (let ancestor: HTMLElement | null = card; ancestor; ancestor = ancestor.parentElement) {
        if (getComputedStyle(ancestor).position === 'fixed') return false;
      }
      return card.getClientRects().length > 0;
    };

    const register = (card: HTMLElement) => {
      if (disposed || !intersection || waiting.has(card) || revealed.current.has(card) || !eligible(card)) return;
      const bounds = card.getBoundingClientRect();
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      if (bounds.top < viewportHeight || card.contains(document.activeElement)) {
        // The view/day transition already introduces cards visible on arrival.
        revealed.current.add(card);
        return;
      }
      waiting.add(card);
      intersection.observe(card);
    };

    const scan = (element: Element) => {
      if (element instanceof HTMLElement && element.matches(CARD_SELECTOR)) register(element);
      element.querySelectorAll<HTMLElement>(CARD_SELECTOR).forEach(register);
    };

    const stop = () => {
      generation++;
      intersection?.disconnect();
      mutations?.disconnect();
      intersection = null;
      mutations = null;
      waiting.clear();
      for (const card of playing.keys()) finish(card);
      finishWelcome();
    };

    const start = () => {
      if (disposed || reduced?.matches || typeof IntersectionObserver !== 'function') return;
      const currentGeneration = ++generation;
      intersection = new IntersectionObserver(entries => {
        if (disposed || reduced?.matches || generation !== currentGeneration) return;
        for (const entry of entries) {
          const card = entry.target as HTMLElement;
          if (!entry.isIntersecting || !waiting.has(card)) continue;
          waiting.delete(card);
          intersection?.unobserve(card);
          revealed.current.add(card);
          if (!eligible(card) || card.contains(document.activeElement)) continue;
          // Class is applied only on entry; no observer/JS failure can hide a card.
          card.classList.add('soft-scroll-enter');
          playing.set(card, window.setTimeout(() => finish(card), 340));
        }
      }, {threshold: 0, rootMargin: '0px 0px -12px 0px'});
      scan(root);
      if (typeof MutationObserver !== 'function') return;
      mutations = new MutationObserver(records => {
        if (disposed || generation !== currentGeneration) return;
        for (const record of records) {
          // Timer text updates and class/style changes never trigger a rescan.
          for (const added of record.addedNodes) if (added instanceof Element) scan(added);
          for (const removed of record.removedNodes) {
            if (!(removed instanceof Element)) continue;
            for (const card of waiting) if (removed.contains(card)) {
              intersection?.unobserve(card);
              waiting.delete(card);
            }
            for (const card of playing.keys()) if (removed.contains(card)) finish(card);
          }
        }
      });
      mutations.observe(root, {childList: true, subtree: true});
    };

    const focus = (event: FocusEvent) => {
      if (!(event.target instanceof Node)) return;
      finishWelcome();
      for (const card of waiting) if (card.contains(event.target)) {
        waiting.delete(card);
        intersection?.unobserve(card);
        revealed.current.add(card);
      }
      for (const card of playing.keys()) if (card.contains(event.target)) finish(card);
    };
    const animationEnd = (event: AnimationEvent) => {
      if (event.target instanceof HTMLElement && event.animationName === 'mi-vida-scroll-in') finish(event.target);
      if (event.target === root && event.animationName === 'mi-vida-welcome-in') finishWelcome();
    };
    const motionChange = () => {stop(); start();};
    const welcome = () => {
      if (disposed || reduced?.matches) return;
      // The launch curtain releases aria-hidden/inert before this event. Cards
      // skipped while the background was inaccessible can now be registered.
      scan(root);
      finishWelcome();
      root.classList.add('soft-welcome-enter');
      welcomeTimeout = window.setTimeout(finishWelcome, 340);
    };

    root.addEventListener('focusin', focus);
    root.addEventListener('animationend', animationEnd);
    document.addEventListener('mi-vida:welcome-finished', welcome);
    if (reduced?.addEventListener) reduced.addEventListener('change', motionChange);
    else reduced?.addListener(motionChange);
    start();

    return () => {
      disposed = true;
      stop();
      root.classList.remove('soft-motion-root');
      root.removeEventListener('focusin', focus);
      root.removeEventListener('animationend', animationEnd);
      document.removeEventListener('mi-vida:welcome-finished', welcome);
      if (reduced?.removeEventListener) reduced.removeEventListener('change', motionChange);
      else reduced?.removeListener(motionChange);
    };
  }, [rootRef, refreshKey, enabled]);
}
