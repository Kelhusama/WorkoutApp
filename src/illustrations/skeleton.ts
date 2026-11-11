/**
 * Figura de palitos en vista lateral (mirando a la derecha) con cinemática inversa de dos huesos.
 * Coordenadas SVG: x a la derecha, y hacia abajo. Ángulos en grados: 0 = derecha, -90 = arriba, 90 = abajo.
 */

export type Pt = readonly [number, number];

export const BONES = { torso: 50, upperArm: 28, forearm: 26, thigh: 38, shin: 36, hand: 10, headR: 9 } as const;

export type Prop =
  | { kind: 'bar'; x: number; y: number }
  | { kind: 'floor'; y: number }
  | { kind: 'box'; x: number; y: number; w: number; h: number };

export interface Pose {
  hip: Pt;
  /** Ángulo del tronco, de cadera a cuello. */
  torso: number;
  /** Objetivo de la mano del brazo que trabaja. */
  hand: Pt;
  /** Lado hacia el que se dobla el codo: 1 o -1. */
  elbowBend: 1 | -1;
  foot: Pt;
  kneeBend: 1 | -1;
  /** Ángulo opcional de la mano (para curl de muñeca). */
  wrist?: number;
  /** Mano del otro brazo, fija (apoyo), si se dibuja. */
  farHand?: Pt;
}

export interface Illustration {
  start: Pose;
  end: Pose;
  props: Prop[];
  /** Mancuerna en la mano que trabaja. */
  dumbbell?: boolean;
  /** 'even' = ida y vuelta igual; 'slowReturn' = sube rápido y baja lento. */
  timing?: 'even' | 'slowReturn';
  /** Texto corto que acompaña al dibujo. */
  caption: string;
  /**
   * Vista frontal con brazos simétricos (aperturas laterales).
   * Ángulo del brazo respecto a la horizontal: 90 = colgando, 0 = en cruz.
   */
  front?: { from: number; to: number };
}

const rad = (d: number) => (d * Math.PI) / 180;
const dir = (deg: number, len: number): Pt => [Math.cos(rad(deg)) * len, Math.sin(rad(deg)) * len];
const add = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]];

/** Resuelve la articulación intermedia (codo/rodilla) para alcanzar el objetivo. */
export function solveTwoBone(root: Pt, target: Pt, l1: number, l2: number, bend: 1 | -1): { joint: Pt; end: Pt } {
  const dx = target[0] - root[0];
  const dy = target[1] - root[1];
  const raw = Math.hypot(dx, dy);
  const d = Math.min(Math.max(raw, Math.abs(l1 - l2) + 0.01), l1 + l2 - 0.01);
  const base = Math.atan2(dy, dx);
  const cos = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
  const a = Math.acos(Math.max(-1, Math.min(1, cos)));
  const ang = base + bend * a;
  const joint: Pt = [root[0] + Math.cos(ang) * l1, root[1] + Math.sin(ang) * l1];
  const endAng = Math.atan2(target[1] - joint[1], target[0] - joint[0]);
  const end: Pt = [joint[0] + Math.cos(endAng) * l2, joint[1] + Math.sin(endAng) * l2];
  return { joint, end };
}

export interface Skeleton {
  hip: Pt;
  neck: Pt;
  head: Pt;
  elbow: Pt;
  hand: Pt;
  handTip?: Pt;
  knee: Pt;
  foot: Pt;
  farElbow?: Pt;
  farHand?: Pt;
}

export function buildSkeleton(p: Pose): Skeleton {
  const neck = add(p.hip, dir(p.torso, BONES.torso));
  const head = add(neck, dir(p.torso, BONES.headR + 4));
  const arm = solveTwoBone(neck, p.hand, BONES.upperArm, BONES.forearm, p.elbowBend);
  const leg = solveTwoBone(p.hip, p.foot, BONES.thigh, BONES.shin, p.kneeBend);
  const sk: Skeleton = { hip: p.hip, neck, head, elbow: arm.joint, hand: arm.end, knee: leg.joint, foot: leg.end };
  if (p.wrist !== undefined) sk.handTip = add(arm.end, dir(p.wrist, BONES.hand));
  if (p.farHand) {
    const far = solveTwoBone(neck, p.farHand, BONES.upperArm, BONES.forearm, 1);
    sk.farElbow = far.joint;
    sk.farHand = far.end;
  }
  return sk;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpPt = (a: Pt, b: Pt, t: number): Pt => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];

export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  return {
    hip: lerpPt(a.hip, b.hip, t),
    torso: lerp(a.torso, b.torso, t),
    hand: lerpPt(a.hand, b.hand, t),
    elbowBend: a.elbowBend,
    foot: lerpPt(a.foot, b.foot, t),
    kneeBend: a.kneeBend,
    wrist: a.wrist !== undefined && b.wrist !== undefined ? lerp(a.wrist, b.wrist, t) : a.wrist,
    farHand: a.farHand && b.farHand ? lerpPt(a.farHand, b.farHand, t) : a.farHand,
  };
}

/**
 * Fase del movimiento (0 = inicio, 1 = final) para un instante del ciclo (0–1).
 * Incluye pausas en los extremos y suavizado.
 */
export function cyclePhase(u: number, timing: 'even' | 'slowReturn' = 'even'): number {
  const ease = (x: number) => 0.5 - 0.5 * Math.cos(Math.PI * x);
  const [hold0, go, hold1] = timing === 'slowReturn' ? [0.1, 0.25, 0.1] : [0.12, 0.38, 0.12];
  if (u < hold0) return 0;
  if (u < hold0 + go) return ease((u - hold0) / go);
  if (u < hold0 + go + hold1) return 1;
  return 1 - ease((u - hold0 - go - hold1) / (1 - hold0 - go - hold1));
}
