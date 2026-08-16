import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { parseTimeString } from './date';
import { DayTotals, Goals, ReminderSettings } from './types';

const ANDROID_CHANNEL_ID = 'reminders';

/** Notifications that arrive while the app is open still show as a banner. */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function ensurePermissions(): Promise<boolean> {
  // The simulator/emulator can schedule notifications, but a real device is
  // where this actually matters, so we only warn rather than bail.
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: 'Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  if (!existing.canAskAgain) return false;

  const requested = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: false, allowSound: true },
  });
  return requested.granted;
}

export function isPhysicalDevice(): boolean {
  return Device.isDevice;
}

async function schedule(
  title: string,
  body: string,
  hour: number,
  minute: number,
  data: Record<string, string>,
): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL_ID } : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
      ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL_ID } : {}),
    },
  });
}

const MEAL_PROMPTS = [
  'Snap it or type it — takes five seconds.',
  'What did you eat? Tap to log it.',
  "Don't let this one slip by unlogged.",
];

function remainingLine(totals: DayTotals, goals: Goals): string {
  const kcal = Math.max(0, goals.calories - Math.round(totals.calories));
  const protein = Math.max(0, goals.protein - Math.round(totals.protein));
  if (kcal === 0 && protein === 0) return "You've hit both your goals today. Nice.";
  if (protein === 0) return `Protein goal hit. ${kcal} kcal left in the tank.`;
  if (kcal === 0) return `Calories are there — still ${protein}g of protein short.`;
  return `${kcal} kcal and ${protein}g protein left to hit your goals.`;
}

function waterLine(totals: DayTotals, goals: Goals): string {
  const left = Math.max(0, goals.waterMl - totals.waterMl);
  if (left === 0) return "You've hit your water goal. Have another anyway.";
  const glasses = Math.max(1, Math.round(left / 250));
  return `${(left / 1000).toFixed(1)}L to go — about ${glasses} more glass${glasses === 1 ? '' : 'es'}.`;
}

/**
 * Wipes every scheduled reminder and lays down a fresh set. Local notifications
 * bake their text in at schedule time, so we re-run this whenever the day's
 * totals change — that's what keeps "40g of protein left" honest.
 */
export async function rescheduleAll(
  reminders: ReminderSettings,
  goals: Goals,
  totals: DayTotals,
): Promise<number> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!reminders.enabled) return 0;

  let count = 0;

  for (let i = 0; i < reminders.mealTimes.length; i++) {
    const parsed = parseTimeString(reminders.mealTimes[i]);
    if (!parsed) continue;
    await schedule(
      'Time to log your meal',
      MEAL_PROMPTS[i % MEAL_PROMPTS.length],
      parsed.hour,
      parsed.minute,
      { kind: 'meal' },
    );
    count++;
  }

  const step = Math.max(1, Math.round(reminders.waterEveryHours));
  for (let hour = reminders.waterStartHour; hour <= reminders.waterEndHour; hour += step) {
    if (hour < 0 || hour > 23) continue;
    await schedule('Drink some water', waterLine(totals, goals), hour, 0, {
      kind: 'water',
    });
    count++;
  }

  if (reminders.eveningCheckIn) {
    const parsed = parseTimeString(reminders.eveningCheckInTime);
    if (parsed) {
      await schedule(
        "How'd today go?",
        remainingLine(totals, goals),
        parsed.hour,
        parsed.minute,
        { kind: 'evening' },
      );
      count++;
    }
  }

  return count;
}

export async function cancelAll(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/** Fires in a few seconds so the user can confirm reminders actually work. */
export async function sendTestNotification(): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Reminders are working',
      body: "This is what a nudge looks like. You'll get these at your set times.",
      ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL_ID } : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 5,
      repeats: false,
      ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL_ID } : {}),
    },
  });
}

export async function scheduledCount(): Promise<number> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  return scheduled.length;
}
