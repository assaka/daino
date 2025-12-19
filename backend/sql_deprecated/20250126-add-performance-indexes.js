/**
 * Performance Optimization Indexes
 *
 * Adds critical indexes for improved query performance on:
 * - Product slug, SKU, category_ids
 * - Category slug
 * - Translation tables for faster lookups
 * - Product attributes for filtering
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const { sequelize } = queryInterface;

    console.log('Adding performance indexes...');

    try {
      // Product indexes
      await sequelize.query(`
        -- Index on product slug for fast lookups
        CREATE INDEX IF NOT EXISTS idx_products_slug
        ON products(slug);
      `);

      await sequelize.query(`
        -- Index on product SKU for fast lookups
        CREATE INDEX IF NOT EXISTS idx_products_sku
        ON products(sku);
      `);

      await sequelize.query(`
        -- GIN index on category_ids JSONB for containment queries
        CREATE INDEX IF NOT EXISTS idx_products_category_ids
        ON products USING GIN (category_ids);
      `);

      await sequelize.query(`
        -- Composite index for active visible products by store
        CREATE INDEX IF NOT EXISTS idx_products_active_visible
        ON products(store_id, status, visibility)
        WHERE status = 'active' AND visibility = 'visible';
      `);

      await sequelize.query(`
        -- Index for stock filtering
        CREATE INDEX IF NOT EXISTS idx_products_stock
        ON products(manage_stock, stock_quantity, infinite_stock)
        WHERE manage_stock = true;
      `);

      // Category indexes
      await sequelize.query(`
        -- Index on category slug for fast lookups
        CREATE INDEX IF NOT EXISTS idx_categories_slug
        ON categories(slug);
      `);

      await sequelize.query(`
        -- Composite index for active visible categories by store
        CREATE INDEX IF NOT EXISTS idx_categories_active_menu
        ON categories(store_id, is_active, hide_in_menu, sort_order)
        WHERE is_active = true AND hide_in_menu = false;
      `);

      // Translation table indexes (if not already present)
      await sequelize.query(`
        -- Index on product translations for search
        CREATE INDEX IF NOT EXISTS idx_product_translations_search
        ON product_translations USING GIN (to_tsvector('english', name || ' ' || COALESCE(description, '')));
      `);

      await sequelize.query(`
        -- Index on product translations name for ILIKE queries
        CREATE INDEX IF NOT EXISTS idx_product_translations_name
        ON product_translations(name);
      `);

      await sequelize.query(`
        -- Index on category translations for search
        CREATE INDEX IF NOT EXISTS idx_category_translations_name
        ON category_translations(name);
      `);

      // Attribute value indexes
      await sequelize.query(`
        -- Index for product attribute lookups
        CREATE INDEX IF NOT EXISTS idx_product_attribute_values_product
        ON product_attribute_values(product_id, attribute_id);
      `);

      await sequelize.query(`
        -- Index for attribute filtering
        CREATE INDEX IF NOT EXISTS idx_product_attribute_values_value
        ON product_attribute_values(attribute_id, value_id);
      `);

      console.log('✅ Performance indexes created successfully');

    } catch (error) {
      console.error('Error creating indexes:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const { sequelize } = queryInterface;

    console.log('Removing performance indexes...');

    try {
      // Drop all indexes in reverse order
      await sequelize.query('DROP INDEX IF EXISTS idx_product_attribute_values_value;');
      await sequelize.query('DROP INDEX IF EXISTS idx_product_attribute_values_product;');
      await sequelize.query('DROP INDEX IF EXISTS idx_category_translations_name;');
      await sequelize.query('DROP INDEX IF EXISTS idx_product_translations_name;');
      await sequelize.query('DROP INDEX IF EXISTS idx_product_translations_search;');
      await sequelize.query('DROP INDEX IF EXISTS idx_categories_active_menu;');
      await sequelize.query('DROP INDEX IF EXISTS idx_categories_slug;');
      await sequelize.query('DROP INDEX IF EXISTS idx_products_stock;');
      await sequelize.query('DROP INDEX IF EXISTS idx_products_active_visible;');
      await sequelize.query('DROP INDEX IF EXISTS idx_products_category_ids;');
      await sequelize.query('DROP INDEX IF EXISTS idx_products_sku;');
      await sequelize.query('DROP INDEX IF EXISTS idx_products_slug;');

      console.log('✅ Performance indexes removed successfully');

    } catch (error) {
      console.error('Error removing indexes:', error);
      throw error;
    }
  }
};
