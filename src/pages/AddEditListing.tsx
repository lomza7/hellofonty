import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Upload, X, Home, MapPin, Sparkles, Camera, ArrowRight, ArrowLeft, Check, Euro, Plus, Trash2, RotateCw, Info, Shield } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import AddressAutocomplete from '../components/AddressAutocomplete';
import BackButton from '../components/BackButton';
import DraggableImageGrid from '../components/DraggableImageGrid';

const commonAmenities = [
  'WiFi',
  'Cuisine équipée / Equipped kitchen',
  'Lave-linge / Washing machine',
  'Ventilateur / Fan',
  'Parking',
  'Jardin / Garden',
  'Balcon / Balcony',
  'Climatisation / Air conditioning',
  'Chauffage / Heating',
  'TV',
  'Bureau / Desk',
];

const bonusAmenities = [
  'Fibre optique / Fiber optic',
  'Netflix',
  'Disney+',
  'Amazon Prime Video',
  'Vélo / Bicycle',
  'Trottinette / Scooter',
  'Console de jeux / Game console',
  'Salle de sport / Gym access',
  'Piscine / Swimming pool',
  'Terrasse privée / Private terrace',
  'Cave / Storage room',
  'Place de parking privée / Private parking spot',
];

const STEPS = [
  { id: 1, title: 'Informations de base', titleEn: 'Basic information', icon: Home },
  { id: 2, title: 'Localisation', titleEn: 'Location', icon: MapPin },
  { id: 3, title: 'Détails', titleEn: 'Details', icon: Sparkles },
  { id: 4, title: 'Règles', titleEn: 'Rules', icon: Shield },
  { id: 5, title: 'Tarifs', titleEn: 'Pricing', icon: Euro },
  { id: 6, title: 'Photos', titleEn: 'Photos', icon: Camera },
];

export default function AddEditListing() {
  const { id } = useParams<{ id: string }>();
  const listingId = id;
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const { profile } = useAuth();

  const [currentStep, setCurrentStep] = useState(1);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');

  const [airbnbUrl, setAirbnbUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [propertyType, setPropertyType] = useState<'apartment' | 'house' | 'room'>(
    'apartment'
  );
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('Fontainebleau');
  const [postalCode, setPostalCode] = useState('77300');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [price, setPrice] = useState('');
  const [bedrooms, setBedrooms] = useState('1');
  const [bathrooms, setBathrooms] = useState('1');
  const [maxGuests, setMaxGuests] = useState('1');
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState<{ id: string; url: string; order: number }[]>([]);
  const [imageInputKey, setImageInputKey] = useState(Date.now());
  const [imageRotations, setImageRotations] = useState<{ [key: string]: number }>({});
  const [isDropzoneActive, setIsDropzoneActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Nouveaux champs pour les détails de l'immeuble
  const [floor, setFloor] = useState('');
  const [totalFloors, setTotalFloors] = useState('');
  const [hasElevator, setHasElevator] = useState<boolean | null>(null);
  const [buildingYear, setBuildingYear] = useState('');
  const [apartmentArea, setApartmentArea] = useState('');
  const [furnished, setFurnished] = useState<'furnished' | 'unfurnished' | 'semi-furnished' | ''>('');
  const [accessibility, setAccessibility] = useState<string[]>([]);
  const [bonusFeatures, setBonusFeatures] = useState<string[]>([]);

  // Champs pour les tarifs et charges
  const [baseRent, setBaseRent] = useState('');
  const [electricityCost, setElectricityCost] = useState('');
  const [heatingCost, setHeatingCost] = useState('');
  const [waterCost, setWaterCost] = useState('');
  const [customCharges, setCustomCharges] = useState<{ name: string; amount: string }[]>([]);
  const [securityDeposit, setSecurityDeposit] = useState('');
  const [videoUrl, setVideoUrl] = useState('');

  // House rules
  const [checkInStart, setCheckInStart] = useState('14:00');
  const [checkInEnd, setCheckInEnd] = useState('22:00');
  const [checkOutTime, setCheckOutTime] = useState('11:00');
  const [petsAllowed, setPetsAllowed] = useState(false);
  const [smokingAllowed, setSmokingAllowed] = useState(false);
  const [partiesAllowed, setPartiesAllowed] = useState(false);
  const [childrenAllowed, setChildrenAllowed] = useState(true);
  const [quietHoursStart, setQuietHoursStart] = useState('22:00');
  const [quietHoursEnd, setQuietHoursEnd] = useState('08:00');
  const [additionalRules, setAdditionalRules] = useState('');
  const [minimumStay, setMinimumStay] = useState('0.5');

  useEffect(() => {
    if (listingId) {
      loadListing();
    }
  }, [listingId]);

  const loadListing = async () => {
    const { data, error } = await supabase
      .from('listings')
      .select('*, images:listing_images(*)')
      .eq('id', listingId)
      .maybeSingle();

    if (!error && data) {
      setTitle(data.title);
      setDescription(data.description);
      setPropertyType(data.property_type);
      setAddress(data.address);
      setCity(data.city);
      setPostalCode(data.postal_code);
      setLatitude(data.latitude);
      setLongitude(data.longitude);
      setPrice(data.price_per_month.toString());
      setBedrooms(data.bedrooms.toString());
      setBathrooms(data.bathrooms.toString());
      setMaxGuests(data.max_guests.toString());
      setSelectedAmenities(data.amenities || []);
      const sortedImages = data.images?.sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0)) || [];
      setExistingImages(
        sortedImages.map((img: any) => ({
          id: img.id,
          url: img.image_url,
          order: img.display_order || 0
        }))
      );

      // Charger les nouveaux champs
      if (data.floor !== undefined) setFloor(data.floor.toString());
      if (data.total_floors !== undefined) setTotalFloors(data.total_floors.toString());
      if (data.has_elevator !== undefined) setHasElevator(data.has_elevator);
      if (data.building_year) setBuildingYear(data.building_year.toString());
      if (data.apartment_area) setApartmentArea(data.apartment_area.toString());
      if (data.furnished) setFurnished(data.furnished);
      if (data.accessibility) setAccessibility(data.accessibility);
      if (data.bonus_features) setBonusFeatures(data.bonus_features);

      // Charger les champs de tarification
      // Si base_rent n'existe pas, utiliser price_per_month comme fallback
      if (data.base_rent) {
        setBaseRent(data.base_rent.toString());
      } else if (data.price_per_month) {
        setBaseRent(data.price_per_month.toString());
      }

      if (data.price_per_month) {
        setPrice(data.price_per_month.toString());
      }

      if (data.electricity_cost) setElectricityCost(data.electricity_cost.toString());
      if (data.heating_cost) setHeatingCost(data.heating_cost.toString());
      if (data.water_cost) setWaterCost(data.water_cost.toString());
      if (data.custom_charges) setCustomCharges(data.custom_charges);
      if (data.security_deposit) setSecurityDeposit(data.security_deposit.toString());
      if (data.video_url) setVideoUrl(data.video_url);

      // Charger les règles de la maison
      if (data.check_in_start) setCheckInStart(data.check_in_start);
      if (data.check_in_end) setCheckInEnd(data.check_in_end);
      if (data.check_out_time) setCheckOutTime(data.check_out_time);
      if (data.pets_allowed !== undefined) setPetsAllowed(data.pets_allowed);
      if (data.smoking_allowed !== undefined) setSmokingAllowed(data.smoking_allowed);
      if (data.parties_allowed !== undefined) setPartiesAllowed(data.parties_allowed);
      if (data.children_allowed !== undefined) setChildrenAllowed(data.children_allowed);
      if (data.quiet_hours_start) setQuietHoursStart(data.quiet_hours_start);
      if (data.quiet_hours_end) setQuietHoursEnd(data.quiet_hours_end);
      if (data.additional_rules) setAdditionalRules(data.additional_rules);
      if (data.minimum_stay) setMinimumStay(data.minimum_stay.toString());
    }
  };

  const handleImportFromAirbnb = async () => {
    if (!airbnbUrl) {
      alert(language === 'fr' ? 'Veuillez entrer une URL Airbnb' : 'Please enter an Airbnb URL');
      return;
    }

    setIsImporting(true);
    setError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        alert(language === 'fr' ? 'Session expirée. Veuillez vous reconnecter.' : 'Session expired. Please log in again.');
        return;
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scrape-airbnb`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ url: airbnbUrl }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Erreur lors de l\'import');
      }

      const airbnbData = result.data;

      setTitle(airbnbData.title || '');
      setDescription(airbnbData.description || '');

      if (airbnbData.propertyType) {
        setPropertyType(airbnbData.propertyType as 'apartment' | 'house' | 'room');
      }

      if (airbnbData.bedrooms) setBedrooms(airbnbData.bedrooms.toString());
      if (airbnbData.bathrooms) setBathrooms(airbnbData.bathrooms.toString());
      if (airbnbData.max_guests) setMaxGuests(airbnbData.max_guests.toString());
      if (airbnbData.price) setBaseRent(airbnbData.price.toString());
      if (airbnbData.address) setAddress(airbnbData.address);

      if (airbnbData.amenities && airbnbData.amenities.length > 0) {
        setSelectedAmenities(airbnbData.amenities);
      }

      if (airbnbData.bonusFeatures && airbnbData.bonusFeatures.length > 0) {
        setBonusFeatures(airbnbData.bonusFeatures);
      }

      if (airbnbData.apartmentArea) {
        setApartmentArea(airbnbData.apartmentArea.toString());
      }

      if (airbnbData.hasElevator !== undefined) {
        setHasElevator(airbnbData.hasElevator);
      }

      if (airbnbData.furnished) {
        setFurnished(airbnbData.furnished as 'furnished' | 'unfurnished' | 'semi-furnished');
      }

      if (airbnbData.floor !== undefined && airbnbData.floor !== null) {
        setFloor(airbnbData.floor.toString());
      }

      if (airbnbData.totalFloors !== undefined && airbnbData.totalFloors !== null) {
        setTotalFloors(airbnbData.totalFloors.toString());
      }

      if (airbnbData.downloadedImages && airbnbData.downloadedImages.length > 0) {
        const importedImages = airbnbData.downloadedImages.map((url: string, index: number) => ({
          id: `imported-${Date.now()}-${index}`,
          url: url,
          order: index
        }));
        setExistingImages(importedImages);
      }

      const imageCount = airbnbData.downloadedImages?.length || 0;
      alert(language === 'fr'
        ? `Données importées avec succès ! ${imageCount} photo(s) téléchargée(s). Veuillez vérifier et compléter les informations.`
        : `Data imported successfully! ${imageCount} photo(s) downloaded. Please review and complete the information.`);

      setAirbnbUrl('');
    } catch (error: any) {
      console.error('Error importing from Airbnb:', error);
      setError(error.message || (language === 'fr' ? 'Erreur lors de l\'import depuis Airbnb' : 'Error importing from Airbnb'));
    } finally {
      setIsImporting(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const images = files.filter((f) => f.type.startsWith('image/'));
    setImageFiles((prev) => [...prev, ...images]);
    setImageInputKey(Date.now());
  };

  const handleDropzoneFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDropzoneActive(false);
    const files = Array.from(e.dataTransfer.files);
    const images = files.filter((f) => f.type.startsWith('image/'));
    if (images.length > 0) {
      setImageFiles((prev) => [...prev, ...images]);
    }
  };

  const removeNewImage = (index: number) => {
    setImageFiles(imageFiles.filter((_, i) => i !== index));
    setImageInputKey(Date.now());
  };

  const removeExistingImage = async (imageId: string) => {
    if (!imageId.startsWith('imported-')) {
      await supabase.from('listing_images').delete().eq('id', imageId);
    }
    setExistingImages((prev) => prev.filter((img) => img.id !== imageId));
  };

  const toggleAmenity = (amenity: string) => {
    setSelectedAmenities((prev) =>
      prev.includes(amenity) ? prev.filter((a) => a !== amenity) : [...prev, amenity]
    );
  };

  const newImageUrls = useMemo(() => {
    const map = new Map<string, string>();
    imageFiles.forEach((file, index) => {
      map.set(`new-${index}`, URL.createObjectURL(file));
    });
    return map;
  }, [imageFiles]);

  const allDraggableImages = useMemo(() => {
    const existing = existingImages.map((img) => ({
      id: `existing-${img.id}`,
      url: img.url,
      isNew: false,
    }));
    const newImgs = imageFiles.map((file, index) => ({
      id: `new-${index}`,
      url: newImageUrls.get(`new-${index}`) || URL.createObjectURL(file),
      isNew: true,
      file,
    }));
    return [...existing, ...newImgs];
  }, [existingImages, imageFiles, newImageUrls]);

  const handleDragReorder = useCallback((reordered: { id: string; url: string; isNew?: boolean; file?: File }[]) => {
    const newExisting: { id: string; url: string; order: number }[] = [];
    const newFiles: File[] = [];

    reordered.forEach((img, idx) => {
      if (img.id.startsWith('existing-')) {
        const realId = img.id.replace('existing-', '');
        newExisting.push({ id: realId, url: img.url, order: idx });
      } else if (img.file) {
        newFiles.push(img.file);
      }
    });

    setExistingImages(newExisting);
    setImageFiles(newFiles);
    updateImageOrder(newExisting);
  }, []);

  const handleDragRemove = useCallback((id: string) => {
    if (id.startsWith('existing-')) {
      const realId = id.replace('existing-', '');
      removeExistingImage(realId);
    } else if (id.startsWith('new-')) {
      const index = parseInt(id.replace('new-', ''), 10);
      removeNewImage(index);
    }
  }, [existingImages, imageFiles]);

  const handleDragRotate = useCallback((id: string) => {
    setImageRotations(prev => ({
      ...prev,
      [id]: ((prev[id] || 0) + 90) % 360
    }));
  }, []);

  const updateImageOrder = async (images: { id: string; order: number }[]) => {
    try {
      for (const img of images) {
        if (!img.id.startsWith('imported-')) {
          await supabase
            .from('listing_images')
            .update({ display_order: img.order })
            .eq('id', img.id);
        }
      }
    } catch (err) {
      console.error('Error updating image order:', err);
    }
  };

  const uploadImages = async (listingId: string) => {
    const uploadPromises = imageFiles.map(async (file, index) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${listingId}-${Date.now()}-${index}.${fileExt}`;
      const filePath = `listings/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from('images').getPublicUrl(filePath);

      return {
        listing_id: listingId,
        image_url: publicUrl,
        display_order: existingImages.length + index,
      };
    });

    const imageRecords = await Promise.all(uploadPromises);

    const { error: insertError } = await supabase
      .from('listing_images')
      .insert(imageRecords);

    if (insertError) throw insertError;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!profile) throw new Error('Not logged in');

      // Calculer le prix total
      const calculateTotalRent = () => {
        const base = baseRent ? parseFloat(baseRent) : 0;
        const electricity = electricityCost ? parseFloat(electricityCost) : 0;
        const heating = heatingCost ? parseFloat(heatingCost) : 0;
        const water = waterCost ? parseFloat(waterCost) : 0;
        const custom = customCharges.reduce((sum, charge) => {
          return sum + (charge.amount ? parseFloat(charge.amount) : 0);
        }, 0);
        return base + electricity + heating + water + custom;
      };

      const listingData: any = {
        title,
        description,
        property_type: propertyType,
        address,
        city,
        postal_code: postalCode,
        latitude: latitude,
        longitude: longitude,
        price_per_month: calculateTotalRent(),
        bedrooms: parseInt(bedrooms),
        bathrooms: parseInt(bathrooms),
        max_guests: parseInt(maxGuests),
        amenities: selectedAmenities,
        is_active: true,
        floor: floor ? parseInt(floor) : null,
        total_floors: totalFloors ? parseInt(totalFloors) : null,
        has_elevator: hasElevator,
        building_year: buildingYear ? parseInt(buildingYear) : null,
        apartment_area: apartmentArea ? parseFloat(apartmentArea) : null,
        furnished: furnished || null,
        accessibility: accessibility.length > 0 ? accessibility : null,
        bonus_features: bonusFeatures.length > 0 ? bonusFeatures : null,
        base_rent: baseRent ? parseFloat(baseRent) : null,
        electricity_cost: electricityCost ? parseFloat(electricityCost) : null,
        heating_cost: heatingCost ? parseFloat(heatingCost) : null,
        water_cost: waterCost ? parseFloat(waterCost) : null,
        custom_charges: customCharges.length > 0 ? customCharges : null,
        security_deposit: securityDeposit ? parseFloat(securityDeposit) : null,
        video_url: videoUrl || null,
        check_in_start: checkInStart,
        check_in_end: checkInEnd,
        check_out_time: checkOutTime,
        pets_allowed: petsAllowed,
        smoking_allowed: smokingAllowed,
        parties_allowed: partiesAllowed,
        children_allowed: childrenAllowed,
        quiet_hours_start: quietHoursStart,
        quiet_hours_end: quietHoursEnd,
        additional_rules: additionalRules || null,
        minimum_stay: minimumStay ? parseFloat(minimumStay) : 0.5,
      };

      if (listingId) {
        const { error: updateError } = await supabase
          .from('listings')
          .update(listingData)
          .eq('id', listingId);

        if (updateError) throw updateError;

        if (imageFiles.length > 0) {
          await uploadImages(listingId);
        }

        if (profile.role === 'admin') {
          navigate('/admin');
        } else {
          navigate('/mes-annonces');
        }
      } else {
        listingData.landlord_id = profile.id;

        const { data: newListing, error: insertError } = await supabase
          .from('listings')
          .insert(listingData)
          .select()
          .single();

        if (insertError) throw insertError;

        if (newListing) {
          if (existingImages.length > 0) {
            const importedImageRecords = existingImages.map((img, index) => ({
              listing_id: newListing.id,
              image_url: img.url,
              display_order: index,
            }));

            const { error: importImagesError } = await supabase
              .from('listing_images')
              .insert(importedImageRecords);

            if (importImagesError) throw importImagesError;
          }

          if (imageFiles.length > 0) {
            await uploadImages(newListing.id);
          }
        }

        setShowSuccessModal(true);
      }
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue / An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const canProceedToNextStep = () => {
    switch (currentStep) {
      case 1:
        return title.trim() && description.trim();
      case 2:
        return address.trim() && city.trim() && postalCode.trim();
      case 3:
        return true; // Détails optionnels
      case 4:
        return true; // Règles optionnelles
      case 5:
        // Pour les tarifs, on accepte soit baseRent défini, soit price (pour les anciennes annonces)
        const hasValidPrice = (baseRent && parseFloat(baseRent) > 0) || (price && parseFloat(price) > 0);
        console.log('Step 4 validation:', { baseRent, price, hasValidPrice });
        return hasValidPrice;
      case 6:
        return (imageFiles.length > 0 || existingImages.length > 0);
      default:
        return false;
    }
  };

  const canSubmit = () => {
    return (
      title.trim() &&
      description.trim() &&
      address.trim() &&
      city.trim() &&
      postalCode.trim() &&
      ((baseRent && parseFloat(baseRent) > 0) || (price && parseFloat(price) > 0)) &&
      (imageFiles.length > 0 || existingImages.length > 0)
    );
  };

  const goToNextStep = () => {
    console.log('goToNextStep called', { currentStep, maxStep: STEPS.length, canProceed: canProceedToNextStep() });
    if (currentStep < STEPS.length && canProceedToNextStep()) {
      setDirection('forward');
      const nextStep = currentStep + 1;
      console.log('Moving to step:', nextStep);
      setCurrentStep(nextStep);
    } else {
      console.log('Cannot proceed:', { currentStep, canProceed: canProceedToNextStep() });
    }
  };

  const goToPreviousStep = () => {
    if (currentStep > 1) {
      setDirection('backward');
      setCurrentStep(currentStep - 1);
    }
  };

  const renderStepContent = () => {
    console.log('renderStepContent called for step:', currentStep);
    const slideDirection = direction === 'forward' ? 'translate-x-0' : '-translate-x-0';

    switch (currentStep) {
      case 1:
        return (
          <div className={`space-y-6 transition-all duration-500 ease-out ${slideDirection}`}>
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                {language === 'fr' ? 'Parlez-nous de votre logement' : 'Tell us about your place'}
              </h2>
              <p className="text-sm text-gray-600">
                {language === 'fr'
                  ? 'Commençons par les informations de base'
                  : 'Let\'s start with the basics'}
              </p>
            </div>

            {!listingId && (
              <div className="bg-gradient-to-r from-blue-50 to-rose-50 border-2 border-blue-200 rounded-xl p-4 sm:p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <Upload className="w-5 h-5 text-blue-600" />
                  {language === 'fr' ? 'Importer depuis Airbnb' : 'Import from Airbnb'}
                </h3>
                <p className="text-sm text-gray-600 mb-3">
                  {language === 'fr'
                    ? t('addListing.airbnbImport')
                    : 'Save time! Paste your Airbnb listing link to auto-fill the information.'}
                </p>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={airbnbUrl}
                    onChange={(e) => setAirbnbUrl(e.target.value)}
                    placeholder={language === 'fr' ? 'https://www.airbnb.fr/rooms/...' : 'https://www.airbnb.com/rooms/...'}
                    className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent transition text-sm"
                    disabled={isImporting}
                  />
                  <button
                    type="button"
                    onClick={handleImportFromAirbnb}
                    disabled={isImporting || !airbnbUrl}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isImporting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        {language === 'fr' ? 'Import...' : 'Importing...'}
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        {language === 'fr' ? 'Importer' : 'Import'}
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2 sm:mb-3">
                {t('addListing.title.label')}
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={language === 'fr' ? 'ex: Studio lumineux près de l\'INSEAD' : 'e.g., Bright studio near INSEAD'}
                className="w-full px-4 py-3 sm:px-5 sm:py-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-400 focus:border-transparent transition text-base sm:text-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2 sm:mb-3">
                {t('addListing.description')}
              </label>
              <textarea
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder={language === 'fr' ? 'Décrivez votre logement en détail...' : 'Describe your place in detail...'}
                className="w-full px-4 py-3 sm:px-5 sm:py-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-400 focus:border-transparent transition resize-none text-base sm:text-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2 sm:mb-3">
                {t('addListing.propertyType')}
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3">
                {(['apartment', 'house', 'room'] as const).map((type) => {
                  const emojis = {
                    apartment: '🏢',
                    house: '🏠',
                    room: '🛏️'
                  };
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setPropertyType(type)}
                      className={`px-3 py-3 sm:px-6 sm:py-4 rounded-xl border-2 transition-all transform active:scale-95 sm:hover:scale-105 ${
                        propertyType === type
                          ? 'border-rose-500 bg-rose-50 text-rose-700 shadow-md'
                          : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:shadow-sm'
                      }`}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-2xl">{emojis[type]}</span>
                        <span className="text-sm sm:text-base font-semibold">{t(`search.propertyType.${type}`)}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className={`space-y-6 transition-all duration-500 ease-out ${slideDirection}`}>
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                {language === 'fr' ? 'Où se trouve votre logement ?' : 'Where is your place located?'}
              </h2>
              <p className="text-sm text-gray-600">
                {language === 'fr'
                  ? 'Aidez les étudiants à vous trouver'
                  : 'Help students find you'}
              </p>
            </div>

            <AddressAutocomplete
              value={address}
              onChange={(value, coordinates) => {
                setAddress(value);
                if (coordinates) {
                  setLatitude(coordinates.latitude);
                  setLongitude(coordinates.longitude);
                }
              }}
              placeholder={language === 'fr' ? '12 Rue de la Paix' : '12 Peace Street'}
              label={t('addListing.address')}
              required
            />

            {latitude && longitude && (
              <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <MapPin className="h-5 w-5 text-green-600" />
                  </div>
                  <div className="ml-3 flex-1">
                    <h3 className="text-sm font-semibold text-green-900">
                      {language === 'fr' ? 'Position GPS enregistrée' : 'GPS position saved'}
                    </h3>
                    <p className="text-xs text-green-700 mt-1">
                      {language === 'fr'
                        ? 'Votre logement apparaîtra sur la carte interactive'
                        : 'Your property will appear on the interactive map'}
                    </p>
                    <p className="text-xs text-green-600 mt-2 font-mono">
                      {latitude.toFixed(6)}, {longitude.toFixed(6)}
                    </p>
                    <div className="mt-2 flex items-center gap-1.5">
                      <svg className="h-3.5 w-3.5 text-green-700 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M12 3l9 9-9 9"/></svg>
                      <p className="text-xs font-semibold text-green-800">
                        {(() => {
                          const R = 6371;
                          const lat1 = latitude * Math.PI / 180;
                          const lat2 = 48.405527 * Math.PI / 180;
                          const dLat = (48.405527 - latitude) * Math.PI / 180;
                          const dLon = (2.686894 - longitude) * Math.PI / 180;
                          const a = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
                          const d = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                          return d < 1
                            ? `${Math.round(d * 1000)} m du campus INSEAD`
                            : `${d.toFixed(1)} km du campus INSEAD`;
                        })()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2 sm:mb-3">
                  {t('addListing.city')}
                </label>
                <input
                  type="text"
                  required
                  value={city}
                  onChange={(e) => {
                    const newCity = e.target.value;
                    setCity(newCity);
                    // Mise à jour automatique du code postal
                    const postalCodes: Record<string, string> = {
                      'Fontainebleau': '77300',
                      'Avon': '77210',
                      'Thomery': '77810',
                      'Samois-sur-Seine': '77920',
                      'Vulaines-sur-Seine': '77870',
                      'Champagne-sur-Seine': '77430',
                      'Bois-le-Roi': '77590',
                      'Chartrettes': '77590',
                      'Héricy': '77850',
                      'Veneux-les-Sablons': '77250',
                      'Moret-Loing-et-Orvanne': '77250',
                    };
                    const normalizedCity = newCity.charAt(0).toUpperCase() + newCity.slice(1).toLowerCase();
                    if (postalCodes[normalizedCity]) {
                      setPostalCode(postalCodes[normalizedCity]);
                    }
                  }}
                  className="w-full px-4 py-3 sm:px-5 sm:py-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-400 focus:border-transparent transition text-base sm:text-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2 sm:mb-3">
                  {t('addListing.postalCode')}
                </label>
                <input
                  type="text"
                  required
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="77300"
                  className="w-full px-4 py-3 sm:px-5 sm:py-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-400 focus:border-transparent transition text-base sm:text-lg bg-gray-50"
                  readOnly
                />
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className={`space-y-8 transition-all duration-500 ease-out ${slideDirection}`}>
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                {language === 'fr' ? 'Les détails de votre logement' : 'Details about your place'}
              </h2>
              <p className="text-sm text-gray-600">
                {language === 'fr'
                  ? 'Plus c\'est détaillé, mieux c\'est pour les étudiants'
                  : 'The more detailed, the better for students'}
              </p>
            </div>

            {/* Capacité */}
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-2 sm:mb-3">
                  {t('addListing.bedrooms')}
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={bedrooms}
                  onChange={(e) => setBedrooms(e.target.value)}
                  className="w-full px-3 py-3 sm:px-5 sm:py-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-400 focus:border-transparent transition text-base sm:text-lg"
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-2 sm:mb-3">
                  {t('addListing.bathrooms')}
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={bathrooms}
                  onChange={(e) => setBathrooms(e.target.value)}
                  className="w-full px-3 py-3 sm:px-5 sm:py-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-400 focus:border-transparent transition text-base sm:text-lg"
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-2 sm:mb-3">
                  {t('addListing.maxGuests')}
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={maxGuests}
                  onChange={(e) => setMaxGuests(e.target.value)}
                  className="w-full px-3 py-3 sm:px-5 sm:py-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-400 focus:border-transparent transition text-base sm:text-lg"
                />
              </div>
            </div>

            {/* Détails de l'immeuble */}
            <div className="bg-blue-50 rounded-xl p-4 sm:p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                {language === 'fr' ? 'Informations sur l\'immeuble' : 'Building information'}
              </h3>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 mb-4">
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-2">
                    {language === 'fr' ? 'Étage du logement' : 'Apartment floor'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={floor}
                    onChange={(e) => setFloor(e.target.value)}
                    placeholder={language === 'fr' ? 'ex: 3' : 'e.g., 3'}
                    className="w-full px-3 py-3 sm:px-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-400 focus:border-transparent transition text-sm sm:text-base"
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-2">
                    {language === 'fr' ? 'Nombre d\'étages' : 'Total floors'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={totalFloors}
                    onChange={(e) => setTotalFloors(e.target.value)}
                    placeholder={language === 'fr' ? 'ex: 5' : 'e.g., 5'}
                    className="w-full px-3 py-3 sm:px-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-400 focus:border-transparent transition text-sm sm:text-base"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3">
                  {language === 'fr' ? 'Ascenseur' : 'Elevator'}
                </label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setHasElevator(true)}
                    className={`flex-1 px-4 py-3 rounded-xl border-2 transition-all transform active:scale-95 sm:hover:scale-105 text-sm font-semibold ${
                      hasElevator === true
                        ? 'border-rose-500 bg-rose-50 text-rose-700 shadow-md'
                        : 'border-gray-200 text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {language === 'fr' ? 'Oui' : 'Yes'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setHasElevator(false)}
                    className={`flex-1 px-4 py-3 rounded-xl border-2 transition-all transform active:scale-95 sm:hover:scale-105 text-sm font-semibold ${
                      hasElevator === false
                        ? 'border-rose-500 bg-rose-50 text-rose-700 shadow-md'
                        : 'border-gray-200 text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {language === 'fr' ? 'Non' : 'No'}
                  </button>
                </div>
              </div>
            </div>

            {/* Détails du logement */}
            <div className="bg-green-50 rounded-xl p-4 sm:p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                {language === 'fr' ? 'Caractéristiques du logement' : 'Property characteristics'}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-2">
                    {language === 'fr' ? 'Surface (m²)' : 'Area (m²)'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.1"
                    value={apartmentArea}
                    onChange={(e) => setApartmentArea(e.target.value)}
                    placeholder={language === 'fr' ? 'ex: 45' : 'e.g., 45'}
                    className="w-full px-3 py-3 sm:px-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-400 focus:border-transparent transition text-sm sm:text-base"
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-2">
                    {language === 'fr' ? 'Ameublement' : 'Furnishing'}
                  </label>
                  <select
                    value={furnished}
                    onChange={(e) => setFurnished(e.target.value as any)}
                    className="w-full px-3 py-3 sm:px-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-400 focus:border-transparent transition text-sm sm:text-base"
                  >
                    <option value="">{language === 'fr' ? 'Sélectionner' : 'Select'}</option>
                    <option value="furnished">{language === 'fr' ? 'Meublé' : 'Furnished'}</option>
                    <option value="unfurnished">{language === 'fr' ? 'Non meublé' : 'Unfurnished'}</option>
                    <option value="semi-furnished">{language === 'fr' ? 'Semi-meublé' : 'Semi-furnished'}</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Équipements */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3 sm:mb-4">
                {t('addListing.amenities')}
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3">
                {commonAmenities.map((amenity) => (
                  <button
                    key={amenity}
                    type="button"
                    onClick={() => toggleAmenity(amenity)}
                    className={`px-3 py-2.5 sm:px-4 sm:py-3 rounded-xl border-2 transition-all transform active:scale-95 sm:hover:scale-105 text-xs sm:text-sm ${
                      selectedAmenities.includes(amenity)
                        ? 'border-rose-500 bg-rose-50 text-rose-700 shadow-md'
                        : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:shadow-sm'
                    }`}
                  >
                    <span className="font-medium">{amenity}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Section Bonus */}
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-4 sm:p-6 border-2 border-amber-200">
              <div className="flex items-center mb-4">
                <Sparkles className="w-5 h-5 text-amber-600 mr-2" />
                <h3 className="text-lg font-bold text-gray-900">
                  {language === 'fr' ? 'Bonus - Équipements Premium' : 'Bonus - Premium Features'}
                </h3>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                {language === 'fr'
                  ? 'Mettez en avant les équipements qui feront la différence !'
                  : 'Highlight the features that will make the difference!'}
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3">
                {bonusAmenities.map((bonus) => (
                  <button
                    key={bonus}
                    type="button"
                    onClick={() => {
                      setBonusFeatures((prev) =>
                        prev.includes(bonus) ? prev.filter((b) => b !== bonus) : [...prev, bonus]
                      );
                    }}
                    className={`px-3 py-2.5 sm:px-4 sm:py-3 rounded-xl border-2 transition-all transform active:scale-95 sm:hover:scale-105 text-xs sm:text-sm ${
                      bonusFeatures.includes(bonus)
                        ? 'border-amber-500 bg-amber-100 text-amber-800 shadow-md'
                        : 'border-gray-200 text-gray-700 hover:border-amber-300 hover:shadow-sm'
                    }`}
                  >
                    <span className="font-medium">{bonus}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className={`space-y-6 transition-all duration-500 ease-out ${slideDirection}`}>
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                {language === 'fr' ? 'Règles de la maison' : 'House rules'}
              </h2>
              <p className="text-sm text-gray-600">
                {language === 'fr'
                  ? 'Définissez les règles pour un séjour agréable'
                  : 'Set the rules for a pleasant stay'}
              </p>
            </div>

            {/* Check-in et Check-out */}
            <div className="bg-blue-50 rounded-xl p-4 sm:p-6 border-2 border-blue-200">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-blue-600" />
                {language === 'fr' ? 'Horaires d\'arrivée et départ' : 'Check-in and check-out times'}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    {language === 'fr' ? 'Check-in début' : 'Check-in start'}
                  </label>
                  <input
                    type="time"
                    value={checkInStart}
                    onChange={(e) => setCheckInStart(e.target.value)}
                    className="w-full px-3 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent transition"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    {language === 'fr' ? 'Check-in fin' : 'Check-in end'}
                  </label>
                  <input
                    type="time"
                    value={checkInEnd}
                    onChange={(e) => setCheckInEnd(e.target.value)}
                    className="w-full px-3 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent transition"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    {language === 'fr' ? 'Check-out' : 'Check-out'}
                  </label>
                  <input
                    type="time"
                    value={checkOutTime}
                    onChange={(e) => setCheckOutTime(e.target.value)}
                    className="w-full px-3 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent transition"
                  />
                </div>
              </div>
            </div>

            {/* Autorisations */}
            <div className="bg-green-50 rounded-xl p-4 sm:p-6 border-2 border-green-200">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                {language === 'fr' ? 'Autorisations' : 'Permissions'}
              </h3>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-white rounded-lg border-2 border-gray-200">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">
                      {language === 'fr' ? 'Animaux domestiques' : 'Pets'}
                    </h4>
                    <p className="text-sm text-gray-600">
                      {language === 'fr' ? 'Autoriser les animaux de compagnie' : 'Allow pets'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPetsAllowed(!petsAllowed)}
                    className={`relative w-14 h-8 rounded-full transition-colors ${
                      petsAllowed ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform ${
                        petsAllowed ? 'translate-x-6' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 bg-white rounded-lg border-2 border-gray-200">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">
                      {language === 'fr' ? 'Fumeur' : 'Smoking'}
                    </h4>
                    <p className="text-sm text-gray-600">
                      {language === 'fr' ? 'Autoriser de fumer dans le logement' : 'Allow smoking in the property'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSmokingAllowed(!smokingAllowed)}
                    className={`relative w-14 h-8 rounded-full transition-colors ${
                      smokingAllowed ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform ${
                        smokingAllowed ? 'translate-x-6' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 bg-white rounded-lg border-2 border-gray-200">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">
                      {language === 'fr' ? 'Fêtes et événements' : 'Parties and events'}
                    </h4>
                    <p className="text-sm text-gray-600">
                      {language === 'fr' ? 'Autoriser les fêtes' : 'Allow parties'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPartiesAllowed(!partiesAllowed)}
                    className={`relative w-14 h-8 rounded-full transition-colors ${
                      partiesAllowed ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform ${
                        partiesAllowed ? 'translate-x-6' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 bg-white rounded-lg border-2 border-gray-200">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">
                      {language === 'fr' ? 'Enfants' : 'Children'}
                    </h4>
                    <p className="text-sm text-gray-600">
                      {language === 'fr' ? 'Autoriser les enfants' : 'Allow children'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setChildrenAllowed(!childrenAllowed)}
                    className={`relative w-14 h-8 rounded-full transition-colors ${
                      childrenAllowed ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform ${
                        childrenAllowed ? 'translate-x-6' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Heures de calme */}
            <div className="bg-purple-50 rounded-xl p-4 sm:p-6 border-2 border-purple-200">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                {language === 'fr' ? 'Heures de calme obligatoires' : 'Quiet hours'}
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    {language === 'fr' ? 'Début' : 'Start'}
                  </label>
                  <input
                    type="time"
                    value={quietHoursStart}
                    onChange={(e) => setQuietHoursStart(e.target.value)}
                    className="w-full px-3 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-400 focus:border-transparent transition"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    {language === 'fr' ? 'Fin' : 'End'}
                  </label>
                  <input
                    type="time"
                    value={quietHoursEnd}
                    onChange={(e) => setQuietHoursEnd(e.target.value)}
                    className="w-full px-3 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-400 focus:border-transparent transition"
                  />
                </div>
              </div>
            </div>

            {/* Séjour minimum */}
            <div className="bg-rose-50 rounded-xl p-4 sm:p-6 border-2 border-rose-200">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                {language === 'fr' ? 'Durée de séjour minimum' : 'Minimum stay duration'}
              </h3>
              <select
                value={minimumStay}
                onChange={(e) => setMinimumStay(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-400 focus:border-transparent transition text-lg font-semibold bg-white"
              >
                <option value="0.5">{language === 'fr' ? '2 semaines' : '2 weeks'}</option>
                <option value="1">1 {language === 'fr' ? 'mois' : 'month'}</option>
                <option value="2">2 {language === 'fr' ? 'mois' : 'months'}</option>
                <option value="3">3 {language === 'fr' ? 'mois' : 'months'}</option>
                <option value="4">4 {language === 'fr' ? 'mois' : 'months'}</option>
                <option value="5">5 {language === 'fr' ? 'mois' : 'months'}</option>
                <option value="6">6 {language === 'fr' ? 'mois' : 'months'}</option>
                <option value="9">9 {language === 'fr' ? 'mois' : 'months'}</option>
                <option value="12">12 {language === 'fr' ? 'mois' : 'months'}</option>
              </select>
              <p className="text-sm text-gray-600 mt-3">
                {language === 'fr'
                  ? 'Définissez la durée minimale de location pour votre logement'
                  : 'Set the minimum rental duration for your property'}
              </p>
            </div>

            {/* Règles supplémentaires */}
            <div className="bg-amber-50 rounded-xl p-4 sm:p-6 border-2 border-amber-200">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                {language === 'fr' ? 'Règles supplémentaires' : 'Additional rules'}
              </h3>
              <textarea
                value={additionalRules}
                onChange={(e) => setAdditionalRules(e.target.value)}
                rows={4}
                placeholder={language === 'fr'
                  ? 'Ajoutez ici toute règle supplémentaire que vous souhaitez communiquer aux locataires...'
                  : 'Add any additional rules you want to communicate to tenants...'}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-400 focus:border-transparent transition resize-none"
              />
            </div>
          </div>
        );

      case 5:
        const calculateTotal = () => {
          const base = baseRent ? parseFloat(baseRent) : 0;
          const electricity = electricityCost ? parseFloat(electricityCost) : 0;
          const heating = heatingCost ? parseFloat(heatingCost) : 0;
          const water = waterCost ? parseFloat(waterCost) : 0;
          const custom = customCharges.reduce((sum, charge) => {
            return sum + (charge.amount ? parseFloat(charge.amount) : 0);
          }, 0);
          return base + electricity + heating + water + custom;
        };

        return (
          <div className={`space-y-6 transition-all duration-500 ease-out ${slideDirection}`}>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {language === 'fr' ? 'Tarifs et charges' : 'Pricing and charges'}
              </h2>
              <p className="text-sm text-gray-600">
                {language === 'fr'
                  ? 'Soyez transparent sur les coûts pour gagner la confiance'
                  : 'Be transparent about costs to earn trust'}
              </p>
            </div>

            {/* Loyer de base */}
            <div className="bg-gradient-to-br from-blue-50 to-sky-50 rounded-2xl p-6 border-2 border-blue-300 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                  <Home className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">
                  {language === 'fr' ? 'Loyer de base (hors charges)' : 'Base rent (excluding charges)'}
                </h3>
              </div>
              <div className="relative">
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={baseRent}
                  onChange={(e) => setBaseRent(e.target.value)}
                  placeholder={language === 'fr' ? 'ex: 600' : 'e.g., 600'}
                  className="w-full px-6 py-5 border-2 border-blue-200 bg-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-2xl font-bold pr-14 text-gray-900"
                />
                <span className="absolute right-6 top-1/2 -translate-y-1/2 text-blue-600 font-bold text-2xl">€</span>
              </div>
            </div>

            {/* Charges */}
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-6 border-2 border-amber-300 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 bg-amber-600 rounded-xl flex items-center justify-center">
                  <Euro className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">
                  {language === 'fr' ? 'Charges mensuelles' : 'Monthly charges'}
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-2">
                    {language === 'fr' ? 'Électricité' : 'Electricity'}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={electricityCost}
                      onChange={(e) => setElectricityCost(e.target.value)}
                      placeholder="0"
                      className="w-full px-4 py-3 border-2 border-amber-200 bg-white rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition text-base font-semibold pr-10"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-amber-600 font-bold">€</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-2">
                    {language === 'fr' ? 'Chauffage' : 'Heating'}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={heatingCost}
                      onChange={(e) => setHeatingCost(e.target.value)}
                      placeholder="0"
                      className="w-full px-4 py-3 border-2 border-amber-200 bg-white rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition text-base font-semibold pr-10"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-amber-600 font-bold">€</span>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-900 mb-2">
                    {language === 'fr' ? 'Eau' : 'Water'}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={waterCost}
                      onChange={(e) => setWaterCost(e.target.value)}
                      placeholder="0"
                      className="w-full px-4 py-3 border-2 border-amber-200 bg-white rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition text-base font-semibold pr-10"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-amber-600 font-bold">€</span>
                  </div>
                </div>
              </div>

              {/* Charges personnalisées */}
              <div className="pt-4 border-t-2 border-amber-200">
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-bold text-gray-900">
                    {language === 'fr' ? 'Autres charges' : 'Other charges'}
                  </label>
                  <button
                    type="button"
                    onClick={() => setCustomCharges([...customCharges, { name: '', amount: '' }])}
                    className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white text-sm font-bold rounded-xl hover:bg-amber-700 transition shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    {language === 'fr' ? 'Ajouter' : 'Add'}
                  </button>
                </div>

                {customCharges.map((charge, index) => (
                  <div key={index} className="grid grid-cols-[1fr,140px,44px] gap-2 mb-2">
                    <input
                      type="text"
                      value={charge.name}
                      onChange={(e) => {
                        const updated = [...customCharges];
                        updated[index].name = e.target.value;
                        setCustomCharges(updated);
                      }}
                      placeholder={language === 'fr' ? 'Nom de la charge' : 'Charge name'}
                      className="px-4 py-3 border-2 border-amber-200 bg-white rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition text-sm font-semibold"
                    />
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={charge.amount}
                        onChange={(e) => {
                          const updated = [...customCharges];
                          updated[index].amount = e.target.value;
                          setCustomCharges(updated);
                        }}
                        placeholder="0"
                        className="w-full px-4 py-3 border-2 border-amber-200 bg-white rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition text-sm font-semibold pr-8"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-600 text-sm font-bold">€</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCustomCharges(customCharges.filter((_, i) => i !== index))}
                      className="flex items-center justify-center p-3 bg-red-500 text-white rounded-xl hover:bg-red-600 transition shadow-sm"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Caution */}
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-6 border-2 border-purple-300 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900">
                    {language === 'fr' ? 'Dépôt de garantie (Caution)' : 'Security deposit'}
                  </h3>
                  <p className="text-xs text-gray-600 mt-1">
                    {language === 'fr'
                      ? 'Montant remboursable en fin de location'
                      : 'Refundable amount at end of lease'}
                  </p>
                </div>
              </div>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={securityDeposit}
                  onChange={(e) => setSecurityDeposit(e.target.value)}
                  placeholder={language === 'fr' ? 'ex: 1200' : 'e.g., 1200'}
                  className="w-full px-6 py-4 border-2 border-purple-200 bg-white rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition text-xl font-bold pr-14 text-gray-900"
                />
                <span className="absolute right-6 top-1/2 -translate-y-1/2 text-purple-600 font-bold text-xl">€</span>
              </div>
              <div className="mt-3 flex items-start gap-2 bg-purple-100 rounded-lg p-3">
                <Info className="w-4 h-4 text-purple-700 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-purple-900 leading-relaxed">
                  {language === 'fr'
                    ? 'Le dépôt de garantie est généralement équivalent à 1 ou 2 mois de loyer et sera restitué au locataire en fin de bail, déduction faite des éventuels dégâts.'
                    : 'The security deposit is usually equivalent to 1 or 2 months rent and will be returned to the tenant at the end of the lease, minus any damages.'}
                </p>
              </div>
            </div>

            {/* Total */}
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-6 border-2 border-emerald-400 shadow-md">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-1 flex items-center gap-2">
                    <Check className="w-6 h-6 text-emerald-600" />
                    {language === 'fr' ? 'Loyer total mensuel' : 'Total monthly rent'}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {language === 'fr' ? 'Charges comprises' : 'Charges included'}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-4xl font-black text-emerald-700">
                    {calculateTotal().toFixed(2)} €
                  </div>
                  <div className="text-sm text-gray-600 mt-1 font-semibold">
                    {language === 'fr' ? 'par mois' : 'per month'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 6:
        return (
          <div className={`space-y-6 transition-all duration-500 ease-out ${slideDirection}`}>
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                {language === 'fr' ? 'Montrez votre logement' : 'Showcase your place'}
              </h2>
              <p className="text-sm text-gray-600">
                {language === 'fr'
                  ? 'Ajoutez au moins une photo attrayante'
                  : 'Add at least one attractive photo'}
              </p>
            </div>

            {imageFiles.length === 0 && existingImages.length === 0 && (
              <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-amber-50 border-2 border-amber-200 text-amber-700 rounded-xl flex items-center">
                <Camera className="w-4 h-4 sm:w-5 sm:h-5 mr-2 flex-shrink-0" />
                <span className="text-xs sm:text-sm font-medium">
                  {language === 'fr'
                    ? 'Ajoutez au moins une photo pour continuer'
                    : 'Add at least one photo to continue'}
                </span>
              </div>
            )}

            {allDraggableImages.length > 0 && (
              <div className="mb-4 sm:mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Camera className="w-5 h-5 text-gray-600" />
                  <h3 className="text-sm font-semibold text-gray-900">
                    {language === 'fr' ? 'Photos actuelles' : 'Current photos'}
                  </h3>
                  <span className="text-xs text-gray-500 italic">
                    ({language === 'fr' ? 'Glissez pour reorganiser' : 'Drag to reorder'})
                  </span>
                </div>
                <DraggableImageGrid
                  images={allDraggableImages}
                  onReorder={handleDragReorder}
                  onRemove={handleDragRemove}
                  onRotate={handleDragRotate}
                  rotations={imageRotations}
                  language={language}
                />
              </div>
            )}

            <div
              onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsDropzoneActive(true); }}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDropzoneActive(false); }}
              onDrop={handleDropzoneFileDrop}
              className={`border-2 border-dashed rounded-xl sm:rounded-2xl p-8 sm:p-12 text-center transition-all cursor-pointer ${
                isDropzoneActive
                  ? 'border-rose-400 bg-rose-50 scale-[1.01]'
                  : 'border-gray-300 hover:border-rose-400 hover:bg-rose-50'
              }`}
            >
              <input
                key={imageInputKey}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageChange}
                className="hidden"
                id="image-upload"
              />
              <label htmlFor="image-upload" className="cursor-pointer flex flex-col items-center">
                <Upload className={`h-12 w-12 sm:h-16 sm:w-16 mb-3 sm:mb-4 transition-colors ${isDropzoneActive ? 'text-rose-400' : 'text-gray-400'}`} />
                <span className="text-base sm:text-lg font-semibold text-gray-700 mb-1 sm:mb-2">
                  {isDropzoneActive
                    ? (language === 'fr' ? 'Deposez vos photos ici' : 'Drop your photos here')
                    : (language === 'fr' ? 'Telecharger des photos' : 'Upload photos')}
                </span>
                <span className="text-xs sm:text-sm text-gray-500">
                  {language === 'fr' ? 'JPG, PNG ou WEBP' : 'JPG, PNG or WEBP'}
                </span>
              </label>
            </div>

            <div className="mt-6 p-5 bg-white border border-gray-300 rounded-xl shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 mb-3">
                <Camera className="w-5 h-5 text-gray-700" />
                <label className="block text-sm font-semibold text-gray-900">
                  {language === 'fr' ? 'Vidéo de présentation' : 'Presentation video'}
                </label>
                <span className="text-xs text-gray-500">
                  ({language === 'fr' ? 'optionnel' : 'optional'})
                </span>
              </div>

              <input
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder={language === 'fr' ? 'Collez le lien de votre vidéo' : 'Paste your video link'}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent text-sm"
              />

              <p className="mt-2 text-xs text-gray-600">
                {language === 'fr'
                  ? 'YouTube, Vimeo, ou autre plateforme vidéo'
                  : 'YouTube, Vimeo, or other video platform'}
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-4 sm:py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <BackButton />
        <div className="mb-4 sm:mb-8">
          <div className="flex items-center justify-between mb-4 sm:mb-8">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              const isActive = currentStep === step.id;
              const isCompleted = currentStep > step.id;

              return (
                <div key={step.id} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-1">
                    <button
                      type="button"
                      onClick={() => {
                        setDirection(step.id < currentStep ? 'backward' : 'forward');
                        setCurrentStep(step.id);
                      }}
                      className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer ${
                        isCompleted
                          ? 'bg-gray-900 text-white shadow-sm'
                          : isActive
                          ? 'bg-gray-900 text-white shadow-sm'
                          : 'bg-white text-gray-400 border-2 border-gray-300'
                      }`}
                    >
                      {isCompleted ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Icon className="w-4 h-4" />
                      )}
                    </button>
                    <span
                      className={`mt-1.5 text-[10px] sm:text-xs font-medium hidden sm:block transition-colors ${
                        isActive || isCompleted ? 'text-gray-900' : 'text-gray-500'
                      }`}
                    >
                      {language === 'fr' ? step.title : step.titleEn}
                    </span>
                  </div>
                  {index < STEPS.length - 1 && (
                    <div
                      className={`h-px flex-1 mx-2 transition-all duration-300 ${
                        isCompleted ? 'bg-gray-900' : 'bg-gray-300'
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="min-h-[400px]">{renderStepContent()}</div>

            <div className="flex justify-between items-center gap-4 mt-8 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={goToPreviousStep}
                disabled={currentStep === 1}
                className={`px-5 py-2.5 rounded-lg font-medium transition-colors underline ${
                  currentStep === 1
                    ? 'text-gray-300 cursor-not-allowed no-underline'
                    : 'text-gray-900 hover:bg-gray-50'
                }`}
              >
                {language === 'fr' ? 'Retour' : 'Back'}
              </button>

{currentStep < STEPS.length ? (
                <button
                  type="button"
                  onClick={goToNextStep}
                  disabled={!canProceedToNextStep()}
                  className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                    canProceedToNextStep()
                      ? 'bg-gray-900 text-white hover:bg-gray-800'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {language === 'fr' ? 'Suivant' : 'Next'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading || !canSubmit()}
                  className="px-6 py-3 bg-rose-500 text-white font-medium rounded-lg hover:bg-rose-600 transition-colors disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2 inline-block"></div>
                      {t('common.loading')}
                    </>
                  ) : (
                    <>
                      {listingId ? t('addListing.update') : t('addListing.submit')}
                    </>
                  )}
                </button>
              )}
            </div>
          </form>

          <button
            type="button"
            onClick={() => navigate('/mes-annonces')}
            className="w-full mt-4 py-2 text-sm text-gray-600 font-medium hover:text-gray-900 transition underline"
          >
            {t('common.cancel')}
          </button>
        </div>
      </div>

      {showSuccessModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 relative overflow-hidden animate-scale-in">
            <div className="confetti-container absolute inset-0 pointer-events-none">
              {[...Array(50)].map((_, i) => (
                <div
                  key={i}
                  className="confetti"
                  style={{
                    left: `${Math.random() * 100}%`,
                    animationDelay: `${Math.random() * 3}s`,
                    backgroundColor: ['#FF385C', '#00A699', '#FC642D', '#FFB400', '#007A87'][Math.floor(Math.random() * 5)],
                  }}
                />
              ))}
            </div>

            <div className="relative z-10 text-center">
              <div className="mb-6 flex justify-center">
                <div className="bg-gradient-to-br from-green-400 to-green-600 rounded-full p-6 shadow-lg animate-bounce-slow">
                  <Check className="h-16 w-16 text-white" />
                </div>
              </div>

              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                {language === 'fr' ? 'Bravo !' : 'Congratulations!'}
              </h2>

              <p className="text-lg text-gray-700 mb-6">
                {language === 'fr'
                  ? t('addListing.publishSuccess')
                  : 'Your listing is now live and visible to all students!'}
              </p>

              <div className="bg-gradient-to-r from-rose-50 to-blue-50 rounded-2xl p-6 mb-6">
                <p className="text-sm text-gray-600 mb-2">
                  {language === 'fr' ? 'Prochaines étapes :' : 'Next steps:'}
                </p>
                <ul className="text-left text-sm text-gray-700 space-y-2">
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    {language === 'fr'
                      ? 'Répondez rapidement aux demandes de réservation'
                      : 'Respond quickly to booking requests'}
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    {language === 'fr'
                      ? 'Consultez vos messages régulièrement'
                      : 'Check your messages regularly'}
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    {language === 'fr'
                      ? 'Gardez votre calendrier à jour'
                      : 'Keep your calendar up to date'}
                  </li>
                </ul>
              </div>

              <button
                onClick={() => {
                  setShowSuccessModal(false);
                  navigate('/mes-annonces');
                }}
                className="w-full py-4 bg-gradient-to-r from-rose-500 to-rose-600 text-white font-bold rounded-xl hover:from-rose-600 hover:to-rose-700 transition-all transform hover:scale-105 shadow-lg"
              >
                {language === 'fr' ? 'Voir mes annonces' : 'View my listings'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
