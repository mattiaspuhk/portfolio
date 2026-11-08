/**
 * Aircraft for the apron: each project's plane, drawn at build time as a static SVG line drawing.
 *
 * A small mesh per aircraft, projected with an orthographic three-quarter camera. Faces are painted
 * back to front (wherever two overlap on screen, the nearer one is painted later), so the fills
 * hide what is behind them, and only feature edges are stroked: silhouettes, creases and the joins
 * between parts. Nothing is coloured here. The output carries classes that apron.css styles from
 * tokens, so the same drawing works in both themes:
 *   f-<part>  a filled face (fus, belly, wing, fin, eng, fan, …)
 *   e-s       silhouette, e-c crease, e-m part boundary, e-d door outline
 */

export const AIRCRAFT = ['wide', 'narrow', 'rear', 'prop'] as const;
export type Aircraft = (typeof AIRCRAFT)[number];

type Part =
  | 'fus' | 'belly' | 'wing' | 'wlet' | 'fin' | 'hstab' | 'eng' | 'fan'
  | 'pylon' | 'spinner' | 'prop' | 'gear' | 'tyre' | 'hub' | 'win';

interface Vec {
  x: number;
  y: number;
  z: number;
}
/** A projected point: screen x and y, and z = depth towards the camera. */
type Screen = Vec;
interface Pt {
  x: number;
  y: number;
}

const V = (x: number, y: number, z: number): Vec => ({ x, y, z });
const add = (a: Vec, b: Vec) => V(a.x + b.x, a.y + b.y, a.z + b.z);
const sub = (a: Vec, b: Vec) => V(a.x - b.x, a.y - b.y, a.z - b.z);
const mul = (a: Vec, k: number) => V(a.x * k, a.y * k, a.z * k);
const dot = (a: Vec, b: Vec) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: Vec, b: Vec) => V(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
const norm = (a: Vec) => mul(a, 1 / (Math.hypot(a.x, a.y, a.z) || 1));
const lerp = (a: Vec, b: Vec, t: number) => add(a, mul(sub(b, a), t));
const rad = (deg: number) => (deg * Math.PI) / 180;

interface Face {
  idx: number[];
  part: Part;
  /** The outward normal points away from this point… */
  away?: Vec;
  /** …or towards this one (for faces seen from inside, like an inlet wall). */
  toward?: Vec;
}
interface Decal {
  parent: number;
  pts: Vec[];
  part: Part;
  outline?: boolean;
}

class Mesh {
  v: Vec[] = [];
  f: Face[] = [];
  decals: Decal[] = [];
  vert(p: Vec) {
    return this.v.push(p) - 1;
  }
  face(idx: number[], part: Part, orient: Pick<Face, 'away' | 'toward'>) {
    return this.f.push({ idx, part, ...orient }) - 1;
  }
}

/* ---------- Building blocks ---------- */

/** n points around an axis. Angle 0 points to port (-z) for a fore-aft axis, 90° to the top. */
function ring(m: Mesh, c: Vec, axis: Vec, r: number, n: number, ry = r) {
  const a = norm(axis);
  const helper = Math.abs(a.y) > 0.9 ? V(1, 0, 0) : V(0, 1, 0);
  const e1 = norm(cross(helper, a));
  const e2 = norm(cross(a, e1));
  return Array.from({ length: n }, (_, j) => {
    const t = (2 * Math.PI * j) / n;
    return m.vert(add(c, add(mul(e1, Math.cos(t) * r), mul(e2, Math.sin(t) * ry))));
  });
}

/** Surface of revolution along `axis` from `origin`; `profile` is [distance, radius] pairs. */
function lathe(
  m: Mesh,
  origin: Vec,
  axis: Vec,
  profile: [number, number][],
  n: number,
  part: Part,
  caps: { start?: Part; end?: Part } = {},
) {
  const a = norm(axis);
  const rings = profile.map(([s, r]) => {
    const c = add(origin, mul(a, s));
    return { c, ids: ring(m, c, a, r, n) };
  });
  for (let i = 0; i < rings.length - 1; i++) {
    const A = rings[i]!, B = rings[i + 1]!;
    const mid = lerp(A.c, B.c, 0.5);
    for (let j = 0; j < n; j++) {
      const k = (j + 1) % n;
      m.face([A.ids[j]!, A.ids[k]!, B.ids[k]!, B.ids[j]!], part, { away: mid });
    }
  }
  const first = rings[0]!, last = rings[rings.length - 1]!;
  if (caps.start) m.face([...first.ids].reverse(), caps.start, { away: add(first.c, a) });
  if (caps.end) m.face(last.ids, caps.end, { away: sub(last.c, a) });
  return rings;
}

/** A box, its top edge optionally sheared fore or aft (for pylons). */
function box(m: Mesh, [x0, x1]: [number, number], [y0, y1]: [number, number], [z0, z1]: [number, number], part: Part, shearTop = 0) {
  const p = (x: number, y: number, z: number) => m.vert(V(x + (y === y1 ? shearTop : 0), y, z));
  const c = V((x0 + x1 + shearTop) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  const a = p(x0, y0, z0), b = p(x1, y0, z0), d = p(x0, y1, z0), e = p(x1, y1, z0);
  const f = p(x0, y0, z1), g = p(x1, y0, z1), h = p(x0, y1, z1), i = p(x1, y1, z1);
  for (const q of [[a, b, e, d], [f, h, i, g], [a, d, h, f], [b, g, i, e], [d, e, i, h], [a, f, g, b]]) {
    m.face(q, part, { away: c });
  }
}

interface Section {
  /** Leading edge point; the chord runs aft along -x. */
  le: Vec;
  chord: number;
  thickness: number;
  /** Thickness direction. */
  up: Vec;
}

/** Wing, tailplane or fin: a six-point airfoil swept through its sections, so both edges crease. */
function surface(m: Mesh, sections: Section[], part: Part) {
  const airfoil: [number, number][] = [[0, 0], [0.12, 0.42], [0.35, 0.5], [1, 0], [0.35, -0.32], [0.12, -0.26]];
  const rings = sections.map((s) => ({
    ids: airfoil.map(([u, h]) => m.vert(add(s.le, add(V(-u * s.chord, 0, 0), mul(norm(s.up), h * s.thickness))))),
    mid: add(s.le, V(-0.4 * s.chord, 0, 0)),
  }));
  for (let i = 0; i < rings.length - 1; i++) {
    const A = rings[i]!, B = rings[i + 1]!;
    const mid = lerp(A.mid, B.mid, 0.5);
    for (let j = 0; j < airfoil.length; j++) {
      const k = (j + 1) % airfoil.length;
      m.face([A.ids[j]!, A.ids[k]!, B.ids[k]!, B.ids[j]!], part, { away: mid });
    }
  }
  // Tip cap
  m.face(rings[rings.length - 1]!.ids, part, { away: rings[rings.length - 2]!.mid });
}

/** The fuselage, plus helpers to place windows and doors on its skin. */
function fuselage(m: Mesh, L: number, R: number, noseLen: number, tailLen: number) {
  const n = 20;
  const ey = 1.04; // a touch taller than wide
  const xs: number[] = [];
  for (let i = 0; i <= 9; i++) xs.push((tailLen * i) / 9);
  const bodySteps = Math.max(6, Math.round((L - noseLen - tailLen) / 2.2));
  for (let i = 1; i < bodySteps; i++) xs.push(tailLen + ((L - noseLen - tailLen) * i) / bodySteps);
  for (let i = 0; i < 9; i++) xs.push(L - noseLen + noseLen * (1 - Math.cos(((i / 9) * Math.PI) / 2)));

  // Radius and centre height along the body: the tail sweeps up, the nose droops a little.
  const profile = (x: number) => {
    if (x < tailLen) {
      const r = R * (0.1 + 0.9 * (1 - (1 - x / tailLen) ** 2.2));
      return { r, yc: R - r * 1.02 };
    }
    if (x > L - noseLen) {
      const t = (x - (L - noseLen)) / noseLen;
      return { r: R * Math.sqrt(Math.max(0, 1 - t ** 2.1)), yc: -0.22 * R * t ** 1.4 };
    }
    return { r: R, yc: 0 };
  };
  // The lower band is its own part, so a cheatline is drawn where it meets the top.
  const partAt = (j: number): Part => {
    const theta = ((j + 0.5) / n) * 360;
    return theta > 196 && theta < 344 ? 'belly' : 'fus';
  };

  const stations = xs.map((x) => {
    const { r, yc } = profile(x);
    return { x, yc, ids: ring(m, V(x, yc, 0), V(1, 0, 0), r, n, r * ey) };
  });
  const grid: number[][] = [];
  for (let i = 0; i < stations.length - 1; i++) {
    const A = stations[i]!, B = stations[i + 1]!;
    const mid = V((A.x + B.x) / 2, (A.yc + B.yc) / 2, 0);
    grid.push(
      Array.from({ length: n }, (_, j) => {
        const k = (j + 1) % n;
        return m.face([A.ids[j]!, A.ids[k]!, B.ids[k]!, B.ids[j]!], partAt(j), { away: mid });
      }),
    );
  }
  const last = stations[stations.length - 1]!;
  const tip = m.vert(V(L, -0.22 * R, 0));
  const nose = Array.from({ length: n }, (_, j) =>
    m.face([last.ids[j]!, last.ids[(j + 1) % n]!, tip], partAt(j), { away: V(last.x - 1, last.yc, 0) }),
  );
  m.face([...stations[0]!.ids].reverse(), 'fus', { away: V(1, stations[0]!.yc, 0) });

  /** A point on the skin, `lift` above it. Same angles as ring(): 0° port, 90° crown. */
  const skin = (x: number, thetaDeg: number, lift = 0.03) => {
    const { r, yc } = profile(x);
    const t = rad(thetaDeg);
    return V(x, yc + Math.sin(t) * (r * ey + lift), -Math.cos(t) * (r + lift));
  };
  /** The fuselage face under a point on the skin. */
  const faceAt = (x: number, thetaDeg: number) => {
    const j = Math.floor((((thetaDeg % 360) + 360) % 360) / (360 / n));
    const i = stations.findIndex((s, k) => k < stations.length - 1 && x >= s.x && x < stations[k + 1]!.x);
    return i < 0 ? nose[j]! : grid[i]![j]!;
  };
  return { profile, skin, faceAt };
}

/** Turbofan nacelle with a dark fan face and exhaust cone. */
function nacelle(m: Mesh, front: Vec, length: number, r: number) {
  const n = 14;
  const aft = V(-1, 0, 0);
  const rings = lathe(m, front, aft, [[0, r * 0.94], [0.18 * length, r], [0.55 * length, r * 0.96], [0.9 * length, r * 0.72], [length, r * 0.62]], n, 'eng');
  const lip = ring(m, add(front, V(-0.05, 0, 0)), V(1, 0, 0), r * 0.78, n);
  const fan = ring(m, add(front, V(-0.35, 0, 0)), V(1, 0, 0), r * 0.78, n);
  const outer = rings[0]!.ids;
  for (let j = 0; j < n; j++) {
    const k = (j + 1) % n;
    m.face([outer[j]!, outer[k]!, lip[k]!, lip[j]!], 'eng', { away: add(front, aft) });
    m.face([lip[j]!, lip[k]!, fan[k]!, fan[j]!], 'fan', { toward: add(front, V(-0.2, 0, 0)) });
  }
  m.face(fan, 'fan', { away: add(front, aft) });
  lathe(m, add(front, mul(aft, length)), aft, [[0, r * 0.62], [0.01, r * 0.4], [0.64 * r, r * 0.12]], n, 'fan', { end: 'fan' });
}

function propeller(m: Mesh, hub: Vec, radius: number, blades: number) {
  for (let b = 0; b < blades; b++) {
    const a = (2 * Math.PI * b) / blades + 0.3;
    const dir = V(0, Math.cos(a), Math.sin(a));
    const side = V(0, -Math.sin(a), Math.cos(a));
    const root = add(hub, mul(dir, 0.2));
    const tip = add(hub, mul(dir, radius));
    const twist = V(0.12, 0, 0);
    const q = [
      m.vert(add(root, mul(side, 0.16))),
      m.vert(add(add(tip, mul(side, 0.07)), twist)),
      m.vert(sub(add(tip, mul(side, -0.07)), twist)),
      m.vert(add(root, mul(side, -0.16))),
    ];
    // Two faces back to back, so one is always seen
    m.face(q, 'prop', { away: add(hub, V(-1, 0, 0)) });
    m.face([...q].reverse(), 'prop', { away: add(hub, V(1, 0, 0)) });
  }
}

function wheels(m: Mesh, x: number, z: number, ground: number, r: number, width: number, count = 2) {
  const gap = 0.12;
  const total = count * width + (count - 1) * gap;
  for (let i = 0; i < count; i++) {
    const z0 = z - total / 2 + i * (width + gap);
    lathe(m, V(x, ground + r, z0), V(0, 0, 1), [[0, r], [width, r]], 10, 'tyre', { start: 'hub', end: 'hub' });
  }
}

/* ---------- The fleet ---------- */

interface Spec {
  /** Length and fuselage radius, in metres. */
  L: number;
  R: number;
  nose: number;
  tail: number;
  span: number;
  /** Wing root leading edge (x), chords, sweep and dihedral in degrees, root height. */
  wingX: number;
  rootChord: number;
  tipChord: number;
  sweep: number;
  dihedral: number;
  wingY: number;
  highWing?: boolean;
  engines:
    | { kind: 'wing'; spanShare: number; r: number; length: number }
    | { kind: 'rear'; x: number; r: number; length: number }
    | { kind: 'prop'; spanShare: number; r: number; length: number; blade: number };
  fin: { h: number; rootChord: number; tipChord: number; sweep: number };
  tailplane: { span: number; rootChord: number; tipChord: number; sweep: number; tee?: boolean };
  winglet: number;
  mainBogies: number;
}

const FLEET: Record<Aircraft, Spec> = {
  // Long-haul twin
  wide: {
    L: 64, R: 2.95, nose: 7.5, tail: 15, span: 64,
    wingX: 37, rootChord: 12.5, tipChord: 2.6, sweep: 33, dihedral: 5.5, wingY: -0.55,
    engines: { kind: 'wing', spanShare: 0.33, r: 1.65, length: 6.4 },
    fin: { h: 9.5, rootChord: 9, tipChord: 3.6, sweep: 40 },
    tailplane: { span: 19.5, rootChord: 5.6, tipChord: 1.9, sweep: 34 },
    winglet: 3.4, mainBogies: 2,
  },
  // Single-aisle twin
  narrow: {
    L: 37.5, R: 2.0, nose: 5.2, tail: 10.5, span: 35.8,
    wingX: 21.2, rootChord: 6.9, tipChord: 1.6, sweep: 26, dihedral: 5.5, wingY: -0.55,
    engines: { kind: 'wing', spanShare: 0.32, r: 1.05, length: 4.3 },
    fin: { h: 6.0, rootChord: 6, tipChord: 2.6, sweep: 36 },
    tailplane: { span: 12.4, rootChord: 3.5, tipChord: 1.3, sweep: 30 },
    winglet: 2.3, mainBogies: 1,
  },
  // Regional jet: engines on the rear fuselage, T-tail
  rear: {
    L: 32.5, R: 1.45, nose: 4.0, tail: 9.0, span: 24,
    wingX: 17.5, rootChord: 5.0, tipChord: 1.3, sweep: 25, dihedral: 4, wingY: -0.6,
    engines: { kind: 'rear', x: 6.2, r: 0.82, length: 4.4 },
    fin: { h: 4.6, rootChord: 5.2, tipChord: 3.1, sweep: 38 },
    tailplane: { span: 8.8, rootChord: 2.6, tipChord: 1.3, sweep: 28, tee: true },
    winglet: 1.4, mainBogies: 1,
  },
  // Turboprop: high wing, T-tail
  prop: {
    L: 27.2, R: 1.4, nose: 3.4, tail: 8.0, span: 27,
    wingX: 15.6, rootChord: 2.6, tipChord: 1.45, sweep: 2, dihedral: 0.5, wingY: 1.1, highWing: true,
    engines: { kind: 'prop', spanShare: 0.3, r: 0.62, length: 5.6, blade: 1.95 },
    fin: { h: 4.6, rootChord: 4.4, tipChord: 2.1, sweep: 34 },
    tailplane: { span: 7.4, rootChord: 1.9, tipChord: 1.2, sweep: 10, tee: true },
    winglet: 0, mainBogies: 1,
  },
};

function build(type: Aircraft) {
  const T = FLEET[type];
  const m = new Mesh();
  const { L, R } = T;
  const body = fuselage(m, L, R, T.nose, T.tail);
  const semi = T.span / 2;
  const rootZ = T.highWing ? R * 0.5 : R * 0.78;
  const wingAt = (dz: number) => ({
    x: T.wingX - dz * Math.tan(rad(T.sweep)),
    y: T.wingY + dz * Math.tan(rad(T.dihedral)),
  });

  // Wings and winglets
  for (const side of [-1, 1]) {
    const sections: Section[] = Array.from({ length: 8 }, (_, i) => {
      const eta = i / 7;
      const dz = eta * (semi - rootZ);
      const chord = T.rootChord + (T.tipChord - T.rootChord) * eta ** 0.85;
      const at = wingAt(dz);
      return { le: V(at.x, at.y, side * (rootZ + dz)), chord, thickness: chord * (0.13 - 0.03 * eta), up: V(0, 1, 0) };
    });
    surface(m, sections, 'wing');
    if (T.winglet) {
      const tip = sections[sections.length - 1]!;
      const h = T.winglet;
      surface(
        m,
        [0, 0.5, 1].map((t) => ({
          le: add(tip.le, V(-t * h * 0.55 - 0.05, t * h, side * t * h * 0.22)),
          chord: tip.chord * (1 - t * 0.55) * 0.92,
          thickness: tip.chord * 0.12 * (1 - t * 0.4),
          up: V(0, -0.22 * side, side),
        })),
        'wlet',
      );
    }
  }

  // Fin and tailplane
  const finRootX = T.tail * 0.92;
  const fin: Section[] = Array.from({ length: 5 }, (_, i) => {
    const h = (i / 4) * T.fin.h;
    const chord = T.fin.rootChord + (T.fin.tipChord - T.fin.rootChord) * (i / 4);
    return { le: V(finRootX - h * Math.tan(rad(T.fin.sweep)), R * 0.82 + h, 0), chord, thickness: chord * 0.11, up: V(0, 0, 1) };
  });
  surface(m, fin, 'fin');
  const tp = T.tailplane;
  const tpY = tp.tee ? R * 0.82 + T.fin.h - 0.05 : body.profile(T.tail * 0.5).yc + 0.1;
  const tpRootZ = tp.tee ? 0.12 : body.profile(T.tail * 0.45).r * 0.8;
  const tpRootX = tp.tee ? fin[fin.length - 1]!.le.x + 0.2 : T.tail * 0.62;
  for (const side of [-1, 1]) {
    const sections: Section[] = Array.from({ length: 4 }, (_, i) => {
      const dz = (i / 3) * (tp.span / 2 - tpRootZ);
      const chord = tp.rootChord + (tp.tipChord - tp.rootChord) * (i / 3);
      return { le: V(tpRootX - dz * Math.tan(rad(tp.sweep)), tpY + dz * 0.08, side * (tpRootZ + dz)), chord, thickness: chord * 0.1, up: V(0, 1, 0) };
    });
    surface(m, sections, 'hstab');
  }

  // Engines
  const e = T.engines;
  let lowest = -R * 1.04;
  for (const side of [-1, 1]) {
    if (e.kind === 'wing') {
      const z = side * semi * e.spanShare;
      const at = wingAt(Math.abs(z) - rootZ);
      const front = V(at.x + e.length * 0.45, at.y - e.r * 1.35, z);
      nacelle(m, front, e.length, e.r);
      lowest = Math.min(lowest, front.y - e.r);
      box(m, [at.x - e.length * 0.55, at.x + 0.8], [front.y + e.r * 0.7, at.y - 0.05], [z - 0.18, z + 0.18], 'pylon', -0.6);
    } else if (e.kind === 'rear') {
      const z = side * (R + e.r + 0.45);
      const front = V(e.x + e.length, R * 0.42, z);
      nacelle(m, front, e.length, e.r);
      const zIn = side * R * 0.7, zOut = z - side * e.r * 0.8;
      box(m, [e.x + 0.6, e.x + e.length * 0.8], [front.y - 0.18, front.y + 0.18], [Math.min(zIn, zOut), Math.max(zIn, zOut)], 'pylon');
    } else {
      const front = V(T.wingX + 2.4, T.wingY - 0.35, side * semi * e.spanShare);
      lathe(m, front, V(-1, 0, 0), [[0, e.r * 0.7], [0.4, e.r], [2.2, e.r * 1.02], [e.length * 0.8, e.r * 0.7], [e.length, e.r * 0.3]], 14, 'eng', { end: 'eng' });
      lathe(m, add(front, V(0.9, 0, 0)), V(-1, 0, 0), [[0, 0.02], [0.45, e.r * 0.45], [0.9, e.r * 0.7]], 12, 'spinner');
      propeller(m, add(front, V(0.12, 0, 0)), e.blade, 6);
    }
  }

  // Landing gear, standing on the ground plane
  const ground = Math.min(lowest - (e.kind === 'wing' ? 0.55 : 0), -R - (T.highWing ? 1.0 : 1.75));
  const wheelR = Math.max(0.42, R * 0.24);
  const noseX = L - T.nose * 0.85;
  const mainX = T.wingX - T.rootChord * 0.62;
  box(m, [noseX - 0.08, noseX + 0.08], [ground + wheelR, -R * 0.75 + body.profile(noseX).yc], [-0.08, 0.08], 'gear');
  wheels(m, noseX, 0, ground, wheelR * 0.8, 0.3);
  for (const side of [-1, 1]) {
    const z = side * (T.highWing ? R * 1.05 : Math.max(R * 1.25, semi * 0.17));
    const top = T.highWing ? -R * 0.55 : T.wingY - 0.2;
    // A high-wing aircraft carries its main gear in fairings on the lower fuselage
    if (T.highWing) box(m, [mainX - 1.4, mainX + 1.4], [-R * 0.95, -R * 0.35], side < 0 ? [-R * 1.25, -R * 0.6] : [R * 0.6, R * 1.25], 'fus');
    box(m, [mainX - 0.1, mainX + 0.1], [ground + wheelR, top], [z - 0.1, z + 0.1], 'gear');
    for (let g = 0; g < T.mainBogies; g++) wheels(m, mainX - g * 1.6 + (T.mainBogies > 1 ? 0.8 : 0), z, ground, wheelR, 0.42);
  }

  // Cabin windows, cockpit panes and doors, as decals on the face beneath them
  const pitch = R > 2.5 ? 1.05 : 0.86;
  for (const th of [162, 18]) {
    for (let x = T.tail + 1.2; x < L - T.nose - 0.9; x += pitch) {
      if (Math.abs(x - (L - T.nose - 0.2)) < 1.2) continue;
      const pts = [body.skin(x - 0.13, th - 3.2), body.skin(x + 0.13, th - 3.2), body.skin(x + 0.13, th + 3.2), body.skin(x - 0.13, th + 3.2)];
      m.decals.push({ parent: body.faceAt(x, th), pts, part: 'win' });
    }
  }
  const cockpitX = L - T.nose * 0.48;
  for (const side of [-1, 1]) {
    for (let p = 0; p < 2; p++) {
      const t0 = 90 + side * (14 + p * 26), t1 = 90 + side * (36 + p * 26);
      const xa = cockpitX - p * 0.35, xb = cockpitX + 0.75 - p * 0.45;
      const pts = [body.skin(xa, t0, 0.04), body.skin(xa, t1, 0.04), body.skin(xb - 0.25, t1 + side * 4, 0.04), body.skin(xb, t0, 0.04)];
      m.decals.push({ parent: body.faceAt((xa + xb) / 2, (t0 + t1) / 2), pts, part: 'win' });
    }
  }
  for (const th of [180, 0]) {
    for (const dx of [L - T.nose - 0.7, T.tail + 0.8]) {
      const w = R > 2.5 ? 0.55 : 0.42;
      const pts = [body.skin(dx - w, th - 22), body.skin(dx + w, th - 22), body.skin(dx + w, th + 22), body.skin(dx - w, th + 22)];
      m.decals.push({ parent: body.faceAt(dx, th), pts, part: 'win', outline: true });
    }
  }

  return {
    m,
    ground,
    noseX,
    center: V(L / 2, 0, 0),
    size: Math.max(L, T.span),
    /** Centres of the port doors, on the skin: the side that faces the camera. */
    doors: { front: body.skin(L - T.nose - 0.7, 0, 0), aft: body.skin(T.tail + 0.8, 0, 0) },
    // Anti-collision beacon on the crown, ahead of the wing
    beacon: body.skin(T.wingX - T.rootChord * 0.3, 90, 0.12),
  };
}

/* ---------- Projection and painting ---------- */

/** Three-quarter view from above, nose towards the lower left. */
export function camera(azimuth = -48, elevation = 28) {
  const a = rad(azimuth), b = rad(elevation);
  const d = norm(V(Math.cos(b) * Math.cos(a), Math.sin(b), Math.cos(b) * Math.sin(a)));
  const r = norm(cross(V(0, 1, 0), d));
  return { d, r, u: norm(cross(d, r)) };
}

const fmt = (n: number) => String(Math.round(n * 10) / 10);

/** Integer path, relative after the first point: "M612 334l5-3l1 7z". */
function path(pts: Pt[], close = false) {
  const q = pts.map((p) => [Math.round(p.x), Math.round(p.y)] as const);
  let d = `M${q[0]![0]} ${q[0]![1]}`;
  for (let i = 1; i < q.length; i++) {
    const dx = q[i]![0] - q[i - 1]![0], dy = q[i]![1] - q[i - 1]![1];
    d += `l${dx}${dy < 0 ? '' : ' '}${dy}`;
  }
  return close ? `${d}z` : d;
}

const area2 = (p: Pt[]) => p.reduce((s, a, i) => {
  const b = p[(i + 1) % p.length]!;
  return s + a.x * b.y - b.x * a.y;
}, 0);

/** Sutherland–Hodgman: `subject` clipped by the convex polygon `clipper`. */
function clip(subject: Pt[], clipper: Pt[]) {
  const ccw = area2(clipper) > 0;
  let out = subject;
  for (let i = 0; i < clipper.length && out.length; i++) {
    const A = clipper[i]!, B = clipper[(i + 1) % clipper.length]!;
    const side = (p: Pt) => ((B.x - A.x) * (p.y - A.y) - (B.y - A.y) * (p.x - A.x)) * (ccw ? 1 : -1);
    const input = out;
    out = [];
    for (let j = 0; j < input.length; j++) {
      const P = input[j]!, Q = input[(j + 1) % input.length]!;
      const sp = side(P), sq = side(Q);
      if (sp >= 0) out.push(P);
      if (sp >= 0 !== sq >= 0) {
        const t = sp / (sp - sq);
        out.push({ x: P.x + (Q.x - P.x) * t, y: P.y + (Q.y - P.y) * t });
      }
    }
  }
  return out;
}

/**
 * Back-to-front order. Wherever two faces overlap on screen, the one nearer the camera at that
 * spot is painted later; centroid depth breaks ties and cycles.
 */
function paintOrder(ids: number[], polys: Screen[][], depth: number[]) {
  const items = ids.map((fi) => {
    const pts = polys[fi]!;
    let nx = 0, ny = 0, nz = 0;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]!, q = pts[(i + 1) % pts.length]!;
      nx += (p.y - q.y) * (p.z + q.z);
      ny += (p.z - q.z) * (p.x + q.x);
      nz += (p.x - q.x) * (p.y + q.y);
    }
    const c = mul(pts.reduce((s, p) => add(s, p), V(0, 0, 0)), 1 / pts.length);
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    return {
      fi,
      pts,
      // Depth of the face's plane at a screen point; null when the face is edge-on.
      depthAt: Math.abs(nz) < 1e-9 ? null : (x: number, y: number) => c.z - (nx * (x - c.x) + ny * (y - c.y)) / nz,
      bb: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] as const,
      area: Math.abs(area2(pts)) / 2,
    };
  });
  const n = items.length;
  const after: number[][] = Array.from({ length: n }, () => []);
  const indegree = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    const A = items[i]!;
    if (!A.depthAt || A.area < 0.05) continue;
    for (let j = i + 1; j < n; j++) {
      const B = items[j]!;
      if (!B.depthAt || B.area < 0.05) continue;
      if (A.bb[2] <= B.bb[0] || B.bb[2] <= A.bb[0] || A.bb[3] <= B.bb[1] || B.bb[3] <= A.bb[1]) continue;
      const overlap = clip(A.pts, B.pts);
      if (overlap.length < 3 || Math.abs(area2(overlap)) / 2 < 0.02) continue;
      const cx = overlap.reduce((s, p) => s + p.x, 0) / overlap.length;
      const cy = overlap.reduce((s, p) => s + p.y, 0) / overlap.length;
      const za = A.depthAt(cx, cy), zb = B.depthAt(cx, cy);
      if (Math.abs(za - zb) < 1e-4) continue;
      const [front, back] = za > zb ? [i, j] : [j, i];
      after[back]!.push(front);
      indegree[front]!++;
    }
  }
  const done = new Array<boolean>(n).fill(false);
  const order: number[] = [];
  const nearest = (ready: boolean) => {
    let pick = -1;
    for (let i = 0; i < n; i++) {
      if (done[i] || (ready && indegree[i] !== 0)) continue;
      if (pick < 0 || depth[items[i]!.fi]! < depth[items[pick]!.fi]!) pick = i;
    }
    return pick;
  };
  for (let step = 0; step < n; step++) {
    let pick = nearest(true);
    if (pick < 0) pick = nearest(false);
    done[pick] = true;
    order.push(items[pick]!.fi);
    for (const k of after[pick]!) indegree[k]!--;
  }
  return order;
}

export interface Drawing {
  /** Painted faces and stroked edges, as SVG markup. */
  body: string;
  ground: {
    shadow: string;
    /** The stand's dashed boundary (equipment restraint line). */
    box: string;
    leadIn: string;
    stopBar: string;
    /** Maps a unit circle onto the ground, for the floodlight pool. */
    poolMatrix: string;
    poolR: string;
    /** Maps text onto the ground, for the painted stand number. */
    numberMatrix: string;
    numberSize: string;
  };
  beacon: { x: string; y: string };
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

function draw(type: Aircraft): Drawing {
  const P = build(type);
  const { m } = P;
  const cam = camera();
  // Every aircraft is scaled towards a common size, keeping a hint of the real difference.
  const k = (20 * 46) / P.size ** 0.78 / 46 ** 0.22;
  const project = (p: Vec): Screen => {
    const q = sub(p, P.center);
    return { x: dot(q, cam.r) * k, y: -dot(q, cam.u) * k, z: dot(q, cam.d) };
  };
  const pv = m.v.map(project);

  const normals = m.f.map((f) => {
    const pts = f.idx.map((i) => m.v[i]!);
    let n = V(0, 0, 0);
    pts.forEach((a, i) => {
      const b = pts[(i + 1) % pts.length]!;
      n = add(n, V((a.y - b.y) * (a.z + b.z), (a.z - b.z) * (a.x + b.x), (a.x - b.x) * (a.y + b.y)));
    });
    n = norm(n);
    const c = mul(pts.reduce((s, p) => add(s, p), V(0, 0, 0)), 1 / pts.length);
    if (f.away && dot(n, sub(c, f.away)) < 0) n = mul(n, -1);
    if (f.toward && dot(n, sub(f.toward, c)) < 0) n = mul(n, -1);
    return { n, c };
  });
  const visible = normals.map(({ n }) => dot(n, cam.d) > 1e-4);
  const depth = normals.map(({ c }) => dot(sub(c, P.center), cam.d));

  const edges = new Map<string, number[]>();
  const key = (a: number, b: number) => (a < b ? `${a}_${b}` : `${b}_${a}`);
  m.f.forEach((f, fi) =>
    f.idx.forEach((a, i) => {
      const k2 = key(a, f.idx[(i + 1) % f.idx.length]!);
      edges.set(k2, [...(edges.get(k2) ?? []), fi]);
    }),
  );
  const polys = m.f.map((f) => f.idx.map((i) => pv[i]!));
  const order = paintOrder(m.f.map((_, i) => i).filter((i) => visible[i]), polys, depth);
  const rank = new Map(order.map((fi, r) => [fi, r]));
  const creaseCos = Math.cos(rad(34));
  const decals = new Map<number, Decal[]>();
  for (const d of m.decals) decals.set(d.parent, [...(decals.get(d.parent) ?? []), d]);

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const grow = (p: Pt) => {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  };

  const out: string[] = [];
  for (const fi of order) {
    const f = m.f[fi]!;
    const pts = polys[fi]!;
    pts.forEach(grow);
    out.push(`<path class="f-${f.part}" d="${path(pts, true)}"/>`);
    const strokes: Record<'s' | 'c' | 'm', string[]> = { s: [], c: [], m: [] };
    f.idx.forEach((a, i) => {
      const b = f.idx[(i + 1) % f.idx.length]!;
      const others = edges.get(key(a, b))!.filter((x) => x !== fi);
      let kind: 's' | 'c' | 'm' | null = null;
      if (others.length === 0 || others.some((x) => !visible[x])) kind = 's';
      else {
        if (others.some((x) => dot(normals[x]!.n, normals[fi]!.n) < creaseCos)) kind = 'c';
        else if (others.some((x) => m.f[x]!.part !== f.part)) kind = 'm';
        // A shared edge is drawn with whichever neighbour is painted last.
        if (kind && others.some((x) => rank.get(x)! > rank.get(fi)!)) kind = null;
      }
      if (kind) strokes[kind].push(path([pv[a]!, pv[b]!]));
    });
    for (const kind of ['m', 'c', 's'] as const) {
      if (strokes[kind].length) out.push(`<path class="e-${kind}" d="${strokes[kind].join('')}"/>`);
    }
    for (const d of decals.get(fi) ?? []) {
      out.push(`<path class="${d.outline ? 'e-d' : `f-${d.part}`}" d="${path(d.pts.map(project), true)}"/>`);
    }
  }

  // The ground plane: shadow, stand markings, floodlight pool and painted number
  const g = P.ground;
  const onGround = (x: number, z: number) => project(V(x, g, z));
  const shadow = m.f
    .filter((_, fi) => normals[fi]!.n.y < -0.25)
    .map((f) =>
      path(
        f.idx.map((i) => {
          const p = m.v[i]!;
          const h = p.y - g;
          return onGround(p.x - h * 0.35, p.z + h * 0.25);
        }),
        true,
      ),
    )
    .join('');

  const half = P.size * 0.5;
  const cx = P.center.x;
  const corners = [onGround(cx - half, -half), onGround(cx + half, -half), onGround(cx + half, half), onGround(cx - half, half)];
  corners.forEach(grow);
  const o = onGround(0, 0), ex = onGround(1, 0), ez = onGround(0, 1), centre = onGround(cx, 0);
  const numberAt = V(P.noseX + 0.27 * P.size, g, 0);
  const nO = project(numberAt), nX = project(add(numberAt, V(0, 0, -1))), nY = project(add(numberAt, V(-1, 0, 0)));
  const beacon = project(P.beacon);

  return {
    body: out.join(''),
    ground: {
      shadow,
      box: path(corners, true),
      leadIn: path([onGround(cx - half, 0), onGround(P.noseX + 0.15 * P.size, 0)]),
      stopBar: path([onGround(P.noseX, -P.size * 0.045), onGround(P.noseX, P.size * 0.045)]),
      poolMatrix: [ex.x - o.x, ex.y - o.y, ez.x - o.x, ez.y - o.y, centre.x, centre.y].map(fmt).join(' '),
      poolR: fmt(P.size * 0.62),
      // Text runs to port (screen right) and stands up towards the tail, so it reads from the viewer.
      numberMatrix: [nX.x - nO.x, nX.y - nO.y, -(nY.x - nO.x), -(nY.y - nO.y), nO.x, nO.y].map(fmt).join(' '),
      numberSize: fmt(P.size * 0.16),
    },
    beacon: { x: fmt(beacon.x), y: fmt(beacon.y) },
    bounds: { minX, minY, maxX, maxY },
  };
}

// Drawing is the slow part of the build, so each aircraft is drawn once.
const drawings = new Map<Aircraft, Drawing>();
export function drawAircraft(type: Aircraft) {
  if (!drawings.has(type)) drawings.set(type, draw(type));
  return drawings.get(type)!;
}

/**
 * Where scenery can meet an aircraft, in its own metres: its port doors, the nose wheel's x and the
 * ground. For the terminal scene's jet bridges (terminal.ts). Builds the mesh but doesn't paint it.
 */
export function aircraftFrame(type: Aircraft) {
  const { doors, noseX, ground } = build(type);
  return { doors, noseX, ground };
}

/** One viewBox for every stand, so stands line up in a grid whatever is parked on them. */
export function standViewBox() {
  const pad = 16;
  const b = AIRCRAFT.map((t) => drawAircraft(t).bounds).reduce((u, x) => ({
    minX: Math.min(u.minX, x.minX),
    minY: Math.min(u.minY, x.minY),
    maxX: Math.max(u.maxX, x.maxX),
    maxY: Math.max(u.maxY, x.maxY),
  }));
  return [b.minX - pad, b.minY - pad, b.maxX - b.minX + 2 * pad, b.maxY - b.minY + 2 * pad].map(Math.round).join(' ');
}
