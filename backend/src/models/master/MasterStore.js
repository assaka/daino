/**
 * MasterStore Model (Master Database)
 *
 * Minimal store registry in master database
 * Uses Supabase REST API via masterDbClient
 */

const { v4: uuidv4 } = require('uuid');
const { masterDbClient } = require('../../database/masterConnection');

const TABLE_NAME = 'stores';

/**
 * MasterStore - Supabase-based model for master database stores
 */
class MasterStore {
  constructor(data = {}) {
    Object.assign(this, data);
  }

  /**
   * Create a new store
   * @param {Object} storeData - Store data
   * @returns {Promise<MasterStore>}
   */
  static async create(storeData) {
    const now = new Date().toISOString();
    const record = {
      id: storeData.id || uuidv4(),
      user_id: storeData.user_id,
      slug: storeData.slug,
      status: storeData.status || 'pending_database',
      is_active: storeData.is_active !== undefined ? storeData.is_active : false,
      theme_preset: storeData.theme_preset || 'default',
      created_at: now,
      updated_at: now
    };

    const { data, error } = await masterDbClient
      .from(TABLE_NAME)
      .insert(record)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create store: ${error.message}`);
    }

    return new MasterStore(data);
  }

  /**
   * Find store by ID
   * @param {string} id - Store UUID
   * @returns {Promise<MasterStore|null>}
   */
  static async findByPk(id) {
    const { data, error } = await masterDbClient
      .from(TABLE_NAME)
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to find store: ${error.message}`);
    }

    return data ? new MasterStore(data) : null;
  }

  /**
   * Find one store matching criteria
   * @param {Object} options - Query options with 'where' clause
   * @returns {Promise<MasterStore|null>}
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
      throw new Error(`Failed to find store: ${error.message}`);
    }

    return data ? new MasterStore(data) : null;
  }

  /**
   * Find all stores matching criteria
   * @param {Object} options - Query options
   * @returns {Promise<MasterStore[]>}
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

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to find stores: ${error.message}`);
    }

    return (data || []).map(row => new MasterStore(row));
  }

  /**
   * Count stores matching criteria
   * @param {Object} options - Query options with 'where' clause
   * @returns {Promise<number>}
   */
  static async count(options = {}) {
    let query = masterDbClient.from(TABLE_NAME).select('*', { count: 'exact', head: true });

    if (options.where) {
      for (const [key, value] of Object.entries(options.where)) {
        query = query.eq(key, value);
      }
    }

    const { count, error } = await query;

    if (error) {
      throw new Error(`Failed to count stores: ${error.message}`);
    }

    return count || 0;
  }

  /**
   * Find all stores by user
   * @param {string} userId - User UUID
   * @returns {Promise<MasterStore[]>}
   */
  static async findByUser(userId) {
    return this.findAll({
      where: { user_id: userId },
      order: [['created_at', 'DESC']]
    });
  }

  /**
   * Find active stores
   * @returns {Promise<MasterStore[]>}
   */
  static async findActiveStores() {
    return this.findAll({
      where: {
        status: 'active',
        is_active: true
      },
      order: [['created_at', 'DESC']]
    });
  }

  /**
   * Find stores by status
   * @param {string} status - Store status
   * @returns {Promise<MasterStore[]>}
   */
  static async findByStatus(status) {
    return this.findAll({
      where: { status },
      order: [['updated_at', 'DESC']]
    });
  }

  /**
   * Count stores by user
   * @param {string} userId - User UUID
   * @returns {Promise<number>}
   */
  static async countByUser(userId) {
    return this.count({ where: { user_id: userId } });
  }

  /**
   * Update store
   * @param {Object} updates - Fields to update
   * @returns {Promise<MasterStore>}
   */
  async update(updates) {
    updates.updated_at = new Date().toISOString();

    const { data, error } = await masterDbClient
      .from(TABLE_NAME)
      .update(updates)
      .eq('id', this.id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update store: ${error.message}`);
    }

    Object.assign(this, data);
    return this;
  }

  /**
   * Save current instance
   * @returns {Promise<MasterStore>}
   */
  async save() {
    const updates = { ...this };
    delete updates.id;
    delete updates.created_at;
    return this.update(updates);
  }

  /**
   * Delete store
   * @returns {Promise<boolean>}
   */
  async destroy() {
    const { error } = await masterDbClient
      .from(TABLE_NAME)
      .delete()
      .eq('id', this.id);

    if (error) {
      throw new Error(`Failed to delete store: ${error.message}`);
    }

    return true;
  }

  /**
   * Activate store
   * @returns {Promise<void>}
   */
  async activate() {
    await this.update({
      status: 'active',
      is_active: true
    });
  }

  /**
   * Suspend store
   * @param {string} reason - Reason for suspension
   * @returns {Promise<void>}
   */
  async suspend(reason) {
    await this.update({
      status: 'suspended',
      is_active: false
    });
  }

  /**
   * Check if store is operational
   * @returns {boolean}
   */
  isOperational() {
    return this.status === 'active' && this.is_active === true;
  }

  /**
   * Start provisioning
   * @returns {Promise<void>}
   */
  async startProvisioning() {
    await this.update({ status: 'provisioning' });
  }

  /**
   * Complete provisioning and activate
   * @returns {Promise<void>}
   */
  async completeProvisioning() {
    await this.update({
      status: 'active',
      is_active: true
    });
  }

  /**
   * Get data values (Sequelize compatibility)
   */
  get dataValues() {
    return { ...this };
  }
}

module.exports = MasterStore;
