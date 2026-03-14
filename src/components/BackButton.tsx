import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export default function BackButton() {
  const navigate = useNavigate();
  const { language } = useLanguage();

  return (
    <button
      onClick={() => navigate(-1)}
      className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors group mb-6"
    >
      <span className="flex items-center justify-center w-8 h-8 rounded-full border border-gray-200 bg-white shadow-sm group-hover:border-gray-400 group-hover:shadow transition-all">
        <ArrowLeft className="w-4 h-4" />
      </span>
      <span>{language === 'fr' ? 'Retour' : 'Back'}</span>
    </button>
  );
}
