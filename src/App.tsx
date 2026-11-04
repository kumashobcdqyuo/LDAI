import { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  BarChart3,
  Clock,
  Flame,
  CalendarDays,
  Loader2,
  RefreshCw,
  Settings,
  X,
  Check,
  LogOut,
  MessageSquare,
  Target,
  CheckCircle,
  Circle,
  Timer,
  Play,
} from 'lucide-react';
import { StudyRecord } from '@/lib/types';
import {
  minutesThisWeek,
  minutesThisMonth,
  streakDays,
  subjectBreakdown,
  chartDataForPeriod,
  filterByPeriod,
  PERIOD_OPTIONS,
  Period,
} from '@/lib/stats';
import { getAdvice, AdviceResult } from '@/lib/getAdvice';
import { useAuth } from '@/lib/auth';
import { useStudyData } from '@/lib/useStudyData';
import { useStudyPlans } from '@/lib/useStudyPlans';
import { StatCard } from '@/components/StatCard';
import { DailyBarChart } from '@/components/DailyBarChart';
import { SubjectPieChart } from '@/components/SubjectPieChart';
import { RecordForm } from '@/components/RecordForm';
import { CommunityRanking } from '@/components/CommunityRanking';
import { AdviceCard } from '@/components/AdviceCard';
import { ChatPanel } from '@/components/ChatPanel';
import { StudyPlanPanel } from '@/components/StudyPlanPanel';
import { QuickStudyModal } from '@/components/QuickStudyModal';

type Tab = 'dashboard' | 'plan' | 'community' | 'chat';

function formatHours(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}分`;
  if (m === 0) return `${h}時間`;
  return `${h}時間${m}分`;
}

function App() {
  const { profile, updateName, signOut } = useAuth();
  const { users, myRecords, loading, addRecord, allSubjects, addSubject, removeSubject, reload: reloadStudyData } = useStudyData();
  const { plans, createPlan, toggleTask, addTask: addPlanTask, deletePlan } = useStudyPlans();

  const handleToggleTask = async (planId: string, taskId: string) => {
    const result = await toggleTask(planId, taskId);
    if (!result.error) await reloadStudyData();
    return result;
  };
  const [tab, setTab] = useState<Tab>('dashboard');
  const [advice, setAdvice] = useState<AdviceResult | null>(null);
  const [adviceLoading, setAdviceLoading] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [nameBusy, setNameBusy] = useState(false);
  const [nameDone, setNameDone] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>('14days');
  const [showQuickStudy, setShowQuickStudy] = useState(false);

  const weekMins = minutesThisWeek(myRecords);
  const monthMins = minutesThisMonth(myRecords);
  const streak = streakDays(myRecords);
  const periodRecords = filterByPeriod(myRecords, period);
  const chartData = chartDataForPeriod(myRecords, period);
  const subjectData = subjectBreakdown(periodRecords);
  const periodTotal = periodRecords.reduce((s, r) => s + r.minutes, 0);
  const periodLabel = PERIOD_OPTIONS.find((o) => o.value === period)?.label ?? '';

  const activePlans = plans.filter((p) => {
    const doneCount = p.tasks.filter((t) => t.done).length;
    return doneCount < p.tasks.length;
  });

  useEffect(() => {
    if (myRecords.length === 0 && loading) return;
    let cancelled = false;
    setAdviceLoading(true);
    (async () => {
      const result = await getAdvice(myRecords, profile?.name);
      if (!cancelled) {
        setAdvice(result);
        setAdviceLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [myRecords, profile?.name, loading]);

  const handleAddRecord = async (record: Omit<StudyRecord, 'id'>): Promise<{ error: string | null }> => {
    return addRecord(record);
  };

  const handleSaveName = async () => {
    if (!nameInput.trim()) return;
    setNameBusy(true);
    setNameDone(false);
    setNameError(null);
    const result = await updateName(nameInput.trim());
    setNameBusy(false);
    if (result.error) {
      setNameError(result.error);
      return;
    }
    setNameDone(true);
    setTimeout(() => {
      setShowNameModal(false);
      setNameDone(false);
    }, 1000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 via-gray-50 to-sky-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
          <p className="text-gray-400 text-sm">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-gray-50 to-sky-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-teal-600 rounded-xl flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold italic text-teal-700 text-lg leading-tight">
                LDA
              </h1>
              <p className="text-xs text-gray-400 leading-tight">
                仲間と一緒に学習を可視化
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowQuickStudy(true)}
              className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm px-4 py-2 rounded-xl transition-colors shadow-sm"
            >
              <Play className="w-4 h-4" />
              <span className="hidden sm:inline">学習を始める</span>
              <span className="sm:hidden">開始</span>
            </button>
            {profile && (
              <button
                onClick={() => {
                  setNameInput(profile.name);
                  setShowNameModal(true);
                }}
                className="flex items-center gap-2 group"
                title="名前を変更する"
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
                  style={{ backgroundColor: profile.avatar_color }}
                >
                  {profile.name.charAt(0)}
                </div>
                <span className="text-sm font-medium text-gray-600 hidden sm:inline group-hover:text-teal-600 transition-colors">
                  {profile.name}
                </span>
                <Settings className="w-3.5 h-3.5 text-gray-300 group-hover:text-teal-500 transition-colors hidden sm:inline" />
              </button>
            )}
            <button
              onClick={() => signOut()}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              title="ログアウト"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="bg-white border-b border-gray-100 sticky top-[57px] z-10">
        <div className="max-w-5xl mx-auto px-4 flex gap-1">
          <TabButton
            active={tab === 'dashboard'}
            onClick={() => setTab('dashboard')}
            icon={<LayoutDashboard className="w-4 h-4" />}
            label="ダッシュボード"
          />
          <TabButton
            active={tab === 'plan'}
            onClick={() => setTab('plan')}
            icon={<Target className="w-4 h-4" />}
            label="学習計画"
          />
          <TabButton
            active={tab === 'community'}
            onClick={() => setTab('community')}
            icon={<Users className="w-4 h-4" />}
            label="みんなの学習状況"
          />
          <TabButton
            active={tab === 'chat'}
            onClick={() => setTab('chat')}
            icon={<MessageSquare className="w-4 h-4" />}
            label="AIチャット"
          />
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-6 pb-24">
        {tab === 'dashboard' ? (
          <div className="space-y-5">
            {/* Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard
                label="今週の学習時間"
                value={formatHours(weekMins)}
                icon={Clock}
                color="#0d9488"
              />
              <StatCard
                label="連続学習日数"
                value={`${streak}日`}
                sub={streak >= 1 ? '継続中！' : ''}
                icon={Flame}
                color="#f59e0b"
              />
              <StatCard
                label="今月の学習時間"
                value={formatHours(monthMins)}
                icon={CalendarDays}
                color="#3b82f6"
              />
            </div>

            {/* Advice */}
            {adviceLoading ? (
              <div className="bg-sky-50 border border-sky-200 rounded-2xl p-5 flex items-center gap-3">
                <div className="bg-sky-100 w-11 h-11 rounded-xl flex items-center justify-center shrink-0">
                  <RefreshCw className="w-5 h-5 text-sky-600 animate-spin" />
                </div>
                <p className="text-sm text-sky-700 font-medium">
                  AIアドバイスを生成中...
                </p>
              </div>
            ) : advice ? (
              <AdviceCard advice={advice} onClick={() => setTab('chat')} />
            ) : null}

            {/* Active Plan Progress */}
            {activePlans.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-teal-600" />
                    <h3 className="font-bold text-gray-800 text-sm">進行中の学習計画</h3>
                  </div>
                  <button
                    onClick={() => setTab('plan')}
                    className="text-xs text-teal-600 font-medium hover:text-teal-700 transition-colors"
                  >
                    すべて見る →
                  </button>
                </div>
                <div className="space-y-3">
                  {activePlans.slice(0, 2).map((plan) => {
                    const done = plan.tasks.filter((t) => t.done).length;
                    const total = plan.tasks.length;
                    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                    return (
                      <div key={plan.id}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-700">{plan.title}</span>
                          <span className="text-xs text-gray-400">{done}/{total}完了 ({pct}%)</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-teal-500 rounded-full transition-all duration-300"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Period Selector + Stats */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-teal-600" />
                  <span className="text-sm font-bold text-gray-700">期間</span>
                </div>
                <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                  {PERIOD_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setPeriod(opt.value)}
                      className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                        period === opt.value
                          ? 'bg-white text-teal-600 shadow-sm'
                          : 'text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-gray-50">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-gray-800">{formatHours(periodTotal)}</span>
                  <span className="text-sm text-gray-400">{periodLabel}の合計学習時間</span>
                </div>
              </div>
            </div>

            {/* Record Form */}
            <RecordForm onAdd={handleAddRecord} subjects={allSubjects} onAddSubject={addSubject} onRemoveSubject={removeSubject} />

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <DailyBarChart data={chartData} title={`${periodLabel}の学習時間`} />
              <SubjectPieChart data={subjectData} />
            </div>
          </div>
        ) : tab === 'plan' ? (
          <StudyPlanPanel
            plans={plans}
            subjects={allSubjects}
            onCreatePlan={createPlan}
            onToggleTask={handleToggleTask}
            onAddTask={addPlanTask}
            onDeletePlan={deletePlan}
          />
        ) : tab === 'community' ? (
          <CommunityRanking users={users} />
        ) : (
          <ChatPanel records={myRecords} userName={profile?.name} plans={plans} />
        )}
      </main>

      {/* Quick Study Modal */}
      <QuickStudyModal
        open={showQuickStudy}
        onClose={() => setShowQuickStudy(false)}
        onRecord={handleAddRecord}
        subjects={allSubjects}
      />

      {/* Name Edit Modal */}
      {showNameModal && (
        <div
          className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4"
          onClick={() => setShowNameModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-800">名前の設定</h2>
              <button
                onClick={() => setShowNameModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              みんなの学習状況に表示される名前です。いつでも変更できます。
            </p>
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              maxLength={20}
              placeholder="あなたの名前"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent mb-3"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveName();
              }}
            />
            {nameError && (
              <p className="text-sm text-red-500 mb-3">{nameError}</p>
            )}
            <button
              onClick={handleSaveName}
              disabled={nameBusy || !nameInput.trim()}
              className="w-full bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {nameBusy ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  保存中...
                </>
              ) : nameDone ? (
                <>
                  <Check className="w-4 h-4" />
                  保存完了
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  保存する
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

function TabButton({ active, onClick, icon, label }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 py-3 px-3 text-sm font-bold border-b-2 transition-colors ${
        active
          ? 'border-teal-600 text-teal-600'
          : 'border-transparent text-gray-400 hover:text-gray-600'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

export default App;
