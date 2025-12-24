const express = require('express');
const router = express.Router();
const ConnectionManager = require('../services/database/ConnectionManager');
const { buildStoreUrl } = require('../utils/domainConfig');
const { applyProductTranslationsToMany, applyProductImages, enrichProductsWithBrandAndMpn } = require('../utils/productHelpers');
const { getLanguageFromRequest } = require('../utils/languageUtils');

/**
 * Generate XML sitemap content
 */
async function generateSitemapXml(storeId, baseUrl) {
  try {
    // Get tenant database connection
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    // Get SEO settings for the store (using JSON column)
    const { data: seoSettings } = await tenantDb
      .from('seo_settings')
      .select('xml_sitemap_settings')
      .eq('store_id', storeId)
      .single();

    // Extract settings from JSON, with defaults
    const xmlSettings = seoSettings?.xml_sitemap_settings || {};
    const includeCategories = xmlSettings.include_categories !== false;
    const includeProducts = xmlSettings.include_products !== false;
    const includePages = xmlSettings.include_pages !== false;
    const includeImages = xmlSettings.include_images === true;
    const includeVideos = xmlSettings.include_videos === true;
    const enableNews = xmlSettings.enable_news === true;

    // Priority and changefreq settings per URL group (with defaults)
    const categoryPriority = xmlSettings.category_priority || '0.8';
    const categoryChangefreq = xmlSettings.category_changefreq || 'weekly';
    const productPriority = xmlSettings.product_priority || '0.7';
    const productChangefreq = xmlSettings.product_changefreq || 'daily';
    const pagePriority = xmlSettings.page_priority || '0.6';
    const pageChangefreq = xmlSettings.page_changefreq || 'monthly';

    const urls = [];

    // Add homepage
    urls.push({
      loc: baseUrl,
      changefreq: 'daily',
      priority: '1.0',
      lastmod: new Date().toISOString().split('T')[0]
    });

    // Add categories if enabled
    if (includeCategories) {
      const { data: categories } = await tenantDb
        .from('categories')
        .select('slug, name, updated_at, image_url')
        .eq('is_active', true)
        .eq('store_id', storeId)
        .order('sort_order', { ascending: true });

      if (categories) {
        categories.forEach(category => {
          const urlEntry = {
            loc: `${baseUrl}/category/${category.slug}`,
            changefreq: categoryChangefreq,
            priority: categoryPriority,
            lastmod: category.updated_at ? new Date(category.updated_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
          };
          // Add image if enabled and available
          if (includeImages && category.image_url) {
            urlEntry.images = [{
              loc: category.image_url,
              title: category.name || 'Category Image'
            }];
          }
          urls.push(urlEntry);
        });
      }
    }

    // Add products if enabled
    if (includeProducts) {
      const { data: products } = await tenantDb
        .from('products')
        .select('id, slug, name, description, updated_at, video_url, video_thumbnail')
        .eq('status', 'active')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false });

      if (products) {
        // Get product images from product_files if images are enabled
        let productImages = {};
        if (includeImages && products.length > 0) {
          const productIds = products.map(p => p.id);
          const { data: files } = await tenantDb
            .from('product_files')
            .select('product_id, file_url, alt_text')
            .in('product_id', productIds)
            .eq('file_type', 'image')
            .order('sort_order', { ascending: true });

          if (files) {
            files.forEach(file => {
              if (!productImages[file.product_id]) {
                productImages[file.product_id] = [];
              }
              productImages[file.product_id].push({
                loc: file.file_url,
                title: file.alt_text || 'Product Image'
              });
            });
          }
        }

        products.forEach(product => {
          const urlEntry = {
            loc: `${baseUrl}/product/${product.slug}`,
            changefreq: productChangefreq,
            priority: productPriority,
            lastmod: product.updated_at ? new Date(product.updated_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
          };
          // Add images if enabled
          if (includeImages && productImages[product.id]) {
            urlEntry.images = productImages[product.id].slice(0, 10); // Max 10 images per URL
          }
          // Add video if enabled and available
          if (includeVideos && product.video_url) {
            urlEntry.video = {
              thumbnail_loc: product.video_thumbnail || (productImages[product.id]?.[0]?.loc) || '',
              title: product.name || 'Product Video',
              description: (product.description || product.name || '').substring(0, 256),
              content_loc: product.video_url
            };
          }
          urls.push(urlEntry);
        });
      }
    }

    // Add CMS pages if enabled
    if (includePages) {
      const { data: pages } = await tenantDb
        .from('cms_pages')
        .select('slug, title, content, updated_at, created_at, featured_image, video_url, video_thumbnail, is_news_article, language')
        .eq('is_active', true)
        .eq('store_id', storeId);

      // Get store name for news sitemap
      let storeName = 'Store';
      if (enableNews) {
        const { data: storeData } = await tenantDb
          .from('stores')
          .select('name')
          .eq('id', storeId)
          .single();
        storeName = storeData?.name || 'Store';
      }

      if (pages) {
        pages.forEach(page => {
          const urlEntry = {
            loc: `${baseUrl}/${page.slug}`,
            changefreq: pageChangefreq,
            priority: pagePriority,
            lastmod: page.updated_at ? new Date(page.updated_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
          };
          // Add image if enabled and available
          if (includeImages && page.featured_image) {
            urlEntry.images = [{
              loc: page.featured_image,
              title: page.title || 'Page Image'
            }];
          }
          // Add video if enabled and available
          if (includeVideos && page.video_url) {
            urlEntry.video = {
              thumbnail_loc: page.video_thumbnail || page.featured_image || '',
              title: page.title || 'Page Video',
              description: (page.content || page.title || '').substring(0, 256),
              content_loc: page.video_url
            };
          }
          // Add news if enabled and page is a news article
          if (enableNews && page.is_news_article) {
            urlEntry.news = {
              publication_name: storeName,
              language: page.language || 'en',
              publication_date: new Date(page.created_at).toISOString(),
              title: page.title
            };
          }
          urls.push(urlEntry);
        });
      }
    }

    // Generate XML with appropriate namespaces
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    let namespaces = 'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"';
    if (includeImages) namespaces += ' xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"';
    if (includeVideos) namespaces += ' xmlns:video="http://www.google.com/schemas/sitemap-video/1.1"';
    if (enableNews) namespaces += ' xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"';
    xml += `<urlset ${namespaces}>\n`;

    urls.forEach(url => {
      xml += '  <url>\n';
      xml += `    <loc>${escapeXml(url.loc)}</loc>\n`;
      xml += `    <lastmod>${url.lastmod}</lastmod>\n`;
      xml += `    <changefreq>${url.changefreq}</changefreq>\n`;
      xml += `    <priority>${url.priority}</priority>\n`;

      // Add images if present
      if (url.images && url.images.length > 0) {
        url.images.forEach(img => {
          xml += '    <image:image>\n';
          xml += `      <image:loc>${escapeXml(img.loc)}</image:loc>\n`;
          xml += `      <image:title>${escapeXml(img.title)}</image:title>\n`;
          xml += '    </image:image>\n';
        });
      }

      // Add video if present
      if (url.video) {
        xml += '    <video:video>\n';
        xml += `      <video:thumbnail_loc>${escapeXml(url.video.thumbnail_loc)}</video:thumbnail_loc>\n`;
        xml += `      <video:title>${escapeXml(url.video.title)}</video:title>\n`;
        xml += `      <video:description>${escapeXml(url.video.description)}</video:description>\n`;
        xml += `      <video:content_loc>${escapeXml(url.video.content_loc)}</video:content_loc>\n`;
        xml += '    </video:video>\n';
      }

      // Add news if present
      if (url.news) {
        xml += '    <news:news>\n';
        xml += '      <news:publication>\n';
        xml += `        <news:name>${escapeXml(url.news.publication_name)}</news:name>\n`;
        xml += `        <news:language>${url.news.language}</news:language>\n`;
        xml += '      </news:publication>\n';
        xml += `      <news:publication_date>${url.news.publication_date}</news:publication_date>\n`;
        xml += `      <news:title>${escapeXml(url.news.title)}</news:title>\n`;
        xml += '    </news:news>\n';
      }

      xml += '  </url>\n';
    });

    xml += '</urlset>';

    return xml;
  } catch (error) {
    console.error('[Sitemap] Error generating sitemap:', error);
    throw error;
  }
}

/**
 * Escape XML special characters
 */
function escapeXml(unsafe) {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generate Google Merchant Center RSS 2.0 XML feed
 * @param {Object} tenantDb - Tenant database connection
 * @param {string} storeId - Store ID
 * @param {string} baseUrl - Base URL for the store
 * @param {string} currency - Currency code
 * @param {string} language - Language code
 */
async function generateGoogleMerchantXml(tenantDb, storeId, baseUrl, currency = 'EUR', language = 'en') {
  try {
    // Get store info and SEO settings (for attribute mappings)
    const [storeResult, seoResult] = await Promise.all([
      tenantDb.from('stores').select('name, currency').eq('is_active', true).limit(1).maybeSingle(),
      tenantDb.from('seo_settings').select('feed_attribute_mappings').eq('store_id', storeId).limit(1).maybeSingle()
    ]);

    const store = storeResult.data;
    const seoSettings = seoResult.data;
    const attributeMappings = seoSettings?.feed_attribute_mappings || null;

    const storeCurrency = store?.currency || currency;
    const storeName = store?.name || 'Store';

    // Fetch active, visible products
    const { data: products, error } = await tenantDb
      .from('products')
      .select('*')
      .eq('store_id', storeId)
      .eq('status', 'active')
      .eq('visibility', 'visible')
      .order('created_at', { ascending: false })
      .limit(5000);

    if (error) throw error;

    // Apply translations
    let enrichedProducts = await applyProductTranslationsToMany(products || [], language, tenantDb);

    // Apply images
    enrichedProducts = await applyProductImages(enrichedProducts, tenantDb);

    // Enrich with brand/mpn from product_attribute_values (using custom mappings if configured)
    enrichedProducts = await enrichProductsWithBrandAndMpn(enrichedProducts, tenantDb, storeId, language, attributeMappings);

    // Build XML
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n';
    xml += '  <channel>\n';
    xml += `    <title>${escapeXml(storeName)}</title>\n`;
    xml += `    <link>${escapeXml(baseUrl)}</link>\n`;
    xml += `    <description>Product feed for ${escapeXml(storeName)}</description>\n`;

    enrichedProducts.forEach(product => {
      const availability = getProductAvailability(product);
      const primaryImage = getPrimaryImage(product);
      const condition = product.product_identifiers?.condition || 'new';

      xml += '    <item>\n';
      xml += `      <g:id>${escapeXml(product.sku || product.id)}</g:id>\n`;
      xml += `      <g:title>${escapeXml(truncate(product.name, 150))}</g:title>\n`;
      xml += `      <g:description>${escapeXml(sanitizeDescription(product.description || product.short_description, 5000))}</g:description>\n`;
      xml += `      <g:link>${escapeXml(baseUrl)}/product/${escapeXml(product.slug)}</g:link>\n`;
      xml += `      <g:image_link>${escapeXml(primaryImage)}</g:image_link>\n`;

      // Price handling (sale price if applicable)
      if (product.compare_price && parseFloat(product.compare_price) > parseFloat(product.price)) {
        xml += `      <g:price>${product.compare_price} ${storeCurrency}</g:price>\n`;
        xml += `      <g:sale_price>${product.price} ${storeCurrency}</g:sale_price>\n`;
      } else {
        xml += `      <g:price>${product.price} ${storeCurrency}</g:price>\n`;
      }

      xml += `      <g:availability>${availability}</g:availability>\n`;
      xml += `      <g:condition>${condition}</g:condition>\n`;

      // Additional images
      const additionalImages = getAdditionalImages(product);
      additionalImages.forEach(img => {
        xml += `      <g:additional_image_link>${escapeXml(img)}</g:additional_image_link>\n`;
      });

      // Product identifiers
      if (product.gtin) xml += `      <g:gtin>${escapeXml(product.gtin)}</g:gtin>\n`;
      if (product.mpn) xml += `      <g:mpn>${escapeXml(product.mpn)}</g:mpn>\n`;
      if (product.brand) xml += `      <g:brand>${escapeXml(product.brand)}</g:brand>\n`;
      if (product.barcode && !product.gtin) xml += `      <g:gtin>${escapeXml(product.barcode)}</g:gtin>\n`;

      // Google product category
      if (product.ai_shopping_data?.google_category_id) {
        xml += `      <g:google_product_category>${escapeXml(product.ai_shopping_data.google_category_id)}</g:google_product_category>\n`;
      }

      // Product attributes from product_identifiers
      const identifiers = product.product_identifiers || {};
      if (identifiers.color) xml += `      <g:color>${escapeXml(identifiers.color)}</g:color>\n`;
      if (identifiers.size) xml += `      <g:size>${escapeXml(identifiers.size)}</g:size>\n`;
      if (identifiers.gender) xml += `      <g:gender>${escapeXml(identifiers.gender)}</g:gender>\n`;
      if (identifiers.age_group) xml += `      <g:age_group>${escapeXml(identifiers.age_group)}</g:age_group>\n`;
      if (identifiers.material) xml += `      <g:material>${escapeXml(identifiers.material)}</g:material>\n`;

      // Shipping weight
      if (product.weight) {
        xml += `      <g:shipping_weight>${product.weight} kg</g:shipping_weight>\n`;
      }

      xml += '    </item>\n';
    });

    xml += '  </channel>\n';
    xml += '</rss>';

    return xml;
  } catch (error) {
    console.error('[GoogleMerchant] Error generating feed:', error);
    throw error;
  }
}

// Helper functions for Google Merchant feed
function getProductAvailability(product) {
  if (product.infinite_stock || product.stock_quantity > 0) return 'in_stock';
  if (product.allow_backorders) return 'backorder';
  return 'out_of_stock';
}

function getPrimaryImage(product) {
  if (Array.isArray(product.images) && product.images.length > 0) {
    return product.images[0].url || product.images[0].file_url || product.images[0];
  }
  return '';
}

function getAdditionalImages(product) {
  if (Array.isArray(product.images) && product.images.length > 1) {
    return product.images.slice(1, 10).map(img => img.url || img.file_url || img);
  }
  return [];
}

function sanitizeDescription(text, maxLength = 5000) {
  if (!text) return '';
  return text.replace(/<[^>]*>/g, '').substring(0, maxLength);
}

function truncate(text, maxLength) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}


/**
 * Generate ChatGPT/OpenAI compatible JSON feed
 */
async function generateChatGPTFeed(tenantDb, storeId, baseUrl, currency = 'EUR', language = 'en') {
  // Get store info and SEO settings (for attribute mappings)
  const [storeResult, seoResult] = await Promise.all([
    tenantDb.from('stores').select('name, currency, settings').eq('is_active', true).limit(1).maybeSingle(),
    tenantDb.from('seo_settings').select('feed_attribute_mappings').eq('store_id', storeId).limit(1).maybeSingle()
  ]);

  const store = storeResult.data;
  const seoSettings = seoResult.data;
  const attributeMappings = seoSettings?.feed_attribute_mappings || null;

  const storeCurrency = store?.currency || currency;

  const { data: products, error } = await tenantDb
    .from('products')
    .select('*')
    .eq('store_id', storeId)
    .eq('status', 'active')
    .eq('visibility', 'visible')
    .order('created_at', { ascending: false })
    .limit(5000);

  if (error) throw error;

  let enrichedProducts = await applyProductTranslationsToMany(products || [], language, tenantDb);
  enrichedProducts = await applyProductImages(enrichedProducts, tenantDb);
  enrichedProducts = await enrichProductsWithBrandAndMpn(enrichedProducts, tenantDb, storeId, language, attributeMappings);

  const formatPrice = (price) => {
    const num = parseFloat(price) || 0;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: storeCurrency }).format(num);
  };

  const formattedProducts = enrichedProducts.map(product => {
    const discount = product.compare_price && parseFloat(product.compare_price) > parseFloat(product.price)
      ? Math.round((1 - parseFloat(product.price) / parseFloat(product.compare_price)) * 100)
      : 0;

    return {
      id: product.id,
      name: product.name,
      natural_description: generateNaturalDescription(product, discount, formatPrice),
      description: product.description,
      short_description: product.short_description,
      highlights: product.ai_shopping_data?.product_highlights || [],
      pricing: {
        current_price: parseFloat(product.price) || 0,
        original_price: product.compare_price ? parseFloat(product.compare_price) : null,
        currency: storeCurrency,
        formatted_current: formatPrice(product.price),
        formatted_original: product.compare_price ? formatPrice(product.compare_price) : null,
        discount_percentage: discount
      },
      availability: {
        status: getProductAvailability(product),
        quantity: product.stock_quantity,
        message: getAvailabilityMessage(product)
      },
      identifiers: {
        sku: product.sku,
        gtin: product.gtin,
        mpn: product.mpn,
        barcode: product.barcode
      },
      brand: product.brand,
      url: `${baseUrl}/product/${product.slug}`,
      images: (product.images || []).map((img, i) => ({
        url: img.url || img.file_url || img,
        alt: img.alt || img.alt_text || `${product.name} image ${i + 1}`
      }))
    };
  });

  return {
    feed_version: '1.0',
    format: 'chatgpt-shopping',
    store: {
      name: store?.name || 'Store',
      url: baseUrl,
      currency: storeCurrency,
      return_policy: store?.settings?.return_policy || '30-day returns',
      shipping_info: store?.settings?.shipping_info || 'Standard shipping available'
    },
    products: formattedProducts,
    generated_at: new Date().toISOString(),
    total_products: formattedProducts.length
  };
}

/**
 * Generate Universal AI feed (Schema.org based)
 */
async function generateUniversalFeed(tenantDb, storeId, baseUrl, currency = 'EUR', language = 'en') {
  // Get store info and SEO settings (for attribute mappings)
  const [storeResult, seoResult] = await Promise.all([
    tenantDb.from('stores').select('name, currency').eq('is_active', true).limit(1).maybeSingle(),
    tenantDb.from('seo_settings').select('feed_attribute_mappings').eq('store_id', storeId).limit(1).maybeSingle()
  ]);

  const store = storeResult.data;
  const seoSettings = seoResult.data;
  const attributeMappings = seoSettings?.feed_attribute_mappings || null;

  const storeCurrency = store?.currency || currency;

  const { data: products, error } = await tenantDb
    .from('products')
    .select('*')
    .eq('store_id', storeId)
    .eq('status', 'active')
    .eq('visibility', 'visible')
    .order('created_at', { ascending: false })
    .limit(5000);

  if (error) throw error;

  let enrichedProducts = await applyProductTranslationsToMany(products || [], language, tenantDb);
  enrichedProducts = await applyProductImages(enrichedProducts, tenantDb);
  enrichedProducts = await enrichProductsWithBrandAndMpn(enrichedProducts, tenantDb, storeId, language, attributeMappings);

  const itemListElement = enrichedProducts.map((product, index) => {
    const schema = {
      '@type': 'Product',
      '@id': `${baseUrl}/product/${product.slug}`,
      identifier: product.id,
      sku: product.sku,
      name: product.name,
      description: product.description || product.short_description,
      image: (product.images || []).map(img => img.url || img.file_url || img),
      offers: {
        '@type': 'Offer',
        url: `${baseUrl}/product/${product.slug}`,
        price: parseFloat(product.price) || 0,
        priceCurrency: storeCurrency,
        availability: `https://schema.org/${getSchemaAvailability(product)}`,
        itemCondition: `https://schema.org/${getSchemaCondition(product)}`
      }
    };

    if (product.gtin) schema.gtin = product.gtin;
    if (product.mpn) schema.mpn = product.mpn;
    if (product.brand) {
      schema.brand = { '@type': 'Brand', name: product.brand };
    }
    if (product.weight) {
      schema.weight = { '@type': 'QuantitativeValue', value: parseFloat(product.weight), unitCode: 'KGM' };
    }

    return { '@type': 'ListItem', position: index + 1, item: schema };
  });

  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${store?.name || 'Store'} Product Catalog`,
    description: `Products from ${store?.name || 'Store'}`,
    url: baseUrl,
    numberOfItems: enrichedProducts.length,
    itemListElement,
    dateModified: new Date().toISOString()
  };
}

// Additional helper functions
function generateNaturalDescription(product, discount, formatPrice) {
  const parts = [];
  if (product.brand) {
    parts.push(`The ${product.brand} ${product.name}`);
  } else {
    parts.push(`This ${product.name}`);
  }
  if (product.short_description) {
    parts.push(product.short_description.substring(0, 150));
  }
  if (discount > 0) {
    parts.push(`Currently ${discount}% off at ${formatPrice(product.price)}.`);
  } else {
    parts.push(`Priced at ${formatPrice(product.price)}.`);
  }
  return parts.join(' ');
}

function getAvailabilityMessage(product) {
  if (product.infinite_stock) return 'In stock and ready to ship';
  if (product.stock_quantity > 10) return 'In stock and ready to ship';
  if (product.stock_quantity > 0) return `Only ${product.stock_quantity} left in stock`;
  if (product.allow_backorders) return 'Available for backorder';
  return 'Out of stock';
}

function getSchemaAvailability(product) {
  if (product.infinite_stock || product.stock_quantity > 0) return 'InStock';
  if (product.allow_backorders) return 'BackOrder';
  return 'OutOfStock';
}

function getSchemaCondition(product) {
  const condition = product.product_identifiers?.condition || 'new';
  const map = { 'new': 'NewCondition', 'refurbished': 'RefurbishedCondition', 'used': 'UsedCondition' };
  return map[condition] || 'NewCondition';
}


/**
 * GET /api/sitemap/:storeId/google-merchant-xml
 * Serves the Google Merchant Center feed for a specific store
 */
router.get('/:storeId/google-merchant-xml', async (req, res) => {
  try {
    const { storeId } = req.params;
    const language = getLanguageFromRequest(req) || 'en';

    console.log(`[Feed] Serving Google Merchant feed for store: ${storeId}`);

    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const { data: store, error } = await tenantDb
      .from('stores')
      .select('id, slug, currency')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (error || !store) {
      return res.status(404).send('Store not found');
    }

    const baseUrl = await buildStoreUrl({ tenantDb, storeId: store.id, storeSlug: store.slug });
    const feedXml = await generateGoogleMerchantXml(tenantDb, storeId, baseUrl, store.currency, language);

    res.set({ 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
    res.send(feedXml);
  } catch (error) {
    console.error('[Feed] Google Merchant error:', error);
    res.status(500).send('Error generating feed');
  }
});

/**
 * GET /api/sitemap/:storeId/microsoft-merchant-xml
 * Serves the Microsoft Merchant Center feed (same format as Google)
 */
router.get('/:storeId/microsoft-merchant-xml', async (req, res) => {
  try {
    const { storeId } = req.params;
    const language = getLanguageFromRequest(req) || 'en';

    console.log(`[Feed] Serving Microsoft Merchant feed for store: ${storeId}`);

    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const { data: store, error } = await tenantDb
      .from('stores')
      .select('id, slug, currency')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (error || !store) {
      return res.status(404).send('Store not found');
    }

    const baseUrl = await buildStoreUrl({ tenantDb, storeId: store.id, storeSlug: store.slug });
    const feedXml = await generateGoogleMerchantXml(tenantDb, storeId, baseUrl, store.currency, language);

    res.set({ 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
    res.send(feedXml);
  } catch (error) {
    console.error('[Feed] Microsoft Merchant error:', error);
    res.status(500).send('Error generating feed');
  }
});

/**
 * GET /api/sitemap/:storeId/chatgpt-feed
 * Serves ChatGPT/OpenAI compatible JSON feed
 */
router.get('/:storeId/chatgpt-feed', async (req, res) => {
  try {
    const { storeId } = req.params;
    const language = getLanguageFromRequest(req) || 'en';

    console.log(`[Feed] Serving ChatGPT feed for store: ${storeId}`);

    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const { data: store, error } = await tenantDb
      .from('stores')
      .select('id, slug, currency')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (error || !store) {
      return res.status(404).json({ error: 'Store not found' });
    }

    const baseUrl = await buildStoreUrl({ tenantDb, storeId: store.id, storeSlug: store.slug });
    const feed = await generateChatGPTFeed(tenantDb, storeId, baseUrl, store.currency, language);

    res.set({ 'Cache-Control': 'public, max-age=3600' });
    res.json(feed);
  } catch (error) {
    console.error('[Feed] ChatGPT error:', error);
    res.status(500).json({ error: 'Error generating feed' });
  }
});

/**
 * GET /api/sitemap/:storeId/universal-feed
 * Serves Universal AI feed (Schema.org based JSON)
 */
router.get('/:storeId/universal-feed', async (req, res) => {
  try {
    const { storeId } = req.params;
    const language = getLanguageFromRequest(req) || 'en';

    console.log(`[Feed] Serving Universal feed for store: ${storeId}`);

    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const { data: store, error } = await tenantDb
      .from('stores')
      .select('id, slug, currency')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (error || !store) {
      return res.status(404).json({ error: 'Store not found' });
    }

    const baseUrl = await buildStoreUrl({ tenantDb, storeId: store.id, storeSlug: store.slug });
    const feed = await generateUniversalFeed(tenantDb, storeId, baseUrl, store.currency, language);

    res.set({ 'Cache-Control': 'public, max-age=3600' });
    res.json(feed);
  } catch (error) {
    console.error('[Feed] Universal error:', error);
    res.status(500).json({ error: 'Error generating feed' });
  }
});


/**
 * GET /api/sitemap/:storeId
 * Serves the sitemap.xml for a specific store by ID
 */
router.get('/:storeId', async (req, res) => {
  try {
    const { storeId } = req.params;

    console.log(`[Sitemap] Serving sitemap.xml for store: ${storeId}`);

    // Get tenant database connection
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    // Find the store - query by is_active since storeId is tenant identifier, not store UUID
    const { data: store, error } = await tenantDb
      .from('stores')
      .select('id, slug')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (error || !store) {
      console.warn(`[Sitemap] Store not found: ${storeId}`);
      return res.status(404).set({
        'Content-Type': 'text/plain; charset=utf-8'
      }).send('Store not found');
    }

    // Determine base URL (checks custom_domains table)
    const baseUrl = await buildStoreUrl({
      tenantDb,
      storeId: store.id,
      storeSlug: store.slug
    });

    // Generate sitemap
    const sitemapXml = await generateSitemapXml(storeId, baseUrl);

    if (!sitemapXml) {
      console.log(`[Sitemap] Sitemap disabled for store: ${storeId}`);
      return res.status(404).set({
        'Content-Type': 'text/plain; charset=utf-8'
      }).send('Sitemap is disabled for this store');
    }

    // Set proper content-type and headers for XML
    res.set({
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      'X-Robots-Tag': 'noindex' // Don't index the sitemap URL itself
    });

    res.send(sitemapXml);

  } catch (error) {
    console.error('[Sitemap] Error serving sitemap.xml:', error);
    res.status(500).set({
      'Content-Type': 'text/plain; charset=utf-8'
    }).send('Error generating sitemap');
  }
});

/**
 * GET /api/sitemap/store/:storeSlug
 * Serves sitemap.xml by store slug instead of ID (more SEO friendly)
 *
 * NOTE: This route requires knowing the store_id from the slug.
 * Since we're using ConnectionManager which needs store_id, we need to find it first.
 * The proper solution is to have the frontend/CDN pass the store_id directly,
 * or use a lightweight slug->id lookup service.
 */
router.get('/store/:storeSlug', async (req, res) => {
  try {
    const { storeSlug } = req.params;

    console.log(`[Sitemap] Serving sitemap.xml for store slug: ${storeSlug}`);

    // ARCHITECTURAL NOTE: Slug lookup is challenging in multi-tenant architecture.
    // We need store_id to get tenant connection, but we only have slug.
    // Options:
    // 1. Query master DB for slug->id mapping (what we're removing)
    // 2. Require frontend to pass store_id as query param
    // 3. Use a global slug registry
    //
    // Best practice: Frontend should use /api/sitemap/:storeId instead

    console.warn('[Sitemap] WARNING: Slug-based lookup not supported in multi-tenant architecture. Use /api/sitemap/:storeId instead.');

    return res.status(400).set({
      'Content-Type': 'text/plain; charset=utf-8'
    }).send('<?xml version="1.0" encoding="UTF-8"?>\n<!-- Error: Slug-based lookup not supported. Please use /api/sitemap/:storeId endpoint instead -->');

  } catch (error) {
    console.error('[Sitemap] Error serving sitemap.xml by slug:', error);
    res.status(500).set({
      'Content-Type': 'text/plain; charset=utf-8'
    }).send('Error generating sitemap');
  }
});

module.exports = router;
module.exports.generateSitemapXml = generateSitemapXml;
module.exports.generateGoogleMerchantXml = generateGoogleMerchantXml;
module.exports.generateChatGPTFeed = generateChatGPTFeed;
module.exports.generateUniversalFeed = generateUniversalFeed;
