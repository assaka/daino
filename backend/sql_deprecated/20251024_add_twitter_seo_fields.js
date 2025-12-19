/**
 * Migration: Add Twitter-specific SEO fields to all entities
 *
 * This migration adds Twitter Card override fields to Product, Category, CmsPage, and SeoTemplate
 * to complete the SEO priority cascade system with platform-specific overrides:
 *
 * Priority Cascade:
 * 1. Entity Twitter overrides (product.twitter_title)
 * 2. Template Twitter overrides (template.twitter_title)
 * 3. Global Twitter defaults (settings.twitter.default_title)
 * 4. Open Graph fallbacks
 * 5. Meta tag fallbacks
 *
 * Fields added:
 * - Products, Categories, CMS Pages: twitter_title, twitter_description, twitter_image_url
 * - SeoTemplates: twitter_title, twitter_description
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🐦 Adding Twitter-specific SEO fields...');

    // Add Twitter fields to products
    await queryInterface.addColumn('products', 'twitter_title', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('products', 'twitter_description', {
      type: Sequelize.TEXT,
      allowNull: true
    });

    await queryInterface.addColumn('products', 'twitter_image_url', {
      type: Sequelize.STRING,
      allowNull: true
    });
    console.log('✅ Twitter fields added to products');

    // Add Twitter fields to categories
    await queryInterface.addColumn('categories', 'twitter_title', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('categories', 'twitter_description', {
      type: Sequelize.TEXT,
      allowNull: true
    });

    await queryInterface.addColumn('categories', 'twitter_image_url', {
      type: Sequelize.STRING,
      allowNull: true
    });
    console.log('✅ Twitter fields added to categories');

    // Add Twitter fields to cms_pages
    await queryInterface.addColumn('cms_pages', 'twitter_title', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('cms_pages', 'twitter_description', {
      type: Sequelize.TEXT,
      allowNull: true
    });

    await queryInterface.addColumn('cms_pages', 'twitter_image_url', {
      type: Sequelize.STRING,
      allowNull: true
    });
    console.log('✅ Twitter fields added to cms_pages');

    // Add Twitter fields to seo_templates
    await queryInterface.addColumn('seo_templates', 'twitter_title', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('seo_templates', 'twitter_description', {
      type: Sequelize.TEXT,
      allowNull: true
    });
    console.log('✅ Twitter fields added to seo_templates');

    console.log('✅ Twitter SEO fields migration completed successfully!');
  },

  down: async (queryInterface, Sequelize) => {
    // Remove Twitter fields from products
    await queryInterface.removeColumn('products', 'twitter_title');
    await queryInterface.removeColumn('products', 'twitter_description');
    await queryInterface.removeColumn('products', 'twitter_image_url');

    // Remove Twitter fields from categories
    await queryInterface.removeColumn('categories', 'twitter_title');
    await queryInterface.removeColumn('categories', 'twitter_description');
    await queryInterface.removeColumn('categories', 'twitter_image_url');

    // Remove Twitter fields from cms_pages
    await queryInterface.removeColumn('cms_pages', 'twitter_title');
    await queryInterface.removeColumn('cms_pages', 'twitter_description');
    await queryInterface.removeColumn('cms_pages', 'twitter_image_url');

    // Remove Twitter fields from seo_templates
    await queryInterface.removeColumn('seo_templates', 'twitter_title');
    await queryInterface.removeColumn('seo_templates', 'twitter_description');
  }
};
