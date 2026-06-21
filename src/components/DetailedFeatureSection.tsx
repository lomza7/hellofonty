import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import BulletPointList from './BulletPointList';
import VideoEmbed from './VideoEmbed';

interface FeatureItem {
  icon: string;
  text: string;
}

interface DetailedFeatureSectionProps {
  title: string;
  description: string;
  features?: FeatureItem[];
  imageUrl?: string;
  videoUrl?: string;
  ctaText?: string;
  ctaUrl?: string;
  reverse?: boolean;
  accent?: 'blue' | 'rose';
}

export default function DetailedFeatureSection({
  title,
  description,
  features = [],
  imageUrl,
  videoUrl,
  ctaText,
  ctaUrl,
  reverse = false,
  accent = 'blue'
}: DetailedFeatureSectionProps) {
  if (!title && !description) return null;

  const accentClasses = accent === 'rose'
    ? 'from-rose-600 to-pink-600'
    : 'from-blue-600 to-cyan-600';

  const contentSection = (
    <div className="flex flex-col justify-center space-y-6">
      <h2 className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight">
        {title}
      </h2>
      <p className="text-lg text-gray-600 leading-relaxed">
        {description}
      </p>

      {features.length > 0 && (
        <div className="mt-4">
          <BulletPointList items={features} />
        </div>
      )}

      {ctaText && ctaUrl && (
        <div className="pt-4">
          <Link
            to={ctaUrl}
            className={`inline-flex items-center gap-2 bg-gradient-to-r ${accentClasses} hover:opacity-90 text-white px-6 py-3 rounded-xl font-medium transition-all shadow-lg hover:shadow-xl group`}
          >
            {ctaText}
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      )}
    </div>
  );

  const mediaSection = (
    <div className="flex items-center justify-center">
      {videoUrl ? (
        <VideoEmbed url={videoUrl} title={title} />
      ) : imageUrl ? (
        <div className="relative group">
          <div className={`absolute -inset-4 bg-gradient-to-r ${accentClasses} rounded-2xl opacity-10 blur-xl group-hover:opacity-20 transition-opacity duration-500`}></div>
          <img
            src={imageUrl}
            alt={title}
            className="relative w-full h-auto rounded-2xl shadow-xl border border-gray-100"
          />
        </div>
      ) : null}
    </div>
  );

  return (
    <section className="py-16 md:py-24 border-b border-gray-100 last:border-b-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`grid md:grid-cols-2 gap-12 lg:gap-16 items-center ${reverse ? 'md:grid-flow-dense' : ''}`}>
          <div className={reverse ? 'md:col-start-2' : ''}>
            {contentSection}
          </div>
          <div className={reverse ? 'md:col-start-1 md:row-start-1' : ''}>
            {mediaSection}
          </div>
        </div>
      </div>
    </section>
  );
}
