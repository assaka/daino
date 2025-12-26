import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { StorefrontProduct, StorefrontSeoSetting, StorefrontCmsPage } from '@/api/storefront-entities';
import { createCmsPageUrl, createProductUrl, createCategoryUrl } from '@/utils/urlUtils';
import { useStore } from '@/components/storefront/StoreProvider';
import { Layout, FileText, ChevronRight, Package } from 'lucide-react';
import { getPageTitle, getProductName, getCategoryName } from '@/utils/translationUtils';

export default function SitemapPublic() {
    const { storeCode } = useParams();
    const { store, categories: storeCategories } = useStore();
    const [categories, setCategories] = useState([]);
    const [products, setProducts] = useState([]);
    const [pages, setPages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [settings, setSettings] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch SEO settings first to determine what to display
                const seoSettings = store?.id ? await StorefrontSeoSetting.filter({ store_id: store.id }) : [];
                const seoRecord = seoSettings?.[0];

                // Extract HTML sitemap settings from JSON field
                const htmlSitemapSettings = seoRecord?.html_sitemap_settings || {
                    enabled: true,
                    include_categories: true,
                    include_products: true,
                    include_pages: true,
                    max_products: 20,
                    product_sort: '-updated_date'
                };

                setSettings(htmlSitemapSettings);

                // Only fetch data if sitemap is enabled
                if (!htmlSitemapSettings.enabled) {
                    setLoading(false);
                    return;
                }

                // Fetch data based on settings
                const promises = [];

                // Products - fetch from API
                if (htmlSitemapSettings.include_products) {
                    const maxProducts = htmlSitemapSettings.max_products || 20;
                    promises.push(
                        store?.id
                            ? StorefrontProduct.filter({ status: 'active', store_id: store.id, limit: maxProducts })
                            : Promise.resolve([])
                    );
                } else {
                    promises.push(Promise.resolve([]));
                }

                // CMS Pages - fetch from API
                if (htmlSitemapSettings.include_pages) {
                    promises.push(
                        store?.id
                            ? StorefrontCmsPage.filter({ is_active: true, store_id: store.id })
                            : Promise.resolve([])
                    );
                } else {
                    promises.push(Promise.resolve([]));
                }

                const [productData, pageData] = await Promise.all(promises);

                // Categories - use from store context (already loaded in bootstrap)
                const categoryData = htmlSitemapSettings.include_categories ? (storeCategories || []) : [];

                // Filter out only 404 page from sitemap - other system pages like privacy policy should be included
                const sitemapPages = (pageData || []).filter(page => page.slug !== '404-page-not-found');

                console.log('Sitemap data fetched:', {
                    categories: categoryData,
                    products: productData,
                    pages: pageData,
                    sitemapPages: sitemapPages,
                    storeId: store?.id
                });

                setCategories(categoryData || []);
                setProducts(productData || []);
                setPages(sitemapPages);
            } catch (error) {
                console.error("Error fetching sitemap data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [store?.id, storeCategories]);

    // Flatten nested category tree into a flat array
    const flattenCategories = (cats, result = []) => {
        for (const cat of cats) {
            result.push(cat);
            if (cat.children && cat.children.length > 0) {
                flattenCategories(cat.children, result);
            }
        }
        return result;
    };

    const flatCategories = flattenCategories(categories);
    const categoryIds = new Set(flatCategories.map(cat => cat.id));

    const renderCategoryTree = (parentId = null) => {
        // Find children: either parent_id matches, OR parent_id points to non-existent category (orphan = treat as root)
        const children = flatCategories.filter(cat => {
            if (parentId === null) {
                // Root level: include categories with null parent OR orphans (parent doesn't exist in list)
                return cat.parent_id === null || !categoryIds.has(cat.parent_id);
            }
            return cat.parent_id === parentId;
        });

        if (children.length === 0) return null;

        return (
            <ul className={parentId ? "pl-6" : ""}>
                {children.map(category => (
                    <li key={category.id} className="my-2">
                        <Link to={createCategoryUrl(store?.slug || storeCode, category.slug)} className="flex items-center text-blue-600 hover:underline">
                            <ChevronRight className="w-4 h-4 mr-2" />
                            {getCategoryName(category)}
                        </Link>
                        {renderCategoryTree(category.id)}
                    </li>
                ))}
            </ul>
        );
    };

    if (loading) {
        return <div className="p-8 text-center">Loading sitemap...</div>;
    }

    // Check if HTML sitemap is disabled
    if (settings && !settings.enabled) {
        return (
            <div className="max-w-4xl mx-auto p-8 bg-white my-8 rounded-lg shadow">
                <h1 className="text-3xl font-bold mb-8 text-gray-800">HTML Sitemap</h1>
                <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-yellow-800">
                        HTML sitemap is currently disabled.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-8 bg-white my-8 rounded-lg shadow">
            <h1 className="text-3xl font-bold mb-8 text-gray-800">HTML Sitemap</h1>

            {settings?.include_categories && (
                <section className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4 border-b pb-2 flex items-center">
                        <Layout className="w-6 h-6 mr-3 text-gray-600"/>
                        Categories
                    </h2>
                    {categories.length > 0 ? renderCategoryTree() : <p>No categories found.</p>}
                </section>
            )}

            {settings?.include_products && (
                <section className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4 border-b pb-2 flex items-center">
                        <Package className="w-6 h-6 mr-3 text-gray-600"/>
                        Featured Products
                    </h2>
                    {products.length > 0 ? (
                        <ul>
                            {products.map(product => (
                                <li key={product.id} className="my-2">
                                    <Link to={createProductUrl(store?.slug || storeCode, product.slug)} className="flex items-center text-blue-600 hover:underline">
                                        <ChevronRight className="w-4 h-4 mr-2" />
                                        {getProductName(product)}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    ) : <p>No products found.</p>}
                </section>
            )}

            {settings?.include_pages && (
                <section>
                    <h2 className="text-2xl font-semibold mb-4 border-b pb-2 flex items-center">
                        <FileText className="w-6 h-6 mr-3 text-gray-600"/>
                        Pages
                    </h2>
                    {pages.length > 0 ? (
                        <ul>
                            {pages.map(page => (
                                <li key={page.id} className="my-2">
                                    <Link to={createCmsPageUrl(store?.slug || storeCode, page.slug)} className="flex items-center text-blue-600 hover:underline">
                                        <ChevronRight className="w-4 h-4 mr-2" />
                                        {getPageTitle(page)}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    ) : <p>No additional pages found.</p>}
                </section>
            )}
        </div>
    );
}
