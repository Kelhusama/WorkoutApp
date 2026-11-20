import Svg, { Polygon, Rect } from 'react-native-svg';

import { colors } from './theme';

/**
 * La pintadera del icono como marcador de avance: ocho triángulos, uno por cada semana del plan.
 * Las semanas hechas y la que está en curso se rellenan con los colores del icono;
 * las que faltan quedan apagadas, solo con su contorno.
 */

// Lienzo de 100 × 100: marco, y dentro cuatro cuadros de 34 separados por 4.
const S = 34;
const A = 14;
const B = 52;

type Pt = [number, number];
const sq = (x: number, y: number): { tl: Pt; tr: Pt; br: Pt; bl: Pt } => ({ tl: [x, y], tr: [x + S, y], br: [x + S, y + S], bl: [x, y + S] });
const q = { a: sq(A, A), b: sq(B, A), c: sq(A, B), d: sq(B, B) };

/** Los ocho triángulos en orden de lectura, con el tono que tienen en el icono. */
const TRIANGLES: { pts: Pt[]; tone: 'amarillo' | 'blanco' }[] = [
  { pts: [q.a.tl, q.a.tr, q.a.bl], tone: 'amarillo' },
  { pts: [q.a.tr, q.a.br, q.a.bl], tone: 'blanco' },
  { pts: [q.b.tl, q.b.tr, q.b.br], tone: 'blanco' },
  { pts: [q.b.tl, q.b.br, q.b.bl], tone: 'amarillo' },
  { pts: [q.c.tl, q.c.tr, q.c.bl], tone: 'blanco' },
  { pts: [q.c.tr, q.c.br, q.c.bl], tone: 'amarillo' },
  { pts: [q.d.tl, q.d.tr, q.d.br], tone: 'amarillo' },
  { pts: [q.d.tl, q.d.br, q.d.bl], tone: 'blanco' },
];

export const PINTADERA_PARTS = TRIANGLES.length;

export function Pintadera({
  size = 120,
  done,
  current,
  label,
}: {
  size?: number;
  /** Cuántas partes están completas (de 0 a 8). */
  done: number;
  /** Índice de la parte en curso (0–7), o null si no hay ninguna. */
  current: number | null;
  /** Descripción para lectores de pantalla. */
  label: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityRole="image" accessibilityLabel={label}>
      <Rect x={3.5} y={3.5} width={93} height={93} rx={9} fill="none" stroke="#3F8FD2" strokeWidth={5} />
      {TRIANGLES.map((t, i) => {
        const tone = t.tone === 'amarillo' ? colors.accent : colors.text;
        const isDone = i < done;
        const isCurrent = i === current;
        return (
          <Polygon
            key={i}
            points={t.pts.map((p) => p.join(',')).join(' ')}
            // La semana en curso ya luce su color: es la que se está ganando.
            fill={isDone || isCurrent ? tone : colors.card}
            stroke={isDone || isCurrent ? "none" : colors.border}
            strokeWidth={0.8}
          />
        );
      })}
    </Svg>
  );
}
