import { useState } from 'react';
import { X, Loader2, Sparkles, ArrowLeft, CalendarCheck, ChevronDown, Brain } from 'lucide-react';
import { addDays, formatDateJa, todayStr } from '@/lib/dateUtils';
import { formatHours } from '@/lib/stats';
import {
  generateStudyPlan,
  fetchChatMemories,
  GeneratedPlan,
  PlanRequestInput,
  ChatMemory,
} from '@/lib/generateStudyPlan';

interface AiPlanModalProps {
  subjects: string[];
  onClose: () => void;
  onSave: (plan: GeneratedPlan) => Promise<{ error: string | null }>;
}

const MAX_DAYS = 90;
const DAILY_OPTIONS = [30, 60, 90, 120, 150, 180];
const WEEKDAYS = ['月', '火', '水', '木', '金', '土', '日'];
const LEVEL_OPTIONS = ['初心者', '基礎レベル', '中級レベル', '上級レベル'];
const STYLE_OPTIONS = ['テキスト中心', '問題演習中心', '動画・講義中心', '混合'];

const inputClass =
  'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent';

function daysBetween(start: string, end: string): number {
  return Math.round((Date.parse(`${end}T00:00:00`) - Date.parse(`${start}T00:00:00`)) / 86400000) + 1;
}

export function AiPlanModal({ subjects, onClose, onSave }: AiPlanModalProps) {
  const [step, setStep] = useState<'form' | 'preview'>('form');
  const [goal, setGoal] = useState('');
  const [startDate, setStartDate] = useState(todayStr());
  const [endDate, setEndDate] = useState(addDays(todayStr(), 6));
  const [dailyMinutes, setDailyMinutes] = useState(60);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [plan, setPlan] = useState<GeneratedPlan | null>(null);
  const [usedAi, setUsedAi] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Detailed conditions
  const [showDetails, setShowDetails] = useState(false);
  const [level, setLevel] = useState('');
  const [weakSubjects, setWeakSubjects] = useState<string[]>([]);
  const [strongSubjects, setStrongSubjects] = useState<string[]>([]);
  const [studyStyle, setStudyStyle] = useState('');
  const [availableDays, setAvailableDays] = useState<string[]>([]);
  const [restDayPattern, setRestDayPattern] = useState('');
  const [priority, setPriority] = useState('');
  const [notes, setNotes] = useState('');
  const [usedMemories, setUsedMemories] = useState(false);

  const period = daysBetween(startDate, endDate);

  const toggleSubject = (name: string) => {
    setSelectedSubjects((prev) =>
      prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name],
    );
  };

  const toggleArrayItem = (arr: string[], value: string, setter: (v: string[]) => void) => {
    setter(arr.includes(value) ? arr.filter((s) => s !== value) : [...arr, value]);
  };

  const formError = (): string | null => {
    if (!startDate || !endDate) return '開始日と終了日を入力してください';
    if (period < 1) return '終了日は開始日より後にしてください';
    if (period > MAX_DAYS) return `期間は${MAX_DAYS}日以内で指定してください`;
    if (selectedSubjects.length === 0) return '科目を1つ以上選んでください';
    return null;
  };

  const requestPlan = async (extra: Pick<PlanRequestInput, 'feedback' | 'previousPlan'> = {}) => {
    const validation = formError();
    if (validation) {
      setError(validation);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      let memories: ChatMemory[] = [];
      if (showDetails) {
        memories = await fetchChatMemories();
      }
      const result = await generateStudyPlan({
        goal: goal.trim(),
        startDate,
        endDate,
        dailyMinutes,
        subjects: selectedSubjects,
        ...extra,
        level: level || undefined,
        weakSubjects: weakSubjects.length > 0 ? weakSubjects : undefined,
        strongSubjects: strongSubjects.length > 0 ? strongSubjects : undefined,
        studyStyle: studyStyle || undefined,
        availableDays: availableDays.length > 0 ? availableDays : undefined,
        restDayPattern: restDayPattern || undefined,
        priority: priority.trim() || undefined,
        notes: notes.trim() || undefined,
        memories: memories.length > 0 ? memories : undefined,
      });
      setPlan(result.plan);
      setUsedAi(result.source === 'ai');
      setUsedMemories(memories.length > 0);
      setFeedback('');
      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : '計画の作成に失敗しました');
    } finally {
      setBusy(false);
    }
  };

  const handleRevise = () => {
    if (!plan || !feedback.trim()) return;
    requestPlan({ feedback: feedback.trim(), previousPlan: plan });
  };

  const handleSave = async () => {
    if (!plan) return;
    setBusy(true);
    setError(null);
    const result = await onSave(plan);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onClose();
  };

  const totalMinutes = plan
    ? plan.days.reduce((sum, d) => sum + d.tasks.reduce((s, t) => s + t.targetMinutes, 0), 0)
    : 0;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-5 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-teal-50 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-teal-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-800">AIと学習計画を作る</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {step === 'form' ? '条件を入力すると日ごとの計画を提案します' : '内容を確認して、カレンダーに反映できます'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors" aria-label="閉じる">
            <X className="w-5 h-5" />
          </button>
        </div>

        {step === 'form' ? (
          <div className="p-5 space-y-5 overflow-y-auto">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">目標</label>
              <input
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                maxLength={200}
                placeholder="例: 日本語能力試験N2に合格する"
                className={inputClass}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">開始日</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">終了日</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClass} />
              </div>
            </div>
            <p className="text-xs text-gray-400 -mt-3">期間: {period > 0 ? `${period}日間` : '-'}（最大{MAX_DAYS}日）</p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">1日の学習時間の目安</label>
              <div className="flex flex-wrap gap-2">
                {DAILY_OPTIONS.map((m) => (
                  <button
                    key={m}
                    onClick={() => setDailyMinutes(m)}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                      dailyMinutes === m
                        ? 'bg-teal-600 border-teal-600 text-white'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-teal-300'
                    }`}
                  >
                    {formatHours(m)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">取り組む科目</label>
              {subjects.length === 0 ? (
                <p className="text-sm text-gray-400">科目がまだありません。記録フォームから追加してください。</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {subjects.map((s) => {
                    const on = selectedSubjects.includes(s);
                    return (
                      <button
                        key={s}
                        onClick={() => toggleSubject(s)}
                        className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                          on
                            ? 'bg-teal-50 border-teal-400 text-teal-700'
                            : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'
                        }`}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Detailed conditions toggle */}
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-teal-500" />
                  詳細条件を指定する（より精度の高い計画）
                </span>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showDetails ? 'rotate-180' : ''}`} />
              </button>

              {showDetails && (
                <div className="p-4 space-y-4 border-t border-gray-100 bg-gray-50/50">
                  {/* Level */}
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1.5">現在のレベル</label>
                    <div className="flex flex-wrap gap-2">
                      {LEVEL_OPTIONS.map((l) => (
                        <button
                          key={l}
                          onClick={() => setLevel(level === l ? '' : l)}
                          className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                            level === l
                              ? 'bg-sky-50 border-sky-400 text-sky-700'
                              : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                          }`}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Weak / Strong subjects */}
                  {selectedSubjects.length > 0 && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1.5">苦手な科目</label>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedSubjects.map((s) => (
                            <button
                              key={s}
                              onClick={() => toggleArrayItem(weakSubjects, s, setWeakSubjects)}
                              className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                                weakSubjects.includes(s)
                                  ? 'bg-orange-50 border-orange-400 text-orange-700'
                                  : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'
                              }`}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1.5">得意な科目</label>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedSubjects.map((s) => (
                            <button
                              key={s}
                              onClick={() => toggleArrayItem(strongSubjects, s, setStrongSubjects)}
                              className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                                strongSubjects.includes(s)
                                  ? 'bg-green-50 border-green-400 text-green-700'
                                  : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'
                              }`}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Study style */}
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1.5">学習スタイル</label>
                    <div className="flex flex-wrap gap-2">
                      {STYLE_OPTIONS.map((s) => (
                        <button
                          key={s}
                          onClick={() => setStudyStyle(studyStyle === s ? '' : s)}
                          className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                            studyStyle === s
                              ? 'bg-sky-50 border-sky-400 text-sky-700'
                              : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Available days */}
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1.5">勉強できる曜日</label>
                    <div className="flex flex-wrap gap-1.5">
                      {WEEKDAYS.map((d) => (
                        <button
                          key={d}
                          onClick={() => toggleArrayItem(availableDays, d, setAvailableDays)}
                          className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                            availableDays.includes(d)
                              ? 'bg-teal-50 border-teal-400 text-teal-700'
                              : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'
                          }`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Rest day pattern */}
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1.5">休みの取り方（任意）</label>
                    <input
                      value={restDayPattern}
                      onChange={(e) => setRestDayPattern(e.target.value)}
                      maxLength={100}
                      placeholder="例: 日曜は完全休業、土曜は半日"
                      className={inputClass}
                    />
                  </div>

                  {/* Priority */}
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1.5">優先したいこと（任意）</label>
                    <input
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                      maxLength={200}
                      placeholder="例: 数学の過去問を多くこなす"
                      className={inputClass}
                    />
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1.5">その他の要望（任意）</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      maxLength={500}
                      placeholder="例: 平日は夜しかできない、模試が2週間後にある など"
                      rows={3}
                      className={inputClass + ' resize-none'}
                    />
                  </div>

                  <div className="flex items-center gap-2 text-xs text-teal-600 bg-teal-50 rounded-lg px-3 py-2">
                    <Brain className="w-3.5 h-3.5 shrink-0" />
                    AIチャットの過去の会話から学習状況を参照して、より個人的な計画を作成します。
                  </div>
                </div>
              )}
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <button
              onClick={() => requestPlan()}
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-xl py-3 transition-colors disabled:opacity-60"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {busy ? '計画を作成しています...' : '計画を提案してもらう'}
            </button>
          </div>
        ) : (
          plan && (
            <div className="flex flex-col min-h-0">
              <div className="p-5 overflow-y-auto space-y-4">
                <div>
                  <h4 className="font-bold text-gray-800">{plan.title}</h4>
                  {plan.advice && <p className="text-sm text-gray-600 mt-1 leading-relaxed">{plan.advice}</p>}
                  <p className="text-xs text-gray-400 mt-2">
                    {plan.days.length}日分・合計 {formatHours(totalMinutes)}
                    {!usedAi && '（AIが使えないため基本プランで作成しました）'}
                    {usedAi && usedMemories && '・過去の会話メモリを参照'}
                  </p>
                </div>

                <div className="border border-gray-100 rounded-xl divide-y divide-gray-100 max-h-72 overflow-y-auto">
                  {plan.days.map((d) => (
                    <div key={d.date} className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-700 mb-2">{formatDateJa(d.date)}</p>
                      {d.tasks.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {d.tasks.map((t, i) => (
                            <span key={`${d.date}-${i}`} className="text-xs bg-gray-50 text-gray-600 rounded-full px-2.5 py-1">
                              {t.subject} {t.targetMinutes}分
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300">休みの日</span>
                      )}
                    </div>
                  ))}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">修正したいこと（任意）</label>
                  <div className="flex gap-2">
                    <input
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      maxLength={300}
                      placeholder="例: 週末は時間を増やしたい"
                      className={inputClass}
                    />
                    <button
                      onClick={handleRevise}
                      disabled={busy || !feedback.trim()}
                      className="shrink-0 px-4 rounded-xl border border-teal-300 text-teal-700 text-sm font-medium hover:bg-teal-50 transition-colors disabled:opacity-40"
                    >
                      作り直す
                    </button>
                  </div>
                </div>

                {error && <p className="text-sm text-red-500">{error}</p>}
              </div>

              <div className="flex gap-2 p-5 pt-3 border-t border-gray-100">
                <button
                  onClick={() => setStep('form')}
                  disabled={busy}
                  className="flex items-center gap-1 px-4 py-2.5 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  <ArrowLeft className="w-4 h-4" />
                  条件を変える
                </button>
                <button
                  onClick={handleSave}
                  disabled={busy}
                  className="flex-1 flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-xl py-2.5 transition-colors disabled:opacity-60"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarCheck className="w-4 h-4" />}
                  カレンダーに反映する
                </button>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
