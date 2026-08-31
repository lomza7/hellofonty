import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  Calendar, Search,
  Bell, BellOff, Send, ChevronDown, ChevronRight, Home,
  CreditCard, AlertCircle, CheckCircle2, RotateCw, ShieldOff, ShieldCheck, XCircle
} from 'lucide-react';

interface RentPayment {
  id: string;
  booking_id: string;
  student_id: string;
  landlord_id: string;
  rent_amount: number;
  platform_fee: number;
  total_amount: number;
  payment_date: string;
  month_year: string;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  last_reminder_sent_at: string | null;
  auto_reminder_enabled: boolean;
}

interface BookingRow {
  id: string;
  listing_id: string;
  student_id: string;
  start_date: string;
  end_date: string;
  total_price: number;
  status: string;
  payment_status: string;
  created_at: string;
  auto_reminder_enabled: boolean;
  student: { first_name: string; last_name: string } | null;
  listing: {
    title: string;
    city: string;
    address: string;
    landlord: { first_name: string; last_name: string } | null;
  } | null;
  rent_payments: RentPayment[];
}

const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: 'En attente', color: 'bg-yellow-100 text-yellow-700' },
  paid: { label: 'Payé', color: 'bg-green-100 text-green-700' },
  overdue: { label: 'En retard', color: 'bg-red-100 text-red-700' },
  cancelled: { label: 'Annulé', color: 'bg-gray-100 text-gray-500' },
};

const bookingStatusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: 'En attente', color: 'bg-orange-100 text-orange-700' },
  confirmed: { label: 'Confirmée', color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Annulée', color: 'bg-red-100 text-red-700' },
};

interface LandlordWithLease {
  landlord_id: string;
  landlord_first_name: string;
  landlord_last_name: string;
  landlord_email: string;
  stripe_account_id: string | null;
  stripe_charges_enabled: boolean;
  lease_id: string;
  lease_start_date: string;
  lease_end_date: string;
  lease_status: string;
  listing_title: string;
  already_charged: boolean;
  subscription_exempt: boolean;
}

interface SubscriptionCharge {
  id: string;
  landlord_id: string;
  lease_id: string | null;
  listing_id: string | null;
  period_month: string;
  amount: number;
  status: 'pending' | 'paid' | 'failed' | 'exempted' | 'cancelled';
  failure_reason: string | null;
  last_attempt_at: string | null;
  attempt_count: number;
  paid_at: string | null;
  landlord?: { first_name: string; last_name: string };
  lease?: { listing: { title: string } };
}

export default function AdminBookingsRent() {
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [autoReminderEnabled, setAutoReminderEnabled] = useState(true);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [reminding, setReminding] = useState<string | null>(null);
  const [reminderMsg, setReminderMsg] = useState<string | null>(null);
  const [togglingAuto, setTogglingAuto] = useState<string | null>(null);
  const [togglingBookingAuto, setTogglingBookingAuto] = useState<string | null>(null);
  const [landlordsWithLeases, setLandlordsWithLeases] = useState<LandlordWithLease[]>([]);
  const [landlordLoading, setLandlordLoading] = useState(true);
  const [chargingLeaseId, setChargingLeaseId] = useState<string | null>(null);
  const [chargeResults, setChargeResults] = useState<Record<string, { success: boolean; message: string }>>({});
  const [unpaidCharges, setUnpaidCharges] = useState<SubscriptionCharge[]>([]);
  const [unpaidLoading, setUnpaidLoading] = useState(true);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [retryingAllId, setRetryingAllId] = useState<string | null>(null);
  const [exemptingId, setExemptingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          id, listing_id, student_id, start_date, end_date, total_price,
          status, payment_status, created_at, auto_reminder_enabled,
          student:profiles!student_id(first_name, last_name),
          listing:listings!listing_id(title, city, address, landlord:profiles!landlord_id(first_name, last_name)),
          rent_payments(id, booking_id, student_id, landlord_id, rent_amount,
            platform_fee, total_amount, payment_date, month_year, status,
            last_reminder_sent_at, auto_reminder_enabled)
        `)
        .eq('status', 'confirmed')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBookings((data || []) as unknown as BookingRow[]);

      const { data: settings } = await supabase
        .from('rent_reminder_settings')
        .select('auto_reminder_enabled')
        .eq('id', 1)
        .maybeSingle();

      if (settings) setAutoReminderEnabled(settings.auto_reminder_enabled);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const loadLandlordsWithLeases = useCallback(async () => {
    setLandlordLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('leases')
        .select(`
          id, start_date, end_date, status, landlord_id,
          listing:listing_id(title),
          landlord:profiles!landlord_id(first_name, last_name, email, stripe_account_id, stripe_charges_enabled, subscription_exempt)
        `)
        .in('status', ['signed', 'active'])
        .gte('end_date', today)
        .order('start_date', { ascending: true });

      if (error) throw error;

      const leaseIds = (data || []).map((l: any) => l.id);

      // Check which leases have already been charged
      let chargedLeaseIds = new Set<string>();
      if (leaseIds.length > 0) {
        const { data: invoices } = await supabase
          .from('invoices')
          .select('lease_id')
          .in('lease_id', leaseIds)
          .eq('status', 'paid')
          .ilike('billing_reason', 'manual_admin_charge');
        if (invoices) {
          chargedLeaseIds = new Set(invoices.map((inv: any) => inv.lease_id).filter(Boolean));
        }
      }

      const rows: LandlordWithLease[] = (data || [])
        .filter((lease: any) => lease.landlord)
        .map((lease: any) => ({
          landlord_id: lease.landlord_id,
          landlord_first_name: lease.landlord.first_name || '',
          landlord_last_name: lease.landlord.last_name || '',
          landlord_email: lease.landlord.email || '',
          stripe_account_id: lease.landlord.stripe_account_id || null,
          stripe_charges_enabled: lease.landlord.stripe_charges_enabled || false,
          lease_id: lease.id,
          lease_start_date: lease.start_date,
          lease_end_date: lease.end_date,
          lease_status: lease.status,
          listing_title: lease.listing?.title || '',
          already_charged: chargedLeaseIds.has(lease.id),
          subscription_exempt: lease.landlord.subscription_exempt || false,
        }));

      setLandlordsWithLeases(rows);
    } catch (err) {
      console.error('Error loading landlords with leases:', err);
    } finally {
      setLandlordLoading(false);
    }
  }, []);

  const loadUnpaidCharges = useCallback(async () => {
    setUnpaidLoading(true);
    try {
      const { data, error } = await supabase
        .from('landlord_subscription_charges')
        .select(`
          id, landlord_id, lease_id, listing_id, period_month, amount, status,
          failure_reason, last_attempt_at, attempt_count, paid_at,
          landlord:profiles!landlord_id(first_name, last_name)
        `)
        .in('status', ['failed', 'pending'])
        .order('period_month', { ascending: true });

      if (error) throw error;
      setUnpaidCharges((data || []) as unknown as SubscriptionCharge[]);
    } catch (err) {
      console.error('Error loading unpaid charges:', err);
    } finally {
      setUnpaidLoading(false);
    }
  }, []);

  useEffect(() => { loadUnpaidCharges(); }, [loadUnpaidCharges]);

  useEffect(() => { loadLandlordsWithLeases(); }, [loadLandlordsWithLeases]);

  const chargeLandlord = async (lease: LandlordWithLease) => {
    if (!window.confirm(`Prélever 59,00 € d'abonnement Premium sur le compte Stripe de ${lease.landlord_first_name} ${lease.landlord_last_name} pour le bail « ${lease.listing_title || 'sans titre'} » ?`)) {
      return;
    }

    setChargingLeaseId(lease.lease_id);
    setChargeResults(prev => ({ ...prev, [lease.lease_id]: { success: false, message: '' } }));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setChargeResults(prev => ({ ...prev, [lease.lease_id]: { success: false, message: 'Session expirée. Veuillez vous reconnecter.' } }));
        return;
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-charge-landlord-subscription`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ landlord_id: lease.landlord_id, lease_id: lease.lease_id }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Erreur lors du prélèvement');
      }

      setChargeResults(prev => ({ ...prev, [lease.lease_id]: { success: true, message: result.message || 'Prélèvement effectué avec succès' } }));
      await loadLandlordsWithLeases();
      await loadUnpaidCharges();
    } catch (error) {
      console.error('Error charging subscription:', error);
      setChargeResults(prev => ({ ...prev, [lease.lease_id]: { success: false, message: error instanceof Error ? error.message : 'Erreur lors du prélèvement' } }));
    } finally {
      setChargingLeaseId(null);
    }
  };

  const retryCharge = async (charge: SubscriptionCharge) => {
    setRetryingId(charge.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-charge-landlord-subscription`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: 'retry', charge_id: charge.id }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Erreur lors de la récupération');
      }

      alert(result.message || 'Prélèvement récupéré avec succès');
      await loadUnpaidCharges();
      await loadLandlordsWithLeases();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Erreur lors de la récupération');
    } finally {
      setRetryingId(null);
    }
  };

  const retryAllCharges = async (landlordId: string, landlordName: string) => {
    const landlordUnpaid = unpaidCharges.filter(c => c.landlord_id === landlordId && c.status === 'failed');
    const totalAmount = landlordUnpaid.reduce((s, c) => s + c.amount, 0);
    if (landlordUnpaid.length === 0) return;

    if (!window.confirm(`Récupérer ${landlordUnpaid.length} impayé(s) (${(totalAmount / 100).toFixed(2)} €) sur le compte Stripe de ${landlordName} ?`)) return;

    setRetryingAllId(landlordId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-charge-landlord-subscription`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: 'retry_all', landlord_id: landlordId }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Erreur lors de la récupération');
      }

      alert(result.message || 'Impayés récupérés avec succès');
      await loadUnpaidCharges();
      await loadLandlordsWithLeases();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Erreur lors de la récupération');
    } finally {
      setRetryingAllId(null);
    }
  };

  const toggleExemption = async (landlordId: string, landlordName: string, currentExempt: boolean) => {
    const reason = currentExempt ? '' : window.prompt(`Raison de l'exonération de ${landlordName} ? (optionnel)`) || '';
    if (!currentExempt && !window.confirm(`Exonérer ${landlordName} des frais Premium ? Les impayés en attente seront annulés.`)) return;
    if (currentExempt && !window.confirm(`Retirer l'exonération de ${landlordName} ? Les prélèvements reprendront.`)) return;

    setExemptingId(landlordId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-charge-landlord-subscription`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: 'toggle_exempt', landlord_id: landlordId, reason }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Erreur lors de la mise à jour');
      }

      alert(result.message || 'Exonération mise à jour');
      await loadLandlordsWithLeases();
      await loadUnpaidCharges();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Erreur lors de la mise à jour');
    } finally {
      setExemptingId(null);
    }
  };

  const allMonths = new Set<string>();
  bookings.forEach(b => {
    b.rent_payments?.forEach(p => allMonths.add(p.month_year));
  });
  const sortedMonths = Array.from(allMonths).sort().reverse();

  const filtered = bookings.filter(b => {
    if (search) {
      const q = search.toLowerCase();
      const sName = b.student ? `${b.student.first_name} ${b.student.last_name}`.toLowerCase() : '';
      const lName = b.listing?.landlord ? `${b.listing.landlord.first_name} ${b.listing.landlord.last_name}`.toLowerCase() : '';
      const title = b.listing?.title?.toLowerCase() ?? '';
      if (!sName.includes(q) && !lName.includes(q) && !title.includes(q)) return false;
    }
    if (statusFilter !== 'all') {
      if (statusFilter === 'has_overdue') {
        if (!b.rent_payments?.some(p => p.status === 'overdue')) return false;
      } else if (statusFilter === 'has_pending') {
        if (!b.rent_payments?.some(p => p.status === 'pending')) return false;
      }
    }
    if (monthFilter !== 'all') {
      if (!b.rent_payments?.some(p => p.month_year === monthFilter)) return false;
    }
    return true;
  });

  const allPayments = bookings.flatMap(b => b.rent_payments || []);
  const totalPaid = allPayments.filter(p => p.status === 'paid').length;
  const totalPending = allPayments.filter(p => p.status === 'pending').length;
  const totalOverdue = allPayments.filter(p => p.status === 'overdue').length;

  const totalAmountPaid = allPayments.filter(p => p.status === 'paid').reduce((s, p) => s + Number(p.total_amount), 0);
  const totalAmountPending = allPayments.filter(p => p.status === 'pending' || p.status === 'overdue').reduce((s, p) => s + Number(p.total_amount), 0);

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleGlobalAutoReminder = async () => {
    setSettingsLoading(true);
    try {
      const newValue = !autoReminderEnabled;
      const { error } = await supabase
        .from('rent_reminder_settings')
        .update({ auto_reminder_enabled: newValue, updated_at: new Date().toISOString() })
        .eq('id', 1);
      if (error) throw error;
      setAutoReminderEnabled(newValue);
    } catch (err) {
      console.error('Error updating settings:', err);
    } finally {
      setSettingsLoading(false);
    }
  };

  const toggleBookingAutoReminder = async (booking: BookingRow) => {
    setTogglingBookingAuto(booking.id);
    try {
      const newValue = !booking.auto_reminder_enabled;
      const { error } = await supabase
        .from('bookings')
        .update({ auto_reminder_enabled: newValue })
        .eq('id', booking.id);
      if (error) throw error;

      setBookings(prev => prev.map(b =>
        b.id === booking.id ? { ...b, auto_reminder_enabled: newValue } : b
      ));
    } catch (err) {
      console.error('Error toggling booking auto reminder:', err);
    } finally {
      setTogglingBookingAuto(null);
    }
  };

  const togglePaymentAutoReminder = async (payment: RentPayment) => {
    setTogglingAuto(payment.id);
    try {
      const newValue = !payment.auto_reminder_enabled;
      const { error } = await supabase
        .from('rent_payments')
        .update({ auto_reminder_enabled: newValue })
        .eq('id', payment.id);
      if (error) throw error;

      setBookings(prev => prev.map(b => ({
        ...b,
        rent_payments: (b.rent_payments || []).map(p =>
          p.id === payment.id ? { ...p, auto_reminder_enabled: newValue } : p
        ),
      })));
    } catch (err) {
      console.error('Error toggling auto reminder:', err);
    } finally {
      setTogglingAuto(null);
    }
  };

  const sendManualReminder = async (payment: RentPayment) => {
    setReminding(payment.id);
    setReminderMsg(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setReminderMsg('Session expirée. Reconnectez-vous.');
        return;
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-rent-reminder`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ payment_id: payment.id }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Erreur ${response.status}`);
      }

      const result = await response.json();
      setReminderMsg(`Relance envoyée à l'étudiant (${result.sent || 1} email(s))`);
      await loadData();
    } catch (err) {
      setReminderMsg(err instanceof Error ? err.message : 'Erreur lors de l\'envoi');
    } finally {
      setReminding(null);
      setTimeout(() => setReminderMsg(null), 4000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-rose-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
        <Calendar className="w-6 h-6 text-rose-600" />
        Réservations & Loyers
      </h2>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200">
          <p className="text-xs text-gray-600">Réservations</p>
          <p className="text-lg font-bold text-gray-900 mt-1">{bookings.length}</p>
          <p className="text-xs text-gray-400 mt-1">réservations confirmées</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200">
          <p className="text-xs text-gray-600">Loyers payés</p>
          <p className="text-lg font-bold text-green-600 mt-1">{totalPaid}</p>
          <p className="text-xs text-gray-400 mt-1">{totalAmountPaid.toFixed(0)} €</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200">
          <p className="text-xs text-gray-600">En attente</p>
          <p className="text-lg font-bold text-yellow-600 mt-1">{totalPending}</p>
          <p className="text-xs text-gray-400 mt-1">{totalAmountPending.toFixed(0)} €</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200">
          <p className="text-xs text-gray-600">En retard</p>
          <p className="text-lg font-bold text-red-600 mt-1">{totalOverdue}</p>
          <p className="text-xs text-gray-400 mt-1">à relancer</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200">
          <p className="text-xs text-gray-600">Relance auto (global)</p>
          <button
            onClick={toggleGlobalAutoReminder}
            disabled={settingsLoading}
            className={`mt-1 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              autoReminderEnabled
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {autoReminderEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
            {settingsLoading ? '...' : autoReminderEnabled ? 'Active' : 'Inactive'}
          </button>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200">
          <p className="text-xs text-gray-600">Total impayé</p>
          <p className="text-lg font-bold text-orange-600 mt-1">{totalAmountPending.toFixed(0)} €</p>
          <p className="text-xs text-gray-400 mt-1">en attente + retard</p>
        </div>
      </div>

      {reminderMsg && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-lg px-4 py-3 text-sm">
          {reminderMsg}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher par étudiant, propriétaire ou logement..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
        >
          <option value="all">Tous</option>
          <option value="has_pending">Avec loyers en attente</option>
          <option value="has_overdue">Avec loyers en retard</option>
        </select>
        <select
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
        >
          <option value="all">Tous les mois</option>
          {sortedMonths.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {/* Unpaid Charges Section */}
      {unpaidCharges.length > 0 && (
        <div className="bg-red-50 rounded-xl shadow-sm border border-red-200 overflow-hidden">
          <div className="p-4 border-b border-red-200 bg-red-100">
            <h3 className="text-lg font-semibold text-red-900 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              Impayés d'abonnement ({unpaidCharges.length})
              <span className="text-sm font-normal text-red-700">
                — Total: {(unpaidCharges.reduce((s, c) => s + c.amount, 0) / 100).toFixed(2)} €
              </span>
            </h3>
            <p className="text-sm text-red-700 mt-1">
              Ces prélèvements n'ont pas pu être effectués (solde Stripe insuffisant). Ils seront retentés automatiquement quand le loyer sera payé.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-red-50 border-b border-red-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-red-700 uppercase">Propriétaire</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-red-700 uppercase">Mois</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-red-700 uppercase">Montant</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-red-700 uppercase">Raison</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-red-700 uppercase">Tentatives</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-red-700 uppercase">Dernière tentative</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-red-700 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-100 bg-white">
                {unpaidCharges.map((c) => {
                  const landlordName = c.landlord ? `${c.landlord.first_name} ${c.landlord.last_name}` : 'N/A';
                  return (
                    <tr key={c.id} className="hover:bg-red-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{landlordName}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{c.period_month}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-red-700">{(c.amount / 100).toFixed(2)} €</td>
                      <td className="px-4 py-3 text-xs text-gray-600 max-w-xs">{c.failure_reason || 'En attente'}</td>
                      <td className="px-4 py-3 text-xs text-gray-600">{c.attempt_count || 0}</td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {c.last_attempt_at ? new Date(c.last_attempt_at).toLocaleDateString('fr-FR') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => retryCharge(c)}
                          disabled={retryingId === c.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                          title="Réessayer le prélèvement maintenant"
                        >
                          {retryingId === c.id ? (
                            <>
                              <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                              ...
                            </>
                          ) : (
                            <>
                              <RotateCw className="w-4 h-4" />
                              Réessayer
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Landlord Subscription Charges */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-amber-600" />
            Prélèvement abonnement propriétaires (59 €)
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Propriétaires avec un bail actif dont la date de début est passée. Cliquez sur « Prélever » pour débiter 59 € sur leur compte Stripe.
          </p>
        </div>

        {landlordLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-rose-500 border-t-transparent"></div>
          </div>
        ) : landlordsWithLeases.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Calendar className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            <p>Aucun bail signé ou actif trouvé.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Propriétaire</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Logement</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Période du bail</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Statut bail</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Stripe</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Impayés</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Résultat</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {landlordsWithLeases.map((l) => {
                  const today = new Date().toISOString().split('T')[0];
                  const leaseStarted = l.lease_start_date <= today;
                  const stripeReady = !!l.stripe_account_id && l.stripe_charges_enabled;
                  const canCharge = leaseStarted && stripeReady && !l.already_charged && !l.subscription_exempt;
                  const result = chargeResults[l.lease_id];
                  const landlordUnpaid = unpaidCharges.filter(c => c.landlord_id === l.landlord_id && c.status === 'failed');
                  const landlordUnpaidTotal = landlordUnpaid.reduce((s, c) => s + c.amount, 0);

                  return (
                    <tr key={l.lease_id} className={`hover:bg-gray-50 ${l.subscription_exempt ? 'bg-gray-50' : ''}`}>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-900">
                          {l.landlord_first_name} {l.landlord_last_name}
                          {l.subscription_exempt && (
                            <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-600">Exonéré</span>
                          )}
                        </p>
                        {l.landlord_email && <p className="text-xs text-gray-500">{l.landlord_email}</p>}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 max-w-xs truncate" title={l.listing_title}>{l.listing_title || 'N/A'}</td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {new Date(l.lease_start_date).toLocaleDateString('fr-FR')} → {new Date(l.lease_end_date).toLocaleDateString('fr-FR')}
                        {!leaseStarted && (
                          <span className="block mt-1 text-orange-600 font-medium">Débute le {new Date(l.lease_start_date).toLocaleDateString('fr-FR')}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${l.lease_status === 'active' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                          {l.lease_status === 'active' ? 'Actif' : 'Signé'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {stripeReady ? (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">Activé</span>
                        ) : (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">Non configuré</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {landlordUnpaid.length > 0 ? (
                          <div className="flex flex-col gap-1">
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                              {landlordUnpaid.length} impayé{landlordUnpaid.length > 1 ? 's' : ''}
                            </span>
                            <span className="text-xs text-red-600 font-semibold">{(landlordUnpaidTotal / 100).toFixed(2)} €</span>
                            <button
                              onClick={() => retryAllCharges(l.landlord_id, `${l.landlord_first_name} ${l.landlord_last_name}`)}
                              disabled={retryingAllId === l.landlord_id}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 rounded text-xs font-medium transition-colors disabled:opacity-50"
                            >
                              {retryingAllId === l.landlord_id ? (
                                <>
                                  <div className="w-3 h-3 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                                  ...
                                </>
                              ) : (
                                <>
                                  <RotateCw className="w-3 h-3" />
                                  Tout récupérer
                                </>
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {l.already_charged && !result && (
                          <div className="flex items-start gap-1.5 text-xs text-gray-500">
                            <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            <span>Déjà prélevé</span>
                          </div>
                        )}
                        {result && (
                          <div className={`flex items-start gap-1.5 text-xs max-w-xs ${result.success ? 'text-green-600' : 'text-red-600'}`}>
                            {result.success ? <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
                            <span>{result.message}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1.5">
                          <button
                            onClick={() => chargeLandlord(l)}
                            disabled={!canCharge || chargingLeaseId === l.lease_id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            title={!leaseStarted ? 'Le bail n\'a pas encore commencé' : !stripeReady ? 'Compte Stripe non configuré' : l.already_charged ? 'Ce bail a déjà été prélevé' : l.subscription_exempt ? 'Propriétaire exonéré' : 'Prélever 59 €'}
                          >
                            {chargingLeaseId === l.lease_id ? (
                              <>
                                <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                                En cours...
                              </>
                            ) : l.already_charged ? (
                              <>
                                <CheckCircle2 className="w-4 h-4" />
                                Prélevé
                              </>
                            ) : (
                              <>
                                <CreditCard className="w-4 h-4" />
                                Prélever 59 €
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => toggleExemption(l.landlord_id, `${l.landlord_first_name} ${l.landlord_last_name}`, l.subscription_exempt)}
                            disabled={exemptingId === l.landlord_id}
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                              l.subscription_exempt
                                ? 'bg-green-50 text-green-700 hover:bg-green-100'
                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }`}
                            title={l.subscription_exempt ? 'Retirer l\'exonération' : 'Exonérer ce propriétaire'}
                          >
                            {exemptingId === l.landlord_id ? (
                              <>
                                <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                                ...
                              </>
                            ) : l.subscription_exempt ? (
                              <>
                                <ShieldCheck className="w-3 h-3" />
                                Exonéré
                              </>
                            ) : (
                              <>
                                <ShieldOff className="w-3 h-3" />
                                Exonérer
                              </>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>Aucune réservation trouvée.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase w-8"></th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Étudiant</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Propriétaire</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Logement</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Période</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Statut</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Loyers</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Relance auto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filtered.map((booking) => {
                  const isExpanded = expandedRows.has(booking.id);
                  const payments = booking.rent_payments || [];
                  const paidCount = payments.filter(p => p.status === 'paid').length;
                  const pendingCount = payments.filter(p => p.status === 'pending').length;
                  const overdueCount = payments.filter(p => p.status === 'overdue').length;

                  return (
                    <>
                      <tr key={booking.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => toggleRow(booking.id)}>
                        <td className="px-4 py-3 text-gray-400">
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {booking.student ? `${booking.student.first_name} ${booking.student.last_name}` : 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {booking.listing?.landlord ? `${booking.listing.landlord.first_name} ${booking.listing.landlord.last_name}` : 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          <div className="flex items-center gap-1">
                            <Home className="w-3.5 h-3.5 text-gray-400" />
                            {booking.listing?.title ?? 'N/A'}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600">
                          {new Date(booking.start_date).toLocaleDateString('fr-FR')} → {new Date(booking.end_date).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${bookingStatusConfig[booking.status]?.color || 'bg-gray-100 text-gray-600'}`}>
                            {bookingStatusConfig[booking.status]?.label || booking.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <div className="flex flex-wrap gap-1">
                            {paidCount > 0 && <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700">{paidCount} payé{paidCount > 1 ? 's' : ''}</span>}
                            {pendingCount > 0 && <span className="px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">{pendingCount} attente</span>}
                            {overdueCount > 0 && <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700">{overdueCount} retard</span>}
                            {payments.length === 0 && <span className="text-gray-400">Aucun loyer</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => toggleBookingAutoReminder(booking)}
                            disabled={togglingBookingAuto === booking.id}
                            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                              booking.auto_reminder_enabled
                                ? 'bg-green-50 text-green-700 hover:bg-green-100'
                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }`}
                            title={booking.auto_reminder_enabled ? 'Relance auto activée pour cette réservation' : 'Relance auto désactivée pour cette réservation'}
                          >
                            {booking.auto_reminder_enabled ? <Bell className="w-3 h-3" /> : <BellOff className="w-3 h-3" />}
                            {togglingBookingAuto === booking.id ? '...' : booking.auto_reminder_enabled ? 'Oui' : 'Non'}
                          </button>
                        </td>
                      </tr>
                      {isExpanded && payments.length > 0 && (
                        <tr key={`${booking.id}-detail`} className="bg-gray-50">
                          <td colSpan={8} className="px-8 py-4">
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="text-xs text-gray-500 uppercase">
                                    <th className="text-left py-2 px-3">Mois</th>
                                    <th className="text-left py-2 px-3">Échéance</th>
                                    <th className="text-left py-2 px-3">Loyer</th>
                                    <th className="text-left py-2 px-3">Frais</th>
                                    <th className="text-left py-2 px-3">Total</th>
                                    <th className="text-left py-2 px-3">Statut</th>
                                    <th className="text-left py-2 px-3">Relance auto (loyer)</th>
                                    <th className="text-left py-2 px-3">Dernière relance</th>
                                    <th className="text-left py-2 px-3">Action</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                  {payments
                                    .sort((a, b) => a.month_year.localeCompare(b.month_year))
                                    .map(p => {
                                      const cfg = statusConfig[p.status] || statusConfig.pending;
                                      return (
                                        <tr key={p.id} className="hover:bg-white">
                                          <td className="py-2 px-3 font-medium text-gray-900">{p.month_year}</td>
                                          <td className="py-2 px-3 text-gray-600">
                                            {new Date(p.payment_date).toLocaleDateString('fr-FR')}
                                          </td>
                                          <td className="py-2 px-3 text-gray-700">{Number(p.rent_amount).toFixed(2)} €</td>
                                          <td className="py-2 px-3 text-gray-500">{Number(p.platform_fee).toFixed(2)} €</td>
                                          <td className="py-2 px-3 font-semibold text-gray-900">{Number(p.total_amount).toFixed(2)} €</td>
                                          <td className="py-2 px-3">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                                          </td>
                                          <td className="py-2 px-3">
                                            <button
                                              onClick={(e) => { e.stopPropagation(); togglePaymentAutoReminder(p); }}
                                              disabled={togglingAuto === p.id}
                                              className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                                                p.auto_reminder_enabled
                                                  ? 'bg-green-50 text-green-700 hover:bg-green-100'
                                                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                              }`}
                                              title={p.auto_reminder_enabled ? 'Relance auto activée pour ce loyer' : 'Relance auto désactivée pour ce loyer'}
                                            >
                                              {p.auto_reminder_enabled ? <Bell className="w-3 h-3" /> : <BellOff className="w-3 h-3" />}
                                              {togglingAuto === p.id ? '...' : p.auto_reminder_enabled ? 'Oui' : 'Non'}
                                            </button>
                                          </td>
                                          <td className="py-2 px-3 text-xs text-gray-500">
                                            {p.last_reminder_sent_at
                                              ? new Date(p.last_reminder_sent_at).toLocaleDateString('fr-FR')
                                              : '—'}
                                          </td>
                                          <td className="py-2 px-3">
                                            {(p.status === 'pending' || p.status === 'overdue') && (
                                              <button
                                                onClick={(e) => { e.stopPropagation(); sendManualReminder(p); }}
                                                disabled={reminding === p.id}
                                                className="flex items-center gap-1 px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                                              >
                                                <Send className="w-3 h-3" />
                                                {reminding === p.id ? 'Envoi...' : 'Relancer'}
                                              </button>
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
