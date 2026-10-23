import { memo, useEffect, useMemo } from 'react';
import {
  BlurMask,
  Canvas,
  Circle,
  CornerPathEffect,
  Group,
  LinearGradient,
  Path,
  Skia,
  vec,
} from '@shopify/react-native-skia';
import {
  Easing,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { HEART_PATTERN } from '../../src/ui/PixelHeart';
import { RARITIES, lighten } from './rarity';

export type DropAnimations = {
  /** 0..1 – drop pada odozgo i odskoči */
  entry: SharedValue<number>;
  /** ~1 – "zgnječi" se na tap */
  squash: SharedValue<number>;
  /** ugao drmanja u radijanima */
  shake: SharedValue<number>;
  /** 0..1 – beli bljesak kad pređe na višu retkost */
  flash: SharedValue<number>;
  /** 0..1 – otvaranje (raste i nestaje) */
  open: SharedValue<number>;
};

export type Spark = { id: number; count: number; colors: string[]; power: number };

function starPath(radius: number, inner: number) {
  const b = Skia.PathBuilder.Make();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? radius : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) b.moveTo(x, y);
    else b.lineTo(x, y);
  }
  b.close();
  return b.build();
}

function raysPath(radius: number, count: number) {
  const b = Skia.PathBuilder.Make();
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const w = Math.PI / count / 2.2;
    b.moveTo(0, 0);
    b.lineTo(Math.cos(a - w) * radius, Math.sin(a - w) * radius);
    b.lineTo(Math.cos(a + w) * radius, Math.sin(a + w) * radius);
    b.close();
  }
  return b.build();
}

function heartPath(pixel: number) {
  const b = Skia.PathBuilder.Make();
  const ox = -3.5 * pixel;
  const oy = -3 * pixel;
  HEART_PATTERN.forEach((row, y) =>
    row.split('').forEach((c, x) => {
      if (c === 'X') b.addRect(Skia.XYWHRect(ox + x * pixel, oy + y * pixel, pixel, pixel));
    })
  );
  return b.build();
}

// ---------------------------------------------------------------------------

type ParticleSpec = { angle: number; dist: number; r: number; color: string };

function Particle({ spec, t, cx, cy }: { spec: ParticleSpec; t: SharedValue<number>; cx: number; cy: number }) {
  const x = useDerivedValue(() => cx + Math.cos(spec.angle) * spec.dist * t.value);
  const y = useDerivedValue(() => cy + Math.sin(spec.angle) * spec.dist * t.value + 30 * t.value * t.value);
  const opacity = useDerivedValue(() => 1 - t.value);
  return <Circle cx={x} cy={y} r={spec.r} color={spec.color} opacity={opacity} />;
}

const SparkBurst = memo(function SparkBurst({ spark, cx, cy, size }: { spark: Spark; cx: number; cy: number; size: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withTiming(1, { duration: 650 + spark.power * 350, easing: Easing.out(Easing.cubic) });
  }, [t, spark.power]);
  const specs = useMemo<ParticleSpec[]>(
    () =>
      Array.from({ length: spark.count }, (_, i) => ({
        angle: (i / spark.count) * Math.PI * 2 + Math.random() * 0.4,
        dist: size * (0.18 + Math.random() * 0.3 * (0.6 + spark.power)),
        r: 2 + Math.random() * (2.5 + spark.power * 2),
        color: spark.colors[i % spark.colors.length],
      })),
    [spark, size]
  );
  return (
    <Group>
      {specs.map((s, i) => (
        <Particle key={i} spec={s} t={t} cx={cx} cy={cy} />
      ))}
    </Group>
  );
});

// ---------------------------------------------------------------------------

/** Drop u obliku zvezde, boja zavisi od trenutne retkosti. */
export function DropStar({
  size,
  level,
  anim,
  sparks,
  hidden,
}: {
  size: number;
  level: number;
  anim: DropAnimations;
  sparks: Spark[];
  hidden?: boolean;
}) {
  const rarity = RARITIES[level];
  const R = size * 0.3;
  const star = useMemo(() => starPath(R, R * 0.5), [R]);
  const innerStar = useMemo(() => starPath(R * 0.62, R * 0.31), [R]);
  const rays = useMemo(() => raysPath(size * 0.48, 14), [size]);
  const heart = useMemo(() => heartPath(Math.max(2, Math.round(R * 0.075))), [R]);

  const idle = useSharedValue(0);
  const spin = useSharedValue(0);
  useEffect(() => {
    idle.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }), -1, true);
    spin.value = withRepeat(withTiming(1, { duration: 9000, easing: Easing.linear }), -1, false);
  }, [idle, spin]);

  const { entry, squash, shake, flash, open } = anim;
  const cx = size / 2;
  const cy = size / 2;

  const transform = useDerivedValue(() => {
    const bob = (idle.value - 0.5) * size * 0.03;
    const drop = (1 - entry.value) * -size * 0.9;
    const s = squash.value * (0.3 + 0.7 * Math.min(entry.value, 1)) * (1 + open.value * 0.7);
    return [
      { translateX: cx },
      { translateY: cy + bob + drop },
      { rotate: shake.value },
      { scaleX: s * (2 - squash.value) },
      { scaleY: s },
    ];
  });
  const opacity = useDerivedValue(() => (hidden ? 0 : 1 - open.value));
  const raysTransform = useDerivedValue(() => [{ rotate: spin.value * Math.PI * 2 }]);
  const raysOpacity = useDerivedValue(() => (0.1 + level * 0.06) * (1 - open.value));
  const glowRadius = useDerivedValue(() => R * (1.05 + idle.value * 0.12 + flash.value * 0.5));

  return (
    <Canvas style={{ width: size, height: size }}>
      <Group opacity={opacity}>
        <Group transform={[{ translateX: cx }, { translateY: cy }]}>
          <Group transform={raysTransform} opacity={raysOpacity}>
            <Path path={rays} color={rarity.color} />
          </Group>
        </Group>
        <Group transform={transform}>
          <Circle cx={0} cy={0} r={glowRadius} color={rarity.color} opacity={0.5}>
            <BlurMask blur={R * 0.45} style="normal" />
          </Circle>
          <Path path={star}>
            <LinearGradient start={vec(0, -R)} end={vec(0, R)} colors={[lighten(rarity.color, 0.45), rarity.color, rarity.dark]} />
            <CornerPathEffect r={R * 0.14} />
          </Path>
          <Path path={innerStar} color="#ffffff" opacity={0.18}>
            <CornerPathEffect r={R * 0.08} />
          </Path>
          <Path path={star} style="stroke" strokeWidth={Math.max(3, R * 0.05)} color="#ffffff" opacity={0.9}>
            <CornerPathEffect r={R * 0.14} />
          </Path>
          <Group transform={[{ translateX: R * 0.025 }, { translateY: R * 0.03 }]}>
            <Path path={heart} color={rarity.dark} opacity={0.55} />
          </Group>
          <Path path={heart} color="#ffffff" />
          <Circle cx={0} cy={0} r={R * 1.5} color="#ffffff" opacity={flash} />
        </Group>
      </Group>
      {sparks.map((s) => (
        <SparkBurst key={s.id} spark={s} cx={cx} cy={cy} size={size} />
      ))}
    </Canvas>
  );
}
