import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { SUBJECT_COLORS } from '@/lib/sampleData';

interface SubjectPieChartProps {
  data: { subject: string; minutes: number }[];
}

export function SubjectPieChart({ data }: SubjectPieChartProps) {
  const hasData = data.some((d) => d.minutes > 0);

  if (!hasData) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h3 className="font-bold text-gray-800 text-base mb-4">科目別の学習時間</h3>
        <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
          まだ学習記録がありません
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <h3 className="font-bold text-gray-800 text-base mb-4">科目別の学習時間</h3>
      <div className="w-full h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="minutes"
              nameKey="subject"
              cx="50%"
              cy="45%"
              innerRadius={45}
              outerRadius={80}
              paddingAngle={2}
            >
              {data.map((entry) => (
                <Cell
                  key={entry.subject}
                  fill={SUBJECT_COLORS[entry.subject] ?? '#94a3b8'}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, _name, entry) => [
                `${value}分`,
                (entry?.payload as { subject?: string })?.subject ?? '',
              ]}
              contentStyle={{
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                fontSize: '13px',
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: '12px' }}
              iconType="circle"
              iconSize={8}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
