import { useState, useEffect } from 'react';
import { CheckCircle, Filter } from 'lucide-react';
import TaskCard from './TaskCard';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../contexts/LanguageContext';

interface Task {
  id: string;
  title: string;
  description?: string;
  priority: 'urgent' | 'important' | 'normal';
  status: 'pending' | 'completed' | 'snoozed';
  task_type: 'system' | 'custom';
  due_date?: string;
  completed_at?: string;
  related_entity_type?: string;
  related_entity_id?: string;
}

interface TaskListProps {
  userId: string;
  maxDisplay?: number;
  showCompleted?: boolean;
}

export default function TaskList({ userId, maxDisplay, showCompleted = false }: TaskListProps) {
  const { t } = useLanguage();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'urgent' | 'important' | 'normal'>('all');

  const fetchTasks = async () => {
    try {
      let query = supabase
        .from('tasks')
        .select('*')
        .eq('user_id', userId)
        .order('priority', { ascending: true })
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (!showCompleted) {
        query = query.neq('status', 'completed');
      }

      if (filter !== 'all') {
        query = query.eq('priority', filter);
      }

      const { data, error } = await query;

      if (error) throw error;

      const sortedTasks = (data || []).sort((a, b) => {
        const priorityOrder = { urgent: 0, important: 1, normal: 2 };
        return priorityOrder[a.priority as keyof typeof priorityOrder] - priorityOrder[b.priority as keyof typeof priorityOrder];
      });

      setTasks(maxDisplay ? sortedTasks.slice(0, maxDisplay) : sortedTasks);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();

    const channel = supabase
      .channel('tasks_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `user_id=eq.${userId}`
        },
        () => {
          fetchTasks();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, filter, showCompleted, maxDisplay]);

  const pendingTasks = tasks.filter(t => t.status === 'pending');
  const completedToday = tasks.filter(
    t => t.status === 'completed' &&
    t.completed_at &&
    new Date(t.completed_at).toDateString() === new Date().toDateString()
  ).length;

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-20 bg-gray-200 rounded-xl"></div>
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-bold text-gray-900">
            {t('tasks.title')}
            {pendingTasks.length > 0 && (
              <span className="ml-2 bg-rose-500 text-white text-xs px-2 py-1 rounded-full">
                {pendingTasks.length}
              </span>
            )}
          </h3>
          {completedToday > 0 && (
            <span className="flex items-center gap-1 text-sm text-green-600 font-medium">
              <CheckCircle className="h-4 w-4" />
              {completedToday} {completedToday > 1 ? t('tasks.completedPlural') : t('tasks.completed')} {t('tasks.today')}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter(filter === 'all' ? 'urgent' : 'all')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title={t('tasks.filter')}
          >
            <Filter className="h-5 w-5 text-gray-600" />
          </button>
        </div>
      </div>

      {filter !== 'all' && (
        <div className="mb-3">
          <button
            onClick={() => setFilter('all')}
            className="text-sm text-rose-600 hover:text-rose-700 font-medium"
          >
            ← {t('tasks.allTasks')}
          </button>
        </div>
      )}

      {tasks.length === 0 ? (
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-8 text-center border-2 border-green-200">
          <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            {t('tasks.congratulations')} 🎉
          </h3>
          <p className="text-gray-600">
            {t('tasks.noTasks')}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              onTaskUpdate={fetchTasks}
            />
          ))}
        </div>
      )}
    </div>
  );
}
