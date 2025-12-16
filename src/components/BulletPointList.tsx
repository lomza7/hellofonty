import React from 'react';
import * as LucideIcons from 'lucide-react';

interface BulletPoint {
  icon: string;
  text: string;
}

interface BulletPointListProps {
  items: BulletPoint[];
}

export default function BulletPointList({ items }: BulletPointListProps) {
  return (
    <ul className="space-y-4">
      {items.map((item, index) => {
        const IconComponent = (LucideIcons as any)[item.icon] || LucideIcons.Check;

        return (
          <li key={index} className="flex items-start gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center mt-0.5">
              <IconComponent className="w-4 h-4 text-blue-600" />
            </div>
            <span className="text-gray-700 leading-relaxed">{item.text}</span>
          </li>
        );
      })}
    </ul>
  );
}
