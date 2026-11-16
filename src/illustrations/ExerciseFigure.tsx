import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Ellipse, Line, Path, Rect } from 'react-native-svg';

import { space, type } from '@/ui/theme';
import { INK, VIEW, capsulePath, drawFigure, type Shape } from './draw';
import { ILLUSTRATIONS } from './library';
import { cyclePhase } from './skeleton';

const OUTLINE = { stroke: INK.panel, strokeWidth: 1.6 } as const;

function ShapeView({ s }: { s: Shape }) {
  switch (s.k) {
    case 'capsule':
      return <Path d={capsulePath(s.a, s.b, s.ra, s.rb)} fill={s.fill} {...(s.outline ? OUTLINE : null)} />;
    case 'circle':
      return <Circle cx={s.c[0]} cy={s.c[1]} r={s.r} fill={s.fill} opacity={s.opacity} {...(s.outline ? OUTLINE : null)} />;
    case 'ellipse':
      return <Ellipse cx={s.c[0]} cy={s.c[1]} rx={s.rx} ry={s.ry} fill={s.fill} opacity={s.opacity} />;
    case 'line':
      return <Line x1={s.a[0]} y1={s.a[1]} x2={s.b[0]} y2={s.b[1]} stroke={s.stroke} strokeWidth={s.width} strokeLinecap="round" />;
    case 'rect':
      return <Rect x={s.x} y={s.y} width={s.w} height={s.h} rx={s.r} fill={s.fill} />;
  }
}

/** Dibujo animado del ejercicio: va del inicio al final en bucle. */
export function ExerciseFigure({ exerciseId, size = 200, animated = true }: { exerciseId: string; size?: number; animated?: boolean }) {
  const ill = ILLUSTRATIONS[exerciseId];
  const [t, setT] = useState(animated ? 0 : 1);

  useEffect(() => {
    if (!ill || !animated) return;
    const period = ill.timing === 'slowReturn' ? 3600 : 2800;
    const start = Date.now();
    let frame = 0;
    const tick = () => {
      const u = ((Date.now() - start) % period) / period;
      setT(cyclePhase(u, ill.timing));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [ill, animated]);

  if (!ill) return null;

  return (
    <View style={{ alignItems: 'center', gap: space.sm }}>
      <Svg width={size} height={(size * VIEW.h) / VIEW.w} viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}>
        {drawFigure(ill, t).map((s, i) => (
          <ShapeView key={i} s={s} />
        ))}
      </Svg>
      <Text style={[type.caption, { textAlign: 'center' }]}>{ill.caption}</Text>
    </View>
  );
}
