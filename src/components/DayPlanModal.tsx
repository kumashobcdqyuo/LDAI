import { useState } from 'react';
import { X, Plus, Loader2, Check, Clock, Trash2 } from 'lucide-react';
import { StudyPlan, StudyRecord } from '@/lib/types';
import { formatDateJa } from '@/lib/dateUtils';
import { formatHours } from '@/lib/stats';
import { PlannedTaskRow } from '@/components/UpcomingPlans';

interface DayPlanModalProps {
  date: string;
  plans: StudyPlan[];
  records: StudyRecord[];
  subjects: string[];
  onClose: () => void;
  onToggleTask: (planId: string, taskId: string) => Promise<{ error: string | null }>;
  onAddTask: (planId: string, subject: string, targetMinutes: number, scheduledDate: string | null) => Promise<{ error: string | null }>;
  onSetTaskSchedule: (planId: string, taskId: string, scheduledDate: string | null) => Promise<{ error: string | null }>;
}

interface PlanTaskRef {
  planId: string;
  planTitle: string;
  taskId: string;
  subject: string;
  targetMinutes: number;
  done: boolean;
}

const inputClass =
  'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent';

export function DayPlanModal({
  date,
  plans,
  records,
  subjects,
  onClose,
  onToggleTask,
  onAddTask,
  onSetTaskSchedule,
}: DayPlanModalProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [pickedTaskId, setPickedTaskId] = useState('');
  const [newPlanId, setNewPlanId] = useState(plans[0]?.id ?? '');
  const [newSubject, setNewSubject] = useState(subjects[0] ?? '');
  const [newMinutes, setNewMinutes] = useState('30');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dayTasks: PlanTaskRef[] = plans.flatMap((plan) =>
    plan.tasks
      .filter((t) => t.scheduledDate === date)
      .map((t) => ({ planId: plan.id, planTitle: plan.title, taskId: t.id, subject: t.subject, targetMinutes: t.targetMinutes, done: t.done })),
  );

  const unscheduledTasks: PlanTaskRef[] = plans.flatMap((plan) =>
    plan.tasks
      .filter((t) => !t.scheduledDate)
      .map((t) => ({ planId: plan.id, planTitle: plan.title, taskId: t.id, subject: t.subject, targetMinutes: t.targetMinutes, done: t.done })),
  );

  const dayRecords = records.filter((r) => r.date === date);
  const plannedTotal = dayTasks.reduce((s, t) => s + t.targetMinutes, 0);
  const actualTotal = dayRecords.reduce((s, r) => s + r.minutes, 0);

  const run = async (action: () => Promise<{ error: string | null }>) => {
    setBusy(true);
    setError(null);
    const result = await action();
    setBusy(false);
    if (result.error) setError(result.error);
    return !result.error;
  };

  const handleAssignPicked = async () => {
    const task = unscheduledTasks.find((t) => t.taskId === pickedTaskId);
    if (!task) return;
    const ok = await run(() => onSetTaskSchedule(task.planId, task.taskId, date));
    if (ok) setPickedTaskId('');
  };

  const handleAddNew = async () => {
    const minutes = parseInt(newMinutes, 10);
    if (!newPlanId || !newSubject || isNaN(minutes) || minutes <= 0) {
      setError('学習計画・科目・時間を入力してください');
      return;
    }
    const ok = await run(() => onAddTask(newPlanId, newSubject, minutes, date));
    if (ok) {
      setNewMinutes('30');
      setShowAdd(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white flex items-start justify-between p-5 pb-3 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-gray-800">{formatDateJa(date)}</h3>
            <p className="text-xs text-gray-400 mt-1">
              予定 {formatHours(plannedTotal)} / 実績 {formatHours(actualTotal)}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors" aria-label="閉じる">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-6">
          <section>
            <h4 className="text-sm font-bold text-gray-700 mb-2">予定</h4>
            {dayTasks.length === 0 ? (
              <p className="text-sm text-gray-400 bg-gray-50 rounded-xl px-3 py-4 text-center">
                この日の予定はまだありません
              </p>
            ) : (
              <div className="space-y-2">
                {dayTasks.map((t) => (
                  <div key={t.taskId} className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <PlannedTaskRow
                        planId={t.planId}
                        planTitle={t.planTitle}
                        taskId={t.taskId}
                        subject={t.subject}
                        minutes={t.targetMinutes}
                        done={t.done}
                        onToggle={onToggleTask}
                      />
                    </div>
                    <button
                      onClick={() => run(() => onSetTaskSchedule(t.planId, t.taskId, null))}
                      disabled={busy}
                      className="text-gray-300 hover:text-red-400 transition-colors shrink-0 p-1 disabled:opacity-50"
                      title="この日の予定から外す"
                      aria-label="この日の予定から外す"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h4 className="text-sm font-bold text-gray-700 mb-2">実績</h4>
            {dayRecords.length === 0 ? (
              <p className="text-sm text-gray-400 bg-gray-50 rounded-xl px-3 py-4 text-center">
                この日の学習記録はまだありません
              </p>
            ) : (
              <div className="space-y-2">
                {dayRecords.map((r) => (
                  <div key={r.id} className="flex items-center justify-between bg-teal-50 rounded-xl px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-teal-800 truncate">{r.subject}</p>
                      {r.memo && <p className="text-xs text-teal-600 truncate">{r.memo}</p>}
                    </div>
                    <span className="flex items-center gap-1 text-xs text-teal-700 shrink-0">
                      <Clock className="w-3 h-3" />
                      {r.minutes}分
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            {!showAdd ? (
              <button
                onClick={() => setShowAdd(true)}
                disabled={plans.length === 0 && unscheduledTasks.length === 0}
                className="w-full inline-flex items-center justify-center gap-2 bg-teal-50 hover:bg-teal-100 disabled:opacity-50 text-teal-700 font-bold text-sm py-2.5 rounded-xl border border-teal-100 transition-colors"
              >
                <Plus className="w-4 h-4" />
                この日に予定を入れる
              </button>
            ) : (
              <div className="space-y-4 bg-gray-50 rounded-xl p-4">
                {unscheduledTasks.length > 0 && (
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1.5 block">
                      未配置のタスクから選ぶ
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={pickedTaskId}
                        onChange={(e) => setPickedTaskId(e.target.value)}
                        className={inputClass}
                      >
                        <option value="">タスクを選択</option>
                        {unscheduledTasks.map((t) => (
                          <option key={t.taskId} value={t.taskId}>
                            {t.subject}（{t.planTitle} / {t.targetMinutes}分）
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={handleAssignPicked}
                        disabled={busy || !pickedTaskId}
                        className="shrink-0 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-xl px-3 transition-colors"
                        aria-label="この日に入れる"
                      >
                        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}

                {plans.length > 0 && (
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1.5 block">新しく作る</label>
                    <div className="space-y-2">
                      <select value={newPlanId} onChange={(e) => setNewPlanId(e.target.value)} className={inputClass}>
                        {plans.map((p) => (
                          <option key={p.id} value={p.id}>{p.title}</option>
                        ))}
                      </select>
                      <div className="flex gap-2">
                        <select value={newSubject} onChange={(e) => setNewSubject(e.target.value)} className={inputClass}>
                          {subjects.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min="1"
                          max="600"
                          value={newMinutes}
                          onChange={(e) => setNewMinutes(e.target.value)}
                          className="w-24 shrink-0 border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white"
                          aria-label="学習時間（分）"
                        />
                      </div>
                      <button
                        onClick={handleAddNew}
                        disabled={busy}
                        className="w-full bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold text-sm py-2.5 rounded-xl transition-colors"
                      >
                        この日の予定として追加
                      </button>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => {
                    setShowAdd(false);
                    setError(null);
                  }}
                  className="w-full text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  閉じる
                </button>
              </div>
            )}
            {error && <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2 mt-3">{error}</p>}
          </section>
        </div>
      </div>
    </div>
  );
}
