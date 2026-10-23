import type { Track } from '../../src/services/spotifyApi';

export type RarityLevel = 0 | 1 | 2 | 3 | 4;

/**
 * Retkosti kao Starr Drop. `share` = koliki deo plejliste pripada retkosti
 * (najslušanije pesme su najčešće), `odds` = šansa da drop završi na toj retkosti.
 */
export const RARITIES = [
  { name: 'RETKA', color: '#3ddc97', dark: '#0d5c3b', share: 0.4, odds: 0.5 },
  { name: 'SUPER RETKA', color: '#3fa9ff', dark: '#0f4579', share: 0.28, odds: 0.28 },
  { name: 'EPSKA', color: '#b45cff', dark: '#45197d', share: 0.18, odds: 0.15 },
  { name: 'MITSKA', color: '#ff3d5a', dark: '#7a0d1f', share: 0.1, odds: 0.05 },
  { name: 'LEGENDARNA', color: '#ffd23f', dark: '#7a5a00', share: 0.04, odds: 0.02 },
] as const;

export const TAPS_TO_OPEN = 4;

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function addedTime(t: Track): number {
  const time = t.addedAt ? Date.parse(t.addedAt) : NaN;
  return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER;
}

/**
 * Raspoređuje pesme po retkosti: što više slušaš pesmu, to je češća.
 * Pesme bez podataka o slušanju: ranije dodate su češće (duže ih imaš),
 * a za isti datum odlučuje stabilan hash da raspored ne skače.
 */
export function assignTiers(tracks: Track[], scores: Record<string, number>): Record<string, RarityLevel> {
  const sorted = tracks.slice().sort((a, b) => {
    const diff = (scores[b.uri] ?? 0) - (scores[a.uri] ?? 0);
    if (diff !== 0) return diff;
    const added = addedTime(a) - addedTime(b);
    if (added !== 0) return added;
    return hash(a.id) - hash(b.id);
  });
  const cumulative: number[] = [];
  RARITIES.reduce((sum, r, i) => (cumulative[i] = sum + r.share), 0);
  const tiers: Record<string, RarityLevel> = {};
  sorted.forEach((t, i) => {
    const fraction = (i + 0.5) / sorted.length;
    const level = cumulative.findIndex((c) => fraction <= c + 1e-9);
    tiers[t.uri] = (level < 0 ? RARITIES.length - 1 : level) as RarityLevel;
  });
  return tiers;
}

export function rollRarity(): RarityLevel {
  let r = Math.random();
  for (let i = 0; i < RARITIES.length; i++) {
    r -= RARITIES[i].odds;
    if (r <= 0) return i as RarityLevel;
  }
  return 0;
}

/** Bira pesmu tražene retkosti (ili najbliže ako je ta prazna), izbegava skoro izvučene. */
export function pickTrack(
  tracks: Track[],
  tiers: Record<string, RarityLevel>,
  wanted: RarityLevel,
  recent: Set<string>
): { track: Track; level: RarityLevel } | null {
  const order: number[] = [wanted];
  for (let d = 1; d < RARITIES.length; d++) {
    if (wanted - d >= 0) order.push(wanted - d);
    if (wanted + d < RARITIES.length) order.push(wanted + d);
  }
  for (const level of order) {
    const pool = tracks.filter((t) => tiers[t.uri] === level);
    if (pool.length === 0) continue;
    const fresh = pool.filter((t) => !recent.has(t.uri));
    const from = fresh.length > 0 ? fresh : pool;
    return { track: from[Math.floor(Math.random() * from.length)], level: level as RarityLevel };
  }
  return null;
}

/** Na kojim tapovima drop "skoči" na višu retkost (kao Starr Drop). */
export function planUpgrades(level: RarityLevel): boolean[] {
  const slots = Array.from({ length: TAPS_TO_OPEN }, (_, i) => i);
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }
  const chosen = new Set(slots.slice(0, level));
  return Array.from({ length: TAPS_TO_OPEN }, (_, i) => chosen.has(i));
}

/** Svetlija varijanta boje (za gradijent). */
export function lighten(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}
