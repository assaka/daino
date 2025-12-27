import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import SaveButton from '@/components/ui/save-button';
import { Switch } from "@/components/ui/switch";
import { FileText, Download, RefreshCw, CheckCircle, AlertCircle, Upload, Image, Video, Newspaper } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Product } from '@/api/entities';
import { Category } from '@/api/entities';
import { CmsPage } from '@/api/entities';
import { SeoSetting } from '@/api/entities';
import { useStoreSelection } from '@/contexts/StoreSelectionContext';
import FlashMessage from '@/components/storefront/FlashMessage';
import apiClient from '@/api/client';

export default function XmlSitemap() {
    const { selectedStore: store, getSelectedStoreId } = useStoreSelection();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [sitemapXml, setSitemapXml] = useState('');
    const [flashMessage, setFlashMessage] = useState(null);
    const [primaryDomain, setPrimaryDomain] = useState(null);

    // Determine base URL: use primary custom domain if available, otherwise use origin
    const sitemapBaseUrl = primaryDomain
        ? `https://${primaryDomain}`
        : window.location.origin;

    // Statistics
    const [stats, setStats] = useState({
        totalUrls: 0,
        products: 0,
        categories: 0,
        pages: 0
    });

    // Settings
    const [seoSettingId, setSeoSettingId] = useState(null);
    const [settings, setSettings] = useState({
        sitemap_include_products: true,
        sitemap_include_categories: true,
        sitemap_include_pages: true,
        sitemap_include_images: false,
        sitemap_include_videos: false,
        sitemap_enable_news: false,
        sitemap_max_urls: 50000,
        // Priority and changefreq per URL group
        category_priority: '0.8',
        category_changefreq: 'weekly',
        product_priority: '0.7',
        product_changefreq: 'daily',
        page_priority: '0.6',
        page_changefreq: 'monthly'
    });

    // Changefreq options for dropdown
    const changefreqOptions = [
        { value: 'always', label: 'Always' },
        { value: 'hourly', label: 'Hourly' },
        { value: 'daily', label: 'Daily' },
        { value: 'weekly', label: 'Weekly' },
        { value: 'monthly', label: 'Monthly' },
        { value: 'yearly', label: 'Yearly' },
        { value: 'never', label: 'Never' }
    ];

    // Priority options for dropdown
    const priorityOptions = [
        { value: '1.0', label: '1.0 (Highest)' },
        { value: '0.9', label: '0.9' },
        { value: '0.8', label: '0.8' },
        { value: '0.7', label: '0.7' },
        { value: '0.6', label: '0.6' },
        { value: '0.5', label: '0.5 (Default)' },
        { value: '0.4', label: '0.4' },
        { value: '0.3', label: '0.3' },
        { value: '0.2', label: '0.2' },
        { value: '0.1', label: '0.1 (Lowest)' }
    ];

    // Load existing settings and custom domains
    useEffect(() => {
        const loadSettings = async () => {
            if (!store?.id) return;

            try {
                setLoading(true);

                // Load SEO settings and custom domains in parallel
                const [seoResult, domainsResponse] = await Promise.all([
                    SeoSetting.filter({ store_id: store.id }),
                    apiClient.get('/custom-domains').catch(() => ({ success: false, domains: [] }))
                ]);

                // Process SEO settings
                if (seoResult && seoResult.length > 0) {
                    const existingSettings = seoResult[0];
                    setSeoSettingId(existingSettings.id);

                    // Extract from JSON field
                    const xmlSettings = existingSettings.xml_sitemap_settings || {};

                    setSettings({
                        sitemap_include_products: xmlSettings.include_products ?? true,
                        sitemap_include_categories: xmlSettings.include_categories ?? true,
                        sitemap_include_pages: xmlSettings.include_pages ?? true,
                        sitemap_include_images: xmlSettings.include_images ?? false,
                        sitemap_include_videos: xmlSettings.include_videos ?? false,
                        sitemap_enable_news: xmlSettings.enable_news ?? false,
                        sitemap_max_urls: xmlSettings.max_urls ?? 50000,
                        // Priority and changefreq per URL group
                        category_priority: xmlSettings.category_priority ?? '0.8',
                        category_changefreq: xmlSettings.category_changefreq ?? 'weekly',
                        product_priority: xmlSettings.product_priority ?? '0.7',
                        product_changefreq: xmlSettings.product_changefreq ?? 'daily',
                        page_priority: xmlSettings.page_priority ?? '0.6',
                        page_changefreq: xmlSettings.page_changefreq ?? 'monthly'
                    });
                }

                // Find primary active custom domain
                if (domainsResponse.success && domainsResponse.domains?.length > 0) {
                    const activePrimary = domainsResponse.domains.find(
                        d => d.is_primary && d.verification_status === 'verified' && d.ssl_status === 'active'
                    );
                    if (activePrimary) {
                        setPrimaryDomain(activePrimary.domain);
                    }
                }
            } catch (error) {
                console.error('Error loading SEO settings:', error);
                setFlashMessage({ type: 'error', message: 'Failed to load sitemap settings' });
            } finally {
                setLoading(false);
            }
        };

        loadSettings();
    }, [store?.id]);

    // Generate sitemap whenever settings change or on mount
    useEffect(() => {
        if (store?.id && !loading) {
            generateSitemap();
        }
    }, [store?.id, loading]);

    // Helper function to safely format dates
    const formatDate = (dateValue) => {
        try {
            if (!dateValue) return new Date().toISOString().split('T')[0];
            const date = new Date(dateValue);
            if (isNaN(date.getTime())) {
                return new Date().toISOString().split('T')[0];
            }
            return date.toISOString().split('T')[0];
        } catch (error) {
            return new Date().toISOString().split('T')[0];
        }
    };

    const generateSitemap = async () => {
        if (!store?.id) return;

        try {
            setGenerating(true);
            // Use findPaginated with high limit to get all items for sitemap
            const [productsResult, categoriesResult, pagesResult] = await Promise.all([
                Product.findPaginated(1, 10000, { status: 'active', store_id: store.id }),
                Category.findPaginated(1, 10000, { is_active: true, store_id: store.id }),
                CmsPage.findPaginated(1, 10000, { is_active: true, store_id: store.id })
            ]);

            const products = productsResult?.data || [];
            const categories = categoriesResult?.data || [];
            const pages = pagesResult?.data || [];

            // Generate standard sitemap (includes images, videos, news when enabled)
            const standardSitemap = generateStandardSitemap(products, categories, pages);
            setSitemapXml(standardSitemap.xml);

            setStats({
                totalUrls: standardSitemap.stats.totalUrls,
                categories: standardSitemap.stats.categories,
                products: standardSitemap.stats.products,
                pages: standardSitemap.stats.pages
            });
        } catch (error) {
            console.error('Error generating sitemap:', error);
            setFlashMessage({ type: 'error', message: 'Failed to generate sitemap' });
        } finally {
            setGenerating(false);
        }
    };

    const generateStandardSitemap = (products, categories, pages) => {
        // Build namespace string based on enabled features
        let namespaces = 'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"';
        if (settings.sitemap_include_images) {
            namespaces += ' xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"';
        }
        if (settings.sitemap_include_videos) {
            namespaces += ' xmlns:video="http://www.google.com/schemas/sitemap-video/1.1"';
        }
        if (settings.sitemap_enable_news) {
            namespaces += ' xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"';
        }

        let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset ${namespaces}>
  <url>
    <loc>${sitemapBaseUrl}</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
  </url>`;

        let urlCount = 1;
        let categoryCount = 0;
        let productCount = 0;
        let pageCount = 0;

        // Add categories
        if (settings.sitemap_include_categories && categories?.length > 0) {
            categories.forEach(category => {
                const lastmod = formatDate(category.updatedAt || category.updated_date || category.createdAt || category.created_date);
                xml += `
  <url>
    <loc>${sitemapBaseUrl}/category/${category.slug || category.id}</loc>
    <changefreq>${settings.category_changefreq}</changefreq>
    <priority>${settings.category_priority}</priority>
    <lastmod>${lastmod}</lastmod>`;

                // Add image if enabled and available
                if (settings.sitemap_include_images && category.image_url) {
                    xml += `
    <image:image>
      <image:loc>${category.image_url}</image:loc>
      <image:title>${escapeXml(category.name || 'Category Image')}</image:title>
    </image:image>`;
                }

                xml += `
  </url>`;
                categoryCount++;
            });
        }

        // Add products
        if (settings.sitemap_include_products && products?.length > 0) {
            products.forEach(product => {
                const lastmod = formatDate(product.updatedAt || product.updated_date || product.createdAt || product.created_date);
                xml += `
  <url>
    <loc>${sitemapBaseUrl}/product/${product.slug || product.id}</loc>
    <changefreq>${settings.product_changefreq}</changefreq>
    <priority>${settings.product_priority}</priority>
    <lastmod>${lastmod}</lastmod>`;

                // Add images if enabled
                if (settings.sitemap_include_images) {
                    // Main image
                    if (product.image_url) {
                        xml += `
    <image:image>
      <image:loc>${product.image_url}</image:loc>
      <image:title>${escapeXml(product.name || 'Product Image')}</image:title>
      ${product.description ? `<image:caption>${escapeXml(product.description.substring(0, 256))}</image:caption>` : ''}
    </image:image>`;
                    }
                    // Gallery images
                    if (product.gallery_images && Array.isArray(product.gallery_images)) {
                        product.gallery_images.slice(0, 10).forEach((img, idx) => {
                            xml += `
    <image:image>
      <image:loc>${img.url || img}</image:loc>
      <image:title>${escapeXml(product.name)} - Image ${idx + 1}</image:title>
    </image:image>`;
                        });
                    }
                }

                // Add video if enabled and available
                if (settings.sitemap_include_videos && product.video_url) {
                    xml += `
    <video:video>
      <video:thumbnail_loc>${product.video_thumbnail || product.image_url || ''}</video:thumbnail_loc>
      <video:title>${escapeXml(product.name || 'Product Video')}</video:title>
      <video:description>${escapeXml(product.description?.substring(0, 256) || product.name || '')}</video:description>
      <video:content_loc>${product.video_url}</video:content_loc>
    </video:video>`;
                }

                xml += `
  </url>`;
                productCount++;
            });
        }

        // Add CMS pages
        if (settings.sitemap_include_pages && pages?.length > 0) {
            pages.forEach(page => {
                const lastmod = formatDate(page.updatedAt || page.updated_date || page.createdAt || page.created_date);
                xml += `
  <url>
    <loc>${sitemapBaseUrl}/page/${page.slug}</loc>
    <changefreq>${settings.page_changefreq}</changefreq>
    <priority>${settings.page_priority}</priority>
    <lastmod>${lastmod}</lastmod>`;

                // Add image if enabled and available
                if (settings.sitemap_include_images && page.featured_image) {
                    xml += `
    <image:image>
      <image:loc>${page.featured_image}</image:loc>
      <image:title>${escapeXml(page.title || 'Page Image')}</image:title>
    </image:image>`;
                }

                // Add video if enabled and available
                if (settings.sitemap_include_videos && page.video_url) {
                    xml += `
    <video:video>
      <video:thumbnail_loc>${page.video_thumbnail || page.featured_image || ''}</video:thumbnail_loc>
      <video:title>${escapeXml(page.title || 'Page Video')}</video:title>
      <video:description>${escapeXml(page.content?.substring(0, 256) || page.title || '')}</video:description>
      <video:content_loc>${page.video_url}</video:content_loc>
    </video:video>`;
                }

                // Add news if enabled and page is a news article
                if (settings.sitemap_enable_news && page.is_news_article) {
                    const pubDate = new Date(page.createdAt || page.created_date);
                    xml += `
    <news:news>
      <news:publication>
        <news:name>${escapeXml(store?.name || 'Store')}</news:name>
        <news:language>${page.language || 'en'}</news:language>
      </news:publication>
      <news:publication_date>${pubDate.toISOString()}</news:publication_date>
      <news:title>${escapeXml(page.title)}</news:title>
    </news:news>`;
                }

                xml += `
  </url>`;
                pageCount++;
            });
        }

        xml += '\n</urlset>';

        return {
            xml,
            count: urlCount + categoryCount + productCount + pageCount,
            stats: {
                totalUrls: urlCount + categoryCount + productCount + pageCount,
                categories: categoryCount,
                products: productCount,
                pages: pageCount
            }
        };
    };

    // Helper to escape XML special characters
    const escapeXml = (str) => {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    };

    const handleSave = async () => {
        if (!store?.id) return;

        setSaving(true);
        setSaveSuccess(false);

        try {
            // Package settings into JSON structure
            const xmlSitemapSettings = {
                enabled: settings.enable_sitemap ?? true,
                include_products: settings.sitemap_include_products,
                include_categories: settings.sitemap_include_categories,
                include_pages: settings.sitemap_include_pages,
                include_images: settings.sitemap_include_images,
                include_videos: settings.sitemap_include_videos,
                enable_news: settings.sitemap_enable_news,
                max_urls: settings.sitemap_max_urls,
                // Priority and changefreq per URL group
                category_priority: settings.category_priority,
                category_changefreq: settings.category_changefreq,
                product_priority: settings.product_priority,
                product_changefreq: settings.product_changefreq,
                page_priority: settings.page_priority,
                page_changefreq: settings.page_changefreq
            };

            const payload = {
                store_id: store.id,
                xml_sitemap_settings: xmlSitemapSettings
            };

            if (seoSettingId) {
                await SeoSetting.update(seoSettingId, payload);
            } else {
                const created = await SeoSetting.create(payload);
                setSeoSettingId(created.id);
            }

            setSaveSuccess(true);
            setFlashMessage({ type: 'success', message: 'Sitemap settings saved successfully' });

            // Regenerate sitemap with new settings
            await generateSitemap();

            setTimeout(() => setSaveSuccess(false), 2000);
        } catch (error) {
            console.error('Error saving sitemap settings:', error);
            setFlashMessage({ type: 'error', message: 'Failed to save sitemap settings' });
        } finally {
            setSaving(false);
        }
    };

    const downloadSitemap = (xml, filename = 'sitemap.xml') => {
        const blob = new Blob([xml], { type: 'application/xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    if (loading) {
        return (
            <div className="container mx-auto p-6">
                <div className="flex items-center gap-2 mb-6">
                    <FileText className="h-6 w-6" />
                    <h1 className="text-3xl font-bold">XML Sitemap</h1>
                </div>
                <p>Loading sitemap settings...</p>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6 space-y-6">
            <FlashMessage message={flashMessage} onClose={() => setFlashMessage(null)} />

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div className="flex items-center gap-2">
                    <FileText className="h-6 w-6" />
                    <h1 className="text-3xl font-bold">XML Sitemap</h1>
                </div>
            </div>

            {/* Statistics Card */}
            <Card>
                <CardHeader>
                    <CardTitle>Sitemap Statistics</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                        <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
                            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.totalUrls}</div>
                            <div className="text-sm text-muted-foreground">Total URLs</div>
                        </div>
                        <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg">
                            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.categories}</div>
                            <div className="text-sm text-muted-foreground">Categories</div>
                        </div>
                        <div className="bg-purple-50 dark:bg-purple-950 p-4 rounded-lg">
                            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{stats.products}</div>
                            <div className="text-sm text-muted-foreground">Products</div>
                        </div>
                        <div className="bg-orange-50 dark:bg-orange-950 p-4 rounded-lg">
                            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{stats.pages}</div>
                            <div className="text-sm text-muted-foreground">CMS Pages</div>
                        </div>
                    </div>

                    {/* Additional stats for Google features */}
                    {(settings.sitemap_include_images || settings.sitemap_include_videos || settings.sitemap_enable_news) && (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                            {settings.sitemap_include_images && (
                                <div className="bg-pink-50 dark:bg-pink-950 p-4 rounded-lg">
                                    <div className="text-2xl font-bold text-pink-600 dark:text-pink-400">{stats.images}</div>
                                    <div className="text-sm text-muted-foreground">Images</div>
                                </div>
                            )}
                            {settings.sitemap_include_videos && (
                                <div className="bg-indigo-50 dark:bg-indigo-950 p-4 rounded-lg">
                                    <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{stats.videos}</div>
                                    <div className="text-sm text-muted-foreground">Videos</div>
                                </div>
                            )}
                            {settings.sitemap_enable_news && (
                                <div className="bg-yellow-50 dark:bg-yellow-950 p-4 rounded-lg">
                                    <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.newsArticles}</div>
                                    <div className="text-sm text-muted-foreground">News Articles</div>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Settings Card */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle>Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Content Types */}
                    <div className="space-y-3">
                        <h4 className="text-sm font-medium text-muted-foreground">Content Types</h4>
                        <div className="grid gap-2">
                            <div className="flex items-center justify-between p-3 border rounded-lg">
                                <div className="flex items-center gap-3">
                                    <Switch id="include-categories" checked={settings.sitemap_include_categories} onCheckedChange={(checked) => setSettings({ ...settings, sitemap_include_categories: checked })} />
                                    <Label htmlFor="include-categories">Categories</Label>
                                </div>
                                {settings.sitemap_include_categories && (
                                    <div className="flex gap-2">
                                        <Select value={settings.category_priority} onValueChange={(value) => setSettings({ ...settings, category_priority: value })}>
                                            <SelectTrigger className="w-20 h-8 text-xs"><SelectValue /></SelectTrigger>
                                            <SelectContent>{priorityOptions.map(opt => (<SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>))}</SelectContent>
                                        </Select>
                                        <Select value={settings.category_changefreq} onValueChange={(value) => setSettings({ ...settings, category_changefreq: value })}>
                                            <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
                                            <SelectContent>{changefreqOptions.map(opt => (<SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>))}</SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center justify-between p-3 border rounded-lg">
                                <div className="flex items-center gap-3">
                                    <Switch id="include-products" checked={settings.sitemap_include_products} onCheckedChange={(checked) => setSettings({ ...settings, sitemap_include_products: checked })} />
                                    <Label htmlFor="include-products">Products</Label>
                                </div>
                                {settings.sitemap_include_products && (
                                    <div className="flex gap-2">
                                        <Select value={settings.product_priority} onValueChange={(value) => setSettings({ ...settings, product_priority: value })}>
                                            <SelectTrigger className="w-20 h-8 text-xs"><SelectValue /></SelectTrigger>
                                            <SelectContent>{priorityOptions.map(opt => (<SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>))}</SelectContent>
                                        </Select>
                                        <Select value={settings.product_changefreq} onValueChange={(value) => setSettings({ ...settings, product_changefreq: value })}>
                                            <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
                                            <SelectContent>{changefreqOptions.map(opt => (<SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>))}</SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center justify-between p-3 border rounded-lg">
                                <div className="flex items-center gap-3">
                                    <Switch id="include-pages" checked={settings.sitemap_include_pages} onCheckedChange={(checked) => setSettings({ ...settings, sitemap_include_pages: checked })} />
                                    <Label htmlFor="include-pages">CMS Pages</Label>
                                </div>
                                {settings.sitemap_include_pages && (
                                    <div className="flex gap-2">
                                        <Select value={settings.page_priority} onValueChange={(value) => setSettings({ ...settings, page_priority: value })}>
                                            <SelectTrigger className="w-20 h-8 text-xs"><SelectValue /></SelectTrigger>
                                            <SelectContent>{priorityOptions.map(opt => (<SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>))}</SelectContent>
                                        </Select>
                                        <Select value={settings.page_changefreq} onValueChange={(value) => setSettings({ ...settings, page_changefreq: value })}>
                                            <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
                                            <SelectContent>{changefreqOptions.map(opt => (<SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>))}</SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Google Features */}
                    <div className="space-y-3">
                        <h4 className="text-sm font-medium text-muted-foreground">Google Features</h4>
                        <div className="flex flex-wrap gap-4">
                            <div className="flex items-center gap-2">
                                <Switch id="include-images" checked={settings.sitemap_include_images} onCheckedChange={(checked) => setSettings({ ...settings, sitemap_include_images: checked })} />
                                <Image className="h-4 w-4 text-pink-600" />
                                <Label htmlFor="include-images" className="text-sm">Images</Label>
                            </div>
                            <div className="flex items-center gap-2">
                                <Switch id="include-videos" checked={settings.sitemap_include_videos} onCheckedChange={(checked) => setSettings({ ...settings, sitemap_include_videos: checked })} />
                                <Video className="h-4 w-4 text-indigo-600" />
                                <Label htmlFor="include-videos" className="text-sm">Videos</Label>
                            </div>
                            <div className="flex items-center gap-2">
                                <Switch id="enable-news" checked={settings.sitemap_enable_news} onCheckedChange={(checked) => setSettings({ ...settings, sitemap_enable_news: checked })} />
                                <Newspaper className="h-4 w-4 text-yellow-600" />
                                <Label htmlFor="enable-news" className="text-sm">News</Label>
                            </div>
                        </div>
                    </div>

                    {/* Submit Instructions */}
                    <div className="space-y-3">
                        <h4 className="text-sm font-medium text-muted-foreground">Submit to Search Engines</h4>
                        <div className="p-3 border rounded-lg bg-muted/50 text-sm space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <span className="font-medium">Your Sitemap URL:</span>
                                <code className="px-2 py-1 bg-background rounded text-xs">{sitemapBaseUrl}/sitemap.xml</code>
                            </div>
                            {primaryDomain && (
                                <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                                    <CheckCircle className="w-3 h-3" />
                                    Using primary custom domain: {primaryDomain}
                                </p>
                            )}
                            <div className="grid sm:grid-cols-2 gap-3 text-xs text-muted-foreground">
                                <div>
                                    <p className="font-medium text-foreground mb-1">Google Search Console:</p>
                                    <ol className="list-decimal list-inside space-y-0.5">
                                        <li>Go to <a href="https://search.google.com/search-console" target="_blank" rel="noopener noreferrer" className="text-primary underline">Search Console</a></li>
                                        <li>Select your property</li>
                                        <li>Click "Sitemaps" → Submit URL</li>
                                    </ol>
                                </div>
                                <div>
                                    <p className="font-medium text-foreground mb-1">Bing Webmaster Tools:</p>
                                    <ol className="list-decimal list-inside space-y-0.5">
                                        <li>Go to <a href="https://www.bing.com/webmasters" target="_blank" rel="noopener noreferrer" className="text-primary underline">Bing Webmasters</a></li>
                                        <li>Select your site</li>
                                        <li>Click "Sitemaps" → Submit URL</li>
                                    </ol>
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
                <Button
                    onClick={generateSitemap}
                    disabled={generating}
                    variant="outline"
                >
                    <RefreshCw className={`mr-2 h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
                    {generating ? 'Regenerating...' : 'Regenerate Sitemap'}
                </Button>
                <Button
                    onClick={() => downloadSitemap(sitemapXml, 'sitemap.xml')}
                    disabled={!sitemapXml || generating}
                    variant="outline"
                >
                    <Download className="mr-2 h-4 w-4" />
                    Download
                </Button>
            </div>

            {/* Preview */}
            <Card>
                <CardHeader>
                    <CardTitle>Sitemap Preview</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="bg-muted p-4 rounded-md max-h-[400px] overflow-auto">
                        <pre className="text-xs">
                            {sitemapXml || 'Generating sitemap...'}
                        </pre>
                    </div>
                </CardContent>
            </Card>

            {/* Save Button */}
            <div className="flex justify-end">
                <SaveButton
                    onClick={handleSave}
                    loading={saving}
                    success={saveSuccess}
                    defaultText="Save Settings"
                />
            </div>
        </div>
    );
}
