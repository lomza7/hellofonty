import { useState } from 'react';
import { Search, Calendar, Home, Users } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

type SearchBarProps = {
  onSearch: (filters: SearchFilters) => void;
  compact?: boolean;
};

export type SearchFilters = {
  propertyType: string;
  checkIn: string;
  checkOut: string;
  guests: number;
};

export default function SearchBar({ onSearch, compact = false }: SearchBarProps) {
  const { t } = useLanguage();
  const [propertyType, setPropertyType] = useState<string>('all');
  const [checkIn, setCheckIn] = useState<string>('');
  const [checkOut, setCheckOut] = useState<string>('');
  const [guests, setGuests] = useState<number>(1);
  const [showGuestPicker, setShowGuestPicker] = useState(false);

  const handleSearch = () => {
    onSearch({
      propertyType,
      checkIn,
      checkOut,
      guests,
    });
  };

  const today = new Date().toISOString().split('T')[0];

  if (compact) {
    return (
      <div className="bg-white rounded-full shadow-xl p-2 flex items-center space-x-2">
        <div className="flex-1 px-4">
          <input
            type="text"
            placeholder={t('search.searchPlaceholder')}
            className="w-full outline-none text-gray-700"
          />
        </div>
        <button
          onClick={handleSearch}
          className="bg-rose-500 text-white rounded-full p-3 hover:bg-rose-600 transition"
        >
          <Search className="h-5 w-5" />
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white/10 backdrop-blur-md rounded-xl shadow-2xl p-2 sm:p-1.5 max-w-full overflow-hidden">
      <div className="flex flex-col md:grid md:grid-cols-4 gap-2 sm:gap-1.5 max-w-full">
        {/* Type de logement - Pleine largeur sur mobile */}
        <div className="relative group max-w-full overflow-hidden md:col-span-1">
          <label className="block text-xs sm:text-[11px] font-semibold text-white mb-1 px-2 pt-1">
            {t('search.propertyTypeLabel')}
          </label>
          <div className="relative max-w-full">
            <Home className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-3.5 sm:w-3.5 text-gray-400 pointer-events-none" />
            <select
              value={propertyType}
              onChange={(e) => setPropertyType(e.target.value)}
              className="w-full max-w-full pl-10 sm:pl-8 pr-3 sm:pr-2 py-2.5 sm:py-1.5 text-sm sm:text-xs text-gray-700 bg-white outline-none cursor-pointer hover:bg-gray-50 rounded-lg transition"
            >
              <option value="all">🏘️ {t('search.propertyType.option.all')}</option>
              <option value="room">🛏️ {t('search.propertyType.option.room')}</option>
              <option value="apartment">🏢 {t('search.propertyType.option.apartment')}</option>
              <option value="house">🏠 {t('search.propertyType.option.house')}</option>
            </select>
          </div>
        </div>

        {/* Dates côte à côte sur mobile */}
        <div className="grid grid-cols-2 gap-2 sm:gap-1.5 md:col-span-2 md:contents">
          {/* Date d'arrivée */}
          <div className="relative group max-w-full overflow-hidden">
            <label className="block text-[10px] sm:text-[11px] font-semibold text-white mb-1 px-1 sm:px-2 pt-1 truncate">
              {t('search.checkIn')}
            </label>
            <div className="relative max-w-full">
              <Calendar className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 sm:h-3.5 sm:w-3.5 text-gray-400 pointer-events-none z-10" />
              <input
                type="date"
                min={today}
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                className="w-full max-w-full pl-8 sm:pl-8 pr-1 sm:pr-2 py-2.5 sm:py-1.5 text-xs sm:text-xs text-gray-700 bg-white outline-none cursor-pointer hover:bg-gray-50 rounded-lg transition"
                placeholder={t('search.checkInPlaceholder')}
              />
            </div>
          </div>

          {/* Date de départ */}
          <div className="relative group max-w-full overflow-hidden">
            <label className="block text-[10px] sm:text-[11px] font-semibold text-white mb-1 px-1 sm:px-2 pt-1 truncate">
              {t('search.checkOut')}
            </label>
            <div className="relative max-w-full">
              <Calendar className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 sm:h-3.5 sm:w-3.5 text-gray-400 pointer-events-none z-10" />
              <input
                type="date"
                min={checkIn || today}
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
                className="w-full max-w-full pl-8 sm:pl-8 pr-1 sm:pr-2 py-2.5 sm:py-1.5 text-xs sm:text-xs text-gray-700 bg-white outline-none cursor-pointer hover:bg-gray-50 rounded-lg transition"
                placeholder={t('search.checkOutPlaceholder')}
              />
            </div>
          </div>
        </div>

        {/* Nombre de personnes - Pleine largeur sur mobile */}
        <div className="relative max-w-full overflow-hidden md:col-span-1">
          <label className="block text-xs sm:text-[11px] font-semibold text-white mb-1 px-2 pt-1">
            {t('search.guestsLabel')}
          </label>
          <div className="relative max-w-full">
            <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-3.5 sm:w-3.5 text-gray-400 pointer-events-none" />
            <button
              onClick={() => setShowGuestPicker(!showGuestPicker)}
              className="w-full max-w-full pl-10 sm:pl-8 pr-3 sm:pr-2 py-2.5 sm:py-1.5 text-left text-sm sm:text-xs text-gray-700 bg-white hover:bg-gray-50 rounded-lg transition outline-none"
            >
              {guests} {guests === 1 ? t('search.guestSingular') : t('search.guestPlural')}
            </button>

            {showGuestPicker && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowGuestPicker(false)}
                />
                <div className="absolute top-full mt-2 left-0 sm:right-0 sm:left-auto bg-white rounded-xl shadow-2xl p-4 z-20 w-full sm:w-64 max-w-[calc(100vw-2rem)]">
                  <div className="flex items-center justify-between">
                    <span className="text-sm sm:text-base text-gray-700 font-medium">{t('search.guestsLabel')}</span>
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => setGuests(Math.max(1, guests - 1))}
                        className="w-8 h-8 rounded-full border-2 border-gray-300 flex items-center justify-center hover:border-gray-900 transition disabled:opacity-30 disabled:cursor-not-allowed text-lg"
                        disabled={guests <= 1}
                      >
                        −
                      </button>
                      <span className="w-8 text-center font-semibold text-sm sm:text-base">{guests}</span>
                      <button
                        onClick={() => setGuests(Math.min(10, guests + 1))}
                        className="w-8 h-8 rounded-full border-2 border-gray-300 flex items-center justify-center hover:border-gray-900 transition disabled:opacity-30 disabled:cursor-not-allowed text-lg"
                        disabled={guests >= 10}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Bouton de recherche */}
      <div className="mt-2 sm:mt-1.5">
        <button
          onClick={handleSearch}
          className="w-full bg-gradient-to-r from-rose-500 to-pink-500 text-white py-3 sm:py-2 rounded-lg text-base sm:text-sm font-semibold hover:from-rose-600 hover:to-pink-600 transition-all shadow-lg flex items-center justify-center space-x-2"
        >
          <Search className="h-5 w-5 sm:h-4 sm:w-4" />
          <span>{t('search.searchButton')}</span>
        </button>
      </div>
    </div>
  );
}