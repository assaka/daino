/**
 * CreditTransaction Model (Master Database)
 *
 * Records all credit purchases, adjustments, refunds
 * Uses Supabase REST API via masterDbClient
 */

const { v4: uuidv4 } = require('uuid');
const { masterDbClient } = require('../../database/masterConnection');

const TABLE_NAME = 'credit_transactions';

/**
 * CreditTransaction - Supabase-based model for credit transactions
 */
class CreditTransaction {
  constructor(data = {}) {
    Object.assign(this, data);
  }

  /**
   * Create a new transaction
   * @param {Object} data - Transaction data
   * @returns {Promise<CreditTransaction>}
   */
  static async create(data) {
    const record = {
      id: data.id || uuidv4(),
      store_id: data.store_id,
      amount: data.amount,
      transaction_type: data.transaction_type,
      payment_method: data.payment_method || null,
      payment_provider_id: data.payment_provider_id || null,
      payment_status: data.payment_status || 'completed',
      description: data.description || null,
      reference_id: data.reference_id || null,
      processed_by: data.processed_by || null,
      notes: data.notes || null,
      created_at: new Date().toISOString()
    };

    const { data: result, error } = await masterDbClient
      .from(TABLE_NAME)
      .insert(record)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create transaction: ${error.message}`);
    }

    return new CreditTransaction(result);
  }

  /**
   * Find transaction by ID
   * @param {string} id - Transaction UUID
   * @returns {Promise<CreditTransaction|null>}
   */
  static async findByPk(id) {
    const { data, error } = await masterDbClient
      .from(TABLE_NAME)
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to find transaction: ${error.message}`);
    }

    return data ? new CreditTransaction(data) : null;
  }

  /**
   * Find one transaction matching criteria
   * @param {Object} options - Query options with 'where' clause
   * @returns {Promise<CreditTransaction|null>}
   */
  static async findOne(options = {}) {
    let query = masterDbClient.from(TABLE_NAME).select('*');

    if (options.where) {
      for (const [key, value] of Object.entries(options.where)) {
        query = query.eq(key, value);
      }
    }

    const { data, error } = await query.maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to find transaction: ${error.message}`);
    }

    return data ? new CreditTransaction(data) : null;
  }

  /**
   * Find all transactions matching criteria
   * @param {Object} options - Query options
   * @returns {Promise<CreditTransaction[]>}
   */
  static async findAll(options = {}) {
    let query = masterDbClient.from(TABLE_NAME).select('*');

    if (options.where) {
      for (const [key, value] of Object.entries(options.where)) {
        query = query.eq(key, value);
      }
    }

    if (options.order) {
      for (const [field, direction] of options.order) {
        query = query.order(field, { ascending: direction === 'ASC' });
      }
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to find transactions: ${error.message}`);
    }

    return (data || []).map(row => new CreditTransaction(row));
  }

  /**
   * Record a credit purchase
   * @param {string} storeId - Store UUID
   * @param {number} amount - Amount purchased
   * @param {Object} options - Transaction options
   * @returns {Promise<CreditTransaction>}
   */
  static async recordPurchase(storeId, amount, options = {}) {
    return this.create({
      store_id: storeId,
      amount: Math.abs(amount),
      transaction_type: 'purchase',
      payment_method: options.paymentMethod,
      payment_provider_id: options.paymentProviderId,
      payment_status: options.paymentStatus || 'completed',
      description: options.description || `Credit purchase: ${amount} credits`,
      reference_id: options.referenceId
    });
  }

  /**
   * Record a credit adjustment (admin)
   * @param {string} storeId - Store UUID
   * @param {number} amount - Amount to adjust
   * @param {string} adminUserId - Admin user ID
   * @param {string} reason - Reason for adjustment
   * @returns {Promise<CreditTransaction>}
   */
  static async recordAdjustment(storeId, amount, adminUserId, reason) {
    return this.create({
      store_id: storeId,
      amount: amount,
      transaction_type: 'adjustment',
      payment_status: 'completed',
      description: reason,
      processed_by: adminUserId,
      notes: `Admin adjustment by ${adminUserId}`
    });
  }

  /**
   * Record a refund
   * @param {string} storeId - Store UUID
   * @param {number} amount - Amount to refund
   * @param {Object} options - Refund options
   * @returns {Promise<CreditTransaction>}
   */
  static async recordRefund(storeId, amount, options = {}) {
    return this.create({
      store_id: storeId,
      amount: Math.abs(amount),
      transaction_type: 'refund',
      payment_method: options.paymentMethod,
      payment_provider_id: options.paymentProviderId,
      payment_status: 'refunded',
      description: options.description || `Refund: ${amount} credits`,
      reference_id: options.referenceId,
      notes: options.notes
    });
  }

  /**
   * Record bonus credits
   * @param {string} storeId - Store UUID
   * @param {number} amount - Bonus amount
   * @param {string} reason - Reason for bonus
   * @returns {Promise<CreditTransaction>}
   */
  static async recordBonus(storeId, amount, reason) {
    return this.create({
      store_id: storeId,
      amount: Math.abs(amount),
      transaction_type: 'bonus',
      payment_status: 'completed',
      description: reason || `Bonus credits: ${amount}`
    });
  }

  /**
   * Get transaction history for store
   * @param {string} storeId - Store UUID
   * @param {Object} options - Query options
   * @returns {Promise<CreditTransaction[]>}
   */
  static async getStoreHistory(storeId, options = {}) {
    return this.findAll({
      where: { store_id: storeId },
      order: [['created_at', 'DESC']],
      limit: options.limit || 50,
      offset: options.offset || 0
    });
  }

  /**
   * Get total purchased for store
   * @param {string} storeId - Store UUID
   * @returns {Promise<number>}
   */
  static async getTotalPurchased(storeId) {
    const { data, error } = await masterDbClient
      .from(TABLE_NAME)
      .select('amount')
      .eq('store_id', storeId)
      .eq('transaction_type', 'purchase')
      .eq('payment_status', 'completed');

    if (error) {
      throw new Error(`Failed to get total purchased: ${error.message}`);
    }

    const total = (data || []).reduce((sum, row) => sum + parseFloat(row.amount || 0), 0);
    return total;
  }

  /**
   * Find transaction by payment provider ID
   * @param {string} paymentProviderId - External payment ID
   * @returns {Promise<CreditTransaction|null>}
   */
  static async findByPaymentId(paymentProviderId) {
    return this.findOne({
      where: { payment_provider_id: paymentProviderId }
    });
  }

  /**
   * Get data values (Sequelize compatibility)
   */
  get dataValues() {
    return { ...this };
  }
}

module.exports = CreditTransaction;
