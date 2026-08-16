/** A single food item the AI identified inside one logged meal. */
export type FoodItem = {
  name: string;
  quantity: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

/** One logged meal: either a photo the user snapped or a sentence they typed. */
export type MealEntry = {
  id: string;
  /** ISO timestamp of when the meal was logged. */
  loggedAt: string;
  /** Local date key, YYYY-MM-DD, used to group entries into days. */
  dateKey: string;
  source: 'photo' | 'text';
  /** What the user typed, or the AI's caption for a photo. */
  title: string;
  /** Local URI of the photo, when the entry came from the camera. */
  photoUri?: string;
  items: FoodItem[];
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /** The AI's own confidence in the estimate. */
  confidence: 'high' | 'medium' | 'low';
  /** Short plain-language caveat from the AI, e.g. "assumed olive oil".  */
  note?: string;
};

/** One drink of water, in millilitres. */
export type WaterEntry = {
  id: string;
  loggedAt: string;
  dateKey: string;
  amountMl: number;
};

export type Goals = {
  calories: number;
  protein: number;
  waterMl: number;
};

export type ReminderSettings = {
  enabled: boolean;
  /** Meal nudges at these local times, "HH:MM". */
  mealTimes: string[];
  /** Water nudge every N hours, between waterStartHour and waterEndHour. */
  waterEveryHours: number;
  waterStartHour: number;
  waterEndHour: number;
  /** End-of-day summary: "you're 40g of protein short". */
  eveningCheckIn: boolean;
  eveningCheckInTime: string;
};

export type Settings = {
  goals: Goals;
  reminders: ReminderSettings;
  /** Base URL of the analyzer backend, e.g. http://192.168.1.5:8787 */
  serverUrl: string;
};

export type DayTotals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  waterMl: number;
};

export const DEFAULT_SETTINGS: Settings = {
  goals: {
    calories: 2200,
    protein: 150,
    waterMl: 3000,
  },
  reminders: {
    enabled: true,
    mealTimes: ['08:30', '13:00', '19:00'],
    waterEveryHours: 3,
    waterStartHour: 9,
    waterEndHour: 21,
    eveningCheckIn: true,
    eveningCheckInTime: '20:30',
  },
  serverUrl: '',
};
