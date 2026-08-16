/**
 * Day boundaries are local, not UTC — a meal at 11pm belongs to that day even
 * though `toISOString()` would push it into tomorrow in most timezones.
 */
export function dateKeyOf(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayKey(): string {
  return dateKeyOf(new Date());
}

/** "2026-08-16" -> "Sat 16 Aug". Today and yesterday get friendly names. */
export function formatDateKey(key: string): string {
  if (key === todayKey()) return 'Today';
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (key === dateKeyOf(yesterday)) return 'Yesterday';

  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

/** ISO timestamp -> "7:42 PM" in the device's locale. */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** The last `count` date keys, most recent first. */
export function recentDateKeys(count: number): string[] {
  const keys: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    keys.push(dateKeyOf(d));
  }
  return keys;
}

/** "08:30" -> { hour: 8, minute: 30 }. Returns null for malformed input. */
export function parseTimeString(value: string): { hour: number; minute: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}
