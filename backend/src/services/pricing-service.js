const { masterDbClient } = require('../database/masterConnection');

// Dutch VAT (BTW) rate - 21%
const DUTCH_VAT_RATE = 0.21;

/**
 * Credit Pricing Service
 * Manages credit package pricing with Stripe Price IDs for different currencies
 * Uses Supabase (masterDbClient) for database operations
 */
class PricingService {
  /**
   * Get Dutch VAT rate
   * @returns {number} - VAT rate as decimal (0.21 = 21%)
   */
  getVatRate() {
    return DUTCH_VAT_RATE;
  }

  /**
   * Calculate tax for a given amount
   * @param {number} amount - Base amount (excl. tax)
   * @param {number} vatRate - VAT rate as decimal (default: 0.21)
   * @returns {object} - { subtotal, taxAmount, total, taxRate }
   */
  calculateTax(amount, vatRate = DUTCH_VAT_RATE) {
    const subtotal = parseFloat(amount);
    const taxAmount = Math.round(subtotal * vatRate * 100) / 100; // Round to 2 decimal places
    const total = Math.round((subtotal + taxAmount) * 100) / 100;

    return {
      subtotal,
      taxAmount,
      total,
      taxRate: vatRate,
      taxPercentage: Math.round(vatRate * 100)
    };
  }

  /**
   * Get credit pricing for a specific currency
   * @param {string} currency - Currency code (usd, eur)
   * @returns {Array} - Array of pricing options
   */
  async getPricingForCurrency(currency = 'usd') {
    console.log(`💰 [PricingService] Getting pricing for currency: ${currency}`);

    try {
      const { data, error } = await masterDbClient
        .from('credit_pricing')
        .select('id, credits, amount, currency, stripe_price_id, popular, active, display_order')
        .eq('currency', currency.toLowerCase())
        .eq('active', true)
        .order('display_order', { ascending: true })
        .order('amount', { ascending: true });

      if (error) {
        console.error(`❌ [PricingService] Database error:`, error);
        throw new Error(`Failed to fetch pricing: ${error.message}`);
      }

      if (!data || data.length === 0) {
        console.error(`❌ [PricingService] No pricing found in database for ${currency}`);
        throw new Error(`No pricing configured for currency: ${currency.toUpperCase()}`);
      }

      // Add tax calculation to each pricing option
      const pricingWithTax = data.map(option => {
        const taxInfo = this.calculateTax(option.amount);
        return {
          ...option,
          subtotal: taxInfo.subtotal,
          tax_amount: taxInfo.taxAmount,
          total: taxInfo.total,
          tax_rate: taxInfo.taxRate,
          tax_percentage: taxInfo.taxPercentage
        };
      });

      console.log(`✅ [PricingService] Loaded ${pricingWithTax.length} prices from database for ${currency} (with ${DUTCH_VAT_RATE * 100}% BTW)`);
      return pricingWithTax;

    } catch (error) {
      console.error(`❌ [PricingService] Error fetching pricing:`, error);
      throw error;
    }
  }

  /**
   * Get all available currencies
   * @returns {Array} - Array of currency codes
   */
  async getAvailableCurrencies() {
    try {
      const { data, error } = await masterDbClient
        .from('credit_pricing')
        .select('currency')
        .eq('active', true);

      if (error) {
        console.error(`❌ [PricingService] Database error:`, error);
        throw new Error(`Failed to fetch currencies: ${error.message}`);
      }

      if (!data || data.length === 0) {
        throw new Error('No currencies configured in credit_pricing table');
      }

      // Get unique currencies
      const currencies = [...new Set(data.map(r => r.currency))].sort();
      return currencies;
    } catch (error) {
      console.error(`❌ [PricingService] Error fetching currencies:`, error);
      throw error;
    }
  }

  /**
   * Get price details by Stripe Price ID
   * @param {string} stripePriceId - Stripe Price ID
   * @returns {object} - Price details
   */
  async getPriceByStripeId(stripePriceId) {
    try {
      const { data, error } = await masterDbClient
        .from('credit_pricing')
        .select('id, credits, amount, currency, stripe_price_id, popular')
        .eq('stripe_price_id', stripePriceId)
        .eq('active', true)
        .single();

      if (error) {
        console.error(`❌ [PricingService] Error fetching price by Stripe ID:`, error);
        return null;
      }

      return data;
    } catch (error) {
      console.error(`❌ [PricingService] Error fetching price by Stripe ID:`, error);
      return null;
    }
  }

  /**
   * Get default pricing (fallback if database is empty)
   */
  getDefaultPricing(currency = 'usd') {
    const basePricing = [
      { credits: 100, amount: 10, currency, popular: false },
      { credits: 500, amount: 45, currency, popular: true },
      { credits: 1000, amount: 80, currency, popular: false }
    ];

    // Add tax calculation to each default option
    return basePricing.map(option => {
      const taxInfo = this.calculateTax(option.amount);
      return {
        ...option,
        subtotal: taxInfo.subtotal,
        tax_amount: taxInfo.taxAmount,
        total: taxInfo.total,
        tax_rate: taxInfo.taxRate,
        tax_percentage: taxInfo.taxPercentage
      };
    });
  }
}

module.exports = new PricingService();
