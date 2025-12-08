import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  icon: LucideIcon;
  title: string;
  value: string | number;
  variation?: {
    value: string;
    positive: boolean;
  };
  iconColor?: string;
  iconBg?: string;
}

export default function StatCard({
  icon: Icon,
  title,
  value,
  variation,
  iconColor = 'text-rose-600',
  iconBg = 'bg-rose-100'
}: StatCardProps) {
  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-300 hover:scale-105">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mb-2">{value}</p>
          {variation && (
            <div className="flex items-center gap-1">
              <span className={`text-sm font-medium ${variation.positive ? 'text-green-600' : 'text-red-600'}`}>
                {variation.positive ? '↑' : '↓'} {variation.value}
              </span>
            </div>
          )}
        </div>
        <div className={`${iconBg} p-3 rounded-xl`}>
          <Icon className={`h-6 w-6 ${iconColor}`} />
        </div>
      </div>
    </div>
  );
}
