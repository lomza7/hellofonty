import { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

interface QuickActionButtonProps {
  icon: LucideIcon;
  label: string;
  href: string;
  badge?: number;
  color?: string;
}

export default function QuickActionButton({
  icon: Icon,
  label,
  href,
  badge,
  color = 'rose'
}: QuickActionButtonProps) {
  const colorClasses = {
    rose: 'bg-rose-50 text-rose-600 hover:bg-rose-100',
    blue: 'bg-blue-50 text-blue-600 hover:bg-blue-100',
    green: 'bg-green-50 text-green-600 hover:bg-green-100',
    purple: 'bg-purple-50 text-purple-600 hover:bg-purple-100',
    orange: 'bg-orange-50 text-orange-600 hover:bg-orange-100',
    yellow: 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100'
  };

  return (
    <Link
      to={href}
      className={`relative flex flex-col items-center justify-center gap-2 p-6 rounded-2xl ${colorClasses[color as keyof typeof colorClasses] || colorClasses.rose} transition-all duration-300 hover:scale-105 hover:shadow-lg group`}
    >
      {badge !== undefined && badge > 0 && (
        <span className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full min-w-[24px] text-center animate-pulse">
          {badge > 99 ? '99+' : badge}
        </span>
      )}

      <Icon className="h-8 w-8 group-hover:scale-110 transition-transform" />
      <span className="text-sm font-semibold text-center">{label}</span>
    </Link>
  );
}
