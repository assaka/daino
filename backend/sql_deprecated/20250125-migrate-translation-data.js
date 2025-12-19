/**
 * Data Migration: Copy translations from JSON columns to normalized tables
 *
 * Migrates existing translation data for payment methods, CMS pages, and CMS blocks
 * from JSON columns to normalized translation tables.
 */

module.exports = {
  up: async (queryInterface) => {
    const { sequelize } = queryInterface;

    console.log('🔄 Starting translation data migration...');

    // 1. Migrate Payment Method translations
    console.log('📦 Migrating payment method translations...');
    const paymentMethods = await sequelize.query(`
      SELECT id, translations, name, description
      FROM payment_methods
      WHERE (translations IS NOT NULL AND translations::text != '{}' AND translations::text != 'null')
         OR name IS NOT NULL
         OR description IS NOT NULL
    `, {
      type: sequelize.QueryTypes.SELECT
    });

    console.log(`📊 Found ${paymentMethods.length} payment methods to migrate`);

    let paymentCount = 0;
    for (const method of paymentMethods) {
      try {
        const translations = method.translations || {};

        // If no translations but has name/description, create English translation
        if (Object.keys(translations).length === 0 && (method.name || method.description)) {
          translations.en = {
            name: method.name,
            description: method.description
          };
        }

        // Migrate each language
        for (const [langCode, translationData] of Object.entries(translations)) {
          if (!translationData || typeof translationData !== 'object') continue;

          const { name, description } = translationData;

          if (!name && !description) continue;

          await sequelize.query(`
            INSERT INTO payment_method_translations (
              payment_method_id, language_code, name, description,
              created_at, updated_at
            ) VALUES (
              :payment_method_id, :lang_code, :name, :description,
              NOW(), NOW()
            )
            ON CONFLICT (payment_method_id, language_code) DO UPDATE
            SET
              name = EXCLUDED.name,
              description = EXCLUDED.description,
              updated_at = NOW()
          `, {
            replacements: {
              payment_method_id: method.id,
              lang_code: langCode,
              name: name || null,
              description: description || null
            }
          });

          paymentCount++;
        }
      } catch (error) {
        console.error(`❌ Error migrating payment method ${method.id}:`, error.message);
      }
    }

    console.log(`✅ Migrated ${paymentCount} payment method translations`);

    // 2. Migrate CMS Page translations
    console.log('📦 Migrating CMS page translations...');
    const cmsPages = await sequelize.query(`
      SELECT id, translations, title, content
      FROM cms_pages
      WHERE (translations IS NOT NULL AND translations::text != '{}' AND translations::text != 'null')
         OR title IS NOT NULL
         OR content IS NOT NULL
    `, {
      type: sequelize.QueryTypes.SELECT
    });

    console.log(`📊 Found ${cmsPages.length} CMS pages to migrate`);

    let pageCount = 0;
    for (const page of cmsPages) {
      try {
        const translations = page.translations || {};

        // If no translations but has title/content, create English translation
        if (Object.keys(translations).length === 0 && (page.title || page.content)) {
          translations.en = {
            title: page.title,
            content: page.content
          };
        }

        // Migrate each language
        for (const [langCode, translationData] of Object.entries(translations)) {
          if (!translationData || typeof translationData !== 'object') continue;

          const { title, content } = translationData;

          if (!title && !content) continue;

          await sequelize.query(`
            INSERT INTO cms_page_translations (
              cms_page_id, language_code, title, content,
              created_at, updated_at
            ) VALUES (
              :cms_page_id, :lang_code, :title, :content,
              NOW(), NOW()
            )
            ON CONFLICT (cms_page_id, language_code) DO UPDATE
            SET
              title = EXCLUDED.title,
              content = EXCLUDED.content,
              updated_at = NOW()
          `, {
            replacements: {
              cms_page_id: page.id,
              lang_code: langCode,
              title: title || null,
              content: content || null
            }
          });

          pageCount++;
        }
      } catch (error) {
        console.error(`❌ Error migrating CMS page ${page.id}:`, error.message);
      }
    }

    console.log(`✅ Migrated ${pageCount} CMS page translations`);

    // 3. Migrate CMS Block translations
    console.log('📦 Migrating CMS block translations...');
    const cmsBlocks = await sequelize.query(`
      SELECT id, translations, title, content
      FROM cms_blocks
      WHERE (translations IS NOT NULL AND translations::text != '{}' AND translations::text != 'null')
         OR title IS NOT NULL
         OR content IS NOT NULL
    `, {
      type: sequelize.QueryTypes.SELECT
    });

    console.log(`📊 Found ${cmsBlocks.length} CMS blocks to migrate`);

    let blockCount = 0;
    for (const block of cmsBlocks) {
      try {
        const translations = block.translations || {};

        // If no translations but has title/content, create English translation
        if (Object.keys(translations).length === 0 && (block.title || block.content)) {
          translations.en = {
            title: block.title,
            content: block.content
          };
        }

        // Migrate each language
        for (const [langCode, translationData] of Object.entries(translations)) {
          if (!translationData || typeof translationData !== 'object') continue;

          const { title, content } = translationData;

          if (!title && !content) continue;

          await sequelize.query(`
            INSERT INTO cms_block_translations (
              cms_block_id, language_code, title, content,
              created_at, updated_at
            ) VALUES (
              :cms_block_id, :lang_code, :title, :content,
              NOW(), NOW()
            )
            ON CONFLICT (cms_block_id, language_code) DO UPDATE
            SET
              title = EXCLUDED.title,
              content = EXCLUDED.content,
              updated_at = NOW()
          `, {
            replacements: {
              cms_block_id: block.id,
              lang_code: langCode,
              title: title || null,
              content: content || null
            }
          });

          blockCount++;
        }
      } catch (error) {
        console.error(`❌ Error migrating CMS block ${block.id}:`, error.message);
      }
    }

    console.log(`✅ Migrated ${blockCount} CMS block translations`);

    console.log('✅ Translation data migration complete!');
    console.log(`📈 Total: ${paymentCount} payment methods, ${pageCount} pages, ${blockCount} blocks`);
  },

  down: async (queryInterface) => {
    const { sequelize } = queryInterface;

    console.log('🔄 Reverting translation data migration...');

    await sequelize.query('DELETE FROM payment_method_translations');
    await sequelize.query('DELETE FROM cms_page_translations');
    await sequelize.query('DELETE FROM cms_block_translations');

    console.log('✅ Translation data migration reverted');
  }
};
