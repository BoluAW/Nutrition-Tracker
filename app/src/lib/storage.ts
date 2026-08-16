import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEFAULT_SETTINGS, MealEntry, Settings, WaterEntry } from './types';

const KEYS = {
  meals: 'nt.meals.v1',
  water: 'nt.water.v1',
  settings: 'nt.settings.v1',
  pushToken: 'nt.pushToken.v1',
};

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    // A corrupt value shouldn't brick the app — start over for that key.
    return fallback;
  }
}

async function writeJson(key: string, value: unknown): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export const storage = {
  loadMeals: () => readJson<MealEntry[]>(KEYS.meals, []),
  saveMeals: (meals: MealEntry[]) => writeJson(KEYS.meals, meals),

  loadWater: () => readJson<WaterEntry[]>(KEYS.water, []),
  saveWater: (entries: WaterEntry[]) => writeJson(KEYS.water, entries),

  /** Merged with defaults so settings added in a later version don't come back undefined. */
  async loadSettings(): Promise<Settings> {
    const stored = await readJson<Partial<Settings>>(KEYS.settings, {});
    return {
      ...DEFAULT_SETTINGS,
      ...stored,
      goals: { ...DEFAULT_SETTINGS.goals, ...stored.goals },
      reminders: { ...DEFAULT_SETTINGS.reminders, ...stored.reminders },
    };
  },
  saveSettings: (settings: Settings) => writeJson(KEYS.settings, settings),

  loadPushToken: () => AsyncStorage.getItem(KEYS.pushToken),
  savePushToken: (token: string) => AsyncStorage.setItem(KEYS.pushToken, token),
};
