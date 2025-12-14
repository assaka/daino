// backend/src/services/PluginPurchaseService.js
const { masterDbClient } = require('../database/masterConnection');
const { v4: uuidv4 } = require('uuid');
// const stripeService = require('./StripeService'); // TODO: Implement Stripe service
// const pluginManager = require('../core/PluginManager'); // Will be created next

class PluginPurchaseService {

  /**
   * Purchase a plugin from marketplace
   */
  async purchasePlugin(marketplacePluginId, tenantId, selectedPlan, userId) {
    try {
      // 1. Get plugin details
      const plugin = await this.getMarketplacePlugin(marketplacePluginId);

      // 2. Check if already purchased
      const existingLicense = await this.checkExistingLicense(marketplacePluginId, tenantId);
      if (existingLicense) {
        throw new Error('Plugin already purchased');
      }

      // 3. Calculate pricing
      const pricingDetails = this.calculatePricing(plugin, selectedPlan);

      // 4. Process payment
      let paymentResult;
      if (pricingDetails.amount > 0) {
        if (plugin.pricing_model === 'subscription') {
          paymentResult = await this.createSubscription(plugin, tenantId, pricingDetails, userId);
        } else {
          paymentResult = await this.processOneTimePayment(plugin, tenantId, pricingDetails, userId);
        }
      }

      // 5. Create license
      const license = await this.createLicense(
        marketplacePluginId,
        tenantId,
        plugin,
        pricingDetails,
        paymentResult,
        userId
      );

      // 6. Install plugin to tenant
      // await pluginManager.installFromMarketplace(marketplacePluginId, tenantId, userId);

      // 7. Update marketplace metrics
      await this.updateMarketplaceMetrics(marketplacePluginId, pricingDetails.amount);

      // 8. Distribute revenue
      await this.recordRevenue(plugin.author_id, pricingDetails.amount, plugin.revenue_share_percentage);

      return {
        success: true,
        license,
        paymentResult
      };

    } catch (error) {
      console.error('Purchase failed:', error);
      throw error;
    }
  }

  /**
   * Calculate pricing based on selected plan
   */
  calculatePricing(plugin, selectedPlan) {
    let amount = 0;
    let billingInterval = null;

    if (plugin.pricing_model === 'free') {
      return { amount: 0, billingInterval: null, currency: 'USD' };
    }

    if (plugin.pricing_model === 'one_time') {
      amount = plugin.base_price;
    } else if (plugin.pricing_model === 'subscription') {
      if (selectedPlan === 'monthly') {
        amount = plugin.monthly_price;
        billingInterval = 'month';
      } else if (selectedPlan === 'yearly') {
        amount = plugin.yearly_price;
        billingInterval = 'year';
      }
    } else if (plugin.pricing_model === 'custom') {
      const tier = plugin.pricing_tiers.find(t => t.id === selectedPlan);
      if (!tier) throw new Error('Invalid pricing tier');
      amount = tier.price;
      billingInterval = tier.billingInterval === 'one_time' ? null : tier.billingInterval;
    }

    return {
      amount,
      billingInterval,
      currency: plugin.currency || 'USD'
    };
  }

  /**
   * Process one-time payment via Stripe
   */
  async processOneTimePayment(plugin, tenantId, pricingDetails, userId) {
    // TODO: Implement Stripe payment
    console.log('Processing one-time payment:', pricingDetails.amount);

    return {
      paymentIntentId: `pi_${Date.now()}`,
      type: 'one_time'
    };
  }

  /**
   * Create subscription via Stripe
   */
  async createSubscription(plugin, tenantId, pricingDetails, userId) {
    // TODO: Implement Stripe subscription
    console.log('Creating subscription:', pricingDetails);

    const nextBillingDate = new Date();
    nextBillingDate.setMonth(nextBillingDate.getMonth() + (pricingDetails.billingInterval === 'year' ? 12 : 1));

    return {
      subscriptionId: `sub_${Date.now()}`,
      customerId: `cus_${Date.now()}`,
      type: 'subscription',
      nextBillingDate
    };
  }

  /**
   * Create license record
   */
  async createLicense(marketplacePluginId, tenantId, plugin, pricingDetails, paymentResult, userId) {
    const licenseKey = this.generateLicenseKey();

    if (!masterDbClient) {
      throw new Error('Master database client not available');
    }

    const { data, error } = await masterDbClient
      .from('plugin_licenses')
      .insert({
        id: uuidv4(),
        marketplace_plugin_id: marketplacePluginId,
        tenant_id: tenantId,
        user_id: userId,
        license_key: licenseKey,
        license_type: plugin.license_type,
        status: 'active',
        amount_paid: pricingDetails.amount,
        currency: pricingDetails.currency,
        billing_interval: pricingDetails.billingInterval,
        subscription_id: paymentResult?.subscriptionId || null,
        current_period_start: new Date().toISOString(),
        current_period_end: paymentResult?.nextBillingDate?.toISOString() || null
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create license: ${error.message}`);
    }

    return data;
  }

  /**
   * Record revenue distribution
   */
  async recordRevenue(creatorId, amount, revenueSharePercentage = 70) {
    const creatorAmount = (amount * revenueSharePercentage / 100).toFixed(2);
    const platformAmount = (amount * (100 - revenueSharePercentage) / 100).toFixed(2);

    // TODO: Record in revenue tracking table
    // This would integrate with accounting/payout systems

    console.log(`💰 Revenue: Creator ${creatorId} gets $${creatorAmount}, Platform gets $${platformAmount}`);
  }

  /**
   * Update marketplace metrics
   */
  async updateMarketplaceMetrics(pluginId, revenue) {
    if (!masterDbClient) {
      console.warn('Master database client not available, skipping metrics update');
      return;
    }

    const { error } = await masterDbClient
      .rpc('increment_plugin_installations', { plugin_id: pluginId });

    // If RPC doesn't exist, fallback to direct update
    if (error && error.code === 'PGRST202') {
      const { error: updateError } = await masterDbClient
        .from('plugin_marketplace')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', pluginId);

      if (updateError) {
        console.warn('Failed to update marketplace metrics:', updateError.message);
      }
    }
  }

  /**
   * Generate unique license key
   */
  generateLicenseKey() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const segments = 4;
    const segmentLength = 4;

    let key = '';
    for (let i = 0; i < segments; i++) {
      for (let j = 0; j < segmentLength; j++) {
        key += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      if (i < segments - 1) key += '-';
    }

    return key; // Format: XXXX-XXXX-XXXX-XXXX
  }

  /**
   * Get marketplace plugin
   */
  async getMarketplacePlugin(pluginId) {
    if (!masterDbClient) {
      throw new Error('Master database client not available');
    }

    const { data, error } = await masterDbClient
      .from('plugin_marketplace')
      .select('*')
      .eq('id', pluginId)
      .eq('status', 'approved')
      .single();

    if (error || !data) {
      throw new Error('Plugin not found in marketplace');
    }

    return data;
  }

  /**
   * Check existing license
   */
  async checkExistingLicense(pluginId, tenantId) {
    if (!masterDbClient) {
      throw new Error('Master database client not available');
    }

    const { data, error } = await masterDbClient
      .from('plugin_licenses')
      .select('*')
      .eq('marketplace_plugin_id', pluginId)
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .maybeSingle();

    if (error) {
      console.error('Error checking existing license:', error.message);
      return null;
    }

    return data;
  }
}

module.exports = new PluginPurchaseService();
