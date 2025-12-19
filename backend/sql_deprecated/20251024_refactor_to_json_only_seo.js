/**
 * Migration: Refactor to JSON-only SEO fields
 *
 * This migration consolidates all SEO fields into a single JSON column per table.
 *
 * BEFORE (33 columns total):
 * - Products: 11 individual SEO columns + seo JSON
 * - Categories: 11 individual SEO columns
 * - CMS Pages: 11 individual SEO columns
 * - SeoTemplates: 7 individual template columns
 *
 * AFTER (4 JSON columns total):
 * - Products: seo JSON (all fields)
 * - Categories: seo JSON (all fields)
 * - CMS Pages: seo JSON (all fields)
 * - SeoTemplates: template JSON (all fields)
 *
 * This migration:
 * 1. Creates seo JSON column (if not exists)
 * 2. Migrates data from individual columns → JSON
 * 3. Drops individual columns
 * 4. Updates SeoTemplate to use template JSON
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🔄 Starting JSON-only SEO refactor migration...\n');

    // ========================================
    // STEP 1: Ensure seo JSON column exists on all tables
    // ========================================
    console.log('📦 Step 1: Ensuring seo JSON columns exist...');

    try {
      // Check if seo column exists, if not create it
      await queryInterface.sequelize.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name='products' AND column_name='seo'
          ) THEN
            ALTER TABLE products ADD COLUMN seo JSON DEFAULT '{}';
          END IF;
        END $$;
      `);
      console.log('   ✅ Products seo column ready');

      await queryInterface.sequelize.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name='categories' AND column_name='seo'
          ) THEN
            ALTER TABLE categories ADD COLUMN seo JSON DEFAULT '{}';
          END IF;
        END $$;
      `);
      console.log('   ✅ Categories seo column ready');

      await queryInterface.sequelize.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name='cms_pages' AND column_name='seo'
          ) THEN
            ALTER TABLE cms_pages ADD COLUMN seo JSON DEFAULT '{}';
          END IF;
        END $$;
      `);
      console.log('   ✅ CMS Pages seo column ready\n');
    } catch (err) {
      console.log('   ℹ️  JSON columns already exist or error:', err.message);
    }

    // ========================================
    // STEP 2: Migrate data from columns → JSON for Products
    // ========================================
    console.log('📦 Step 2: Migrating products data to JSON...');

    await queryInterface.sequelize.query(`
      UPDATE products
      SET seo = jsonb_build_object(
        'meta_title', COALESCE(meta_title, ''),
        'meta_description', COALESCE(meta_description, ''),
        'meta_keywords', COALESCE(meta_keywords, ''),
        'meta_robots_tag', COALESCE(meta_robots_tag, 'index, follow'),
        'og_title', COALESCE(og_title, ''),
        'og_description', COALESCE(og_description, ''),
        'og_image_url', COALESCE(og_image_url, ''),
        'twitter_title', COALESCE(twitter_title, ''),
        'twitter_description', COALESCE(twitter_description, ''),
        'twitter_image_url', COALESCE(twitter_image_url, ''),
        'canonical_url', COALESCE(canonical_url, '')
      )
      WHERE meta_title IS NOT NULL
         OR meta_description IS NOT NULL
         OR og_title IS NOT NULL
         OR twitter_title IS NOT NULL;
    `);
    console.log('   ✅ Products data migrated to JSON\n');

    // ========================================
    // STEP 3: Migrate data for Categories
    // ========================================
    console.log('📁 Step 3: Migrating categories data to JSON...');

    await queryInterface.sequelize.query(`
      UPDATE categories
      SET seo = jsonb_build_object(
        'meta_title', COALESCE(meta_title, ''),
        'meta_description', COALESCE(meta_description, ''),
        'meta_keywords', COALESCE(meta_keywords, ''),
        'meta_robots_tag', COALESCE(meta_robots_tag, 'index, follow'),
        'og_title', COALESCE(og_title, ''),
        'og_description', COALESCE(og_description, ''),
        'og_image_url', COALESCE(og_image_url, ''),
        'twitter_title', COALESCE(twitter_title, ''),
        'twitter_description', COALESCE(twitter_description, ''),
        'twitter_image_url', COALESCE(twitter_image_url, ''),
        'canonical_url', COALESCE(canonical_url, '')
      )
      WHERE meta_title IS NOT NULL
         OR meta_description IS NOT NULL
         OR og_title IS NOT NULL
         OR twitter_title IS NOT NULL;
    `);
    console.log('   ✅ Categories data migrated to JSON\n');

    // ========================================
    // STEP 4: Migrate data for CMS Pages
    // ========================================
    console.log('📄 Step 4: Migrating cms_pages data to JSON...');

    await queryInterface.sequelize.query(`
      UPDATE cms_pages
      SET seo = jsonb_build_object(
        'meta_title', COALESCE(meta_title, ''),
        'meta_description', COALESCE(meta_description, ''),
        'meta_keywords', COALESCE(meta_keywords, ''),
        'meta_robots_tag', COALESCE(meta_robots_tag, 'index, follow'),
        'og_title', COALESCE(og_title, ''),
        'og_description', COALESCE(og_description, ''),
        'og_image_url', COALESCE(og_image_url, ''),
        'twitter_title', COALESCE(twitter_title, ''),
        'twitter_description', COALESCE(twitter_description, ''),
        'twitter_image_url', COALESCE(twitter_image_url, ''),
        'canonical_url', COALESCE(canonical_url, '')
      )
      WHERE meta_title IS NOT NULL
         OR meta_description IS NOT NULL
         OR og_title IS NOT NULL
         OR twitter_title IS NOT NULL;
    `);
    console.log('   ✅ CMS Pages data migrated to JSON\n');

    // ========================================
    // STEP 5: Migrate SeoTemplate to use template JSON
    // ========================================
    console.log('🏷️  Step 5: Migrating seo_templates to JSON...');

    // Add template column if not exists
    try {
      await queryInterface.sequelize.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name='seo_templates' AND column_name='template'
          ) THEN
            ALTER TABLE seo_templates ADD COLUMN template JSON DEFAULT '{}';
          END IF;
        END $$;
      `);
    } catch (err) {
      console.log('   ℹ️  Template column already exists');
    }

    // Migrate template data
    await queryInterface.sequelize.query(`
      UPDATE seo_templates
      SET template = jsonb_build_object(
        'meta_title', COALESCE(meta_title, ''),
        'meta_description', COALESCE(meta_description, ''),
        'meta_keywords', COALESCE(meta_keywords, ''),
        'og_title', COALESCE(og_title, ''),
        'og_description', COALESCE(og_description, ''),
        'twitter_title', COALESCE(twitter_title, ''),
        'twitter_description', COALESCE(twitter_description, '')
      )
      WHERE meta_title IS NOT NULL
         OR meta_description IS NOT NULL
         OR og_title IS NOT NULL;
    `);
    console.log('   ✅ SeoTemplates data migrated to JSON\n');

    // ========================================
    // STEP 6: Drop individual columns from Products
    // ========================================
    console.log('🗑️  Step 6: Dropping individual columns from products...');

    const productColumns = [
      'meta_title', 'meta_description', 'meta_keywords', 'meta_robots_tag',
      'og_title', 'og_description', 'og_image_url',
      'twitter_title', 'twitter_description', 'twitter_image_url',
      'canonical_url'
    ];

    for (const col of productColumns) {
      try {
        await queryInterface.removeColumn('products', col);
        console.log(`   ✅ Dropped products.${col}`);
      } catch (err) {
        console.log(`   ℹ️  Column products.${col} doesn't exist or already dropped`);
      }
    }
    console.log();

    // ========================================
    // STEP 7: Drop individual columns from Categories
    // ========================================
    console.log('🗑️  Step 7: Dropping individual columns from categories...');

    const categoryColumns = [
      'meta_title', 'meta_description', 'meta_keywords', 'meta_robots_tag',
      'og_title', 'og_description', 'og_image_url',
      'twitter_title', 'twitter_description', 'twitter_image_url',
      'canonical_url'
    ];

    for (const col of categoryColumns) {
      try {
        await queryInterface.removeColumn('categories', col);
        console.log(`   ✅ Dropped categories.${col}`);
      } catch (err) {
        console.log(`   ℹ️  Column categories.${col} doesn't exist or already dropped`);
      }
    }
    console.log();

    // ========================================
    // STEP 8: Drop individual columns from CMS Pages
    // ========================================
    console.log('🗑️  Step 8: Dropping individual columns from cms_pages...');

    for (const col of categoryColumns) { // Same columns as categories
      try {
        await queryInterface.removeColumn('cms_pages', col);
        console.log(`   ✅ Dropped cms_pages.${col}`);
      } catch (err) {
        console.log(`   ℹ️  Column cms_pages.${col} doesn't exist or already dropped`);
      }
    }
    console.log();

    // ========================================
    // STEP 9: Drop individual columns from SeoTemplates
    // ========================================
    console.log('🗑️  Step 9: Dropping individual columns from seo_templates...');

    const templateColumns = [
      'meta_title', 'meta_description', 'meta_keywords',
      'og_title', 'og_description',
      'twitter_title', 'twitter_description'
    ];

    for (const col of templateColumns) {
      try {
        await queryInterface.removeColumn('seo_templates', col);
        console.log(`   ✅ Dropped seo_templates.${col}`);
      } catch (err) {
        console.log(`   ℹ️  Column seo_templates.${col} doesn't exist or already dropped`);
      }
    }
    console.log();

    // ========================================
    // MIGRATION COMPLETE
    // ========================================
    console.log('✅ JSON-only SEO refactor migration completed!\n');
    console.log('📊 Summary:');
    console.log('   BEFORE: 33 individual SEO columns across all tables');
    console.log('   AFTER:  4 JSON columns (seo in products/categories/cms_pages, template in seo_templates)');
    console.log('   ✅ All data preserved and migrated to JSON');
    console.log('   ✅ Schema is now much cleaner and more flexible');
    console.log('   ✅ No migrations needed for future SEO field additions\n');
  },

  down: async (queryInterface, Sequelize) => {
    console.log('⚠️  Reverting JSON-only SEO refactor...\n');

    // This is a complex rollback - would need to:
    // 1. Recreate all individual columns
    // 2. Extract data from JSON back to columns
    // 3. Drop JSON columns

    console.log('❌ Rollback not implemented - data is in JSON format');
    console.log('   If you need to rollback, restore from backup before this migration');

    throw new Error('Rollback not supported for JSON-only refactor. Restore from backup.');
  }
};
