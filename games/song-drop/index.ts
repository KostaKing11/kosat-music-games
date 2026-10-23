import type { GameDefinition } from '../types';
import { SongDropPreview } from './SongDropPreview';
import { SongDropScreen } from './SongDropScreen';
import { loadStats } from './storage';

export const songDropGame: GameDefinition = {
  id: 'song-drop',
  title: 'Song Drop',
  tagline: 'Tapkaj drop, izvuci pesmu i ona odmah svira. Što ređe slušaš pesmu, to je ređa.',
  status: 'available',
  entryScreen: 'song-drop/open',
  minTracks: 1,
  screens: [{ name: 'song-drop/open', component: SongDropScreen }],
  Preview: SongDropPreview,
  getBadge: async (playlistId) => {
    const stats = await loadStats(playlistId);
    return stats.opened > 0 ? `Otvoreno: ${stats.opened}` : null;
  },
};
