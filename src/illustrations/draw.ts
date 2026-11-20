import {
  BONES,
  add,
  along,
  buildSkeleton,
  lerpPose,
  solveTwoBone,
  type Focus,
  type FrontPose,
  type Illustration,
  type Prop,
  type Pt,
  type Skeleton,
} from './skeleton';

/**
 * Convierte un ejercicio y un instante (0 = inicio, 1 = final) en formas planas.
 * No depende de React: la app las pinta con react-native-svg y los tests o una vista previa con SVG normal.
 */
export type Shape =
  | { k: 'capsule'; a: Pt; b: Pt; ra: number; rb: number; fill: string; outline?: boolean }
  | { k: 'circle'; c: Pt; r: number; fill: string; opacity?: number; outline?: boolean }
  | { k: 'ellipse'; c: Pt; rx: number; ry: number; fill: string; opacity?: number }
  | { k: 'line'; a: Pt; b: Pt; stroke: string; width: number }
  | { k: 'rect'; x: number; y: number; w: number; h: number; r: number; fill: string };

export const VIEW = { w: 200, h: 210 } as const;

export const INK = {
  panel: '#14161A',
  floor: '#2E333C',
  ghost: '#23272E',
  far: '#5D636F',
  near: '#E6E9EE',
  torso: '#CBD0D8',
  accent: '#FF6B35',
  accentFar: '#9C4424',
  metal: '#9AA1AD',
  metalDark: '#4A505B',
  pack: '#4F7BD9',
  packDark: '#3558A8',
  towel: '#D8C9A8',
} as const;

interface Palette {
  near: string;
  torso: string;
  far: string;
  accent: string;
  accentFar: string;
  outline: boolean;
}

const LIVE: Palette = { near: INK.near, torso: INK.torso, far: INK.far, accent: INK.accent, accentFar: INK.accentFar, outline: true };
const GHOST: Palette = { near: INK.ghost, torso: INK.ghost, far: INK.ghost, accent: INK.ghost, accentFar: INK.ghost, outline: false };

function limb(a: Pt, b: Pt, ra: number, rb: number, fill: string, outline: boolean): Shape {
  return { k: 'capsule', a, b, ra, rb, fill, outline };
}

/** Cuerpo completo en vista lateral, de atrás hacia delante. */
function body(sk: Skeleton, ill: Illustration, p: Palette): Shape[] {
  const has = (f: Focus) => ill.focus.includes(f);
  const o = p.outline;
  const upperFar = ill.bothArms && has('upperArm') ? p.accentFar : p.far;
  const foreFar = ill.bothArms && has('forearm') ? p.accentFar : p.far;
  const upper = has('upperArm') ? p.accent : p.near;
  const fore = has('forearm') ? p.accent : p.near;
  const thigh = has('thigh') ? p.accent : p.near;
  const shin = has('shin') ? p.accent : p.near;
  const out: Shape[] = [];

  // Lado lejano
  out.push(limb(sk.hip, sk.farKnee, 7.5, 6, p.far, false));
  out.push(limb(sk.farKnee, sk.farFoot, 5.5, 4, p.far, false));
  out.push(limb(sk.farFoot, sk.farToe, 3.6, 3, p.far, false));
  out.push(limb(add(sk.neck, [2, -1]), sk.farElbow, 6, 5, upperFar, false));
  out.push(limb(sk.farElbow, sk.farHand, 4.6, 3.8, foreFar, false));
  out.push({ k: 'circle', c: sk.farHand, r: 4.2, fill: foreFar });

  // Pierna cercana
  out.push(limb(sk.hip, sk.knee, 8.2, 6.4, thigh, o));
  out.push(limb(sk.knee, sk.foot, 6, 4.4, shin, o));
  out.push(limb(sk.foot, sk.toe, 3.9, 3.2, p.near, o));

  // Tronco, cuello y cabeza
  out.push(limb(sk.hip, sk.neck, 8.8, 10.8, p.torso, o));
  if (has('chest')) out.push(limb(add(along(sk.neck, sk.u, -7), [sk.n[0] * 4.5, sk.n[1] * 4.5]), add(along(sk.neck, sk.u, -21), [sk.n[0] * 4.5, sk.n[1] * 4.5]), 5.4, 4.4, p.accent, false));
  if (has('back')) out.push(limb(add(along(sk.neck, sk.u, -8), [sk.n[0] * -4.5, sk.n[1] * -4.5]), add(along(sk.neck, sk.u, -30), [sk.n[0] * -3.5, sk.n[1] * -3.5]), 5.2, 4, p.accent, false));
  if (has('glute')) out.push({ k: 'circle', c: add(sk.hip, [sk.n[0] * -2, sk.n[1] * -2]), r: 8.4, fill: p.accent, outline: o });
  out.push(limb(sk.neck, sk.head, 4.6, 4.6, p.near, false));
  out.push({ k: 'circle', c: sk.head, r: 9.6, fill: p.near, outline: o });

  // Brazo cercano
  if (has('shoulder')) out.push({ k: 'circle', c: sk.neck, r: 7.6, fill: p.accent, outline: o });
  out.push(limb(sk.neck, sk.elbow, 6.6, 5.4, upper, o));
  out.push(limb(sk.elbow, sk.hand, 5, 4.1, fore, o));
  if (sk.handTip) out.push(limb(sk.hand, sk.handTip, 4, 3.4, fore, o));
  else out.push({ k: 'circle', c: sk.hand, r: 4.6, fill: fore, outline: o });
  return out;
}

function held(sk: Skeleton, ill: Illustration): Shape[] {
  const at = sk.handTip ?? sk.hand;
  const out: Shape[] = [];
  if (ill.towelTo) {
    const to = ill.towelTo === 'foot' ? sk.foot : ill.towelTo === 'farHand' ? sk.farHand : ill.towelTo;
    out.push({ k: 'line', a: at, b: to, stroke: INK.towel, width: 4 });
  }
  if (ill.held === 'dumbbell') {
    out.push({ k: 'circle', c: at, r: 8, fill: INK.metal, outline: true });
    out.push({ k: 'circle', c: at, r: 2.8, fill: INK.metalDark });
  }
  if (ill.held === 'backpack') {
    out.push({ k: 'line', a: at, b: [at[0], at[1] + 8], stroke: INK.packDark, width: 2.5 });
    out.push({ k: 'rect', x: at[0] - 10, y: at[1] + 6, w: 20, h: 24, r: 6, fill: INK.pack });
    out.push({ k: 'rect', x: at[0] - 6, y: at[1] + 17, w: 12, h: 9, r: 3, fill: INK.packDark });
  }
  return out;
}

function props(list: Prop[]): Shape[] {
  const out: Shape[] = [];
  for (const p of list) {
    if (p.kind === 'floor') {
      out.push({ k: 'line', a: [10, p.y], b: [VIEW.w - 10, p.y], stroke: INK.floor, width: 2.5 });
    } else if (p.kind === 'bar') {
      out.push({ k: 'line', a: [p.x - 34, 6], b: [p.x + 34, 6], stroke: INK.metalDark, width: 4 });
      out.push({ k: 'line', a: [p.x, 6], b: [p.x, p.y], stroke: INK.metalDark, width: 3 });
      out.push({ k: 'circle', c: [p.x, p.y], r: 4.5, fill: INK.metal });
    } else if (p.kind === 'bench') {
      out.push({ k: 'line', a: [p.x + 6, p.y + 4], b: [p.x + 3, p.y + p.h], stroke: INK.metalDark, width: 4 });
      out.push({ k: 'line', a: [p.x + p.w - 6, p.y + 4], b: [p.x + p.w - 3, p.y + p.h], stroke: INK.metalDark, width: 4 });
      out.push({ k: 'rect', x: p.x, y: p.y, w: p.w, h: 7, r: 3.5, fill: INK.far });
    } else if (p.kind === 'wall') {
      out.push({ k: 'rect', x: p.x, y: 14, w: 9, h: 186, r: 2, fill: INK.metalDark });
    } else {
      out.push({ k: 'rect', x: p.x, y: 14, w: 9, h: 186, r: 2, fill: INK.metalDark });
      out.push({ k: 'circle', c: [p.x - 3, p.knobY], r: 4, fill: INK.metal });
    }
  }
  return out;
}

// ---------- Vista frontal (aperturas) ----------

function frontBody(angleDeg: number, ill: Illustration, p: Palette, withHeld: boolean): Shape[] {
  const o = p.outline;
  const ang = (angleDeg * Math.PI) / 180;
  const sh: [Pt, Pt] = [
    [84, 86],
    [116, 86],
  ];
  const out: Shape[] = [];
  out.push(limb([93, 130], [89, 166], 8.2, 6.4, p.near, o), limb([89, 166], [89, 196], 6, 4.4, p.near, o));
  out.push(limb([107, 130], [111, 166], 8.2, 6.4, p.near, o), limb([111, 166], [111, 196], 6, 4.4, p.near, o));
  out.push(limb([100, 128], [100, 92], 11.5, 13.5, p.torso, o));
  out.push(limb(sh[0], sh[1], 8.5, 8.5, p.torso, false));
  out.push(limb([100, 80], [100, 68], 4.6, 4.6, p.near, false));
  out.push({ k: 'circle', c: [100, 62], r: 9.6, fill: p.near, outline: o });
  sh.forEach((s, i) => {
    const side = i === 0 ? -1 : 1;
    const elbow: Pt = [s[0] + side * Math.cos(ang) * 28, s[1] + Math.sin(ang) * 28];
    const hand: Pt = [s[0] + side * Math.cos(ang) * 54, s[1] + Math.sin(ang) * 54];
    if (ill.focus.includes('shoulder')) out.push({ k: 'circle', c: s, r: 7.6, fill: p.accent, outline: o });
    out.push(limb(s, elbow, 6.6, 5.4, ill.focus.includes('upperArm') ? p.accent : p.near, o));
    out.push(limb(elbow, hand, 5, 4.1, ill.focus.includes('forearm') ? p.accent : p.near, o));
    if (withHeld && ill.held === 'dumbbell') {
      out.push({ k: 'circle', c: hand, r: 8, fill: INK.metal, outline: true }, { k: 'circle', c: hand, r: 2.8, fill: INK.metalDark });
    } else {
      out.push({ k: 'circle', c: hand, r: 4.6, fill: p.near, outline: o });
    }
  });
  return out;
}

/** Vista frontal con cada brazo en su sitio y la cabeza inclinada. */
function frontPoseBody(pose: FrontPose, ill: Illustration, p: Palette): Shape[] {
  const o = p.outline;
  const has = (f: Focus) => ill.focus.includes(f);
  const shoulders = { left: [84, 86] as Pt, right: [116, 86] as Pt };
  const out: Shape[] = [];
  out.push(limb([93, 130], [89, 166], 8.2, 6.4, p.near, o), limb([89, 166], [89, 196], 6, 4.4, p.near, o));
  out.push(limb([107, 130], [111, 166], 8.2, 6.4, p.near, o), limb([111, 166], [111, 196], 6, 4.4, p.near, o));
  out.push(limb([100, 128], [100, 92], 11.5, 13.5, p.torso, o));
  out.push(limb(shoulders.left, shoulders.right, 8.5, 8.5, p.torso, false));
  // Trapecio del lado que se estira: del cuello al hombro.
  if (has('back')) out.push(limb([100, 78], shoulders[pose.accent], 4.6, 6, p.accent, false));
  const head: Pt = [100 + pose.tilt, 62 + Math.abs(pose.tilt) * 0.35];
  out.push(limb([100, 80], head, 4.6, 4.6, p.near, false));
  out.push({ k: 'circle', c: head, r: 9.6, fill: p.near, outline: o });
  // Primero el brazo que no trabaja; el resaltado va encima.
  const order: ('left' | 'right')[] = pose.accent === 'left' ? ['right', 'left'] : ['left', 'right'];
  for (const side of order) {
    const accent = side === pose.accent;
    const s = shoulders[side];
    const arm = solveTwoBone(s, pose[side], BONES.upperArm, BONES.forearm, side === 'left' ? 1 : -1);
    if (accent && has('shoulder')) out.push({ k: 'circle', c: s, r: 7.6, fill: p.accent, outline: o });
    out.push(limb(s, arm.joint, 6.6, 5.4, accent && has('upperArm') ? p.accent : p.near, o));
    out.push(limb(arm.joint, arm.end, 5, 4.1, accent && has('forearm') ? p.accent : p.near, o));
    out.push({ k: 'circle', c: arm.end, r: 4.6, fill: p.near, outline: o });
  }
  return out;
}

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
function lerpFront(a: FrontPose, b: FrontPose, t: number): FrontPose {
  return {
    left: [mix(a.left[0], b.left[0], t), mix(a.left[1], b.left[1], t)],
    right: [mix(a.right[0], b.right[0], t), mix(a.right[1], b.right[1], t)],
    tilt: mix(a.tilt, b.tilt, t),
    accent: a.accent,
  };
}

// ---------- Composición ----------

export function drawFigure(ill: Illustration, t: number): Shape[] {
  const out: Shape[] = [{ k: 'rect', x: 0, y: 0, w: VIEW.w, h: VIEW.h, r: 18, fill: INK.panel }];
  const floor = ill.props.find((p) => p.kind === 'floor');

  if (ill.frontPose) {
    const { start, end } = ill.frontPose;
    out.push(...props(ill.props));
    out.push({ k: 'ellipse', c: [100, 200], rx: 34, ry: 3.5, fill: '#000000', opacity: 0.35 });
    out.push(...frontPoseBody(start, ill, GHOST), ...frontPoseBody(end, ill, GHOST));
    out.push(...frontPoseBody(lerpFront(start, end, t), ill, LIVE));
    return out;
  }

  if (ill.front) {
    const { from, to } = ill.front;
    out.push(...props(ill.props));
    out.push({ k: 'ellipse', c: [100, 200], rx: 34, ry: 3.5, fill: '#000000', opacity: 0.35 });
    out.push(...frontBody(from, ill, GHOST, false), ...frontBody(to, ill, GHOST, false));
    out.push(...frontBody(from + (to - from) * t, ill, LIVE, true));
    return out;
  }

  const sk = buildSkeleton(lerpPose(ill.start, ill.end, t), ill);
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  out.push({ k: 'circle', c: [clamp(sk.elbow[0], 46, VIEW.w - 46), clamp(sk.elbow[1], 46, VIEW.h - 46)], r: 44, fill: INK.accent, opacity: 0.07 });
  out.push(...props(ill.props));
  // Los dos extremos del recorrido, en sombra.
  out.push(...body(buildSkeleton(ill.start, ill), ill, GHOST), ...body(buildSkeleton(ill.end, ill), ill, GHOST));
  if (floor && floor.kind === 'floor') {
    const cx = (sk.hip[0] + sk.neck[0]) / 2;
    const lift = Math.max(0, floor.y - Math.max(sk.foot[1], sk.hip[1], sk.hand[1]));
    out.push({ k: 'ellipse', c: [cx, floor.y + 1], rx: Math.max(18, 34 - lift * 0.2), ry: 3.5, fill: '#000000', opacity: 0.35 });
  }
  out.push(...body(sk, ill, LIVE), ...held(sk, ill));
  return out;
}

/** Contorno de una cápsula con radios distintos en cada extremo, como atributo `d` de un path. */
export function capsulePath(a: Pt, b: Pt, ra: number, rb: number): string {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  const f = (v: number) => v.toFixed(2);
  if (len < 0.05) {
    const r = Math.max(ra, rb);
    return `M ${f(a[0] - r)} ${f(a[1])} A ${f(r)} ${f(r)} 0 1 0 ${f(a[0] + r)} ${f(a[1])} A ${f(r)} ${f(r)} 0 1 0 ${f(a[0] - r)} ${f(a[1])} Z`;
  }
  const px = -dy / len;
  const py = dx / len;
  return [
    `M ${f(a[0] + px * ra)} ${f(a[1] + py * ra)}`,
    `L ${f(b[0] + px * rb)} ${f(b[1] + py * rb)}`,
    `A ${f(rb)} ${f(rb)} 0 0 0 ${f(b[0] - px * rb)} ${f(b[1] - py * rb)}`,
    `L ${f(a[0] - px * ra)} ${f(a[1] - py * ra)}`,
    `A ${f(ra)} ${f(ra)} 0 0 0 ${f(a[0] + px * ra)} ${f(a[1] + py * ra)}`,
    'Z',
  ].join(' ');
}

/** SVG en texto, para vistas previas y tests fuera de la app. */
export function toSvg(shapes: Shape[], size = VIEW.w): string {
  const stroke = (o?: boolean) => (o ? ` stroke="${INK.panel}" stroke-width="1.6"` : '');
  const op = (v?: number) => (v !== undefined ? ` opacity="${v}"` : '');
  const body = shapes
    .map((s) => {
      switch (s.k) {
        case 'capsule':
          return `<path d="${capsulePath(s.a, s.b, s.ra, s.rb)}" fill="${s.fill}"${stroke(s.outline)}/>`;
        case 'circle':
          return `<circle cx="${s.c[0]}" cy="${s.c[1]}" r="${s.r}" fill="${s.fill}"${op(s.opacity)}${stroke(s.outline)}/>`;
        case 'ellipse':
          return `<ellipse cx="${s.c[0]}" cy="${s.c[1]}" rx="${s.rx}" ry="${s.ry}" fill="${s.fill}"${op(s.opacity)}/>`;
        case 'line':
          return `<line x1="${s.a[0]}" y1="${s.a[1]}" x2="${s.b[0]}" y2="${s.b[1]}" stroke="${s.stroke}" stroke-width="${s.width}" stroke-linecap="round"/>`;
        case 'rect':
          return `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="${s.r}" fill="${s.fill}"/>`;
      }
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${(size * VIEW.h) / VIEW.w}" viewBox="0 0 ${VIEW.w} ${VIEW.h}">${body}</svg>`;
}
