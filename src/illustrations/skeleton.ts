/**
 * Esqueleto en vista lateral (mirando a la derecha) con cinemática inversa de dos huesos.
 * Coordenadas SVG: x a la derecha, y hacia abajo. Ángulos en grados: 0 = derecha, -90 = arriba, 90 = abajo.
 */

export type Pt = readonly [number, number];

export const BONES = { torso: 50, upperArm: 28, forearm: 26, thigh: 38, shin: 36, hand: 10, foot: 11 } as const;

export type Prop =
  | { kind: 'floor'; y: number }
  /** Barra de dominadas vista de perfil (se ve su sección). */
  | { kind: 'bar'; x: number; y: number }
  /** Silla, banco o mesa: tablero con el borde superior en `y`. */
  | { kind: 'bench'; x: number; y: number; w: number; h: number }
  /** Puerta cerrada con pomo, para anclar una toalla. */
  | { kind: 'door'; x: number; knobY: number }
  /** Pared lisa en la que apoyarse. */
  | { kind: 'wall'; x: number };

/** Zonas que trabajan y se resaltan. */
export type Focus = 'upperArm' | 'forearm' | 'chest' | 'back' | 'shoulder' | 'thigh' | 'shin' | 'glute';

export interface Pose {
  hip: Pt;
  /** Ángulo del tronco, de cadera a cuello. */
  torso: number;
  /** Objetivo de la mano del brazo cercano. */
  hand: Pt;
  /** Lado hacia el que se dobla el codo: 1 o -1. */
  elbowBend: 1 | -1;
  foot: Pt;
  kneeBend: 1 | -1;
  /** Ángulo de la mano (para curl de muñeca). */
  wrist?: number;
  /** Mano del brazo lejano, si no acompaña al cercano. */
  farHand?: Pt;
  /** Pie de la pierna lejana, si no acompaña a la cercana. */
  farFoot?: Pt;
  /** Ángulo del pie cercano (0 = plano hacia delante, negativo = punta arriba). Por defecto, perpendicular a la tibia. */
  footAngle?: number;
  /** Sentido de la rodilla lejana, si difiere de la cercana. */
  farKneeBend?: 1 | -1;
}

export interface Illustration {
  start: Pose;
  end: Pose;
  props: Prop[];
  focus: Focus[];
  /** Los dos brazos hacen el mismo movimiento. */
  bothArms?: boolean;
  held?: 'dumbbell' | 'backpack';
  /** Toalla desde la mano cercana hasta un punto, el pie o la otra mano. */
  towelTo?: Pt | 'foot' | 'farHand';
  /** 'even' = ida y vuelta igual; 'slowReturn' = va rápido y vuelve lento. */
  timing?: 'even' | 'slowReturn';
  caption: string;
  /**
   * Vista frontal con brazos simétricos (aperturas laterales).
   * Ángulo del brazo respecto a la horizontal: 90 = colgando, 0 = en cruz.
   */
  front?: { from: number; to: number };
  /** Vista frontal con cada brazo por separado (estiramientos que no se entienden de perfil). */
  frontPose?: { start: FrontPose; end: FrontPose };
}

export interface FrontPose {
  /** Mano del brazo que queda a la izquierda del dibujo. */
  left: Pt;
  /** Mano del brazo que queda a la derecha del dibujo. */
  right: Pt;
  /** Inclinación de la cabeza hacia un lado, en píxeles (negativo = hacia la izquierda). */
  tilt: number;
  /** Lado que se estira y se resalta. */
  accent: 'left' | 'right';
}

const rad = (d: number) => (d * Math.PI) / 180;
export const add = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]];
export const scale = (a: Pt, k: number): Pt => [a[0] * k, a[1] * k];
export const along = (a: Pt, dirV: Pt, d: number): Pt => [a[0] + dirV[0] * d, a[1] + dirV[1] * d];
const unit = (deg: number): Pt => [Math.cos(rad(deg)), Math.sin(rad(deg))];

function normalize(v: Pt): Pt {
  const l = Math.hypot(v[0], v[1]) || 1;
  return [v[0] / l, v[1] / l];
}

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
  /** Dirección del tronco (cadera → cuello) y normal hacia el pecho. */
  u: Pt;
  n: Pt;
  elbow: Pt;
  hand: Pt;
  handTip?: Pt;
  knee: Pt;
  foot: Pt;
  toe: Pt;
  farElbow: Pt;
  farHand: Pt;
  farKnee: Pt;
  farFoot: Pt;
  farToe: Pt;
}

function toeOf(knee: Pt, foot: Pt, floorY: number | null): Pt {
  const s = normalize([foot[0] - knee[0], foot[1] - knee[1]]);
  const toe: Pt = [foot[0] + s[1] * BONES.foot, foot[1] - s[0] * BONES.foot];
  return floorY !== null && toe[1] > floorY - 1 ? [toe[0], floorY - 1] : toe;
}

export function buildSkeleton(p: Pose, ill?: Pick<Illustration, 'bothArms' | 'props'>): Skeleton {
  const u = unit(p.torso);
  const n: Pt = [-u[1], u[0]];
  const neck = along(p.hip, u, BONES.torso);
  const head = along(neck, u, 15.5);
  const floor = ill?.props.find((x) => x.kind === 'floor');
  const floorY = floor && floor.kind === 'floor' ? floor.y : null;

  const arm = solveTwoBone(neck, p.hand, BONES.upperArm, BONES.forearm, p.elbowBend);
  const leg = solveTwoBone(p.hip, p.foot, BONES.thigh, BONES.shin, p.kneeBend);

  const farTarget: Pt = p.farHand ?? (ill?.bothArms ? add(p.hand, [5, -1]) : add(along(p.hip, n, 5), scale(u, 3)));
  const farArm = solveTwoBone(add(neck, [2, -1]), farTarget, BONES.upperArm, BONES.forearm, p.elbowBend);
  const onFloor = floorY !== null && p.foot[1] >= floorY - 4;
  // Con la pierna casi estirada (tumbado), la lejana apenas se separa para que no se doble la rodilla.
  const stretched = Math.hypot(p.foot[0] - p.hip[0], p.foot[1] - p.hip[1]) > 72.5;
  const farFootTarget = p.farFoot ?? add(p.foot, onFloor ? (stretched ? [1.5, 0] : [6, 0]) : [5, -3]);
  const farLeg = solveTwoBone(p.hip, farFootTarget, BONES.thigh, BONES.shin, p.farKneeBend ?? p.kneeBend);

  const sk: Skeleton = {
    hip: p.hip,
    neck,
    head,
    u,
    n,
    elbow: arm.joint,
    hand: arm.end,
    knee: leg.joint,
    foot: leg.end,
    toe: p.footAngle !== undefined ? along(leg.end, unit(p.footAngle), BONES.foot) : toeOf(leg.joint, leg.end, floorY),
    farElbow: farArm.joint,
    farHand: farArm.end,
    farKnee: farLeg.joint,
    farFoot: farLeg.end,
    farToe: toeOf(farLeg.joint, farLeg.end, floorY),
  };
  if (p.wrist !== undefined) sk.handTip = along(arm.end, unit(p.wrist), BONES.hand);
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
    farFoot: a.farFoot && b.farFoot ? lerpPt(a.farFoot, b.farFoot, t) : a.farFoot,
    footAngle: a.footAngle !== undefined && b.footAngle !== undefined ? lerp(a.footAngle, b.footAngle, t) : a.footAngle,
    farKneeBend: a.farKneeBend,
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
