/**
 * Migration: Add SEO and Open Graph fields to entities
 *
 * This migration adds comprehensive SEO fields to Product, Category, and CmsPage tables
 * to support a proper SEO hierarchy:
 *
 * 1. Entity-specific overrides (product.meta_title, category.og_title, etc.)
 * 2. Page type templates
 * 3. Global defaults
 * 4. Automatic fallbacks
 *
 * Fields added:
 * - Products: meta_title, meta_description, meta_keywords, meta_robots_tag,
 *            og_title, og_description, og_image_url, canonical_url
 * - Categories: og_title, og_description, og_image_url, canonical_url
 * - CmsPages: og_title, og_description, og_image_url, canonical_url
 * - SeoTemplates: Updated type enum to support cms_page, homepage, blog_post
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add SEO fields to products table
    await queryInterface.addColumn('products', 'meta_title', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('products', 'meta_description', {
      type: Sequelize.TEXT,
      allowNull: true
    });

    await queryInterface.addColumn('products', 'meta_keywords', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('products', 'meta_robots_tag', {
      type: Sequelize.STRING,
      defaultValue: 'index, follow',
      allowNull: true
    });

    // Add Open Graph fields to products
    await queryInterface.addColumn('products', 'og_title', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('products', 'og_description', {
      type: Sequelize.TEXT,
      allowNull: true
    });

    await queryInterface.addColumn('products', 'og_image_url', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('products', 'canonical_url', {
      type: Sequelize.STRING,
      allowNull: true
    });

    // Add Open Graph fields to categories
    await queryInterface.addColumn('categories', 'og_title', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('categories', 'og_description', {
      type: Sequelize.TEXT,
      allowNull: true
    });

    await queryInterface.addColumn('categories', 'og_image_url', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('categories', 'canonical_url', {
      type: Sequelize.STRING,
      allowNull: true
    });

    // Add Open Graph fields to cms_pages
    await queryInterface.addColumn('cms_pages', 'og_title', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('cms_pages', 'og_description', {
      type: Sequelize.TEXT,
      allowNull: true
    });

    await queryInterface.addColumn('cms_pages', 'og_image_url', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('cms_pages', 'canonical_url', {
      type: Sequelize.STRING,
      allowNull: true
    });

    // Update SeoTemplate type enum to support new page types
    // First convert to VARCHAR to allow modification
    await queryInterface.sequelize.query(`
      ALTER TABLE seo_templates
      ALTER COLUMN type TYPE VARCHAR(20);
    `);

    // Add check constraint for valid types
    await queryInterface.sequelize.query(`
      ALTER TABLE seo_templates
      ADD CONSTRAINT seo_templates_type_check
      CHECK (type IN (
        'product', 'category', 'cms_page', 'homepage', 'brand', 'blog_post'
      ));
    `);

    console.log('✅ SEO and Open Graph fields added successfully to all entities');
  },

  down: async (queryInterface, Sequelize) => {
    // Remove fields from products
    await queryInterface.removeColumn('products', 'meta_title');
    await queryInterface.removeColumn('products', 'meta_description');
    await queryInterface.removeColumn('products', 'meta_keywords');
    await queryInterface.removeColumn('products', 'meta_robots_tag');
    await queryInterface.removeColumn('products', 'og_title');
    await queryInterface.removeColumn('products', 'og_description');
    await queryInterface.removeColumn('products', 'og_image_url');
    await queryInterface.removeColumn('products', 'canonical_url');

    // Remove fields from categories
    await queryInterface.removeColumn('categories', 'og_title');
    await queryInterface.removeColumn('categories', 'og_description');
    await queryInterface.removeColumn('categories', 'og_image_url');
    await queryInterface.removeColumn('categories', 'canonical_url');

    // Remove fields from cms_pages
    await queryInterface.removeColumn('cms_pages', 'og_title');
    await queryInterface.removeColumn('cms_pages', 'og_description');
    await queryInterface.removeColumn('cms_pages', 'og_image_url');
    await queryInterface.removeColumn('cms_pages', 'canonical_url');

    // Revert SeoTemplate type constraint
    await queryInterface.sequelize.query(`
      ALTER TABLE seo_templates
      DROP CONSTRAINT IF EXISTS seo_templates_type_check;
    `);

    // Revert any new types to a valid old type
    await queryInterface.sequelize.query(`
      UPDATE seo_templates
      SET type = 'cms'
      WHERE type IN ('cms_page', 'homepage', 'blog_post');
    `);
  }
};
