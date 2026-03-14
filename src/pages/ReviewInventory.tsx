import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import {
  ArrowLeft, FileText, CheckCircle, Send, Pen
} from 'lucide-react';
import BackButton from '../components/BackButton';

interface InventoryData {
  id: string;
  inventory_type: string;
  status: string;
  inspection_date: string;
  tenant_name: string;
  tenant_email: string;
  general_notes: string;
  meter_readings: any;
  keys_info: any;
  listing: {
    title: string;
    address: string;
  };
  rooms: Array<{
    id: string;
    room_name: string;
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
}

export default function ReviewInventory() {
  const { id } = useParams();
  const { user } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [inventory, setInventory] = useState<InventoryData | null>(null);
  const [generalNotes, setGeneralNotes] = useState('');
  const [waterMeter, setWaterMeter] = useState('');
  const [gasMeter, setGasMeter] = useState('');
  const [elecMeter, setElecMeter] = useState('');
  const [keysCount, setKeysCount] = useState('');
  const [keysTypes, setKeysTypes] = useState('');
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [signing, setSigning] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    loadInventory();
  }, [id]);

  const loadInventory = async () => {
    if (!id || !user) return;

    try {
      const { data, error } = await supabase
        .from('property_inventories')
        .select(`
          *,
          listing:listings(title, address),
          rooms:inventory_rooms(
            *,
            elements:inventory_elements(
              *,
              photos:inventory_photos(*)
            )
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      if (data.landlord_id !== user.id) {
        alert('Unauthorized');
        navigate('/inventory');
        return;
      }

      setInventory(data);
      setGeneralNotes(data.general_notes || '');
      setWaterMeter(data.meter_readings?.water || '');
      setGasMeter(data.meter_readings?.gas || '');
      setElecMeter(data.meter_readings?.electricity || '');
      setKeysCount(data.keys_info?.count || '');
      setKeysTypes(data.keys_info?.types || '');
    } catch (error) {
      console.error('Error loading inventory:', error);
      alert('Error loading inventory');
      navigate('/inventory');
    } finally {
      setLoading(false);
    }
  };

  const saveAdditionalInfo = async () => {
    if (!id) return;

    try {
      const { error } = await supabase
        .from('property_inventories')
        .update({
          general_notes: generalNotes,
          meter_readings: { water: waterMeter, gas: gasMeter, electricity: elecMeter },
          keys_info: { count: keysCount, types: keysTypes }
        })
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error saving additional info:', error);
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleSign = async () => {
    if (!id || !user) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    setSigning(true);
    try {
      await saveAdditionalInfo();

      const signatureData = canvas.toDataURL();

      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, last_name, email')
        .eq('id', user.id)
        .single();

      const { error: signError } = await supabase
        .from('inventory_signatures')
        .insert({
          inventory_id: id,
          signer_type: 'landlord',
          signer_id: user.id,
          signer_name: `${profile?.first_name} ${profile?.last_name}`,
          signer_email: profile?.email || '',
          signature_data: signatureData,
          ip_address: 'unknown'
        });

      if (signError) throw signError;

      const { error: updateError } = await supabase
        .from('property_inventories')
        .update({ status: 'signed', completed_at: new Date().toISOString() })
        .eq('id', id);

      if (updateError) throw updateError;

      const { error: docError } = await supabase
        .from('landlord_documents')
        .insert({
          user_id: user.id,
          listing_id: inventory?.listing_id,
          document_type: 'inventory_copy',
          document_url: `inventory:${id}`,
          uploaded_at: new Date().toISOString()
        });

      if (docError) console.error('Error adding to documents:', docError);

      alert(language === 'fr' ? 'État des lieux signé avec succès !' : 'Inventory signed successfully!');
      navigate('/inventory');
    } catch (error) {
      console.error('Error signing inventory:', error);
      alert(language === 'fr' ? 'Erreur lors de la signature' : 'Error signing');
    } finally {
      setSigning(false);
    }
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
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <BackButton />

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-green-600 to-emerald-700 px-8 py-6">
            <h1 className="text-2xl font-bold text-white">
              {language === 'fr' ? 'Récapitulatif et finalisation' : 'Review and Finalize'}
            </h1>
            <p className="text-green-100 mt-1">
              {language === 'fr' ? 'Étape 4/4 : Vérifiez et signez' : 'Step 4/4: Review and Sign'}
            </p>
          </div>

          <div className="p-8 space-y-8">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                {language === 'fr' ? 'Informations générales' : 'General Information'}
              </h2>
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <p><span className="font-medium">{language === 'fr' ? 'Logement :' : 'Property:'}</span> {inventory.listing.title}</p>
                <p><span className="font-medium">{language === 'fr' ? 'Adresse :' : 'Address:'}</span> {inventory.listing.address}</p>
                <p><span className="font-medium">{language === 'fr' ? 'Type :' : 'Type:'}</span> {inventory.inventory_type === 'check_in' ? (language === 'fr' ? 'Entrée' : 'Check-in') : (language === 'fr' ? 'Sortie' : 'Check-out')}</p>
                <p><span className="font-medium">{language === 'fr' ? 'Date :' : 'Date:'}</span> {new Date(inventory.inspection_date).toLocaleDateString()}</p>
                {inventory.tenant_name && <p><span className="font-medium">{language === 'fr' ? 'Locataire :' : 'Tenant:'}</span> {inventory.tenant_name}</p>}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                {language === 'fr' ? 'Résumé de l\'inspection' : 'Inspection Summary'}
              </h3>
              <div className="space-y-3">
                {inventory.rooms.map((room: any) => {
                  const conditions = room.elements.reduce((acc: any, el: any) => {
                    if (el.condition_rating) {
                      acc[el.condition_rating] = (acc[el.condition_rating] || 0) + 1;
                    }
                    return acc;
                  }, {});

                  return (
                    <div key={room.id} className="bg-gray-50 p-4 rounded-lg">
                      <div className="font-medium text-gray-900 mb-2">{room.room_name}</div>
                      <div className="flex gap-4 text-sm">
                        {Object.entries(conditions).map(([rating, count]) => (
                          <span key={rating} className="text-gray-600">
                            {language === 'fr' ? {
                              excellent: 'Excellent',
                              good: 'Bon',
                              fair: 'Moyen',
                              poor: 'Mauvais',
                              damaged: 'Endommagé'
                            }[rating] || rating : rating}: {count as number}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                {language === 'fr' ? 'Informations complémentaires' : 'Additional Information'}
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {language === 'fr' ? 'Notes générales' : 'General Notes'}
                  </label>
                  <textarea
                    value={generalNotes}
                    onChange={(e) => setGeneralNotes(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    placeholder={language === 'fr' ? 'Observations générales...' : 'General observations...'}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {language === 'fr' ? 'Relevés de compteurs' : 'Meter Readings'}
                  </label>
                  <div className="grid grid-cols-3 gap-4">
                    <input
                      type="text"
                      value={waterMeter}
                      onChange={(e) => setWaterMeter(e.target.value)}
                      placeholder={language === 'fr' ? 'Eau' : 'Water'}
                      className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                    <input
                      type="text"
                      value={gasMeter}
                      onChange={(e) => setGasMeter(e.target.value)}
                      placeholder={language === 'fr' ? 'Gaz' : 'Gas'}
                      className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                    <input
                      type="text"
                      value={elecMeter}
                      onChange={(e) => setElecMeter(e.target.value)}
                      placeholder={language === 'fr' ? 'Électricité' : 'Electricity'}
                      className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {language === 'fr' ? 'Remise des clés' : 'Keys'}
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <input
                      type="text"
                      value={keysCount}
                      onChange={(e) => setKeysCount(e.target.value)}
                      placeholder={language === 'fr' ? 'Nombre de clés' : 'Number of keys'}
                      className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                    <input
                      type="text"
                      value={keysTypes}
                      onChange={(e) => setKeysTypes(e.target.value)}
                      placeholder={language === 'fr' ? 'Types' : 'Types'}
                      className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-6 border-t border-gray-200">
              <button
                onClick={() => navigate(`/inventory/${id}/edit`)}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                {language === 'fr' ? 'Modifier' : 'Edit'}
              </button>

              <button
                onClick={() => {
                  saveAdditionalInfo();
                  setShowSignatureModal(true);
                }}
                className="inline-flex items-center px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <Pen className="w-5 h-5 mr-2" />
                {language === 'fr' ? 'Signer' : 'Sign'}
              </button>
            </div>
          </div>
        </div>

        {showSignatureModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full">
              <div className="p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  {language === 'fr' ? 'Signature du propriétaire' : 'Landlord Signature'}
                </h3>
                <p className="text-gray-600 mb-4">
                  {language === 'fr'
                    ? 'Signez dans le cadre ci-dessous pour finaliser l\'état des lieux'
                    : 'Sign in the box below to finalize the inventory'}
                </p>

                <div className="border-2 border-gray-300 rounded-lg mb-4">
                  <canvas
                    ref={canvasRef}
                    width={600}
                    height={200}
                    className="w-full cursor-crosshair"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                  />
                </div>

                <div className="flex justify-between">
                  <button
                    onClick={clearSignature}
                    className="px-4 py-2 text-gray-600 hover:text-gray-900"
                  >
                    {language === 'fr' ? 'Effacer' : 'Clear'}
                  </button>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowSignatureModal(false)}
                      className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                    >
                      {language === 'fr' ? 'Annuler' : 'Cancel'}
                    </button>

                    <button
                      onClick={handleSign}
                      disabled={signing}
                      className="inline-flex items-center px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      <CheckCircle className="w-5 h-5 mr-2" />
                      {signing ? (language === 'fr' ? 'Signature...' : 'Signing...') : (language === 'fr' ? 'Confirmer' : 'Confirm')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
