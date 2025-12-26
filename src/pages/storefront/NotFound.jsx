import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CmsPage } from '@/api/entities';
import { useStore } from '@/components/storefront/StoreProvider';
import SeoHeadManager from '@/components/storefront/SeoHeadManager';
import { getPageTitle, getPageContent, getCurrentLanguage } from '@/utils/translationUtils';
import { createPublicUrl } from '@/utils/urlUtils';
import { Home, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageLoader } from '@/components/ui/page-loader';

export default function NotFound() {
  const { storeCode } = useParams();
  const { store } = useStore();
  const [cmsPage, setCmsPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const currentLang = getCurrentLanguage();

  useEffect(() => {
    const fetchNotFoundPage = async () => {
      if (!store?.id) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        // Try to fetch a CMS page with slug '404-page-not-found' for this specific store
        let pages = await CmsPage.filter({ slug: '404-page-not-found', is_active: true, store_id: store.id });
        setCmsPage(pages[0]);
      } catch (error) {
        console.error("Error fetching 404 CMS page:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchNotFoundPage();
  }, [store?.id]);

  if (loading) {
    return <PageLoader size="lg" fullScreen={false} className="py-16 min-h-[400px]" />;
  }

  const effectiveStoreCode = storeCode || store?.slug || store?.code;
  const homeUrl = effectiveStoreCode ? createPublicUrl(effectiveStoreCode, 'STOREFRONT') : '/';

  const pageTitle = getPageTitle(cmsPage, currentLang);
  const pageContent = getPageContent(cmsPage, currentLang);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <SeoHeadManager
        pageType="404"
        pageData={cmsPage}
        pageTitle={pageTitle || "Page Not Found"}
      />
      <article className="prose lg:prose-xl mx-auto bg-white p-8 rounded-lg shadow">
        <div dangerouslySetInnerHTML={{ __html: pageContent }} />
      </article>
    </div>
  );
}
