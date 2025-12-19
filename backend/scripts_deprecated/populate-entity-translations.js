#!/usr/bin/env node

/**
 * Populate Entity Translations Script
 *
 * This script populates translations for Products, Categories, CMS Pages, and CMS Blocks
 * using AI-powered translation from OpenAI.
 *
 * Translation Structure:
 * - Products: { "en": { "name": "...", "description": "...", "short_description": "..." }, "es": {...} }
 * - Categories: { "en": { "name": "...", "description": "..." }, "es": {...} }
 * - CMS Pages: { "en": { "title": "...", "content": "..." }, "es": {...} }
 * - CMS Blocks: { "en": { "title": "...", "content": "..." }, "es": {...} }
 *
 * Usage:
 *   node scripts/populate-entity-translations.js --entity=products --language=es
 *   node scripts/populate-entity-translations.js --entity=categories --language=fr
 *   node scripts/populate-entity-translations.js --entity=cms_pages --language=ar
 *   node scripts/populate-entity-translations.js --entity=cms_blocks --language=de
 *   node scripts/populate-entity-translations.js --entity=all --language=es (translate all entities)
 */

require('dotenv').config();
const { sequelize } = require('../src/database/connection');
const OpenAI = require('openai');

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Parse command line arguments
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, value] = arg.split('=');
  acc[key.replace('--', '')] = value;
  return acc;
}, {});

const entityType = args.entity || 'products';
const targetLanguage = args.language || 'es';
const sourceLanguage = args.source || 'en';
const batchSize = parseInt(args.batch) || 5;

/**
 * Translate text using OpenAI
 */
async function translateText(text, targetLang, sourceLang = 'en', context = '') {
  if (!text || text.trim() === '') {
    return text;
  }

  try {
    const prompt = `Translate the following ${context} from ${sourceLang} to ${targetLang}.
Maintain the same tone, style, and formatting (including HTML tags if present).
Do not add explanations, just return the translated text.

Text to translate:
${text}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a professional translator specializing in e-commerce content. Translate accurately while preserving formatting, HTML tags, and brand terminology.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 2000
    });

    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error(`Translation error: ${error.message}`);
    return text; // Return original text on error
  }
}

/**
 * Translate Products
 */
async function translateProducts(targetLang, sourceLang) {
  console.log(`\n📦 Translating Products from ${sourceLang} to ${targetLang}...\n`);

  const [products] = await sequelize.query(`
    SELECT id, slug, translations
    FROM products
    WHERE translations IS NOT NULL
    AND translations::text != '{}'
    AND translations->>'${sourceLang}' IS NOT NULL
  `);

  if (products.length === 0) {
    console.log('⚠️  No products found with source language content');
    return;
  }

  console.log(`Found ${products.length} products to translate`);

  let translated = 0;
  for (let i = 0; i < products.length; i += batchSize) {
    const batch = products.slice(i, i + batchSize);

    for (const product of batch) {
      const translations = product.translations || {};
      const sourceContent = translations[sourceLang];

      if (!sourceContent) continue;

      // Skip if translation already exists
      if (translations[targetLang] && translations[targetLang].name) {
        console.log(`  ⏭️  Skipping ${product.slug} - translation exists`);
        continue;
      }

      console.log(`  🔄 Translating: ${sourceContent.name || product.slug}`);

      try {
        const translatedContent = {};

        // Translate name
        if (sourceContent.name) {
          translatedContent.name = await translateText(
            sourceContent.name,
            targetLang,
            sourceLang,
            'product name'
          );
        }

        // Translate description
        if (sourceContent.description) {
          translatedContent.description = await translateText(
            sourceContent.description,
            targetLang,
            sourceLang,
            'product description'
          );
        }

        // Translate short_description
        if (sourceContent.short_description) {
          translatedContent.short_description = await translateText(
            sourceContent.short_description,
            targetLang,
            sourceLang,
            'product short description'
          );
        }

        // Update translations
        translations[targetLang] = translatedContent;

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

        translated++;
        console.log(`  ✅ Translated: ${translatedContent.name}`);

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        console.error(`  ❌ Error translating ${product.slug}:`, error.message);
      }
    }
  }

  console.log(`\n✅ Translated ${translated} products\n`);
}

/**
 * Translate Categories
 */
async function translateCategories(targetLang, sourceLang) {
  console.log(`\n📁 Translating Categories from ${sourceLang} to ${targetLang}...\n`);

  const [categories] = await sequelize.query(`
    SELECT id, slug, translations
    FROM categories
    WHERE translations IS NOT NULL
    AND translations::text != '{}'
    AND translations->>'${sourceLang}' IS NOT NULL
  `);

  if (categories.length === 0) {
    console.log('⚠️  No categories found with source language content');
    return;
  }

  console.log(`Found ${categories.length} categories to translate`);

  let translated = 0;
  for (const category of categories) {
    const translations = category.translations || {};
    const sourceContent = translations[sourceLang];

    if (!sourceContent) continue;

    // Skip if translation already exists
    if (translations[targetLang] && translations[targetLang].name) {
      console.log(`  ⏭️  Skipping ${category.slug} - translation exists`);
      continue;
    }

    console.log(`  🔄 Translating: ${sourceContent.name || category.slug}`);

    try {
      const translatedContent = {};

      // Translate name
      if (sourceContent.name) {
        translatedContent.name = await translateText(
          sourceContent.name,
          targetLang,
          sourceLang,
          'category name'
        );
      }

      // Translate description
      if (sourceContent.description) {
        translatedContent.description = await translateText(
          sourceContent.description,
          targetLang,
          sourceLang,
          'category description'
        );
      }

      // Update translations
      translations[targetLang] = translatedContent;

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

      translated++;
      console.log(`  ✅ Translated: ${translatedContent.name}`);

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      console.error(`  ❌ Error translating ${category.slug}:`, error.message);
    }
  }

  console.log(`\n✅ Translated ${translated} categories\n`);
}

/**
 * Translate CMS Pages
 */
async function translateCmsPages(targetLang, sourceLang) {
  console.log(`\n📄 Translating CMS Pages from ${sourceLang} to ${targetLang}...\n`);

  const [pages] = await sequelize.query(`
    SELECT id, slug, translations
    FROM cms_pages
    WHERE translations IS NOT NULL
    AND translations::text != '{}'
    AND translations->>'${sourceLang}' IS NOT NULL
  `);

  if (pages.length === 0) {
    console.log('⚠️  No CMS pages found with source language content');
    return;
  }

  console.log(`Found ${pages.length} CMS pages to translate`);

  let translated = 0;
  for (const page of pages) {
    const translations = page.translations || {};
    const sourceContent = translations[sourceLang];

    if (!sourceContent) continue;

    // Skip if translation already exists
    if (translations[targetLang] && translations[targetLang].title) {
      console.log(`  ⏭️  Skipping ${page.slug} - translation exists`);
      continue;
    }

    console.log(`  🔄 Translating: ${sourceContent.title || page.slug}`);

    try {
      const translatedContent = {};

      // Translate title
      if (sourceContent.title) {
        translatedContent.title = await translateText(
          sourceContent.title,
          targetLang,
          sourceLang,
          'page title'
        );
      }

      // Translate content
      if (sourceContent.content) {
        translatedContent.content = await translateText(
          sourceContent.content,
          targetLang,
          sourceLang,
          'page content (HTML)'
        );
      }

      // Update translations
      translations[targetLang] = translatedContent;

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

      translated++;
      console.log(`  ✅ Translated: ${translatedContent.title}`);

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      console.error(`  ❌ Error translating ${page.slug}:`, error.message);
    }
  }

  console.log(`\n✅ Translated ${translated} CMS pages\n`);
}

/**
 * Translate CMS Blocks
 */
async function translateCmsBlocks(targetLang, sourceLang) {
  console.log(`\n📝 Translating CMS Blocks from ${sourceLang} to ${targetLang}...\n`);

  const [blocks] = await sequelize.query(`
    SELECT id, identifier, translations
    FROM cms_blocks
    WHERE translations IS NOT NULL
    AND translations::text != '{}'
    AND translations->>'${sourceLang}' IS NOT NULL
  `);

  if (blocks.length === 0) {
    console.log('⚠️  No CMS blocks found with source language content');
    return;
  }

  console.log(`Found ${blocks.length} CMS blocks to translate`);

  let translated = 0;
  for (const block of blocks) {
    const translations = block.translations || {};
    const sourceContent = translations[sourceLang];

    if (!sourceContent) continue;

    // Skip if translation already exists
    if (translations[targetLang] && translations[targetLang].title) {
      console.log(`  ⏭️  Skipping ${block.identifier} - translation exists`);
      continue;
    }

    console.log(`  🔄 Translating: ${sourceContent.title || block.identifier}`);

    try {
      const translatedContent = {};

      // Translate title
      if (sourceContent.title) {
        translatedContent.title = await translateText(
          sourceContent.title,
          targetLang,
          sourceLang,
          'block title'
        );
      }

      // Translate content
      if (sourceContent.content) {
        translatedContent.content = await translateText(
          sourceContent.content,
          targetLang,
          sourceLang,
          'block content (HTML)'
        );
      }

      // Update translations
      translations[targetLang] = translatedContent;

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

      translated++;
      console.log(`  ✅ Translated: ${translatedContent.title}`);

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      console.error(`  ❌ Error translating ${block.identifier}:`, error.message);
    }
  }

  console.log(`\n✅ Translated ${translated} CMS blocks\n`);
}

/**
 * Main execution
 */
async function main() {
  console.log('🌐 Entity Translation Population Tool\n');
  console.log(`Entity: ${entityType}`);
  console.log(`Source Language: ${sourceLanguage}`);
  console.log(`Target Language: ${targetLanguage}`);
  console.log(`Batch Size: ${batchSize}\n`);

  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ Error: OPENAI_API_KEY not found in environment variables');
    process.exit(1);
  }

  try {
    await sequelize.authenticate();
    console.log('✅ Database connected\n');

    const startTime = Date.now();

    if (entityType === 'products' || entityType === 'all') {
      await translateProducts(targetLanguage, sourceLanguage);
    }

    if (entityType === 'categories' || entityType === 'all') {
      await translateCategories(targetLanguage, sourceLanguage);
    }

    if (entityType === 'cms_pages' || entityType === 'all') {
      await translateCmsPages(targetLanguage, sourceLanguage);
    }

    if (entityType === 'cms_blocks' || entityType === 'all') {
      await translateCmsBlocks(targetLanguage, sourceLanguage);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n🎉 Translation complete! (${duration}s)\n`);

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
