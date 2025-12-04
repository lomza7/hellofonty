import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { MapPin } from 'lucide-react';

type ListingMapProps = {
  latitude: number;
  longitude: number;
  title: string;
  address: string;
};

export default function ListingMap({ latitude, longitude, title, address }: ListingMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mapContainerRef.current && !mapRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [latitude, longitude],
        zoom: 15,
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

      const customIcon = L.divIcon({
        className: 'custom-marker',
        html: `
          <div class="relative">
            <svg class="h-12 w-12 text-rose-600 drop-shadow-lg" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
          </div>
        `,
        iconSize: [48, 48],
        iconAnchor: [24, 48],
      });

      L.marker([latitude, longitude], {
        icon: customIcon,
      }).addTo(map);

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
        </div>
      </div>
      <p className="text-xs text-gray-500 mt-2">
        La localisation exacte sera communiquée après la réservation
      </p>
    </div>
  );
}
