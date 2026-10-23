import AsyncStorage from '@react-native-async-storage/async-storage';

export type DropStats = { opened: number; byLevel: number[] };
export type DropSettings = { chorus: boolean };

const statsKey = (playlistId: string) => `drop:stats:v1:${playlistId}`;
const SETTINGS_KEY = 'drop:settings:v1';

export async function loadStats(playlistId: string): Promise<DropStats> {
  try {
    const raw = await AsyncStorage.getItem(statsKey(playlistId));
    if (raw) return JSON.parse(raw) as DropStats;
  } catch {
    // ignoriši
  }
  return { opened: 0, byLevel: [0, 0, 0, 0, 0] };
}

export async function saveStats(playlistId: string, stats: DropStats): Promise<void> {
  await AsyncStorage.setItem(statsKey(playlistId), JSON.stringify(stats)).catch(() => undefined);
}

export async function loadSettings(): Promise<DropSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (raw) return { chorus: true, ...JSON.parse(raw) };
  } catch {
    // ignoriši
  }
  return { chorus: true };
}

export async function saveSettings(settings: DropSettings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)).catch(() => undefined);
}
