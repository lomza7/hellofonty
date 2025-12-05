import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import {
  ArrowLeft, ArrowRight, Save, Home, Calendar,
  User, Mail, FileText, Check
} from 'lucide-react';

interface Listing {
  id: string;
  title: string;
  address: string;
}

interface Lease {
  id: string;
  start_date: string;
  end_date: string;
  tenant_id: string;
  tenant: {
    first_name: string;
    last_name: string;
    email: string;
  };
}

interface Booking {
  id: string;
  start_date: string;
  end_date: string;
  student_id: string;
  student: {
    first_name: string;
    last_name: string;
    id: string;
  };
}

export default function CreateInventory() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [listings, setListings] = useState<Listing[]>([]);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [checkInInventories, setCheckInInventories] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    listing_id: '',
    booking_id: '',
    lease_id: '',
    inventory_type: 'check_in' as 'check_in' | 'check_out',
    inspection_date: new Date().toISOString().split('T')[0],
    tenant_id: '',
    tenant_name: '',
    tenant_email: '',
    check_in_inventory_id: ''
  });

  useEffect(() => {
    loadListings();
  }, [user]);

  useEffect(() => {
    if (formData.listing_id) {
      loadBookings(formData.listing_id);
      loadLeases(formData.listing_id);
    }
  }, [formData.listing_id]);

  useEffect(() => {
    if (formData.inventory_type === 'check_out' && formData.listing_id) {
      loadCheckInInventories(formData.listing_id);
    }
  }, [formData.inventory_type, formData.listing_id]);

  useEffect(() => {
    const loadTenantInfo = async () => {
      if (formData.booking_id) {
        const selectedBooking = bookings.find(b => b.id === formData.booking_id);
        if (selectedBooking) {
          const { data: emailData } = await supabase
            .rpc('get_user_email', { user_id: selectedBooking.student_id });

          setFormData(prev => ({
            ...prev,
            tenant_id: selectedBooking.student_id,
            tenant_name: `${selectedBooking.student.first_name} ${selectedBooking.student.last_name}`,
            tenant_email: emailData || ''
          }));
        }
      }
    };

    loadTenantInfo();
  }, [formData.booking_id, bookings]);

  useEffect(() => {
    if (formData.lease_id && !formData.booking_id) {
      const selectedLease = leases.find(l => l.id === formData.lease_id);
      if (selectedLease) {
        setFormData(prev => ({
          ...prev,
          tenant_id: selectedLease.tenant_id,
          tenant_name: `${selectedLease.tenant.first_name} ${selectedLease.tenant.last_name}`,
          tenant_email: selectedLease.tenant.email || ''
        }));
      }
    }
  }, [formData.lease_id, leases, formData.booking_id]);

  const loadListings = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('listings')
        .select('id, title, address')
        .eq('landlord_id', user.id)
        .eq('is_active', true)
        .order('title');

      if (error) throw error;
      setListings(data || []);
    } catch (error) {
      console.error('Error loading listings:', error);
    }
  };

  const loadBookings = async (listingId: string) => {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          student:profiles!bookings_student_id_fkey(first_name, last_name, id)
        `)
        .eq('listing_id', listingId)
        .eq('status', 'confirmed')
        .order('start_date', { ascending: false });

      if (error) throw error;
      setBookings(data || []);
    } catch (error) {
      console.error('Error loading bookings:', error);
    }
  };

  const loadLeases = async (listingId: string) => {
    try {
      const { data, error } = await supabase
        .from('leases')
        .select(`
          *,
          tenant:profiles!leases_tenant_id_fkey(first_name, last_name)
        `)
        .eq('listing_id', listingId)
        .order('start_date', { ascending: false });

      if (error) throw error;
      setLeases(data || []);
    } catch (error) {
      console.error('Error loading leases:', error);
    }
  };

  const loadCheckInInventories = async (listingId: string) => {
    try {
      const { data, error } = await supabase
        .from('property_inventories')
        .select('id, inspection_date, tenant_name')
        .eq('listing_id', listingId)
        .eq('inventory_type', 'check_in')
        .order('inspection_date', { ascending: false });

      if (error) throw error;
      setCheckInInventories(data || []);
    } catch (error) {
      console.error('Error loading check-in inventories:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const inventoryData = {
        listing_id: formData.listing_id,
        booking_id: formData.booking_id || null,
        lease_id: formData.lease_id || null,
        inventory_type: formData.inventory_type,
        landlord_id: user.id,
        tenant_id: formData.tenant_id || null,
        tenant_name: formData.tenant_name || null,
        tenant_email: formData.tenant_email || null,
        inspection_date: formData.inspection_date,
        check_in_inventory_id: formData.check_in_inventory_id || null,
        status: 'draft'
      };

      const { data: inventory, error } = await supabase
        .from('property_inventories')
        .insert(inventoryData)
        .select()
        .single();

      if (error) throw error;

      navigate(`/inventory/${inventory.id}/edit`);
    } catch (error) {
      console.error('Error creating inventory:', error);
      alert(language === 'fr' ? 'Erreur lors de la création' : 'Error creating inventory');
    } finally {
      setLoading(false);
    }
  };

  const selectedListing = listings.find(l => l.id === formData.listing_id);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <button
          onClick={() => navigate('/inventory')}
          className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          {language === 'fr' ? 'Retour' : 'Back'}
        </button>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-green-600 to-emerald-700 px-8 py-6">
            <h1 className="text-2xl font-bold text-white">
              {language === 'fr' ? 'Nouvel état des lieux' : 'New Property Inventory'}
            </h1>
            <p className="text-green-100 mt-1">
              {language === 'fr'
                ? 'Étape 1/4 : Informations générales'
                : 'Step 1/4: General Information'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-8">
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Home className="w-4 h-4 inline mr-2" />
                  {language === 'fr' ? 'Logement' : 'Property'}
                  <span className="text-red-500 ml-1">*</span>
                </label>
                <select
                  required
                  value={formData.listing_id}
                  onChange={(e) => setFormData({ ...formData, listing_id: e.target.value, booking_id: '', lease_id: '', tenant_id: '', tenant_name: '', tenant_email: '' })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="">
                    {language === 'fr' ? 'Sélectionnez un logement' : 'Select a property'}
                  </option>
                  {listings.map(listing => (
                    <option key={listing.id} value={listing.id}>
                      {listing.title} - {listing.address}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <FileText className="w-4 h-4 inline mr-2" />
                  {language === 'fr' ? 'Type d\'état des lieux' : 'Inventory Type'}
                  <span className="text-red-500 ml-1">*</span>
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, inventory_type: 'check_in', check_in_inventory_id: '' })}
                    className={`p-4 border-2 rounded-lg transition-all ${
                      formData.inventory_type === 'check_in'
                        ? 'border-green-600 bg-green-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Check className={`w-6 h-6 mx-auto mb-2 ${
                      formData.inventory_type === 'check_in' ? 'text-green-600' : 'text-gray-400'
                    }`} />
                    <div className="font-medium text-gray-900">
                      {language === 'fr' ? 'État des lieux d\'entrée' : 'Check-in Inventory'}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      {language === 'fr' ? 'Début de location' : 'Start of lease'}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, inventory_type: 'check_out' })}
                    className={`p-4 border-2 rounded-lg transition-all ${
                      formData.inventory_type === 'check_out'
                        ? 'border-orange-600 bg-orange-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Check className={`w-6 h-6 mx-auto mb-2 ${
                      formData.inventory_type === 'check_out' ? 'text-orange-600' : 'text-gray-400'
                    }`} />
                    <div className="font-medium text-gray-900">
                      {language === 'fr' ? 'État des lieux de sortie' : 'Check-out Inventory'}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      {language === 'fr' ? 'Fin de location' : 'End of lease'}
                    </div>
                  </button>
                </div>
              </div>

              {formData.inventory_type === 'check_out' && checkInInventories.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {language === 'fr' ? 'Lier à l\'état des lieux d\'entrée (optionnel)' : 'Link to check-in inventory (optional)'}
                  </label>
                  <select
                    value={formData.check_in_inventory_id}
                    onChange={(e) => setFormData({ ...formData, check_in_inventory_id: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="">
                      {language === 'fr' ? 'Aucun' : 'None'}
                    </option>
                    {checkInInventories.map(inv => (
                      <option key={inv.id} value={inv.id}>
                        {new Date(inv.inspection_date).toLocaleDateString()} - {inv.tenant_name || 'Sans locataire'}
                      </option>
                    ))}
                  </select>
                  <p className="text-sm text-gray-600 mt-1">
                    {language === 'fr'
                      ? 'Permet de comparer l\'état d\'entrée avec l\'état de sortie'
                      : 'Allows comparison between check-in and check-out'}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="w-4 h-4 inline mr-2" />
                  {language === 'fr' ? 'Date d\'inspection' : 'Inspection Date'}
                  <span className="text-red-500 ml-1">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={formData.inspection_date}
                  onChange={(e) => setFormData({ ...formData, inspection_date: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              {formData.listing_id && bookings.length > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <label className="block text-sm font-medium text-green-900 mb-2">
                    <Check className="w-4 h-4 inline mr-2" />
                    {language === 'fr' ? 'Réservation confirmée' : 'Confirmed Booking'}
                    <span className="text-red-500 ml-1">*</span>
                  </label>
                  <select
                    required
                    value={formData.booking_id}
                    onChange={(e) => setFormData({ ...formData, booking_id: e.target.value, lease_id: '', tenant_id: '', tenant_name: '', tenant_email: '' })}
                    className="w-full px-4 py-3 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
                  >
                    <option value="">
                      {language === 'fr' ? 'Sélectionnez une réservation' : 'Select a booking'}
                    </option>
                    {bookings.map(booking => (
                      <option key={booking.id} value={booking.id}>
                        {booking.student.first_name} {booking.student.last_name} - {new Date(booking.start_date).toLocaleDateString()} → {new Date(booking.end_date).toLocaleDateString()}
                      </option>
                    ))}
                  </select>
                  <p className="text-sm text-green-700 mt-2">
                    {language === 'fr'
                      ? 'Les informations du locataire seront automatiquement remplies'
                      : 'Tenant information will be automatically filled'}
                  </p>
                </div>
              )}

              {formData.listing_id && leases.length > 0 && !formData.booking_id && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {language === 'fr' ? 'Bail associé (optionnel)' : 'Associated Lease (optional)'}
                  </label>
                  <select
                    value={formData.lease_id}
                    onChange={(e) => setFormData({ ...formData, lease_id: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="">
                      {language === 'fr' ? 'Aucun bail' : 'No lease'}
                    </option>
                    {leases.map(lease => (
                      <option key={lease.id} value={lease.id}>
                        {lease.tenant.first_name} {lease.tenant.last_name} - {new Date(lease.start_date).toLocaleDateString()} → {new Date(lease.end_date).toLocaleDateString()}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  {language === 'fr' ? 'Informations du locataire' : 'Tenant Information'}
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <User className="w-4 h-4 inline mr-2" />
                      {language === 'fr' ? 'Nom du locataire' : 'Tenant Name'}
                    </label>
                    <input
                      type="text"
                      value={formData.tenant_name}
                      onChange={(e) => setFormData({ ...formData, tenant_name: e.target.value })}
                      placeholder={language === 'fr' ? 'Prénom et nom' : 'First and last name'}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-50"
                      disabled={!!formData.booking_id || !!formData.lease_id}
                      readOnly={!!formData.booking_id || !!formData.lease_id}
                    />
                    {(formData.booking_id || formData.lease_id) && (
                      <p className="text-sm text-gray-500 mt-1">
                        {language === 'fr'
                          ? 'Rempli automatiquement depuis la réservation/bail'
                          : 'Auto-filled from booking/lease'}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Mail className="w-4 h-4 inline mr-2" />
                      {language === 'fr' ? 'Email du locataire' : 'Tenant Email'}
                    </label>
                    <input
                      type="email"
                      value={formData.tenant_email}
                      onChange={(e) => setFormData({ ...formData, tenant_email: e.target.value })}
                      placeholder="email@example.com"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-50"
                      disabled={!!formData.booking_id || !!formData.lease_id}
                      readOnly={!!formData.booking_id || !!formData.lease_id}
                    />
                    {(formData.booking_id || formData.lease_id) && (
                      <p className="text-sm text-gray-500 mt-1">
                        {language === 'fr'
                          ? 'Rempli automatiquement depuis la réservation/bail'
                          : 'Auto-filled from booking/lease'}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={() => navigate('/inventory')}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                {language === 'fr' ? 'Annuler' : 'Cancel'}
              </button>

              <button
                type="submit"
                disabled={loading || !formData.listing_id}
                className="inline-flex items-center px-8 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    {language === 'fr' ? 'Création...' : 'Creating...'}
                  </>
                ) : (
                  <>
                    {language === 'fr' ? 'Continuer' : 'Continue'}
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
