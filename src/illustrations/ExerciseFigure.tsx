import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, G, Line, Rect } from 'react-native-svg';

import { colors, space, type } from '@/ui/theme';
import { ILLUSTRATIONS } from './library';
import { buildSkeleton, cyclePhase, lerpPose, type Illustration, type Prop, type Pt } from './skeleton';

const BODY = colors.text;
const WORK = colors.accent;
const PROP = colors.faint;
const STROKE = 7;

function Bone({ a, b, color = BODY, width = STROKE, opacity = 1 }: { a: Pt; b: Pt; color?: string; width?: number; opacity?: number }) {
  return (
    <Line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={color} strokeWidth={width} strokeLinecap="round" opacity={opacity} />
  );
}

function Dumbbell({ at }: { at: Pt }) {
  return (
    <G>
      <Rect x={at[0] - 9} y={at[1] - 3} width={18} height={6} rx={3} fill={PROP} />
      <Rect x={at[0] - 12} y={at[1] - 7} width={6} height={14} rx={2} fill={colors.muted} />
      <Rect x={at[0] + 6} y={at[1] - 7} width={6} height={14} rx={2} fill={colors.muted} />
    </G>
  );
}

function Props({ props }: { props: Prop[] }) {
  return (
    <>
      {props.map((p, i) => {
        if (p.kind === 'floor') return <Line key={i} x1={6} y1={p.y} x2={194} y2={p.y} stroke={PROP} strokeWidth={3} strokeLinecap="round" />;
        if (p.kind === 'bar') return <Line key={i} x1={p.x - 46} y1={p.y} x2={p.x + 46} y2={p.y} stroke={colors.muted} strokeWidth={6} strokeLinecap="round" />;
        return <Rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} rx={6} fill={colors.cardHigh} stroke={PROP} strokeWidth={2} />;
      })}
    </>
  );
}

function SideFigure({ ill, t }: { ill: Illustration; t: number }) {
  const sk = buildSkeleton(lerpPose(ill.start, ill.end, t));
  const grip = sk.handTip ?? sk.hand;
  return (
    <>
      {sk.farElbow && sk.farHand && (
        <>
          <Bone a={sk.neck} b={sk.farElbow} opacity={0.35} />
          <Bone a={sk.farElbow} b={sk.farHand} opacity={0.35} />
        </>
      )}
      <Bone a={sk.hip} b={sk.knee} />
      <Bone a={sk.knee} b={sk.foot} />
      <Bone a={sk.hip} b={sk.neck} width={STROKE + 2} />
      <Circle cx={sk.head[0]} cy={sk.head[1]} r={9} fill={BODY} />
      <Bone a={sk.neck} b={sk.elbow} color={WORK} />
      <Bone a={sk.elbow} b={sk.hand} color={WORK} />
      {sk.handTip && <Bone a={sk.hand} b={sk.handTip} color={WORK} width={STROKE - 1} />}
      {ill.dumbbell && <Dumbbell at={grip} />}
    </>
  );
}

function FrontFigure({ ill, t }: { ill: Illustration; t: number }) {
  const { from, to } = ill.front!;
  const ang = ((from + (to - from) * t) * Math.PI) / 180;
  const neck: Pt = [100, 80];
  const hip: Pt = [100, 128];
  const arm = 54;
  const right: Pt = [112 + Math.cos(ang) * arm, 84 + Math.sin(ang) * arm];
  const left: Pt = [88 - Math.cos(ang) * arm, 84 + Math.sin(ang) * arm];
  return (
    <>
      <Bone a={hip} b={[90, 198]} />
      <Bone a={hip} b={[110, 198]} />
      <Bone a={hip} b={neck} width={STROKE + 2} />
      <Bone a={[88, 84]} b={[112, 84]} width={STROKE + 1} />
      <Circle cx={100} cy={66} r={9} fill={BODY} />
      <Bone a={[112, 84]} b={right} color={WORK} />
      <Bone a={[88, 84]} b={left} color={WORK} />
      {ill.dumbbell && (
        <>
          <Dumbbell at={right} />
          <Dumbbell at={left} />
        </>
      )}
    </>
  );
}

/** Dibujo animado del ejercicio: va del inicio al final en bucle. */
export function ExerciseFigure({ exerciseId, size = 200 }: { exerciseId: string; size?: number }) {
  const ill = ILLUSTRATIONS[exerciseId];
  const [t, setT] = useState(0);

  useEffect(() => {
    if (!ill) return;
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
  }, [ill]);

  if (!ill) return null;

  return (
    <View style={{ alignItems: 'center', gap: space.sm }}>
      <Svg width={size} height={(size * 210) / 200} viewBox="0 0 200 210">
        <Props props={ill.props} />
        {ill.front ? <FrontFigure ill={ill} t={t} /> : <SideFigure ill={ill} t={t} />}
      </Svg>
      <Text style={[type.caption, { textAlign: 'center' }]}>{ill.caption}</Text>
    </View>
  );
}
