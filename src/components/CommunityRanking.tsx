import { useState } from 'react';
import { Trophy, Crown, Medal, ChevronRight } from 'lucide-react';
import { User } from '@/lib/types';
import { minutesThisWeek } from '@/lib/stats';
import { DailyBarChart } from './DailyBarChart';
import { dailyMinutes, subjectBreakdown } from '@/lib/stats';
import { SubjectPieChart } from './SubjectPieChart';

interface CommunityRankingProps {
  users: User[];
}

function formatHours(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}分`;
  if (m === 0) return `${h}時間`;
  return `${h}時間${m}分`;
}

export function CommunityRanking({ users }: CommunityRankingProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const ranked = [...users]
    .map((u) => ({ user: u, mins: minutesThisWeek(u.records) }))
    .sort((a, b) => b.mins - a.mins);

  const selectedUser = ranked.find((r) => r.user.id === selectedId)?.user ?? null;

  const rankIcons = [
    <Crown key="1" className="w-5 h-5 text-amber-500" />,
    <Medal key="2" className="w-5 h-5 text-slate-400" />,
    <Medal key="3" className="w-5 h-5 text-orange-400" />,
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="w-5 h-5 text-amber-500" />
          <h3 className="font-bold text-gray-800 text-base">みんなの今週の学習時間</h3>
        </div>
        <div className="space-y-2">
          {ranked.map((entry, i) => {
            const isSelected = selectedId === entry.user.id;
            return (
              <button
                key={entry.user.id}
                onClick={() =>
                  setSelectedId(isSelected ? null : entry.user.id)
                }
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left ${
                  isSelected
                    ? 'bg-teal-50 border border-teal-200'
                    : 'hover:bg-gray-50 border border-transparent'
                }`}
              >
                <div className="w-8 text-center font-bold text-sm shrink-0">
                  {i < 3 ? (
                    <span className="flex justify-center">{rankIcons[i]}</span>
                  ) : (
                    <span className="text-gray-400">{i + 1}</span>
                  )}
                </div>
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                  style={{ backgroundColor: entry.user.avatarColor }}
                >
                  {entry.user.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-800 text-sm truncate">
                    {entry.user.name}
                  </p>
                  <p className="text-xs text-gray-400">
                    {formatHours(entry.mins)}
                  </p>
                </div>
                {/* mini bar */}
                <div className="hidden sm:block w-24 bg-gray-100 rounded-full h-2 overflow-hidden shrink-0">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${ranked[0].mins > 0 ? (entry.mins / ranked[0].mins) * 100 : 0}%`,
                      backgroundColor: entry.user.avatarColor,
                    }}
                  />
                </div>
                <ChevronRight
                  className={`w-4 h-4 text-gray-300 shrink-0 transition-transform ${
                    isSelected ? 'rotate-90' : ''
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>

      {selectedUser && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
              style={{ backgroundColor: selectedUser.avatarColor }}
            >
              {selectedUser.name.charAt(0)}
            </div>
            <div>
              <p className="font-bold text-gray-800">{selectedUser.name}さんの学習記録</p>
              <p className="text-xs text-gray-400">直近14日間のデータ</p>
            </div>
          </div>
          <DailyBarChart data={dailyMinutes(selectedUser.records, 14)} />
          <SubjectPieChart data={subjectBreakdown(selectedUser.records)} />
        </div>
      )}
    </div>
  );
}
