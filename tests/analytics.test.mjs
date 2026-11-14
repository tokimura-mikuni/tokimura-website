import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../public/tokimura-analytics.js', import.meta.url), 'utf8');

function site(initialVisibility = 'visible') {
  let now = 0;
  let id = 0;
  const timers = new Map();
  const docListeners = new Map();
  const winListeners = new Map();
  const events = [];
  const document = {
    visibilityState: initialVisibility,
    addEventListener: (name, fn) => docListeners.set(name, fn),
  };
  const window = {
    performance: { now: () => now },
    setTimeout: (fn, delay) => {
      const key = ++id;
      timers.set(key, { fn, due: now + delay });
      return key;
    },
    clearTimeout: key => timers.delete(key),
    addEventListener: (name, fn) => winListeners.set(name, fn),
    gtag: (...args) => events.push(args),
    location: { href: 'https://tokimura.jp/' },
  };
  vm.runInNewContext(source, { window, document, URL, Date });
  function advance(ms) {
    const end = now + ms;
    while (true) {
      const next = [...timers.entries()]
        .filter(([, t]) => t.due <= end)
        .sort((a, b) => a[1].due - b[1].due)[0];
      if (!next) break;
      now = next[1].due;
      timers.delete(next[0]);
      next[1].fn();
    }
    now = end;
  }
  function visibility(state) {
    document.visibilityState = state;
    docListeners.get('visibilitychange')();
  }
  function click(room = 'A', href = 'https://www.airbnb.com/h/wabisabi-house-mikuni-rooma') {
    docListeners.get('click')({
      target: { closest: () => ({ href, dataset: { airbnbRoom: room } }) },
    });
  }
  return { events, advance, visibility, click, winListeners };
}

test('3 visible seconds generate exactly one qualified_page_view, not before', () => {
  const s = site();
  s.advance(2999);
  assert.equal(s.events.length, 0);
  s.advance(1);
  assert.deepEqual(s.events, [['event', 'qualified_page_view']]);
  s.advance(99999);
  assert.equal(s.events.length, 1);
});

test('background and pagehide durations do not count toward 3s', () => {
  const s = site();
  s.advance(1200);
  s.visibility('hidden');
  s.advance(10000);
  assert.equal(s.events.length, 0);
  s.visibility('visible');
  s.advance(1799);
  assert.equal(s.events.length, 0);
  s.advance(1);
  assert.equal(s.events.length, 1);
  const other = site();
  other.advance(1500);
  other.winListeners.get('pagehide')();
  other.advance(10000);
  assert.equal(other.events.length, 0);
  other.winListeners.get('pageshow')();
  other.advance(1500);
  assert.equal(other.events.length, 1);
});

test('clicks for A-E remain independent, and unrelated guidebook click ignored', () => {
  const s = site();
  s.click('A');
  s.click('E', 'https://www.airbnb.com/h/wabisabi-house-mikuni-roome');
  s.click('A', 'https://www.airbnb.com/s/guidebooks');
  assert.deepEqual(s.events.map(e => e[1]), ['airbnb_link_click_a', 'airbnb_link_click_e']);
  assert.equal(s.events[0][2].transport_type, 'beacon');
  assert.equal(s.events[1][2].transport_type, 'beacon');
});

test('pages initially hidden do not qualify until visible', () => {
  const s = site('hidden');
  s.advance(5000);
  assert.equal(s.events.length, 0);
  s.visibility('visible');
  s.advance(3000);
  assert.equal(s.events.length, 1);
});
