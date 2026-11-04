import { useState } from 'react';
import { CheckCircle, Circle, Loader2, Clock, CalendarDays } from 'lucide-react';
import { StudyPlan } from '@/lib/types';
import { addDays, formatDateJa, todayStr } from '@/lib/dateUtils';
import { formatHours } from '@/lib/stats';

interface UpcomingPlansProps {
  plans: StudyPlan[];
  onToggleTask: (planId: string, taskId: string) => Promise<{ error: string | null }>;
}

export function UpcomingPlans({ plans, onToggleTask }: UpcomingPlansProps) {
  const today = todayStr();
  const tomorrow = addDays(today, 1);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <DayCard title="今日の予定" date={today} plans={plans} onToggleTask={onToggleTask} />
      <DayCard title="明日の予定" date={tomorrow} plans={plans} onToggleTask={onToggleTask} />
    </div>
  );
}

function DayCard({
  title,
  date,
  plans,
  onToggleTask,
}: {
  title: string;
  date: string;
  plans: StudyPlan[];
  onToggleTask: (planId: string, taskId: string) => Promise<{ error: string | null }>;
}) {
  const items = plans.flatMap((plan) =>
    plan.tasks
      .filter((t) => t.scheduledDate === date)
      .map((task) => ({ plan, task })),
  );
  const doneCount = items.filter((i) => i.task.done).length;
  const totalMinutes = items.reduce((s, i) => s + i.task.targetMinutes, 0);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-1.5 text-teal-600">
            <CalendarDays className="w-4 h-4" />
            <h3 className="font-bold text-gray-800 text-sm">{title}</h3>
          </div>
          <p className="text-xs text-gray-400 mt-1">{formatDateJa(date)}</p>
        </div>
        {items.length > 0 && (
          <div className="text-right">
            <p className="text-sm font-bold text-gray-800">{formatHours(totalMinutes)}</p>
            <p className="text-xs text-gray-400">{doneCount}/{items.length} 完了</p>
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-gray-400 bg-gray-50 rounded-xl px-3 py-4 text-center">
          予定はまだありません
        </p>
      ) : (
        <div className="space-y-2">
          {items.map(({ plan, task }) => (
            <PlannedTaskRow
              key={task.id}
              planId={plan.id}
              planTitle={plan.title}
              taskId={task.id}
              subject={task.subject}
              minutes={task.targetMinutes}
              done={task.done}
              onToggle={onToggleTask}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function PlannedTaskRow({
  planId,
  planTitle,
  taskId,
  subject,
  minutes,
  done,
  onToggle,
}: {
  planId: string;
  planTitle: string;
  taskId: string;
  subject: string;
  minutes: number;
  done: boolean;
  onToggle: (planId: string, taskId: string) => Promise<{ error: string | null }>;
}) {
  const [busy, setBusy] = useState(false);

  const handleToggle = async () => {
    setBusy(true);
    await onToggle(planId, taskId);
    setBusy(false);
  };

  return (
    <button
      onClick={handleToggle}
      disabled={busy}
      className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
        done ? 'bg-teal-50' : 'bg-gray-50 hover:bg-gray-100'
      }`}
    >
      {busy ? (
        <Loader2 className="w-4 h-4 text-gray-400 animate-spin shrink-0" />
      ) : done ? (
        <CheckCircle className="w-4 h-4 text-teal-600 shrink-0" />
      ) : (
        <Circle className="w-4 h-4 text-gray-300 shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${done ? 'text-teal-700 line-through' : 'text-gray-700'}`}>
          {subject}
        </p>
        <p className="text-xs text-gray-400 truncate">{planTitle}</p>
      </div>
      <span className="flex items-center gap-1 text-xs text-gray-400 shrink-0">
        <Clock className="w-3 h-3" />
        {minutes}分
      </span>
    </button>
  );
}
