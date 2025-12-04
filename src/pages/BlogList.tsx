import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search, Calendar, Clock, Tag, ChevronRight, Sun, Moon, MapPin, GraduationCap } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';
import SEO from '../components/SEO';

interface BlogPost {
  id: string;
  slug: string;
  title_fr: string;
  title_en: string;
  excerpt_fr: string;
  excerpt_en: string;
  featured_image: string;
  published_at: string;
  reading_time: number;
  view_count: number;
  category: {
    slug: string;
    name_fr: string;
    name_en: string;
    icon: string;
  };
}

const iconMap: Record<string, any> = {
  Sun,
  Moon,
  MapPin,
  GraduationCap,
};

export default function BlogList() {
  const { language } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>(searchParams.get('category') || 'all');
  const [categories, setCategories] = useState<any[]>([]);

  useEffect(() => {
    loadCategories();
    loadPosts();
  }, [selectedCategory]);

  const loadCategories = async () => {
    const { data } = await supabase
      .from('blog_categories')
      .select('*')
      .order('slug');

    if (data) {
      setCategories(data);
    }
  };

  const loadPosts = async () => {
    setLoading(true);
    let query = supabase
      .from('blog_posts')
      .select(`
        *,
        category:blog_categories(slug, name_fr, name_en, icon)
      `)
      .eq('is_published', true)
      .order('published_at', { ascending: false });

    if (selectedCategory !== 'all') {
      const category = categories.find(c => c.slug === selectedCategory);
      if (category) {
        query = query.eq('category_id', category.id);
      }
    }

    const { data } = await query;

    if (data) {
      setPosts(data as any);
    }

    setLoading(false);
  };

  const filteredPosts = posts.filter(post => {
    const title = language === 'fr' ? post.title_fr : post.title_en;
    const excerpt = language === 'fr' ? post.excerpt_fr : post.excerpt_en;
    const query = searchQuery.toLowerCase();

    return title.toLowerCase().includes(query) || excerpt.toLowerCase().includes(query);
  });

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    if (category === 'all') {
      searchParams.delete('category');
    } else {
      searchParams.set('category', category);
    }
    setSearchParams(searchParams);
  };

  const metaTitle = language === 'fr'
    ? 'Blog - Vie à Fontainebleau pour Étudiants INSEAD'
    : 'Blog - Life in Fontainebleau for INSEAD Students';

  const metaDescription = language === 'fr'
    ? 'Découvrez nos articles sur la vie quotidienne et nocturne à Fontainebleau. Guides pratiques, conseils et astuces pour les étudiants INSEAD.'
    : 'Discover our articles about daily and night life in Fontainebleau. Practical guides, tips and tricks for INSEAD students.';

  return (
    <>
      <SEO
        title={metaTitle}
        description={metaDescription}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            {language === 'fr' ? 'Blog HELLOFONTY' : 'HELLOFONTY Blog'}
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            {language === 'fr'
              ? 'Découvrez la vie à Fontainebleau : guides, conseils et actualités pour les étudiants'
              : 'Discover life in Fontainebleau: guides, tips and news for students'}
          </p>
        </div>

        <div className="mb-8">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder={language === 'fr' ? 'Rechercher un article...' : 'Search articles...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mb-12">
          <button
            onClick={() => handleCategoryChange('all')}
            className={`px-6 py-2 rounded-full font-medium transition ${
              selectedCategory === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
            }`}
          >
            {language === 'fr' ? 'Tous les articles' : 'All articles'}
          </button>
          {categories.map((category) => {
            const Icon = iconMap[category.icon] || Tag;
            return (
              <button
                key={category.slug}
                onClick={() => handleCategoryChange(category.slug)}
                className={`px-6 py-2 rounded-full font-medium transition flex items-center gap-2 ${
                  selectedCategory === category.slug
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {language === 'fr' ? category.name_fr : category.name_en}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-xl text-gray-600">
              {language === 'fr' ? 'Aucun article trouvé' : 'No articles found'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredPosts.map((post) => {
              const Icon = iconMap[post.category.icon] || Tag;
              return (
                <Link
                  key={post.id}
                  to={`/blog/${post.slug}`}
                  className="bg-white rounded-xl shadow-md hover:shadow-xl transition group overflow-hidden"
                >
                  {post.featured_image && (
                    <div className="relative h-48 overflow-hidden">
                      <img
                        src={post.featured_image}
                        alt={language === 'fr' ? post.title_fr : post.title_en}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                      <div className="absolute top-4 left-4">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/95 backdrop-blur-sm rounded-full text-sm font-medium text-gray-700">
                          <Icon className="w-4 h-4" />
                          {language === 'fr' ? post.category.name_fr : post.category.name_en}
                        </span>
                      </div>
                    </div>
                  )}
                  <div className="p-6">
                    <h2 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-blue-600 transition line-clamp-2">
                      {language === 'fr' ? post.title_fr : post.title_en}
                    </h2>
                    <p className="text-gray-600 mb-4 line-clamp-3">
                      {language === 'fr' ? post.excerpt_fr : post.excerpt_en}
                    </p>
                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {new Date(post.published_at).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {post.reading_time} min
                        </span>
                      </div>
                      <ChevronRight className="w-5 h-5 text-blue-600 group-hover:translate-x-1 transition" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
