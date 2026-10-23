import { guessSongGame } from './guess-song';
import { snakeGame } from './snake';
import { songDropGame } from './song-drop';
import type { GameDefinition } from './types';

/** Registar igara. Nova igra = novi folder + jedna linija ovde. */
export const GAMES: GameDefinition[] = [snakeGame, songDropGame, guessSongGame];

export const GAME_SCREENS = GAMES.flatMap((g) => g.screens);

export type { GameDefinition } from './types';
