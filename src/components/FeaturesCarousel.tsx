import { useState, memo } from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';

type Feature = {
  icon: React.ReactNode;
  title: string;
  description: string;
  imageUrl?: string;
};

type FeaturesCarouselProps = {
  title: string;
  subtitle: string;
  features: Feature[];
  accentColor?: 'blue' | 'rose';
};

function FeaturesCarousel({
  title,
  subtitle,
  features,
  accentColor = 'blue'
}: FeaturesCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % features.length);
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + features.length) % features.length);
  };

  const colorClasses = {
    blue: {
      badge: 'bg-blue-100 text-blue-700',
      button: 'bg-blue-600 hover:bg-blue-700',
      iconBg: 'bg-blue-100',
      icon: 'text-blue-600'
    },
    rose: {
      badge: 'bg-rose-100 text-rose-700',
      button: 'bg-rose-600 hover:bg-rose-700',
      iconBg: 'bg-rose-100',
      icon: 'text-rose-600'
    }
  };

  const colors = colorClasses[accentColor];

  const visibleFeatures = 3;
  const getVisibleFeatures = () => {
    const visible = [];
    for (let i = 0; i < visibleFeatures; i++) {
      visible.push(features[(currentIndex + i) % features.length]);
    }
    return visible;
  };

  return (
    <div className="py-12 sm:py-16 bg-gray-50">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-20">
        <div className="text-center mb-8 sm:mb-12">
          <div className={`inline-block px-4 py-2 ${colors.badge} rounded-full text-sm font-semibold mb-4`}>
            {subtitle}
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-gray-900">
            {title}
          </h2>
        </div>

        <div className="relative overflow-hidden px-8 sm:px-10 -mx-8 sm:-mx-10">
          <div className="hidden md:grid md:grid-cols-3 gap-6 lg:gap-8">
            {getVisibleFeatures().map((feature, index) => (
              <div
                key={index}
                className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow"
              >
                {feature.imageUrl && (
                  <img
                    src={feature.imageUrl}
                    alt={feature.title}
                    loading="lazy"
                    decoding="async"
                    className="h-48 w-full object-cover"
                  />
                )}
                <div className="p-6 lg:p-8">
                  <div className={`w-14 h-14 ${colors.iconBg} rounded-xl flex items-center justify-center mb-4`}>
                    <div className={colors.icon}>
                      {feature.icon}
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="md:hidden">
            <div className="bg-white rounded-2xl overflow-hidden shadow-lg">
              {features[currentIndex].imageUrl && (
                <img
                  src={features[currentIndex].imageUrl}
                  alt={features[currentIndex].title}
                  loading="lazy"
                  decoding="async"
                  className="h-48 w-full object-cover"
                />
              )}
              <div className="p-6">
                <div className={`w-14 h-14 ${colors.iconBg} rounded-xl flex items-center justify-center mb-4`}>
                  <div className={colors.icon}>
                    {features[currentIndex].icon}
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  {features[currentIndex].title}
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  {features[currentIndex].description}
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={prevSlide}
            className={`absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 ${colors.button} text-white p-2 md:p-3 rounded-full shadow-lg transition z-10`}
          >
            <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />
          </button>

          <button
            onClick={nextSlide}
            className={`absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 ${colors.button} text-white p-2 md:p-3 rounded-full shadow-lg transition z-10`}
          >
            <ChevronRight className="w-5 h-5 md:w-6 md:h-6" />
          </button>

          <div className="flex justify-center gap-2 mt-6">
            {features.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`h-2 rounded-full transition-all ${
                  index === currentIndex
                    ? `${colors.button} w-8`
                    : 'bg-gray-300 w-2'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(FeaturesCarousel);
