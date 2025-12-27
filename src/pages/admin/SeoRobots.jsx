import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import SaveButton from '@/components/ui/save-button';
import { Bot, AlertCircle, RefreshCw, HelpCircle, Info, CheckCircle, ChevronDown } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Product } from '@/api/entities';
import { Category } from '@/api/entities';
import { CmsPage } from '@/api/entities';
import { SeoSetting } from '@/api/entities';
import { useStoreSelection } from '@/contexts/StoreSelectionContext.jsx';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import FlashMessage from "@/components/storefront/FlashMessage";
import { useAlertTypes } from "@/hooks/useAlert";

export default function SeoRobots() {
  const { selectedStore, getSelectedStoreId } = useStoreSelection();
  const { showInfo, showWarning, showError, AlertComponent } = useAlertTypes();
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [seoSetting, setSeoSetting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [flashMessage, setFlashMessage] = useState(null);
  const [robotsTxt, setRobotsTxt] = useState('');

  // Quick settings state
  const [blockAllCrawlers, setBlockAllCrawlers] = useState(false);
  const [blockImages, setBlockImages] = useState(false);
  const [blockJsCss, setBlockJsCss] = useState(false);
  const [crawlDelay, setCrawlDelay] = useState(0);

  // Helper function to get the store's domain for sitemap URL
  const getStoreSitemapUrl = (store) => {
    let domain = store?.settings?.custom_domain ||
                 store?.settings?.domain ||
                 store?.custom_domain ||
                 store?.domain;

    if (!domain) {
      // Construct from current domain + store slug
      const currentDomain = window.location.origin;
      domain = `${currentDomain}/public/${store?.slug}`;
    } else if (!domain.startsWith('http://') && !domain.startsWith('https://')) {
      domain = 'https://' + domain;
    }

    return `${domain}/sitemap.xml`;
  };

  // Generate default robots.txt content with proper sitemap URL
  const getDefaultRobotsTxt = (store) => {
    const sitemapUrl = getStoreSitemapUrl(store);
    return `User-agent: *
Allow: /

# Allow content directories (default behavior)
Allow: /products/
Allow: /categories/
Allow: /cms-pages/

# Block admin and system paths
Disallow: /admin/
Disallow: /api/
Disallow: /checkout/
Disallow: /cart/
Disallow: /account/
Disallow: /login

Sitemap: ${sitemapUrl}`;
  };

  // Load SEO settings on mount and when store changes
  React.useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        if (!selectedStore) {
          setLoading(false);
          return;
        }
        const settings = await SeoSetting.filter({ store_id: selectedStore.id });
        if (settings && settings.length > 0) {
          setSeoSetting(settings[0]);
          if (settings[0].robots_txt_content) {
            setRobotsTxt(settings[0].robots_txt_content);
          } else {
            // No saved content, set default with proper sitemap URL
            setRobotsTxt(getDefaultRobotsTxt(selectedStore));
          }
        } else {
          // No SEO settings exist, set default with proper sitemap URL
          setRobotsTxt(getDefaultRobotsTxt(selectedStore));
        }
      } catch (error) {
        console.error("Error loading SEO settings:", error);
        setFlashMessage({ type: 'error', message: 'Failed to load robots.txt settings' });
        // Still set default on error
        setRobotsTxt(getDefaultRobotsTxt(selectedStore));
      } finally {
        setLoading(false);
      }
    };

    if (selectedStore) {
      loadData();
    }
  }, [selectedStore]);

  // Apply quick settings to robots.txt content
  const applyQuickSettings = () => {
    let lines = [];

    if (blockAllCrawlers) {
      // Maintenance mode - block everything
      lines.push('User-agent: *');
      lines.push('Disallow: /');
      lines.push('');
      lines.push('# Site is in maintenance mode');
    } else {
      // Default rules
      lines.push('User-agent: *');
      lines.push('Allow: /');
      lines.push('Disallow: /admin/');
      lines.push('Disallow: /api/');
      lines.push('Disallow: /cart');
      lines.push('Disallow: /checkout');

      // Add image blocking
      if (blockImages) {
        lines.push('');
        lines.push('# Block image indexing');
        lines.push('User-agent: Googlebot-Image');
        lines.push('Disallow: /');
        lines.push('');
        lines.push('User-agent: *');
        lines.push('Disallow: /*.jpg$');
        lines.push('Disallow: /*.jpeg$');
        lines.push('Disallow: /*.gif$');
        lines.push('Disallow: /*.png$');
        lines.push('Disallow: /*.svg$');
        lines.push('Disallow: /*.webp$');
      }

      // Add JS/CSS blocking
      if (blockJsCss) {
        lines.push('');
        lines.push('# Block JS/CSS crawling');
        lines.push('Disallow: /*.js$');
        lines.push('Disallow: /*.css$');
      }

      // Add crawl delay
      if (crawlDelay > 0) {
        lines.push('');
        lines.push(`Crawl-delay: ${crawlDelay}`);
      }

      // Construct sitemap URL
      let domain = selectedStore?.settings?.custom_domain ||
                   selectedStore?.settings?.domain ||
                   selectedStore?.custom_domain ||
                   selectedStore?.domain;

      if (!domain) {
        // Construct from current domain + store slug
        const currentDomain = window.location.origin;
        domain = `${currentDomain}/public/${selectedStore?.slug}`;
      } else if (!domain.startsWith('http://') && !domain.startsWith('https://')) {
        domain = 'https://' + domain;
      }

      lines.push('');
      lines.push(`Sitemap: ${domain}/sitemap.xml`);
    }

    setRobotsTxt(lines.join('\n'));
  };

  // Import custom rules from products, categories, and CMS pages
  const importCustomRules = async () => {
    setGenerating(true);
    try {
      const storeId = getSelectedStoreId();

      if (!storeId) {
        setFlashMessage({ type: 'error', message: 'Please select a store first' });
        return;
      }

      // Fetch ALL products, categories, and pages to filter those with non-default meta robots tags
      let allProducts = [], allCategories = [], allPages = [];

      try {
        allProducts = await Product.filter({ store_id: storeId });
      } catch (error) {
        console.error('Error fetching products:', error);
      }

      try {
        // Use findAll() instead of filter() and manually filter by store_id
        // Category.filter() uses admin API which may not support store_id param properly
        const allCategoriesUnfiltered = await Category.findAll();
        allCategories = allCategoriesUnfiltered.filter(c => c.store_id === storeId);
      } catch (error) {
        console.error('Error fetching categories:', error);
      }

      try {
        allPages = await CmsPage.filter({ store_id: storeId });
      } catch (error) {
        console.error('Error fetching pages:', error);
      }

      // Filter items with ANY non-default meta robots tags
      // Default is "index, follow" or empty/null, so we exclude those
      const products = allProducts.filter(p => {
        const tag = p.seo?.meta_robots_tag?.toLowerCase()?.trim() || '';
        return tag && tag !== 'index, follow';
      });

      const categories = allCategories.filter(c => {
        const tag = c.meta_robots_tag?.toLowerCase()?.trim() || '';
        return tag && tag !== 'index, follow';
      });

      const pages = allPages.filter(p => {
        const tag = p.meta_robots_tag?.toLowerCase()?.trim() || '';
        return tag && tag !== 'index, follow';
      });

      // Build default rules with Allow directives for content directories
      let domain = selectedStore?.settings?.custom_domain ||
                   selectedStore?.settings?.domain ||
                   selectedStore?.custom_domain ||
                   selectedStore?.domain;

      if (!domain) {
        // Construct from current domain + store slug
        const currentDomain = window.location.origin;
        domain = `${currentDomain}/public/${selectedStore.slug}`;
      } else if (!domain.startsWith('http://') && !domain.startsWith('https://')) {
        domain = 'https://' + domain;
      }

      const defaultRules = [
        'User-agent: *',
        'Allow: /',
        '',
        '# Allow content directories (default behavior)',
        'Allow: /products/',
        'Allow: /categories/',
        'Allow: /cms-pages/',
        '',
        '# Block admin and system paths',
        'Disallow: /admin/',
        'Disallow: /api/',
        'Disallow: /checkout/',
        'Disallow: /cart/',
        'Disallow: /account/',
        'Disallow: /login',
        '',
        `Sitemap: ${domain}/sitemap.xml`
      ].join('\n');

      let newContent = [defaultRules];

      // Only add Disallow rules for items with non-default meta robots tags
      if (products && products.length > 0) {
        newContent.push('\n# Disallowed Products (non-default meta robots tags)');
        products.forEach(p => {
          const tag = p.seo?.meta_robots_tag || 'default';
          newContent.push(`Disallow: /products/${p.slug || p.id}  # ${tag}`);
        });
      }

      // Only add Disallow rules for categories with non-default meta robots tags
      if (categories && categories.length > 0) {
        newContent.push('\n# Disallowed Categories (non-default meta robots tags)');
        categories.forEach(c => {
          const tag = c.meta_robots_tag || 'default';
          newContent.push(`Disallow: /categories/${c.slug}  # ${tag}`);
        });
      }

      // Only add Disallow rules for CMS pages with non-default meta robots tags
      if (pages && pages.length > 0) {
        newContent.push('\n# Disallowed CMS Pages (non-default meta robots tags)');
        pages.forEach(p => {
          const tag = p.meta_robots_tag || 'default';
          newContent.push(`Disallow: /cms-pages/${p.slug}  # ${tag}`);
        });
      }

      setRobotsTxt(newContent.join('\n'));
    } catch (error) {
      console.error("Error importing custom rules:", error);
      showError('Failed to import custom rules. Please try again.', 'Import Failed');
    } finally {
      setGenerating(false);
    }
  };

  const handlePreview = () => {
    if (!selectedStore) {
      setFlashMessage({ type: 'error', message: 'Please select a store first' });
      return;
    }

    // Construct proper robots.txt URL for SEO crawlers
    const currentDomain = window.location.origin;
    const robotsUrl = `${currentDomain}/public/${selectedStore.slug}/robots.txt`;

    // Open in new tab
    window.open(robotsUrl, '_blank');
  };

  const handleValidate = () => {
    const errors = [];
    const warnings = [];

    // Check if robots.txt is empty
    if (!robotsTxt.trim()) {
      errors.push('Robots.txt is empty. Add at least "User-agent: *" and "Allow: /"');
      showError(errors.join('\n'), 'Validation Errors');
      return;
    }

    const lines = robotsTxt.split('\n');
    let hasUserAgent = false;
    let hasSitemap = false;
    let currentUserAgent = null;

    lines.forEach((line, index) => {
      const trimmed = line.trim();

      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('#')) return;

      // Check for User-agent
      if (trimmed.toLowerCase().startsWith('user-agent:')) {
        hasUserAgent = true;
        currentUserAgent = trimmed.split(':')[1]?.trim();
      }

      // Check for Sitemap
      if (trimmed.toLowerCase().startsWith('sitemap:')) {
        hasSitemap = true;
      }

      // Check for valid directives
      const directive = trimmed.split(':')[0]?.toLowerCase();
      const validDirectives = ['user-agent', 'allow', 'disallow', 'sitemap', 'crawl-delay'];
      if (!validDirectives.includes(directive)) {
        warnings.push(`Line ${index + 1}: Unknown directive "${directive}"`);
      }

      // Check if Disallow/Allow comes after User-agent
      if ((directive === 'allow' || directive === 'disallow') && !currentUserAgent) {
        errors.push(`Line ${index + 1}: ${directive} must come after User-agent directive`);
      }

      // Check for common mistakes
      if (trimmed.toLowerCase().includes('disallow: /css') ||
          trimmed.toLowerCase().includes('disallow: /*.css')) {
        warnings.push(`Line ${index + 1}: Blocking CSS may harm SEO (Google needs CSS to render pages)`);
      }

      if (trimmed.toLowerCase().includes('disallow: /js') ||
          trimmed.toLowerCase().includes('disallow: /*.js')) {
        warnings.push(`Line ${index + 1}: Blocking JavaScript may harm SEO (Google needs JS to render pages)`);
      }
    });

    // Check for required elements
    if (!hasUserAgent) {
      errors.push('Missing User-agent directive. Add at least "User-agent: *"');
    }

    if (!hasSitemap) {
      warnings.push('No Sitemap directive found. Consider adding your sitemap URL');
    }

    // Show results
    if (errors.length === 0 && warnings.length === 0) {
      showInfo('No errors or warnings found. Your robots.txt looks good!', '✓ Validation Passed');
    } else {
      let message = '';

      if (errors.length > 0) {
        message += 'ERRORS:\n\n' + errors.join('\n\n');
      }

      if (warnings.length > 0) {
        if (message) message += '\n\n';
        message += 'WARNINGS:\n\n' + warnings.join('\n\n');
      }

      if (errors.length === 0) {
        message += '\n\nNo critical errors found, but please review the warnings above.';
      }

      if (errors.length > 0) {
        showError(message, 'Validation Results');
      } else {
        showWarning(message, 'Validation Results');
      }
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);

    try {
      const storeId = getSelectedStoreId();
      if (!storeId) {
        setFlashMessage({ type: 'error', message: 'Please select a store first' });
        return;
      }

      if (seoSetting) {
        // Update existing setting
        await SeoSetting.update(seoSetting.id, { robots_txt_content: robotsTxt });
      } else {
        // Create new setting
        const newSetting = await SeoSetting.create({
          store_id: storeId,
          robots_txt_content: robotsTxt
        });
        setSeoSetting(newSetting);
      }

      // Clear cache
      if (typeof window !== 'undefined' && window.clearCache) {
        window.clearCache();
      }
      localStorage.setItem('forceRefreshStore', 'true');

      setSaveSuccess(true);
      setFlashMessage({ type: 'success', message: 'Robots.txt saved successfully!' });
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      console.error("Error saving robots.txt:", error);
      setFlashMessage({ type: 'error', message: 'Failed to save robots.txt. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <FlashMessage message={flashMessage} onClose={() => setFlashMessage(null)} />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Bot className="h-6 w-6" />
          <h1 className="text-3xl font-bold">Robots.txt Configuration</h1>
        </div>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          The robots.txt file tells search engines which pages to crawl and which to avoid.
          Use <strong>Import Custom Rules</strong> to automatically add products, categories, and CMS pages marked with noindex/nofollow tags.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Robots.txt Editor</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="robots-content">File Content</Label>
            <Textarea 
              id="robots-content"
              value={robotsTxt}
              onChange={(e) => setRobotsTxt(e.target.value)}
              rows={15}
              className="font-mono text-sm"
            />
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={importCustomRules}
              disabled={generating || !selectedStore}
            >
              {generating ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Import Custom Rules
            </Button>
            <Button
              variant="outline"
              onClick={handlePreview}
              disabled={!selectedStore}
            >
              Preview
            </Button>
            <Button
              variant="outline"
              onClick={handleValidate}
            >
              Validate
            </Button>
          </div>
        </CardContent>
      </Card>
      <div className="flex justify-end mt-4 mb-8">
        <SaveButton
            onClick={handleSave}
            loading={saving}
            success={saveSuccess}
            defaultText="Save Changes"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="bg-amber-50 border-amber-200">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              <strong>Warning:</strong> Enabling these settings may negatively affect your SEO.
              Use with caution and only when necessary for specific use cases like maintenance mode or server load management.
            </AlertDescription>
          </Alert>

          <div className="flex items-center justify-between space-x-2">
            <Label htmlFor="block-crawlers" className="cursor-pointer">
              Block all crawlers (maintenance mode)
            </Label>
            <Switch
              id="block-crawlers"
              checked={blockAllCrawlers}
              onCheckedChange={(checked) => {
                setBlockAllCrawlers(checked);
              }}
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between space-x-2">
              <Label htmlFor="block-images" className="cursor-pointer">
                Prevent image indexing
              </Label>
              <Switch
                id="block-images"
                checked={blockImages}
                onCheckedChange={(checked) => {
                  setBlockImages(checked);
                }}
                disabled={blockAllCrawlers}
              />
            </div>
            {blockImages && (
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Warning: Blocking images may affect how Google renders and indexes your pages
              </p>
            )}
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between space-x-2">
              <Label htmlFor="block-js-css" className="cursor-pointer">
                Block JS/CSS crawling
              </Label>
              <Switch
                id="block-js-css"
                checked={blockJsCss}
                onCheckedChange={(checked) => {
                  setBlockJsCss(checked);
                }}
                disabled={blockAllCrawlers}
              />
            </div>
            {blockJsCss && (
              <p className="text-xs text-red-600 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Warning: Blocking JS/CSS can seriously harm SEO! Google needs these to render your pages correctly.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="crawl-delay">Crawl Delay (seconds)</Label>
            <input
              id="crawl-delay"
              type="number"
              min="0"
              max="60"
              value={crawlDelay}
              onChange={(e) => setCrawlDelay(parseInt(e.target.value) || 0)}
              disabled={blockAllCrawlers}
              className="w-full px-3 py-2 border rounded-md disabled:opacity-50"
            />
            <p className="text-sm text-muted-foreground">
              Delay between requests for crawlers (0 = no delay)
            </p>
          </div>
        </CardContent>
      </Card>
      <div className="flex justify-end mt-4 mb-8">
        <SaveButton
            onClick={applyQuickSettings}
            loading={saving}
            success={saveSuccess}
            defaultText="Save Quick Settings"
        />
      </div>

      <Collapsible open={isHelpOpen} onOpenChange={setIsHelpOpen}>
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader>
            <CollapsibleTrigger className="w-full">
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <HelpCircle className="h-5 w-5 text-blue-600" />
                  <CardTitle className="text-blue-900">Help & Best Practices</CardTitle>
                </div>
                <ChevronDown
                  className={`h-5 w-5 text-blue-600 transition-transform duration-200 ${
                    isHelpOpen ? 'transform rotate-180' : ''
                  }`}
                />
              </div>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex gap-3">
                  <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-sm mb-1">What is robots.txt?</h4>
                    <p className="text-sm text-gray-700">
                      The robots.txt file tells search engine crawlers which pages or sections of your site they can or cannot access.
                      It's a critical tool for SEO management and controlling how search engines index your content.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-sm mb-1">Basic Syntax</h4>
                    <div className="bg-white p-3 rounded border border-gray-200 text-xs space-y-2 font-mono">
                      <div><strong>User-agent: *</strong> - Applies to all search engines</div>
                      <div><strong>Allow: /</strong> - Allows crawling of all pages</div>
                      <div><strong>Disallow: /admin/</strong> - Blocks the /admin/ directory</div>
                      <div><strong>Disallow: /*.pdf$</strong> - Blocks all PDF files</div>
                      <div><strong>Crawl-delay: 10</strong> - Wait 10 seconds between requests</div>
                      <div><strong>Sitemap: https://yourstore.com/sitemap.xml</strong> - Location of your sitemap</div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <RefreshCw className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-sm mb-1">Import Custom Rules</h4>
                    <p className="text-sm text-gray-700 mb-2">
                      The <strong>Import Custom Rules</strong> button automatically generates robots.txt rules from your content with non-default SEO settings:
                    </p>
                    <ul className="text-sm text-gray-700 space-y-1">
                      <li>• Products with ANY non-default meta robots tag (noindex/nofollow, noindex/follow, index/nofollow, etc.)</li>
                      <li>• Categories with ANY non-default meta robots tag</li>
                      <li>• CMS pages with ANY non-default meta robots tag</li>
                      <li>• Default is "index, follow" - anything else gets added to robots.txt</li>
                      <li>• Adds inline comments showing the actual meta robots tag for each item</li>
                      <li>• Uses your store's custom domain for the sitemap URL</li>
                    </ul>
                    <p className="text-sm text-gray-700 mt-2">
                      This ensures your robots.txt stays in sync with your SEO settings. Only items with non-default settings are listed, making it easy to see exceptions at a glance.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-sm mb-1">Preview & Validate Buttons</h4>
                    <ul className="text-sm text-gray-700 space-y-1">
                      <li>• <strong>Preview:</strong> Opens your live robots.txt URL in a new tab. This shows you exactly what search engines will see when they access yoursite.com/robots.txt</li>
                      <li>• <strong>Validate:</strong> Checks your robots.txt for syntax errors and common SEO mistakes before saving. It warns you about blocking important resources like CSS/JS, missing directives, and invalid syntax</li>
                    </ul>
                  </div>
                </div>

                <div className="flex gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-sm mb-1">Quick Settings Features</h4>
                    <ul className="text-sm text-gray-700 space-y-1">
                      <li>• <strong>Block all crawlers:</strong> Enables maintenance mode - blocks all search engines from your entire site</li>
                      <li>• <strong>Prevent image indexing:</strong> Blocks image search engines and common image file formats</li>
                      <li>• <strong>Block JS/CSS crawling:</strong> Prevents search engines from crawling JavaScript and CSS files</li>
                      <li>• <strong>Crawl Delay:</strong> Sets the minimum time (in seconds) between crawler requests to prevent server overload</li>
                    </ul>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-sm mb-1">Common Use Cases</h4>
                    <ul className="text-sm text-gray-700 space-y-1">
                      <li>• <strong>Block admin/private areas:</strong> <code className="bg-gray-100 px-1 text-xs">Disallow: /admin/</code></li>
                      <li>• <strong>Block checkout process:</strong> <code className="bg-gray-100 px-1 text-xs">Disallow: /checkout/</code></li>
                      <li>• <strong>Block specific products:</strong> <code className="bg-gray-100 px-1 text-xs">Disallow: /products/discontinued-item</code></li>
                      <li>• <strong>Block all images:</strong> <code className="bg-gray-100 px-1 text-xs">Disallow: /*.jpg$</code></li>
                      <li>• <strong>Allow specific bot:</strong> <code className="bg-gray-100 px-1 text-xs">User-agent: Googlebot</code> then <code className="bg-gray-100 px-1 text-xs">Allow: /</code></li>
                      <li>• <strong>Set crawl rate:</strong> <code className="bg-gray-100 px-1 text-xs">Crawl-delay: 10</code> (10 seconds between requests)</li>
                    </ul>
                  </div>
                </div>

                <div className="flex gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-sm mb-1">Best Practices</h4>
                    <ul className="text-sm text-gray-700 space-y-1">
                      <li>• Always include your sitemap URL in robots.txt</li>
                      <li>• Don't block your CSS and JavaScript files (unless using Quick Settings intentionally)</li>
                      <li>• Test your robots.txt with Google Search Console's robots.txt Tester</li>
                      <li>• Use Disallow for pages you don't want indexed (admin, checkout, cart)</li>
                      <li>• Be careful with wildcards (*) - they match any sequence of characters</li>
                      <li>• Remember: robots.txt is a suggestion, not a security measure</li>
                      <li>• Update robots.txt when you change site structure or add new sections</li>
                    </ul>
                  </div>
                </div>

                <div className="flex gap-3">
                  <AlertCircle className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-sm mb-1">User-Agent Examples</h4>
                    <div className="bg-white p-3 rounded border border-gray-200 text-xs space-y-2">
                      <div><code className="bg-gray-100 px-1">User-agent: *</code> - All crawlers</div>
                      <div><code className="bg-gray-100 px-1">User-agent: Googlebot</code> - Google's main crawler</div>
                      <div><code className="bg-gray-100 px-1">User-agent: Googlebot-Image</code> - Google's image crawler</div>
                      <div><code className="bg-gray-100 px-1">User-agent: Bingbot</code> - Microsoft Bing's crawler</div>
                      <div><code className="bg-gray-100 px-1">User-agent: AhrefsBot</code> - Ahrefs SEO tool crawler</div>
                      <div><code className="bg-gray-100 px-1">User-agent: SemrushBot</code> - SEMrush tool crawler</div>
                    </div>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded p-3 flex gap-2">
                  <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <strong className="text-amber-900">Important:</strong>
                    <span className="text-amber-800"> robots.txt only controls crawler behavior. It does NOT provide security or prevent access to pages. Use proper authentication for sensitive content. Also, malicious bots may ignore robots.txt rules.</span>
                  </div>
                </div>

                <div className="bg-green-50 border border-green-200 rounded p-3 flex gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <strong className="text-green-900">Pro Tip:</strong>
                    <span className="text-green-800"> Use the "Import Custom Rules" feature regularly to keep your robots.txt in sync with your product, category, and page SEO settings. This ensures search engines don't waste time crawling content you've marked as noindex.</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
      <AlertComponent />
    </div>
  );
}