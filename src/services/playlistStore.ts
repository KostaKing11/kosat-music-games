import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  SpotifyApiError,
  getLikedSongsSummary,
  getLikedTracks,
  getMe,
  getMyPlaylists,
  getPlaylistTracks,
  type Me,
  type PlaylistSummary,
  type Track,
} from './spotifyApi';
import { createStore } from './store';

const KEY_ME = 'me:v1';
const KEY_PLAYLISTS = 'playlists:v1';
const KEY_SELECTED = 'selected:v1';
// v2: pesme imaju i addedAt i veliki omot.
const tracksKey = (id: string) => `tracks:v2:${id}`;

type TrackCache = { snapshotId: string | null; savedAt: number; tracks: Track[] };

export type PlaylistsState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  me: Me | null;
  playlists: PlaylistSummary[];
  error: string | null;
};

export type SelectionState = {
  playlist: PlaylistSummary | null;
  status: 'idle' | 'loading' | 'ready' | 'error' | 'unavailable';
  tracks: Track[];
  loaded: number;
  total: number | null;
  error: string | null;
  /** true dok se u pozadini proverava da li je keš zastareo */
  refreshing: boolean;
};

export const playlistsStore = createStore<PlaylistsState>({
  status: 'idle',
  me: null,
  playlists: [],
  error: null,
});

export const selectionStore = createStore<SelectionState>({
  playlist: null,
  status: 'idle',
  tracks: [],
  loaded: 0,
  total: null,
  error: null,
  refreshing: false,
});

async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

async function writeJson(key: string, value: unknown) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Keš nije kritičan.
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof SpotifyApiError) {
    if (error.status === 403) return 'Spotify ne dozvoljava pristup (403).';
    if (error.status === 404) return 'Nije pronađeno na Spotify-ju.';
    return error.message;
  }
  const msg = String((error as Error)?.message ?? error);
  if (/network request failed/i.test(msg)) return 'Nema interneta.';
  return msg;
}

/** Podaci za prvi prikaz bez čekanja mreže (poslednja lista i izbor). */
export async function hydrate(): Promise<PlaylistSummary | null> {
  const [me, playlists, selected] = await Promise.all([
    readJson<Me>(KEY_ME),
    readJson<PlaylistSummary[]>(KEY_PLAYLISTS),
    readJson<PlaylistSummary>(KEY_SELECTED),
  ]);
  if (playlists) {
    playlistsStore.set((s) => ({ ...s, me: me ?? s.me, playlists, status: s.status === 'idle' ? 'ready' : s.status }));
  }
  if (selected) {
    void selectPlaylist(selected);
  }
  return selected;
}

export async function loadPlaylists(): Promise<void> {
  playlistsStore.set((s) => ({ ...s, status: s.playlists.length ? s.status : 'loading', error: null }));
  try {
    const me = await getMe();
    const [liked, playlists] = await Promise.all([getLikedSongsSummary(me), getMyPlaylists(me)]);
    const all = [liked, ...playlists];
    playlistsStore.set({ status: 'ready', me, playlists: all, error: null });
    void writeJson(KEY_ME, me);
    void writeJson(KEY_PLAYLISTS, all);

    // Osveži podatke izabrane plejliste (naziv, snapshot) ako se promenila.
    const current = selectionStore.get().playlist;
    const fresh = current && all.find((p) => p.id === current.id);
    if (fresh && fresh.snapshotId !== current.snapshotId) {
      void selectPlaylist(fresh);
    }
  } catch (error) {
    playlistsStore.set((s) => ({ ...s, status: s.playlists.length ? 'ready' : 'error', error: errorMessage(error) }));
  }
}

let selectToken = 0;

export async function selectPlaylist(playlist: PlaylistSummary): Promise<void> {
  const token = ++selectToken;
  void writeJson(KEY_SELECTED, playlist);

  if (!playlist.accessible) {
    selectionStore.set({
      playlist,
      status: 'unavailable',
      tracks: [],
      loaded: 0,
      total: playlist.total,
      error: null,
      refreshing: false,
    });
    return;
  }

  const cached = await readJson<TrackCache>(tracksKey(playlist.id));
  if (token !== selectToken) return;

  const cacheFresh = !!cached && !!playlist.snapshotId && cached.snapshotId === playlist.snapshotId;
  if (cached && cached.tracks.length > 0) {
    selectionStore.set({
      playlist,
      status: 'ready',
      tracks: cached.tracks,
      loaded: cached.tracks.length,
      total: cached.tracks.length,
      error: null,
      refreshing: !cacheFresh,
    });
    if (cacheFresh) return;
  } else {
    selectionStore.set({
      playlist,
      status: 'loading',
      tracks: [],
      loaded: 0,
      total: playlist.total,
      error: null,
      refreshing: false,
    });
  }

  try {
    const onProgress = (loaded: number, total: number | null) => {
      if (token !== selectToken) return;
      selectionStore.set((s) => (s.status === 'loading' ? { ...s, loaded, total: total ?? s.total } : s));
    };
    const tracks =
      playlist.kind === 'liked' ? await getLikedTracks(onProgress) : await getPlaylistTracks(playlist.id, onProgress);
    if (token !== selectToken) return;
    selectionStore.set({
      playlist,
      status: 'ready',
      tracks,
      loaded: tracks.length,
      total: tracks.length,
      error: null,
      refreshing: false,
    });
    void writeJson(tracksKey(playlist.id), { snapshotId: playlist.snapshotId, savedAt: Date.now(), tracks });
  } catch (error) {
    if (token !== selectToken) return;
    const forbidden = error instanceof SpotifyApiError && (error.status === 403 || error.status === 404);
    selectionStore.set((s) => {
      if (s.status === 'ready' && s.tracks.length > 0) return { ...s, refreshing: false };
      return {
        ...s,
        status: forbidden ? 'unavailable' : 'error',
        error: errorMessage(error),
        refreshing: false,
      };
    });
  }
}

export function retrySelection() {
  const playlist = selectionStore.get().playlist;
  if (playlist) void selectPlaylist(playlist);
}

export async function clearAll(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  await AsyncStorage.multiRemove(
    keys.filter((k) => k === KEY_ME || k === KEY_PLAYLISTS || k === KEY_SELECTED || k.startsWith('tracks:'))
  );
  playlistsStore.set({ status: 'idle', me: null, playlists: [], error: null });
  selectionStore.set({ playlist: null, status: 'idle', tracks: [], loaded: 0, total: null, error: null, refreshing: false });
}

export const UNAVAILABLE_EXPLANATION =
  'Od februara 2026. Spotify aplikacijama u razvojnom režimu daje sadržaj samo onih plejlista koje si ti napravio ili u kojima si saradnik. ' +
  'Za tuđu plejlistu: u Spotify-ju otvori plejlistu, izaberi „Dodaj u drugu plejlistu“ i napravi svoju kopiju, pa nju izaberi ovde.';
