import assert from 'node:assert/strict';
import test from 'node:test';

import {
  dockVars,
  footerProgress,
  lockupTop,
  openingTop,
} from '@/lib/footer/dock';
import {
  STAGES,
  letterTarget,
  makeLetters,
  stageFor,
  stepLetter,
  waveProgress,
} from '@/lib/footer/name-reveal';

const page = { viewportHeight: 820, scrollHeight: 4000, footerHeight: 236 };
const end = page.scrollHeight - page.viewportHeight;

test('the footer opens over its own height at the end of the page', () => {
  assert.equal(footerProgress({ ...page, scrollY: 0 }), 0);
  assert.equal(footerProgress({ ...page, scrollY: end - 236 }), 0);
  assert.equal(footerProgress({ ...page, scrollY: end - 118 }), 0.5);
  assert.equal(footerProgress({ ...page, scrollY: end }), 1);
});

test('a footer with no height never opens', () => {
  assert.equal(footerProgress({ ...page, footerHeight: 0, scrollY: end }), 0);
});

test('closed, the wide footer is the bare row; open, it is all the way', () => {
  assert.deepEqual(dockVars(0, false), {
    p: 0,
    wide: 0,
    surface: 0,
    dock: 0,
    leave: 0,
    appear: 1,
  });
  for (const value of Object.values(dockVars(1, false))) {
    assert.equal(value, 1);
  }
});

test('on a phone the row starts as nothing, already in the footer look', () => {
  const closed = dockVars(0, true);
  assert.equal(closed.appear, 0);
  assert.equal(closed.dock, 1);
  assert.equal(dockVars(0.08, true).appear, 1);
});

test('the rising lockup stays inside the opening', () => {
  // A wide footer, and a phone footer that fills an 844px screen.
  for (const height of [236, 844]) {
    for (let p = 0; p <= 1; p += 0.01) {
      assert.ok(
        lockupTop(p, height) >= openingTop(p, height),
        `lockup above the opening at p=${p.toFixed(2)}, height=${height}`
      );
    }
  }
});

test('the name is whole once the headline name has left the top', () => {
  const headline = { top: -45, bottom: -5, height: 40 };
  for (const p of [0, 0.2, 0.6]) {
    assert.equal(
      waveProgress({ p, compact: false, headline, footerHeight: 236 }),
      1
    );
  }
});

test('the name waits while the cube is still in the row', () => {
  const headline = { top: 108, bottom: 148, height: 40 };
  assert.equal(
    waveProgress({ p: 0.3, compact: false, headline, footerHeight: 236 }),
    0
  );
});

test('on a phone the wave follows the opening', () => {
  assert.equal(
    waveProgress({ p: 0.4, compact: true, headline: null, footerHeight: 844 }),
    0
  );
  assert.equal(
    waveProgress({ p: 0.9, compact: true, headline: null, footerHeight: 844 }),
    1
  );
});

test('letters arrive in order from the cube outward', () => {
  const letters = makeLetters(19);
  const first = letterTarget(0.3, letters[0]);
  const last = letterTarget(0.3, letters[18]);
  assert.ok(first > last);
  for (const letter of letters) assert.equal(letterTarget(1, letter), 1);
});

test('a letter settles on its target', () => {
  const [letter] = makeLetters(1);
  let moving = true;
  for (let frame = 0; moving && frame < 600; frame++) {
    moving = stepLetter(letter, 1, 1 / 60);
  }
  assert.equal(moving, false);
  assert.equal(letter.x, 1);
});

test('stages run from hidden to plain text', () => {
  assert.equal(stageFor(0), 0);
  assert.equal(stageFor(0.5), 4);
  assert.equal(stageFor(0.93), STAGES);
  assert.equal(stageFor(0.94), null);
  assert.equal(stageFor(1.02), null);
});
