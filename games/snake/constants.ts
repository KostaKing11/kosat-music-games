export const GRID = 12;

/** Smerovi: 0 gore, 1 desno, 2 dole, 3 levo */
export const DX = [0, 1, 0, -1];
export const DY = [-1, 0, 1, 0];
export type Direction = 0 | 1 | 2 | 3;

export const START_LENGTH = 3;
export const START_TICK_MS = 240;
export const MIN_TICK_MS = 85;
/** Koliko se ubrzava zmija sa svakom pojedenom pesmom. */
export const TICK_STEP_MS = 9;

/** "Počni od refrena" – pesma krene od ~35% trajanja. */
export const CHORUS_FRACTION = 0.35;

export const SNAKE_ROUTES = {
  play: 'snake/play',
  over: 'snake/over',
} as const;
