import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Flame } from 'lucide-react';
import { StudyPlan, StudyRecord } from '@/lib/types';
import { currentStreakDates, formatHours } from '@/lib/stats';
import { monthGrid, todayStr } from '@/lib/dateUtils';
import { DayPlanModal } from '@/components/DayPlanModal';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

interface StudyCalendarProps {
  records: StudyRecord[];
  plans: StudyPlan[];
  subjects: string[];
  onToggleTask: (planId: string, taskId: string) => Promise<{ error: string | null }>;
  onAddTask: (planId: string, subject: string, targetMinutes: number, scheduledDate: string | null) => Promise<{ error: string | null }>;
  onSetTaskSchedule: (planId: string, taskId: string, scheduledDate: string | null) => Promise<{ error: string | null }>;
}

export function StudyCalendar({
  records,
  plans,
  subjects,
  onToggleTask,
  onAddTask,
  onSetTaskSchedule,
}: StudyCalendarProps) {
  const today = todayStr();
  const now = new Date();
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const cells = useMemo(() => monthGrid(cursor.year, cursor.month), [cursor]);
  const streakDates = useMemo(() => new Set(currentStreakDates(records)), [records]);

  const actualByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of records) map.set(r.date, (map.get(r.date) ?? 0) + r.minutes);
    return map;
  }, [records]);

  const plannedByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const plan of plans) {
      for (const task of plan.tasks) {
        if (!task.scheduledDate) continue;
        map.set(task.scheduledDate, (map.get(task.scheduledDate) ?? 0) + task.targetMinutes);
      }
    }
    return map;
  }, [plans]);

  const shiftMonth = (delta: number) => {
    setCursor((prev) => {
      const d = new Date(prev.year, prev.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-bold text-gray-800 text-base">
            {cursor.year}年{cursor.month + 1}月
          </h2>
          <div className="flex items-center gap-1.5 mt-1 text-xs font-bold text-orange-600">
            <Flame className="w-3.5 h-3.5" />
            連続学習 {streakDates.size}日
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => shiftMonth(-1)}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-500 flex items-center justify-center transition-colors"
            aria-label="前の月"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCursor({ year: now.getFullYear(), month: now.getMonth() })}
            className="px-2.5 h-8 rounded-lg text-xs font-bold text-teal-600 hover:bg-teal-50 transition-colors"
          >
            今日
          </button>
          <button
            onClick={() => shiftMonth(1)}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-500 flex items-center justify-center transition-colors"
            aria-label="次の月"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map((w, i) => (
          <div
            key={w}
            className={`text-center text-xs font-bold py-1 ${
              i === 0 ? 'text-red-400' : i === 6 ? 'text-sky-500' : 'text-gray-400'
            }`}
          >
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((date, idx) => {
          if (!date) return <div key={`empty-${idx}`} />;

          const actual = actualByDate.get(date) ?? 0;
          const planned = plannedByDate.get(date) ?? 0;
          const isStreak = streakDates.has(date);
          const isToday = date === today;

          const surface = isStreak
            ? 'bg-orange-50 border-orange-200'
            : actual > 0
              ? 'bg-teal-50 border-teal-100'
              : 'bg-white border-gray-100';

          return (
            <button
              key={date}
              onClick={() => setSelectedDate(date)}
              className={`relative min-h-[60px] sm:min-h-[84px] rounded-xl border p-1.5 sm:p-2 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm ${surface} ${
                isToday ? 'ring-2 ring-teal-500' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs sm:text-sm font-bold ${isToday ? 'text-teal-700' : 'text-gray-700'}`}>
                  {Number(date.slice(8))}
                </span>
                {isStreak && <Flame className="w-3 h-3 text-orange-500" />}
              </div>
              {planned > 0 && (
                <span className="block mt-1 text-[10px] sm:text-xs font-medium text-sky-700 truncate">
                  予定 {formatHours(planned)}
                </span>
              )}
              {actual > 0 && (
                <span className="block text-[10px] sm:text-xs font-medium text-teal-700 truncate">
                  実績 {formatHours(actual)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-4 pt-3 border-t border-gray-100 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-orange-100 border border-orange-200" />
          連続学習日
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-teal-100 border border-teal-200" />
          学習あり
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-sky-600" />
          予定あり
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded ring-2 ring-teal-500" />
          今日
        </span>
      </div>

      {selectedDate && (
        <DayPlanModal
          date={selectedDate}
          plans={plans}
          records={records}
          subjects={subjects}
          onClose={() => setSelectedDate(null)}
          onToggleTask={onToggleTask}
          onAddTask={onAddTask}
          onSetTaskSchedule={onSetTaskSchedule}
        />
      )}
    </div>
  );
}
