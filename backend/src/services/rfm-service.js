/**
 * RFM Service
 *
 * Calculates RFM (Recency, Frequency, Monetary) scores for customers.
 * RFM is a customer segmentation technique that uses past purchase behavior.
 */

const CustomerRfmScore = require('../models/CustomerRfmScore');
const ConnectionManager = require('./database/ConnectionManager');

class RfmService {
  /**
   * RFM Segment definitions
   * Based on combined RFM scores
   */
  static SEGMENTS = {
    CHAMPIONS: 'champions',
    LOYAL_CUSTOMERS: 'loyal_customers',
    POTENTIAL_LOYALIST: 'potential_loyalist',
    NEW_CUSTOMERS: 'new_customers',
    PROMISING: 'promising',
    NEED_ATTENTION: 'need_attention',
    ABOUT_TO_SLEEP: 'about_to_sleep',
    AT_RISK: 'at_risk',
    CANT_LOSE: 'cant_lose',
    HIBERNATING: 'hibernating',
    LOST: 'lost'
  };

  /**
   * Segment rules based on R, F, M scores (1-5 each)
   */
  static SEGMENT_RULES = [
    { segment: 'champions', minR: 4, maxR: 5, minF: 4, maxF: 5, minM: 4, maxM: 5 },
    { segment: 'loyal_customers', minR: 2, maxR: 5, minF: 3, maxF: 5, minM: 3, maxM: 5 },
    { segment: 'potential_loyalist', minR: 3, maxR: 5, minF: 1, maxF: 3, minM: 1, maxM: 3 },
    { segment: 'new_customers', minR: 4, maxR: 5, minF: 1, maxF: 1, minM: 1, maxM: 5 },
    { segment: 'promising', minR: 3, maxR: 4, minF: 1, maxF: 1, minM: 1, maxM: 3 },
    { segment: 'need_attention', minR: 2, maxR: 3, minF: 2, maxF: 3, minM: 2, maxM: 3 },
    { segment: 'about_to_sleep', minR: 2, maxR: 3, minF: 1, maxF: 2, minM: 1, maxM: 2 },
    { segment: 'at_risk', minR: 1, maxR: 2, minF: 2, maxF: 5, minM: 2, maxM: 5 },
    { segment: 'cant_lose', minR: 1, maxR: 1, minF: 4, maxF: 5, minM: 4, maxM: 5 },
    { segment: 'hibernating', minR: 1, maxR: 2, minF: 1, maxF: 2, minM: 1, maxM: 2 },
    { segment: 'lost', minR: 1, maxR: 1, minF: 1, maxF: 1, minM: 1, maxM: 1 }
  ];

  /**
   * Calculate RFM scores for all customers in a store
   */
  static async calculateAllScores(storeId) {
    console.log(`[RfmService] Starting RFM calculation for store ${storeId}`);

    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    // Get all customers with order data
    const { data: customers, error: customerError } = await tenantDb
      .from('customers')
      .select(`
        id,
        total_spent,
        total_orders,
        last_order_date
      `)
      .eq('store_id', storeId)
      .gt('total_orders', 0); // Only customers with orders

    if (customerError) {
      console.error('[RfmService] Error fetching customers:', customerError);
      throw customerError;
    }

    if (!customers || customers.length === 0) {
      console.log('[RfmService] No customers with orders found');
      return { processed: 0, skipped: 0 };
    }

    console.log(`[RfmService] Processing ${customers.length} customers`);

    // Calculate metrics for all customers
    const now = new Date();
    const customerMetrics = customers.map(customer => {
      const lastOrderDate = customer.last_order_date ? new Date(customer.last_order_date) : null;
      const daysSinceLastOrder = lastOrderDate
        ? Math.floor((now - lastOrderDate) / (1000 * 60 * 60 * 24))
        : 999; // High value for customers with no recorded order date

      return {
        customerId: customer.id,
        recency: daysSinceLastOrder,
        frequency: customer.total_orders || 0,
        monetary: parseFloat(customer.total_spent) || 0,
        lastOrderDate: customer.last_order_date
      };
    });

    // Calculate percentile boundaries for each metric
    const recencyBoundaries = this.calculatePercentileBoundaries(
      customerMetrics.map(c => c.recency),
      true // Lower is better for recency
    );
    const frequencyBoundaries = this.calculatePercentileBoundaries(
      customerMetrics.map(c => c.frequency)
    );
    const monetaryBoundaries = this.calculatePercentileBoundaries(
      customerMetrics.map(c => c.monetary)
    );

    // Calculate scores for each customer
    const scores = customerMetrics.map(customer => {
      const recencyScore = this.getScore(customer.recency, recencyBoundaries, true);
      const frequencyScore = this.getScore(customer.frequency, frequencyBoundaries);
      const monetaryScore = this.getScore(customer.monetary, monetaryBoundaries);
      const rfmSegment = this.determineSegment(recencyScore, frequencyScore, monetaryScore);

      return {
        customerId: customer.customerId,
        recencyScore,
        frequencyScore,
        monetaryScore,
        rfmScore: `${recencyScore}${frequencyScore}${monetaryScore}`,
        rfmSegment,
        lastOrderDate: customer.lastOrderDate,
        orderCount: customer.frequency,
        totalRevenue: customer.monetary
      };
    });

    // Bulk upsert scores
    await CustomerRfmScore.bulkUpsert(storeId, scores);

    console.log(`[RfmService] Completed RFM calculation for ${scores.length} customers`);

    return {
      processed: scores.length,
      skipped: 0
    };
  }

  /**
   * Calculate RFM score for a single customer
   */
  static async calculateCustomerScore(storeId, customerId) {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    // Get customer data
    const { data: customer, error: customerError } = await tenantDb
      .from('customers')
      .select('id, total_spent, total_orders, last_order_date')
      .eq('id', customerId)
      .eq('store_id', storeId)
      .single();

    if (customerError || !customer) {
      throw new Error('Customer not found');
    }

    if (!customer.total_orders || customer.total_orders === 0) {
      return null; // Can't calculate RFM without orders
    }

    // Get all customers for percentile calculation
    const { data: allCustomers } = await tenantDb
      .from('customers')
      .select('total_spent, total_orders, last_order_date')
      .eq('store_id', storeId)
      .gt('total_orders', 0);

    const now = new Date();

    // Calculate this customer's metrics
    const lastOrderDate = customer.last_order_date ? new Date(customer.last_order_date) : null;
    const recency = lastOrderDate
      ? Math.floor((now - lastOrderDate) / (1000 * 60 * 60 * 24))
      : 999;
    const frequency = customer.total_orders;
    const monetary = parseFloat(customer.total_spent) || 0;

    // Calculate all customer metrics for percentile boundaries
    const allMetrics = (allCustomers || []).map(c => {
      const orderDate = c.last_order_date ? new Date(c.last_order_date) : null;
      return {
        recency: orderDate ? Math.floor((now - orderDate) / (1000 * 60 * 60 * 24)) : 999,
        frequency: c.total_orders || 0,
        monetary: parseFloat(c.total_spent) || 0
      };
    });

    const recencyBoundaries = this.calculatePercentileBoundaries(
      allMetrics.map(c => c.recency),
      true
    );
    const frequencyBoundaries = this.calculatePercentileBoundaries(
      allMetrics.map(c => c.frequency)
    );
    const monetaryBoundaries = this.calculatePercentileBoundaries(
      allMetrics.map(c => c.monetary)
    );

    // Calculate scores
    const recencyScore = this.getScore(recency, recencyBoundaries, true);
    const frequencyScore = this.getScore(frequency, frequencyBoundaries);
    const monetaryScore = this.getScore(monetary, monetaryBoundaries);
    const rfmSegment = this.determineSegment(recencyScore, frequencyScore, monetaryScore);

    // Save score
    const score = await CustomerRfmScore.upsert(storeId, customerId, {
      recencyScore,
      frequencyScore,
      monetaryScore,
      rfmScore: `${recencyScore}${frequencyScore}${monetaryScore}`,
      rfmSegment,
      lastOrderDate: customer.last_order_date,
      orderCount: frequency,
      totalRevenue: monetary
    });

    return score;
  }

  /**
   * Calculate percentile boundaries for scoring
   * Returns array of 4 values representing 20th, 40th, 60th, 80th percentiles
   */
  static calculatePercentileBoundaries(values, reverse = false) {
    if (!values || values.length === 0) {
      return [0, 0, 0, 0];
    }

    const sorted = [...values].sort((a, b) => a - b);
    const len = sorted.length;

    const percentiles = [
      sorted[Math.floor(len * 0.2)] || sorted[0],
      sorted[Math.floor(len * 0.4)] || sorted[0],
      sorted[Math.floor(len * 0.6)] || sorted[0],
      sorted[Math.floor(len * 0.8)] || sorted[0]
    ];

    return reverse ? percentiles.reverse() : percentiles;
  }

  /**
   * Get score (1-5) based on value and boundaries
   */
  static getScore(value, boundaries, reverse = false) {
    if (reverse) {
      // Lower value = higher score (for recency)
      if (value <= boundaries[0]) return 5;
      if (value <= boundaries[1]) return 4;
      if (value <= boundaries[2]) return 3;
      if (value <= boundaries[3]) return 2;
      return 1;
    } else {
      // Higher value = higher score (for frequency, monetary)
      if (value >= boundaries[3]) return 5;
      if (value >= boundaries[2]) return 4;
      if (value >= boundaries[1]) return 3;
      if (value >= boundaries[0]) return 2;
      return 1;
    }
  }

  /**
   * Determine segment based on R, F, M scores
   */
  static determineSegment(r, f, m) {
    for (const rule of this.SEGMENT_RULES) {
      if (
        r >= rule.minR && r <= rule.maxR &&
        f >= rule.minF && f <= rule.maxF &&
        m >= rule.minM && m <= rule.maxM
      ) {
        return rule.segment;
      }
    }
    return 'other';
  }

  /**
   * Get RFM score for a customer
   */
  static async getCustomerScore(storeId, customerId) {
    return await CustomerRfmScore.findByCustomerId(storeId, customerId);
  }

  /**
   * Get customers by RFM segment
   */
  static async getCustomersBySegment(storeId, segment) {
    return await CustomerRfmScore.findBySegment(storeId, segment);
  }

  /**
   * Get segment distribution
   */
  static async getSegmentDistribution(storeId) {
    return await CustomerRfmScore.getSegmentDistribution(storeId);
  }

  /**
   * Get RFM statistics
   */
  static async getStatistics(storeId) {
    return await CustomerRfmScore.getStatistics(storeId);
  }

  /**
   * Get segment details with descriptions
   */
  static getSegmentDetails() {
    return [
      {
        id: 'champions',
        name: 'Champions',
        description: 'Best customers - bought recently, buy often, and spend the most',
        color: '#10b981',
        action: 'Reward them, make them feel valued, can be early adopters'
      },
      {
        id: 'loyal_customers',
        name: 'Loyal Customers',
        description: 'Spent good money with us often. Responsive to promotions',
        color: '#3b82f6',
        action: 'Upsell higher value products, ask for reviews'
      },
      {
        id: 'potential_loyalist',
        name: 'Potential Loyalists',
        description: 'Recent customers but spent a good amount and bought more than once',
        color: '#8b5cf6',
        action: 'Offer membership/loyalty program, recommend other products'
      },
      {
        id: 'new_customers',
        name: 'New Customers',
        description: 'Bought most recently but not often',
        color: '#06b6d4',
        action: 'Provide onboarding support, give them early success, start building relationship'
      },
      {
        id: 'promising',
        name: 'Promising',
        description: 'Recent shoppers but haven\'t spent much',
        color: '#14b8a6',
        action: 'Create brand awareness, offer free trials'
      },
      {
        id: 'need_attention',
        name: 'Need Attention',
        description: 'Above average recency, frequency and monetary values. May not have bought very recently',
        color: '#f59e0b',
        action: 'Make limited time offers, recommend based on past purchases, reactivate them'
      },
      {
        id: 'about_to_sleep',
        name: 'About to Sleep',
        description: 'Below average recency, frequency and monetary values. Will lose them if not reactivated',
        color: '#f97316',
        action: 'Share valuable resources, recommend popular products/renewals at discount, reconnect'
      },
      {
        id: 'at_risk',
        name: 'At Risk',
        description: 'Spent big money and purchased often. But long time ago. Need to bring them back!',
        color: '#ef4444',
        action: 'Send personalized emails to reconnect, offer renewals, provide helpful resources'
      },
      {
        id: 'cant_lose',
        name: 'Can\'t Lose Them',
        description: 'Made biggest purchases, and often. But haven\'t returned for a long time',
        color: '#dc2626',
        action: 'Win them back via renewals or newer products, don\'t lose them to competition, talk to them'
      },
      {
        id: 'hibernating',
        name: 'Hibernating',
        description: 'Last purchase was long back, low spenders and low number of orders',
        color: '#6b7280',
        action: 'Offer other relevant products and special discounts. Recreate brand value'
      },
      {
        id: 'lost',
        name: 'Lost',
        description: 'Lowest recency, frequency and monetary scores',
        color: '#374151',
        action: 'Revive interest with reach-out campaign, ignore otherwise'
      }
    ];
  }

  /**
   * Get RFM matrix data for visualization
   */
  static async getRfmMatrix(storeId) {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const { data, error } = await tenantDb
      .from('customer_rfm_scores')
      .select('recency_score, frequency_score, monetary_score')
      .eq('store_id', storeId);

    if (error) throw error;

    // Create a 5x5 matrix for R vs F (with M as heat intensity)
    const matrix = {};
    for (let r = 1; r <= 5; r++) {
      for (let f = 1; f <= 5; f++) {
        matrix[`${r}-${f}`] = { count: 0, avgMonetary: 0, totalMonetary: 0 };
      }
    }

    (data || []).forEach(score => {
      const key = `${score.recency_score}-${score.frequency_score}`;
      if (matrix[key]) {
        matrix[key].count++;
        matrix[key].totalMonetary += score.monetary_score;
      }
    });

    // Calculate averages
    Object.keys(matrix).forEach(key => {
      if (matrix[key].count > 0) {
        matrix[key].avgMonetary = matrix[key].totalMonetary / matrix[key].count;
      }
    });

    return matrix;
  }
}

module.exports = RfmService;
