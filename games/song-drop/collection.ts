import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Track } from '../../src/services/spotifyApi';
import type { RarityLevel } from './rarity';

/** Skupljena pesma: koliko puta je izvučena i kada. */
export type CollectedEntry = { count: number; first: number; last: number };
export type Collection = Record<string, CollectedEntry>;

export type SortMode = 'rarity' | 'artist' | 'album' | 'name' | 'recent';

export const SORT_OPTIONS: { id: SortMode; label: string }[] = [
  { id: 'rarity', label: 'Retkost' },
  { id: 'artist', label: 'Izvođač' },
  { id: 'album', label: 'Album' },
  { id: 'name', label: 'Naziv' },
  { id: 'recent', label: 'Skoro izvučene' },
];

const collectionKey = (playlistId: string) => `drop:collection:v1:${playlistId}`;

export async function loadCollection(playlistId: string): Promise<Collection> {
  try {
    const raw = await AsyncStorage.getItem(collectionKey(playlistId));
    if (raw) return JSON.parse(raw) as Collection;
  } catch {
    // ignoriši oštećen zapis
  }
  return {};
}

export async function saveCollection(playlistId: string, collection: Collection): Promise<void> {
  await AsyncStorage.setItem(collectionKey(playlistId), JSON.stringify(collection)).catch(() => undefined);
}

/** Dodaje pesmu u kolekciju; vraća novu kolekciju i koliko puta je sada izvučena. */
export function addToCollection(collection: Collection, uri: string): { next: Collection; count: number } {
  const now = Date.now();
  const prev = collection[uri];
  const entry: CollectedEntry = prev ? { ...prev, count: prev.count + 1, last: now } : { count: 1, first: now, last: now };
  return { next: { ...collection, [uri]: entry }, count: entry.count };
}

const collator = new Intl.Collator('sr', { sensitivity: 'base' });

export function sortTracks(
  tracks: Track[],
  mode: SortMode,
  tiers: Record<string, RarityLevel>,
  collection: Collection,
  collectedFirst: boolean
): Track[] {
  const byName = (a: Track, b: Track) => collator.compare(a.name, b.name);
  const compare: Record<SortMode, (a: Track, b: Track) => number> = {
    rarity: (a, b) => (tiers[b.uri] ?? 0) - (tiers[a.uri] ?? 0) || byName(a, b),
    artist: (a, b) => collator.compare(a.artist, b.artist) || collator.compare(a.album, b.album) || byName(a, b),
    album: (a, b) => collator.compare(a.album, b.album) || byName(a, b),
    name: byName,
    recent: (a, b) => (collection[b.uri]?.last ?? 0) - (collection[a.uri]?.last ?? 0) || byName(a, b),
  };
  return tracks.slice().sort((a, b) => {
    if (collectedFirst) {
      const diff = Number(!!collection[b.uri]) - Number(!!collection[a.uri]);
      if (diff !== 0) return diff;
    }
    return compare[mode](a, b);
  });
}
