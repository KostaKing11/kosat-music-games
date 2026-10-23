import type { GameDefinition } from '../types';
import { SongDropPreview } from './SongDropPreview';
import { SongDropScreen } from './SongDropScreen';
import { loadCollection } from './collection';
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
    const [stats, collection] = await Promise.all([loadStats(playlistId), loadCollection(playlistId)]);
    const collected = Object.keys(collection).length;
    return stats.opened > 0 ? `Kolekcija: ${collected}` : null;
  },
};
