import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, BedDouble, Bath, Users, Pencil, Trash2, PlusCircle, Copy, Calendar, RefreshCw } from 'lucide-react';
import { supabase, Listing } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import CalendarManager from '../components/CalendarManager';
import ICalSyncManager from '../components/ICalSyncManager';

export default function MyListings() {
  const { t, language } = useLanguage();
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCalendar, setShowCalendar] = useState<string | null>(null);
  const [showICalSync, setShowICalSync] = useState<string | null>(null);

  useEffect(() => {
    loadListings();
  }, [profile]);

  const loadListings = async () => {
    if (!profile) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('listings')
      .select('*, images:listing_images(*)')
      .eq('landlord_id', profile.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setListings(data);
    }
    setLoading(false);
  };

  const deleteListing = async (listingId: string) => {
    if (!confirm(t('myListings.confirmDelete') || 'Are you sure?')) return;

    await supabase.from('listings').delete().eq('id', listingId);
    setListings((prev) => prev.filter((l) => l.id !== listingId));
  };

  const toggleActive = async (listingId: string, currentStatus: boolean) => {
    await supabase
      .from('listings')
      .update({ is_active: !currentStatus })
      .eq('id', listingId);

    setListings((prev) =>
      prev.map((l) =>
        l.id === listingId ? { ...l, is_active: !currentStatus } : l
      )
    );
  };

  const duplicateListing = async (listingId: string) => {
    if (!profile) return;

    if (!confirm(t('myListings.confirmDuplicate'))) return;

    try {
      const { data: originalListing, error: fetchError } = await supabase
        .from('listings')
        .select('*, images:listing_images(*)')
        .eq('id', listingId)
        .single();

      if (fetchError || !originalListing) {
        alert(language === 'fr' ? 'Erreur lors de la duplication' : 'Error during duplication');
        return;
      }

      const { images, id, created_at, ...listingData } = originalListing;

      const newListingData = {
        ...listingData,
        title: `${listingData.title} (${language === 'fr' ? 'Copie' : 'Copy'})`,
        is_active: false,
      };

      const { data: newListing, error: insertError } = await supabase
        .from('listings')
        .insert(newListingData)
        .select()
        .single();

      if (insertError || !newListing) {
        alert(language === 'fr' ? 'Erreur lors de la création' : 'Error during creation');
        return;
      }

      if (images && images.length > 0) {
        const imageRecords = images.map((img: any) => ({
          listing_id: newListing.id,
          image_url: img.image_url,
          display_order: img.display_order,
        }));

        await supabase.from('listing_images').insert(imageRecords);
      }

      loadListings();
      alert(t('myListings.duplicateSuccess'));
    } catch (err) {
      console.error('Duplication error:', err);
      alert(language === 'fr' ? 'Erreur lors de la duplication' : 'Error during duplication');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900">{t('myListings.title')}</h1>
          <button
            onClick={() => navigate('/ajouter-annonce')}
            className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <PlusCircle className="h-5 w-5" />
            <span>{t('myListings.add')}</span>
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : listings.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl">
            <p className="text-xl text-gray-600 mb-6">{t('myListings.empty')}</p>
            <button
              onClick={() => navigate('/ajouter-annonce')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              {t('myListings.add')}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {listings.map((listing) => (
              <div
                key={listing.id}
                className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow"
              >
                <div className="md:flex">
                  <div className="md:w-1/3 h-64 md:h-auto bg-gradient-to-br from-blue-400 to-blue-600">
                    {listing.images && listing.images.length > 0 ? (
                      <img
                        src={listing.images[0].image_url}
                        alt={listing.title}
                        className="w-full h-full object-cover cursor-pointer"
                        onClick={() => navigate(`/logement/${listing.id}`)}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <MapPin className="h-16 w-16 text-white opacity-50" />
                      </div>
                    )}
                  </div>

                  <div className="md:w-2/3 p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3
                            className="text-2xl font-bold text-gray-900 cursor-pointer hover:text-blue-600"
                            onClick={() => navigate(`/logement/${listing.id}`)}
                          >
                            {listing.title}
                          </h3>
                          <span
                            className={`px-3 py-1 rounded-full text-sm font-semibold ${
                              listing.is_active
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {listing.is_active ? (language === 'fr' ? 'Active' : 'Active') : (language === 'fr' ? 'Inactive' : 'Inactive')}
                          </span>
                        </div>

                        <div className="flex items-center text-gray-600 mb-4">
                          <MapPin className="h-4 w-4 mr-1" />
                          <span>
                            {listing.city}, {listing.postal_code}
                          </span>
                        </div>

                        <div className="flex items-center space-x-6 text-sm text-gray-600 mb-4">
                          <div className="flex items-center">
                            <BedDouble className="h-4 w-4 mr-1" />
                            <span>
                              {listing.bedrooms} {t('listing.bedrooms')}
                            </span>
                          </div>
                          <div className="flex items-center">
                            <Bath className="h-4 w-4 mr-1" />
                            <span>
                              {listing.bathrooms} {t('listing.bathrooms')}
                            </span>
                          </div>
                          <div className="flex items-center">
                            <Users className="h-4 w-4 mr-1" />
                            <span>
                              {listing.max_guests} {t('listing.guests')}
                            </span>
                          </div>
                        </div>

                        <div className="text-2xl font-bold text-blue-600">
                          {listing.price_per_month}€
                          <span className="text-sm text-gray-600">
                            /{t('listing.perMonth').split('/')[1]}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col space-y-2 ml-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowCalendar(listing.id);
                          }}
                          className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition"
                          title={language === 'fr' ? 'Calendrier' : 'Calendar'}
                        >
                          <Calendar className="h-5 w-5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowICalSync(listing.id);
                          }}
                          className="p-2 bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100 transition"
                          title={language === 'fr' ? 'Synchronisation iCal (Airbnb/Booking)' : 'iCal Sync (Airbnb/Booking)'}
                        >
                          <RefreshCw className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => navigate(`/modifier-annonce/${listing.id}`)}
                          className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition"
                          title={t('myListings.edit')}
                        >
                          <Pencil className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => duplicateListing(listing.id)}
                          className="p-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition"
                          title={language === 'fr' ? 'Dupliquer' : 'Duplicate'}
                        >
                          <Copy className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => toggleActive(listing.id, listing.is_active)}
                          className="p-2 bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 transition text-xs font-semibold"
                          title={listing.is_active ? (language === 'fr' ? 'Désactiver' : 'Deactivate') : (language === 'fr' ? 'Activer' : 'Activate')}
                        >
                          {listing.is_active ? 'OFF' : 'ON'}
                        </button>
                        <button
                          onClick={() => deleteListing(listing.id)}
                          className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition"
                          title={t('myListings.delete')}
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {showCalendar && (
          <CalendarManager
            listingId={showCalendar}
            listingTitle={listings.find(l => l.id === showCalendar)?.title || ''}
            onClose={() => setShowCalendar(null)}
          />
        )}

        {showICalSync && (
          <ICalSyncManager
            listingId={showICalSync}
            listingTitle={listings.find(l => l.id === showICalSync)?.title || ''}
            onClose={() => setShowICalSync(null)}
          />
        )}
      </div>
    </div>
  );
}
