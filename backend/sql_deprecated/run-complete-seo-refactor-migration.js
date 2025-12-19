#!/usr/bin/env node

const { sequelize } = require('../src/database/connection');

/**
 * Complete SEO Refactor Migration
 *
 * This migration runs all SEO-related schema updates in the correct order:
 * 1. Basic SEO fields (meta_title, meta_description, etc.)
 * 2. Open Graph fields (og_title, og_description, og_image_url)
 * 3. Twitter Card fields (twitter_title, twitter_description, twitter_image_url)
 * 4. Canonical URL fields
 * 5. Update SeoTemplate type enum
 */

async function runCompleteSeoRefactorMigration() {
  try {
    console.log('🚀 Starting Complete SEO Refactor Migration...');
    console.log('   This will add all SEO fields to Product, Category, and CmsPage entities');
    console.log('   and update SeoTemplate with new page types.\n');

    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connection verified\n');

    // ========================================
    // STEP 1: Add Basic SEO Fields to Products
    // ========================================
    console.log('📦 Step 1: Adding basic SEO fields to products...');
    await sequelize.query(`
      ALTER TABLE products
      ADD COLUMN IF NOT EXISTS meta_title VARCHAR(255),
      ADD COLUMN IF NOT EXISTS meta_description TEXT,
      ADD COLUMN IF NOT EXISTS meta_keywords VARCHAR(255),
      ADD COLUMN IF NOT EXISTS meta_robots_tag VARCHAR(50) DEFAULT 'index, follow';
    `);
    console.log('   ✅ Basic SEO fields added to products\n');

    // ========================================
    // STEP 2: Add Open Graph Fields to All Entities
    // ========================================
    console.log('📱 Step 2: Adding Open Graph fields to all entities...');

    await sequelize.query(`
      ALTER TABLE products
      ADD COLUMN IF NOT EXISTS og_title VARCHAR(255),
      ADD COLUMN IF NOT EXISTS og_description TEXT,
      ADD COLUMN IF NOT EXISTS og_image_url VARCHAR(255);
    `);
    console.log('   ✅ OG fields added to products');

    await sequelize.query(`
      ALTER TABLE categories
      ADD COLUMN IF NOT EXISTS og_title VARCHAR(255),
      ADD COLUMN IF NOT EXISTS og_description TEXT,
      ADD COLUMN IF NOT EXISTS og_image_url VARCHAR(255);
    `);
    console.log('   ✅ OG fields added to categories');

    await sequelize.query(`
      ALTER TABLE cms_pages
      ADD COLUMN IF NOT EXISTS og_title VARCHAR(255),
      ADD COLUMN IF NOT EXISTS og_description TEXT,
      ADD COLUMN IF NOT EXISTS og_image_url VARCHAR(255);
    `);
    console.log('   ✅ OG fields added to cms_pages\n');

    // ========================================
    // STEP 3: Add Twitter Card Fields to All Entities
    // ========================================
    console.log('🐦 Step 3: Adding Twitter Card fields to all entities...');

    await sequelize.query(`
      ALTER TABLE products
      ADD COLUMN IF NOT EXISTS twitter_title VARCHAR(255),
      ADD COLUMN IF NOT EXISTS twitter_description TEXT,
      ADD COLUMN IF NOT EXISTS twitter_image_url VARCHAR(255);
    `);
    console.log('   ✅ Twitter fields added to products');

    await sequelize.query(`
      ALTER TABLE categories
      ADD COLUMN IF NOT EXISTS twitter_title VARCHAR(255),
      ADD COLUMN IF NOT EXISTS twitter_description TEXT,
      ADD COLUMN IF NOT EXISTS twitter_image_url VARCHAR(255);
    `);
    console.log('   ✅ Twitter fields added to categories');

    await sequelize.query(`
      ALTER TABLE cms_pages
      ADD COLUMN IF NOT EXISTS twitter_title VARCHAR(255),
      ADD COLUMN IF NOT EXISTS twitter_description TEXT,
      ADD COLUMN IF NOT EXISTS twitter_image_url VARCHAR(255);
    `);
    console.log('   ✅ Twitter fields added to cms_pages\n');

    // ========================================
    // STEP 4: Add Canonical URL Fields
    // ========================================
    console.log('🔗 Step 4: Adding canonical URL fields...');

    await sequelize.query(`
      ALTER TABLE products ADD COLUMN IF NOT EXISTS canonical_url VARCHAR(255);
    `);
    await sequelize.query(`
      ALTER TABLE categories ADD COLUMN IF NOT EXISTS canonical_url VARCHAR(255);
    `);
    await sequelize.query(`
      ALTER TABLE cms_pages ADD COLUMN IF NOT EXISTS canonical_url VARCHAR(255);
    `);
    console.log('   ✅ Canonical URL fields added to all entities\n');

    // ========================================
    // STEP 5: Update SeoTemplate Schema
    // ========================================
    console.log('🏷️  Step 5: Updating SEO template schema...');

    // Remove old constraint if exists
    try {
      await sequelize.query(`
        ALTER TABLE seo_templates
        DROP CONSTRAINT IF EXISTS seo_templates_type_check;
      `);
    } catch (err) {
      console.log('   ℹ️  No existing type constraint to remove');
    }

    // Convert to VARCHAR
    await sequelize.query(`
      ALTER TABLE seo_templates
      ALTER COLUMN type TYPE VARCHAR(20);
    `);

    // Update old 'cms' type to 'cms_page'
    await sequelize.query(`
      UPDATE seo_templates
      SET type = 'cms_page'
      WHERE type = 'cms';
    `);
    console.log('   ✅ Updated old "cms" types to "cms_page"');

    // Add new check constraint
    await sequelize.query(`
      ALTER TABLE seo_templates
      ADD CONSTRAINT seo_templates_type_check
      CHECK (type IN (
        'product', 'category', 'cms_page', 'homepage', 'brand', 'blog_post'
      ));
    `);
    console.log('   ✅ New template types added: cms_page, homepage, blog_post');

    // Add Twitter fields to seo_templates
    await sequelize.query(`
      ALTER TABLE seo_templates
      ADD COLUMN IF NOT EXISTS twitter_title VARCHAR(255),
      ADD COLUMN IF NOT EXISTS twitter_description TEXT;
    `);
    console.log('   ✅ Twitter fields added to seo_templates\n');

    // ========================================
    // MIGRATION COMPLETE
    // ========================================
    console.log('✅ Complete SEO Refactor Migration finished successfully!\n');
    console.log('📊 Summary:');
    console.log('   - Products: 11 new SEO fields (meta, OG, Twitter, canonical)');
    console.log('   - Categories: 9 new fields (OG, Twitter, canonical)');
    console.log('   - CMS Pages: 9 new fields (OG, Twitter, canonical)');
    console.log('   - SEO Templates: Updated to support 6 page types + Twitter fields\n');
    console.log('🎯 SEO Priority Cascade is now fully supported:');
    console.log('   1. Entity-specific overrides (e.g., product.meta_title)');
    console.log('   2. Conditional page type templates');
    console.log('   3. Generic page type templates');
    console.log('   4. Global SEO defaults');
    console.log('   5. Automatic fallbacks\n');
    console.log('💡 Platform-specific overrides available:');
    console.log('   - Meta tags: meta_title, meta_description');
    console.log('   - Open Graph: og_title, og_description, og_image_url');
    console.log('   - Twitter: twitter_title, twitter_description, twitter_image_url');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error('Error details:', error.message);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runCompleteSeoRefactorMigration();
}

module.exports = runCompleteSeoRefactorMigration;
