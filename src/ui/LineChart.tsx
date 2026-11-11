import { useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Rect, Text as SvgText } from 'react-native-svg';

import type { Point, Range, Tone } from '@/domain/body';
import { formatShort } from '@/domain/dates';
import { colors, type } from './theme';

export const TONE_COLOR: Record<Tone, string> = {
  low: colors.info,
  good: colors.success,
  warn: '#F5B83D',
  bad: colors.danger,
};

/** Gráfica de evolución con bandas de color para cada rango. */
export function LineChart({
  points,
  ranges,
  height = 180,
  format = (v: number) => v.toFixed(1),
  compact = false,
}: {
  points: Point[];
  ranges?: Range[];
  height?: number;
  format?: (v: number) => string;
  compact?: boolean;
}) {
  const [width, setWidth] = useState(0);
  if (points.length === 0) {
    return <Text style={type.caption}>Aún no hay datos para dibujar la gráfica.</Text>;
  }

  const padL = compact ? 2 : 40;
  const padR = compact ? 2 : 10;
  const padT = 8;
  const padB = compact ? 4 : 22;
  const values = points.map((p) => p.value);
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  const span = hi - lo || Math.max(Math.abs(hi) * 0.05, 1);
  lo -= span * 0.25;
  hi += span * 0.25;

  const w = Math.max(width - padL - padR, 1);
  const h = height - padT - padB;
  const x = (i: number) => padL + (points.length === 1 ? w / 2 : (i / (points.length - 1)) * w);
  const y = (v: number) => padT + (1 - (v - lo) / (hi - lo)) * h;

  const bands: { y0: number; y1: number; color: string }[] = [];
  let prev = -Infinity;
  for (const r of ranges ?? []) {
    const a = Math.max(prev, lo);
    const b = Math.min(r.max, hi);
    if (b > a) bands.push({ y0: y(b), y1: y(a), color: TONE_COLOR[r.tone] });
    prev = r.max;
  }

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height }}>
      {width > 0 && (
        <Svg width={width} height={height}>
          {bands.map((b, i) => (
            <Rect key={i} x={padL} y={b.y0} width={w} height={b.y1 - b.y0} fill={b.color} opacity={0.1} />
          ))}
          {!compact &&
            [hi - span * 0.25, lo + span * 0.25].map((v, i) => (
              <SvgText key={i} x={padL - 6} y={y(v) + 4} fill={colors.faint} fontSize={10} textAnchor="end">
                {format(v)}
              </SvgText>
            ))}
          {points.length > 1 && (
            <Polyline
              points={points.map((p, i) => `${x(i)},${y(p.value)}`).join(' ')}
              fill="none"
              stroke={colors.accent}
              strokeWidth={compact ? 2 : 2.5}
              strokeLinejoin="round"
            />
          )}
          {!compact &&
            points.map((p, i) => <Circle key={p.date} cx={x(i)} cy={y(p.value)} r={3.5} fill={colors.accent} />)}
          {compact && (
            <Circle cx={x(points.length - 1)} cy={y(points[points.length - 1].value)} r={3} fill={colors.accent} />
          )}
          {!compact && (
            <>
              <Line x1={padL} y1={height - padB} x2={padL + w} y2={height - padB} stroke={colors.border} />
              <SvgText x={padL} y={height - 6} fill={colors.faint} fontSize={10}>
                {formatShort(points[0].date)}
              </SvgText>
              {points.length > 1 && (
                <SvgText x={padL + w} y={height - 6} fill={colors.faint} fontSize={10} textAnchor="end">
                  {formatShort(points[points.length - 1].date)}
                </SvgText>
              )}
            </>
          )}
        </Svg>
      )}
    </View>
  );
}
