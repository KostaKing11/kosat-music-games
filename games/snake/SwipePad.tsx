import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming, type SharedValue } from 'react-native-reanimated';

import { colors, fonts, radius } from '../../src/theme';
import { useSwipe } from './useSwipe';

const LABELS = ['GORE', 'DESNO', 'DOLE', 'LEVO'];

function flash(value: SharedValue<number>) {
  value.value = withSequence(withTiming(1, { duration: 60 }), withTiming(0, { duration: 380, easing: Easing.out(Easing.quad) }));
}

/** Veliko polje ispod table – kontrola swipe-om, bez dugmića. */
export function SwipePad({ onTurn, disabled }: { onTurn: (dir: number) => void; disabled?: boolean }) {
  const up = useSharedValue(0);
  const right = useSharedValue(0);
  const down = useSharedValue(0);
  const left = useSharedValue(0);

  const handle = useCallback(
    (dir: number) => {
      if (disabled) return;
      onTurn(dir);
      flash([up, right, down, left][dir]);
    },
    [disabled, onTurn, up, right, down, left]
  );
  const swipe = useSwipe(handle);

  // Isti stil (prozirnost) koristi i ivica i natpis za taj smer.
  const flashStyles = [
    useAnimatedStyle(() => ({ opacity: up.value })),
    useAnimatedStyle(() => ({ opacity: right.value })),
    useAnimatedStyle(() => ({ opacity: down.value })),
    useAnimatedStyle(() => ({ opacity: left.value })),
  ];
  const restStyle = useAnimatedStyle(() => ({
    opacity: 1 - Math.max(up.value, right.value, down.value, left.value),
  }));

  return (
    <View style={[styles.pad, disabled && styles.disabled]} {...swipe}>
      <Animated.View pointerEvents="none" style={[styles.edge, styles.edgeTop, flashStyles[0]]} />
      <Animated.View pointerEvents="none" style={[styles.edge, styles.edgeRight, flashStyles[1]]} />
      <Animated.View pointerEvents="none" style={[styles.edge, styles.edgeBottom, flashStyles[2]]} />
      <Animated.View pointerEvents="none" style={[styles.edge, styles.edgeLeft, flashStyles[3]]} />

      <Animated.View pointerEvents="none" style={[styles.center, restStyle]}>
        <Text style={styles.title}>SWIPE OVDE</Text>
        <Text style={styles.hint}>gore · dole · levo · desno</Text>
      </Animated.View>
      {LABELS.map((label, i) => (
        <Animated.View key={label} pointerEvents="none" style={[styles.center, flashStyles[i]]}>
          <Text style={styles.direction}>{label}</Text>
        </Animated.View>
      ))}
    </View>
  );
}

const EDGE = 4;

const styles = StyleSheet.create({
  pad: {
    flex: 1,
    alignSelf: 'stretch',
    minHeight: 110,
    marginVertical: 10,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: 'rgba(17, 15, 29, 0.6)',
    overflow: 'hidden',
  },
  disabled: { opacity: 0.5 },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.textMuted, fontFamily: fonts.pixel, fontSize: 16, letterSpacing: 3 },
  hint: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12, marginTop: 4, opacity: 0.7 },
  direction: { color: colors.accent, fontFamily: fonts.pixelBold, fontSize: 30, letterSpacing: 4 },
  edge: { position: 'absolute', backgroundColor: colors.accent },
  edgeTop: { top: 0, left: 0, right: 0, height: EDGE },
  edgeBottom: { bottom: 0, left: 0, right: 0, height: EDGE },
  edgeLeft: { top: 0, bottom: 0, left: 0, width: EDGE },
  edgeRight: { top: 0, bottom: 0, right: 0, width: EDGE },
});
