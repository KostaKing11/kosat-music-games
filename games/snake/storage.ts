import AsyncStorage from '@react-native-async-storage/async-storage';

export type SnakeSettings = {
  /** Pesma krene od ~35% trajanja umesto od početka. */
  chorus: boolean;
  /** Muzika ide shuffle kroz plejlistu, jedenje ne menja pesmu. */
  radio: boolean;
};

const SETTINGS_KEY = 'snake:settings:v1';
const recordKey = (playlistId: string) => `snake:record:v1:${playlistId}`;

export const DEFAULT_SETTINGS: SnakeSettings = { chorus: true, radio: false };

export async function loadSettings(): Promise<SnakeSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: SnakeSettings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)).catch(() => undefined);
}

/** Rekord se čuva posebno za svaku plejlistu. */
export async function loadRecord(playlistId: string): Promise<number> {
  try {
    return Number((await AsyncStorage.getItem(recordKey(playlistId))) ?? 0) || 0;
  } catch {
    return 0;
  }
}

export async function saveRecord(playlistId: string, score: number): Promise<void> {
  await AsyncStorage.setItem(recordKey(playlistId), String(score)).catch(() => undefined);
}
