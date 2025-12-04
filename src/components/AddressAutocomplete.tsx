import { useState, useRef, useEffect } from 'react';
import { MapPin, X, Loader2 } from 'lucide-react';

type AddressAutocompleteProps = {
  value: string;
  onChange: (value: string, coordinates?: { latitude: number; longitude: number }) => void;
  placeholder?: string;
  required?: boolean;
  label?: string;
};

type NominatimResult = {
  display_name: string;
  lat: string;
  lon: string;
  address: {
    house_number?: string;
    road?: string;
    city?: string;
    postcode?: string;
  };
};

export default function AddressAutocomplete({
  value,
  onChange,
  placeholder = '12 Rue de la Paix',
  required = false,
  label = 'Adresse complète'
}: AddressAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (value && value.length >= 3) {
      setIsLoading(true);
      debounceTimerRef.current = setTimeout(() => {
        searchAddress(value);
      }, 500);
    } else {
      setSuggestions([]);
      setIsOpen(false);
      setIsLoading(false);
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [value]);

  const searchAddress = async (query: string) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?` +
        new URLSearchParams({
          q: `${query}, Fontainebleau, France`,
          format: 'json',
          addressdetails: '1',
          limit: '8',
          countrycodes: 'fr',
        }),
        {
          headers: {
            'Accept-Language': 'fr',
          },
        }
      );

      if (response.ok) {
        const data: NominatimResult[] = await response.json();
        setSuggestions(data);
        setIsOpen(data.length > 0);
      }
    } catch (error) {
      console.error('Error searching address:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (result: NominatimResult) => {
    const coordinates = {
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon),
    };

    let displayAddress = '';
    if (result.address.house_number && result.address.road) {
      displayAddress = `${result.address.house_number} ${result.address.road}`;
    } else if (result.address.road) {
      displayAddress = result.address.road;
    } else {
      const parts = result.display_name.split(',');
      displayAddress = parts[0];
    }

    onChange(displayAddress, coordinates);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
          handleSelect(suggestions[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
    }
  };

  const handleClear = () => {
    onChange('');
    inputRef.current?.focus();
  };

  return (
    <div className="relative">
      <label className="block text-sm font-semibold text-gray-900 mb-2 sm:mb-3">
        {label}
      </label>
      <div className="relative">
        <MapPin className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (value && suggestions.length > 0) {
              setIsOpen(true);
            }
          }}
          placeholder={placeholder}
          className="w-full pl-10 sm:pl-12 pr-10 sm:pr-12 py-3 sm:py-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-400 focus:border-transparent transition text-base sm:text-lg"
          autoComplete="off"
        />
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full transition"
          >
            <X className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
          </button>
        )}
      </div>

      {isLoading && (
        <div className="absolute z-50 w-full mt-2 bg-white border-2 border-gray-200 rounded-xl shadow-2xl p-4">
          <div className="flex items-center justify-center gap-2 text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Recherche d'adresses...</span>
          </div>
        </div>
      )}

      {isOpen && suggestions.length > 0 && !isLoading && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-2 bg-white border-2 border-gray-200 rounded-xl shadow-2xl max-h-64 overflow-y-auto"
        >
          <div className="p-2">
            <div className="text-xs font-semibold text-gray-500 px-3 py-2 uppercase tracking-wide">
              Adresses trouvées
            </div>
            {suggestions.map((result, index) => {
              let displayAddress = '';
              if (result.address.house_number && result.address.road) {
                displayAddress = `${result.address.house_number} ${result.address.road}`;
              } else if (result.address.road) {
                displayAddress = result.address.road;
              } else {
                const parts = result.display_name.split(',');
                displayAddress = parts[0];
              }

              const cityInfo = result.address.city || 'Fontainebleau';
              const postcodeInfo = result.address.postcode || '77300';

              return (
                <button
                  key={`${result.lat}-${result.lon}`}
                  type="button"
                  onClick={() => handleSelect(result)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={`w-full text-left px-3 py-3 rounded-lg transition-colors flex items-center gap-2 ${
                    highlightedIndex === index
                      ? 'bg-rose-50 text-rose-700'
                      : 'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <MapPin className="h-4 w-4 flex-shrink-0 text-gray-400" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{displayAddress}</div>
                    <div className="text-xs text-gray-500">{cityInfo}, {postcodeInfo}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <p className="mt-2 text-xs sm:text-sm text-gray-500">
        💡 Tapez au moins 3 caractères pour rechercher une adresse
      </p>
    </div>
  );
}
