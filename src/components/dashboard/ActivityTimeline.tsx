import { CheckCircle, MessageSquare, Heart, Bell, FileText, Home } from 'lucide-react';

interface Activity {
  id: string;
  type: string;
  message: string;
  timestamp: string;
}

interface ActivityTimelineProps {
  activities: Activity[];
}

export default function ActivityTimeline({ activities }: ActivityTimelineProps) {
  const getIcon = (type: string) => {
    switch (type) {
      case 'booking':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'message':
        return <MessageSquare className="h-5 w-5 text-blue-600" />;
      case 'favorite':
        return <Heart className="h-5 w-5 text-rose-600" />;
      case 'notification':
        return <Bell className="h-5 w-5 text-orange-600" />;
      case 'document':
        return <FileText className="h-5 w-5 text-purple-600" />;
      case 'listing':
        return <Home className="h-5 w-5 text-indigo-600" />;
      default:
        return <Bell className="h-5 w-5 text-gray-600" />;
    }
  };

  const getTimeAgo = (timestamp: string) => {
    const now = new Date();
    const then = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - then.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'À l\'instant';
    if (diffInMinutes < 60) return `Il y a ${diffInMinutes}min`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `Il y a ${diffInHours}h`;

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `Il y a ${diffInDays}j`;

    return then.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  if (activities.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        Aucune activité récente
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {activities.map((activity, index) => (
        <div key={activity.id} className="flex gap-4">
          <div className="relative flex flex-col items-center">
            <div className="bg-white rounded-full p-2 shadow-md border-2 border-gray-100">
              {getIcon(activity.type)}
            </div>
            {index < activities.length - 1 && (
              <div className="w-0.5 h-full bg-gray-200 mt-2"></div>
            )}
          </div>

          <div className="flex-1 pb-6">
            <p className="text-sm text-gray-900 font-medium">{activity.message}</p>
            <p className="text-xs text-gray-500 mt-1">{getTimeAgo(activity.timestamp)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
