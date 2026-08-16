import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { AnalysisResult } from './api';
import { dateKeyOf, todayKey } from './date';
import { rescheduleAll } from './notifications';
import { storage } from './storage';
import {
  DayTotals,
  DEFAULT_SETTINGS,
  MealEntry,
  Settings,
  WaterEntry,
} from './types';

const EMPTY_TOTALS: DayTotals = {
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  waterMl: 0,
};

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

type StoreValue = {
  ready: boolean;
  meals: MealEntry[];
  water: WaterEntry[];
  settings: Settings;
  todayTotals: DayTotals;
  totalsFor: (dateKey: string) => DayTotals;
  mealsFor: (dateKey: string) => MealEntry[];
  waterFor: (dateKey: string) => WaterEntry[];
  addMeal: (
    result: AnalysisResult,
    source: 'photo' | 'text',
    photoUri?: string,
  ) => Promise<MealEntry>;
  removeMeal: (id: string) => Promise<void>;
  addWater: (amountMl: number) => Promise<void>;
  undoLastWater: () => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  /** Pushes the current reminder config to the OS. Returns how many were scheduled. */
  syncReminders: () => Promise<number>;
};

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [water, setWater] = useState<WaterEntry[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [loadedMeals, loadedWater, loadedSettings] = await Promise.all([
        storage.loadMeals(),
        storage.loadWater(),
        storage.loadSettings(),
      ]);
      if (cancelled) return;
      setMeals(loadedMeals);
      setWater(loadedWater);
      setSettings(loadedSettings);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const totalsFor = useCallback(
    (dateKey: string): DayTotals => {
      const totals: DayTotals = { ...EMPTY_TOTALS };
      for (const meal of meals) {
        if (meal.dateKey !== dateKey) continue;
        totals.calories += meal.calories;
        totals.protein += meal.protein;
        totals.carbs += meal.carbs;
        totals.fat += meal.fat;
      }
      for (const entry of water) {
        if (entry.dateKey !== dateKey) continue;
        totals.waterMl += entry.amountMl;
      }
      return totals;
    },
    [meals, water],
  );

  const todayTotals = useMemo(() => totalsFor(todayKey()), [totalsFor]);

  const mealsFor = useCallback(
    (dateKey: string) =>
      meals
        .filter((m) => m.dateKey === dateKey)
        .sort((a, b) => b.loggedAt.localeCompare(a.loggedAt)),
    [meals],
  );

  const waterFor = useCallback(
    (dateKey: string) =>
      water
        .filter((w) => w.dateKey === dateKey)
        .sort((a, b) => b.loggedAt.localeCompare(a.loggedAt)),
    [water],
  );

  const addMeal = useCallback(
    async (result: AnalysisResult, source: 'photo' | 'text', photoUri?: string) => {
      const now = new Date();
      const entry: MealEntry = {
        id: makeId(),
        loggedAt: now.toISOString(),
        dateKey: dateKeyOf(now),
        source,
        title: result.title,
        photoUri,
        items: result.items,
        calories: result.calories,
        protein: result.protein,
        carbs: result.carbs,
        fat: result.fat,
        confidence: result.confidence,
        note: result.note,
      };
      const next = [entry, ...meals];
      setMeals(next);
      await storage.saveMeals(next);
      return entry;
    },
    [meals],
  );

  const removeMeal = useCallback(
    async (id: string) => {
      const next = meals.filter((m) => m.id !== id);
      setMeals(next);
      await storage.saveMeals(next);
    },
    [meals],
  );

  const addWater = useCallback(
    async (amountMl: number) => {
      const now = new Date();
      const entry: WaterEntry = {
        id: makeId(),
        loggedAt: now.toISOString(),
        dateKey: dateKeyOf(now),
        amountMl,
      };
      const next = [entry, ...water];
      setWater(next);
      await storage.saveWater(next);
    },
    [water],
  );

  const undoLastWater = useCallback(async () => {
    const key = todayKey();
    const todays = water
      .filter((w) => w.dateKey === key)
      .sort((a, b) => b.loggedAt.localeCompare(a.loggedAt));
    if (todays.length === 0) return;
    const next = water.filter((w) => w.id !== todays[0].id);
    setWater(next);
    await storage.saveWater(next);
  }, [water]);

  const updateSettings = useCallback(
    async (patch: Partial<Settings>) => {
      const next: Settings = {
        ...settings,
        ...patch,
        goals: { ...settings.goals, ...patch.goals },
        reminders: { ...settings.reminders, ...patch.reminders },
      };
      setSettings(next);
      await storage.saveSettings(next);
    },
    [settings],
  );

  const syncReminders = useCallback(
    () => rescheduleAll(settings.reminders, settings.goals, todayTotals),
    [settings.reminders, settings.goals, todayTotals],
  );

  // Reminder text quotes how much is left today, so it has to be rebuilt when
  // the totals move. Debounced so a burst of edits results in one reschedule.
  const rescheduleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!ready) return;
    if (rescheduleTimer.current) clearTimeout(rescheduleTimer.current);
    rescheduleTimer.current = setTimeout(() => {
      syncReminders().catch(() => {
        // Permission may be denied; the Settings screen surfaces that state.
      });
    }, 800);
    return () => {
      if (rescheduleTimer.current) clearTimeout(rescheduleTimer.current);
    };
  }, [ready, syncReminders]);

  const value = useMemo<StoreValue>(
    () => ({
      ready,
      meals,
      water,
      settings,
      todayTotals,
      totalsFor,
      mealsFor,
      waterFor,
      addMeal,
      removeMeal,
      addWater,
      undoLastWater,
      updateSettings,
      syncReminders,
    }),
    [
      ready,
      meals,
      water,
      settings,
      todayTotals,
      totalsFor,
      mealsFor,
      waterFor,
      addMeal,
      removeMeal,
      addWater,
      undoLastWater,
      updateSettings,
      syncReminders,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error('useStore must be used inside <StoreProvider>');
  return value;
}
