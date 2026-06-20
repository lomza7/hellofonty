import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import { Home, Calendar, User, FileText, Download, ChevronDown, ChevronUp, Eye, Mail, CreditCard as Edit2 } from 'lucide-react';
import BackButton from '../components/BackButton';

interface ViewInventoryData {
  id: string;
  inventory_type: string;
  status: string;
  inspection_date: string;
  tenant_name: string;
  tenant_email: string;
  general_notes: string;
  meter_readings: any;
  keys_info: any;
  completed_at: string;
  listing: {
    title: string;
    address: string;
  };
  rooms: Array<{
    id: string;
    room_name: string;
    notes: string;
    elements: Array<{
      id: string;
      element_name: string;
      condition_rating: string;
      notes: string;
      photos: Array<{
        photo_url: string;
        caption: string;
      }>;
    }>;
  }>;
  signatures: Array<{
    signer_type: string;
    signer_name: string;
    signed_at: string;
  }>;
}

const CONDITION_COLORS = {
  excellent: { bg: 'bg-green-100', text: 'text-green-700' },
  good: { bg: 'bg-blue-100', text: 'text-blue-700' },
  fair: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  poor: { bg: 'bg-orange-100', text: 'text-orange-700' },
  damaged: { bg: 'bg-red-100', text: 'text-red-700' },
};

export default function ViewInventory() {
  const { id } = useParams();
  const { user } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [inventory, setInventory] = useState<ViewInventoryData | null>(null);
  const [expandedRooms, setExpandedRooms] = useState<Record<string, boolean>>({});
  const [showPhotos, setShowPhotos] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadInventory();
  }, [id]);

  const loadInventory = async () => {
    if (!id || !user) return;

    try {
      const { data: inventoryData, error: inventoryError } = await supabase
        .from('property_inventories')
        .select(`
          *,
          listing:listings(title, address)
        `)
        .eq('id', id)
        .single();

      if (inventoryError) throw inventoryError;

      if (inventoryData.landlord_id !== user.id && inventoryData.tenant_id !== user.id) {
        alert('Unauthorized');
        navigate('/inventory');
        return;
      }

      const { data: rooms, error: roomsError } = await supabase
        .from('inventory_rooms')
        .select(`
          *,
          elements:inventory_elements(
            *,
            photos:inventory_photos(*)
          )
        `)
        .eq('inventory_id', id)
        .order('order_index');

      if (roomsError) throw roomsError;

      const { data: signatures, error: signaturesError } = await supabase
        .from('inventory_signatures')
        .select('signer_type, signer_name, signed_at')
        .eq('inventory_id', id);

      if (signaturesError) throw signaturesError;

      setInventory({
        ...inventoryData,
        rooms: rooms || [],
        signatures: signatures || []
      });
    } catch (error) {
      console.error('Error loading inventory:', error);
      alert('Error loading inventory');
      navigate('/inventory');
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = async () => {
    if (!id) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert(language === 'fr' ? 'Session expirée' : 'Session expired');
        return;
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const url = `${supabaseUrl}/functions/v1/generate-inventory-pdf?id=${id}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }

      const htmlContent = await response.text();

      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();

        printWindow.onload = () => {
          setTimeout(() => {
            printWindow.print();
          }, 250);
        };
      }
    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert(language === 'fr' ? 'Erreur lors de la génération du PDF' : 'Error generating PDF');
    }
  };

  const toggleRoom = (roomId: string) => {
    setExpandedRooms(prev => ({
      ...prev,
      [roomId]: !prev[roomId]
    }));
  };

  const togglePhotos = (elementId: string) => {
    setShowPhotos(prev => ({
      ...prev,
      [elementId]: !prev[elementId]
    }));
  };

  const getConditionLabel = (rating: string) => {
    const labels = {
      excellent: language === 'fr' ? 'Excellent' : 'Excellent',
      good: language === 'fr' ? 'Bon' : 'Good',
      fair: language === 'fr' ? 'Moyen' : 'Fair',
      poor: language === 'fr' ? 'Mauvais' : 'Poor',
      damaged: language === 'fr' ? 'Endommagé' : 'Damaged',
    };
    return labels[rating as keyof typeof labels] || rating;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">
            {language === 'fr' ? 'Chargement...' : 'Loading...'}
          </p>
        </div>
      </div>
    );
  }

  if (!inventory) return null;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <BackButton />

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-green-600 to-emerald-700 px-8 py-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-white mb-2">
                  {inventory.listing.title}
                </h1>
                <p className="text-green-100">
                  {inventory.inventory_type === 'check_in'
                    ? (language === 'fr' ? 'État des lieux d\'entrée' : 'Check-in Inventory')
                    : (language === 'fr' ? 'État des lieux de sortie' : 'Check-out Inventory')}
                </p>
              </div>

              {inventory.status === 'signed' && (
                <button
                  onClick={downloadPDF}
                  className="inline-flex items-center px-6 py-3 bg-white text-green-700 rounded-lg font-medium hover:bg-green-50 transition-colors"
                >
                  <Download className="w-5 h-5 mr-2" />
                  {language === 'fr' ? 'Télécharger PDF' : 'Download PDF'}
                </button>
              )}
            </div>
          </div>

          <div className="p-8 space-y-8">
            <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                {language === 'fr' ? 'Informations générales' : 'General Information'}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center text-gray-700">
                  <Home className="w-5 h-5 mr-3 text-green-600" />
                  <div>
                    <div className="text-sm text-gray-500">
                      {language === 'fr' ? 'Adresse' : 'Address'}
                    </div>
                    <div className="font-medium">{inventory.listing.address}</div>
                  </div>
                </div>

                <div className="flex items-center text-gray-700">
                  <Calendar className="w-5 h-5 mr-3 text-green-600" />
                  <div>
                    <div className="text-sm text-gray-500">
                      {language === 'fr' ? 'Date d\'inspection' : 'Inspection Date'}
                    </div>
                    <div className="font-medium">
                      {new Date(inventory.inspection_date).toLocaleDateString(
                        language === 'fr' ? 'fr-FR' : 'en-US',
                        { year: 'numeric', month: 'long', day: 'numeric' }
                      )}
                    </div>
                  </div>
                </div>

                {inventory.tenant_name && (
                  <div className="flex items-center text-gray-700">
                    <User className="w-5 h-5 mr-3 text-green-600" />
                    <div>
                      <div className="text-sm text-gray-500">
                        {language === 'fr' ? 'Locataire' : 'Tenant'}
                      </div>
                      <div className="font-medium">{inventory.tenant_name}</div>
                    </div>
                  </div>
                )}

                {inventory.tenant_email && (
                  <div className="flex items-center text-gray-700">
                    <Mail className="w-5 h-5 mr-3 text-green-600" />
                    <div>
                      <div className="text-sm text-gray-500">Email</div>
                      <div className="font-medium">{inventory.tenant_email}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {inventory.general_notes && (
              <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  {language === 'fr' ? 'Notes générales' : 'General Notes'}
                </h3>
                <p className="text-gray-700">{inventory.general_notes}</p>
              </div>
            )}

            {inventory.meter_readings && (inventory.meter_readings.water || inventory.meter_readings.gas || inventory.meter_readings.electricity) && (
              <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  {language === 'fr' ? 'Relevés de compteurs' : 'Meter Readings'}
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  {inventory.meter_readings.water && (
                    <div className="bg-white p-4 rounded-lg text-center">
                      <div className="text-sm text-gray-600 mb-1">
                        {language === 'fr' ? 'Eau' : 'Water'}
                      </div>
                      <div className="text-xl font-bold text-green-600">
                        {inventory.meter_readings.water}
                      </div>
                    </div>
                  )}
                  {inventory.meter_readings.gas && (
                    <div className="bg-white p-4 rounded-lg text-center">
                      <div className="text-sm text-gray-600 mb-1">
                        {language === 'fr' ? 'Gaz' : 'Gas'}
                      </div>
                      <div className="text-xl font-bold text-green-600">
                        {inventory.meter_readings.gas}
                      </div>
                    </div>
                  )}
                  {inventory.meter_readings.electricity && (
                    <div className="bg-white p-4 rounded-lg text-center">
                      <div className="text-sm text-gray-600 mb-1">
                        {language === 'fr' ? 'Électricité' : 'Electricity'}
                      </div>
                      <div className="text-xl font-bold text-green-600">
                        {inventory.meter_readings.electricity}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {inventory.rooms && inventory.rooms.length > 0 ? (
              <div>
                <h2 className="text-2xl font-semibold text-gray-900 mb-6">
                  {language === 'fr' ? 'Inspection détaillée' : 'Detailed Inspection'}
                </h2>

                <div className="space-y-4">
                  {inventory.rooms.map((room) => (
                  <div key={room.id} className="border border-gray-200 rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleRoom(room.id)}
                      className="w-full bg-gray-50 px-6 py-4 flex items-center justify-between hover:bg-gray-100 transition-colors"
                    >
                      <h3 className="text-lg font-semibold text-gray-900">{room.room_name}</h3>
                      {expandedRooms[room.id] ? (
                        <ChevronUp className="w-5 h-5 text-gray-600" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-600" />
                      )}
                    </button>

                    {expandedRooms[room.id] && (
                      <div className="p-6 space-y-4">
                        {room.notes && (
                          <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-500">
                            <p className="text-gray-700">{room.notes}</p>
                          </div>
                        )}

                        {room.elements.map((element) => (
                          <div key={element.id} className="bg-gray-50 p-4 rounded-lg">
                            <div className="flex items-start justify-between mb-3">
                              <h4 className="font-medium text-gray-900">{element.element_name}</h4>
                              {element.condition_rating && (
                                <span
                                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                                    CONDITION_COLORS[element.condition_rating as keyof typeof CONDITION_COLORS]?.bg
                                  } ${
                                    CONDITION_COLORS[element.condition_rating as keyof typeof CONDITION_COLORS]?.text
                                  }`}
                                >
                                  {getConditionLabel(element.condition_rating)}
                                </span>
                              )}
                            </div>

                            {element.notes && (
                              <p className="text-gray-600 mb-3 italic">{element.notes}</p>
                            )}

                            {element.photos.length > 0 && (
                              <div>
                                <button
                                  onClick={() => togglePhotos(element.id)}
                                  className="inline-flex items-center text-green-600 hover:text-green-700 text-sm font-medium mb-2"
                                >
                                  <Eye className="w-4 h-4 mr-1" />
                                  {showPhotos[element.id]
                                    ? (language === 'fr' ? 'Masquer les photos' : 'Hide photos')
                                    : `${language === 'fr' ? 'Voir les photos' : 'View photos'} (${element.photos.length})`}
                                </button>

                                {showPhotos[element.id] && (
                                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {element.photos.map((photo, index) => (
                                      <div key={index} className="relative group">
                                        <img
                                          src={photo.photo_url}
                                          alt={photo.caption || ''}
                                          className="w-full h-48 object-cover rounded-lg"
                                        />
                                        {photo.caption && (
                                          <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-75 text-white text-xs p-2 rounded-b-lg">
                                            {photo.caption}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 text-center">
                <FileText className="w-12 h-12 text-yellow-600 mx-auto mb-3" />
                <p className="text-gray-700 mb-2">
                  {language === 'fr'
                    ? 'Aucune pièce n\'a encore été ajoutée à cet état des lieux.'
                    : 'No rooms have been added to this inventory yet.'}
                </p>
                {inventory.status === 'draft' && (
                  <button
                    onClick={() => navigate(`/inventory/${inventory.id}/edit`)}
                    className="mt-4 inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    <Edit2 className="w-4 h-4 mr-2" />
                    {language === 'fr' ? 'Modifier l\'état des lieux' : 'Edit inventory'}
                  </button>
                )}
              </div>
            )}

            {inventory.signatures && inventory.signatures.length > 0 && (
              <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  {language === 'fr' ? 'Signatures' : 'Signatures'}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {inventory.signatures.map((signature, index) => (
                    <div key={index} className="bg-white p-4 rounded-lg border border-gray-200">
                      <div className="text-sm font-medium text-gray-900 mb-2">
                        {signature.signer_type === 'landlord'
                          ? (language === 'fr' ? 'Propriétaire' : 'Landlord')
                          : (language === 'fr' ? 'Locataire' : 'Tenant')}
                      </div>
                      <div className="text-gray-700 mb-1">{signature.signer_name}</div>
                      <div className="text-xs text-gray-500">
                        {language === 'fr' ? 'Signé le' : 'Signed on'}{' '}
                        {new Date(signature.signed_at).toLocaleDateString(
                          language === 'fr' ? 'fr-FR' : 'en-US',
                          { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
