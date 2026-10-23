import { StudyRecord } from './types';
import { lastNDays, thisWeekDays, thisMonthStr, toDateString } from './dateUtils';

export function totalMinutes(records: StudyRecord[]): number {
  return records.reduce((sum, r) => sum + r.minutes, 0);
}

export function minutesThisWeek(records: StudyRecord[]): number {
  const weekSet = new Set(thisWeekDays());
  return totalMinutes(records.filter((r) => weekSet.has(r.date)));
}

export function minutesThisMonth(records: StudyRecord[]): number {
  const month = thisMonthStr();
  return totalMinutes(records.filter((r) => r.date.startsWith(month)));
}

/** Consecutive study days ending today or yesterday */
export function streakDays(records: StudyRecord[]): number {
  const studiedDates = new Set(records.map((r) => r.date));
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Allow streak to count from today; if not studied today, check yesterday
  let streak = 0;
  let cursor = new Date(today);

  // If not studied today, start from yesterday so the streak isn't zero mid-day
  if (!studiedDates.has(dateToStr(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!studiedDates.has(dateToStr(cursor))) return 0;
  }

  while (studiedDates.has(dateToStr(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function dateToStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Minutes per day for the last N days, with 0 for days without records */
export function dailyMinutes(records: StudyRecord[], n = 14) {
  const days = lastNDays(n);
  return days.map((date) => {
    const mins = records
      .filter((r) => r.date === date)
      .reduce((sum, r) => sum + r.minutes, 0);
    const d = new Date(date);
    return {
      date,
      label: `${d.getMonth() + 1}/${d.getDate()}`,
      minutes: mins,
    };
  });
}

export type Period = '14days' | '30days' | 'month' | 'year';

export interface PeriodOption {
  value: Period;
  label: string;
}

export const PERIOD_OPTIONS: PeriodOption[] = [
  { value: '14days', label: '直近14日' },
  { value: '30days', label: '直近30日' },
  { value: 'month', label: '今月' },
  { value: 'year', label: '今年' },
];

/** Filter records to the given period */
export function filterByPeriod(records: StudyRecord[], period: Period): StudyRecord[] {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  if (period === '14days') {
    const start = new Date(now);
    start.setDate(start.getDate() - 13);
    return records.filter((r) => r.date >= toDateString(start));
  }

  if (period === '30days') {
    const start = new Date(now);
    start.setDate(start.getDate() - 29);
    return records.filter((r) => r.date >= toDateString(start));
  }

  if (period === 'month') {
    const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return records.filter((r) => r.date.startsWith(prefix));
  }

  // year
  const yearPrefix = `${now.getFullYear()}-`;
  return records.filter((r) => r.date.startsWith(yearPrefix));
}

/** Chart data for a given period: daily for 14/30 days, monthly for year, daily for month */
export function chartDataForPeriod(records: StudyRecord[], period: Period): { date: string; label: string; minutes: number }[] {
  const filtered = filterByPeriod(records, period);

  if (period === '14days') {
    return dailyMinutesFromRecords(filtered, 14);
  }

  if (period === '30days') {
    return dailyMinutesFromRecords(filtered, 30);
  }

  if (period === 'month') {
    // Daily bars for current month
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const result: { date: string; label: string; minutes: number }[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const mins = filtered.filter((r) => r.date === dateStr).reduce((s, r) => s + r.minutes, 0);
      result.push({ date: dateStr, label: `${day}`, minutes: mins });
    }
    return result;
  }

  // year: monthly aggregation
  const now = new Date();
  const year = now.getFullYear();
  const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
  const result: { date: string; label: string; minutes: number }[] = [];
  for (let m = 0; m < 12; m++) {
    const prefix = `${year}-${String(m + 1).padStart(2, '0')}`;
    const mins = filtered.filter((r) => r.date.startsWith(prefix)).reduce((s, r) => s + r.minutes, 0);
    result.push({ date: prefix, label: monthNames[m], minutes: mins });
  }
  return result;
}

/** Daily minutes from a pre-filtered record set for the last N days */
function dailyMinutesFromRecords(records: StudyRecord[], n: number): { date: string; label: string; minutes: number }[] {
  const days = lastNDays(n);
  return days.map((date) => {
    const mins = records
      .filter((r) => r.date === date)
      .reduce((sum, r) => sum + r.minutes, 0);
    const d = new Date(date);
    return {
      date,
      label: `${d.getMonth() + 1}/${d.getDate()}`,
      minutes: mins,
    };
  });
}

/** Total minutes per subject */
export function subjectBreakdown(
  records: StudyRecord[],
): { subject: string; minutes: number }[] {
  const map = new Map<string, number>();
  for (const r of records) {
    map.set(r.subject, (map.get(r.subject) ?? 0) + r.minutes);
  }
  return Array.from(map.entries())
    .map(([subject, minutes]) => ({ subject, minutes }))
    .sort((a, b) => b.minutes - a.minutes);
}

/** Days since the most recent study session */
export function daysSinceLastStudy(records: StudyRecord[]): number {
  if (records.length === 0) return 999;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sorted = [...records].sort((a, b) => b.date.localeCompare(a.date));
  const last = new Date(sorted[0].date);
  last.setHours(0, 0, 0, 0);
  return Math.round(
    (today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24),
  );
}
