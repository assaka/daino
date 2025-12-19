/**
 * Data Migration: Copy category translations from JSON column to normalized table
 *
 * This migration copies existing translation data from categories.translations (JSON)
 * to the category_translations table for better search performance.
 */

module.exports = {
  up: async (queryInterface) => {
    const { sequelize } = queryInterface;

    console.log('🔄 Starting category translations data migration...');

    // Get all categories with translations
    const categories = await sequelize.query(`
      SELECT id, translations
      FROM categories
      WHERE translations IS NOT NULL
        AND translations::text != '{}'
        AND translations::text != 'null'
    `, {
      type: sequelize.QueryTypes.SELECT
    });

    console.log(`📊 Found ${categories.length} categories with translations to migrate`);

    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const category of categories) {
      try {
        const translations = category.translations;

        if (!translations || typeof translations !== 'object') {
          skippedCount++;
          continue;
        }

        // Loop through each language in the translations object
        for (const [langCode, translationData] of Object.entries(translations)) {
          if (!translationData || typeof translationData !== 'object') {
            continue;
          }

          const { name, description } = translationData;

          // Skip if no actual data
          if (!name && !description) {
            continue;
          }

          // Insert or update translation
          await sequelize.query(`
            INSERT INTO category_translations (
              category_id, language_code, name, description,
              created_at, updated_at
            ) VALUES (
              :category_id, :lang_code, :name, :description,
              NOW(), NOW()
            )
            ON CONFLICT (category_id, language_code) DO UPDATE
            SET
              name = EXCLUDED.name,
              description = EXCLUDED.description,
              updated_at = NOW()
          `, {
            replacements: {
              category_id: category.id,
              lang_code: langCode,
              name: name || null,
              description: description || null
            }
          });

          migratedCount++;
        }
      } catch (error) {
        console.error(`❌ Error migrating category ${category.id}:`, error.message);
        errorCount++;
      }
    }

    console.log('✅ Category translations data migration complete!');
    console.log(`📈 Stats: ${migratedCount} translations migrated, ${skippedCount} skipped, ${errorCount} errors`);
  },

  down: async (queryInterface) => {
    const { sequelize } = queryInterface;

    console.log('🔄 Reverting category translations data migration...');

    // Delete all migrated translations
    await sequelize.query(`
      DELETE FROM category_translations
    `);

    console.log('✅ Category translations data migration reverted');
  }
};
