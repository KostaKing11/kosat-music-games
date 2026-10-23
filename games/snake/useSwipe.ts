import { useRef } from 'react';
import type { GestureResponderEvent, ViewProps } from 'react-native';

const SWIPE_THRESHOLD = 16;

/**
 * Swipe kontrola za bilo koji View: svaki pomeraj veći od praga je jedno
 * skretanje, pa jedan potez prstom može da napravi i "L" (dva skretanja).
 * Smerovi: 0 gore, 1 desno, 2 dole, 3 levo.
 */
export function useSwipe(onSwipe: (direction: number) => void): ViewProps {
  const origin = useRef<{ x: number; y: number } | null>(null);
  const onSwipeRef = useRef(onSwipe);
  onSwipeRef.current = onSwipe;

  const start = (e: GestureResponderEvent) => {
    origin.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
  };
  const move = (e: GestureResponderEvent) => {
    const o = origin.current;
    if (!o) return;
    const dx = e.nativeEvent.pageX - o.x;
    const dy = e.nativeEvent.pageY - o.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_THRESHOLD) return;
    if (Math.abs(dx) > Math.abs(dy)) onSwipeRef.current(dx > 0 ? 1 : 3);
    else onSwipeRef.current(dy > 0 ? 2 : 0);
    origin.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
  };

  return {
    onStartShouldSetResponder: () => true,
    onMoveShouldSetResponder: () => true,
    onResponderTerminationRequest: () => false,
    onResponderGrant: start,
    onResponderMove: move,
    onResponderRelease: () => {
      origin.current = null;
    },
    onResponderTerminate: () => {
      origin.current = null;
    },
  };
}
