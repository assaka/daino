/**
 * Bol.com Data Mapping Service
 * Handles mapping between DainoStore and Bol.com data formats
 */
class BolcomMapping {
  constructor(config = {}) {
    this.config = config;

    // Bol.com delivery codes
    this.deliveryCodes = {
      '24uurs-23': '24 hours (order before 23:00)',
      '24uurs-22': '24 hours (order before 22:00)',
      '24uurs-21': '24 hours (order before 21:00)',
      '24uurs-20': '24 hours (order before 20:00)',
      '24uurs-19': '24 hours (order before 19:00)',
      '24uurs-18': '24 hours (order before 18:00)',
      '24uurs-17': '24 hours (order before 17:00)',
      '24uurs-16': '24 hours (order before 16:00)',
      '24uurs-15': '24 hours (order before 15:00)',
      '24uurs-14': '24 hours (order before 14:00)',
      '24uurs-13': '24 hours (order before 13:00)',
      '24uurs-12': '24 hours (order before 12:00)',
      '1-2d': '1-2 business days',
      '2-3d': '2-3 business days',
      '3-5d': '3-5 business days',
      '4-8d': '4-8 business days',
      '1-8d': '1-8 business days'
    };

    // Bol.com transporter codes
    this.transporters = {
      'BRIEFPOST': 'Briefpost',
      'UPS': 'UPS',
      'TNT': 'PostNL',
      'TNT_EXTRA': 'PostNL Extra',
      'TNT_BRIEF': 'PostNL Brief',
      'TNT_EXPRESS': 'PostNL Express',
      'DYL': 'DYL',
      'DPD_NL': 'DPD Nederland',
      'DPD_BE': 'DPD Belgie',
      'BPOST_BE': 'bpost',
      'BPOST_BRIEF': 'bpost brief',
      'DHLFORYOU': 'DHL For You',
      'GLS': 'GLS',
      'FEDEX_NL': 'FedEx Nederland',
      'FEDEX_BE': 'FedEx Belgie',
      'OTHER': 'Anders',
      'DHL': 'DHL',
      'DHL_DE': 'DHL Duitsland',
      'DHL_GLOBAL_MAIL': 'DHL Global Mail',
      'TSN': 'TSN',
      'FIEGE': 'Fiege',
      'TRANSMISSION': 'Transmission',
      'PARCEL_NL': 'Parcel.nl',
      'LOGOIX': 'Logoix',
      'PACKS': 'Packs',
      'COURIER': 'Koerier'
    };

    // Bol.com condition categories
    this.conditions = {
      'NEW': 'New',
      'AS_NEW': 'As New',
      'GOOD': 'Good',
      'REASONABLE': 'Reasonable',
      'MODERATE': 'Moderate'
    };
  }

  /**
   * Map DainoStore product to Bol.com offer
   * @param {Object} product - DainoStore product
   * @param {Object} options - Mapping options
   */
  mapProductToOffer(product, options = {}) {
    const {
      fulfillmentMethod = 'FBR',
      deliveryCode = '24uurs-23',
      condition = 'NEW'
    } = options;

    // Validate required fields
    if (!product.ean && !product.barcode) {
      throw new Error(`Product ${product.sku || product.id} is missing EAN/barcode`);
    }

    if (!product.price || product.price <= 0) {
      throw new Error(`Product ${product.sku || product.id} has invalid price`);
    }

    return {
      ean: product.ean || product.barcode,
      condition: {
        name: condition,
        category: condition
      },
      reference: product.sku || product.id?.toString(),
      onHoldByRetailer: !product.is_active,
      unknownProductTitle: product.name?.substring(0, 500), // Bol.com limit
      pricing: {
        bundlePrices: [{
          quantity: 1,
          unitPrice: this.formatPrice(product.price)
        }]
      },
      stock: {
        amount: Math.max(0, parseInt(product.stock_quantity) || 0),
        managedByRetailer: true
      },
      fulfilment: {
        method: fulfillmentMethod,
        deliveryCode: deliveryCode
      }
    };
  }

  /**
   * Map Bol.com order to DainoStore order format
   * @param {Object} bolOrder - Bol.com order data
   */
  mapOrderToStore(bolOrder) {
    const orderItems = (bolOrder.orderItems || []).map(item => ({
      product_id: null, // Will be looked up by EAN
      ean: item.offer?.ean,
      sku: item.offer?.reference,
      name: item.product?.title,
      quantity: item.quantity,
      price: parseFloat(item.unitPrice) || 0,
      offer_id: item.offer?.offerId,
      order_item_id: item.orderItemId,
      fulfilment_method: item.fulfilment?.method
    }));

    const shippingAddress = bolOrder.shipmentDetails?.address || {};
    const billingAddress = bolOrder.billingDetails?.address || shippingAddress;

    return {
      external_id: bolOrder.orderId,
      external_source: 'bolcom',
      status: this.mapOrderStatus(bolOrder.orderItems?.[0]?.fulfilment?.latestDeliveryDate),
      customer: {
        email: bolOrder.shipmentDetails?.email,
        first_name: shippingAddress.firstName,
        last_name: shippingAddress.surname,
        phone: bolOrder.shipmentDetails?.phoneNumber
      },
      shipping_address: {
        first_name: shippingAddress.firstName,
        last_name: shippingAddress.surname,
        street: shippingAddress.streetName,
        house_number: shippingAddress.houseNumber,
        house_number_extension: shippingAddress.houseNumberExtension,
        city: shippingAddress.city,
        postal_code: shippingAddress.zipCode,
        country: shippingAddress.countryCode || 'NL'
      },
      billing_address: {
        first_name: billingAddress.firstName,
        last_name: billingAddress.surname,
        street: billingAddress.streetName,
        house_number: billingAddress.houseNumber,
        house_number_extension: billingAddress.houseNumberExtension,
        city: billingAddress.city,
        postal_code: billingAddress.zipCode,
        country: billingAddress.countryCode || 'NL'
      },
      items: orderItems,
      subtotal: this.calculateSubtotal(orderItems),
      shipping_cost: 0, // Bol.com handles shipping costs
      total: this.calculateTotal(orderItems),
      currency: 'EUR',
      created_at: bolOrder.orderPlacedDateTime,
      bol_order_data: bolOrder // Store original data for reference
    };
  }

  /**
   * Map Bol.com return to DainoStore return format
   */
  mapReturnToStore(bolReturn) {
    return {
      external_id: bolReturn.returnId,
      external_source: 'bolcom',
      order_id: bolReturn.orderId,
      reason: bolReturn.returnReason?.mainReason,
      reason_detail: bolReturn.returnReason?.detailedReason,
      status: bolReturn.handled ? 'handled' : 'pending',
      items: (bolReturn.returnItems || []).map(item => ({
        order_item_id: item.orderItemId,
        quantity: item.quantityReturned,
        handling_result: item.handlingResult
      })),
      created_at: bolReturn.registrationDateTime,
      bol_return_data: bolReturn
    };
  }

  /**
   * Map order status based on delivery date
   */
  mapOrderStatus(latestDeliveryDate) {
    if (!latestDeliveryDate) return 'pending';

    const deliveryDate = new Date(latestDeliveryDate);
    const now = new Date();

    if (deliveryDate < now) {
      return 'overdue';
    }
    return 'pending';
  }

  /**
   * Format price for Bol.com (2 decimal places)
   */
  formatPrice(price) {
    return parseFloat(parseFloat(price).toFixed(2));
  }

  /**
   * Calculate subtotal from order items
   */
  calculateSubtotal(items) {
    return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }

  /**
   * Calculate order total
   */
  calculateTotal(items) {
    return this.calculateSubtotal(items);
  }

  /**
   * Get delivery code options
   */
  getDeliveryCodeOptions() {
    return Object.entries(this.deliveryCodes).map(([value, label]) => ({
      value,
      label
    }));
  }

  /**
   * Get transporter options
   */
  getTransporterOptions() {
    return Object.entries(this.transporters).map(([value, label]) => ({
      value,
      label
    }));
  }

  /**
   * Get condition options
   */
  getConditionOptions() {
    return Object.entries(this.conditions).map(([value, label]) => ({
      value,
      label
    }));
  }

  /**
   * Validate EAN-13 barcode
   */
  validateEan(ean) {
    if (!ean || ean.length !== 13) {
      return false;
    }

    // Calculate check digit
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      const digit = parseInt(ean[i]);
      sum += digit * (i % 2 === 0 ? 1 : 3);
    }

    const checkDigit = (10 - (sum % 10)) % 10;
    return checkDigit === parseInt(ean[12]);
  }

  /**
   * Generate EAN-13 from SKU (for testing only)
   * In production, use proper EAN codes
   */
  generateTestEan(sku) {
    const base = sku.replace(/\D/g, '').padStart(12, '0').substring(0, 12);

    // Calculate check digit
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += parseInt(base[i]) * (i % 2 === 0 ? 1 : 3);
    }

    const checkDigit = (10 - (sum % 10)) % 10;
    return base + checkDigit;
  }
}

module.exports = BolcomMapping;
