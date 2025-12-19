#!/usr/bin/env node

/**
 * Migrate Entity Content to Translations Structure
 *
 * This script migrates existing entity data from individual columns (name, description, etc.)
 * to the translations JSON structure with English as the base language.
 *
 * Usage:
 *   NODE_ENV=production DATABASE_URL="your_db_url" node scripts/migrate-entities-to-translations.js
 */

require('dotenv').config();
const { sequelize } = require('../src/database/connection');

/**
 * Migrate Products
 */
async function migrateProducts() {
  console.log('\n📦 Migrating Products to translations structure...\n');

  try {
    const [products] = await sequelize.query(`
      SELECT id, slug, name, description, short_description, translations
      FROM products
      WHERE name IS NOT NULL
    `);

    if (products.length === 0) {
      console.log('⚠️  No products found to migrate');
      return;
    }

    console.log(`Found ${products.length} products to migrate`);

    let migrated = 0;
    let skipped = 0;

    for (const product of products) {
      const translations = product.translations || {};

      // Skip if English translation already exists with content
      if (translations.en && translations.en.name && translations.en.name.trim() !== '') {
        console.log(`  ⏭️  Skipping ${product.slug} - already has English translation`);
        skipped++;
        continue;
      }

      // Create English translation from existing columns
      translations.en = {
        name: product.name || '',
        description: product.description || '',
        short_description: product.short_description || ''
      };

      // Update the database
      await sequelize.query(`
        UPDATE products
        SET translations = :translations, updated_at = NOW()
        WHERE id = :id
      `, {
        replacements: {
          id: product.id,
          translations: JSON.stringify(translations)
        }
      });

      migrated++;
      console.log(`  ✅ Migrated: ${product.name} (${product.slug})`);
    }

    console.log(`\n✅ Products migration complete!`);
    console.log(`   Migrated: ${migrated}`);
    console.log(`   Skipped: ${skipped}`);

  } catch (error) {
    console.error('❌ Error migrating products:', error.message);
    throw error;
  }
}

/**
 * Migrate Categories
 */
async function migrateCategories() {
  console.log('\n📁 Migrating Categories to translations structure...\n');

  try {
    const [categories] = await sequelize.query(`
      SELECT id, slug, name, description, translations
      FROM categories
      WHERE name IS NOT NULL
    `);

    if (categories.length === 0) {
      console.log('⚠️  No categories found to migrate');
      return;
    }

    console.log(`Found ${categories.length} categories to migrate`);

    let migrated = 0;
    let skipped = 0;

    for (const category of categories) {
      const translations = category.translations || {};

      // Skip if English translation already exists with content
      if (translations.en && translations.en.name && translations.en.name.trim() !== '') {
        console.log(`  ⏭️  Skipping ${category.slug} - already has English translation`);
        skipped++;
        continue;
      }

      // Create English translation from existing columns
      translations.en = {
        name: category.name || '',
        description: category.description || ''
      };

      // Update the database
      await sequelize.query(`
        UPDATE categories
        SET translations = :translations, updated_at = NOW()
        WHERE id = :id
      `, {
        replacements: {
          id: category.id,
          translations: JSON.stringify(translations)
        }
      });

      migrated++;
      console.log(`  ✅ Migrated: ${category.name} (${category.slug})`);
    }

    console.log(`\n✅ Categories migration complete!`);
    console.log(`   Migrated: ${migrated}`);
    console.log(`   Skipped: ${skipped}`);

  } catch (error) {
    console.error('❌ Error migrating categories:', error.message);
    throw error;
  }
}

/**
 * Migrate CMS Pages
 */
async function migrateCmsPages() {
  console.log('\n📄 Migrating CMS Pages to translations structure...\n');

  try {
    // Check if old columns exist
    const [columns] = await sequelize.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'cms_pages'
      AND column_name IN ('title', 'content')
    `);

    if (columns.length === 0) {
      console.log('✅ CMS Pages already use translations-only structure');
      return;
    }

    const [pages] = await sequelize.query(`
      SELECT id, slug, title, content, translations
      FROM cms_pages
      WHERE title IS NOT NULL OR content IS NOT NULL
    `);

    if (pages.length === 0) {
      console.log('⚠️  No CMS pages found to migrate');
      return;
    }

    console.log(`Found ${pages.length} CMS pages to migrate`);

    let migrated = 0;
    let skipped = 0;

    for (const page of pages) {
      const translations = page.translations || {};

      // Skip if English translation already exists with content
      if (translations.en && translations.en.title && translations.en.title.trim() !== '') {
        console.log(`  ⏭️  Skipping ${page.slug} - already has English translation`);
        skipped++;
        continue;
      }

      // Create English translation from existing columns
      translations.en = {
        title: page.title || '',
        content: page.content || ''
      };

      // Update the database
      await sequelize.query(`
        UPDATE cms_pages
        SET translations = :translations, updated_at = NOW()
        WHERE id = :id
      `, {
        replacements: {
          id: page.id,
          translations: JSON.stringify(translations)
        }
      });

      migrated++;
      console.log(`  ✅ Migrated: ${page.title || page.slug}`);
    }

    console.log(`\n✅ CMS Pages migration complete!`);
    console.log(`   Migrated: ${migrated}`);
    console.log(`   Skipped: ${skipped}`);

  } catch (error) {
    console.error('❌ Error migrating CMS pages:', error.message);
    throw error;
  }
}

/**
 * Migrate CMS Blocks
 */
async function migrateCmsBlocks() {
  console.log('\n📝 Migrating CMS Blocks to translations structure...\n');

  try {
    // Check if old columns exist
    const [columns] = await sequelize.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'cms_blocks'
      AND column_name IN ('title', 'content')
    `);

    if (columns.length === 0) {
      console.log('✅ CMS Blocks already use translations-only structure');
      return;
    }

    const [blocks] = await sequelize.query(`
      SELECT id, identifier, title, content, translations
      FROM cms_blocks
      WHERE title IS NOT NULL OR content IS NOT NULL
    `);

    if (blocks.length === 0) {
      console.log('⚠️  No CMS blocks found to migrate');
      return;
    }

    console.log(`Found ${blocks.length} CMS blocks to migrate`);

    let migrated = 0;
    let skipped = 0;

    for (const block of blocks) {
      const translations = block.translations || {};

      // Skip if English translation already exists with content
      if (translations.en && translations.en.title && translations.en.title.trim() !== '') {
        console.log(`  ⏭️  Skipping ${block.identifier} - already has English translation`);
        skipped++;
        continue;
      }

      // Create English translation from existing columns
      translations.en = {
        title: block.title || '',
        content: block.content || ''
      };

      // Update the database
      await sequelize.query(`
        UPDATE cms_blocks
        SET translations = :translations, updated_at = NOW()
        WHERE id = :id
      `, {
        replacements: {
          id: block.id,
          translations: JSON.stringify(translations)
        }
      });

      migrated++;
      console.log(`  ✅ Migrated: ${block.title || block.identifier}`);
    }

    console.log(`\n✅ CMS Blocks migration complete!`);
    console.log(`   Migrated: ${migrated}`);
    console.log(`   Skipped: ${skipped}`);

  } catch (error) {
    console.error('❌ Error migrating CMS blocks:', error.message);
    throw error;
  }
}

/**
 * Verify migrations
 */
async function verifyMigrations() {
  console.log('\n🔍 Verifying migrations...\n');

  try {
    // Check products
    const [products] = await sequelize.query(`
      SELECT COUNT(*) as total,
             COUNT(CASE WHEN translations IS NOT NULL AND translations::text != '{}' THEN 1 END) as with_translations
      FROM products
    `);
    console.log(`Products:`);
    console.log(`  Total: ${products[0].total}`);
    console.log(`  With translations: ${products[0].with_translations}`);

    // Check categories
    const [categories] = await sequelize.query(`
      SELECT COUNT(*) as total,
             COUNT(CASE WHEN translations IS NOT NULL AND translations::text != '{}' THEN 1 END) as with_translations
      FROM categories
    `);
    console.log(`\nCategories:`);
    console.log(`  Total: ${categories[0].total}`);
    console.log(`  With translations: ${categories[0].with_translations}`);

    // Sample product
    const [sampleProduct] = await sequelize.query(`
      SELECT name, slug, translations
      FROM products
      WHERE translations IS NOT NULL AND translations::text != '{}'
      LIMIT 1
    `);
    if (sampleProduct.length > 0) {
      console.log(`\n📋 Sample Product:`);
      console.log(`  Name: ${sampleProduct[0].name}`);
      console.log(`  Slug: ${sampleProduct[0].slug}`);
      console.log(`  Translations:`, JSON.stringify(sampleProduct[0].translations, null, 2));
    }

    // Sample category
    const [sampleCategory] = await sequelize.query(`
      SELECT name, slug, translations
      FROM categories
      WHERE translations IS NOT NULL AND translations::text != '{}'
      LIMIT 1
    `);
    if (sampleCategory.length > 0) {
      console.log(`\n📋 Sample Category:`);
      console.log(`  Name: ${sampleCategory[0].name}`);
      console.log(`  Slug: ${sampleCategory[0].slug}`);
      console.log(`  Translations:`, JSON.stringify(sampleCategory[0].translations, null, 2));
    }

  } catch (error) {
    console.error('❌ Error verifying migrations:', error.message);
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🔄 Entity Content Migration Tool\n');
  console.log('This script will migrate existing entity data to the translations structure.');
  console.log('English (en) will be used as the base language.\n');

  try {
    await sequelize.authenticate();
    console.log('✅ Database connected\n');

    const startTime = Date.now();

    // Run migrations
    await migrateProducts();
    await migrateCategories();
    await migrateCmsPages();
    await migrateCmsBlocks();

    // Verify
    await verifyMigrations();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n🎉 Migration complete! (${duration}s)\n`);

    console.log('📋 Next steps:');
    console.log('   1. Verify the data in your admin panel');
    console.log('   2. Use populate-entity-translations.js to translate to other languages');
    console.log('   3. Example: node scripts/populate-entity-translations.js --entity=products --language=es\n');

    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    await sequelize.close();
    process.exit(1);
  }
}

// Run
main();
