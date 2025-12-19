/**
 * Data Migration: Copy product translations from JSON column to normalized table
 *
 * This migration copies existing translation data from products.translations (JSON)
 * to the product_translations table for better search performance.
 */

module.exports = {
  up: async (queryInterface) => {
    const { sequelize } = queryInterface;

    console.log('🔄 Starting product translations data migration...');

    // Get all products with translations
    const products = await sequelize.query(`
      SELECT id, translations
      FROM products
      WHERE translations IS NOT NULL
        AND translations::text != '{}'
        AND translations::text != 'null'
    `, {
      type: sequelize.QueryTypes.SELECT
    });

    console.log(`📊 Found ${products.length} products with translations to migrate`);

    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const product of products) {
      try {
        const translations = product.translations;

        if (!translations || typeof translations !== 'object') {
          skippedCount++;
          continue;
        }

        // Loop through each language in the translations object
        for (const [langCode, translationData] of Object.entries(translations)) {
          if (!translationData || typeof translationData !== 'object') {
            continue;
          }

          const { name, description, short_description } = translationData;

          // Skip if no actual data
          if (!name && !description && !short_description) {
            continue;
          }

          // Insert or update translation
          await sequelize.query(`
            INSERT INTO product_translations (
              product_id, language_code, name, description, short_description,
              created_at, updated_at
            ) VALUES (
              :product_id, :lang_code, :name, :description, :short_description,
              NOW(), NOW()
            )
            ON CONFLICT (product_id, language_code) DO UPDATE
            SET
              name = EXCLUDED.name,
              description = EXCLUDED.description,
              short_description = EXCLUDED.short_description,
              updated_at = NOW()
          `, {
            replacements: {
              product_id: product.id,
              lang_code: langCode,
              name: name || null,
              description: description || null,
              short_description: short_description || null
            }
          });

          migratedCount++;
        }
      } catch (error) {
        console.error(`❌ Error migrating product ${product.id}:`, error.message);
        errorCount++;
      }
    }

    console.log('✅ Product translations data migration complete!');
    console.log(`📈 Stats: ${migratedCount} translations migrated, ${skippedCount} skipped, ${errorCount} errors`);
  },

  down: async (queryInterface) => {
    const { sequelize } = queryInterface;

    console.log('🔄 Reverting product translations data migration...');

    // Delete all migrated translations
    await sequelize.query(`
      DELETE FROM product_translations
    `);

    console.log('✅ Product translations data migration reverted');
  }
};
