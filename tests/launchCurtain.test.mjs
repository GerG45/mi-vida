import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';

const compiled = ts.transpileModule(await fs.readFile(new URL('../src/lib/launchCurtain.ts', import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText;
const { createLaunchCurtain, getLaunchWait } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

function harness({ elapsed = 0, reduced = false } = {}) {
  let time = elapsed, timerId = 0;
  const timers = new Map();
  const doc = new EventTarget();
  class Element extends EventTarget {
    hidden = false; disabled = false; dataset = {}; style = { overflow: '' }; attributes = new Map(); isConnected = true;
    contains(node) { return node === this || (this === curtain && node === enter); }
    focus(options) { doc.activeElement = this; this.focusOptions = options; }
    setAttribute(name, value) { this.attributes.set(name, value); }
    removeAttribute(name) { this.attributes.delete(name); }
  }
  globalThis.HTMLElement = Element;
  const body = new Element(), root = new Element(), curtain = new Element(), enter = new Element(), retry = new Element(), heading = new Element(), trigger = new Element();
  root.setAttribute('inert', ''); root.setAttribute('aria-hidden', 'true');
  enter.disabled = true; retry.hidden = true; body.style.overflow = 'clip';
  doc.body = body; doc.activeElement = body;
  doc.getElementById = id => ({ root, 'launch-curtain': curtain, 'launch-enter': enter, 'launch-retry': retry })[id] ?? null;
  doc.querySelector = () => heading;
  const media = new EventTarget(); media.matches = reduced;
  const host = {
    matchMedia: () => media,
    setTimeout(fn, ms) { const id = ++timerId; timers.set(id, { at: time + ms, fn }); return id; },
    clearTimeout(id) { timers.delete(id); },
  };
  function advance(ms) {
    const until = time + ms;
    for (;;) {
      const next = [...timers.entries()].filter(([, value]) => value.at <= until).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      time = next[1].at; timers.delete(next[0]); next[1].fn();
    }
    time = until;
  }
  const controller = createLaunchCurtain(doc, host, () => time);
  return { controller, doc, root, curtain, enter, retry, heading, trigger, body, media, timers, advance };
}

test('the welcome counts bundle loading inside its 2.2 second budget', () => {
  assert.equal(getLaunchWait(750), 1450);
  assert.equal(getLaunchWait(5000), 0);
  assert.equal(getLaunchWait(Number.NaN), 0);
  assert.equal(getLaunchWait(50, true), 0);
});

test('normal startup releases focus, scrolling and the app after a bounded exit; StrictMode is idempotent', () => {
  const h = harness({ elapsed: 1000 });
  let finished = 0;
  h.doc.addEventListener('mi-vida:welcome-finished', () => finished++);
  h.controller.ready(); h.controller.ready();
  assert.equal(h.timers.size, 1);
  assert.equal(h.body.style.overflow, 'hidden');
  assert.equal(h.doc.activeElement, h.curtain);
  h.advance(1199);
  assert.equal(h.curtain.hidden, false);
  assert.equal(h.root.attributes.has('inert'), true);
  h.advance(1);
  assert.equal(h.curtain.dataset.phase, 'leaving');
  h.advance(240);
  assert.equal(h.curtain.hidden, true);
  assert.equal(h.root.attributes.has('inert'), false);
  assert.equal(h.root.attributes.has('aria-hidden'), false);
  assert.equal(h.body.style.overflow, 'clip');
  assert.equal(h.doc.activeElement, h.heading);
  assert.equal(finished, 1);
  h.controller.destroy();
});

test('a slow load does not add a second welcome delay', () => {
  const h = harness({ elapsed: 4000 });
  h.controller.ready();
  assert.equal(h.curtain.dataset.phase, 'leaving');
  h.advance(240);
  assert.equal(h.curtain.hidden, true);
  assert.equal(h.timers.size, 0);
  h.controller.destroy();
});

test('reduced motion bypasses both the hold and the slide, including explicit replay', () => {
  const h = harness({ reduced: true });
  h.controller.ready();
  assert.equal(h.curtain.hidden, true);
  assert.equal(h.root.attributes.has('inert'), false);
  h.trigger.focus();
  h.controller.replay();
  assert.equal(h.curtain.hidden, true);
  assert.equal(h.doc.activeElement, h.trigger);
  assert.equal(h.timers.size, 0);
  h.controller.destroy();
});

test('explicit replay restores its trigger, while focus and background changes do not replay startup', () => {
  const h = harness({ elapsed: 5000 });
  h.controller.ready(); h.advance(240);
  h.doc.dispatchEvent(new Event('visibilitychange'));
  h.doc.dispatchEvent(new Event('focus'));
  assert.equal(h.curtain.hidden, true);
  h.trigger.focus(); h.controller.replay();
  assert.equal(h.curtain.hidden, false);
  h.enter.dispatchEvent(new Event('click')); h.advance(240);
  assert.equal(h.curtain.hidden, true);
  assert.equal(h.doc.activeElement, h.trigger);
  assert.deepEqual(h.trigger.focusOptions, { preventScroll: true });
  h.controller.destroy();
});

test('changing to reduced motion immediately unlocks an active welcome', () => {
  const h = harness();
  h.controller.ready();
  h.media.matches = true; h.media.dispatchEvent(new Event('change'));
  assert.equal(h.curtain.hidden, true);
  assert.equal(h.root.attributes.has('inert'), false);
  assert.equal(h.timers.size, 0);
  h.controller.destroy();
});

test('Tab stays on the welcome control and Escape skips without waiting for the hold', () => {
  const h = harness();
  h.controller.ready();
  const tab = new Event('keydown', { cancelable: true }); tab.key = 'Tab'; h.doc.dispatchEvent(tab);
  assert.equal(h.doc.activeElement, h.enter);
  assert.equal(tab.defaultPrevented, true);
  const escape = new Event('keydown', { cancelable: true }); escape.key = 'Escape'; h.doc.dispatchEvent(escape);
  h.advance(240);
  assert.equal(h.curtain.hidden, true);
  h.controller.destroy();
});

test('late recovery from the static failed-load fallback does not block the app again', () => {
  const h = harness({ elapsed: 9000 });
  h.curtain.hidden = true; h.retry.hidden = false;
  h.controller.ready();
  assert.equal(h.curtain.hidden, true);
  assert.equal(h.retry.hidden, true);
  assert.equal(h.root.attributes.has('inert'), false);
  assert.equal(h.timers.size, 0);
  h.controller.destroy();
});

test('a definitive render failure releases scrolling and keyboard traps even if ready never runs', () => {
  const h = harness();
  h.doc.dispatchEvent(new Event('mi-vida:welcome-failed'));
  assert.equal(h.curtain.hidden, true);
  assert.equal(h.root.attributes.has('inert'), false);
  assert.equal(h.root.attributes.has('aria-hidden'), false);
  assert.equal(h.body.style.overflow, 'clip');
  const tab = new Event('keydown', { cancelable: true }); tab.key = 'Tab'; h.doc.dispatchEvent(tab);
  assert.equal(tab.defaultPrevented, false);
  assert.equal(h.timers.size, 0);
  h.controller.destroy();
});
