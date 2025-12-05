import { useState, useEffect, useRef } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

type CalendarManagerProps = {
  listingId: string;
  listingTitle: string;
  onClose: () => void;
};

type BlockedDate = {
  id: string;
  blocked_date: string;
};

export default function CalendarManager({ listingId, listingTitle, onClose }: CalendarManagerProps) {
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [importedDates, setImportedDates] = useState<Set<string>>(new Set());
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartDate, setDragStartDate] = useState<string | null>(null);
  const [dragAction, setDragAction] = useState<'block' | 'unblock' | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const initialBlockedDates = useRef<Set<string>>(new Set());

  useEffect(() => {
    loadBlockedDates();
  }, [listingId]);

  const loadBlockedDates = async () => {
    const { data, error } = await supabase
      .from('blocked_dates')
      .select('*')
      .eq('listing_id', listingId);

    if (!error && data) {
      setBlockedDates(data);
      const dates = new Set(data.map(d => d.blocked_date));
      setSelectedDates(dates);
      initialBlockedDates.current = new Set(dates);
    }

    const { data: importedData } = await supabase
      .from('imported_blocked_dates')
      .select('start_date, end_date')
      .eq('listing_id', listingId);

    if (importedData) {
      const imported = new Set<string>();
      importedData.forEach((range: { start_date: string; end_date: string }) => {
        const start = new Date(range.start_date);
        const end = new Date(range.end_date);
        const current = new Date(start);

        while (current <= end) {
          imported.add(current.toISOString().split('T')[0]);
          current.setDate(current.getDate() + 1);
        }
      });
      setImportedDates(imported);
    }
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    return { daysInMonth, startingDayOfWeek, year, month };
  };

  const formatDate = (year: number, month: number, day: number) => {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const toggleDate = (dateStr: string) => {
    const newSelected = new Set(selectedDates);
    if (newSelected.has(dateStr)) {
      newSelected.delete(dateStr);
    } else {
      newSelected.add(dateStr);
    }
    setSelectedDates(newSelected);
  };

  const handleMouseDown = (dateStr: string, isPast: boolean, isImported: boolean) => {
    if (isPast || isImported) return;
    setIsDragging(true);
    setDragStartDate(dateStr);

    const isCurrentlyBlocked = selectedDates.has(dateStr);
    const action = isCurrentlyBlocked ? 'unblock' : 'block';
    setDragAction(action);

    toggleDate(dateStr);
  };

  const handleMouseEnter = (dateStr: string, isPast: boolean, isImported: boolean) => {
    if (!isDragging || isPast || isImported || !dragAction) return;

    const isCurrentlyBlocked = selectedDates.has(dateStr);

    if (dragAction === 'block' && !isCurrentlyBlocked) {
      toggleDate(dateStr);
    } else if (dragAction === 'unblock' && isCurrentlyBlocked) {
      toggleDate(dateStr);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragStartDate(null);
    setDragAction(null);
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsDragging(false);
      setDragStartDate(null);
      setDragAction(null);
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  const getChangeSummary = () => {
    const currentBlockedSet = new Set(blockedDates.map(d => d.blocked_date));
    const datesToAdd = Array.from(selectedDates).filter(d => !currentBlockedSet.has(d));
    const datesToRemove = blockedDates.filter(d => !selectedDates.has(d.blocked_date));
    return { datesToAdd, datesToRemove };
  };

  const formatDateDisplay = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const confirmSave = () => {
    const { datesToAdd, datesToRemove } = getChangeSummary();
    if (datesToAdd.length === 0 && datesToRemove.length === 0) {
      onClose();
      return;
    }
    setShowConfirmation(true);
  };

  const saveDates = async () => {
    setLoading(true);
    try {
      const { datesToAdd, datesToRemove } = getChangeSummary();

      if (datesToAdd.length > 0) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        await supabase.from('blocked_dates').insert(
          datesToAdd.map(date => ({
            listing_id: listingId,
            blocked_date: date,
            created_by: user.id,
          }))
        );
      }

      if (datesToRemove.length > 0) {
        await supabase
          .from('blocked_dates')
          .delete()
          .in('id', datesToRemove.map(d => d.id));
      }

      alert('Calendrier mis à jour avec succès !');
      onClose();
    } catch (error) {
      console.error('Error saving dates:', error);
      alert('Erreur lors de la sauvegarde');
    } finally {
      setLoading(false);
    }
  };

  const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(currentMonth);
  const monthNames = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];
  const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Gérer le calendrier</h2>
            <p className="text-sm text-gray-600 mt-1">{listingTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={previousMonth}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition"
              >
                ← Précédent
              </button>
              <h3 className="text-xl font-bold text-gray-900">
                {monthNames[month]} {year}
              </h3>
              <button
                onClick={nextMonth}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition"
              >
                Suivant →
              </button>
            </div>

            <div className="grid grid-cols-7 gap-2">
              {dayNames.map(day => (
                <div key={day} className="text-center font-semibold text-gray-600 text-sm py-2">
                  {day}
                </div>
              ))}

              {Array.from({ length: startingDayOfWeek }).map((_, idx) => (
                <div key={`empty-${idx}`} className="aspect-square" />
              ))}

              {Array.from({ length: daysInMonth }).map((_, idx) => {
                const day = idx + 1;
                const dateStr = formatDate(year, month, day);
                const isBlocked = selectedDates.has(dateStr);
                const isImported = importedDates.has(dateStr);
                const isPast = new Date(dateStr) < new Date(new Date().setHours(0, 0, 0, 0));

                return (
                  <button
                    key={day}
                    onMouseDown={() => handleMouseDown(dateStr, isPast, isImported)}
                    onMouseEnter={() => handleMouseEnter(dateStr, isPast, isImported)}
                    onMouseUp={handleMouseUp}
                    disabled={isPast || isImported}
                    className={`aspect-square rounded-lg font-medium text-sm transition select-none ${
                      isPast
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : isImported
                        ? 'bg-orange-500 text-white cursor-not-allowed'
                        : isBlocked
                        ? 'bg-red-500 text-white hover:bg-red-600'
                        : 'bg-green-50 text-green-700 hover:bg-green-100 border-2 border-green-200'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-600">
                <span className="font-semibold">{selectedDates.size}</span> date(s) bloquée(s) manuellement
                {importedDates.size > 0 && (
                  <span className="ml-2">
                    + <span className="font-semibold">{importedDates.size}</span> date(s) importée(s)
                  </span>
                )}
              </p>
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-green-50 border-2 border-green-200 rounded"></div>
                  <span>Disponible</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-red-500 rounded"></div>
                  <span>Bloqué</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-orange-500 rounded"></div>
                  <span>Importé</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium"
              >
                Annuler
              </button>
              <button
                onClick={confirmSave}
                disabled={loading}
                className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium disabled:opacity-50"
              >
                {loading ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showConfirmation && (() => {
        const { datesToAdd, datesToRemove } = getChangeSummary();
        return (
          <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
              <div className="flex items-start gap-3 mb-4">
                <AlertCircle className="h-6 w-6 text-orange-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">Confirmer les modifications</h3>
                  <p className="text-sm text-gray-600">Vous êtes sur le point de modifier le calendrier :</p>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                {datesToAdd.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="font-semibold text-red-900 mb-2 text-sm">
                      {datesToAdd.length} date(s) à bloquer :
                    </p>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {datesToAdd.sort().map(date => (
                        <p key={date} className="text-xs text-red-800">• {formatDateDisplay(date)}</p>
                      ))}
                    </div>
                  </div>
                )}

                {datesToRemove.length > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="font-semibold text-green-900 mb-2 text-sm">
                      {datesToRemove.length} date(s) à débloquer :
                    </p>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {datesToRemove.map(d => (
                        <p key={d.id} className="text-xs text-green-800">• {formatDateDisplay(d.blocked_date)}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmation(false)}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium"
                >
                  Annuler
                </button>
                <button
                  onClick={() => {
                    setShowConfirmation(false);
                    saveDates();
                  }}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium disabled:opacity-50"
                >
                  Confirmer
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
