import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { FileText, Plus, Eye, Trash2, Send, CheckCircle, AlertCircle, Clock, X, Download, CreditCard as Edit } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import BackButton from '../components/BackButton';

interface Listing {
  id: string;
  title: string;
  address: string;
}

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  phone?: string;
}

interface Booking {
  id: string;
  listing_id: string;
  student_id: string;
  start_date: string;
  end_date: string;
  total_days: number;
  total_price: number;
  status: string;
  listing?: Listing;
  student?: Profile;
}

interface Lease {
  id: string;
  booking_id?: string;
  listing_id: string;
  landlord_id: string;
  tenant_id: string;
  start_date: string;
  end_date: string;
  monthly_rent: number;
  security_deposit: number;
  charges: number;
  lease_type: string;
  status: 'draft' | 'pending_signature' | 'signed' | 'active' | 'terminated' | 'cancelled';
  document_url?: string;
  terms_and_conditions?: string;
  inventory_included: boolean;
  created_at: string;
  signed_at?: string;
  listing?: Listing;
  tenant?: Profile;
}

export default function Leases() {
  const { user, profile } = useAuth();
  const { language } = useLanguage();
  const [leases, setLeases] = useState<Lease[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedLease, setSelectedLease] = useState<Lease | null>(null);
  const [availableBookings, setAvailableBookings] = useState<Booking[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [contractHtml, setContractHtml] = useState<string>('');
  const [loadingContract, setLoadingContract] = useState(false);

  const [formData, setFormData] = useState({
    booking_id: '',
    listing_id: '',
    tenant_id: '',
    start_date: '',
    end_date: '',
    monthly_rent: 0,
    security_deposit: 0,
    charges: 0,
    lease_type: 'furnished',
    terms_and_conditions: '',
    inventory_included: false
  });

  const [editFormData, setEditFormData] = useState({
    start_date: '',
    end_date: '',
    monthly_rent: 0,
    security_deposit: 0,
    charges: 0,
    lease_type: 'furnished',
    terms_and_conditions: '',
    inventory_included: false
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user?.id) {
      loadLeases();
      loadAvailableBookings();
    }
  }, [user?.id]);

  const loadLeases = async () => {
    try {
      const { data, error } = await supabase
        .from('leases')
        .select(`
          *,
          listing:listings(id, title, address),
          tenant:profiles!leases_tenant_id_fkey(id, first_name, last_name)
        `)
        .eq('landlord_id', profile?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLeases(data || []);
    } catch (error) {
      console.error('Erreur chargement baux:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableBookings = async () => {
    try {
      if (!user?.id) {
        console.log('DEBUG: No user ID available');
        return;
      }

      console.log('DEBUG: User ID:', user.id);

      const { data: myListings, error: listingsError } = await supabase
        .from('listings')
        .select('id, title')
        .eq('landlord_id', user.id);

      if (listingsError) {
        console.error('DEBUG: Error loading listings:', listingsError);
        return;
      }

      console.log('DEBUG: My listings:', myListings);

      const myListingIds = myListings?.map(l => l.id) || [];

      if (myListingIds.length === 0) {
        console.log('DEBUG: No listings found for this landlord');
        setAvailableBookings([]);
        return;
      }

      const { data: existingLeases } = await supabase
        .from('leases')
        .select('booking_id')
        .not('booking_id', 'is', null);

      const existingBookingIds = existingLeases?.map(l => l.booking_id).filter(id => id) || [];
      console.log('DEBUG: Existing booking IDs with leases:', existingBookingIds);

      let query = supabase
        .from('bookings')
        .select(`
          *,
          listing:listings(id, title, address, price_per_month, electricity_cost, heating_cost, water_cost, security_deposit, landlord_id),
          student:profiles!bookings_student_id_fkey(id, first_name, last_name, phone)
        `)
        .eq('status', 'confirmed')
        .in('listing_id', myListingIds);

      if (existingBookingIds.length > 0) {
        query = query.not('id', 'in', `(${existingBookingIds.join(',')})`);
      }

      const { data, error } = await query.order('start_date', { ascending: true });

      if (error) {
        console.error('DEBUG: Error loading bookings:', error);
        throw error;
      }

      console.log('DEBUG: Available bookings found:', data?.length || 0);
      console.log('DEBUG: Bookings data:', data);
      setAvailableBookings((data || []) as Booking[]);
    } catch (error) {
      console.error('Erreur chargement réservations:', error);
    }
  };

  const handleBookingSelect = (bookingId: string) => {
    const booking = availableBookings.find(b => b.id === bookingId);
    if (!booking) return;

    setSelectedBooking(booking);

    const monthlyRent = booking.listing?.price_per_month || 0;
    const electricityCost = booking.listing?.electricity_cost || 0;
    const heatingCost = booking.listing?.heating_cost || 0;
    const waterCost = booking.listing?.water_cost || 0;
    const charges = electricityCost + heatingCost + waterCost;
    const securityDeposit = booking.listing?.security_deposit || monthlyRent;

    setFormData({
      booking_id: booking.id,
      listing_id: booking.listing_id,
      tenant_id: booking.student_id,
      start_date: booking.start_date,
      end_date: booking.end_date,
      monthly_rent: monthlyRent,
      security_deposit: securityDeposit,
      charges: charges,
      lease_type: 'furnished',
      terms_and_conditions: '',
      inventory_included: false
    });
  };

  const handleSave = async () => {
    if (!formData.booking_id || !formData.listing_id || !formData.tenant_id) {
      alert('Veuillez sélectionner une réservation');
      return;
    }

    setSaving(true);
    try {
      const leaseData = {
        ...formData,
        landlord_id: profile?.id,
        status: 'draft'
      };

      const { error } = await supabase
        .from('leases')
        .insert([leaseData]);

      if (error) throw error;

      alert('Bail créé avec succès !');
      setShowCreateModal(false);
      resetForm();
      loadLeases();
      loadAvailableBookings();
    } catch (error) {
      console.error('Erreur création bail:', error);
      alert('Erreur lors de la création du bail');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (leaseId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce bail ?')) return;

    try {
      const { error } = await supabase
        .from('leases')
        .delete()
        .eq('id', leaseId);

      if (error) throw error;

      alert('Bail supprimé avec succès');
      loadLeases();
      loadAvailableBookings();
    } catch (error) {
      console.error('Erreur suppression bail:', error);
      alert('Erreur lors de la suppression du bail');
    }
  };

  const loadContractHtml = async (leaseId: string) => {
    setLoadingContract(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('Vous devez être connecté');
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-lease-contract?id=${leaseId}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Erreur lors de la génération du contrat');
      }

      const html = await response.text();
      setContractHtml(html);
    } catch (error) {
      console.error('Erreur chargement contrat:', error);
      alert('Erreur lors du chargement du contrat');
    } finally {
      setLoadingContract(false);
    }
  };

  const handleDownloadContract = async (leaseId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('Vous devez être connecté');
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-lease-contract?id=${leaseId}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Erreur lors de la génération du contrat');
      }

      const html = await response.text();
      const blob = new Blob([html], { type: 'text/html' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Contrat_Location_${new Date().toISOString().split('T')[0]}.html`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Erreur téléchargement contrat:', error);
      alert('Erreur lors du téléchargement du contrat');
    }
  };

  const handleViewContract = async (lease: Lease) => {
    setSelectedLease(lease);
    setShowViewModal(true);
    await loadContractHtml(lease.id);
  };

  const handleEditLease = (lease: Lease) => {
    setSelectedLease(lease);
    setEditFormData({
      start_date: lease.start_date.split('T')[0],
      end_date: lease.end_date.split('T')[0],
      monthly_rent: lease.monthly_rent,
      security_deposit: lease.security_deposit,
      charges: lease.charges,
      lease_type: lease.lease_type,
      terms_and_conditions: lease.terms_and_conditions || '',
      inventory_included: lease.inventory_included
    });
    setShowEditModal(true);
  };

  const handleUpdateLease = async () => {
    if (!selectedLease) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('leases')
        .update({
          start_date: editFormData.start_date,
          end_date: editFormData.end_date,
          monthly_rent: editFormData.monthly_rent,
          security_deposit: editFormData.security_deposit,
          charges: editFormData.charges,
          lease_type: editFormData.lease_type,
          terms_and_conditions: editFormData.terms_and_conditions,
          inventory_included: editFormData.inventory_included
        })
        .eq('id', selectedLease.id);

      if (error) throw error;

      alert('Bail mis à jour avec succès');
      setShowEditModal(false);
      loadLeases();
    } catch (error) {
      console.error('Erreur mise à jour bail:', error);
      alert('Erreur lors de la mise à jour du bail');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      booking_id: '',
      listing_id: '',
      tenant_id: '',
      start_date: '',
      end_date: '',
      monthly_rent: 0,
      security_deposit: 0,
      charges: 0,
      lease_type: 'furnished',
      terms_and_conditions: '',
      inventory_included: false
    });
    setSelectedBooking(null);
  };

  const getStatusBadge = (status: Lease['status']) => {
    const fr = language === 'fr';
    const badges = {
      draft: { text: fr ? 'Brouillon' : 'Draft', color: 'bg-gray-100 text-gray-800', icon: AlertCircle },
      pending_signature: { text: fr ? 'En attente de signature' : 'Awaiting signature', color: 'bg-orange-100 text-orange-800', icon: Clock },
      signed: { text: fr ? 'Signé' : 'Signed', color: 'bg-green-100 text-green-800', icon: CheckCircle },
      active: { text: fr ? 'Actif' : 'Active', color: 'bg-blue-100 text-blue-800', icon: CheckCircle },
      terminated: { text: fr ? 'Terminé' : 'Terminated', color: 'bg-gray-100 text-gray-600', icon: AlertCircle },
      cancelled: { text: fr ? 'Annulé' : 'Cancelled', color: 'bg-red-100 text-red-800', icon: X }
    };

    const badge = badges[status];
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${badge.color}`}>
        <Icon className="w-3 h-3 mr-1" />
        {badge.text}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">{language === 'fr' ? 'Chargement des baux...' : 'Loading leases...'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <BackButton />
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
              <FileText className="w-8 h-8 mr-3 text-blue-600" />
              {language === 'fr' ? 'Mes Baux' : 'My Leases'}
            </h1>
            <p className="text-gray-600 mt-1">{language === 'fr' ? 'Gérez vos contrats de location' : 'Manage your rental contracts'}</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium shadow-lg"
          >
            <Plus className="w-5 h-5 mr-2" />
            {language === 'fr' ? 'Créer un bail' : 'Create a lease'}
          </button>
        </div>

        {leases.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">{language === 'fr' ? 'Aucun bail' : 'No leases'}</h3>
            <p className="text-gray-600 mb-6">{language === 'fr' ? "Commencez par créer votre premier bail à partir d'une réservation acceptée" : 'Start by creating your first lease from an accepted booking'}</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
            >
              <Plus className="w-5 h-5 mr-2" />
              {language === 'fr' ? 'Créer un bail' : 'Create a lease'}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {leases.map((lease) => (
              <div key={lease.id} className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-3">
                      <h3 className="text-xl font-bold text-gray-900">
                        {lease.listing?.title || 'Logement supprimé'}
                      </h3>
                      {getStatusBadge(lease.status)}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600 mb-1">
                          <span className="font-medium">{language === 'fr' ? 'Adresse :' : 'Address:'}</span> {lease.listing?.address}
                        </p>
                        <p className="text-gray-600 mb-1">
                          <span className="font-medium">{language === 'fr' ? 'Locataire :' : 'Tenant:'}</span>{' '}
                          {lease.tenant ? `${lease.tenant.first_name} ${lease.tenant.last_name}` : (language === 'fr' ? 'Non assigné' : 'Not assigned')}
                        </p>
                        <p className="text-gray-600">
                          <span className="font-medium">{language === 'fr' ? 'Type :' : 'Type:'}</span>{' '}
                          {lease.lease_type === 'furnished' ? (language === 'fr' ? 'Meublé' : 'Furnished') : (language === 'fr' ? 'Non meublé' : 'Unfurnished')}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600 mb-1">
                          <span className="font-medium">{language === 'fr' ? 'Période :' : 'Period:'}</span>{' '}
                          {new Date(lease.start_date).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-GB')} - {new Date(lease.end_date).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-GB')}
                        </p>
                        <p className="text-gray-600 mb-1">
                          <span className="font-medium">{language === 'fr' ? 'Loyer :' : 'Rent:'}</span> {lease.monthly_rent}€/{language === 'fr' ? 'mois' : 'month'}
                        </p>
                        <p className="text-gray-600">
                          <span className="font-medium">{language === 'fr' ? 'Caution :' : 'Deposit:'}</span> {lease.security_deposit}€
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={() => handleViewContract(lease)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title={language === 'fr' ? 'Voir le bail' : 'View lease'}
                    >
                      <Eye className="w-5 h-5" />
                    </button>

                    {lease.status === 'draft' && (
                      <button
                        onClick={() => handleEditLease(lease)}
                        className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                        title={language === 'fr' ? 'Modifier le bail' : 'Edit lease'}
                      >
                        <Edit className="w-5 h-5" />
                      </button>
                    )}

                    <button
                      onClick={() => handleDownloadContract(lease.id)}
                      className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      title={language === 'fr' ? 'Télécharger le contrat' : 'Download contract'}
                    >
                      <Download className="w-5 h-5" />
                    </button>

                    {lease.status === 'draft' && (
                      <button
                        onClick={() => handleDelete(lease.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title={language === 'fr' ? 'Supprimer' : 'Delete'}
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {showCreateModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 transition-opacity bg-gray-900 bg-opacity-75" onClick={() => setShowCreateModal(false)}></div>

              <div className="inline-block w-full max-w-4xl my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-2xl rounded-2xl">
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-2xl font-bold text-white flex items-center">
                      <FileText className="w-6 h-6 mr-2" />
                      {language === 'fr' ? 'Créer un nouveau bail' : 'Create a new lease'}
                    </h3>
                    <button
                      onClick={() => {
                        setShowCreateModal(false);
                        resetForm();
                      }}
                      className="text-white hover:bg-blue-800 rounded-lg p-2 transition-colors"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                </div>

                <div className="p-6 max-h-[calc(100vh-200px)] overflow-y-auto">
                  {availableBookings.length === 0 ? (
                    <div className="text-center py-12">
                      <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">
                        Aucune réservation disponible
                      </h3>
                      <p className="text-gray-600">
                        Vous devez d'abord accepter une demande de réservation avant de créer un bail.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Réservation acceptée *
                        </label>
                        <select
                          value={formData.booking_id}
                          onChange={(e) => handleBookingSelect(e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          required
                        >
                          <option value="">Sélectionnez une réservation</option>
                          {availableBookings.map((booking) => (
                            <option key={booking.id} value={booking.id}>
                              {booking.listing?.title} - {booking.student?.first_name} {booking.student?.last_name} - Du {new Date(booking.start_date).toLocaleDateString('fr-FR')} au {new Date(booking.end_date).toLocaleDateString('fr-FR')}
                            </option>
                          ))}
                        </select>
                      </div>

                      {selectedBooking && (
                        <>
                          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                            <h4 className="font-semibold text-blue-900 mb-3">Informations de la réservation</h4>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <p className="text-blue-800">
                                  <span className="font-medium">Logement :</span> {selectedBooking.listing?.title}
                                </p>
                                <p className="text-blue-800">
                                  <span className="font-medium">Adresse :</span> {selectedBooking.listing?.address}
                                </p>
                                <p className="text-blue-800">
                                  <span className="font-medium">Locataire :</span> {selectedBooking.student?.first_name} {selectedBooking.student?.last_name}
                                </p>
                              </div>
                              <div>
                                <p className="text-blue-800">
                                  <span className="font-medium">Téléphone :</span> {selectedBooking.student?.phone || 'Non renseigné'}
                                </p>
                                <p className="text-blue-800">
                                  <span className="font-medium">Durée :</span> {selectedBooking.total_days} jours
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Date de début *
                              </label>
                              <input
                                type="date"
                                value={formData.start_date}
                                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Date de fin *
                              </label>
                              <input
                                type="date"
                                value={formData.end_date}
                                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                required
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Loyer mensuel (€) *
                              </label>
                              <input
                                type="number"
                                value={formData.monthly_rent}
                                onChange={(e) => setFormData({ ...formData, monthly_rent: parseFloat(e.target.value) })}
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Charges (€)
                              </label>
                              <input
                                type="number"
                                value={formData.charges}
                                onChange={(e) => setFormData({ ...formData, charges: parseFloat(e.target.value) })}
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Caution (€) *
                              </label>
                              <input
                                type="number"
                                value={formData.security_deposit}
                                onChange={(e) => setFormData({ ...formData, security_deposit: parseFloat(e.target.value) })}
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                required
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Type de bail
                            </label>
                            <select
                              value={formData.lease_type}
                              onChange={(e) => setFormData({ ...formData, lease_type: e.target.value })}
                              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                              <option value="furnished">Meublé</option>
                              <option value="unfurnished">Non meublé</option>
                              <option value="student">Étudiant</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Clauses particulières
                            </label>
                            <textarea
                              value={formData.terms_and_conditions}
                              onChange={(e) => setFormData({ ...formData, terms_and_conditions: e.target.value })}
                              rows={4}
                              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="Ajoutez des clauses spécifiques au bail..."
                            />
                          </div>

                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              id="inventory"
                              checked={formData.inventory_included}
                              onChange={(e) => setFormData({ ...formData, inventory_included: e.target.checked })}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <label htmlFor="inventory" className="ml-2 text-sm text-gray-700">
                              État des lieux inclus
                            </label>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {availableBookings.length > 0 && (
                  <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3">
                    <button
                      onClick={() => {
                        setShowCreateModal(false);
                        resetForm();
                      }}
                      className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving || !formData.booking_id}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 transition-colors"
                    >
                      {saving ? 'Enregistrement...' : 'Créer le bail'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {showViewModal && selectedLease && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 transition-opacity bg-gray-900 bg-opacity-75" onClick={() => setShowViewModal(false)}></div>

              <div className="inline-block w-full max-w-4xl my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-2xl rounded-2xl">
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-2xl font-bold text-white flex items-center">
                      <FileText className="w-6 h-6 mr-2" />
                      Détails du bail
                    </h3>
                    <button
                      onClick={() => {
                        setShowViewModal(false);
                        setContractHtml('');
                      }}
                      className="text-white hover:bg-blue-800 rounded-lg p-2 transition-colors"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                </div>

                <div className="p-6">
                  {loadingContract ? (
                    <div className="flex items-center justify-center py-20">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <p className="text-gray-600">Chargement du contrat...</p>
                      </div>
                    </div>
                  ) : contractHtml ? (
                    <div
                      className="bg-white border-2 border-gray-200 rounded-xl overflow-auto"
                      style={{ maxHeight: 'calc(100vh - 250px)' }}
                      dangerouslySetInnerHTML={{ __html: contractHtml }}
                    />
                  ) : (
                    <div className="flex items-center justify-center py-20">
                      <p className="text-gray-600">Erreur lors du chargement du contrat</p>
                    </div>
                  )}
                </div>

                <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      setShowViewModal(false);
                      setContractHtml('');
                    }}
                    className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    Fermer
                  </button>
                  <button
                    onClick={() => selectedLease && handleDownloadContract(selectedLease.id)}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Télécharger
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showEditModal && selectedLease && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-gradient-to-r from-orange-600 to-orange-700 text-white p-6 rounded-t-2xl z-10">
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-bold flex items-center">
                    <Edit className="w-6 h-6 mr-2" />
                    Modifier le bail
                  </h3>
                  <button
                    onClick={() => setShowEditModal(false)}
                    className="text-white hover:bg-orange-800 rounded-lg p-2 transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="p-6">
                <div className="space-y-6">
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <p className="text-sm text-blue-900">
                      <strong>Bien concerné :</strong> {selectedLease.listing?.title}<br />
                      <strong>Adresse :</strong> {selectedLease.listing?.address}<br />
                      <strong>Locataire :</strong> {selectedLease.tenant?.first_name} {selectedLease.tenant?.last_name}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Date de début *
                      </label>
                      <input
                        type="date"
                        value={editFormData.start_date}
                        onChange={(e) => setEditFormData({ ...editFormData, start_date: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Date de fin *
                      </label>
                      <input
                        type="date"
                        value={editFormData.end_date}
                        onChange={(e) => setEditFormData({ ...editFormData, end_date: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Loyer mensuel (€) *
                      </label>
                      <input
                        type="number"
                        value={editFormData.monthly_rent}
                        onChange={(e) => setEditFormData({ ...editFormData, monthly_rent: parseFloat(e.target.value) })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Charges (€)
                      </label>
                      <input
                        type="number"
                        value={editFormData.charges}
                        onChange={(e) => setEditFormData({ ...editFormData, charges: parseFloat(e.target.value) })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Caution (€) *
                      </label>
                      <input
                        type="number"
                        value={editFormData.security_deposit}
                        onChange={(e) => setEditFormData({ ...editFormData, security_deposit: parseFloat(e.target.value) })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Type de bail
                    </label>
                    <select
                      value={editFormData.lease_type}
                      onChange={(e) => setEditFormData({ ...editFormData, lease_type: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    >
                      <option value="furnished">Meublé</option>
                      <option value="unfurnished">Non meublé</option>
                      <option value="student">Étudiant</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Clauses particulières
                    </label>
                    <textarea
                      value={editFormData.terms_and_conditions}
                      onChange={(e) => setEditFormData({ ...editFormData, terms_and_conditions: e.target.value })}
                      rows={6}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      placeholder="Ajoutez des clauses spécifiques au bail..."
                    />
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="edit-inventory"
                      checked={editFormData.inventory_included}
                      onChange={(e) => setEditFormData({ ...editFormData, inventory_included: e.target.checked })}
                      className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                    />
                    <label htmlFor="edit-inventory" className="ml-2 text-sm text-gray-700">
                      État des lieux inclus
                    </label>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                  disabled={saving}
                >
                  Annuler
                </button>
                <button
                  onClick={handleUpdateLease}
                  disabled={saving}
                  className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
