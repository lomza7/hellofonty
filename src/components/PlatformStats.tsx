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
      <div className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-900 to-rose-950 rounded-2xl p-6 sm:p-8 lg:p-10">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-rose-500/10 rounded-full blur-3xl"></div>
          <div className="absolute top-10 -right-20 w-64 h-64 bg-pink-500/10 rounded-full blur-3xl"></div>
        </div>
        <div className="relative z-10 grid grid-cols-3 gap-3 sm:gap-6 md:gap-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 sm:p-6 border border-white/10">
                <div className="h-8 sm:h-10 bg-white/20 rounded mb-2 sm:mb-4"></div>
                <div className="h-4 sm:h-6 bg-white/20 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-900 to-rose-950 rounded-2xl p-6 sm:p-8 lg:p-10 shadow-2xl">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-rose-500/10 rounded-full blur-3xl"></div>
        <div className="absolute top-10 -right-20 w-64 h-64 bg-pink-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/3 left-1/3 w-48 h-48 bg-rose-400/5 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 grid grid-cols-3 gap-3 sm:gap-6 md:gap-8">
        <div className="group bg-white/5 backdrop-blur-sm rounded-xl sm:rounded-2xl hover:bg-white/10 transition-all duration-300 p-3 sm:p-6 border border-white/10 hover:border-rose-400/30 hover:shadow-lg hover:shadow-rose-500/20">
          <div className="flex items-start justify-between mb-2 sm:mb-4">
            <div className="p-2 sm:p-3 bg-gradient-to-br from-rose-500/20 to-pink-500/20 rounded-lg group-hover:from-rose-500/30 group-hover:to-pink-500/30 transition-all duration-300">
              <Home className="h-4 w-4 sm:h-6 sm:w-6 text-rose-400" />
            </div>
          </div>
          <div className="text-xl sm:text-3xl lg:text-4xl font-bold text-white mb-1 sm:mb-2 bg-gradient-to-r from-rose-300 to-pink-300 bg-clip-text text-transparent">
            {stats.listings}
          </div>
          <div className="text-gray-300 text-xs sm:text-sm font-medium">
            {t('stats.listingsOnline')}
          </div>
        </div>

        <div className="group bg-white/5 backdrop-blur-sm rounded-xl sm:rounded-2xl hover:bg-white/10 transition-all duration-300 p-3 sm:p-6 border border-white/10 hover:border-rose-400/30 hover:shadow-lg hover:shadow-rose-500/20">
          <div className="flex items-start justify-between mb-2 sm:mb-4">
            <div className="p-2 sm:p-3 bg-gradient-to-br from-rose-500/20 to-pink-500/20 rounded-lg group-hover:from-rose-500/30 group-hover:to-pink-500/30 transition-all duration-300">
              <Users className="h-4 w-4 sm:h-6 sm:w-6 text-rose-400" />
            </div>
          </div>
          <div className="text-xl sm:text-3xl lg:text-4xl font-bold text-white mb-1 sm:mb-2 bg-gradient-to-r from-rose-300 to-pink-300 bg-clip-text text-transparent">
            {stats.students}
          </div>
          <div className="text-gray-300 text-xs sm:text-sm font-medium">
            {t('stats.studentsRegistered')}
          </div>
        </div>

        <div className="group bg-white/5 backdrop-blur-sm rounded-xl sm:rounded-2xl hover:bg-white/10 transition-all duration-300 p-3 sm:p-6 border border-white/10 hover:border-rose-400/30 hover:shadow-lg hover:shadow-rose-500/20">
          <div className="flex items-start justify-between mb-2 sm:mb-4">
            <div className="p-2 sm:p-3 bg-gradient-to-br from-rose-500/20 to-pink-500/20 rounded-lg group-hover:from-rose-500/30 group-hover:to-pink-500/30 transition-all duration-300">
              <UserCheck className="h-4 w-4 sm:h-6 sm:w-6 text-rose-400" />
            </div>
          </div>
          <div className="text-xl sm:text-3xl lg:text-4xl font-bold text-white mb-1 sm:mb-2 bg-gradient-to-r from-rose-300 to-pink-300 bg-clip-text text-transparent">
            {stats.landlords}
          </div>
          <div className="text-gray-300 text-xs sm:text-sm font-medium">
            {t('stats.landlordsActive')}
          </div>
        </div>
      </div>
    </div>
  );
}
