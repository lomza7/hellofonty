import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Calendar, Clock, ArrowLeft, Eye, Tag as TagIcon, Sun, Moon, MapPin, GraduationCap } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';
import SEO from '../components/SEO';
import BackButton from '../components/BackButton';

interface BlogPostData {
  id: string;
  slug: string;
  title_fr: string;
  title_en: string;
  content_fr: string;
  content_en: string;
  excerpt_fr: string;
  excerpt_en: string;
  featured_image: string;
  published_at: string;
  reading_time: number;
  view_count: number;
  meta_title_fr: string;
  meta_title_en: string;
  meta_description_fr: string;
  meta_description_en: string;
  category: {
    slug: string;
    name_fr: string;
    name_en: string;
    icon: string;
  };
  tags: Array<{
    id: string;
    name_fr: string;
    name_en: string;
    slug: string;
  }>;
}

const iconMap: Record<string, any> = {
  Sun,
  Moon,
  MapPin,
  GraduationCap,
};

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const { language } = useLanguage();
  const [post, setPost] = useState<BlogPostData | null>(null);
  const [relatedPosts, setRelatedPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (slug) {
      loadPost();
    }
  }, [slug]);

  const loadPost = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('blog_posts')
      .select(`
        *,
        category:blog_categories(slug, name_fr, name_en, icon),
        blog_post_tags(
          tag:blog_tags(id, name_fr, name_en, slug)
        )
      `)
      .eq('slug', slug)
      .eq('is_published', true)
      .maybeSingle();

    if (data) {
      const postData = {
        ...data,
        tags: data.blog_post_tags?.map((pt: any) => pt.tag) || [],
      };
      setPost(postData as any);

      await supabase
        .from('blog_posts')
        .update({ view_count: (data.view_count || 0) + 1 })
        .eq('id', data.id);

      if (data.category_id) {
        const { data: related } = await supabase
          .from('blog_posts')
          .select(`
            id,
            slug,
            title_fr,
            title_en,
            excerpt_fr,
            excerpt_en,
            featured_image,
            reading_time,
            published_at
          `)
          .eq('category_id', data.category_id)
          .eq('is_published', true)
          .neq('id', data.id)
          .order('published_at', { ascending: false })
          .limit(3);

        if (related) {
          setRelatedPosts(related);
        }
      }
    }

    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            {language === 'fr' ? 'Article non trouvé' : 'Article not found'}
          </h1>
          <Link to="/blog" className="text-blue-600 hover:text-blue-700 font-medium">
            {language === 'fr' ? 'Retour au blog' : 'Back to blog'}
          </Link>
        </div>
      </div>
    );
  }

  const Icon = iconMap[post.category.icon] || TagIcon;
  const title = language === 'fr' ? post.title_fr : post.title_en;
  const content = language === 'fr' ? post.content_fr : post.content_en;
  const metaTitle = language === 'fr' ? post.meta_title_fr || post.title_fr : post.meta_title_en || post.title_en;
  const metaDescription = language === 'fr' ? post.meta_description_fr || post.excerpt_fr : post.meta_description_en || post.excerpt_en;

  return (
    <>
      <SEO
        title={metaTitle}
        description={metaDescription}
        image={post.featured_image}
        type="article"
        article={{
          publishedTime: post.published_at,
          section: language === 'fr' ? post.category.name_fr : post.category.name_en,
          tags: post.tags.map(tag => language === 'fr' ? tag.name_fr : tag.name_en),
        }}
      />

      <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <BackButton />
        <Link
          to="/blog"
          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium mb-8"
        >
          <ArrowLeft className="w-5 h-5" />
          {language === 'fr' ? 'Retour au blog' : 'Back to blog'}
        </Link>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
              <Icon className="w-4 h-4" />
              {language === 'fr' ? post.category.name_fr : post.category.name_en}
            </span>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6 leading-tight">
            {title}
          </h1>

          <div className="flex items-center gap-6 text-gray-600">
            <span className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              {new Date(post.published_at).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
            <span className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              {post.reading_time} min
            </span>
            <span className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              {post.view_count || 0}
            </span>
          </div>
        </div>

        {post.featured_image && (
          <div className="mb-10 rounded-xl overflow-hidden">
            <img
              src={post.featured_image}
              alt={title}
              className="w-full h-auto"
            />
          </div>
        )}

        <div className="prose prose-lg max-w-none mb-12">
          <div
            dangerouslySetInnerHTML={{ __html: content.replace(/\n/g, '<br />') }}
            className="text-gray-800 leading-relaxed"
          />
        </div>

        {post.tags.length > 0 && (
          <div className="mb-12 pt-8 border-t border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <TagIcon className="w-5 h-5" />
              {language === 'fr' ? 'Tags' : 'Tags'}
            </h3>
            <div className="flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <span
                  key={tag.id}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-full text-sm font-medium hover:bg-gray-200 transition"
                >
                  {language === 'fr' ? tag.name_fr : tag.name_en}
                </span>
              ))}
            </div>
          </div>
        )}

        {relatedPosts.length > 0 && (
          <div className="pt-12 border-t border-gray-200">
            <h2 className="text-3xl font-bold text-gray-900 mb-8">
              {language === 'fr' ? 'Articles similaires' : 'Related articles'}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {relatedPosts.map((relatedPost) => (
                <Link
                  key={relatedPost.id}
                  to={`/blog/${relatedPost.slug}`}
                  className="bg-white rounded-lg shadow-md hover:shadow-lg transition overflow-hidden group"
                >
                  {relatedPost.featured_image && (
                    <div className="h-40 overflow-hidden">
                      <img
                        src={relatedPost.featured_image}
                        alt={language === 'fr' ? relatedPost.title_fr : relatedPost.title_en}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                    </div>
                  )}
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2 group-hover:text-blue-600 transition">
                      {language === 'fr' ? relatedPost.title_fr : relatedPost.title_en}
                    </h3>
                    <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                      {language === 'fr' ? relatedPost.excerpt_fr : relatedPost.excerpt_en}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {relatedPost.reading_time} min
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </article>
    </>
  );
}
