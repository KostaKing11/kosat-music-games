import { memo, useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  BlurMask,
  Canvas,
  Circle,
  Group,
  Image,
  Path,
  Rect,
  RoundedRect,
  Skia,
  type SkImage,
} from '@shopify/react-native-skia';
import Animated, {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import type { Cover } from '../../src/services/coverImages';
import { colors, fonts } from '../../src/theme';
import { HEART_PATTERN } from '../../src/ui/PixelHeart';
import { GRID } from './constants';
import type { SnakeEngine } from './useSnakeEngine';
import { useSwipe } from './useSwipe';

export type Burst = { id: number; cell: number; colors: string[] };
export type PlusOne = { id: number; cell: number };

const OFFSCREEN = [{ translateX: -9999 }, { translateY: -9999 }];

// ---------------------------------------------------------------------------
// Segmenti zmije

type SegmentProps = {
  index: number;
  cell: number;
  body: SharedValue<number[]>;
  prevBody: SharedValue<number[]>;
  progress: SharedValue<number>;
  children: React.ReactNode;
};

/** Pozicija segmenta se interpolira između prethodnog i trenutnog polja (bez skakanja). */
function Segment({ index, cell, body, prevBody, progress, children }: SegmentProps) {
  const transform = useDerivedValue(() => {
    const b = body.value;
    if (index >= b.length) return OFFSCREEN;
    const p = prevBody.value;
    const to = b[index];
    const from = index < p.length ? p[index] : to;
    const t = progress.value;
    const fx = from % GRID;
    const fy = Math.floor(from / GRID);
    const tx = to % GRID;
    const ty = Math.floor(to / GRID);
    return [{ translateX: (fx + (tx - fx) * t) * cell }, { translateY: (fy + (ty - fy) * t) * cell }];
  });
  return <Group transform={transform}>{children}</Group>;
}

function makeHeartPath(cell: number) {
  const pixel = Math.max(1, Math.floor(cell * 0.085 * 2) / 2);
  const w = 7 * pixel;
  const h = 6 * pixel;
  const ox = (cell - w) / 2;
  const oy = (cell - h) / 2 + pixel * 0.3;
  const builder = Skia.PathBuilder.Make();
  HEART_PATTERN.forEach((row, y) =>
    row.split('').forEach((c, x) => {
      if (c === 'X') builder.addRect(Skia.XYWHRect(ox + x * pixel, oy + y * pixel, pixel, pixel));
    })
  );
  return { path: builder.build(), pixel };
}

const HeadTile = memo(function HeadTile({ cell }: { cell: number }) {
  const pad = cell * 0.06;
  const size = cell - pad * 2;
  const heart = useMemo(() => makeHeartPath(cell), [cell]);
  return (
    <Group>
      <RoundedRect x={pad} y={pad} width={size} height={size} r={cell * 0.2} color={colors.accent} />
      <RoundedRect x={pad} y={pad} width={size} height={size} r={cell * 0.2} color="#ffffff" opacity={0.2} style="stroke" strokeWidth={1.5} />
      <Group transform={[{ translateX: heart.pixel * 0.5 }, { translateY: heart.pixel * 0.5 }]}>
        <Path path={heart.path} color="#a3104f" opacity={0.55} />
      </Group>
      <Path path={heart.path} color="#fff3f8" />
    </Group>
  );
});

const CoverTile = memo(function CoverTile({ cell, image, tint }: { cell: number; image: SkImage | null; tint: string }) {
  const pad = cell * 0.08;
  const size = cell - pad * 2;
  const clip = useMemo(() => Skia.RRectXY(Skia.XYWHRect(pad, pad, size, size), cell * 0.16, cell * 0.16), [pad, size, cell]);
  return (
    <Group>
      <Group clip={clip}>
        {image ? (
          <Image image={image} x={pad} y={pad} width={size} height={size} fit="cover" />
        ) : (
          <Rect x={pad} y={pad} width={size} height={size} color={tint} />
        )}
      </Group>
      <RoundedRect x={pad} y={pad} width={size} height={size} r={cell * 0.16} color={colors.accent} opacity={0.55} style="stroke" strokeWidth={1.2} />
    </Group>
  );
});

const PlainTile = memo(function PlainTile({ cell }: { cell: number }) {
  const pad = cell * 0.1;
  const size = cell - pad * 2;
  return (
    <Group>
      <RoundedRect x={pad} y={pad} width={size} height={size} r={cell * 0.18} color="#3a1630" />
      <RoundedRect x={pad} y={pad} width={size} height={size} r={cell * 0.18} color={colors.accent} opacity={0.6} style="stroke" strokeWidth={1.2} />
    </Group>
  );
});

// ---------------------------------------------------------------------------
// Hrana (omot albuma)

function Food({
  cell,
  food,
  reveal,
  cover,
}: {
  cell: number;
  food: SharedValue<number>;
  reveal: SharedValue<number>;
  cover: Cover | null;
}) {
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.linear }), -1, false);
  }, [pulse]);

  const transform = useDerivedValue(() => {
    const f = food.value;
    if (f < 0) return OFFSCREEN;
    const s = reveal.value * (1 + 0.06 * Math.sin(pulse.value * Math.PI * 2));
    return [
      { translateX: (f % GRID) * cell + cell / 2 },
      { translateY: Math.floor(f / GRID) * cell + cell / 2 },
      { scale: s },
    ];
  });

  const size = cell * 0.9;
  const clip = useMemo(() => Skia.RRectXY(Skia.XYWHRect(-size / 2, -size / 2, size, size), cell * 0.16, cell * 0.16), [size, cell]);
  const glow = cover?.colors[0] ?? colors.accent;

  return (
    <Group transform={transform}>
      <Circle cx={0} cy={0} r={cell * 0.66} color={glow} opacity={0.35}>
        <BlurMask blur={cell * 0.3} style="normal" />
      </Circle>
      <Group clip={clip}>
        {cover?.image ? (
          <Image image={cover.image} x={-size / 2} y={-size / 2} width={size} height={size} fit="cover" />
        ) : (
          <Rect x={-size / 2} y={-size / 2} width={size} height={size} color={colors.panelRaised} />
        )}
      </Group>
      <RoundedRect x={-size / 2} y={-size / 2} width={size} height={size} r={cell * 0.16} color="#ffffff" opacity={0.85} style="stroke" strokeWidth={1.5} />
    </Group>
  );
}

// ---------------------------------------------------------------------------
// Čestice u bojama omota

type ParticleSpec = { angle: number; dist: number; r: number; color: string };

function Particle({ spec, t, x, y }: { spec: ParticleSpec; t: SharedValue<number>; x: number; y: number }) {
  const cx = useDerivedValue(() => x + Math.cos(spec.angle) * spec.dist * t.value);
  const cy = useDerivedValue(() => y + Math.sin(spec.angle) * spec.dist * t.value + 14 * t.value * t.value);
  const opacity = useDerivedValue(() => 1 - t.value);
  const r = useDerivedValue(() => spec.r * (1 - 0.5 * t.value));
  return <Circle cx={cx} cy={cy} r={r} color={spec.color} opacity={opacity} />;
}

const BurstView = memo(function BurstView({ burst, cell }: { burst: Burst; cell: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withTiming(1, { duration: 750, easing: Easing.out(Easing.cubic) });
  }, [t]);
  const specs = useMemo<ParticleSpec[]>(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        angle: (i / 18) * Math.PI * 2 + Math.random() * 0.35,
        dist: cell * (0.8 + Math.random() * 1.2),
        r: 1.8 + Math.random() * 2.6,
        color: burst.colors[i % burst.colors.length],
      })),
    [burst, cell]
  );
  const x = (burst.cell % GRID) * cell + cell / 2;
  const y = Math.floor(burst.cell / GRID) * cell + cell / 2;
  return (
    <Group>
      {specs.map((s, i) => (
        <Particle key={i} spec={s} t={t} x={x} y={y} />
      ))}
    </Group>
  );
});

// ---------------------------------------------------------------------------
// RN slojevi iznad table: tag sa nazivom pesme i "+1"

function FoodTag({
  cell,
  size,
  food,
  reveal,
  title,
}: {
  cell: number;
  size: number;
  food: SharedValue<number>;
  reveal: SharedValue<number>;
  title: string;
}) {
  const tagWidth = Math.min(160, size * 0.56);
  const tagHeight = 20;
  const style = useAnimatedStyle(() => {
    const f = food.value;
    if (f < 0) return { opacity: 0 };
    const fx = f % GRID;
    const fy = Math.floor(f / GRID);
    const left = Math.min(Math.max(fx * cell + cell / 2 - tagWidth / 2, 2), size - tagWidth - 2);
    const top = fy === 0 ? cell + 3 : fy * cell - tagHeight - 3;
    return { opacity: reveal.value, transform: [{ translateX: left }, { translateY: top }] };
  });
  return (
    <Animated.View pointerEvents="none" style={[styles.tagWrap, { width: tagWidth, height: tagHeight }, style]}>
      <View style={styles.tag}>
        <Text style={styles.tagText} numberOfLines={1}>
          {title}
        </Text>
      </View>
    </Animated.View>
  );
}

const PlusOneView = memo(function PlusOneView({ pop, cell }: { pop: PlusOne; cell: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withTiming(1, { duration: 850, easing: Easing.out(Easing.quad) });
  }, [t]);
  const style = useAnimatedStyle(() => ({
    opacity: 1 - t.value * t.value,
    transform: [{ translateY: -cell * 1.2 * t.value }, { scale: 0.8 + 0.4 * Math.min(t.value * 3, 1) }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.plusOne,
        { left: (pop.cell % GRID) * cell - cell / 2, top: Math.floor(pop.cell / GRID) * cell - cell * 0.3, width: cell * 2 },
        style,
      ]}
    >
      <Text style={styles.plusOneText}>+1</Text>
    </Animated.View>
  );
});

// ---------------------------------------------------------------------------

type BoardProps = {
  size: number;
  engine: SnakeEngine;
  /** Omoti pojedenih pesama, najnovija prva (ide odmah iza glave). */
  covers: Cover[];
  foodCover: Cover | null;
  foodTitle: string;
  bursts: Burst[];
  plusOnes: PlusOne[];
  onSwipe: (direction: number) => void;
};

export function SnakeBoard({ size, engine, covers, foodCover, foodTitle, bursts, plusOnes, onSwipe }: BoardProps) {
  const cell = size / GRID;
  const { body, prevBody, progress, food, foodReveal } = engine;
  const segmentCount = 3 + covers.length;
  const swipe = useSwipe(onSwipe);

  const checker = useMemo(() => {
    const builder = Skia.PathBuilder.Make();
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        if ((x + y) % 2 === 0) builder.addRect(Skia.XYWHRect(x * cell, y * cell, cell, cell));
      }
    }
    return builder.build();
  }, [cell]);

  return (
    <View
      style={[styles.board, { width: size, height: size }]}
      {...swipe}
    >
      <Canvas style={{ width: size, height: size }}>
        <RoundedRect x={0} y={0} width={size} height={size} r={14} color={colors.panel} />
        <Path path={checker} color="#ffffff" opacity={0.025} />
        <Food cell={cell} food={food} reveal={foodReveal} cover={foodCover} />
        {Array.from({ length: segmentCount }, (_, i) => segmentCount - 1 - i).map((index) => (
          <Segment key={index} index={index} cell={cell} body={body} prevBody={prevBody} progress={progress}>
            {index === 0 ? (
              <HeadTile cell={cell} />
            ) : index - 1 < covers.length ? (
              <CoverTile cell={cell} image={covers[index - 1].image} tint={covers[index - 1].colors[0]} />
            ) : (
              <PlainTile cell={cell} />
            )}
          </Segment>
        ))}
        {bursts.map((b) => (
          <BurstView key={b.id} burst={b} cell={cell} />
        ))}
      </Canvas>
      <FoodTag cell={cell} size={size} food={food} reveal={foodReveal} title={foodTitle} />
      {plusOnes.map((p) => (
        <PlusOneView key={p.id} pop={p} cell={cell} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  board: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    backgroundColor: colors.panel,
  },
  tagWrap: { position: 'absolute', left: 0, top: 0, alignItems: 'center', justifyContent: 'center' },
  tag: {
    maxWidth: '100%',
    paddingHorizontal: 7,
    height: 20,
    borderRadius: 6,
    justifyContent: 'center',
    backgroundColor: 'rgba(7, 6, 15, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(255, 79, 154, 0.55)',
  },
  tagText: { color: colors.text, fontFamily: fonts.bodyMedium, fontSize: 11 },
  plusOne: { position: 'absolute', alignItems: 'center' },
  plusOneText: {
    color: colors.accent,
    fontFamily: fonts.pixelBold,
    fontSize: 20,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 4,
  },
});
