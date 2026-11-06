import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface DailyBarChartDatum {
  date: string;
  label: string;
  minutes: number;
  [subject: string]: string | number;
}

interface DailyBarChartProps {
  data: DailyBarChartDatum[];
  title?: string;
  subjects?: string[];
  subjectColors?: Record<string, string>;
}

const DEFAULT_COLORS = [
  '#0d9488',
  '#3b82f6',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#f97316',
  '#6366f1',
  '#84cc16',
];

export function DailyBarChart({
  data,
  title = '直近14日間の学習時間',
  subjects = [],
  subjectColors = {},
}: DailyBarChartProps) {
  const colorFor = (subject: string, index: number) =>
    subjectColors[subject] ?? DEFAULT_COLORS[index % DEFAULT_COLORS.length];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="font-bold text-gray-800 text-base">{title}</h3>
        {subjects.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {subjects.map((s, i) => (
              <span key={s} className="flex items-center gap-1 text-xs text-gray-500">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: colorFor(s, i) }}
                />
                {s}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="w-full h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              formatter={((value: number, name: string) => [`${value}分`, name]) as never}
              contentStyle={{
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                fontSize: '13px',
              }}
              cursor={{ fill: 'rgba(13,148,136,0.06)' }}
            />
            {subjects.length > 0 ? (
              subjects.map((subject, i) => (
                <Bar
                  key={subject}
                  dataKey={subject}
                  stackId="a"
                  fill={colorFor(subject, i)}
                  maxBarSize={28}
                />
              ))
            ) : (
              <Bar dataKey="minutes" fill="#0d9488" radius={[6, 6, 0, 0]} maxBarSize={28} />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
