import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import {
  ArrowLeft, ArrowRight, Save, Plus, Trash2, Camera,
  ChevronDown, ChevronUp, Edit2, Check, X
} from 'lucide-react';

interface Room {
  id?: string;
  room_type: string;
  room_name: string;
  order_index: number;
  notes?: string;
  elements: Element[];
  isExpanded?: boolean;
}

interface Element {
  id?: string;
  element_category: string;
  element_name: string;
  condition_rating?: 'excellent' | 'good' | 'fair' | 'poor' | 'damaged';
  notes?: string;
  order_index: number;
  photos: Photo[];
}

interface Photo {
  id?: string;
  photo_url: string;
  caption?: string;
  order_index: number;
  file?: File;
}

interface RoomTemplate {
  room_type: string;
  display_name_fr: string;
  display_name_en: string;
}

interface ElementTemplate {
  element_category: string;
  element_name_fr: string;
  element_name_en: string;
  order_index: number;
}

const CONDITION_COLORS = {
  excellent: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300' },
  good: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
  fair: { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-300' },
  poor: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300' },
  damaged: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' },
};

export default function EditInventory() {
  const { id } = useParams();
  const { user } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [inventory, setInventory] = useState<any>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomTemplates, setRoomTemplates] = useState<RoomTemplate[]>([]);
  const [elementTemplates, setElementTemplates] = useState<Record<string, ElementTemplate[]>>({});
  const [step, setStep] = useState<'rooms' | 'inspection'>('rooms');
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [newRoomType, setNewRoomType] = useState('');
  const [newRoomName, setNewRoomName] = useState('');

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    if (!id || !user) return;

    try {
      const [inventoryRes, roomsRes, roomTemplatesRes, elementTemplatesRes] = await Promise.all([
        supabase
          .from('property_inventories')
          .select('*, listing:listings(title, address)')
          .eq('id', id)
          .single(),
        supabase
          .from('inventory_rooms')
          .select(`
            *,
            elements:inventory_elements(
              *,
              photos:inventory_photos(*)
            )
          `)
          .eq('inventory_id', id)
          .order('order_index'),
        supabase
          .from('default_room_templates')
          .select('*')
          .order('order_index'),
        supabase
          .from('default_element_templates')
          .select('*')
          .order('order_index')
      ]);

      if (inventoryRes.error) throw inventoryRes.error;
      if (inventoryRes.data.landlord_id !== user.id) {
        alert('Unauthorized');
        navigate('/inventory');
        return;
      }

      setInventory(inventoryRes.data);

      const loadedRooms = (roomsRes.data || []).map((room: any) => ({
        ...room,
        elements: (room.elements || []).map((el: any) => ({
          ...el,
          photos: el.photos || []
        })),
        isExpanded: false
      }));
      setRooms(loadedRooms);

      setRoomTemplates(roomTemplatesRes.data || []);

      const templatesGrouped: Record<string, ElementTemplate[]> = {};
      (elementTemplatesRes.data || []).forEach((template: any) => {
        if (!templatesGrouped[template.room_type]) {
          templatesGrouped[template.room_type] = [];
        }
        templatesGrouped[template.room_type].push(template);
      });
      setElementTemplates(templatesGrouped);

      if (loadedRooms.length > 0) {
        setStep('inspection');
      }
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Error loading inventory');
      navigate('/inventory');
    } finally {
      setLoading(false);
    }
  };

  const addRoom = () => {
    if (!newRoomType) return;

    const template = roomTemplates.find(t => t.room_type === newRoomType);
    const defaultName = template ? (language === 'fr' ? template.display_name_fr : template.display_name_en) : newRoomName;

    const elements = (elementTemplates[newRoomType] || []).map((template, index) => ({
      element_category: template.element_category,
      element_name: language === 'fr' ? template.element_name_fr : template.element_name_en,
      order_index: index,
      photos: []
    }));

    const newRoom: Room = {
      room_type: newRoomType,
      room_name: newRoomName || defaultName,
      order_index: rooms.length,
      elements,
      isExpanded: false
    };

    setRooms([...rooms, newRoom]);
    setNewRoomType('');
    setNewRoomName('');
    setShowAddRoom(false);
  };

  const deleteRoom = (index: number) => {
    if (confirm(language === 'fr' ? 'Supprimer cette pièce ?' : 'Delete this room?')) {
      setRooms(rooms.filter((_, i) => i !== index));
    }
  };

  const toggleRoomExpanded = (index: number) => {
    setRooms(rooms.map((room, i) =>
      i === index ? { ...room, isExpanded: !room.isExpanded } : room
    ));
  };

  const updateElement = (roomIndex: number, elementIndex: number, updates: Partial<Element>) => {
    const newRooms = [...rooms];
    newRooms[roomIndex].elements[elementIndex] = {
      ...newRooms[roomIndex].elements[elementIndex],
      ...updates
    };
    setRooms(newRooms);
  };

  const addElementPhoto = (roomIndex: number, elementIndex: number, file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const newPhoto: Photo = {
        photo_url: reader.result as string,
        order_index: rooms[roomIndex].elements[elementIndex].photos.length,
        file
      };

      const newRooms = [...rooms];
      newRooms[roomIndex].elements[elementIndex].photos.push(newPhoto);
      setRooms(newRooms);
    };
    reader.readAsDataURL(file);
  };

  const deleteElementPhoto = (roomIndex: number, elementIndex: number, photoIndex: number) => {
    const newRooms = [...rooms];
    newRooms[roomIndex].elements[elementIndex].photos =
      newRooms[roomIndex].elements[elementIndex].photos.filter((_, i) => i !== photoIndex);
    setRooms(newRooms);
  };

  const saveInventory = async () => {
    if (!id || !user) return;

    setSaving(true);
    try {
      for (const [roomIndex, room] of rooms.entries()) {
        let roomId = room.id;

        if (!roomId) {
          const { data, error } = await supabase
            .from('inventory_rooms')
            .insert({
              inventory_id: id,
              room_type: room.room_type,
              room_name: room.room_name,
              order_index: roomIndex,
              notes: room.notes
            })
            .select()
            .single();

          if (error) throw error;
          roomId = data.id;
        } else {
          const { error } = await supabase
            .from('inventory_rooms')
            .update({
              room_name: room.room_name,
              order_index: roomIndex,
              notes: room.notes
            })
            .eq('id', roomId);

          if (error) throw error;
        }

        for (const [elementIndex, element] of room.elements.entries()) {
          let elementId = element.id;

          if (!elementId) {
            const { data, error } = await supabase
              .from('inventory_elements')
              .insert({
                room_id: roomId,
                element_category: element.element_category,
                element_name: element.element_name,
                condition_rating: element.condition_rating,
                notes: element.notes,
                order_index: elementIndex
              })
              .select()
              .single();

            if (error) throw error;
            elementId = data.id;
          } else {
            const { error } = await supabase
              .from('inventory_elements')
              .update({
                condition_rating: element.condition_rating,
                notes: element.notes,
                order_index: elementIndex
              })
              .eq('id', elementId);

            if (error) throw error;
          }

          for (const [photoIndex, photo] of element.photos.entries()) {
            if (!photo.id && photo.file) {
              const fileExt = photo.file.name.split('.').pop();
              const fileName = `${id}/${roomId}/${elementId}/${Date.now()}.${fileExt}`;

              const { error: uploadError } = await supabase.storage
                .from('inventory-photos')
                .upload(fileName, photo.file);

              if (uploadError) throw uploadError;

              const { data: { publicUrl } } = supabase.storage
                .from('inventory-photos')
                .getPublicUrl(fileName);

              const { error: insertError } = await supabase
                .from('inventory_photos')
                .insert({
                  element_id: elementId,
                  photo_url: publicUrl,
                  caption: photo.caption,
                  order_index: photoIndex
                });

              if (insertError) throw insertError;
            }
          }
        }
      }

      await loadData();
      alert(language === 'fr' ? 'Sauvegardé avec succès' : 'Saved successfully');
    } catch (error) {
      console.error('Error saving inventory:', error);
      alert(language === 'fr' ? 'Erreur lors de la sauvegarde' : 'Error saving');
    } finally {
      setSaving(false);
    }
  };

  const goToReview = () => {
    navigate(`/inventory/${id}/review`);
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

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
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
              {inventory?.listing?.title}
            </h1>
            <p className="text-green-100 mt-1">
              {step === 'rooms'
                ? (language === 'fr' ? 'Étape 2/4 : Configuration des pièces' : 'Step 2/4: Room Configuration')
                : (language === 'fr' ? 'Étape 3/4 : Inspection détaillée' : 'Step 3/4: Detailed Inspection')}
            </p>
          </div>

          <div className="p-8">
            {step === 'rooms' ? (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold text-gray-900">
                    {language === 'fr' ? 'Pièces à inspecter' : 'Rooms to Inspect'}
                  </h2>
                  <button
                    onClick={() => setShowAddRoom(true)}
                    className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <Plus className="w-5 h-5 mr-2" />
                    {language === 'fr' ? 'Ajouter une pièce' : 'Add Room'}
                  </button>
                </div>

                {showAddRoom && (
                  <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                    <h3 className="font-medium text-gray-900 mb-4">
                      {language === 'fr' ? 'Nouvelle pièce' : 'New Room'}
                    </h3>
                    <div className="space-y-4">
                      <select
                        value={newRoomType}
                        onChange={(e) => {
                          setNewRoomType(e.target.value);
                          const template = roomTemplates.find(t => t.room_type === e.target.value);
                          if (template) {
                            setNewRoomName(language === 'fr' ? template.display_name_fr : template.display_name_en);
                          }
                        }}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      >
                        <option value="">
                          {language === 'fr' ? 'Sélectionner un type' : 'Select a type'}
                        </option>
                        {roomTemplates.map(template => (
                          <option key={template.room_type} value={template.room_type}>
                            {language === 'fr' ? template.display_name_fr : template.display_name_en}
                          </option>
                        ))}
                      </select>

                      <input
                        type="text"
                        value={newRoomName}
                        onChange={(e) => setNewRoomName(e.target.value)}
                        placeholder={language === 'fr' ? 'Nom de la pièce' : 'Room name'}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      />

                      <div className="flex gap-2">
                        <button
                          onClick={addRoom}
                          disabled={!newRoomType}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                        >
                          {language === 'fr' ? 'Ajouter' : 'Add'}
                        </button>
                        <button
                          onClick={() => {
                            setShowAddRoom(false);
                            setNewRoomType('');
                            setNewRoomName('');
                          }}
                          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                        >
                          {language === 'fr' ? 'Annuler' : 'Cancel'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  {rooms.map((room, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className="bg-gray-50 px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-green-700 font-semibold">
                            {index + 1}
                          </div>
                          <span className="font-medium text-gray-900">{room.room_name}</span>
                          <span className="text-sm text-gray-500">
                            ({room.elements.length} {language === 'fr' ? 'éléments' : 'elements'})
                          </span>
                        </div>
                        <button
                          onClick={() => deleteRoom(index)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {rooms.length === 0 && !showAddRoom && (
                  <div className="text-center py-12 text-gray-500">
                    {language === 'fr'
                      ? 'Aucune pièce ajoutée. Cliquez sur "Ajouter une pièce" pour commencer.'
                      : 'No rooms added. Click "Add Room" to get started.'}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                {rooms.map((room, roomIndex) => (
                  <div key={roomIndex} className="border border-gray-200 rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleRoomExpanded(roomIndex)}
                      className="w-full bg-gray-50 px-6 py-4 flex items-center justify-between hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-green-700 font-semibold">
                          {roomIndex + 1}
                        </div>
                        <span className="font-medium text-gray-900 text-lg">{room.room_name}</span>
                      </div>
                      {room.isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>

                    {room.isExpanded && (
                      <div className="p-6 space-y-6">
                        {room.elements.map((element, elementIndex) => (
                          <div key={elementIndex} className="bg-gray-50 p-4 rounded-lg">
                            <h4 className="font-medium text-gray-900 mb-3">{element.element_name}</h4>

                            <div className="space-y-3">
                              <div>
                                <label className="block text-sm text-gray-700 mb-2">
                                  {language === 'fr' ? 'État' : 'Condition'}
                                </label>
                                <div className="flex gap-2 flex-wrap">
                                  {(['excellent', 'good', 'fair', 'poor', 'damaged'] as const).map(condition => (
                                    <button
                                      key={condition}
                                      onClick={() => updateElement(roomIndex, elementIndex, { condition_rating: condition })}
                                      className={`px-4 py-2 rounded-lg border-2 transition-all ${
                                        element.condition_rating === condition
                                          ? `${CONDITION_COLORS[condition].bg} ${CONDITION_COLORS[condition].text} ${CONDITION_COLORS[condition].border}`
                                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                                      }`}
                                    >
                                      {language === 'fr' ? {
                                        excellent: 'Excellent',
                                        good: 'Bon',
                                        fair: 'Moyen',
                                        poor: 'Mauvais',
                                        damaged: 'Endommagé'
                                      }[condition] : condition.charAt(0).toUpperCase() + condition.slice(1)}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div>
                                <label className="block text-sm text-gray-700 mb-2">
                                  {language === 'fr' ? 'Commentaires' : 'Notes'}
                                </label>
                                <textarea
                                  value={element.notes || ''}
                                  onChange={(e) => updateElement(roomIndex, elementIndex, { notes: e.target.value })}
                                  rows={2}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                                  placeholder={language === 'fr' ? 'Observations...' : 'Observations...'}
                                />
                              </div>

                              <div>
                                <label className="block text-sm text-gray-700 mb-2">
                                  {language === 'fr' ? 'Photos' : 'Photos'}
                                </label>
                                <div className="flex gap-2 flex-wrap">
                                  {element.photos.map((photo, photoIndex) => (
                                    <div key={photoIndex} className="relative group">
                                      <img
                                        src={photo.photo_url}
                                        alt=""
                                        className="w-24 h-24 object-cover rounded-lg"
                                      />
                                      <button
                                        onClick={() => deleteElementPhoto(roomIndex, elementIndex, photoIndex)}
                                        className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                      >
                                        <X className="w-4 h-4" />
                                      </button>
                                    </div>
                                  ))}
                                  <label className="w-24 h-24 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-green-500 transition-colors">
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      onChange={(e) => {
                                        if (e.target.files?.[0]) {
                                          addElementPhoto(roomIndex, elementIndex, e.target.files[0]);
                                        }
                                      }}
                                    />
                                    <Camera className="w-8 h-8 text-gray-400" />
                                  </label>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200">
              {step === 'inspection' && (
                <button
                  onClick={() => setStep('rooms')}
                  className="inline-flex items-center px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  <ArrowLeft className="w-5 h-5 mr-2" />
                  {language === 'fr' ? 'Retour' : 'Back'}
                </button>
              )}

              {step === 'rooms' && (
                <button
                  onClick={() => navigate('/inventory')}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  {language === 'fr' ? 'Annuler' : 'Cancel'}
                </button>
              )}

              <div className="flex gap-3 ml-auto">
                <button
                  onClick={saveInventory}
                  disabled={saving}
                  className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  <Save className="w-5 h-5 mr-2" />
                  {saving ? (language === 'fr' ? 'Sauvegarde...' : 'Saving...') : (language === 'fr' ? 'Sauvegarder' : 'Save')}
                </button>

                {step === 'rooms' ? (
                  <button
                    onClick={() => setStep('inspection')}
                    disabled={rooms.length === 0}
                    className="inline-flex items-center px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {language === 'fr' ? 'Continuer' : 'Continue'}
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </button>
                ) : (
                  <button
                    onClick={goToReview}
                    className="inline-flex items-center px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    {language === 'fr' ? 'Finaliser' : 'Finalize'}
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
