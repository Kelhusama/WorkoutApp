import { fitStrength, type Observation } from './coach';

/**
 * Experimento del entrenador (docs/ENTRENADOR_ADAPTATIVO.md): una red neuronal pequeña que
 * predice lo que harás en la próxima sesión, examinada contra el filtro de Kalman con tus
 * propios datos pasados. Solo se le hace caso si acierta más.
 *
 * Red de una capa oculta escrita a mano: 4 entradas → 6 neuronas (tanh) → 1 salida.
 */

const WINDOW = 3;
const HIDDEN = 6;
const INPUTS = WINDOW + 1;

interface Net {
  w1: number[][]; // HIDDEN × INPUTS
  b1: number[];
  w2: number[];
  b2: number;
}

/** Azar repetible, para que el resultado no cambie de una vez a otra. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

/** Entradas para predecir la observación `i`: las tres anteriores respecto a su media, y las semanas hasta ella. */
function features(obs: readonly Observation[], i: number): { x: number[]; scale: number } {
  const prev = obs.slice(i - WINDOW, i);
  const scale = prev.reduce((a, o) => a + o.value, 0) / WINDOW || 1;
  return { x: [...prev.map((o) => o.value / scale - 1), days(prev[WINDOW - 1].date, obs[i].date) / 7], scale };
}

function forward(net: Net, x: readonly number[]): { h: number[]; y: number } {
  const h = net.w1.map((row, j) => Math.tanh(row.reduce((a, w, k) => a + w * x[k], net.b1[j])));
  return { h, y: h.reduce((a, v, j) => a + v * net.w2[j], net.b2) };
}

/** Entrena la red con las observaciones dadas (descenso de gradiente, muestra a muestra). */
export function train(obs: readonly Observation[], epochs = 150, lr = 0.05): Net | null {
  const samples: { x: number[]; y: number }[] = [];
  for (let i = WINDOW; i < obs.length; i++) {
    const f = features(obs, i);
    samples.push({ x: f.x, y: obs[i].value / f.scale - 1 });
  }
  if (samples.length < 4) return null;
  const rnd = seeded(1234);
  const init = () => (rnd() - 0.5) * 0.6;
  const net: Net = {
    w1: Array.from({ length: HIDDEN }, () => Array.from({ length: INPUTS }, init)),
    b1: Array(HIDDEN).fill(0),
    w2: Array.from({ length: HIDDEN }, init),
    b2: 0,
  };
  for (let e = 0; e < epochs; e++) {
    for (const s of samples) {
      const { h, y } = forward(net, s.x);
      const err = y - s.y;
      for (let j = 0; j < HIDDEN; j++) {
        const gh = err * net.w2[j] * (1 - h[j] * h[j]);
        net.w2[j] -= lr * err * h[j];
        for (let k = 0; k < INPUTS; k++) net.w1[j][k] -= lr * gh * s.x[k];
        net.b1[j] -= lr * gh;
      }
      net.b2 -= lr * err;
    }
  }
  return net;
}

/** Predicción de la red para la observación `i`, usando solo las anteriores. */
function predictAt(net: Net, obs: readonly Observation[], i: number): number {
  const f = features(obs, i);
  return (forward(net, f.x).y + 1) * f.scale;
}

/** Predicción del filtro para una fecha: nivel actual más el ritmo por los días que falten. */
function kalmanAt(history: readonly Observation[], date: string): number {
  const s = fitStrength(history)!;
  return s.level + (s.ratePerWeek / 7) * days(history[history.length - 1].date, date);
}

/** Sesiones mínimas para hacer el examen. */
export const EXAM_MIN = 12;
/** Cuántas de las últimas sesiones se examinan (limita el cálculo en el móvil). */
const EXAM_LAST = 20;

export interface Exam {
  /** Sesiones examinadas. */
  n: number;
  /** Error medio de cada método al predecir la sesión siguiente. */
  kalman: number;
  neural: number;
  /** Referencia mínima: decir «lo mismo que la última vez». */
  last: number;
  winner: 'kalman' | 'neural';
  /** Lo que el ganador prevé para una sesión dentro de `aheadDays` días. */
  next: number;
}

/**
 * Examen: para cada una de las últimas sesiones, cada método predice su resultado
 * conociendo solo las anteriores. La red gana únicamente si falla menos que el filtro
 * por un margen claro (5 %); con empate o casi, manda el filtro, que es más simple.
 */
export function exam(obs: readonly Observation[], aheadDays = 3): Exam | null {
  if (obs.length < EXAM_MIN) return null;
  const from = Math.max(8, obs.length - EXAM_LAST);
  let k = 0;
  let nn = 0;
  let last = 0;
  let n = 0;
  for (let i = from; i < obs.length; i++) {
    const past = obs.slice(0, i);
    const net = train(past);
    if (!net) continue;
    k += Math.abs(kalmanAt(past, obs[i].date) - obs[i].value);
    nn += Math.abs(predictAt(net, obs, i) - obs[i].value);
    last += Math.abs(obs[i - 1].value - obs[i].value);
    n++;
  }
  if (n < 4) return null;
  const winner = nn / n < (k / n) * 0.95 ? 'neural' : 'kalman';
  const lastDate = obs[obs.length - 1].date;
  const future: Observation = { date: new Date(Date.parse(lastDate) + aheadDays * 86_400_000).toISOString().slice(0, 10), value: 0, noise: 1 };
  const net = winner === 'neural' ? train(obs) : null;
  const next = net ? predictAt(net, [...obs, future], obs.length) : kalmanAt(obs, future.date);
  return { n, kalman: k / n, neural: nn / n, last: last / n, winner, next };
}
