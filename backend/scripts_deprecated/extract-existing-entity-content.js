#!/usr/bin/env node

/**
 * Extract Existing Entity Content to Translations
 *
 * This script extracts existing content from old schema columns (if any)
 * and populates the translations JSON column with English content.
 *
 * This is useful for migrating existing data to the new translation structure.
 *
 * Usage:
 *   node scripts/extract-existing-entity-content.js
 */

require('dotenv').config();
const { sequelize } = require('../src/database/connection');

/**
 * Check if products have old name/description columns
 */
async function migrateProducts() {
  console.log('\n📦 Checking Products...\n');

  try {
    // Check if old columns exist
    const [columns] = await sequelize.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'products'
      AND column_name IN ('name', 'description', 'short_description')
    `);

    if (columns.length === 0) {
      console.log('✅ Products already use translations-only structure');
      return;
    }

    console.log(`Found old columns: ${columns.map(c => c.column_name).join(', ')}`);

    // Migrate old column data to translations
    const [products] = await sequelize.query(`
      SELECT id, slug, name, description, short_description, translations
      FROM products
    `);

    let migrated = 0;
    for (const product of products) {
      const translations = product.translations || {};

      // If English translation doesn't exist, create it from old columns
      if (!translations.en || !translations.en.name) {
        translations.en = {
          name: product.name || '',
          description: product.description || '',
          short_description: product.short_description || ''
        };

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
        console.log(`  ✅ Migrated: ${product.name || product.slug}`);
      }
    }

    console.log(`\n✅ Migrated ${migrated} products\n`);

  } catch (error) {
    console.error('❌ Error migrating products:', error.message);
  }
}

/**
 * Check if categories have old name/description columns
 */
async function migrateCategories() {
  console.log('\n📁 Checking Categories...\n');

  try {
    // Check if old columns exist
    const [columns] = await sequelize.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'categories'
      AND column_name IN ('name', 'description')
    `);

    if (columns.length === 0) {
      console.log('✅ Categories already use translations-only structure');
      return;
    }

    console.log(`Found old columns: ${columns.map(c => c.column_name).join(', ')}`);

    // Migrate old column data to translations
    const [categories] = await sequelize.query(`
      SELECT id, slug, name, description, translations
      FROM categories
    `);

    let migrated = 0;
    for (const category of categories) {
      const translations = category.translations || {};

      // If English translation doesn't exist, create it from old columns
      if (!translations.en || !translations.en.name) {
        translations.en = {
          name: category.name || '',
          description: category.description || ''
        };

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
        console.log(`  ✅ Migrated: ${category.name || category.slug}`);
      }
    }

    console.log(`\n✅ Migrated ${migrated} categories\n`);

  } catch (error) {
    console.error('❌ Error migrating categories:', error.message);
  }
}

/**
 * Check if CMS pages have old title/content columns
 */
async function migrateCmsPages() {
  console.log('\n📄 Checking CMS Pages...\n');

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

    console.log(`Found old columns: ${columns.map(c => c.column_name).join(', ')}`);

    // Migrate old column data to translations
    const [pages] = await sequelize.query(`
      SELECT id, slug, title, content, translations
      FROM cms_pages
    `);

    let migrated = 0;
    for (const page of pages) {
      const translations = page.translations || {};

      // If English translation doesn't exist, create it from old columns
      if (!translations.en || !translations.en.title) {
        translations.en = {
          title: page.title || '',
          content: page.content || ''
        };

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
    }

    console.log(`\n✅ Migrated ${migrated} CMS pages\n`);

  } catch (error) {
    console.error('❌ Error migrating CMS pages:', error.message);
  }
}

/**
 * Check if CMS blocks have old title/content columns
 */
async function migrateCmsBlocks() {
  console.log('\n📝 Checking CMS Blocks...\n');

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

    console.log(`Found old columns: ${columns.map(c => c.column_name).join(', ')}`);

    // Migrate old column data to translations
    const [blocks] = await sequelize.query(`
      SELECT id, identifier, title, content, translations
      FROM cms_blocks
    `);

    let migrated = 0;
    for (const block of blocks) {
      const translations = block.translations || {};

      // If English translation doesn't exist, create it from old columns
      if (!translations.en || !translations.en.title) {
        translations.en = {
          title: block.title || '',
          content: block.content || ''
        };

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
    }

    console.log(`\n✅ Migrated ${migrated} CMS blocks\n`);

  } catch (error) {
    console.error('❌ Error migrating CMS blocks:', error.message);
  }
}

/**
 * Generate sample entities if none exist
 */
async function generateSampleContent() {
  console.log('\n🎨 Checking for existing content...\n');

  try {
    // Check products
    const [products] = await sequelize.query('SELECT COUNT(*) as count FROM products');
    if (products[0].count === 0) {
      console.log('ℹ️  No products found. You can add sample products via the admin panel.');
    }

    // Check categories
    const [categories] = await sequelize.query('SELECT COUNT(*) as count FROM categories');
    if (categories[0].count === 0) {
      console.log('ℹ️  No categories found. You can add sample categories via the admin panel.');
    }

    // Check CMS pages
    const [pages] = await sequelize.query('SELECT COUNT(*) as count FROM cms_pages');
    if (pages[0].count === 0) {
      console.log('ℹ️  No CMS pages found. You can add sample pages via the admin panel.');
    }

    // Check CMS blocks
    const [blocks] = await sequelize.query('SELECT COUNT(*) as count FROM cms_blocks');
    if (blocks[0].count === 0) {
      console.log('ℹ️  No CMS blocks found. You can add sample blocks via the admin panel.');
    }

  } catch (error) {
    console.error('❌ Error checking content:', error.message);
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🔄 Entity Content Extraction Tool\n');

  try {
    await sequelize.authenticate();
    console.log('✅ Database connected\n');

    await migrateProducts();
    await migrateCategories();
    await migrateCmsPages();
    await migrateCmsBlocks();
    await generateSampleContent();

    console.log('\n🎉 Content extraction complete!\n');
    console.log('📋 Next steps:');
    console.log('   1. Verify entities have English content in translations column');
    console.log('   2. Use populate-entity-translations.js to translate to other languages');
    console.log('   3. Example: node scripts/populate-entity-translations.js --entity=products --language=es\n');

    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await sequelize.close();
    process.exit(1);
  }
}

// Run
main();
