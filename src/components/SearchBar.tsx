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
    <div className="bg-white/10 backdrop-blur-md rounded-full shadow-2xl">
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-0 md:gap-0">
        {/* Type de logement */}
        <div className="relative group flex-1 border-b md:border-b-0 md:border-r border-white/20">
          <div className="px-4 py-3">
            <label className="block text-[10px] font-semibold text-white/90 mb-1">
              {t('search.propertyTypeLabel')}
            </label>
            <div className="relative">
              <select
                value={propertyType}
                onChange={(e) => setPropertyType(e.target.value)}
                className="w-full text-sm text-white bg-transparent outline-none cursor-pointer appearance-none font-medium"
                style={{
                  backgroundImage: 'none',
                  color: 'white'
                }}
              >
                <option value="all" className="text-gray-900">🏘️ {t('search.propertyType.option.all')}</option>
                <option value="room" className="text-gray-900">🛏️ {t('search.propertyType.option.room')}</option>
                <option value="apartment" className="text-gray-900">🏢 {t('search.propertyType.option.apartment')}</option>
                <option value="house" className="text-gray-900">🏠 {t('search.propertyType.option.house')}</option>
              </select>
            </div>
          </div>
        </div>

        {/* Dates container */}
        <div className="flex flex-col md:flex-row flex-1 border-b md:border-b-0 md:border-r border-white/20">
          {/* Date d'arrivée */}
          <div className="relative group flex-1 border-b md:border-b-0 md:border-r border-white/20">
            <div className="px-4 py-3">
              <label className="block text-[10px] font-semibold text-white/90 mb-1">
                {t('search.checkIn')}
              </label>
              <input
                type="date"
                min={today}
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                className="w-full text-sm text-white bg-transparent outline-none cursor-pointer font-medium"
                style={{
                  colorScheme: 'dark'
                }}
                placeholder={t('search.checkInPlaceholder')}
              />
            </div>
          </div>

          {/* Date de départ */}
          <div className="relative group flex-1">
            <div className="px-4 py-3">
              <label className="block text-[10px] font-semibold text-white/90 mb-1">
                {t('search.checkOut')}
              </label>
              <input
                type="date"
                min={checkIn || today}
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
                className="w-full text-sm text-white bg-transparent outline-none cursor-pointer font-medium"
                style={{
                  colorScheme: 'dark'
                }}
                placeholder={t('search.checkOutPlaceholder')}
              />
            </div>
          </div>
        </div>

        {/* Invités et bouton de recherche */}
        <div className="flex items-center">
          {/* Nombre de personnes */}
          <div className="relative flex-1 border-b md:border-b-0 md:border-r border-white/20">
            <div className="px-4 py-3">
              <label className="block text-[10px] font-semibold text-white/90 mb-1">
                {t('search.guestsLabel')}
              </label>
              <button
                onClick={() => setShowGuestPicker(!showGuestPicker)}
                className="w-full text-left text-sm text-white font-medium outline-none"
              >
                {guests} {guests === 1 ? t('search.guestSingular') : t('search.guestPlural')}
              </button>

              {showGuestPicker && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowGuestPicker(false)}
                  />
                  <div className="absolute top-full mt-2 left-0 md:right-0 md:left-auto bg-white rounded-xl shadow-2xl p-4 z-20 w-full md:w-64">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700 font-medium">{t('search.guestsLabel')}</span>
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => setGuests(Math.max(1, guests - 1))}
                          className="w-8 h-8 rounded-full border-2 border-gray-300 flex items-center justify-center hover:border-gray-900 transition disabled:opacity-30 disabled:cursor-not-allowed text-lg"
                          disabled={guests <= 1}
                        >
                          −
                        </button>
                        <span className="w-8 text-center font-semibold text-sm">{guests}</span>
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

          {/* Bouton de recherche */}
          <div className="px-2 py-2">
            <button
              onClick={handleSearch}
              className="bg-gradient-to-r from-rose-500 to-pink-500 text-white p-3 md:p-4 rounded-full hover:from-rose-600 hover:to-pink-600 transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
              aria-label={t('search.searchButton')}
            >
              <Search className="h-5 w-5 md:h-6 md:w-6" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}