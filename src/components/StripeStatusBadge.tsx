import { AlertCircle, Clock, CheckCircle } from 'lucide-react';
import type { StripeOnboardingStatus } from '../types/stripe';

interface StripeStatusBadgeProps {
  status: StripeOnboardingStatus;
  size?: 'sm' | 'md' | 'lg';
}

export default function StripeStatusBadge({ status, size = 'md' }: StripeStatusBadgeProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'not_connected':
        return {
          icon: AlertCircle,
          text: 'Non connecté',
          bgColor: 'bg-red-100',
          textColor: 'text-red-800',
          iconColor: 'text-red-600',
        };
      case 'pending':
        return {
          icon: Clock,
          text: 'En cours',
          bgColor: 'bg-yellow-100',
          textColor: 'text-yellow-800',
          iconColor: 'text-yellow-600',
        };
      case 'complete':
        return {
          icon: CheckCircle,
          text: 'Paiements activés',
          bgColor: 'bg-green-100',
          textColor: 'text-green-800',
          iconColor: 'text-green-600',
        };
      default:
        return {
          icon: AlertCircle,
          text: status,
          bgColor: 'bg-gray-100',
          textColor: 'text-gray-800',
          iconColor: 'text-gray-600',
        };
    }
  };

  const sizeClasses = {
    sm: {
      badge: 'px-2 py-1 text-xs',
      icon: 'w-3 h-3',
    },
    md: {
      badge: 'px-3 py-1.5 text-sm',
      icon: 'w-4 h-4',
    },
    lg: {
      badge: 'px-4 py-2 text-base',
      icon: 'w-5 h-5',
    },
  };

  const config = getStatusConfig();
  const Icon = config.icon;
  const classes = sizeClasses[size];

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full font-medium ${config.bgColor} ${config.textColor} ${classes.badge}`}
    >
      <Icon className={`${config.iconColor} ${classes.icon}`} />
      <span>{config.text}</span>
    </div>
  );
}
