import { getAccessToken } from './spotifyAuth';

const API = 'https://api.spotify.com/v1';
const PAGE_SIZE = 50;

export type Track = {
  id: string;
  uri: string;
  name: string;
  artist: string;
  album: string;
  durationMs: number;
  /** Omot ~300px – za Skia hranu i rep zmije. */
  coverUrl: string | null;
  /** Najmanji omot (~64px) – za liste. */
  thumbUrl: string | null;
  /** Najveći omot (~640px) – za velike prikaze. */
  coverLargeUrl?: string | null;
  /** Kada je pesma dodata u plejlistu / Liked Songs (ISO datum). */
  addedAt?: string | null;
};

export type PlaylistSummary = {
  id: string;
  uri: string;
  kind: 'playlist' | 'liked';
  name: string;
  imageUrl: string | null;
  total: number | null;
  ownerId: string;
  ownerName: string;
  collaborative: boolean;
  /** Spotify (od februara 2026) daje sadržaj samo za moje i zajedničke plejliste. */
  accessible: boolean;
  snapshotId: string | null;
};

export type Me = { id: string; displayName: string; product: string | null };

export type Device = {
  id: string | null;
  name: string;
  type: string;
  isActive: boolean;
  isRestricted: boolean;
};

export class SpotifyApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public reason?: string
  ) {
    super(message);
    this.name = 'SpotifyApiError';
  }
}

type Json = Record<string, any>;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Fetch sa tokenom, ponovnim pokušajem na 401 (refresh) i 429 (Retry-After). */
export async function apiFetch(path: string, init: RequestInit = {}, attempt = 0): Promise<Json | null> {
  const token = await getAccessToken(attempt > 0 && attempt < 2);
  const url = path.startsWith('http') ? path : `${API}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : null),
      ...(init.headers as Record<string, string> | undefined),
    },
  });

  if (res.status === 401 && attempt === 0) {
    return apiFetch(path, init, 1);
  }
  if (res.status === 429 && attempt < 3) {
    const retryAfter = Number(res.headers.get('Retry-After') ?? '1');
    await sleep(Math.min(Math.max(retryAfter, 1), 10) * 1000);
    return apiFetch(path, init, attempt + 2);
  }
  if (res.status === 204 || res.status === 202) return null;

  const text = await res.text();
  let body: Json | null = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }
  if (!res.ok) {
    const err = isObject(body?.error) ? body!.error : {};
    throw new SpotifyApiError(res.status, err.message || `Spotify greška ${res.status}`, err.reason);
  }
  return body;
}

function pickImage(images: unknown, target: number): string | null {
  if (!Array.isArray(images) || images.length === 0) return null;
  const list = images.filter((i) => isObject(i) && typeof i.url === 'string') as {
    url: string;
    width?: number | null;
  }[];
  if (list.length === 0) return null;
  const sized = list.filter((i) => typeof i.width === 'number');
  if (sized.length === 0) return list[0].url;
  sized.sort((a, b) => (a.width ?? 0) - (b.width ?? 0));
  return (sized.find((i) => (i.width ?? 0) >= target) ?? sized[sized.length - 1]).url;
}

function parseTrack(raw: unknown): Track | null {
  if (!isObject(raw)) return null;
  if (raw.type && raw.type !== 'track') return null;
  if (raw.is_local || typeof raw.uri !== 'string' || !raw.uri.startsWith('spotify:track:')) return null;
  const album = isObject(raw.album) ? raw.album : {};
  const artists = Array.isArray(raw.artists) ? raw.artists : [];
  return {
    id: String(raw.id ?? raw.uri.split(':').pop()),
    uri: raw.uri,
    name: String(raw.name ?? 'Nepoznata pesma'),
    artist: artists.map((a: Json) => a?.name).filter(Boolean).join(', ') || 'Nepoznat izvođač',
    album: String(album.name ?? ''),
    durationMs: Number(raw.duration_ms ?? 0),
    coverUrl: pickImage(album.images, 250),
    thumbUrl: pickImage(album.images, 60),
    coverLargeUrl: pickImage(album.images, 600),
  };
}

/**
 * Stavka plejliste/biblioteke. Od februara 2026 objekat pesme je u polju `item`
 * (ranije `track`, koje sada ume da bude i boolean), pa proveravamo oba.
 */
function trackFromEntry(entry: unknown): Track | null {
  if (!isObject(entry)) return null;
  const raw = isObject(entry.item) ? entry.item : isObject(entry.track) ? entry.track : null;
  const track = parseTrack(raw);
  if (track && typeof entry.added_at === 'string') track.addedAt = entry.added_at;
  return track;
}

/** Ukupan broj pesama: novo polje `items.total`, staro `tracks.total`. */
function playlistTotal(raw: Json): number | null {
  if (isObject(raw.items) && typeof raw.items.total === 'number') return raw.items.total;
  if (isObject(raw.tracks) && typeof raw.tracks.total === 'number') return raw.tracks.total;
  return null;
}

export async function getMe(): Promise<Me> {
  const body = (await apiFetch('/me')) ?? {};
  return { id: String(body.id), displayName: body.display_name || body.id, product: body.product ?? null };
}

export async function getMyPlaylists(me: Me): Promise<PlaylistSummary[]> {
  const result: PlaylistSummary[] = [];
  let next: string | null = `/me/playlists?limit=${PAGE_SIZE}`;
  while (next) {
    const body: Json = (await apiFetch(next)) ?? {};
    for (const raw of Array.isArray(body.items) ? body.items : []) {
      if (!isObject(raw) || typeof raw.id !== 'string') continue;
      const owner = isObject(raw.owner) ? raw.owner : {};
      const ownerId = String(owner.id ?? '');
      const collaborative = !!raw.collaborative;
      result.push({
        id: raw.id,
        uri: raw.uri ?? `spotify:playlist:${raw.id}`,
        kind: 'playlist',
        name: String(raw.name ?? 'Bez naziva'),
        imageUrl: pickImage(raw.images, 120),
        total: playlistTotal(raw),
        ownerId,
        ownerName: String(owner.display_name ?? ownerId),
        collaborative,
        accessible: ownerId === me.id || collaborative,
        snapshotId: raw.snapshot_id ?? null,
      });
    }
    next = typeof body.next === 'string' ? body.next : null;
  }
  return result;
}

export async function getLikedSongsSummary(me: Me): Promise<PlaylistSummary> {
  const body = (await apiFetch('/me/tracks?limit=1')) ?? {};
  return {
    id: 'liked',
    uri: `spotify:user:${me.id}:collection`,
    kind: 'liked',
    name: 'Pesme koje voliš',
    imageUrl: null,
    total: typeof body.total === 'number' ? body.total : null,
    ownerId: me.id,
    ownerName: me.displayName,
    collaborative: false,
    accessible: true,
    snapshotId: typeof body.total === 'number' ? `count:${body.total}` : null,
  };
}

async function collectTracks(
  firstUrl: string,
  onProgress?: (loaded: number, total: number | null) => void
): Promise<Track[]> {
  const tracks: Track[] = [];
  const seen = new Set<string>();
  let next: string | null = firstUrl;
  while (next) {
    const body: Json = (await apiFetch(next)) ?? {};
    for (const entry of Array.isArray(body.items) ? body.items : []) {
      const track = trackFromEntry(entry);
      if (track && !seen.has(track.uri)) {
        seen.add(track.uri);
        tracks.push(track);
      }
    }
    onProgress?.(tracks.length, typeof body.total === 'number' ? body.total : null);
    next = typeof body.next === 'string' ? body.next : null;
  }
  return tracks;
}

/** GET /playlists/{id}/items (NE /tracks), sa paginacijom. */
export function getPlaylistTracks(
  playlistId: string,
  onProgress?: (loaded: number, total: number | null) => void
): Promise<Track[]> {
  return collectTracks(
    `/playlists/${encodeURIComponent(playlistId)}/items?limit=${PAGE_SIZE}&additional_types=track&market=from_token`,
    onProgress
  );
}

/** GET /me/tracks – Liked Songs. */
export function getLikedTracks(onProgress?: (loaded: number, total: number | null) => void): Promise<Track[]> {
  return collectTracks(`/me/tracks?limit=${PAGE_SIZE}&market=from_token`, onProgress);
}

// ---------------------------------------------------------------------------
// Statistika slušanja (scope-ovi user-top-read i user-read-recently-played)

export type TopRange = 'short_term' | 'medium_term' | 'long_term';

/** Najslušanije pesme za period (do 100: dve strane po 50). */
export async function getTopTracks(range: TopRange): Promise<Track[]> {
  const first = (await apiFetch(`/me/top/tracks?time_range=${range}&limit=50`)) ?? {};
  const tracks = (Array.isArray(first.items) ? first.items : []).map(parseTrack).filter(Boolean) as Track[];
  if (typeof first.next === 'string' && tracks.length === 50) {
    try {
      const second = (await apiFetch(first.next)) ?? {};
      tracks.push(...((Array.isArray(second.items) ? second.items : []).map(parseTrack).filter(Boolean) as Track[]));
    } catch {
      // Druga strana nije obavezna.
    }
  }
  return tracks;
}

/** Poslednjih 50 odslušanih pesama. */
export async function getRecentlyPlayed(): Promise<Track[]> {
  const body = (await apiFetch('/me/player/recently-played?limit=50')) ?? {};
  return (Array.isArray(body.items) ? body.items : []).map(trackFromEntry).filter(Boolean) as Track[];
}

// ---------------------------------------------------------------------------
// Player (Web API) – koristi se kao rezerva kada App Remote ne može da se poveže.

export async function getDevices(): Promise<Device[]> {
  const body = (await apiFetch('/me/player/devices')) ?? {};
  return (Array.isArray(body.devices) ? body.devices : []).map((d: Json) => ({
    id: d.id ?? null,
    name: String(d.name ?? ''),
    type: String(d.type ?? ''),
    isActive: !!d.is_active,
    isRestricted: !!d.is_restricted,
  }));
}

export async function startPlayback(
  deviceId: string,
  options: { uris?: string[]; contextUri?: string; positionMs?: number }
): Promise<void> {
  const body: Json = {};
  if (options.uris) body.uris = options.uris;
  if (options.contextUri) body.context_uri = options.contextUri;
  if (options.positionMs && options.positionMs > 0) body.position_ms = Math.floor(options.positionMs);
  await apiFetch(`/me/player/play?device_id=${encodeURIComponent(deviceId)}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function pausePlayback(deviceId: string): Promise<void> {
  await apiFetch(`/me/player/pause?device_id=${encodeURIComponent(deviceId)}`, { method: 'PUT' });
}

export async function resumePlayback(deviceId: string): Promise<void> {
  await apiFetch(`/me/player/play?device_id=${encodeURIComponent(deviceId)}`, { method: 'PUT' });
}

export async function seekPlayback(deviceId: string, positionMs: number): Promise<void> {
  await apiFetch(
    `/me/player/seek?position_ms=${Math.floor(positionMs)}&device_id=${encodeURIComponent(deviceId)}`,
    { method: 'PUT' }
  );
}

export async function setShufflePlayback(deviceId: string, state: boolean): Promise<void> {
  await apiFetch(`/me/player/shuffle?state=${state}&device_id=${encodeURIComponent(deviceId)}`, {
    method: 'PUT',
  });
}
