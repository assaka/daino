/**
 * Create Normalized Translation Tables
 *
 * Creates separate translation tables for payment methods, CMS pages, and CMS blocks
 * for better search performance and cleaner data structure.
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const { sequelize} = queryInterface;

    console.log('🔄 Creating normalized translation tables...');

    // 1. Create payment_method_translations table
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS payment_method_translations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        payment_method_id UUID NOT NULL REFERENCES payment_methods(id) ON DELETE CASCADE,
        language_code VARCHAR(10) NOT NULL,
        name VARCHAR(255),
        description TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(payment_method_id, language_code)
      );
    `);

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_payment_method_translations_payment_method_id
      ON payment_method_translations(payment_method_id);
    `);

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_payment_method_translations_language_code
      ON payment_method_translations(language_code);
    `);

    console.log('✅ Created payment_method_translations table');

    // 2. Create cms_page_translations table
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS cms_page_translations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        cms_page_id UUID NOT NULL REFERENCES cms_pages(id) ON DELETE CASCADE,
        language_code VARCHAR(10) NOT NULL,
        title VARCHAR(255),
        content TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(cms_page_id, language_code)
      );
    `);

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_cms_page_translations_cms_page_id
      ON cms_page_translations(cms_page_id);
    `);

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_cms_page_translations_language_code
      ON cms_page_translations(language_code);
    `);

    console.log('✅ Created cms_page_translations table');

    // 3. Create cms_block_translations table
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS cms_block_translations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        cms_block_id UUID NOT NULL REFERENCES cms_blocks(id) ON DELETE CASCADE,
        language_code VARCHAR(10) NOT NULL,
        title VARCHAR(255),
        content TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(cms_block_id, language_code)
      );
    `);

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_cms_block_translations_cms_block_id
      ON cms_block_translations(cms_block_id);
    `);

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_cms_block_translations_language_code
      ON cms_block_translations(language_code);
    `);

    console.log('✅ Created cms_block_translations table');

    console.log('✅ All normalized translation tables created successfully!');
  },

  down: async (queryInterface) => {
    const { sequelize } = queryInterface;

    console.log('🔄 Dropping normalized translation tables...');

    await sequelize.query('DROP TABLE IF EXISTS payment_method_translations CASCADE;');
    await sequelize.query('DROP TABLE IF EXISTS cms_page_translations CASCADE;');
    await sequelize.query('DROP TABLE IF EXISTS cms_block_translations CASCADE;');

    console.log('✅ Normalized translation tables dropped');
  }
};
