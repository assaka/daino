/**
 * Country and Currency Utility Functions
 */

// Country to currency mapping
export const COUNTRY_TO_CURRENCY = {
  // Europe - Euro zone
  DE: 'EUR', AT: 'EUR', BE: 'EUR', CY: 'EUR', EE: 'EUR', ES: 'EUR', FI: 'EUR',
  FR: 'EUR', GR: 'EUR', IE: 'EUR', IT: 'EUR', LT: 'EUR', LU: 'EUR', LV: 'EUR',
  MT: 'EUR', NL: 'EUR', PT: 'EUR', SI: 'EUR', SK: 'EUR',
  // Europe - Non-Euro
  GB: 'GBP', CH: 'CHF', SE: 'SEK', NO: 'NOK', DK: 'DKK', PL: 'PLN', CZ: 'CZK',
  HU: 'HUF', RO: 'RON', BG: 'BGN', HR: 'EUR',
  // Americas
  US: 'USD', CA: 'CAD', MX: 'MXN', BR: 'BRL',
  // Asia-Pacific
  JP: 'JPY', CN: 'CNY', KR: 'KRW', AU: 'AUD', NZ: 'NZD', SG: 'SGD', HK: 'HKD',
  IN: 'INR', TH: 'THB', MY: 'MYR', ID: 'IDR', PH: 'PHP', VN: 'VND',
  // Middle East & Africa
  AE: 'AED', SA: 'SAR', IL: 'ILS', ZA: 'ZAR', TR: 'TRY', RU: 'RUB',
};

/**
 * Get currency code for a country
 * @param {string} countryCode - ISO country code (e.g., 'NL', 'DE')
 * @returns {string} - Currency code (e.g., 'EUR', 'USD')
 */
export function getCurrencyForCountry(countryCode) {
  if (!countryCode) return 'USD';
  return COUNTRY_TO_CURRENCY[countryCode.toUpperCase()] || 'USD';
}

/**
 * Check if a payment method supports a country's currency
 * @param {Object} paymentMethod - Payment method with settings.supported_currencies
 * @param {string} countryCode - ISO country code
 * @returns {boolean} - Whether the payment method supports the country's currency
 */
export function paymentMethodSupportsCurrency(paymentMethod, countryCode) {
  const supportedCurrencies = paymentMethod?.settings?.supported_currencies;

  // If no currency restriction, it supports all currencies
  if (!supportedCurrencies || supportedCurrencies.length === 0) {
    return true;
  }

  const countryCurrency = getCurrencyForCountry(countryCode);
  return supportedCurrencies.includes(countryCurrency);
}
