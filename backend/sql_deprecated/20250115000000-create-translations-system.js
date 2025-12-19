'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Create translations table for UI labels
    await queryInterface.createTable('translations', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      key: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: 'Translation key (e.g. common.button.add_to_cart)'
      },
      language_code: {
        type: Sequelize.STRING(10),
        allowNull: false,
        comment: 'Language code (en, es, zh, ar, etc.)'
      },
      value: {
        type: Sequelize.TEXT,
        allowNull: false,
        comment: 'Translated text value'
      },
      category: {
        type: Sequelize.STRING(50),
        allowNull: true,
        defaultValue: 'common',
        comment: 'Category: common, storefront, admin, errors'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Add unique index on key + language_code
    await queryInterface.addIndex('translations', ['key', 'language_code'], {
      unique: true,
      name: 'translations_key_language_unique'
    });

    // Add index on category for filtering
    await queryInterface.addIndex('translations', ['category'], {
      name: 'translations_category_index'
    });

    // Add index on language_code for quick lookups
    await queryInterface.addIndex('translations', ['language_code'], {
      name: 'translations_language_code_index'
    });

    // 2. Add translations JSON column to products table
    await queryInterface.addColumn('products', 'translations', {
      type: Sequelize.JSON,
      allowNull: false,
      defaultValue: {},
      comment: 'Multilingual translations: {"en": {"name": "...", "description": "..."}, "es": {...}}'
    });

    // 3. Migrate existing product data to translations JSON
    await queryInterface.sequelize.query(`
      UPDATE products
      SET translations = json_build_object(
        'en', json_build_object(
          'name', name,
          'description', COALESCE(description, ''),
          'short_description', COALESCE(short_description, '')
        )
      )
      WHERE name IS NOT NULL;
    `);

    // 4. Remove old columns from products table
    await queryInterface.removeColumn('products', 'name');
    await queryInterface.removeColumn('products', 'description');
    await queryInterface.removeColumn('products', 'short_description');

    // 5. Add translations JSON column to categories table
    await queryInterface.addColumn('categories', 'translations', {
      type: Sequelize.JSON,
      allowNull: false,
      defaultValue: {},
      comment: 'Multilingual translations: {"en": {"name": "...", "description": "..."}, "es": {...}}'
    });

    // 6. Migrate existing category data to translations JSON
    await queryInterface.sequelize.query(`
      UPDATE categories
      SET translations = json_build_object(
        'en', json_build_object(
          'name', name,
          'description', COALESCE(description, '')
        )
      )
      WHERE name IS NOT NULL;
    `);

    // 7. Remove old columns from categories table
    await queryInterface.removeColumn('categories', 'name');
    await queryInterface.removeColumn('categories', 'description');

    // 8. Add translations JSON column to cms_pages table
    await queryInterface.addColumn('cms_pages', 'translations', {
      type: Sequelize.JSON,
      allowNull: false,
      defaultValue: {},
      comment: 'Multilingual translations: {"en": {"title": "...", "content": "..."}, "es": {...}}'
    });

    // 9. Migrate existing cms_pages data to translations JSON
    await queryInterface.sequelize.query(`
      UPDATE cms_pages
      SET translations = json_build_object(
        'en', json_build_object(
          'title', title,
          'content', COALESCE(content, '')
        )
      )
      WHERE title IS NOT NULL;
    `);

    // 10. Remove old columns from cms_pages table
    await queryInterface.removeColumn('cms_pages', 'title');
    await queryInterface.removeColumn('cms_pages', 'content');

    // 11. Add translations JSON column to cms_blocks table
    await queryInterface.addColumn('cms_blocks', 'translations', {
      type: Sequelize.JSON,
      allowNull: false,
      defaultValue: {},
      comment: 'Multilingual translations: {"en": {"title": "...", "content": "..."}, "es": {...}}'
    });

    // 12. Migrate existing cms_blocks data to translations JSON
    await queryInterface.sequelize.query(`
      UPDATE cms_blocks
      SET translations = json_build_object(
        'en', json_build_object(
          'title', title,
          'content', COALESCE(content, '')
        )
      )
      WHERE title IS NOT NULL;
    `);

    // 13. Remove old columns from cms_blocks table
    await queryInterface.removeColumn('cms_blocks', 'title');
    await queryInterface.removeColumn('cms_blocks', 'content');

    console.log('✓ Translations system created successfully');
  },

  down: async (queryInterface, Sequelize) => {
    // Remove translations columns
    await queryInterface.removeColumn('products', 'translations');
    await queryInterface.removeColumn('categories', 'translations');
    await queryInterface.removeColumn('cms_pages', 'translations');
    await queryInterface.removeColumn('cms_blocks', 'translations');

    // Drop translations table
    await queryInterface.dropTable('translations');

    console.log('✓ Translations system removed');
  }
};
