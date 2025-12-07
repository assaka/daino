import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { StorefrontCmsPage, StorefrontProduct } from '@/api/storefront-entities';
import RecommendedProducts from '@/components/storefront/RecommendedProducts';
import SeoHeadManager from '@/components/storefront/SeoHeadManager';
import { buildCmsBreadcrumbs } from '@/utils/breadcrumbUtils';
import { useStore } from '@/components/storefront/StoreProvider';
// Redirect handling moved to global RedirectHandler component
import { useNotFound } from '@/utils/notFoundUtils';
import { getPageTitle, getPageContent, getProductName, getCurrentLanguage } from '@/utils/translationUtils';
import { Input } from '@/components/ui/input';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Process store variables in CMS content
 * Replaces {{store_name}}, {{store_email}}, etc. with actual store values
 */
function processStoreVariables(content, store, settings) {
    if (!content || typeof content !== 'string') return content;

    const variables = {
        store_name: store?.name || '',
        store_email: store?.contact_email || settings?.contact_email || '',
        store_phone: store?.contact_phone || settings?.contact_phone || '',
        store_address: store?.address || settings?.store_address || '',
        store_city: store?.city || settings?.store_city || '',
        store_country: store?.country || settings?.store_country || '',
        store_currency: settings?.currency_symbol || '$',
    };

    return content.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        return variables[key] !== undefined ? variables[key] : match;
    });
}

export default function CmsPageViewer() {
    const { pageSlug, storeCode } = useParams();
    const { settings, store } = useStore();
    const slug = pageSlug;
    const { showNotFound } = useNotFound();
    const [page, setPage] = useState(null);
    const [relatedProducts, setRelatedProducts] = useState([]);
    const [filteredProducts, setFilteredProducts] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const fetchingRef = useRef(false); // Prevent duplicate calls

    useEffect(() => {
        if (!slug) {
            setLoading(false);
            return;
        }
        if (slug) {
            const fetchPage = async () => {
                // Prevent duplicate calls (React Strict Mode runs effects twice)
                if (fetchingRef.current) {
                    return;
                }

                try {
                    fetchingRef.current = true;
                    setLoading(true);
                    const currentLanguage = localStorage.getItem('daino_language') || 'en';

                    // Fetch CMS page using StorefrontCmsPage which uses public API (better performance)
                    if (!store?.id) {
                        setLoading(false);
                        fetchingRef.current = false;
                        return;
                    }
                    const pages = await StorefrontCmsPage.filter({ slug: slug, store_id: store.id });

                    if (pages && pages.length > 0) {
                        const currentPage = pages[0];
                        setPage(currentPage);
                        if (currentPage.related_product_ids && currentPage.related_product_ids.length > 0) {
                            // Fetch only the related products using storefront API with specific IDs
                            const products = await StorefrontProduct.filter({
                                id: { $in: currentPage.related_product_ids }
                            });
                            setRelatedProducts(products || []);
                            setFilteredProducts(products || []);
                        }
                    } else {
                        // Global redirect handler already checked - just show 404
                        setPage(null);
                    }
                } catch (error) {
                } finally {
                    setLoading(false);
                    fetchingRef.current = false;
                }
            };
            fetchPage();
        }
    }, [slug, store?.id]); // Re-run when store_id becomes available

    // Listen for language changes and refetch the page
    useEffect(() => {
        const handleLanguageChange = (event) => {
            const newLanguage = event.detail?.language;

            // Refetch the page with new language
            if (slug) {
                const fetchPage = async () => {
                    try {
                        setLoading(true);

                        // Use StorefrontCmsPage which uses public API (better performance)
                        if (!store?.id) {
                            return;
                        }
                        const pages = await StorefrontCmsPage.filter({ slug: slug, store_id: store.id });

                        if (pages && pages.length > 0) {
                            const currentPage = pages[0];
                            setPage(currentPage);
                        }
                    } catch (error) {
                    } finally {
                        setLoading(false);
                    }
                };
                fetchPage();
            }
        };

        window.addEventListener('languageChanged', handleLanguageChange);
        return () => window.removeEventListener('languageChanged', handleLanguageChange);
    }, [slug]);

    // Filter related products based on search query
    useEffect(() => {
        if (!searchQuery.trim()) {
            setFilteredProducts(relatedProducts);
            return;
        }

        const searchLower = searchQuery.toLowerCase();
        const currentLang = getCurrentLanguage();

        const filtered = relatedProducts.filter(product => {
            const translatedName = getProductName(product, currentLang) || product.name || '';
            const sku = product.sku || '';

            return (
                translatedName.toLowerCase().includes(searchLower) ||
                sku.toLowerCase().includes(searchLower)
            );
        });

        setFilteredProducts(filtered);
    }, [searchQuery, relatedProducts]);

    const clearSearch = () => {
        setSearchQuery('');
    };

    if (loading) {
        return <div className="text-center p-8">Loading...</div>;
    }

    if (!page && !loading) {
        // Trigger 404 page display
        showNotFound(`CMS page "${slug}" not found`);
        return null;
    }

    const rawPageTitle = getPageTitle(page);
    const rawPageContent = getPageContent(page);

    // Process store variables ({{store_name}}, {{store_email}}, etc.)
    const pageTitle = processStoreVariables(rawPageTitle, store, settings);
    const pageContent = processStoreVariables(rawPageContent, store, settings);

    return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <SeoHeadManager
                pageType="cms_page"
                pageData={{
                    ...page,
                    breadcrumbs: buildCmsBreadcrumbs(page, storeCode, settings)
                }}
                pageTitle={pageTitle}
            />
            <article className="prose lg:prose-xl mx-auto bg-white p-8 rounded-lg shadow">
                <h1>{pageTitle}</h1>
                <div dangerouslySetInnerHTML={{ __html: pageContent }} />
            </article>

            {relatedProducts.length > 0 && (
                <div className="mt-16">
                    {/* Search bar for related products */}
                    <div className="max-w-md mx-auto">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <Input
                                type="text"
                                placeholder="Search related products..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 pr-12 py-2 w-full"
                            />
                            {searchQuery && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                                    onClick={clearSearch}
                                >
                                    <X className="w-4 h-4" />
                                </Button>
                            )}
                        </div>
                    </div>

                    {filteredProducts.length > 0 ? (
                        <RecommendedProducts products={filteredProducts} title="Related Products" />
                    ) : (
                        <div className="text-center text-gray-500 py-8">
                            No products found matching "{searchQuery}"
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}