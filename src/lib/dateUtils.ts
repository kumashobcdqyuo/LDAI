/** Returns YYYY-MM-DD for a Date in local time */
export function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Today's date string */
export function todayStr(): string {
  return toDateString(new Date());
}

/** Returns the Monday of the week containing the given date */
export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun ... 6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Returns an array of YYYY-MM-DD strings for the last N days ending today */
export function lastNDays(n: number): string[] {
  const days: string[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(toDateString(d));
  }
  return days;
}

/** Returns an array of YYYY-MM-DD strings for the current week (Mon–Sun) */
export function thisWeekDays(): string[] {
  const start = startOfWeek(new Date());
  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    days.push(toDateString(d));
  }
  return days;
}

/** Returns YYYY-MM string for the current month */
export function thisMonthStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/** Shifts a YYYY-MM-DD string by a number of days */
export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return toDateString(new Date(y, m - 1, d + days));
}

/** Human-readable Japanese date, e.g. 2026年11月4日(水) */
export function formatDateJa(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });
}

/** Returns a Sunday-first grid for a month; null marks padding cells outside the month */
export function monthGrid(year: number, monthIndex: number): (string | null)[] {
  const first = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells: (string | null)[] = Array(first.getDay()).fill(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(toDateString(new Date(year, monthIndex, day)));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
