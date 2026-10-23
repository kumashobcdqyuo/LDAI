import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface DailyBarChartProps {
  data: { date: string; label: string; minutes: number }[];
  title?: string;
}

export function DailyBarChart({ data, title = '直近14日間の学習時間' }: DailyBarChartProps) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <h3 className="font-bold text-gray-800 text-base mb-4">直近14日間の学習時間</h3>
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
              formatter={(value) => [`${value}分`, '学習時間']}
              contentStyle={{
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                fontSize: '13px',
              }}
              cursor={{ fill: 'rgba(13,148,136,0.06)' }}
            />
            <Bar dataKey="minutes" fill="#0d9488" radius={[6, 6, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
