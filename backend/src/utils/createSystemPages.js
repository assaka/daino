const { default404Content, default404Metadata } = require('./default404Content');
const {
  defaultPrivacyPolicyContent,
  defaultPrivacyPolicyMetadata,
  defaultPrivacyPolicyContentNL,
  defaultPrivacyPolicyMetadataNL
} = require('./defaultPrivacyPolicyContent');

/**
 * Create system CMS pages (404, Privacy Policy) for a store
 * These pages cannot be deleted and are critical for site functionality
 */
async function createSystemPages(store, CmsPage) {
  const systemPages = [];
  const storeName = store.name || 'Our Store';

  try {
    // Create 404 page if it doesn't exist
    const existing404 = await CmsPage.findOne({
      where: {
        store_id: store.id,
        slug: '404-page-not-found'
      }
    });

    if (!existing404) {
      const page404 = await CmsPage.create({
        store_id: store.id,
        slug: '404-page-not-found',
        is_active: true,
        is_system: true,
        meta_title: default404Metadata.meta_title.replace('{{store_name}}', storeName),
        meta_description: default404Metadata.meta_description,
        meta_keywords: default404Metadata.meta_keywords,
        meta_robots_tag: default404Metadata.meta_robots_tag,
        sort_order: 9999, // Keep system pages at the end
        translations: {
          en: {
            title: '404 - Page Not Found',
            content: default404Content
          }
        }
      });
      systemPages.push(page404);
      console.log(`✅ Created 404 system page for store ${store.name}`);
    } else {
      console.log(`ℹ️  404 page already exists for store ${store.name}`);
    }

    // Create Privacy Policy page if it doesn't exist
    const existingPrivacy = await CmsPage.findOne({
      where: {
        store_id: store.id,
        slug: 'privacy-policy'
      }
    });

    if (!existingPrivacy) {
      const pagePrivacy = await CmsPage.create({
        store_id: store.id,
        slug: 'privacy-policy',
        is_active: true,
        is_system: true,
        meta_title: defaultPrivacyPolicyMetadata.meta_title.replace('{{store_name}}', storeName),
        meta_description: defaultPrivacyPolicyMetadata.meta_description.replace(/{{store_name}}/g, storeName),
        meta_keywords: defaultPrivacyPolicyMetadata.meta_keywords,
        meta_robots_tag: defaultPrivacyPolicyMetadata.meta_robots_tag,
        sort_order: 9998, // Keep system pages at the end
        translations: {
          en: {
            title: 'Privacy Policy',
            content: defaultPrivacyPolicyContent.replace(/{{store_name}}/g, storeName)
          }
        }
      });
      systemPages.push(pagePrivacy);
      console.log(`✅ Created Privacy Policy system page for store ${store.name}`);
    } else {
      console.log(`ℹ️  Privacy Policy page already exists for store ${store.name}`);
    }

    return systemPages;
  } catch (error) {
    console.error(`❌ Error creating system pages for store ${store.name}:`, error);
    throw error;
  }
}

/**
 * Create system pages for all stores that don't have them
 * Useful for backfilling existing stores
 */
async function createSystemPagesForAllStores(Store, CmsPage) {
  try {
    const stores = await Store.findAll();
    console.log(`🔄 Creating system pages for ${stores.length} stores...`);

    for (const store of stores) {
      await createSystemPages(store, CmsPage);
    }

    console.log('✅ Finished creating system pages for all stores');
  } catch (error) {
    console.error('❌ Error creating system pages for all stores:', error);
    throw error;
  }
}

/**
 * Create system CMS pages for a tenant database
 * This version uses ConnectionManager for multi-tenant architecture
 */
async function createSystemPagesForTenant(storeId, storeName = 'Our Store') {
  const ConnectionManager = require('../services/database/ConnectionManager');
  const { saveCMSPageTranslations } = require('./cmsTenantHelpers');

  const systemPages = [];
  const tenantDb = await ConnectionManager.getStoreConnection(storeId);

  try {
    // Create 404 page if it doesn't exist
    const { data: existing404 } = await tenantDb
      .from('cms_pages')
      .select('*')
      .eq('store_id', storeId)
      .eq('slug', '404-page-not-found')
      .single();

    if (!existing404) {
      const { data: page404, error: create404Error } = await tenantDb
        .from('cms_pages')
        .insert({
          store_id: storeId,
          slug: '404-page-not-found',
          is_active: true,
          is_system: true,
          seo: {
            meta_title: default404Metadata.meta_title.replace('{{store_name}}', storeName),
            meta_description: default404Metadata.meta_description,
            meta_keywords: default404Metadata.meta_keywords,
            meta_robots_tag: default404Metadata.meta_robots_tag
          },
          sort_order: 9999,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (create404Error) {
        throw new Error(`Failed to create 404 page: ${create404Error.message}`);
      }

      // Save translations
      await saveCMSPageTranslations(storeId, page404.id, {
        en: {
          title: '404 - Page Not Found',
          content: default404Content
        }
      });

      systemPages.push(page404);
      console.log(`✅ Created 404 system page for store ${storeName}`);
    } else {
      console.log(`ℹ️  404 page already exists for store ${storeName}`);
    }

    // Create Privacy Policy page if it doesn't exist
    const { data: existingPrivacy } = await tenantDb
      .from('cms_pages')
      .select('*')
      .eq('store_id', storeId)
      .eq('slug', 'privacy-policy')
      .single();

    if (!existingPrivacy) {
      const { data: pagePrivacy, error: createPrivacyError } = await tenantDb
        .from('cms_pages')
        .insert({
          store_id: storeId,
          slug: 'privacy-policy',
          is_active: true,
          is_system: true,
          seo: {
            meta_title: defaultPrivacyPolicyMetadata.meta_title.replace('{{store_name}}', storeName),
            meta_description: defaultPrivacyPolicyMetadata.meta_description.replace(/{{store_name}}/g, storeName),
            meta_keywords: defaultPrivacyPolicyMetadata.meta_keywords,
            meta_robots_tag: defaultPrivacyPolicyMetadata.meta_robots_tag
          },
          sort_order: 9998,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createPrivacyError) {
        throw new Error(`Failed to create Privacy Policy page: ${createPrivacyError.message}`);
      }

      // Save translations
      await saveCMSPageTranslations(storeId, pagePrivacy.id, {
        en: {
          title: 'Privacy Policy',
          content: defaultPrivacyPolicyContent.replace(/{{store_name}}/g, storeName)
        }
      });

      systemPages.push(pagePrivacy);
      console.log(`✅ Created Privacy Policy system page for store ${storeName}`);
    } else {
      console.log(`ℹ️  Privacy Policy page already exists for store ${storeName}`);
    }

    return systemPages;
  } catch (error) {
    console.error(`❌ Error creating system pages for store ${storeName}:`, error);
    throw error;
  }
}

module.exports = {
  createSystemPages,
  createSystemPagesForAllStores,
  createSystemPagesForTenant
};
