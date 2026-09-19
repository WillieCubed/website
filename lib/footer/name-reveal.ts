import { clamp01, ramp } from './dock';

/**
 * The footer's name arrives letter by letter, from the cube outward, while
 * the homepage headline's name leaves the screen, so the full name is always
 * somewhere in view. The scroll sets how far the wave has reached; each
 * letter follows on its own spring, so a fast scroll leaves the letters to
 * catch up and settle, and scrolling back sends them out again.
 *
 * The name stays one plain text node the whole time. Nothing is split,
 * copied or hidden, so it reads, selects and kerns like any other text: each
 * letter is a Range over that node, sorted into one of a few highlight
 * stages (the CSS Custom Highlight API) that footer-dock.css styles. A letter that
 * has landed leaves every stage and is just the text.
 */

/** How many in-between looks a letter passes through on its way in. */
export const STAGES = 8;

/** The name each stage is registered under, styled in footer-dock.css. */
export function stageName(stage: number): string {
  return `footer-name-${stage}`;
}

/** The share of the wave each letter takes to arrive. */
const WINDOW = 0.4;
/** How far open the footer is when the cube has lifted clear of the row. */
const WAVE_FROM = 0.35;
/** Just under critical damping, so a letter overshoots a touch and settles. */
const ZETA = 0.52;

export interface HeadlineBox {
  top: number;
  bottom: number;
  height: number;
}

/**
 * How far along the name the wave has reached. On a wide screen it starts
 * once the cube has lifted clear of the row and is complete by the time the
 * headline's name has left the top of the window. On a phone the headline
 * is long gone by the end, so the wave follows the opening instead.
 */
export function waveProgress({
  p,
  compact,
  headline,
  footerHeight,
}: {
  p: number;
  compact: boolean;
  headline: HeadlineBox | null;
  footerHeight: number;
}): number {
  if (compact || !headline || headline.height <= 0 || footerHeight <= 0) {
    return ramp(p, 0.45, 0.9);
  }
  // Share of the headline's name that has scrolled off the top.
  const exit = clamp01(-headline.top / headline.height);
  // The p at which it will be gone: the rail scrolls one pixel per pixel of
  // opening once the footer starts to open.
  const gone = p + Math.max(0, headline.bottom) / footerHeight;
  if (gone <= WAVE_FROM + 0.05) return exit;
  return Math.max(exit, ramp(p, WAVE_FROM, gone));
}

export interface Letter {
  /** Where along the wave the letter starts to arrive. */
  start: number;
  stiffness: number;
  damping: number;
  /** How far the letter has arrived. Can pass 1 briefly as it settles. */
  x: number;
  v: number;
}

/**
 * A fixed scramble of an index, so the wave is uneven but the same on
 * every visit.
 */
function scramble(i: number): number {
  return (((i + 1) * 2654435761) % 4294967296) / 4294967296;
}

export function makeLetters(count: number): Letter[] {
  return Array.from({ length: count }, (_, i) => {
    const along = count > 1 ? i / (count - 1) : 0;
    const jitter = (scramble(i + 7) - 0.5) * 0.05;
    const stiffness = 150 + scramble(i) * 90;
    return {
      start: Math.min(1 - WINDOW, Math.max(0, along * (1 - WINDOW) + jitter)),
      stiffness,
      damping: 2 * ZETA * Math.sqrt(stiffness),
      x: 0,
      v: 0,
    };
  });
}

/** Where a letter is headed for a given wave. */
export function letterTarget(wave: number, letter: Letter): number {
  return clamp01((wave - letter.start) / WINDOW);
}

/**
 * Moves a letter toward its target over `dt` seconds, and says whether it
 * is still moving. Small fixed steps keep the spring stable on slow frames.
 */
export function stepLetter(
  letter: Letter,
  target: number,
  dt: number
): boolean {
  const steps = Math.max(1, Math.ceil(dt * 240));
  const h = dt / steps;
  for (let n = 0; n < steps; n++) {
    letter.v +=
      (letter.stiffness * (target - letter.x) - letter.damping * letter.v) * h;
    letter.x += letter.v * h;
  }
  if (Math.abs(target - letter.x) < 5e-4 && Math.abs(letter.v) < 5e-3) {
    letter.x = target;
    letter.v = 0;
    return false;
  }
  return true;
}

/** The stage a letter shows at `x`, or null once it has landed. */
export function stageFor(x: number): number | null {
  if (x >= 0.94) return null;
  return Math.max(0, Math.min(STAGES, Math.floor(x * (STAGES + 1))));
}

export interface NameReveal {
  set(wave: number): void;
  destroy(): void;
}

/**
 * Starts the letter wave on the name's text node. The name's element shows
 * once its letters are in place (--footer-name-opacity), so the first paint
 * never flashes the whole name. Without the Highlight API the name fades in
 * whole with the wave instead.
 */
export function createNameReveal(
  text: Text,
  { reduceMotion }: { reduceMotion: () => boolean }
): NameReveal {
  const element = text.parentElement;
  if (!element) return { set() {}, destroy() {} };

  if (!('highlights' in CSS)) {
    return {
      set: (wave) =>
        element.style.setProperty('--footer-name-opacity', wave.toFixed(3)),
      destroy: () => element.style.removeProperty('--footer-name-opacity'),
    };
  }

  const stages = Array.from({ length: STAGES + 1 }, () => new Highlight());
  stages.forEach((stage, k) => CSS.highlights.set(stageName(k), stage));
  const graphemes = new Intl.Segmenter(undefined, {
    granularity: 'grapheme',
  }).segment(text.data);
  const ranges = [...graphemes].map(({ index, segment }) => {
    const range = new Range();
    range.setStart(text, index);
    range.setEnd(text, index + segment.length);
    return range;
  });
  const letters = makeLetters(ranges.length);
  const shown: (number | null)[] = letters.map(() => null);

  const paint = (i: number, plain: boolean) => {
    const stage = plain
      ? letters[i].x >= 0.94
        ? null
        : 0
      : stageFor(letters[i].x);
    const was = shown[i];
    if (stage === was) return;
    if (was !== null) stages[was].delete(ranges[i]);
    if (stage !== null) stages[stage].add(ranges[i]);
    shown[i] = stage;
  };

  let wave = 0;
  let frame = 0;
  let last = 0;
  let primed = false;

  const tick = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const plain = reduceMotion();
    let moving = false;
    for (let i = 0; i < letters.length; i++) {
      const letter = letters[i];
      const target = letterTarget(wave, letter);
      if (plain) {
        letter.x = target;
        letter.v = 0;
      } else if (letter.x !== target || letter.v !== 0) {
        if (stepLetter(letter, target, dt)) moving = true;
      }
      paint(i, plain);
    }
    frame = moving ? requestAnimationFrame(tick) : 0;
  };

  const settle = () => {
    const plain = reduceMotion();
    for (let i = 0; i < letters.length; i++) {
      letters[i].x = letterTarget(wave, letters[i]);
      letters[i].v = 0;
      paint(i, plain);
    }
  };

  settle();
  element.style.setProperty('--footer-name-opacity', '1');

  return {
    set(next) {
      // The first reading puts the letters where they belong, so a page
      // loaded part-way down does not play the wave on arrival.
      if (!primed) {
        primed = true;
        wave = next;
        settle();
        return;
      }
      // Nothing to do while the wave stands still and the letters have
      // caught up with it, which is most of the page.
      if (next === wave && !frame) return;
      wave = next;
      if (frame) return;
      last = performance.now();
      frame = requestAnimationFrame(tick);
    },
    destroy() {
      cancelAnimationFrame(frame);
      stages.forEach((_, k) => CSS.highlights.delete(stageName(k)));
      element.style.removeProperty('--footer-name-opacity');
    },
  };
}
