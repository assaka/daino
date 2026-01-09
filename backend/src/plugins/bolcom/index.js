const Plugin = require('../../core/Plugin');
const BolcomIntegration = require('./services/BolcomIntegration');
const BolcomMapping = require('./services/BolcomMapping');
const { v4: uuidv4 } = require('uuid');

/**
 * Bol.com Marketplace Integration Plugin
 * Provides comprehensive integration with Bol.com retailer platform
 *
 * Features:
 * - Sync products as offers to Bol.com marketplace
 * - Import orders from Bol.com
 * - Update inventory/stock levels
 * - Send shipment notifications
 * - Handle returns processing
 */
class BolcomPlugin extends Plugin {
  constructor(config = {}) {
    super(config);
    this.integration = null;
    this.mapping = null;
  }

  static getMetadata() {
    return {
      name: 'Bol.com Marketplace',
      slug: 'bolcom',
      version: '1.0.0',
      description: 'Sell your products on Bol.com - the largest marketplace in the Netherlands and Belgium',
      author: 'DainoStore Team',
      category: 'marketplace',
      dependencies: [],
      permissions: ['products:read', 'orders:write', 'inventory:write'],
      settings: {
        client_id: {
          type: 'string',
          label: 'Client ID',
          description: 'Bol.com API Client ID from seller dashboard',
          required: true,
          secret: true
        },
        client_secret: {
          type: 'string',
          label: 'Client Secret',
          description: 'Bol.com API Client Secret',
          required: true,
          secret: true
        },
        fulfillment_method: {
          type: 'select',
          label: 'Fulfillment Method',
          description: 'How orders will be fulfilled',
          options: [
            { value: 'FBR', label: 'Fulfilled by Retailer (FBR)' },
            { value: 'FBB', label: 'Fulfilled by Bol.com (FBB)' }
          ],
          default: 'FBR'
        },
        auto_sync_enabled: {
          type: 'boolean',
          label: 'Auto Sync',
          description: 'Automatically sync products and orders',
          default: true
        },
        sync_interval_hours: {
          type: 'number',
          label: 'Sync Interval (hours)',
          description: 'How often to sync orders from Bol.com',
          default: 1,
          min: 1,
          max: 24
        }
      }
    };
  }

  /**
   * Initialize the plugin
   */
  async initialize() {
    this.integration = new BolcomIntegration(this.config);
    this.mapping = new BolcomMapping(this.config);

    console.log('🛒 Bol.com Plugin initialized');
  }

  /**
   * Install the plugin
   */
  async install() {
    try {
      console.log('📦 Installing Bol.com Plugin...');

      // Run database migrations
      await this.runMigrations();

      // Initialize services
      await this.initialize();

      console.log('✅ Bol.com Plugin installed successfully');
      this.isInstalled = true;
    } catch (error) {
      console.error('❌ Failed to install Bol.com Plugin:', error.message);
      throw error;
    }
  }

  /**
   * Uninstall the plugin
   */
  async uninstall() {
    try {
      console.log('🗑️ Uninstalling Bol.com Plugin...');

      // Cancel any running syncs
      await this.cancelSync();

      // Clean up schedules
      await this.cleanupSchedules();

      console.log('✅ Bol.com Plugin uninstalled successfully');
      this.isInstalled = false;
    } catch (error) {
      console.error('❌ Failed to uninstall Bol.com Plugin:', error.message);
      throw error;
    }
  }

  /**
   * Enable the plugin
   */
  async enable() {
    try {
      console.log('🚀 Enabling Bol.com Plugin...');

      if (!this.integration) {
        await this.initialize();
      }

      // Test connection before enabling
      const connectionTest = await this.testConnection();
      if (!connectionTest.success) {
        throw new Error(`Connection test failed: ${connectionTest.error}`);
      }

      // Schedule automatic syncs if enabled
      if (this.config.auto_sync_enabled) {
        await this.scheduleAutomaticSyncs();
      }

      console.log('✅ Bol.com Plugin enabled successfully');
      this.isEnabled = true;
    } catch (error) {
      console.error('❌ Failed to enable Bol.com Plugin:', error.message);
      throw error;
    }
  }

  /**
   * Disable the plugin
   */
  async disable() {
    try {
      console.log('⏸️ Disabling Bol.com Plugin...');

      // Cancel running syncs
      await this.cancelSync();

      // Remove scheduled syncs
      await this.cancelScheduledSyncs();

      console.log('✅ Bol.com Plugin disabled successfully');
      this.isEnabled = false;
    } catch (error) {
      console.error('❌ Failed to disable Bol.com Plugin:', error.message);
      throw error;
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      if (!this.isEnabled) {
        return {
          status: 'disabled',
          message: 'Plugin is disabled'
        };
      }

      // Test connection
      const connectionTest = await this.testConnection();
      if (!connectionTest.success) {
        return {
          status: 'unhealthy',
          message: `Connection failed: ${connectionTest.error}`,
          details: connectionTest
        };
      }

      // Check sync status
      const syncStatus = await this.getSyncStatus();

      return {
        status: 'healthy',
        message: 'Plugin is working correctly',
        details: {
          connection: connectionTest,
          sync: syncStatus
        }
      };
    } catch (error) {
      return {
        status: 'error',
        message: error.message,
        error: error.stack
      };
    }
  }

  /**
   * Test connection to Bol.com API
   */
  async testConnection() {
    try {
      if (!this.integration) {
        await this.initialize();
      }

      return await this.integration.testConnection();
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Sync products to Bol.com as offers
   * @param {Object} options - Sync options
   * @param {boolean} options.dryRun - Preview changes without applying
   * @param {number} options.batchSize - Number of products per batch
   * @param {string[]} options.productIds - Specific product IDs to sync
   */
  async syncProducts(options = {}) {
    try {
      if (!this.integration) {
        await this.initialize();
      }

      const result = await this.integration.syncProducts({
        dryRun: this.config.dryRun || options.dryRun || false,
        batchSize: this.config.batchSize || options.batchSize || 50,
        fulfillmentMethod: this.config.fulfillment_method || 'FBR',
        ...options
      });

      return result;
    } catch (error) {
      throw new Error(`Product sync failed: ${error.message}`);
    }
  }

  /**
   * Import orders from Bol.com
   * @param {Object} options - Import options
   * @param {Date} options.fromDate - Start date for order retrieval
   * @param {string} options.status - Filter by order status
   */
  async importOrders(options = {}) {
    try {
      if (!this.integration) {
        await this.initialize();
      }

      const result = await this.integration.importOrders({
        fulfillmentMethod: this.config.fulfillment_method || 'FBR',
        ...options
      });

      return result;
    } catch (error) {
      throw new Error(`Order import failed: ${error.message}`);
    }
  }

  /**
   * Update stock/inventory on Bol.com
   * @param {string} productId - Product ID to update
   * @param {number} quantity - New stock quantity
   */
  async updateStock(productId, quantity) {
    try {
      if (!this.integration) {
        await this.initialize();
      }

      return await this.integration.updateStock(productId, quantity);
    } catch (error) {
      throw new Error(`Stock update failed: ${error.message}`);
    }
  }

  /**
   * Send shipment notification to Bol.com
   * @param {string} orderId - Bol.com order ID
   * @param {Object} shipmentData - Shipment details
   */
  async confirmShipment(orderId, shipmentData) {
    try {
      if (!this.integration) {
        await this.initialize();
      }

      return await this.integration.confirmShipment(orderId, shipmentData);
    } catch (error) {
      throw new Error(`Shipment confirmation failed: ${error.message}`);
    }
  }

  /**
   * Get offer (product listing) from Bol.com
   * @param {string} offerId - Bol.com offer ID
   */
  async getOffer(offerId) {
    try {
      if (!this.integration) {
        await this.initialize();
      }

      return await this.integration.getOffer(offerId);
    } catch (error) {
      throw new Error(`Failed to get offer: ${error.message}`);
    }
  }

  /**
   * Get all offers from Bol.com
   */
  async getOffers() {
    try {
      if (!this.integration) {
        await this.initialize();
      }

      return await this.integration.getOffers();
    } catch (error) {
      throw new Error(`Failed to get offers: ${error.message}`);
    }
  }

  /**
   * Schedule a sync operation
   */
  async scheduleSync(type, options = {}) {
    try {
      const scheduleId = uuidv4();
      const scheduleData = {
        id: scheduleId,
        type: type, // 'products', 'orders', 'stock'
        status: 'scheduled',
        options: options,
        scheduledAt: new Date(),
        createdAt: new Date()
      };

      await this.storeSchedule(scheduleData);
      console.log(`📅 Scheduled ${type} sync with ID: ${scheduleId}`);

      return { scheduleId, ...scheduleData };
    } catch (error) {
      throw new Error(`Failed to schedule sync: ${error.message}`);
    }
  }

  /**
   * Cancel a sync operation
   */
  async cancelSync(scheduleId = null) {
    try {
      if (scheduleId) {
        await this.cancelSchedule(scheduleId);
        console.log(`❌ Cancelled sync: ${scheduleId}`);
      } else {
        await this.cancelAllSchedules();
        console.log('❌ Cancelled all running syncs');
      }

      return { success: true };
    } catch (error) {
      throw new Error(`Failed to cancel sync: ${error.message}`);
    }
  }

  /**
   * Get sync status
   */
  async getSyncStatus() {
    try {
      return {
        running: [],
        scheduled: [],
        completed: [],
        failed: []
      };
    } catch (error) {
      throw new Error(`Failed to get sync status: ${error.message}`);
    }
  }

  /**
   * Run database migrations
   */
  async runMigrations() {
    console.log('📊 Running Bol.com database migrations...');
    // Migrations are handled by the plugin_migrations table
  }

  /**
   * Schedule automatic syncs based on configuration
   */
  async scheduleAutomaticSyncs() {
    const intervalHours = this.config.sync_interval_hours || 1;
    console.log(`📅 Scheduling automatic syncs every ${intervalHours} hour(s)...`);
    // Cron jobs are handled by the plugin_cron table
  }

  /**
   * Cancel scheduled syncs
   */
  async cancelScheduledSyncs() {
    console.log('❌ Cancelling scheduled syncs...');
  }

  /**
   * Clean up schedules during uninstall
   */
  async cleanupSchedules() {
    console.log('🧹 Cleaning up Bol.com schedules...');
  }

  /**
   * Store schedule in database
   */
  async storeSchedule(scheduleData) {
    console.log('💾 Storing schedule:', scheduleData.id);
  }

  /**
   * Cancel specific schedule
   */
  async cancelSchedule(scheduleId) {
    console.log('❌ Cancelling schedule:', scheduleId);
  }

  /**
   * Cancel all schedules
   */
  async cancelAllSchedules() {
    console.log('❌ Cancelling all Bol.com schedules');
  }
}

module.exports = BolcomPlugin;
