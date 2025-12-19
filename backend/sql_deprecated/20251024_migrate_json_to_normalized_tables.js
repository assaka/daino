/**
 * Migration: Copy JSON Data to Normalized Tables
 *
 * This migration copies all translation and SEO data from JSON columns
 * to the normalized relational tables.
 *
 * IMPORTANT: Run this AFTER 20251024_create_normalized_translations_and_seo.js
 *
 * WHAT THIS DOES:
 * 1. Reads all entities with translations/seo JSON columns
 * 2. Extracts data for each language
 * 3. Inserts into normalized translation tables
 * 4. Migrates SEO data to separate SEO tables
 *
 * SAFETY:
 * - Original JSON columns are NOT dropped (kept for rollback)
 * - All inserts use ON CONFLICT DO NOTHING (idempotent)
 * - Progress logged for every entity type
 * - Can be re-run safely
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🔄 Starting JSON → Normalized Tables data migration...\n');

    const { sequelize } = queryInterface;

    // ========================================
    // HELPER FUNCTION: Migrate entity translations
    // ========================================
    async function migrateEntityTranslations(entityTable, translationTable, entityIdField, fields, fieldMapping = null) {
      console.log(`\n📦 Migrating ${entityTable} → ${translationTable}...`);

      try {
        const entities = await sequelize.query(
          `SELECT id, translations FROM ${entityTable} WHERE translations IS NOT NULL`,
          { type: Sequelize.QueryTypes.SELECT }
        );

        let migratedCount = 0;
        let skippedCount = 0;

        for (const entity of entities) {
          if (!entity.translations || Object.keys(entity.translations).length === 0) {
            skippedCount++;
            continue;
          }

          // Handle both JSON object and stringified JSON
          const translations = typeof entity.translations === 'string'
            ? JSON.parse(entity.translations)
            : entity.translations;

          // Insert translation for each language
          for (const [langCode, data] of Object.entries(translations)) {
            if (!data || typeof data !== 'object') continue;

            // Build field list and values
            const fieldValues = fields.map(field => {
              // If fieldMapping exists, use it to map JSON field names to table column names
              const jsonField = fieldMapping && fieldMapping[field] ? fieldMapping[field] : field;
              const value = data[jsonField];
              // Escape single quotes for SQL
              if (value === null || value === undefined) return null;
              if (typeof value === 'string') {
                return value.replace(/'/g, "''");
              }
              return value;
            });

            // Only insert if at least one field has a value
            if (fieldValues.some(v => v !== null && v !== '')) {
              const fieldList = fields.map((f, i) => `${f}`).join(', ');
              const valueList = fieldValues.map(v =>
                v === null ? 'NULL' : `'${v}'`
              ).join(', ');

              await sequelize.query(`
                INSERT INTO ${translationTable}
                (${entityIdField}, language_code, ${fieldList}, created_at, updated_at)
                VALUES ('${entity.id}', '${langCode}', ${valueList}, NOW(), NOW())
                ON CONFLICT (${entityIdField}, language_code) DO NOTHING
              `);

              migratedCount++;
            }
          }
        }

        console.log(`   ✅ Migrated ${migratedCount} translations (${skippedCount} skipped)`);
      } catch (error) {
        console.error(`   ❌ Error migrating ${entityTable}:`, error.message);
        throw error;
      }
    }

    // ========================================
    // HELPER FUNCTION: Migrate SEO data
    // ========================================
    async function migrateEntitySEO(entityTable, seoTable, entityIdField) {
      console.log(`\n🔍 Migrating ${entityTable} SEO → ${seoTable}...`);

      try {
        const entities = await sequelize.query(
          `SELECT id, seo FROM ${entityTable} WHERE seo IS NOT NULL`,
          { type: Sequelize.QueryTypes.SELECT }
        );

        let migratedCount = 0;
        let skippedCount = 0;

        for (const entity of entities) {
          if (!entity.seo || Object.keys(entity.seo).length === 0) {
            skippedCount++;
            continue;
          }

          // Handle both JSON object and stringified JSON
          const seoData = typeof entity.seo === 'string'
            ? JSON.parse(entity.seo)
            : entity.seo;

          // SEO can be structured two ways:
          // 1. Per-language: {en: {meta_title: '...'}, nl: {...}}
          // 2. Single object: {meta_title: '...', og_title: '...'} (language-agnostic)

          // Check if this is per-language SEO
          const isPerLanguage = Object.keys(seoData).some(key =>
            typeof seoData[key] === 'object' && seoData[key] !== null &&
            (seoData[key].meta_title || seoData[key].meta_description)
          );

          if (isPerLanguage) {
            // Per-language SEO structure
            for (const [langCode, data] of Object.entries(seoData)) {
              if (!data || typeof data !== 'object') continue;

              const fields = [
                'meta_title', 'meta_description', 'meta_keywords', 'meta_robots_tag',
                'og_title', 'og_description', 'og_image_url',
                'twitter_title', 'twitter_description', 'twitter_image_url',
                'canonical_url'
              ];

              const hasData = fields.some(f => data[f]);
              if (!hasData) continue;

              const values = fields.map(f => {
                const val = data[f];
                if (!val) return 'NULL';
                return `'${String(val).replace(/'/g, "''")}'`;
              }).join(', ');

              await sequelize.query(`
                INSERT INTO ${seoTable}
                (${entityIdField}, language_code, ${fields.join(', ')}, created_at, updated_at)
                VALUES ('${entity.id}', '${langCode}', ${values}, NOW(), NOW())
                ON CONFLICT (${entityIdField}, language_code) DO NOTHING
              `);

              migratedCount++;
            }
          } else {
            // Language-agnostic SEO (fallback to 'en')
            const fields = [
              'meta_title', 'meta_description', 'meta_keywords', 'meta_robots_tag',
              'og_title', 'og_description', 'og_image_url',
              'twitter_title', 'twitter_description', 'twitter_image_url',
              'canonical_url'
            ];

            const hasData = fields.some(f => seoData[f]);
            if (hasData) {
              const values = fields.map(f => {
                const val = seoData[f];
                if (!val) return 'NULL';
                return `'${String(val).replace(/'/g, "''")}'`;
              }).join(', ');

              await sequelize.query(`
                INSERT INTO ${seoTable}
                (${entityIdField}, language_code, ${fields.join(', ')}, created_at, updated_at)
                VALUES ('${entity.id}', 'en', ${values}, NOW(), NOW())
                ON CONFLICT (${entityIdField}, language_code) DO NOTHING
              `);

              migratedCount++;
            }
          }
        }

        console.log(`   ✅ Migrated ${migratedCount} SEO records (${skippedCount} skipped)`);
      } catch (error) {
        console.error(`   ❌ Error migrating ${entityTable} SEO:`, error.message);
        throw error;
      }
    }

    // ========================================
    // MIGRATE ALL ENTITY TRANSLATIONS
    // ========================================

    // 1. Products
    await migrateEntityTranslations(
      'products',
      'product_translations',
      'product_id',
      ['name', 'description', 'short_description']
    );

    // 2. Categories
    await migrateEntityTranslations(
      'categories',
      'category_translations',
      'category_id',
      ['name', 'description']
    );

    // 3. CMS Pages
    await migrateEntityTranslations(
      'cms_pages',
      'cms_page_translations',
      'cms_page_id',
      ['title', 'content', 'excerpt']
    );

    // 4. Attributes
    await migrateEntityTranslations(
      'attributes',
      'attribute_translations',
      'attribute_id',
      ['label', 'description']
    );

    // 5. Attribute Values
    await migrateEntityTranslations(
      'attribute_values',
      'attribute_value_translations',
      'attribute_value_id',
      ['value', 'description'],
      { value: 'label' } // Map JSON 'label' field to table 'value' column
    );

    // 6. CMS Blocks
    await migrateEntityTranslations(
      'cms_blocks',
      'cms_block_translations',
      'cms_block_id',
      ['title', 'content']
    );

    // 7. Product Tabs
    await migrateEntityTranslations(
      'product_tabs',
      'product_tab_translations',
      'product_tab_id',
      ['name', 'content']
    );

    // 8. Product Labels
    await migrateEntityTranslations(
      'product_labels',
      'product_label_translations',
      'product_label_id',
      ['name', 'text']
    );

    // 9. Coupons
    await migrateEntityTranslations(
      'coupons',
      'coupon_translations',
      'coupon_id',
      ['name', 'description']
    );

    // 10. Shipping Methods
    await migrateEntityTranslations(
      'shipping_methods',
      'shipping_method_translations',
      'shipping_method_id',
      ['name', 'description']
    );

    // 11. Payment Methods
    await migrateEntityTranslations(
      'payment_methods',
      'payment_method_translations',
      'payment_method_id',
      ['name', 'description']
    );

    // 12. Cookie Consent Settings
    await migrateEntityTranslations(
      'cookie_consent_settings',
      'cookie_consent_settings_translations',
      'cookie_consent_settings_id',
      ['banner_text', 'accept_button_text', 'reject_button_text', 'settings_button_text', 'privacy_policy_text']
    );

    // ========================================
    // MIGRATE ALL SEO DATA
    // ========================================

    // 1. Product SEO
    await migrateEntitySEO('products', 'product_seo', 'product_id');

    // 2. Category SEO
    await migrateEntitySEO('categories', 'category_seo', 'category_id');

    // 3. CMS Page SEO
    await migrateEntitySEO('cms_pages', 'cms_page_seo', 'cms_page_id');

    console.log('\n✅ JSON → Normalized migration completed successfully!\n');
    console.log('📊 Summary:');
    console.log('   - All entity translations migrated to normalized tables');
    console.log('   - All SEO metadata migrated to normalized tables');
    console.log('   - Original JSON columns preserved for rollback');
    console.log('\n💡 Next steps:');
    console.log('   1. Update Sequelize models with associations');
    console.log('   2. Update backend routes to use JOIN queries');
    console.log('   3. Test all storefront pages');
    console.log('   4. Drop JSON columns after verification\n');
  },

  down: async (queryInterface, Sequelize) => {
    console.log('⚠️  Rolling back data migration...\n');
    console.log('⚠️  This will DELETE all data from normalized tables!');
    console.log('⚠️  Original JSON columns will remain intact.\n');

    const { sequelize } = queryInterface;

    // Truncate all translation and SEO tables
    const tables = [
      'product_translations',
      'category_translations',
      'cms_page_translations',
      'attribute_translations',
      'attribute_value_translations',
      'cms_block_translations',
      'product_tab_translations',
      'product_label_translations',
      'coupon_translations',
      'shipping_method_translations',
      'payment_method_translations',
      'cookie_consent_settings_translations',
      'product_seo',
      'category_seo',
      'cms_page_seo'
    ];

    for (const table of tables) {
      console.log(`Truncating ${table}...`);
      await sequelize.query(`TRUNCATE TABLE ${table} CASCADE`);
    }

    console.log('\n✅ All normalized tables truncated');
    console.log('✅ Original JSON data remains intact\n');
  }
};
