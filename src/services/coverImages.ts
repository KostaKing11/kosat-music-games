import {
  AlphaType,
  ColorType,
  FilterMode,
  MipmapMode,
  Skia,
  type SkImage,
} from '@shopify/react-native-skia';

/**
 * Učitava omote albuma kao Skia slike (smanjene na COVER_PX) i izvlači
 * paletu boja za čestice. Dele ga sve igre koje crtaju omote u Skia-i.
 */
export type Cover = { image: SkImage | null; colors: string[] };

const COVER_PX = 128;
const SAMPLE_PX = 8;
const MAX_ENTRIES = 220;
export const FALLBACK_COLORS = ['#ff4f9a', '#ff8fc3', '#b388ff', '#eeeaff'];

const cache = new Map<string, Promise<Cover>>();

function toHex(r: number, g: number, b: number) {
  const h = (n: number) => n.toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

function extractPalette(image: SkImage): string[] {
  const surface = Skia.Surface.Make(SAMPLE_PX, SAMPLE_PX);
  if (!surface) return FALLBACK_COLORS;
  const canvas = surface.getCanvas();
  canvas.drawImageRectOptions(
    image,
    Skia.XYWHRect(0, 0, image.width(), image.height()),
    Skia.XYWHRect(0, 0, SAMPLE_PX, SAMPLE_PX),
    FilterMode.Linear,
    MipmapMode.None
  );
  surface.flush();
  const pixels = surface.makeImageSnapshot().readPixels(0, 0, {
    width: SAMPLE_PX,
    height: SAMPLE_PX,
    colorType: ColorType.RGBA_8888,
    alphaType: AlphaType.Unpremul,
  });
  if (!pixels || pixels.length < SAMPLE_PX * SAMPLE_PX * 4) return FALLBACK_COLORS;

  const candidates: { hex: string; score: number; r: number; g: number; b: number }[] = [];
  for (let i = 0; i < SAMPLE_PX * SAMPLE_PX; i++) {
    const scale = pixels instanceof Float32Array ? 255 : 1;
    const r = Math.round(pixels[i * 4] * scale);
    const g = Math.round(pixels[i * 4 + 1] * scale);
    const b = Math.round(pixels[i * 4 + 2] * scale);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const saturation = max === 0 ? 0 : (max - min) / max;
    const brightness = max / 255;
    // Na tamnoj pozadini najbolje izgledaju zasićene i svetle boje.
    candidates.push({ hex: toHex(r, g, b), score: saturation * 0.65 + brightness * 0.35, r, g, b });
  }
  candidates.sort((a, b) => b.score - a.score);
  const picked: typeof candidates = [];
  for (const c of candidates) {
    if (c.score < 0.25) break;
    const distinct = picked.every((p) => Math.abs(p.r - c.r) + Math.abs(p.g - c.g) + Math.abs(p.b - c.b) > 60);
    if (distinct) picked.push(c);
    if (picked.length === 5) break;
  }
  if (picked.length === 0) return FALLBACK_COLORS;
  return picked.map((p) => p.hex);
}

async function load(url: string): Promise<Cover> {
  try {
    const data = await Skia.Data.fromURI(url);
    const original = Skia.Image.MakeImageFromEncoded(data);
    if (!original) return { image: null, colors: FALLBACK_COLORS };
    const surface = Skia.Surface.Make(COVER_PX, COVER_PX);
    let image: SkImage = original;
    if (surface) {
      surface
        .getCanvas()
        .drawImageRectOptions(
          original,
          Skia.XYWHRect(0, 0, original.width(), original.height()),
          Skia.XYWHRect(0, 0, COVER_PX, COVER_PX),
          FilterMode.Linear,
          MipmapMode.Linear
        );
      surface.flush();
      image = surface.makeImageSnapshot();
    }
    return { image, colors: extractPalette(image) };
  } catch {
    return { image: null, colors: FALLBACK_COLORS };
  }
}

export function loadCover(url: string | null | undefined): Promise<Cover> {
  if (!url) return Promise.resolve({ image: null, colors: FALLBACK_COLORS });
  let entry = cache.get(url);
  if (!entry) {
    entry = load(url);
    cache.set(url, entry);
    if (cache.size > MAX_ENTRIES) {
      const oldest = cache.keys().next().value;
      if (oldest) cache.delete(oldest);
    }
  }
  return entry;
}

/** Unapred učitaj omote da hrana iskoči bez čekanja. */
export function prefetchCovers(urls: (string | null | undefined)[]) {
  urls.forEach((u) => void loadCover(u));
}
