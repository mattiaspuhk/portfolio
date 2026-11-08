/**
 * The storm behind the home page hero: a weather-radar return on a square grid, a squall line
 * rising from low left to high right with hot cores. `weather` gives the return at any cell at any
 * point of the storm's drift, so it runs off both sides of any screen and RadarBand.astro can
 * animate it on a canvas, and `clearAir` frays it around the words. The build draws the start of
 * the drift as an SVG for pages without JS. Everything comes from a fixed seed, so the storm is the same on every build.
 */

/** Seeded PRNG (mulberry32). */
function random(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function valueNoise(seed: number) {
  const r = random(seed);
  const table = Array.from({ length: 512 }, () => r());
  const lattice = (x: number, y: number) => table[(((x * 73856093) ^ (y * 19349663)) >>> 0) % 512]!;
  const smooth = (t: number) => t * t * (3 - 2 * t);
  return (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const u = smooth(x - xi), v = smooth(y - yi);
    const a = lattice(xi, yi), b = lattice(xi + 1, yi), c = lattice(xi, yi + 1), d = lattice(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

/** A stable number in [0, 1) for a cell, a step and a salt. */
function hash(x: number, y: number, step: number, salt: number) {
  let h = Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1) ^ Math.imul(step, 0x9e3779b1) ^ Math.imul(salt, 0x85ebca77);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

/** Where the squall line runs, in heights of the frame it's drawn in, down from the frame's top. */
export interface Squall {
  /** The line's centre at the left edge of the screen, and at the right */
  from: number;
  to: number;
  /** How far the return reaches either side of the line */
  spread: number;
}

/** In a band of its own: the SVG drawn for pages without JS, and the reference for the thresholds */
export const BAND: Squall = { from: 0.8, to: 0.2, spread: 0.3 };

/** Over the whole hero: up from below the words on the left to past their end on the right */
export const HERO: Squall = { from: 0.98, to: 0.1, spread: 0.34 };

/** Return strength for a scattered cell, then for levels 1 to 4. */
export type Thresholds = readonly [number, number, number, number, number];

/** Cells of drift between a cell's re-rolls of its speckle, scatter, holes and glints. */
const TWINKLE = 4;

export function weather(seed = 7) {
  const wobble = valueNoise(seed);
  const broad = valueNoise(seed + 1);
  const fine = valueNoise(seed + 2);
  const finest = valueNoise(seed + 3);
  const cores = valueNoise(seed + 4);

  // Each cell re-rolls on its own beat, so the fringe twinkles rather than flips all at once
  const roll = (x: number, y: number, d: number, salt: number) =>
    hash(x, y, Math.floor(d / TWINKLE + hash(x, y, 0, salt)), salt);

  /** The line's centre over column x (u across the screen, 0–1) once the storm has drifted d cells. */
  const centre = (squall: Squall, u: number, x: number, d: number) =>
    squall.from + (squall.to - squall.from) * u + (wobble((x - d) / 30, 3.7) - 0.5) * 0.25;

  /** Return strength at cell (x, y), v down the frame, `line` the line's centre over it. */
  const strength = (x: number, y: number, v: number, line: number, spread: number, d: number) => {
    const e = (v - line) / spread;
    // Nothing returns this far from the line, speckle and scatter included
    if (e * e > 6.25) return 0;
    // The storm drifts right and a little up, each octave at its own pace, so it boils as it goes
    const texture =
      broad((x - d) / 7, (y + d * 0.2) / 4.5) * 0.5 +
      fine((x - d * 1.3) / 3, (y - d * 0.3) / 2) * 0.3 +
      finest((x - d * 0.75) / 1.4, (y + d * 0.4) / 0.9) * 0.2;
    let f = Math.exp(-e * e);
    // Hot cores ride the line
    f += 1.3 * Math.max(0, cores((x - d * 1.1) / 22, (y + d * 0.2) / 8) - 0.5) * Math.exp(-2 * e * e);
    f *= 0.25 + 1.05 * texture;
    // Speckle, so levels mix where they meet
    f += (roll(x, y, d, 1) - 0.5) * 0.14;
    // Below the line the return thins out into scattered cells
    if (e > 0.5 && roll(x, y, d, 2) < e * 0.48) f *= 0.45;
    return f;
  };

  /** 0 empty, 1–4 weakest to strongest return, 5 a glint. */
  const level = (f: number, x: number, y: number, d: number, [scatter, low, mid, high, core]: Thresholds) => {
    if (f < low) return f > scatter && roll(x, y, d, 3) < 0.3 ? 1 : 0;
    const value = f > core ? 4 : f > high ? 3 : f > mid ? 2 : 1;
    if (value === 3 && roll(x, y, d, 4) < 0.1) return 5;
    if (value === 1 && roll(x, y, d, 5) < 0.18) return 0;
    return value;
  };

  return { centre, strength, level };
}

export type Weather = ReturnType<typeof weather>;

/** The band as the build draws it, also the reference for the thresholds. */
const REFERENCE = { cols: 220, rows: 34 };

/** Thresholds by share of cells in the reference band, so the mix of levels stays put. */
export function thresholds(sky: Weather): Thresholds {
  const { cols, rows } = REFERENCE;
  const strengths: number[] = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const line = sky.centre(BAND, (i + 0.5) / cols, i, 0);
      strengths.push(sky.strength(i, j, (j + 0.5) / rows, line, BAND.spread, 0));
    }
  }
  strengths.sort((a, b) => a - b);
  const q = (p: number) => strengths[Math.floor(p * (strengths.length - 1))]!;
  return [q(0.46), q(0.56), q(0.73), q(0.86), q(0.955)];
}

export interface RadarField {
  cols: number;
  rows: number;
  /** One value per cell, row by row: 0 empty, 1–4 weakest to strongest return, 5 a glint. */
  cells: Uint8Array;
}

/** The reference band at the start of the drift. */
export function radarField(seed = 7): RadarField {
  const { cols, rows } = REFERENCE;
  const sky = weather(seed);
  const levels = thresholds(sky);
  const cells = new Uint8Array(cols * rows);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const line = sky.centre(BAND, (i + 0.5) / cols, i, 0);
      const f = sky.strength(i, j, (j + 0.5) / rows, line, BAND.spread, 0);
      cells[j * cols + i] = sky.level(f, i, j, 0, levels);
    }
  }
  return { cols, rows, cells };
}

/** The no-JS drawing: one path per value (1–5), and hairlines between the cells. */
export function fieldPaths({ cols, rows, cells }: RadarField) {
  const levels = [1, 2, 3, 4, 5].map((value) =>
    Array.from(cells, (v, k) => (v === value ? `M${k % cols} ${Math.floor(k / cols)}h1v1h-1z` : '')).join(''),
  );
  const grid =
    Array.from({ length: cols + 1 }, (_, i) => `M${i} 0v${rows}`).join('') +
    Array.from({ length: rows + 1 }, (_, j) => `M0 ${j}h${cols}`).join('');
  return { levels, grid };
}

/** How far the storm keeps off the words, in CSS px. */
export interface Clearing {
  /** No return at all this close */
  clear: number;
  /** How far past that the edge of the clear air wanders */
  fray: number;
  /** Over how many px past the edge the return thins back in */
  soft: number;
}

/**
 * Clear air around words: the share of its return a cell (i, j) may show `d` CSS px from the
 * nearest word. The edge wanders and the fringe thins out cell by cell, so the storm frays around
 * the words instead of stopping along a straight line.
 */
export function clearAir({ clear, fray, soft }: Clearing, seed = 7) {
  const wander = valueNoise(seed + 5);
  const jitter = valueNoise(seed + 6);
  return (i: number, j: number, d: number) => {
    const edge = clear + fray * wander(i / 5, j / 5) + 0.3 * fray * (jitter(i / 1.6, j / 1.6) - 0.5);
    const t = (d - edge) / soft;
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return hash(i, j, 0, 6) > t * 1.15 ? 0 : t ** 1.2;
  };
}
