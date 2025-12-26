import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CmsPage } from '@/api/entities';
import { useStore } from '@/components/storefront/StoreProvider';
import { createPublicUrl } from '@/utils/urlUtils';
import SeoHeadManager from '@/components/storefront/SeoHeadManager';
import { Button } from '@/components/ui/button';
import { Home, Search, ArrowLeft } from 'lucide-react';
import { getPageTitle, getPageContent, getCurrentLanguage } from '@/utils/translationUtils';

const NotFoundPage = () => {
  const { store } = useStore();
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load404Page = async () => {
      if (!store?.id) {
        setLoading(false);
        return;
      }

      try {
        // Try to find a CMS page with slug '404-page-not-found' for this store
        const pages = await CmsPage.filter({
          slug: '404-page-not-found',
          is_active: true,
          store_id: store.id
        });

        if (pages && pages.length > 0) {
          setPage(pages[0]);
        }
      } catch (error) {
        console.error('Error loading 404 page:', error);
      } finally {
        setLoading(false);
      }
    };

    load404Page();
  }, [store?.id]);

  // Show loading spinner while checking for custom 404 page
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // If custom 404 CMS page exists, show it
  if (page) {
    const currentLang = getCurrentLanguage();
    const pageTitle = getPageTitle(page, currentLang);
    const pageContent = getPageContent(page, currentLang);

    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <SeoHeadManager
          pageType="cms_page"
          pageData={{
            ...page,
            meta_title: page.meta_title || '404 - Page Not Found',
            meta_description: page.meta_description || 'The page you are looking for could not be found.'
          }}
          pageTitle={pageTitle || "404 - Page Not Found"}
        />
        <article className="prose lg:prose-xl mx-auto bg-white p-8 rounded-lg shadow">
          <div dangerouslySetInnerHTML={{ __html: pageContent }} />
        </article>
      </div>
    );
  }

  // Fallback default 404 page if no custom CMS page exists
  return (
    <div className="flex items-center justify-center bg-gray-50 px-4 sm:px-6 lg:px-8 py-16">
      <SeoHeadManager
        pageType="error"
        pageData={{
          meta_title: '404 - Page Not Found',
          meta_description: 'The page you are looking for could not be found.',
          meta_robots_tag: 'noindex, nofollow'
        }}
        pageTitle="404 - Page Not Found"
      />

      <div className="max-w-md w-full text-center">
        <div className="mb-8">
          <div className="mx-auto h-24 w-24 text-gray-400 mb-6">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-full h-full">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.29-1.009-5.824-2.562M15 6.75a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          
          {/* Large 404 */}
          <h1 className="text-9xl font-bold text-gray-400 mb-4">404</h1>
          
          {/* Error message */}
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Page Not Found</h2>
          <p className="text-gray-600 mb-8">
            Sorry, we couldn't find the page you're looking for. It may have been moved, deleted, or you might have entered the wrong URL.
          </p>
        </div>

        {/* Action buttons */}
        <div className="space-y-3">
          {store && (
            <Link to={createPublicUrl(store.slug, 'STOREFRONT')}>
              <Button className="w-full flex items-center justify-center space-x-2">
                <Home className="w-4 h-4" />
                <span>Back to {store.name || 'Home'}</span>
              </Button>
            </Link>
          )}
          
          <Button 
            variant="outline" 
            onClick={() => window.history.back()} 
            className="w-full flex items-center justify-center space-x-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Go Back</span>
          </Button>

          {store && (
            <Link to={createPublicUrl(store.slug, 'STOREFRONT')}>
              <Button 
                variant="ghost" 
                className="w-full flex items-center justify-center space-x-2 text-gray-600"
              >
                <Search className="w-4 h-4" />
                <span>Search Our Store</span>
              </Button>
            </Link>
          )}
        </div>

        {/* Help text */}
        <div className="mt-8 text-sm text-gray-500">
          <p>If you believe this is an error, please contact our support team.</p>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;