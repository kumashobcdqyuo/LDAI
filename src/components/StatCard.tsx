import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  color: string;
}

export function StatCard({ label, value, sub, icon: Icon, color }: StatCardProps) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex items-center gap-4 transition-shadow hover:shadow-md">
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${color}1a` }}
      >
        <Icon className="w-6 h-6" style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-gray-500 font-medium">{label}</p>
        <p className="text-2xl font-bold text-gray-800 leading-tight">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}
