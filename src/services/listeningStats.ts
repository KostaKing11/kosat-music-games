import AsyncStorage from '@react-native-async-storage/async-storage';

import { getRecentlyPlayed, getTopTracks, SpotifyApiError, type TopRange } from './spotifyApi';
import { hasScopes } from './spotifyAuth';

/**
 * Koliko korisnik sluša koju pesmu, na osnovu Spotify top lista
 * (4 nedelje, 6 meseci, ~godinu) i poslednjih 50 odslušanih.
 * Veći skor = pesma se više sluša. Deljeni servis – mogu ga koristiti sve igre.
 */
export const LISTENING_SCOPES = ['user-top-read', 'user-read-recently-played'];

export type ListeningStats = {
  /** uri -> skor slušanja (0 = nema podataka) */
  scores: Record<string, number>;
  status: 'ok' | 'missing-scope' | 'error';
  error?: string;
  fetchedAt: number;
};

const CACHE_KEY = 'listening:v1';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const RANGE_WEIGHTS: [TopRange, number][] = [
  ['short_term', 1.0],
  ['medium_term', 1.4],
  ['long_term', 1.8],
];
const RECENT_PLAY_BONUS = 0.5;

let memory: ListeningStats | null = null;

async function compute(): Promise<ListeningStats> {
  const scores: Record<string, number> = {};
  const add = (uri: string, value: number) => {
    scores[uri] = (scores[uri] ?? 0) + value;
  };

  const ranges = await Promise.all(RANGE_WEIGHTS.map(([range]) => getTopTracks(range)));
  ranges.forEach((tracks, i) => {
    const weight = RANGE_WEIGHTS[i][1];
    const n = Math.max(tracks.length, 50);
    tracks.forEach((t, rank) => add(t.uri, weight * (1 - rank / (n + 1))));
  });

  try {
    const recent = await getRecentlyPlayed();
    recent.forEach((t) => add(t.uri, RECENT_PLAY_BONUS));
  } catch {
    // Nedavno slušano je samo dodatak.
  }

  return { scores, status: 'ok', fetchedAt: Date.now() };
}

export async function getListeningStats(force = false): Promise<ListeningStats> {
  if (!hasScopes(LISTENING_SCOPES)) {
    return { scores: {}, status: 'missing-scope', fetchedAt: Date.now() };
  }
  if (!force && memory && Date.now() - memory.fetchedAt < CACHE_TTL_MS) return memory;
  if (!force) {
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY);
      const cached = raw ? (JSON.parse(raw) as ListeningStats) : null;
      if (cached && cached.status === 'ok' && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
        memory = cached;
        return cached;
      }
    } catch {
      // ignoriši oštećen keš
    }
  }
  try {
    const stats = await compute();
    memory = stats;
    void AsyncStorage.setItem(CACHE_KEY, JSON.stringify(stats)).catch(() => undefined);
    return stats;
  } catch (error) {
    if (error instanceof SpotifyApiError && (error.status === 401 || error.status === 403)) {
      return { scores: {}, status: 'missing-scope', fetchedAt: Date.now() };
    }
    return { scores: {}, status: 'error', error: String((error as Error)?.message ?? error), fetchedAt: Date.now() };
  }
}
