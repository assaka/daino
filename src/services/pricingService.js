import apiClient from '@/api/client';

// Dutch VAT (BTW) rate - 21%
const DUTCH_VAT_RATE = 0.21;

/**
 * Frontend Pricing Service
 * Fetches credit pricing and currency information from backend
 */
class PricingService {
  constructor() {
    this.taxInfo = null;
  }

  /**
   * Calculate tax for a given amount (frontend fallback)
   * @param {number} amount - Base amount (excl. tax)
   * @param {number} vatRate - VAT rate as decimal (default: 0.21)
   * @returns {object} - { subtotal, taxAmount, total, taxRate, taxPercentage }
   */
  calculateTax(amount, vatRate = DUTCH_VAT_RATE) {
    const subtotal = parseFloat(amount);
    const taxAmount = Math.round(subtotal * vatRate * 100) / 100;
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
   * Get the stored tax info
   * @returns {object|null} - Tax info from last pricing fetch
   */
  getTaxInfo() {
    return this.taxInfo || {
      rate: DUTCH_VAT_RATE,
      percentage: Math.round(DUTCH_VAT_RATE * 100),
      label: 'BTW',
      country: 'NL'
    };
  }

  /**
   * Get credit pricing for a specific currency
   * @param {string} currency - Currency code (usd, eur)
   * @returns {Promise<Array>} - Array of pricing options
   */
  async getPricing(currency = 'usd') {
    try {
      const response = await apiClient.get(`credits/pricing?currency=${currency}`);

      // Store tax info if provided
      if (response?.tax) {
        this.taxInfo = response.tax;
      }

      return response?.data || [];
    } catch (error) {
      console.error('Error fetching pricing:', error);

      // Return default pricing as fallback
      return this.getDefaultPricing(currency);
    }
  }

  /**
   * Get available currencies
   * @returns {Promise<Array>} - Array of currency codes
   */
  async getCurrencies() {
    try {
      const response = await apiClient.get('credits/currencies');
      return response?.data || ['usd', 'eur'];
    } catch (error) {
      console.error('Error fetching currencies:', error);
      return ['usd', 'eur'];
    }
  }

  /**
   * Get default pricing (fallback)
   * @param {string} currency - Currency code
   * @returns {Array} - Default pricing options with tax
   */
  getDefaultPricing(currency = 'usd') {
    const basePricing = {
      usd: [
        { credits: 100, amount: 10, currency: 'usd', popular: false },
        { credits: 550, amount: 50, currency: 'usd', popular: true },
        { credits: 1200, amount: 100, currency: 'usd', popular: false }
      ],
      eur: [
        { credits: 100, amount: 9, currency: 'eur', popular: false },
        { credits: 550, amount: 46, currency: 'eur', popular: true },
        { credits: 1200, amount: 92, currency: 'eur', popular: false }
      ]
    };

    const pricing = basePricing[currency.toLowerCase()] || basePricing.usd;

    // Add tax calculation to each option
    return pricing.map(option => {
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

  /**
   * Format price with currency symbol
   * @param {number} amount - Price amount
   * @param {string} currency - Currency code
   * @returns {string} - Formatted price (e.g., "$10.50" or "€9.00")
   */
  formatPrice(amount, currency) {
    const symbol = currency === 'eur' ? '€' : '$';
    // Format to 2 decimal places, but remove trailing zeros for whole numbers
    const formatted = parseFloat(amount).toFixed(2);
    const cleanFormatted = formatted.endsWith('.00') ? formatted.slice(0, -3) : formatted;
    return `${symbol}${cleanFormatted}`;
  }

  /**
   * Get currency symbol
   * @param {string} currency - Currency code
   * @returns {string} - Currency symbol
   */
  getCurrencySymbol(currency) {
    const symbols = {
      usd: '$',
      eur: '€',
      gbp: '£'
    };

    return symbols[currency.toLowerCase()] || '$';
  }
}

export default new PricingService();
