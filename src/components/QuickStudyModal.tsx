import { useState, useRef, useEffect } from 'react';
import { Play, Pause, Square, X, Clock, BookOpen, Check, Loader2, Timer } from 'lucide-react';
import { StudyRecord } from '@/lib/types';
import { todayStr } from '@/lib/dateUtils';

interface QuickStudyModalProps {
  open: boolean;
  onClose: () => void;
  onRecord: (record: Omit<StudyRecord, 'id'>) => Promise<{ error: string | null }>;
  subjects: string[];
}

export function QuickStudyModal({ open, onClose, onRecord, subjects }: QuickStudyModalProps) {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0); // seconds
  const [subject, setSubject] = useState(subjects[0] ?? '');
  const [memo, setMemo] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep subject valid
  if (subjects.length > 0 && !subjects.includes(subject)) {
    setSubject(subjects[0]);
  }

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setElapsed((e) => e + 1);
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setRunning(false);
      setElapsed(0);
      setMemo('');
      setDone(false);
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const handleSave = async () => {
    if (elapsed < 1) {
      setError('1秒以上学習してから記録してください');
      return;
    }
    setBusy(true);
    setError(null);
    const mins = Math.max(1, Math.round(elapsed / 60));
    const result = await onRecord({
      date: todayStr(),
      subject,
      minutes: mins,
      memo: memo.trim() || `${mins}分学習`,
    });
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setDone(true);
    setRunning(false);
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  const handleStopAndSave = () => {
    setRunning(false);
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-teal-100 rounded-xl flex items-center justify-center">
              <Timer className="w-5 h-5 text-teal-600" />
            </div>
            <h2 className="font-bold text-gray-800">今すぐ学習する</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Timer Display */}
        <div className="bg-gradient-to-br from-teal-50 to-sky-50 rounded-2xl py-8 px-4 text-center mb-5 border border-teal-100">
          <p className="text-4xl font-bold text-teal-700 tabular-nums tracking-wider">
            {timeStr}
          </p>
          <p className="text-xs text-teal-500 mt-1">
            {running ? '学習中...' : elapsed > 0 ? '一時停止中' : 'スタートを押して開始'}
          </p>
        </div>

        {/* Subject selector */}
        <div className="mb-4">
          <label className="flex items-center gap-1.5 text-sm font-medium text-gray-600 mb-1.5">
            <BookOpen className="w-4 h-4 text-teal-600" />
            科目
          </label>
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={running}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400"
          >
            {subjects.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Memo */}
        <div className="mb-4">
          <label className="flex items-center gap-1.5 text-sm font-medium text-gray-600 mb-1.5">
            <Clock className="w-4 h-4 text-teal-600" />
            メモ（任意）
          </label>
          <input
            type="text"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="例：基礎問題を解いた"
            maxLength={50}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
          />
        </div>

        {error && (
          <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2 mb-3">{error}</p>
        )}

        {done ? (
          <div className="flex items-center justify-center gap-2 bg-teal-50 text-teal-700 font-bold py-3 rounded-xl">
            <Check className="w-5 h-5" />
            記録しました！
          </div>
        ) : (
          <div className="flex gap-2">
            {!running ? (
              <button
                onClick={() => setRunning(true)}
                disabled={busy}
                className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4" />
                {elapsed > 0 ? '再開' : 'スタート'}
              </button>
            ) : (
              <button
                onClick={() => setRunning(false)}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <Pause className="w-4 h-4" />
                一時停止
              </button>
            )}

            {elapsed > 0 && !running && (
              <button
                onClick={handleSave}
                disabled={busy}
                className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {busy ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    保存中...
                  </>
                ) : (
                  <>
                    <Square className="w-4 h-4" />
                    記録する
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
