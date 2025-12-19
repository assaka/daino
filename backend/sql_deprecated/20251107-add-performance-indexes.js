'use strict';

/**
 * Migration: Add Performance Indexes
 *
 * Adds critical missing indexes to improve query performance:
 * - Orders table: payment_reference, stripe_session_id, store_id+created_at, customer_email
 * - Customer activities: store_id+created_at, session_id+created_at
 * - Wishlist: user_id, session_id
 * - Order items: order_id, product_id
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('Adding performance indexes...');

    try {
      // Orders (sales_orders) table indexes
      console.log('Creating indexes for sales_orders table...');

      await queryInterface.addIndex('sales_orders', ['payment_reference'], {
        name: 'idx_sales_orders_payment_reference',
        where: {
          payment_reference: {
            [Sequelize.Op.ne]: null
          }
        }
      });

      await queryInterface.addIndex('sales_orders', ['stripe_session_id'], {
        name: 'idx_sales_orders_stripe_session_id',
        where: {
          stripe_session_id: {
            [Sequelize.Op.ne]: null
          }
        }
      });

      await queryInterface.addIndex('sales_orders', ['store_id', 'created_at'], {
        name: 'idx_sales_orders_store_created',
        order: [
          ['store_id', 'ASC'],
          ['created_at', 'DESC']
        ]
      });

      await queryInterface.addIndex('sales_orders', ['customer_email'], {
        name: 'idx_sales_orders_customer_email',
        where: {
          customer_email: {
            [Sequelize.Op.ne]: null
          }
        }
      });

      await queryInterface.addIndex('sales_orders', ['store_id', 'status'], {
        name: 'idx_sales_orders_store_status'
      });

      // Customer activities table indexes
      console.log('Creating indexes for customer_activities table...');

      await queryInterface.addIndex('customer_activities', ['store_id', 'created_at'], {
        name: 'idx_customer_activities_store_created',
        order: [
          ['store_id', 'ASC'],
          ['created_at', 'DESC']
        ]
      });

      await queryInterface.addIndex('customer_activities', ['session_id', 'created_at'], {
        name: 'idx_customer_activities_session_created',
        order: [
          ['session_id', 'ASC'],
          ['created_at', 'DESC']
        ]
      });

      await queryInterface.addIndex('customer_activities', ['store_id', 'activity_type'], {
        name: 'idx_customer_activities_store_type'
      });

      // Wishlist table indexes
      console.log('Creating indexes for wishlist table...');

      await queryInterface.addIndex('wishlist', ['user_id'], {
        name: 'idx_wishlist_user_id',
        where: {
          user_id: {
            [Sequelize.Op.ne]: null
          }
        }
      });

      await queryInterface.addIndex('wishlist', ['session_id'], {
        name: 'idx_wishlist_session_id',
        where: {
          session_id: {
            [Sequelize.Op.ne]: null
          }
        }
      });

      await queryInterface.addIndex('wishlist', ['product_id'], {
        name: 'idx_wishlist_product_id'
      });

      // Sales order items table indexes
      console.log('Creating indexes for sales_order_items table...');

      await queryInterface.addIndex('sales_order_items', ['order_id'], {
        name: 'idx_sales_order_items_order_id'
      });

      await queryInterface.addIndex('sales_order_items', ['product_id'], {
        name: 'idx_sales_order_items_product_id'
      });

      await queryInterface.addIndex('sales_order_items', ['order_id', 'product_id'], {
        name: 'idx_sales_order_items_order_product'
      });

      // Additional indexes for frequently queried columns
      console.log('Creating additional performance indexes...');

      // Store table
      await queryInterface.addIndex('stores', ['domain'], {
        name: 'idx_stores_domain',
        unique: true,
        where: {
          domain: {
            [Sequelize.Op.ne]: null
          }
        }
      });

      // Products table - composite index for featured products
      await queryInterface.addIndex('products', ['store_id', 'featured', 'active'], {
        name: 'idx_products_store_featured_active',
        where: {
          featured: true,
          active: true
        }
      });

      // Products table - composite index for stock management
      await queryInterface.addIndex('products', ['store_id', 'track_inventory', 'stock'], {
        name: 'idx_products_store_inventory_stock'
      });

      console.log('Performance indexes created successfully!');

    } catch (error) {
      console.error('Error creating performance indexes:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    console.log('Removing performance indexes...');

    try {
      // Remove all indexes created in up()
      const indexes = [
        // Sales orders
        'idx_sales_orders_payment_reference',
        'idx_sales_orders_stripe_session_id',
        'idx_sales_orders_store_created',
        'idx_sales_orders_customer_email',
        'idx_sales_orders_store_status',

        // Customer activities
        'idx_customer_activities_store_created',
        'idx_customer_activities_session_created',
        'idx_customer_activities_store_type',

        // Wishlist
        'idx_wishlist_user_id',
        'idx_wishlist_session_id',
        'idx_wishlist_product_id',

        // Sales order items
        'idx_sales_order_items_order_id',
        'idx_sales_order_items_product_id',
        'idx_sales_order_items_order_product',

        // Additional
        'idx_stores_domain',
        'idx_products_store_featured_active',
        'idx_products_store_inventory_stock',
      ];

      for (const indexName of indexes) {
        try {
          await queryInterface.removeIndex('sales_orders', indexName).catch(() => {});
          await queryInterface.removeIndex('customer_activities', indexName).catch(() => {});
          await queryInterface.removeIndex('wishlist', indexName).catch(() => {});
          await queryInterface.removeIndex('sales_order_items', indexName).catch(() => {});
          await queryInterface.removeIndex('stores', indexName).catch(() => {});
          await queryInterface.removeIndex('products', indexName).catch(() => {});
        } catch (error) {
          // Index might not exist, continue
        }
      }

      console.log('Performance indexes removed successfully!');

    } catch (error) {
      console.error('Error removing performance indexes:', error);
      throw error;
    }
  }
};
