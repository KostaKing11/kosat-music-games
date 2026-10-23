import { Linking } from 'react-native';
import * as Device from 'expo-device';

import SpotifyRemote, { remoteErrorCode, type RemotePlayerState } from '../../modules/spotify-remote';
import {
  SPOTIFY_CLIENT_ID,
  SPOTIFY_PLAY_STORE_URL,
  SPOTIFY_PLAY_STORE_WEB_URL,
  SPOTIFY_REDIRECT_URI,
} from '../config';
import {
  SpotifyApiError,
  getDevices,
  pausePlayback,
  resumePlayback,
  seekPlayback,
  setShufflePlayback,
  startPlayback,
  type PlaylistSummary,
  type Track,
} from './spotifyApi';
import { createStore } from './store';

/**
 * Zajednički player za sve igre.
 * 1) Spotify App Remote SDK (lokalni Expo modul) – direktno kontroliše Spotify app na telefonu.
 * 2) Rezerva: Web API player endpoint-i, uvek sa device_id ovog telefona.
 */
export type PlayerMode = 'idle' | 'connecting' | 'remote' | 'web' | 'no-device' | 'not-installed' | 'error';

export type PlayerStatus = { mode: PlayerMode; message: string | null };

export const playerStore = createStore<PlayerStatus>({ mode: 'idle', message: null });
export const nowPlayingStore = createStore<RemotePlayerState | null>(null);

export class PlayerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlayerError';
  }
}

const CONNECT_TIMEOUT_MS = 20_000;
const RECONNECT_TIMEOUT_MS = 6_000;

let webDeviceId: string | null = null;
let preparing: Promise<PlayerMode> | null = null;

SpotifyRemote?.addListener('onPlayerState', (state) => nowPlayingStore.set(state));
SpotifyRemote?.addListener('onDisconnected', () => {
  if (playerStore.get().mode === 'remote') {
    playerStore.set({ mode: 'idle', message: null });
  }
});

function setStatus(mode: PlayerMode, message: string | null = null) {
  playerStore.set({ mode, message });
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new PlayerError('Isteklo vreme za povezivanje')), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

export function isSpotifyInstalled(): boolean {
  if (!SpotifyRemote) return true; // bez nativnog modula ne možemo da proverimo
  try {
    return SpotifyRemote.isSpotifyInstalled();
  } catch {
    return true;
  }
}

export async function openSpotify(): Promise<void> {
  try {
    if (SpotifyRemote?.openSpotify()) return;
  } catch {
    // probaj preko linka
  }
  await Linking.openURL('spotify:').catch(() => openPlayStore());
}

export async function openPlayStore(): Promise<void> {
  try {
    await Linking.openURL(SPOTIFY_PLAY_STORE_URL);
  } catch {
    await Linking.openURL(SPOTIFY_PLAY_STORE_WEB_URL);
  }
}

function webErrorMessage(error: unknown): string {
  if (error instanceof SpotifyApiError) {
    if (error.reason === 'PREMIUM_REQUIRED' || /premium/i.test(error.message)) {
      return 'Za puštanje muzike potreban je Spotify Premium.';
    }
    if (error.status === 404) return 'Spotify na telefonu nije aktivan.';
    if (error.status === 403) return 'Spotify je odbio komandu (403).';
    return error.message;
  }
  return String((error as Error)?.message ?? error);
}

/** Pronalazi Spotify Connect uređaj koji je baš ovaj telefon. */
async function findPhoneDevice(): Promise<string | null> {
  const devices = (await getDevices()).filter((d) => d.id && !d.isRestricted);
  const phones = devices.filter((d) => d.type.toLowerCase() === 'smartphone');
  if (phones.length === 0) return null;
  const names = [Device.deviceName, Device.modelName]
    .filter((n): n is string => !!n)
    .map((n) => n.toLowerCase());
  const byName = phones.find((d) => names.some((n) => d.name.toLowerCase() === n || d.name.toLowerCase().includes(n)));
  const pick = byName ?? phones.find((d) => d.isActive) ?? phones[0];
  return pick.id;
}

async function prepareWeb(): Promise<PlayerMode> {
  try {
    const id = await findPhoneDevice();
    if (id) {
      webDeviceId = id;
      setStatus('web');
      return 'web';
    }
    webDeviceId = null;
    setStatus('no-device', 'Otvori Spotify i pusti bilo šta, pa se vrati');
    return 'no-device';
  } catch (error) {
    setStatus('error', webErrorMessage(error));
    return 'error';
  }
}

async function doPrepare(): Promise<PlayerMode> {
  if (!isSpotifyInstalled()) {
    setStatus('not-installed', 'Spotify aplikacija nije instalirana na telefonu.');
    return 'not-installed';
  }
  if (SpotifyRemote) {
    if (SpotifyRemote.isConnected()) {
      setStatus('remote');
      return 'remote';
    }
    setStatus('connecting');
    try {
      await withTimeout(SpotifyRemote.connect(SPOTIFY_CLIENT_ID, SPOTIFY_REDIRECT_URI), CONNECT_TIMEOUT_MS);
      setStatus('remote');
      return 'remote';
    } catch (error) {
      if (remoteErrorCode(error) === 'NOT_INSTALLED') {
        setStatus('not-installed', 'Spotify aplikacija nije instalirana na telefonu.');
        return 'not-installed';
      }
      // Nastavi na Web API rezervu.
    }
  }
  setStatus('connecting');
  return prepareWeb();
}

/** Povezuje se na Spotify: prvo App Remote, pa Web API rezerva. */
export function preparePlayer(): Promise<PlayerMode> {
  if (!preparing) {
    preparing = doPrepare().finally(() => {
      preparing = null;
    });
  }
  return preparing;
}

async function reconnectRemote(): Promise<boolean> {
  if (!SpotifyRemote) return false;
  try {
    await withTimeout(SpotifyRemote.connect(SPOTIFY_CLIENT_ID, SPOTIFY_REDIRECT_URI), RECONNECT_TIMEOUT_MS);
    setStatus('remote');
    return true;
  } catch {
    return false;
  }
}

async function ensureMode(): Promise<PlayerMode> {
  const { mode } = playerStore.get();
  if (mode === 'remote' || mode === 'web') return mode;
  if (mode === 'connecting' && preparing) return preparing;
  return preparePlayer();
}

/** Izvršava komandu preko App Remote-a, a ako veza pukne – preko Web API-ja. */
async function runCommand(
  remote: () => Promise<void>,
  web: (deviceId: string) => Promise<void>
): Promise<void> {
  let mode = await ensureMode();

  if (mode === 'remote') {
    try {
      await remote();
      return;
    } catch (error) {
      const code = remoteErrorCode(error);
      if (code === 'NOT_CONNECTED' || code === 'DISCONNECTED') {
        if (await reconnectRemote()) {
          await remote();
          return;
        }
        mode = await prepareWeb();
      } else {
        throw new PlayerError(String((error as Error)?.message ?? 'Spotify komanda nije uspela'));
      }
    }
  }

  if (mode === 'web') {
    const deviceId = webDeviceId;
    if (!deviceId) throw new PlayerError('Telefon nije pronađen među Spotify uređajima.');
    try {
      await web(deviceId);
      return;
    } catch (error) {
      if (error instanceof SpotifyApiError && error.status === 404) {
        // Uređaj je možda promenio id ili se uspavao – potraži ga ponovo jednom.
        if ((await prepareWeb()) === 'web' && webDeviceId) {
          await web(webDeviceId);
          return;
        }
      }
      throw new PlayerError(webErrorMessage(error));
    }
  }

  throw new PlayerError(playerStore.get().message ?? 'Spotify nije povezan.');
}

/** Pusti pesmu odmah, opciono od određene pozicije (npr. refren). */
export function playTrack(uri: string, positionMs = 0): Promise<void> {
  return runCommand(
    () => SpotifyRemote!.play(uri, positionMs),
    (deviceId) => startPlayback(deviceId, { uris: [uri], positionMs })
  );
}

export function pause(): Promise<void> {
  return runCommand(
    () => SpotifyRemote!.pause(),
    (deviceId) => pausePlayback(deviceId)
  );
}

export function resume(): Promise<void> {
  return runCommand(
    () => SpotifyRemote!.resume(),
    (deviceId) => resumePlayback(deviceId)
  );
}

export function seekTo(positionMs: number): Promise<void> {
  return runCommand(
    () => SpotifyRemote!.seekTo(positionMs),
    (deviceId) => seekPlayback(deviceId, positionMs)
  );
}

function shuffled<T>(items: T[]): T[] {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Radio mod: shuffle kroz celu plejlistu (ili Liked Songs). */
export function startRadio(playlist: PlaylistSummary, tracks: Track[]): Promise<void> {
  const sample = shuffled(tracks).slice(0, 100).map((t) => t.uri);
  return runCommand(
    async () => {
      await SpotifyRemote!.setShuffle(true).catch(() => undefined);
      try {
        await SpotifyRemote!.play(playlist.uri, 0);
      } catch (error) {
        if (playlist.kind !== 'liked' || sample.length === 0) throw error;
        // Neke verzije Spotify-ja ne puštaju "collection" kontekst – pusti nasumičnu pesmu pa dodaj red.
        await SpotifyRemote!.play(sample[0], 0);
        for (const uri of sample.slice(1, 20)) {
          await SpotifyRemote!.queue(uri).catch(() => undefined);
        }
      }
    },
    async (deviceId) => {
      await setShufflePlayback(deviceId, true).catch(() => undefined);
      if (playlist.kind === 'playlist') {
        await startPlayback(deviceId, { contextUri: playlist.uri });
      } else {
        await startPlayback(deviceId, { uris: sample });
      }
    }
  );
}
