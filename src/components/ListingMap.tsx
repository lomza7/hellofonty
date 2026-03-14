import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { MapPin } from 'lucide-react';

const INSEAD_LAT = 48.405527;
const INSEAD_LNG = 2.686894;

type ListingMapProps = {
  latitude: number;
  longitude: number;
  title: string;
  address: string;
};

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

export default function ListingMap({ latitude, longitude, title, address }: ListingMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const distKm = haversineKm(latitude, longitude, INSEAD_LAT, INSEAD_LNG);
  const distLabel = distKm < 1 ? `${Math.round(distKm * 1000)} m` : `${distKm.toFixed(1)} km`;

  useEffect(() => {
    if (mapContainerRef.current && !mapRef.current) {
      const midLat = (latitude + INSEAD_LAT) / 2;
      const midLng = (longitude + INSEAD_LNG) / 2;

      const map = L.map(mapContainerRef.current, {
        center: [midLat, midLng],
        zoom: 13,
        zoomControl: true,
        scrollWheelZoom: false,
        dragging: true,
        touchZoom: true,
        doubleClickZoom: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      const listingIcon = L.divIcon({
        className: 'custom-marker',
        html: `
          <div class="relative">
            <svg class="h-12 w-12 drop-shadow-lg" style="color:#e11d48" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
          </div>
        `,
        iconSize: [48, 48],
        iconAnchor: [24, 48],
      });

      const inseadIcon = L.divIcon({
        className: 'custom-marker-insead',
        html: `
          <div style="display:flex;flex-direction:column;align-items:center;">
            <div style="background:#1e3a5f;color:white;font-size:10px;font-weight:700;padding:3px 7px;border-radius:6px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.3);letter-spacing:0.05em;">INSEAD</div>
            <svg width="14" height="8" viewBox="0 0 14 8" fill="none" style="margin-top:-1px"><path d="M7 8L0 0h14L7 8z" fill="#1e3a5f"/></svg>
          </div>
        `,
        iconSize: [60, 36],
        iconAnchor: [30, 36],
      });

      L.marker([latitude, longitude], { icon: listingIcon }).addTo(map);
      L.marker([INSEAD_LAT, INSEAD_LNG], { icon: inseadIcon }).addTo(map);

      L.polyline(
        [[latitude, longitude], [INSEAD_LAT, INSEAD_LNG]],
        {
          color: '#1e3a5f',
          weight: 3,
          opacity: 0.75,
          dashArray: '8, 6',
        }
      ).addTo(map);

      const bounds = L.latLngBounds(
        [latitude, longitude],
        [INSEAD_LAT, INSEAD_LNG]
      );
      map.fitBounds(bounds, { padding: [60, 60] });

      mapRef.current = map;
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [latitude, longitude]);

  return (
    <div className="mb-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Localisation</h2>
      <div className="relative h-[400px] rounded-2xl overflow-hidden shadow-lg border border-gray-200">
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg px-4 py-3 z-[1000] max-w-[calc(100%-2rem)]">
          <div className="flex items-start space-x-2">
            <MapPin className="h-5 w-5 text-rose-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-gray-900 text-sm">{title}</p>
              <p className="text-xs text-gray-600 mt-0.5">{address}</p>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-2">
            <span className="text-xs font-bold text-[#1e3a5f] bg-[#1e3a5f]/10 px-2 py-0.5 rounded-full">INSEAD</span>
            <span className="text-xs text-gray-600">{distLabel} du campus</span>
          </div>
        </div>
      </div>
      <p className="text-xs text-gray-500 mt-2">
        La localisation exacte sera communiquée après la réservation
      </p>
    </div>
  );
}
