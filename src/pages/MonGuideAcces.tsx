import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { MapPin, Lock, KeyRound, Wifi, Car, Info, Key } from 'lucide-react';

function isYouTubeUrl(url: string): boolean {
  return /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)/.test(url);
}

function getYouTubeEmbedUrl(url: string): string {
  let videoId = '';
  if (url.includes('youtu.be/')) {
    videoId = url.split('youtu.be/')[1].split(/[?&]/)[0];
  } else if (url.includes('youtube.com/watch')) {
    videoId = new URL(url).searchParams.get('v') || '';
  } else if (url.includes('youtube.com/embed/')) {
    videoId = url.split('embed/')[1].split(/[?&]/)[0];
  } else if (url.includes('youtube.com/shorts/')) {
    videoId = url.split('shorts/')[1].split(/[?&]/)[0];
  }
  return `https://www.youtube.com/embed/${videoId}`;
}

type AccessCodeEntry = {
  type: string;
  code: string;
};

type GuideRow = {
  listing_id: string;
  listing_title: string;
  listing_address: string;
  listing_city: string;
  start_date: string;
  unlocked: boolean;
  access_type: string | null;
  access_instructions: string | null;
  wifi_ssid: string | null;
  wifi_password: string | null;
  parking_info: string | null;
  access_photos: string[] | null;
  access_video: string | null;
  additional_info: string | null;
  access_codes: AccessCodeEntry[] | null;
  unlock_date: string | null;
  valid_until_date: string | null;
};

// Guide d'accès de l'étudiant — verrouillé jusqu'à 24 h avant l'arrivée.
// Le déverrouillage est contrôlé côté serveur (fonction get_my_access_guide) :
// avant H-24, le serveur ne renvoie tout simplement pas les informations sensibles.
export default function MonGuideAcces() {
  const { bookingId } = useParams();
  const { profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [guide, setGuide] = useState<GuideRow | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'not_found'>('loading');

  useEffect(() => {
    if (authLoading) return;
    if (!profile) { navigate('/connexion'); return; }
    (async () => {
      const { data, error } = await supabase.rpc('get_my_access_guide', { p_booking_id: bookingId });
      if (error || !data || data.length === 0) { setState('not_found'); return; }
      setGuide(data[0] as GuideRow);
      setState('ok');
    })();
  }, [authLoading, profile, bookingId, navigate]);

  if (authLoading || state === 'loading') return <div className="p-12 text-center text-gray-500">Chargement…</div>;
  if (state === 'not_found' || !guide) return (
    <div className="p-12 text-center text-gray-500">Guide introuvable ou réservation non confirmée.</div>
  );

  const arrival = new Date(guide.start_date + 'T00:00:00');
  const unlockAt = guide.unlock_date
    ? new Date(guide.unlock_date + 'T00:00:00')
    : new Date(arrival.getTime() - 24 * 3600 * 1000);

  if (!guide.unlocked) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="bg-white rounded-2xl shadow p-10">
          <Lock className="w-12 h-12 mx-auto text-rose-500 mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Votre guide d'accès est prêt</h1>
          <p className="text-gray-600 mb-4">
            {guide.listing_title} — {guide.listing_address}, {guide.listing_city}
          </p>
          <p className="text-gray-700">
            Il se déverrouillera automatiquement le{' '}
            <strong>{unlockAt.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</strong>,
            {guide.unlock_date ? ' à la date choisie par le propriétaire.' : ` 24 heures avant votre arrivée du ${arrival.toLocaleDateString('fr-FR')}.`}
          </p>
          <p className="text-sm text-gray-400 mt-4">Codes d'accès, WiFi, stationnement, photos et vidéo vous attendent ici.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-1 flex items-center gap-2">
        <KeyRound className="w-7 h-7 text-rose-600" /> Votre guide d'accès
      </h1>
      <p className="text-gray-600 mb-6 flex items-center gap-1">
        <MapPin className="w-4 h-4" /> {guide.listing_title} — {guide.listing_address}, {guide.listing_city}
      </p>

      {guide.access_type && (
        <div className="bg-white rounded-xl shadow p-6 mb-4">
          <h2 className="font-semibold mb-2 flex items-center gap-2"><Key className="w-4 h-4" /> Type d'accès</h2>
          <p className="text-gray-800 font-medium">
            {guide.access_type === 'boite_a_cles' && '🔑 Boîte à clés'}
            {guide.access_type === 'remise_en_main_propre' && '👤 Remise en main propre'}
            {guide.access_type === 'autre' && '🏠 Autre'}
          </p>
        </div>
      )}

      {guide.access_codes && guide.access_codes.length > 0 && (
        <div className="bg-white rounded-xl shadow p-6 mb-4">
          <h2 className="font-semibold mb-3 flex items-center gap-2"><KeyRound className="w-4 h-4 text-amber-600" /> Codes d'accès</h2>
          <div className="space-y-2">
            {guide.access_codes.map((entry, index) => (
              <div key={index} className="flex items-center justify-between bg-amber-50 rounded-lg px-4 py-3">
                <span className="text-sm text-gray-600 capitalize">{entry.type === 'boite_a_cles' ? 'Boîte à clés' : entry.type === 'autre' ? 'Autre' : entry.type}</span>
                <span className="text-lg font-semibold text-gray-900 font-mono">{entry.code}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {guide.access_instructions && (
        <div className="bg-white rounded-xl shadow p-6 mb-4">
          <h2 className="font-semibold mb-2">Comment entrer</h2>
          <p className="whitespace-pre-wrap text-gray-800">{guide.access_instructions}</p>
        </div>
      )}

      {(guide.wifi_ssid || guide.wifi_password) && (
        <div className="bg-white rounded-xl shadow p-6 mb-4">
          <h2 className="font-semibold mb-2 flex items-center gap-2"><Wifi className="w-4 h-4" /> WiFi</h2>
          {guide.wifi_ssid && <p className="text-gray-800">Réseau : <strong>{guide.wifi_ssid}</strong></p>}
          {guide.wifi_password && <p className="text-gray-800">Mot de passe : <strong>{guide.wifi_password}</strong></p>}
        </div>
      )}

      {guide.parking_info && (
        <div className="bg-white rounded-xl shadow p-6 mb-4">
          <h2 className="font-semibold mb-2 flex items-center gap-2"><Car className="w-4 h-4" /> Stationnement</h2>
          <p className="whitespace-pre-wrap text-gray-800">{guide.parking_info}</p>
        </div>
      )}

      {guide.additional_info && (
        <div className="bg-white rounded-xl shadow p-6 mb-4">
          <h2 className="font-semibold mb-2 flex items-center gap-2"><Info className="w-4 h-4" /> Bon à savoir</h2>
          <p className="whitespace-pre-wrap text-gray-800">{guide.additional_info}</p>
        </div>
      )}

      {guide.access_photos && guide.access_photos.length > 0 && (
        <div className="mb-4">
          <h2 className="text-xl font-semibold mb-3">Photos de l'accès</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {guide.access_photos.map((url, i) => (
              <img key={i} src={url} alt={`Accès ${i + 1}`} className="w-full rounded-xl shadow" />
            ))}
          </div>
        </div>
      )}

      {guide.access_video && (
        <div className="mb-4">
          <h2 className="text-xl font-semibold mb-3">Vidéo de l'accès</h2>
          {isYouTubeUrl(guide.access_video) ? (
            <div className="relative w-full rounded-xl overflow-hidden shadow" style={{ paddingBottom: '56.25%' }}>
              <iframe
                src={getYouTubeEmbedUrl(guide.access_video)}
                title="Vidéo de l'accès"
                className="absolute inset-0 w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <video controls className="w-full rounded-xl shadow" src={guide.access_video} />
          )}
        </div>
      )}

      {!guide.access_instructions && !guide.wifi_ssid && !guide.access_video && (!guide.access_photos || guide.access_photos.length === 0) && (
        <div className="bg-white rounded-xl shadow p-6 text-gray-500">
          Le propriétaire n'a pas encore rempli le guide de ce logement. Contactez-le via la messagerie.
        </div>
      )}
    </div>
  );
}
