import { Lightbulb, PartyPopper, AlertCircle, Sparkles } from 'lucide-react';
import { AdviceResult } from '@/lib/getAdvice';

interface AdviceCardProps {
  advice: AdviceResult;
  onClick?: () => void;
}

const toneConfig = {
  praise: {
    icon: PartyPopper,
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    titleColor: 'text-amber-900',
    textColor: 'text-amber-700',
  },
  warn: {
    icon: AlertCircle,
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    iconBg: 'bg-orange-100',
    iconColor: 'text-orange-600',
    titleColor: 'text-orange-900',
    textColor: 'text-orange-700',
  },
  tip: {
    icon: Lightbulb,
    bg: 'bg-sky-50',
    border: 'border-sky-200',
    iconBg: 'bg-sky-100',
    iconColor: 'text-sky-600',
    titleColor: 'text-sky-900',
    textColor: 'text-sky-700',
  },
};

export function AdviceCard({ advice, onClick }: AdviceCardProps) {
  const cfg = toneConfig[advice.tone];
  const Icon = cfg.icon;

  return (
    <button
      onClick={onClick}
      className={`${cfg.bg} ${cfg.border} border rounded-2xl p-5 flex gap-4 items-start w-full text-left transition-shadow hover:shadow-md cursor-pointer`}
    >
      <div className={`${cfg.iconBg} w-11 h-11 rounded-xl flex items-center justify-center shrink-0`}>
        <Icon className={`w-5 h-5 ${cfg.iconColor}`} />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <h3 className={`font-bold ${cfg.titleColor} text-base`}>{advice.title}</h3>
          <span className="flex items-center gap-0.5 text-xs text-gray-400 font-medium">
            <Sparkles className="w-3 h-3" />
            AI アドバイス
          </span>
        </div>
        <p className={`text-sm ${cfg.textColor} leading-relaxed`}>{advice.message}</p>
      </div>
    </button>
  );
}
