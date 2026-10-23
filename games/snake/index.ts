import type { GameDefinition } from '../types';
import { SNAKE_ROUTES } from './constants';
import { GameOverScreen } from './GameOverScreen';
import { SnakePreview } from './SnakePreview';
import { SnakeScreen } from './SnakeScreen';
import { loadRecord } from './storage';

export const snakeGame: GameDefinition = {
  id: 'snake',
  title: 'Snake',
  tagline: 'Jedi omote albuma, svaka pesma krene na Spotify-ju.',
  status: 'available',
  entryScreen: SNAKE_ROUTES.play,
  minTracks: 1,
  screens: [
    { name: SNAKE_ROUTES.play, component: SnakeScreen },
    { name: SNAKE_ROUTES.over, component: GameOverScreen },
  ],
  Preview: SnakePreview,
  getBadge: async (playlistId) => {
    const record = await loadRecord(playlistId);
    return record > 0 ? `Rekord: ${record}` : null;
  },
};
