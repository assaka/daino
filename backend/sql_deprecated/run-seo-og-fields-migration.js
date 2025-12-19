#!/usr/bin/env node

const { sequelize } = require('../src/database/connection');

async function runSeoOgFieldsMigration() {
  try {
    console.log('🚀 Starting SEO and Open Graph fields migration...');
    console.log('   This will add comprehensive SEO fields to Product, Category, and CmsPage entities');

    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connection verified');

    // Step 1: Add SEO fields to products table
    console.log('\n📦 Adding SEO fields to products table...');

    await sequelize.query(`
      ALTER TABLE products
      ADD COLUMN IF NOT EXISTS meta_title VARCHAR(255),
      ADD COLUMN IF NOT EXISTS meta_description TEXT,
      ADD COLUMN IF NOT EXISTS meta_keywords VARCHAR(255),
      ADD COLUMN IF NOT EXISTS meta_robots_tag VARCHAR(50) DEFAULT 'index, follow';
    `);
    console.log('   ✅ Basic SEO fields added to products');

    await sequelize.query(`
      ALTER TABLE products
      ADD COLUMN IF NOT EXISTS og_title VARCHAR(255),
      ADD COLUMN IF NOT EXISTS og_description TEXT,
      ADD COLUMN IF NOT EXISTS og_image_url VARCHAR(255),
      ADD COLUMN IF NOT EXISTS canonical_url VARCHAR(255);
    `);
    console.log('   ✅ Open Graph fields added to products');

    // Step 2: Add Open Graph fields to categories
    console.log('\n📁 Adding Open Graph fields to categories table...');

    await sequelize.query(`
      ALTER TABLE categories
      ADD COLUMN IF NOT EXISTS og_title VARCHAR(255),
      ADD COLUMN IF NOT EXISTS og_description TEXT,
      ADD COLUMN IF NOT EXISTS og_image_url VARCHAR(255),
      ADD COLUMN IF NOT EXISTS canonical_url VARCHAR(255);
    `);
    console.log('   ✅ Open Graph fields added to categories');

    // Step 3: Add Open Graph fields to cms_pages
    console.log('\n📄 Adding Open Graph fields to cms_pages table...');

    await sequelize.query(`
      ALTER TABLE cms_pages
      ADD COLUMN IF NOT EXISTS og_title VARCHAR(255),
      ADD COLUMN IF NOT EXISTS og_description TEXT,
      ADD COLUMN IF NOT EXISTS og_image_url VARCHAR(255),
      ADD COLUMN IF NOT EXISTS canonical_url VARCHAR(255);
    `);
    console.log('   ✅ Open Graph fields added to cms_pages');

    // Step 4: Update SeoTemplate type enum
    console.log('\n🏷️  Updating SEO template types...');

    // Remove old constraint if exists
    try {
      await sequelize.query(`
        ALTER TABLE seo_templates
        DROP CONSTRAINT IF EXISTS seo_templates_type_check;
      `);
    } catch (err) {
      console.log('   ℹ️  No existing type constraint to remove');
    }

    // Convert to VARCHAR to allow modification
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
    console.log('   ✅ Updated old "cms" type to "cms_page"');

    // Add new check constraint for valid types
    await sequelize.query(`
      ALTER TABLE seo_templates
      ADD CONSTRAINT seo_templates_type_check
      CHECK (type IN (
        'product', 'category', 'cms_page', 'homepage', 'brand', 'blog_post'
      ));
    `);
    console.log('   ✅ New template types added: cms_page, homepage, blog_post');

    console.log('\n✅ Migration completed successfully!');
    console.log('\n📊 Summary:');
    console.log('   - Products: Added 8 SEO fields (meta + OG + canonical)');
    console.log('   - Categories: Added 4 Open Graph fields');
    console.log('   - CMS Pages: Added 4 Open Graph fields');
    console.log('   - SEO Templates: Updated to support 6 page types');
    console.log('\n🎯 SEO Priority Cascade is now fully supported:');
    console.log('   1. Entity-specific overrides (product.meta_title, etc.)');
    console.log('   2. Conditional page type templates');
    console.log('   3. Generic page type templates');
    console.log('   4. Global SEO defaults');
    console.log('   5. Automatic fallbacks');

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
  runSeoOgFieldsMigration();
}

module.exports = runSeoOgFieldsMigration;
