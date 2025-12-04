import { useEffect, useState } from 'react';
import { Home, Users, UserCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';

export default function PlatformStats() {
  const { t } = useLanguage();
  const [stats, setStats] = useState({
    listings: 0,
    students: 0,
    landlords: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();

    // S'abonner aux changements en temps réel
    const listingsChannel = supabase
      .channel('listings-stats')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'listings' },
        () => {
          fetchStats();
        }
      )
      .subscribe();

    const profilesChannel = supabase
      .channel('profiles-stats')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => {
          fetchStats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(listingsChannel);
      supabase.removeChannel(profilesChannel);
    };
  }, []);

  const fetchStats = async () => {
    try {
      // Compter les logements actifs
      const { count: listingsCount } = await supabase
        .from('listings')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      // Compter les étudiants
      const { count: studentsCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'student');

      // Compter les propriétaires
      const { count: landlordsCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'landlord');

      setStats({
        listings: listingsCount || 0,
        students: studentsCount || 0,
        landlords: landlordsCount || 0,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-3 sm:gap-6 md:gap-8">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse">
            <div className="bg-white rounded-xl shadow-sm p-3 sm:p-6 border border-gray-100">
              <div className="h-8 sm:h-10 bg-gray-200 rounded mb-2 sm:mb-4"></div>
              <div className="h-4 sm:h-6 bg-gray-200 rounded w-1/2"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-3 sm:gap-6 md:gap-8">
      <div className="bg-white rounded-lg sm:rounded-xl shadow-sm hover:shadow-md transition-shadow duration-300 p-3 sm:p-6 border border-gray-100">
        <div className="flex items-start justify-between mb-2 sm:mb-3">
          <div className="p-2 sm:p-3 bg-gray-50 rounded-lg">
            <Home className="h-4 w-4 sm:h-6 sm:w-6 text-gray-700" />
          </div>
        </div>
        <div className="text-xl sm:text-3xl font-semibold text-gray-900 mb-0.5 sm:mb-1">
          {stats.listings}
        </div>
        <div className="text-gray-600 text-xs sm:text-sm font-medium">
          {t('stats.listingsOnline')}
        </div>
      </div>

      <div className="bg-white rounded-lg sm:rounded-xl shadow-sm hover:shadow-md transition-shadow duration-300 p-3 sm:p-6 border border-gray-100">
        <div className="flex items-start justify-between mb-2 sm:mb-3">
          <div className="p-2 sm:p-3 bg-gray-50 rounded-lg">
            <Users className="h-4 w-4 sm:h-6 sm:w-6 text-gray-700" />
          </div>
        </div>
        <div className="text-xl sm:text-3xl font-semibold text-gray-900 mb-0.5 sm:mb-1">
          {stats.students}
        </div>
        <div className="text-gray-600 text-xs sm:text-sm font-medium">
          {t('stats.studentsRegistered')}
        </div>
      </div>

      <div className="bg-white rounded-lg sm:rounded-xl shadow-sm hover:shadow-md transition-shadow duration-300 p-3 sm:p-6 border border-gray-100">
        <div className="flex items-start justify-between mb-2 sm:mb-3">
          <div className="p-2 sm:p-3 bg-gray-50 rounded-lg">
            <UserCheck className="h-4 w-4 sm:h-6 sm:w-6 text-gray-700" />
          </div>
        </div>
        <div className="text-xl sm:text-3xl font-semibold text-gray-900 mb-0.5 sm:mb-1">
          {stats.landlords}
        </div>
        <div className="text-gray-600 text-xs sm:text-sm font-medium">
          {t('stats.landlordsActive')}
        </div>
      </div>
    </div>
  );
}
