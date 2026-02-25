import { useState, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Check, X, Zap, Flame, Droplets } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

type ChargeDetail = {
  electricityCost?: number | null;
  heatingCost?: number | null;
  waterCost?: number | null;
  customCharges?: Array<{ name: string; amount: string }> | null;
};

type BookingCalendarProps = {
  pricePerMonth: number;
  charges: number;
  minimumStayMonths?: number;
  existingBookings?: Array<{ start_date: string; end_date: string }>;
  blockedDates?: string[];
  chargeDetails?: ChargeDetail;
  onBookingSelect: (startDate: Date, endDate: Date, totalPrice: number) => void;
};

export default function BookingCalendar({
  pricePerMonth,
  charges = 0,
  minimumStayMonths = 1,
  existingBookings = [],
  blockedDates = [],
  chargeDetails,
  onBookingSelect
}: BookingCalendarProps) {
  const { t, language } = useLanguage();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedStartDate, setSelectedStartDate] = useState<Date | null>(null);
  const [selectedEndDate, setSelectedEndDate] = useState<Date | null>(null);
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);
  const [minimumStayError, setMinimumStayError] = useState<string | null>(null);
  const [showChargesModal, setShowChargesModal] = useState(false);

  const computedCharges = (() => {
    if (charges > 0) return charges;
    if (!chargeDetails) return 0;
    return (chargeDetails.electricityCost || 0) +
      (chargeDetails.heatingCost || 0) +
      (chargeDetails.waterCost || 0) +
      (chargeDetails.customCharges?.reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0) || 0);
  })();
  const monthlyTotal = pricePerMonth + computedCharges;
  const dailyRate = monthlyTotal / 30;
  const minimumStayDays = minimumStayMonths * 30;

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, month, 1).getDay();

    return { daysInMonth, firstDayOfMonth };
  };

  const isDateBooked = (date: Date) => {
    return existingBookings.some(booking => {
      const start = new Date(booking.start_date);
      const end = new Date(booking.end_date);
      return date >= start && date <= end;
    });
  };

  const isDateBlocked = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return blockedDates.includes(dateStr);
  };

  const isDateInPast = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  const handleDateClick = (day: number) => {
    const clickedDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);

    if (isDateBooked(clickedDate) || isDateBlocked(clickedDate) || isDateInPast(clickedDate)) return;

    // Si on clique sur la date de début déjà sélectionnée, on réinitialise tout
    if (selectedStartDate && clickedDate.getTime() === selectedStartDate.getTime()) {
      setSelectedStartDate(null);
      setSelectedEndDate(null);
      setMinimumStayError(null);
      return;
    }

    // Si on clique sur la date de fin déjà sélectionnée, on la supprime
    if (selectedEndDate && clickedDate.getTime() === selectedEndDate.getTime()) {
      setSelectedEndDate(null);
      setMinimumStayError(null);
      return;
    }

    if (!selectedStartDate) {
      setSelectedStartDate(clickedDate);
      setSelectedEndDate(null);
      setMinimumStayError(null);
    } else if (!selectedEndDate) {
      if (clickedDate > selectedStartDate) {
        const daysDiff = Math.ceil((clickedDate.getTime() - selectedStartDate.getTime()) / (1000 * 60 * 60 * 24));

        if (daysDiff >= minimumStayDays) {
          setSelectedEndDate(clickedDate);
          setMinimumStayError(null);
        } else {
          const nightsNeeded = minimumStayDays - daysDiff;
          setMinimumStayError(`Séjour minimum de ${minimumStayDays} nuits. Sélectionnez ${nightsNeeded} ${nightsNeeded > 1 ? 'nuits' : 'nuit'} supplémentaire${nightsNeeded > 1 ? 's' : ''}.`);
        }
      } else {
        setSelectedStartDate(clickedDate);
        setSelectedEndDate(null);
        setMinimumStayError(null);
      }
    } else {
      setSelectedStartDate(clickedDate);
      setSelectedEndDate(null);
      setMinimumStayError(null);
    }
  };

  const calculatePrice = (start: Date, end: Date) => {
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const months = Math.floor(days / 30);
    const extraDays = days % 30;

    const monthsPrice = months * monthlyTotal;
    const extraDaysPrice = extraDays * dailyRate;

    return {
      totalDays: days,
      months,
      extraDays,
      monthsPrice,
      extraDaysPrice,
      totalPrice: monthsPrice + extraDaysPrice
    };
  };

  const isDateInRange = (day: number) => {
    if (!selectedStartDate) return false;

    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    const endDate = selectedEndDate || hoveredDate;

    if (!endDate) return false;

    return date > selectedStartDate && date < endDate;
  };

  const isDateSelected = (day: number) => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    return (selectedStartDate && date.getTime() === selectedStartDate.getTime()) ||
           (selectedEndDate && date.getTime() === selectedEndDate.getTime());
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const { daysInMonth, firstDayOfMonth } = getDaysInMonth(currentMonth);
  const monthName = currentMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  const priceDetails = selectedStartDate && selectedEndDate
    ? calculatePrice(selectedStartDate, selectedEndDate)
    : null;

  useEffect(() => {
    if (selectedStartDate && selectedEndDate && priceDetails) {
      onBookingSelect(selectedStartDate, selectedEndDate, priceDetails.totalPrice);
    }
  }, [selectedStartDate, selectedEndDate]);

  return (
    <div className="bg-white border border-gray-300 rounded-xl overflow-hidden">
      {priceDetails && (
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  {priceDetails.totalPrice.toFixed(0)}€
                </div>
                <div className="text-sm text-gray-500">
                  {priceDetails.totalDays} {priceDetails.totalDays > 1 ? t('booking.nights') : t('booking.night')}
                </div>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 underline">
                  {pricePerMonth.toFixed(0)}€ × {priceDetails.months} mois
                </span>
                <span className="text-gray-900">{priceDetails.monthsPrice.toFixed(0)}€</span>
              </div>

              {priceDetails.extraDays > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600 underline">
                    {dailyRate.toFixed(0)}€ × {priceDetails.extraDays} jours
                  </span>
                  <span className="text-gray-900">{priceDetails.extraDaysPrice.toFixed(0)}€</span>
                </div>
              )}

              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={() => setShowChargesModal(true)}
                  className="text-gray-600 underline cursor-pointer hover:text-gray-900 transition-colors text-left"
                >
                  {language === 'fr' ? 'Charges mensuelles' : 'Monthly charges'}
                </button>
                <span className="text-gray-900">{(computedCharges * priceDetails.months).toFixed(0)}€</span>
              </div>

              <div className="flex justify-between pt-3 border-t border-gray-200 font-semibold">
                <span className="text-gray-900">Total</span>
                <span className="text-gray-900">{priceDetails.totalPrice.toFixed(0)}€</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={prevMonth}
            className="p-2 hover:bg-gray-100 rounded-full transition"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-semibold text-sm text-gray-900 capitalize">
            {monthName}
          </span>
          <button
            onClick={nextMonth}
            className="p-2 hover:bg-gray-100 rounded-full transition"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-2">
          {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, idx) => (
            <div key={idx} className="text-center text-xs font-medium text-gray-500 h-8 flex items-center justify-center">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1 }).map((_, idx) => (
            <div key={`empty-${idx}`} className="h-10" />
          ))}

          {Array.from({ length: daysInMonth }).map((_, idx) => {
            const day = idx + 1;
            const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
            const isBooked = isDateBooked(date);
            const isBlocked = isDateBlocked(date);
            const isPast = isDateInPast(date);
            const isSelected = isDateSelected(day);
            const inRange = isDateInRange(day);
            const isDisabled = isBooked || isBlocked || isPast;

            return (
              <button
                key={day}
                onClick={() => handleDateClick(day)}
                onMouseEnter={() => setHoveredDate(date)}
                onMouseLeave={() => setHoveredDate(null)}
                disabled={isDisabled}
                className={`
                  h-10 rounded-full text-sm font-normal transition flex items-center justify-center relative
                  ${isBlocked ? 'bg-red-500 text-white cursor-not-allowed' : ''}
                  ${isBooked || isPast ? 'text-gray-300 cursor-not-allowed line-through' : ''}
                  ${isSelected ? 'bg-gray-900 text-white font-semibold' : ''}
                  ${inRange ? 'bg-gray-100' : ''}
                  ${!isDisabled && !isSelected && !inRange ? 'hover:border hover:border-gray-900 text-gray-700' : ''}
                `}
              >
                {day}
              </button>
            );
          })}
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="text-xs text-gray-600">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full border border-gray-900 mr-1" />
                <span>Disponible</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-gray-900 mr-1" />
                <span>Sélectionné</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-red-500 mr-1" />
                <span>Bloqué</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-gray-100 mr-1" />
                <span>Indisponible</span>
              </div>
            </div>
            {minimumStayError ? (
              <div className="mt-3 p-2 bg-rose-50 border border-rose-200 rounded-lg">
                <p className="text-rose-700 text-xs font-medium">
                  {minimumStayError}
                </p>
              </div>
            ) : (
              <p className="mt-3 text-gray-500">
                <strong>Séjour minimum :</strong> {minimumStayMonths} mois ({minimumStayDays} {minimumStayDays > 1 ? 'jours' : 'jour'})
              </p>
            )}
          </div>
        </div>
      </div>
      {showChargesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowChargesModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900">
                {language === 'fr' ? 'Detail des charges mensuelles' : 'Monthly charges breakdown'}
              </h3>
              <button
                onClick={() => setShowChargesModal(false)}
                className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-3">
              {chargeDetails?.electricityCost != null && chargeDetails.electricityCost > 0 && (
                <div className="flex items-center justify-between py-2.5 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                      <Zap className="w-4 h-4 text-amber-600" />
                    </div>
                    <span className="text-sm text-gray-700">
                      {language === 'fr' ? 'Electricite' : 'Electricity'}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">
                    {chargeDetails.electricityCost.toFixed(0)}€{priceDetails ? ` / ${language === 'fr' ? 'mois' : 'mo'}` : ''}
                  </span>
                </div>
              )}

              {chargeDetails?.heatingCost != null && chargeDetails.heatingCost > 0 && (
                <div className="flex items-center justify-between py-2.5 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
                      <Flame className="w-4 h-4 text-orange-600" />
                    </div>
                    <span className="text-sm text-gray-700">
                      {language === 'fr' ? 'Chauffage' : 'Heating'}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">
                    {chargeDetails.heatingCost.toFixed(0)}€{priceDetails ? ` / ${language === 'fr' ? 'mois' : 'mo'}` : ''}
                  </span>
                </div>
              )}

              {chargeDetails?.waterCost != null && chargeDetails.waterCost > 0 && (
                <div className="flex items-center justify-between py-2.5 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                      <Droplets className="w-4 h-4 text-blue-600" />
                    </div>
                    <span className="text-sm text-gray-700">
                      {language === 'fr' ? 'Eau' : 'Water'}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">
                    {chargeDetails.waterCost.toFixed(0)}€{priceDetails ? ` / ${language === 'fr' ? 'mois' : 'mo'}` : ''}
                  </span>
                </div>
              )}

              {chargeDetails?.customCharges?.map((charge, index) => {
                const amount = parseFloat(charge.amount);
                if (!amount || amount <= 0) return null;
                return (
                  <div key={index} className="flex items-center justify-between py-2.5 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                        <span className="text-xs font-bold text-gray-500">{index + 1}</span>
                      </div>
                      <span className="text-sm text-gray-700">{charge.name}</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">
                      {amount.toFixed(0)}€{priceDetails ? ` / ${language === 'fr' ? 'mois' : 'mo'}` : ''}
                    </span>
                  </div>
                );
              })}

              {(!chargeDetails || (
                !chargeDetails.electricityCost &&
                !chargeDetails.heatingCost &&
                !chargeDetails.waterCost &&
                (!chargeDetails.customCharges || chargeDetails.customCharges.length === 0)
              )) && (
                <p className="text-sm text-gray-500 text-center py-4">
                  {language === 'fr'
                    ? 'Le detail des charges n\'a pas ete renseigne par le proprietaire.'
                    : 'The landlord has not provided a breakdown of charges.'}
                </p>
              )}
            </div>

            {(() => {
              const totalFromDetails =
                (chargeDetails?.electricityCost || 0) +
                (chargeDetails?.heatingCost || 0) +
                (chargeDetails?.waterCost || 0) +
                (chargeDetails?.customCharges?.reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0) || 0);
              const displayTotal = totalFromDetails > 0 ? totalFromDetails : computedCharges;
              return (
                <>
                  <div className="mt-5 pt-4 border-t border-gray-200 flex items-center justify-between">
                    <span className="text-sm font-bold text-gray-900">
                      {language === 'fr' ? 'Total charges' : 'Total charges'}
                    </span>
                    <span className="text-lg font-bold text-gray-900">{displayTotal.toFixed(0)}€ / {language === 'fr' ? 'mois' : 'mo'}</span>
                  </div>
                  {priceDetails && priceDetails.months > 1 && (
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs text-gray-500">
                        {language === 'fr'
                          ? `Prorata sur ${priceDetails.months} mois`
                          : `Prorated over ${priceDetails.months} months`}
                      </span>
                      <span className="text-sm font-semibold text-gray-700">
                        {(displayTotal * priceDetails.months).toFixed(0)}€
                      </span>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
