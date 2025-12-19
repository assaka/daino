/**
 * Migration: Add common plural translations for stock labels
 *
 * Adds translatable plural forms (item/items, unit/units, piece/pieces)
 * to the translations table under the 'common' category.
 *
 * These translations are used by stock label placeholders to support
 * proper pluralization in multiple languages.
 */

'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('Adding common plural translations...');

    // Define translations for supported languages
    const commonTranslations = [
      // English
      { key: 'common.item', language_code: 'en', value: 'item', category: 'common', type: 'system' },
      { key: 'common.items', language_code: 'en', value: 'items', category: 'common', type: 'system' },
      { key: 'common.unit', language_code: 'en', value: 'unit', category: 'common', type: 'system' },
      { key: 'common.units', language_code: 'en', value: 'units', category: 'common', type: 'system' },
      { key: 'common.piece', language_code: 'en', value: 'piece', category: 'common', type: 'system' },
      { key: 'common.pieces', language_code: 'en', value: 'pieces', category: 'common', type: 'system' },

      // Dutch
      { key: 'common.item', language_code: 'nl', value: 'artikel', category: 'common', type: 'system' },
      { key: 'common.items', language_code: 'nl', value: 'artikelen', category: 'common', type: 'system' },
      { key: 'common.unit', language_code: 'nl', value: 'eenheid', category: 'common', type: 'system' },
      { key: 'common.units', language_code: 'nl', value: 'eenheden', category: 'common', type: 'system' },
      { key: 'common.piece', language_code: 'nl', value: 'stuk', category: 'common', type: 'system' },
      { key: 'common.pieces', language_code: 'nl', value: 'stuks', category: 'common', type: 'system' },

      // German
      { key: 'common.item', language_code: 'de', value: 'Artikel', category: 'common', type: 'system' },
      { key: 'common.items', language_code: 'de', value: 'Artikel', category: 'common', type: 'system' },
      { key: 'common.unit', language_code: 'de', value: 'Einheit', category: 'common', type: 'system' },
      { key: 'common.units', language_code: 'de', value: 'Einheiten', category: 'common', type: 'system' },
      { key: 'common.piece', language_code: 'de', value: 'Stück', category: 'common', type: 'system' },
      { key: 'common.pieces', language_code: 'de', value: 'Stücke', category: 'common', type: 'system' },

      // French
      { key: 'common.item', language_code: 'fr', value: 'article', category: 'common', type: 'system' },
      { key: 'common.items', language_code: 'fr', value: 'articles', category: 'common', type: 'system' },
      { key: 'common.unit', language_code: 'fr', value: 'unité', category: 'common', type: 'system' },
      { key: 'common.units', language_code: 'fr', value: 'unités', category: 'common', type: 'system' },
      { key: 'common.piece', language_code: 'fr', value: 'pièce', category: 'common', type: 'system' },
      { key: 'common.pieces', language_code: 'fr', value: 'pièces', category: 'common', type: 'system' },

      // Spanish
      { key: 'common.item', language_code: 'es', value: 'artículo', category: 'common', type: 'system' },
      { key: 'common.items', language_code: 'es', value: 'artículos', category: 'common', type: 'system' },
      { key: 'common.unit', language_code: 'es', value: 'unidad', category: 'common', type: 'system' },
      { key: 'common.units', language_code: 'es', value: 'unidades', category: 'common', type: 'system' },
      { key: 'common.piece', language_code: 'es', value: 'pieza', category: 'common', type: 'system' },
      { key: 'common.pieces', language_code: 'es', value: 'piezas', category: 'common', type: 'system' },

      // Italian
      { key: 'common.item', language_code: 'it', value: 'articolo', category: 'common', type: 'system' },
      { key: 'common.items', language_code: 'it', value: 'articoli', category: 'common', type: 'system' },
      { key: 'common.unit', language_code: 'it', value: 'unità', category: 'common', type: 'system' },
      { key: 'common.units', language_code: 'it', value: 'unità', category: 'common', type: 'system' },
      { key: 'common.piece', language_code: 'it', value: 'pezzo', category: 'common', type: 'system' },
      { key: 'common.pieces', language_code: 'it', value: 'pezzi', category: 'common', type: 'system' },
    ];

    // Insert translations with upsert logic (insert or update on conflict)
    for (const translation of commonTranslations) {
      await queryInterface.sequelize.query(`
        INSERT INTO translations (id, key, language_code, value, category, type, created_at, updated_at)
        VALUES (gen_random_uuid(), :key, :language_code, :value, :category, :type, NOW(), NOW())
        ON CONFLICT (key, language_code)
        DO UPDATE SET
          value = EXCLUDED.value,
          category = EXCLUDED.category,
          type = EXCLUDED.type,
          updated_at = NOW()
      `, {
        replacements: translation,
        type: Sequelize.QueryTypes.INSERT
      });
    }

    console.log(`✅ Added ${commonTranslations.length} common plural translations`);
  },

  async down(queryInterface, Sequelize) {
    console.log('Removing common plural translations...');

    // Remove all common.* translations
    await queryInterface.sequelize.query(`
      DELETE FROM translations
      WHERE key IN (
        'common.item',
        'common.items',
        'common.unit',
        'common.units',
        'common.piece',
        'common.pieces'
      )
    `);

    console.log('✅ Removed common plural translations');
  }
};
