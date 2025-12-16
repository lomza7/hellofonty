import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';
import DetailedFeatureSection from '../components/DetailedFeatureSection';
import SEO from '../components/SEO';
import Breadcrumb from '../components/Breadcrumb';
import { Loader2 } from 'lucide-react';

interface FeatureData {
  id: string;
  title_fr: string;
  title_en: string;
  text_fr: string;
  text_en: string;
  image_url: string;
  detailed_title_fr?: string;
  detailed_title_en?: string;
  detailed_description_fr?: string;
  detailed_description_en?: string;
  features?: Array<{
    icon: string;
    text_fr: string;
    text_en: string;
  }>;
  video_url?: string;
  cta_text_fr?: string;
  cta_text_en?: string;
  cta_url?: string;
  display_order: number;
}

export default function Features() {
  const { language } = useLanguage();
  const [features, setFeatures] = useState<FeatureData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFeatures();
  }, []);

  const loadFeatures = async () => {
    try {
      const { data, error } = await supabase
        .from('feature_carousel_images')
        .select('*')
        .not('detailed_title_fr', 'is', null)
        .order('display_order', { ascending: true });

      if (error) throw error;

      setFeatures(data || []);
    } catch (error) {
      console.error('Error loading features:', error);
    } finally {
      setLoading(false);
    }
  };

  const breadcrumbItems = [
    { label: language === 'fr' ? 'Accueil' : 'Home', path: '/' },
    { label: language === 'fr' ? 'Fonctionnalités' : 'Features' }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <>
      <SEO
        title={language === 'fr' ? 'Toutes nos fonctionnalités' : 'All our features'}
        description={
          language === 'fr'
            ? 'Découvrez toutes les fonctionnalités de notre plateforme de location étudiante à Fontainebleau'
            : 'Discover all the features of our student rental platform in Fontainebleau'
        }
      />

      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <Breadcrumb items={breadcrumbItems} />
          </div>
        </div>

        <div className="bg-gradient-to-b from-blue-600 to-blue-700 text-white py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              {language === 'fr' ? 'Toutes nos fonctionnalités' : 'All our features'}
            </h1>
            <p className="text-xl text-blue-100 max-w-3xl mx-auto">
              {language === 'fr'
                ? 'Découvrez comment notre plateforme facilite la location étudiante à Fontainebleau'
                : 'Discover how our platform makes student rentals in Fontainebleau easy'}
            </p>
          </div>
        </div>

        <div className="bg-white">
          {features.map((feature, index) => {
            const title = language === 'fr' ? feature.detailed_title_fr : feature.detailed_title_en;
            const description = language === 'fr' ? feature.detailed_description_fr : feature.detailed_description_en;
            const ctaText = language === 'fr' ? feature.cta_text_fr : feature.cta_text_en;

            const featureItems = feature.features?.map(f => ({
              icon: f.icon,
              text: language === 'fr' ? f.text_fr : f.text_en
            })) || [];

            return (
              <DetailedFeatureSection
                key={feature.id}
                title={title || ''}
                description={description || ''}
                features={featureItems}
                imageUrl={feature.image_url}
                videoUrl={feature.video_url}
                ctaText={ctaText}
                ctaUrl={feature.cta_url}
                reverse={index % 2 === 1}
              />
            );
          })}
        </div>

        {features.length === 0 && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
            <p className="text-gray-500">
              {language === 'fr'
                ? 'Aucune fonctionnalité détaillée disponible pour le moment.'
                : 'No detailed features available at the moment.'}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
