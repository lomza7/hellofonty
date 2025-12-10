import { useState } from 'react';
import { CheckCircle2, Circle, Clock, XCircle, AlertCircle, Upload, User as UserIcon, Phone, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

interface Task {
  id: string;
  title: string;
  description?: string;
  priority: 'urgent' | 'important' | 'normal';
  status: 'pending' | 'completed' | 'snoozed';
  task_type: 'system' | 'custom';
  due_date?: string;
  related_entity_type?: string;
  related_entity_id?: string;
}

interface TaskCardProps {
  task: Task;
  onTaskUpdate?: () => void;
}

interface VerificationTaskAction {
  label: string;
  route: string;
  icon: typeof Upload | typeof UserIcon | typeof Phone;
}

const verificationTaskActions: Record<string, VerificationTaskAction> = {
  'Ajouter une photo de profil': {
    label: 'Aller au profil',
    route: '/profil',
    icon: UserIcon
  },
  'Ajouter votre numéro de téléphone': {
    label: 'Aller au profil',
    route: '/profil',
    icon: Phone
  },
  'Télécharger votre justificatif d\'identité': {
    label: 'Télécharger le document',
    route: '/documents-proprietaire',
    icon: Upload
  },
  'Télécharger votre taxe foncière': {
    label: 'Télécharger le document',
    route: '/documents-proprietaire',
    icon: Upload
  },
  'Télécharger votre attestation INSEAD': {
    label: 'Télécharger le document',
    route: '/mes-documents',
    icon: Upload
  }
};

export default function TaskCard({ task, onTaskUpdate }: TaskCardProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const navigate = useNavigate();

  const priorityConfig = {
    urgent: {
      border: 'border-red-500',
      bg: 'bg-red-50',
      text: 'text-red-700',
      badge: 'bg-red-500',
      icon: AlertCircle
    },
    important: {
      border: 'border-orange-500',
      bg: 'bg-orange-50',
      text: 'text-orange-700',
      badge: 'bg-orange-500',
      icon: Clock
    },
    normal: {
      border: 'border-blue-500',
      bg: 'bg-blue-50',
      text: 'text-blue-700',
      badge: 'bg-blue-500',
      icon: Circle
    }
  };

  const config = priorityConfig[task.priority];
  const PriorityIcon = config.icon;

  const isVerificationTask = task.title in verificationTaskActions;
  const verificationAction = verificationTaskActions[task.title];
  const isCompleted = task.status === 'completed';

  const handleToggleComplete = async () => {
    if (isVerificationTask && !isCompleted) {
      return;
    }

    setIsUpdating(true);
    try {
      const newStatus = task.status === 'completed' ? 'pending' : 'completed';
      const { error } = await supabase
        .from('tasks')
        .update({
          status: newStatus,
          completed_at: newStatus === 'completed' ? new Date().toISOString() : null
        })
        .eq('id', task.id);

      if (error) throw error;

      if (newStatus === 'completed') {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 1000);
      }

      if (onTaskUpdate) onTaskUpdate();
    } catch (error) {
      console.error('Error updating task:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleActionClick = () => {
    if (verificationAction) {
      navigate(verificationAction.route);
    }
  };

  return (
    <div
      className={`relative border-l-4 ${config.border} ${isCompleted ? 'bg-green-50 border-green-500' : config.bg} rounded-r-xl p-4 transition-all duration-300 hover:shadow-md ${isUpdating ? 'opacity-50' : ''}`}
    >
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="animate-ping absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-4xl">
            🎉
          </div>
        </div>
      )}

      <div className="flex items-start gap-3">
        <button
          onClick={handleToggleComplete}
          disabled={isUpdating || (isVerificationTask && !isCompleted)}
          className={`flex-shrink-0 mt-0.5 focus:outline-none transition-transform ${
            isVerificationTask && !isCompleted
              ? 'cursor-not-allowed opacity-50'
              : 'hover:scale-110'
          }`}
        >
          {isCompleted ? (
            <CheckCircle2 className="h-6 w-6 text-green-600" />
          ) : (
            <Circle className={`h-6 w-6 ${
              isVerificationTask
                ? 'text-gray-300'
                : 'text-gray-400 hover:text-rose-500'
            }`} />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className={`font-semibold text-gray-900 ${isCompleted ? 'line-through text-gray-500' : ''}`}>
              {task.title}
            </h3>
            {!isCompleted && (
              <span className={`${config.badge} text-white text-xs px-2 py-1 rounded-full flex items-center gap-1 flex-shrink-0`}>
                <PriorityIcon className="h-3 w-3" />
                {task.priority === 'urgent' ? 'Urgent' : task.priority === 'important' ? 'Important' : 'Normal'}
              </span>
            )}
          </div>

          {task.description && (
            <p className={`text-sm text-gray-600 mb-2 ${isCompleted ? 'line-through' : ''}`}>
              {task.description}
            </p>
          )}

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-xs text-gray-500">
              {task.due_date && !isCompleted && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date(task.due_date).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'short'
                  })}
                </span>
              )}
              {task.task_type === 'system' && (
                <span className="bg-gray-200 px-2 py-0.5 rounded">Automatique</span>
              )}
            </div>

            {isVerificationTask && !isCompleted && verificationAction && (
              <button
                onClick={handleActionClick}
                className="flex items-center gap-2 px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-sm font-medium transition-colors shadow-sm hover:shadow-md"
              >
                {(() => {
                  const ActionIcon = verificationAction.icon;
                  return <ActionIcon className="h-4 w-4" />;
                })()}
                {verificationAction.label}
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
