import { useState, useEffect } from 'react';
import { Play, Pause, Square, X, BookOpen, Coffee, Timer } from 'lucide-react';
import { StudyRecord } from '@/lib/types';
import { todayStr } from '@/lib/dateUtils';

const FOCUS_OPTIONS = [15, 25, 50] as const;
const BREAK_SECONDS = 5 * 60;
const RING_RADIUS = 72;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

type Phase = 'focus' | 'break';
type Status = 'idle' | 'running' | 'paused';

interface QuickStudyModalProps {
  open: boolean;
  onClose: () => void;
  onRecord: (record: Omit<StudyRecord, 'id'>) => Promise<{ error: string | null }>;
  subjects: string[];
}

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function QuickStudyModal({ open, onClose, onRecord, subjects }: QuickStudyModalProps) {
  const [focusMinutes, setFocusMinutes] = useState<number>(25);
  const [subject, setSubject] = useState(subjects[0] ?? '');
  const [phase, setPhase] = useState<Phase>('focus');
  const [status, setStatus] = useState<Status>('idle');
  const [remaining, setRemaining] = useState(25 * 60);
  const [endAt, setEndAt] = useState<number | null>(null);
  const [cycles, setCycles] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (subjects.length > 0 && !subjects.includes(subject)) {
    setSubject(subjects[0]);
  }

  const totalSeconds = phase === 'focus' ? focusMinutes * 60 : BREAK_SECONDS;
  const displaySeconds = status === 'idle' ? totalSeconds : remaining;
  const ringOffset = RING_CIRCUMFERENCE * (1 - displaySeconds / totalSeconds);

  const recordFocus = async (minutes: number) => {
    const result = await onRecord({
      date: todayStr(),
      subject,
      minutes,
      memo: `集中タイマー ${minutes}分`,
    });
    if (result.error) {
      setError(`記録できませんでした: ${result.error}`);
      return;
    }
    setError(null);
    setNotice(`${minutes}分の学習を記録しました`);
  };

  const resetToIdle = () => {
    setPhase('focus');
    setStatus('idle');
    setEndAt(null);
    setRemaining(focusMinutes * 60);
  };

  // Timing is based on an absolute end time so the countdown stays accurate
  // when the tab is in the background or the modal is closed.
  useEffect(() => {
    if (status !== 'running' || endAt === null) return;

    let intervalId: ReturnType<typeof setInterval> | undefined;
    const tick = () => {
      const left = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      setRemaining(left);
      if (left > 0) return;

      if (intervalId) clearInterval(intervalId);
      if (phase === 'focus') {
        setCycles((c) => c + 1);
        setPhase('break');
        setRemaining(BREAK_SECONDS);
        setEndAt(Date.now() + BREAK_SECONDS * 1000);
        recordFocus(focusMinutes);
      } else {
        resetToIdle();
        setNotice('休憩が終わりました。次の集中を始めましょう');
      }
    };

    tick();
    intervalId = setInterval(tick, 500);
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [status, endAt, phase, focusMinutes, subject, onRecord]);

  if (!open) return null;

  const handleStart = () => {
    setError(null);
    setNotice(null);
    setRemaining(focusMinutes * 60);
    setEndAt(Date.now() + focusMinutes * 60 * 1000);
    setStatus('running');
  };

  const handlePause = () => {
    setRemaining(Math.max(0, Math.ceil(((endAt ?? Date.now()) - Date.now()) / 1000)));
    setEndAt(null);
    setStatus('paused');
  };

  const handleResume = () => {
    setEndAt(Date.now() + remaining * 1000);
    setStatus('running');
  };

  const handleStop = async () => {
    const wasFocus = phase === 'focus';
    const elapsedMinutes = Math.floor((focusMinutes * 60 - remaining) / 60);
    resetToIdle();
    if (wasFocus && elapsedMinutes >= 1) {
      await recordFocus(elapsedMinutes);
    }
  };

  const isFocus = phase === 'focus';

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-teal-100 rounded-xl flex items-center justify-center">
              <Timer className="w-5 h-5 text-teal-600" />
            </div>
            <h2 className="font-bold text-gray-800">ポモドーロタイマー</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col items-center mb-5">
          <div className="relative w-44 h-44">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 180 180">
              <circle cx="90" cy="90" r={RING_RADIUS} fill="none" stroke="#e5e7eb" strokeWidth="10" />
              <circle
                cx="90"
                cy="90"
                r={RING_RADIUS}
                fill="none"
                stroke={isFocus ? '#0d9488' : '#0ea5e9'}
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={ringOffset}
                className="transition-[stroke-dashoffset] duration-500 ease-linear"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-3xl font-bold text-gray-800 tabular-nums tracking-wider">
                {formatClock(displaySeconds)}
              </p>
              <span
                className={`mt-1 inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full ${
                  isFocus ? 'bg-teal-50 text-teal-700' : 'bg-sky-50 text-sky-700'
                }`}
              >
                {isFocus ? <Timer className="w-3 h-3" /> : <Coffee className="w-3 h-3" />}
                {isFocus ? '集中' : '休憩'}
              </span>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3 min-h-[1rem]">
            {status === 'running'
              ? isFocus
                ? '集中して学習中...'
                : '休憩中。ゆっくり休みましょう'
              : status === 'paused'
                ? '一時停止中'
                : `${focusMinutes}分の集中と${BREAK_SECONDS / 60}分の休憩を繰り返します`}
          </p>
        </div>

        {status === 'idle' && (
          <div className="mb-4">
            <p className="text-sm font-medium text-gray-600 mb-1.5">集中時間</p>
            <div className="grid grid-cols-3 gap-2">
              {FOCUS_OPTIONS.map((minutes) => (
                <button
                  key={minutes}
                  onClick={() => setFocusMinutes(minutes)}
                  className={`py-2 rounded-xl text-sm font-bold border transition-colors ${
                    focusMinutes === minutes
                      ? 'bg-teal-600 border-teal-600 text-white'
                      : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  {minutes}分
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mb-4">
          <label className="flex items-center gap-1.5 text-sm font-medium text-gray-600 mb-1.5">
            <BookOpen className="w-4 h-4 text-teal-600" />
            科目
          </label>
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={status !== 'idle'}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400"
          >
            {subjects.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {error && (
          <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2 mb-3">{error}</p>
        )}
        {notice && !error && (
          <p className="text-sm text-teal-700 bg-teal-50 rounded-lg px-3 py-2 mb-3">{notice}</p>
        )}

        <div className="flex gap-2">
          {status === 'idle' && (
            <button
              onClick={handleStart}
              className="flex-1 bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4" />
              集中を始める
            </button>
          )}
          {status === 'running' && (
            <button
              onClick={handlePause}
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <Pause className="w-4 h-4" />
              一時停止
            </button>
          )}
          {status === 'paused' && (
            <button
              onClick={handleResume}
              className="flex-1 bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4" />
              再開
            </button>
          )}
          {status !== 'idle' && (
            <button
              onClick={handleStop}
              className="px-4 border border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
            >
              <Square className="w-4 h-4" />
              終了
            </button>
          )}
        </div>

        <p className="text-xs text-gray-400 text-center mt-4">
          完了した集中セット: {cycles}回
        </p>
      </div>
    </div>
  );
}
