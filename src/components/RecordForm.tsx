import { useState } from 'react';
import { Plus, Calendar, BookOpen, Clock, MessageSquare, Loader2, X, Check } from 'lucide-react';
import { StudyRecord } from '@/lib/types';
import { todayStr } from '@/lib/dateUtils';

interface RecordFormProps {
  onAdd: (record: Omit<StudyRecord, 'id'>) => Promise<{ error: string | null }>;
  subjects: string[];
  onAddSubject: (name: string) => Promise<{ error: string | null }>;
  onRemoveSubject: (name: string) => Promise<{ error: string | null }>;
}

export function RecordForm({ onAdd, subjects, onAddSubject, onRemoveSubject }: RecordFormProps) {
  const [date, setDate] = useState(todayStr());
  const [subject, setSubject] = useState<string>(subjects[0] ?? '');
  const [minutes, setMinutes] = useState('30');
  const [memo, setMemo] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  // Subject add state
  const [showSubjectInput, setShowSubjectInput] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [subjectBusy, setSubjectBusy] = useState(false);
  const [subjectError, setSubjectError] = useState<string | null>(null);

  // Keep subject valid when subjects list changes
  if (subjects.length > 0 && !subjects.includes(subject)) {
    setSubject(subjects[0]);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const mins = parseInt(minutes, 10);
    if (!date || !subject || isNaN(mins) || mins <= 0) return;
    setBusy(true);
    setDone(false);
    setSubmitError(null);
    const result = await onAdd({ date, subject, minutes: mins, memo });
    setBusy(false);
    if (result.error) {
      setSubmitError(result.error);
      return;
    }
    setDone(true);
    setMemo('');
    setMinutes('30');
    setShowForm(false);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 2500);
    setTimeout(() => setDone(false), 2500);
  };

  const handleAddSubject = async () => {
    if (!newSubject.trim()) return;
    setSubjectBusy(true);
    setSubjectError(null);
    const result = await onAddSubject(newSubject);
    setSubjectBusy(false);
    if (result.error) {
      setSubjectError(result.error);
      return;
    }
    setSubject(newSubject.trim());
    setNewSubject('');
    setShowSubjectInput(false);
  };

  if (!showForm) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        {justAdded ? (
          <div className="text-center py-2">
            <p className="text-teal-600 font-bold text-sm">
              学習記録を追加しました！
            </p>
          </div>
        ) : null}
        <button
          onClick={() => setShowForm(true)}
          className="w-full flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 rounded-xl transition-colors"
        >
          <Plus className="w-5 h-5" />
          学習記録を追加する
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <h3 className="font-bold text-gray-800 text-base mb-4">学習記録を入力</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="flex items-center gap-1.5 text-sm font-medium text-gray-600 mb-1.5">
            <Calendar className="w-4 h-4 text-teal-600" />
            日付
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
            required
          />
        </div>

        <div>
          <label className="flex items-center gap-1.5 text-sm font-medium text-gray-600 mb-1.5">
            <BookOpen className="w-4 h-4 text-teal-600" />
            科目
          </label>
          <div className="flex gap-2">
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent bg-white"
            >
              {subjects.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowSubjectInput(!showSubjectInput)}
              className="shrink-0 bg-teal-50 hover:bg-teal-100 text-teal-600 font-medium text-sm px-3 rounded-xl border border-teal-100 transition-colors flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              追加
            </button>
          </div>

          {showSubjectInput && (
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                placeholder="新しい科目名"
                maxLength={20}
                autoFocus
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSubject();
                  }
                }}
              />
              <button
                type="button"
                onClick={handleAddSubject}
                disabled={subjectBusy || !newSubject.trim()}
                className="shrink-0 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold text-sm px-4 rounded-xl transition-colors flex items-center gap-1"
              >
                {subjectBusy ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                追加
              </button>
            </div>
          )}
          {subjectError && (
            <p className="text-sm text-red-500 mt-1.5">{subjectError}</p>
          )}

          {/* Custom subject tags with delete */}
          {subjects.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {subjects.map((s) => (
                <span
                  key={s}
                  className={`text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1 ${
                    subject === s
                      ? 'bg-teal-600 text-white'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {s}
                  <button
                    type="button"
                    onClick={async () => {
                      const result = await onRemoveSubject(s);
                      if (result.error) setSubjectError(result.error);
                    }}
                    className="hover:text-red-400 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="flex items-center gap-1.5 text-sm font-medium text-gray-600 mb-1.5">
            <Clock className="w-4 h-4 text-teal-600" />
            学習時間（分）
          </label>
          <input
            type="number"
            min="1"
            max="600"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
            required
          />
        </div>

        <div>
          <label className="flex items-center gap-1.5 text-sm font-medium text-gray-600 mb-1.5">
            <MessageSquare className="w-4 h-4 text-teal-600" />
            ひとことメモ
          </label>
          <input
            type="text"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="例：基礎問題を10問解いた"
            maxLength={50}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
          />
        </div>

        {submitError && (
          <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{submitError}</p>
        )}

        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            disabled={busy}
            className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {busy ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                送信中...
              </>
            ) : done ? (
              <>送信完了</>
            ) : (
              <>追加する</>
            )}
          </button>
          <button
            type="button"
            onClick={() => setShowForm(false)}
            className="px-4 border border-gray-200 text-gray-600 font-bold py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
          >
            キャンセル
          </button>
        </div>
      </form>
    </div>
  );
}
