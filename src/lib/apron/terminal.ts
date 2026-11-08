/**
 * The terminal: the home page's Selected work as one apron scene (Terminal.astro). Every
 * project's plane parks nose-in at a numbered stand along a plain terminal pier, and a control
 * tower behind the last stands turns a radar antenna on its roof. The apron is left bare so that
 * the planes, and the gate signs beside their tails, are all there is to read.
 *
 * Drawn at build time with the fleet's camera (planes.ts), so the scene and the planes share one
 * projection. Scene units are the planes' drawing units, so a plane drops in with a translation.
 * The scenery is modelled in "u", the single-aisle's metres, which puts it at the fleet's scale.
 * Every solid is convex, so a solid paints only the faces turned to the camera, and solids paint
 * back to front in the order they're listed. Nothing is coloured here: classes t-* (scenery fills)
 * and e-* (edges, as on the planes) are styled by apron.css and terminal.css.
 *
 * Only the antenna moves. Its faces are drawn flat and terminal.css turns them: each face gets a
 * matrix() of cos and sin of one animated angle, which is the same projection, done in CSS.
 */
import { camera, drawAircraft, standViewBox, type Aircraft } from './planes';

interface Vec {
  x: number;
  y: number;
  z: number;
}
interface Pt {
  x: number;
  y: number;
}
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const V = (x: number, y: number, z: number): Vec => ({ x, y, z });
const add = (a: Vec, b: Vec) => V(a.x + b.x, a.y + b.y, a.z + b.z);
const sub = (a: Vec, b: Vec) => V(a.x - b.x, a.y - b.y, a.z - b.z);
const mul = (a: Vec, k: number) => V(a.x * k, a.y * k, a.z * k);
const dot = (a: Vec, b: Vec) => a.x * b.x + a.y * b.y + a.z * b.z;
const norm = (a: Vec) => mul(a, 1 / (Math.hypot(a.x, a.y, a.z) || 1));
const rad = (deg: number) => (deg * Math.PI) / 180;

const cam = camera();
const ELEVATION = Math.asin(cam.d.y);

/** Drawing units per metre of an aircraft, read off its floodlight matrix (world x on screen). */
function scaleOf(type: Aircraft) {
  const [a, b] = drawAircraft(type).ground.poolMatrix.split(' ').map(Number);
  return Math.hypot(a!, b!) / Math.hypot(cam.r.x, cam.u.x);
}
/** Drawing units per u. */
const K = scaleOf('narrow');

const project = (p: Vec): Pt => ({ x: dot(p, cam.r) * K, y: -dot(p, cam.u) * K });

const r1 = (n: number) => Math.round(n * 10) / 10;
function path(pts: Pt[], close = false) {
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${r1(p.x)} ${r1(p.y)}`).join('');
  return close ? `${d}Z` : d;
}

/* ---------- Scenery: convex solids ---------- */

type Skin = 'wall' | 'roof' | 'glass' | 'cab' | 'concrete' | 'livery';

interface Solid {
  faces: { pts: Vec[]; skin: Skin }[];
  centre: Vec;
  /** Stroke the seams between neighbouring visible faces that don't crease, in this class. */
  seams?: string;
}

function box([x0, x1]: [number, number], [y0, y1]: [number, number], [z0, z1]: [number, number], skin: Skin, top: Skin = skin): Solid {
  const p = (x: number, y: number, z: number) => V(x, y, z);
  const [a, b, c, d] = [p(x0, y0, z0), p(x1, y0, z0), p(x1, y0, z1), p(x0, y0, z1)];
  const [e, f, g, h] = [p(x0, y1, z0), p(x1, y1, z0), p(x1, y1, z1), p(x0, y1, z1)];
  return {
    centre: V((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2),
    faces: [
      { pts: [a, b, c, d], skin },
      { pts: [e, h, g, f], skin: top },
      { pts: [a, e, f, b], skin },
      { pts: [b, f, g, c], skin },
      { pts: [c, g, h, d], skin },
      { pts: [d, h, e, a], skin },
    ],
  };
}

/** A vertical n-sided frustum: radius r0 at y0, r1 at y1. */
function prism(c: Pt, [r0, r1]: [number, number], [y0, y1]: [number, number], skin: Skin, n = 18, cap: Skin = 'roof'): Solid {
  const ring = (r: number, y: number) =>
    Array.from({ length: n }, (_, j) => {
      const t = (2 * Math.PI * j) / n;
      return V(c.x + r * Math.cos(t), y, c.y + r * Math.sin(t));
    });
  const lo = ring(r0, y0), hi = ring(r1, y1);
  return {
    centre: V(c.x, (y0 + y1) / 2, c.y),
    faces: [
      ...lo.map((_, j) => ({ pts: [lo[j]!, lo[(j + 1) % n]!, hi[(j + 1) % n]!, hi[j]!], skin })),
      { pts: hi, skin: cap },
      { pts: [...lo].reverse(), skin: cap },
    ],
  };
}

function newell(pts: Vec[]) {
  let n = V(0, 0, 0);
  pts.forEach((a, i) => {
    const b = pts[(i + 1) % pts.length]!;
    n = add(n, V((a.y - b.y) * (a.z + b.z), (a.z - b.z) * (a.x + b.x), (a.x - b.x) * (a.y + b.y)));
  });
  return norm(n);
}

const creaseCos = Math.cos(rad(34));

function paint(solids: Solid[]) {
  const out: string[] = [];
  for (const s of solids) {
    const info = s.faces.map((f) => {
      let n = newell(f.pts);
      const c = mul(f.pts.reduce((sum, p) => add(sum, p), V(0, 0, 0)), 1 / f.pts.length);
      if (dot(n, sub(c, s.centre)) < 0) n = mul(n, -1);
      return { n, visible: dot(n, cam.d) > 1e-6 };
    });
    const key = (p: Vec) => `${p.x.toFixed(3)},${p.y.toFixed(3)},${p.z.toFixed(3)}`;
    const edgeKey = (a: Vec, b: Vec) => [key(a), key(b)].sort().join('|');
    const edges = new Map<string, number[]>();
    s.faces.forEach((f, fi) =>
      f.pts.forEach((a, i) => {
        const k = edgeKey(a, f.pts[(i + 1) % f.pts.length]!);
        edges.set(k, [...(edges.get(k) ?? []), fi]);
      }),
    );
    const strokes = { s: [] as string[], c: [] as string[], seam: [] as string[] };
    s.faces.forEach((f, fi) => {
      if (!info[fi]!.visible) return;
      out.push(`<path class="t-${f.skin}" d="${path(f.pts.map(project), true)}"/>`);
      f.pts.forEach((a, i) => {
        const b = f.pts[(i + 1) % f.pts.length]!;
        const others = edges.get(edgeKey(a, b))!.filter((x) => x !== fi);
        const seg = path([project(a), project(b)]);
        if (!others.length || others.some((x) => !info[x]!.visible)) strokes.s.push(seg);
        else if (others.every((x) => x > fi)) {
          if (others.some((x) => dot(info[x]!.n, info[fi]!.n) < creaseCos)) strokes.c.push(seg);
          else if (s.seams) strokes.seam.push(seg);
        }
      });
    });
    if (strokes.seam.length) out.push(`<path class="${s.seams}" d="${strokes.seam.join('')}"/>`);
    if (strokes.c.length) out.push(`<path class="e-c" d="${strokes.c.join('')}"/>`);
    if (strokes.s.length) out.push(`<path class="e-s" d="${strokes.s.join('')}"/>`);
  }
  return out.join('');
}

/* ---------- Reading the planes' drawings ---------- */

/** Every point of a drawing's paths (planes.ts writes "M612 334l5-3l1 7z"). */
function points(markup: string) {
  const pts: Pt[] = [];
  for (const [, d] of markup.matchAll(/d="([^"]+)"/g)) {
    const tokens = d!.match(/[Mlz]|-?\d+(?:\.\d+)?/g) ?? [];
    let at: Pt = { x: 0, y: 0 };
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i]!;
      if (t === 'M') at = { x: +tokens[++i]!, y: +tokens[++i]! };
      else if (t === 'l') at = { x: at.x + +tokens[++i]!, y: at.y + +tokens[++i]! };
      else continue;
      pts.push(at);
    }
  }
  return pts;
}

/** Andrew's monotone chain. */
function hull(pts: Pt[]) {
  const p = [...pts].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const half = (list: Pt[]) => {
    const h: Pt[] = [];
    for (const q of list) {
      while (h.length >= 2 && cross(h[h.length - 2]!, h[h.length - 1]!, q) <= 0) h.pop();
      h.push(q);
    }
    h.pop();
    return h;
  };
  return [...half(p), ...half([...p].reverse())];
}

/* ---------- The scene ---------- */

// Along the stands (z) and across them (x), in u. Stand 01 is furthest back, at the top left; the
// rest come forward to the bottom right. The planes park nose-in at a pier that runs along their
// noses, between them and the camera: the nose wheel stops on x = 0, and the pier's airside face
// stands far enough out that the pier hides none of a plane. The apron reaches back past the tails
// to where a taxilane would run; nothing is drawn there, it only frames the scene.
const PITCH = 44;
const PIER = 14; // airside face
const DEPTH = 20;
const HEIGHT = 9;
const TAXILANE = -56;
/** How far down the plane's outline its sign sits, level with the tail: a share of the outline's height. */
const SIGN_AT = 0.3;

/** The radar antenna: a reflector with the long secondary-radar bar ("the stick") on top. */
const ANTENNA = {
  reflector: { w: 8.5, t: 0.7, h: 2.6 },
  stick: { w: 13, t: 0.55, h: 0.8 },
};

export interface SceneStand {
  /** Where the plane's drawing goes, as a share of the scene. Its viewBox is standViewBox(). */
  plane: Box;
  /** Moves the drawing's own coordinates into the scene. */
  translate: Pt;
  /** The plane's outline, for hit testing and for the peek to sit beside: a box in the scene, and a
   *  polygon in shares of that box. */
  hit: Box;
  hull: string;
  /** Where the gate sign starts: the plane's right edge, level with its tail. A share of the scene. */
  sign: Pt;
}

export interface Scene {
  viewBox: string;
  aspect: number;
  stands: SceneStand[];
  building: string;
  tower: string;
  antenna: {
    box: Box;
    viewBox: string;
    /** Each face: a rectangle in its own plane, the matrix() terms that turn it, and when it shows. */
    faces: { d: string; skin: Skin; transform: string; show: string }[];
  };
}

export function terminalScene(fleet: Aircraft[]): Scene {
  const n = fleet.length;
  const zOf = (i: number) => -i * PITCH;
  const zBack = zOf(0) + PITCH / 2 + 8;
  const zFront = zOf(n - 1) - PITCH / 2 - 8;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const grow = (p: Pt) => {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  };
  const onGround = (x: number, z: number) => {
    const p = project(V(x, 0, z));
    grow(p);
    return p;
  };

  // The apron itself is left bare: no stand boxes, lead-ins or taxilane, so nothing but the planes
  // carries a line. Its extent still frames the scene, which keeps room behind the tails for the
  // gate signs.
  for (const z of [zBack, zFront]) for (const x of [TAXILANE, PIER]) onGround(x, z);

  // The terminal: a plain block along the noses, its landside (facing the camera) in glass
  const main = box([PIER, PIER + DEPTH], [0, HEIGHT], [zFront, zBack], 'wall', 'roof');
  main.faces[3]!.skin = 'glass';
  const building = paint([main]);
  [V(PIER, HEIGHT, zBack), V(PIER + DEPTH, 0, zFront), V(PIER + DEPTH, 0, zBack), V(PIER, 0, zFront)].forEach((p) => grow(project(p)));

  // The control tower stands well back behind the last two stands, rising into the empty corner
  // behind the row, above the gate signs, so a long title never runs into it
  const at: Pt = { x: -80, y: zOf(n - 1) + PITCH * 0.45 };
  const levels = { shaft: 34, flare: 36.5, deck: 39, cab: 44, roof: 45, top: 45.7, pedestal: 48.2, turntable: 49.1 };
  const cab = prism(at, [5.8, 7.1], [levels.deck, levels.cab], 'cab');
  cab.seams = 'e-g';
  const tower = paint([
    prism(at, [3.3, 3.3], [0, levels.shaft], 'concrete'),
    prism(at, [3.3, 5.6], [levels.shaft, levels.flare], 'concrete'),
    prism(at, [5.6, 5.6], [levels.flare, levels.deck], 'wall'),
    cab,
    prism(at, [7.7, 7.7], [levels.cab, levels.roof], 'wall'),
    prism(at, [5, 5], [levels.roof, levels.top], 'wall'),
    prism(at, [0.8, 0.8], [levels.top, levels.pedestal], 'wall', 10),
    prism(at, [1.4, 1.4], [levels.pedestal, levels.turntable], 'wall', 12),
  ]);
  // Frame the whole tower: its widest ring at the foot and at the cab, and the antenna's sweep
  for (const [dx, dz] of [[-8, -8], [-8, 8], [8, -8], [8, 8]] as const)
    for (const y of [0, levels.roof]) grow(project(V(at.x + dx, y, at.y + dz)));
  grow(project(V(at.x, levels.turntable + 6, at.y)));

  // The antenna turns about the turntable's axis. Its SVG has its own viewBox in u, centred on the
  // axis at the turntable's top, so the CSS matrices need no scale.
  const axis = project(V(at.x, levels.turntable, at.y));
  const sinE = Math.sin(ELEVATION), cosE = Math.cos(ELEVATION);
  const reach = ANTENNA.stick.w / 2 + 1;
  const rise = (ANTENNA.reflector.h + ANTENNA.stick.h) * cosE + reach * sinE + 1;
  const drop = reach * sinE + 1;
  const antennaVB = { x: -reach, y: -rise, w: 2 * reach, h: rise + drop };
  const c = 'var(--ac)', s = 'var(--as)';
  const n4 = (v: number) => String(Math.round(v * 10000) / 10000);
  const faces: Scene['antenna']['faces'] = [];
  let h0 = 0;
  for (const part of [ANTENNA.reflector, ANTENNA.stick]) {
    const { w, t, h } = part;
    const h1 = h0 + h;
    const rect = (a0: number, a1: number, b0: number, b1: number) => `M${n4(a0)} ${n4(b0)}H${n4(a1)}V${n4(b1)}H${n4(a0)}Z`;
    // Plan axes relative to the camera: right, and away into the picture. f is where the antenna
    // faces, at the animated angle; the long side runs across it.
    const along = `calc(-1 * ${s}), calc(${n4(-sinE)} * ${c})`; // the long side, per u
    const facing = `${c}, calc(${n4(-sinE)} * ${s})`; // the facing direction, per u
    const up = `0, ${n4(-cosE)}`;
    faces.push(
      // Back and front: long side × height, pushed out along the facing direction. The reflector's
      // face is in the livery, so it flashes orange each time it sweeps past.
      { d: rect(-w / 2, w / 2, h0, h1), skin: 'wall', transform: `matrix(${along}, ${up}, calc(${n4(-t / 2)} * ${c}), calc(${n4((sinE * t) / 2)} * ${s}))`, show: `clamp(0, calc(${s} * 400), 1)` },
      { d: rect(-w / 2, w / 2, h0, h1), skin: part === ANTENNA.reflector ? 'livery' : 'wall', transform: `matrix(${along}, ${up}, calc(${n4(t / 2)} * ${c}), calc(${n4((-sinE * t) / 2)} * ${s}))`, show: `clamp(0, calc(${s} * -400), 1)` },
      // Ends: thickness × height, at either end of the long side
      { d: rect(-t / 2, t / 2, h0, h1), skin: 'wall', transform: `matrix(${facing}, ${up}, calc(${n4(-w / 2)} * ${s}), calc(${n4((-sinE * w) / 2)} * ${c}))`, show: `clamp(0, calc(${c} * -400), 1)` },
      { d: rect(-t / 2, t / 2, h0, h1), skin: 'wall', transform: `matrix(${facing}, ${up}, calc(${n4(w / 2)} * ${s}), calc(${n4((sinE * w) / 2)} * ${c}))`, show: `clamp(0, calc(${c} * 400), 1)` },
      // Top: long side × thickness, lifted to the top of the part
      { d: rect(-w / 2, w / 2, -t / 2, t / 2), skin: 'roof', transform: `matrix(${along}, ${facing}, 0, ${n4(-cosE * h1)})`, show: '1' },
    );
    h0 = h1;
  }

  // Planes: each drawing moves so its nose wheel stops on its stand's stop bar
  const [vx, vy, vw, vh] = standViewBox().split(' ').map(Number) as [number, number, number, number];
  const raw = fleet.map((type, i) => {
    const d = drawAircraft(type);
    const [x0, y0, dx, dy] = d.ground.stopBar.match(/-?\d+/g)!.map(Number) as [number, number, number, number];
    const stop = project(V(0, 0, zOf(i)));
    const translate = { x: stop.x - (x0 + dx / 2), y: stop.y - (y0 + dy / 2) };
    const outline = hull([...points(d.body), { x: +d.beacon.x, y: +d.beacon.y }].map((p) => ({ x: p.x + translate.x, y: p.y + translate.y })));
    outline.forEach(grow);
    return { translate, outline };
  });

  const pad = 5 * K;
  minX -= pad;
  minY -= pad;
  maxX += pad;
  maxY += pad;
  const W = maxX - minX, H = maxY - minY;
  const share = (b: Box): Box => ({ x: ((b.x - minX) / W) * 100, y: ((b.y - minY) / H) * 100, w: (b.w / W) * 100, h: (b.h / H) * 100 });

  const stands: SceneStand[] = raw.map(({ translate, outline }) => {
    const xs = outline.map((p) => p.x), ys = outline.map((p) => p.y);
    const hb = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
    // The sign stands on the open apron just past the tail, where nothing else is drawn, so each
    // name sits beside its own plane
    const sign = { x: hb.x + hb.w, y: hb.y + hb.h * SIGN_AT };
    return {
      plane: share({ x: translate.x + vx, y: translate.y + vy, w: vw, h: vh }),
      translate,
      hit: share(hb),
      hull: `polygon(${outline.map((p) => `${r1(((p.x - hb.x) / hb.w) * 100)}% ${r1(((p.y - hb.y) / hb.h) * 100)}%`).join(', ')})`,
      sign: { x: ((sign.x - minX) / W) * 100, y: ((sign.y - minY) / H) * 100 },
    };
  });

  return {
    viewBox: [minX, minY, W, H].map(r1).join(' '),
    aspect: W / H,
    stands,
    building,
    tower,
    antenna: {
      box: share({ x: axis.x + antennaVB.x * K, y: axis.y + antennaVB.y * K, w: antennaVB.w * K, h: antennaVB.h * K }),
      viewBox: [antennaVB.x, antennaVB.y, antennaVB.w, antennaVB.h].map(n4).join(' '),
      faces,
    },
  };
}
