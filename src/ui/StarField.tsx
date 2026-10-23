import { memo, useEffect, useMemo } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { Canvas, Circle, Group } from '@shopify/react-native-skia';
import { Easing, useDerivedValue, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { colors } from '../theme';

type Star = { x: number; y: number; r: number; o: number };

// Deterministički generator, da zvezde budu iste na svakom ekranu.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeStars(width: number, height: number, count: number, seed: number): Star[] {
  const rand = mulberry32(seed);
  return Array.from({ length: count }, () => ({
    x: rand() * width,
    y: rand() * height,
    r: 0.4 + rand() * 1.1,
    o: 0.25 + rand() * 0.6,
  }));
}

/** Tamna svemirska pozadina sa sitnim zvezdama (nekoliko blago treperi). */
function StarFieldInner() {
  const { width, height } = useWindowDimensions();
  const stars = useMemo(() => makeStars(width, height, 110, 7), [width, height]);
  const twinkleA = useMemo(() => makeStars(width, height, 14, 21), [width, height]);
  const twinkleB = useMemo(() => makeStars(width, height, 14, 42), [width, height]);

  const phase = useSharedValue(0);
  useEffect(() => {
    phase.value = withRepeat(withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [phase]);
  const opacityA = useDerivedValue(() => 0.25 + phase.value * 0.75);
  const opacityB = useDerivedValue(() => 1 - phase.value * 0.75);

  return (
    <Canvas style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]} pointerEvents="none">
      {stars.map((s, i) => (
        <Circle key={i} cx={s.x} cy={s.y} r={s.r} color="#ffffff" opacity={s.o} />
      ))}
      <Group opacity={opacityA}>
        {twinkleA.map((s, i) => (
          <Circle key={i} cx={s.x} cy={s.y} r={s.r + 0.4} color="#ffd6ea" />
        ))}
      </Group>
      <Group opacity={opacityB}>
        {twinkleB.map((s, i) => (
          <Circle key={i} cx={s.x} cy={s.y} r={s.r + 0.3} color="#d8d0ff" />
        ))}
      </Group>
    </Canvas>
  );
}

export const StarField = memo(StarFieldInner);
