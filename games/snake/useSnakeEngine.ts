import { useCallback, useMemo, useRef } from 'react';
import { useFrameCallback, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';

import { DX, DY, GRID, MIN_TICK_MS, START_LENGTH, START_TICK_MS, TICK_STEP_MS } from './constants';

export type GameOverReason = 'wall' | 'self' | 'win';

export type SnakeEngine = {
  /** Polja zmije, glava je na indeksu 0 (polje = y * GRID + x). */
  body: SharedValue<number[]>;
  /** Pozicije iz prethodnog koraka – za glatku interpolaciju. */
  prevBody: SharedValue<number[]>;
  /** 0..1 – koliko je zmija prešla od prethodnog do trenutnog polja. */
  progress: SharedValue<number>;
  food: SharedValue<number>;
  /** 0..1 – animacija iskakanja nove hrane (postavlja je JS kad je omot spreman). */
  foodReveal: SharedValue<number>;
  running: SharedValue<boolean>;
  start: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  turn: (direction: number) => void;
};

type Callbacks = {
  /** Glava je pojela hranu na polju `cell`, nova hrana je na `nextFood`. */
  onEat: (cell: number, nextFood: number, length: number) => void;
  onGameOver: (reason: GameOverReason) => void;
};

function initialBody(): number[] {
  'worklet';
  const y = Math.floor(GRID / 2);
  const x = Math.floor(GRID / 2) - 1;
  return Array.from({ length: START_LENGTH }, (_, i) => y * GRID + (x - i));
}

/**
 * Logika igre radi na UI niti (Reanimated frame callback), pa su kretanje
 * i interpolacija glatki i kada je JS nit zauzeta (npr. pozivi ka Spotify-ju).
 */
export function useSnakeEngine(callbacks: Callbacks): SnakeEngine {
  const body = useSharedValue<number[]>(initialBody());
  const prevBody = useSharedValue<number[]>(initialBody());
  const dir = useSharedValue(1);
  const queue = useSharedValue<number[]>([]);
  const food = useSharedValue(-1);
  const foodReveal = useSharedValue(0);
  const running = useSharedValue(false);
  const progress = useSharedValue(1);
  const acc = useSharedValue(0);
  const tickMs = useSharedValue(START_TICK_MS);

  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;
  const handleEat = useCallback((cell: number, nextFood: number, length: number) => {
    callbacksRef.current.onEat(cell, nextFood, length);
  }, []);
  const handleGameOver = useCallback((reason: GameOverReason) => {
    callbacksRef.current.onGameOver(reason);
  }, []);

  const randomFreeCell = (occupied: number[]) => {
    'worklet';
    const taken = new Array(GRID * GRID).fill(false);
    for (let i = 0; i < occupied.length; i++) taken[occupied[i]] = true;
    const free: number[] = [];
    for (let c = 0; c < GRID * GRID; c++) if (!taken[c]) free.push(c);
    if (free.length === 0) return -1;
    return free[Math.floor(Math.random() * free.length)];
  };

  const die = (reason: GameOverReason) => {
    'worklet';
    running.value = false;
    prevBody.value = body.value;
    progress.value = 1;
    scheduleOnRN(handleGameOver, reason);
  };

  const step = () => {
    'worklet';
    let d = dir.value;
    const q = queue.value;
    if (q.length > 0) {
      d = q[0];
      queue.value = q.slice(1);
      dir.value = d;
    }
    const b = body.value;
    const head = b[0];
    const nx = (head % GRID) + DX[d];
    const ny = Math.floor(head / GRID) + DY[d];
    if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) {
      die('wall');
      return false;
    }
    const next = ny * GRID + nx;
    const eating = next === food.value;
    // Rep se pomera u istom koraku, pa ulazak u polje repa nije sudar (osim kad zmija raste).
    const checkLength = eating ? b.length : b.length - 1;
    for (let i = 0; i < checkLength; i++) {
      if (b[i] === next) {
        die('self');
        return false;
      }
    }
    const nb = eating ? [next, ...b] : [next, ...b.slice(0, b.length - 1)];
    prevBody.value = b;
    body.value = nb;
    if (eating) {
      const nextFood = randomFreeCell(nb);
      food.value = nextFood;
      foodReveal.value = 0;
      tickMs.value = Math.max(MIN_TICK_MS, tickMs.value - TICK_STEP_MS);
      scheduleOnRN(handleEat, next, nextFood, nb.length);
      if (nextFood < 0) {
        die('win');
        return false;
      }
    }
    return true;
  };

  useFrameCallback((info) => {
    'worklet';
    if (!running.value) return;
    const dt = Math.min(info.timeSincePreviousFrame ?? 16, 64);
    let a = acc.value + dt;
    let t = tickMs.value;
    while (a >= t) {
      a -= t;
      if (!step()) {
        acc.value = 0;
        return;
      }
      t = tickMs.value;
    }
    acc.value = a;
    progress.value = Math.min(a / t, 1);
  }, true);

  const resetWorklet = () => {
    'worklet';
    const initial = initialBody();
    body.value = initial;
    prevBody.value = initial;
    dir.value = 1;
    queue.value = [];
    acc.value = 0;
    progress.value = 1;
    tickMs.value = START_TICK_MS;
    running.value = false;
    food.value = randomFreeCell(initial);
    foodReveal.value = 0;
  };

  const turnWorklet = (d: number) => {
    'worklet';
    const q = queue.value;
    const last = q.length > 0 ? q[q.length - 1] : dir.value;
    if (d === last || (d + 2) % 4 === last || q.length >= 3) return;
    queue.value = [...q, d];
  };

  const setRunning = (value: boolean) => {
    'worklet';
    running.value = value;
  };

  // Stabilan objekat – shared values se ne menjaju između rendera.
  return useMemo(
    () => ({
      body,
      prevBody,
      progress,
      food,
      foodReveal,
      running,
      start: () => scheduleOnUI(setRunning, true),
      pause: () => scheduleOnUI(setRunning, false),
      resume: () => scheduleOnUI(setRunning, true),
      reset: () => scheduleOnUI(resetWorklet),
      turn: (direction: number) => scheduleOnUI(turnWorklet, direction),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
}
