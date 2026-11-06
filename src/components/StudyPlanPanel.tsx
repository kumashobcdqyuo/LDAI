import { useState } from 'react';
import {
  Plus,
  Target,
  CheckCircle,
  Circle,
  Trash2,
  Loader2,
  Calendar,
  BookOpen,
  Clock,
  X,
  Check,
} from 'lucide-react';
import { StudyPlan, StudyPlanTask } from '@/lib/types';
import { todayStr } from '@/lib/dateUtils';

interface StudyPlanPanelProps {
  plans: StudyPlan[];
  subjects: string[];
  onCreatePlan: (plan: {
    title: string;
    goal?: string;
    startDate: string;
    endDate?: string;
    tasks: { subject: string; targetMinutes: number }[];
  }) => Promise<{ error: string | null }>;
  onToggleTask: (planId: string, taskId: string) => Promise<{ error: string | null }>;
  onAddTask: (planId: string, subject: string, targetMinutes: number) => Promise<{ error: string | null }>;
  onSetTaskSchedule: (planId: string, taskId: string, scheduledDate: string | null) => Promise<{ error: string | null }>;
  onDeletePlan: (planId: string) => Promise<{ error: string | null }>;
}

export function StudyPlanPanel({
  plans,
  subjects,
  onCreatePlan,
  onToggleTask,
  onAddTask,
  onSetTaskSchedule,
  onDeletePlan,
}: StudyPlanPanelProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);

  if (showCreateForm) {
    return (
      <CreatePlanForm
        subjects={subjects}
        onCancel={() => setShowCreateForm(false)}
        onCreate={async (plan) => {
          const result = await onCreatePlan(plan);
          if (!result.error) {
            setShowCreateForm(false);
          }
          return result;
        }}
      />
    );
  }

  if (plans.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
        <div className="w-14 h-14 bg-teal-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Target className="w-7 h-7 text-teal-600" />
        </div>
        <h3 className="font-bold text-gray-800 text-base mb-2">学習計画を作成しよう</h3>
        <p className="text-sm text-gray-400 mb-5 leading-relaxed">
          目標を設定してタスクごとに進捗を管理できます。<br />
          AIチャットで計画について相談することも可能です。
        </p>
        <button
          onClick={() => setShowCreateForm(true)}
          className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-bold py-2.5 px-5 rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" />
          学習計画を作成する
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-gray-800 text-base">学習計画</h2>
        <button
          onClick={() => setShowCreateForm(true)}
          className="inline-flex items-center gap-1.5 bg-teal-50 hover:bg-teal-100 text-teal-700 font-medium text-sm px-3 py-2 rounded-xl border border-teal-100 transition-colors"
        >
          <Plus className="w-4 h-4" />
          新規作成
        </button>
      </div>

      {plans.map((plan) => (
        <PlanCard
          key={plan.id}
          plan={plan}
          subjects={subjects}
          onToggleTask={onToggleTask}
          onAddTask={onAddTask}
          onSetTaskSchedule={onSetTaskSchedule}
          onDeletePlan={onDeletePlan}
        />
      ))}
    </div>
  );
}

function PlanCard({
  plan,
  subjects,
  onToggleTask,
  onAddTask,
  onSetTaskSchedule,
  onDeletePlan,
}: {
  plan: StudyPlan;
  subjects: string[];
  onToggleTask: (planId: string, taskId: string) => Promise<{ error: string | null }>;
  onAddTask: (planId: string, subject: string, targetMinutes: number) => Promise<{ error: string | null }>;
  onSetTaskSchedule: (planId: string, taskId: string, scheduledDate: string | null) => Promise<{ error: string | null }>;
  onDeletePlan: (planId: string) => Promise<{ error: string | null }>;
}) {
  const [showAddTask, setShowAddTask] = useState(false);
  const [newSubject, setNewSubject] = useState(subjects[0] ?? '');
  const [newMinutes, setNewMinutes] = useState('30');
  const [taskBusy, setTaskBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalTasks = plan.tasks.length;
  const doneTasks = plan.tasks.filter((t) => t.done).length;
  const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const totalMinutes = plan.tasks.reduce((s, t) => s + t.targetMinutes, 0);
  const doneMinutes = plan.tasks.filter((t) => t.done).reduce((s, t) => s + t.targetMinutes, 0);

  const handleAddTask = async () => {
    const mins = parseInt(newMinutes, 10);
    if (!newSubject || isNaN(mins) || mins <= 0) return;
    setTaskBusy(true);
    setError(null);
    const result = await onAddTask(plan.id, newSubject, mins);
    setTaskBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setNewMinutes('30');
    setShowAddTask(false);
  };

  const handleDelete = async () => {
    setDeleteBusy(true);
    await onDeletePlan(plan.id);
    setDeleteBusy(false);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-800 text-base">{plan.title}</h3>
          {plan.goal && (
            <p className="text-sm text-gray-500 mt-1">{plan.goal}</p>
          )}
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {plan.startDate}〜{plan.endDate ?? '未定'}
            </span>
          </div>
        </div>
        <button
          onClick={handleDelete}
          disabled={deleteBusy}
          className="text-gray-300 hover:text-red-400 transition-colors shrink-0 ml-2"
          title="計画を削除"
        >
          {deleteBusy ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Trash2 className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-gray-500">
            進捗: {doneTasks}/{totalTasks} タスク完了
          </span>
          <span className="text-xs font-bold text-teal-600">{progress}%</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-teal-500 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-1">
          {doneMinutes}分 / {totalMinutes}分 達成
        </p>
      </div>

      {/* Tasks */}
      <div className="space-y-2">
        {plan.tasks.map((task) => (
          <TaskRowItem
            key={task.id}
            task={task}
            onToggle={() => onToggleTask(plan.id, task.id)}
            onSetSchedule={(date) => onSetTaskSchedule(plan.id, task.id, date)}
          />
        ))}

        {showAddTask && (
          <div className="flex gap-2 items-center bg-gray-50 rounded-xl p-2.5">
            <select
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white"
            >
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
              className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
              placeholder="分"
            />
            <button
              onClick={handleAddTask}
              disabled={taskBusy}
              className="bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors flex items-center gap-1"
            >
              {taskBusy ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
            </button>
            <button
              onClick={() => setShowAddTask(false)}
              className="text-gray-400 hover:text-gray-600 px-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-500 mt-2">{error}</p>}

      {!showAddTask && (
        <button
          onClick={() => {
            setNewSubject(subjects[0] ?? '');
            setShowAddTask(true);
          }}
          className="mt-3 inline-flex items-center gap-1 text-sm text-teal-600 font-medium hover:text-teal-700 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          タスクを追加
        </button>
      )}
    </div>
  );
}

function TaskRowItem({
  task,
  onToggle,
  onSetSchedule,
}: {
  task: StudyPlanTask;
  onToggle: () => Promise<{ error: string | null }>;
  onSetSchedule: (date: string | null) => Promise<{ error: string | null }>;
}) {
  const [busy, setBusy] = useState(false);
  const [scheduleBusy, setScheduleBusy] = useState(false);

  const handleToggle = async () => {
    setBusy(true);
    await onToggle();
    setBusy(false);
  };

  const handleScheduleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setScheduleBusy(true);
    await onSetSchedule(e.target.value || null);
    setScheduleBusy(false);
  };

  return (
    <div
      className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
        task.done ? 'bg-teal-50' : 'bg-gray-50 hover:bg-gray-100'
      }`}
    >
      <button
        onClick={handleToggle}
        disabled={busy || scheduleBusy}
        className="flex items-center gap-3 flex-1 min-w-0 text-left"
      >
        {busy ? (
          <Loader2 className="w-4 h-4 text-gray-400 animate-spin shrink-0" />
        ) : task.done ? (
          <CheckCircle className="w-4 h-4 text-teal-600 shrink-0" />
        ) : (
          <Circle className="w-4 h-4 text-gray-300 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <BookOpen className="w-3 h-3 text-gray-400" />
            <span className={`text-sm font-medium ${task.done ? 'text-teal-700 line-through' : 'text-gray-700'}`}>
              {task.subject}
            </span>
          </div>
        </div>
        <span className="flex items-center gap-1 text-xs text-gray-400 shrink-0">
          <Clock className="w-3 h-3" />
          {task.targetMinutes}分
        </span>
      </button>
      <div className="flex items-center gap-1 shrink-0">
        {scheduleBusy && <Loader2 className="w-3 h-3 text-gray-400 animate-spin" />}
        <input
          type="date"
          value={task.scheduledDate ?? ''}
          onChange={handleScheduleChange}
          disabled={scheduleBusy}
          className="text-xs text-gray-500 border border-gray-200 rounded-lg px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-teal-400 w-[130px]"
          title="カレンダーに表示する日"
        />
        {task.scheduledDate && (
          <button
            onClick={() => onSetSchedule(null)}
            disabled={scheduleBusy}
            className="text-gray-300 hover:text-red-400 transition-colors"
            title="予定日をクリア"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function CreatePlanForm({
  subjects,
  onCancel,
  onCreate,
}: {
  subjects: string[];
  onCancel: () => void;
  onCreate: (plan: {
    title: string;
    goal?: string;
    startDate: string;
    endDate?: string;
    tasks: { subject: string; targetMinutes: number }[];
  }) => Promise<{ error: string | null }>;
}) {
  const [title, setTitle] = useState('');
  const [goal, setGoal] = useState('');
  const [startDate, setStartDate] = useState(todayStr());
  const [endDate, setEndDate] = useState('');
  const [tasks, setTasks] = useState<{ subject: string; targetMinutes: number }[]>([
    { subject: subjects[0] ?? '', targetMinutes: 30 },
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError('タイトルを入力してください');
      return;
    }
    setBusy(true);
    setError(null);
    const result = await onCreate({
      title: title.trim(),
      goal: goal.trim() || undefined,
      startDate,
      endDate: endDate || undefined,
      tasks: tasks.filter((t) => t.subject && t.targetMinutes > 0),
    });
    setBusy(false);
    if (result.error) {
      setError(result.error);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <h3 className="font-bold text-gray-800 text-base mb-4">新しい学習計画</h3>

      <div className="space-y-4">
        <div>
          <label className="flex items-center gap-1.5 text-sm font-medium text-gray-600 mb-1.5">
            <Target className="w-4 h-4 text-teal-600" />
            計画タイトル
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例: 期末テスト対策"
            maxLength={50}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
            autoFocus
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-600 mb-1.5 block">
            目標（任意）
          </label>
          <input
            type="text"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="例: 全科目80点以上を目指す"
            maxLength={100}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-gray-600 mb-1.5">
              <Calendar className="w-4 h-4 text-teal-600" />
              開始日
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600 mb-1.5 block">
              終了日（任意）
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
            />
          </div>
        </div>

        {/* Tasks */}
        <div>
          <label className="text-sm font-medium text-gray-600 mb-2 block">学習タスク</label>
          <div className="space-y-2">
            {tasks.map((task, i) => (
              <div key={i} className="flex gap-2 items-center">
                <select
                  value={task.subject}
                  onChange={(e) => {
                    const next = [...tasks];
                    next[i] = { ...task, subject: e.target.value };
                    setTasks(next);
                  }}
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white"
                >
                  {subjects.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <input
                  type="number"
                  min="1"
                  max="600"
                  value={task.targetMinutes}
                  onChange={(e) => {
                    const next = [...tasks];
                    next[i] = { ...task, targetMinutes: parseInt(e.target.value, 10) || 0 };
                    setTasks(next);
                  }}
                  className="w-24 border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
                />
                <span className="text-xs text-gray-400">分</span>
                {tasks.length > 1 && (
                  <button
                    onClick={() => setTasks(tasks.filter((_, idx) => idx !== i))}
                    className="text-gray-300 hover:text-red-400 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={() => setTasks([...tasks, { subject: subjects[0] ?? '', targetMinutes: 30 }])}
            className="mt-2 inline-flex items-center gap-1 text-sm text-teal-600 font-medium hover:text-teal-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            タスクを追加
          </button>
        </div>

        {error && (
          <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="flex gap-2 pt-1">
          <button
            onClick={handleSubmit}
            disabled={busy || !title.trim()}
            className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {busy ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                作成中...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                計画を作成
              </>
            )}
          </button>
          <button
            onClick={onCancel}
            className="px-4 border border-gray-200 text-gray-600 font-bold py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
}
