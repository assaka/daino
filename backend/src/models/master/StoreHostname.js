/**
 * StoreHostname Model (Master Database)
 *
 * Maps hostnames/domains to stores for fast tenant resolution
 * Uses Supabase REST API via masterDbClient
 */

const { v4: uuidv4 } = require('uuid');
const { masterDbClient } = require('../../database/masterConnection');

const TABLE_NAME = 'store_hostnames';

/**
 * StoreHostname - Supabase-based model for hostname mappings
 */
class StoreHostname {
  constructor(data = {}) {
    Object.assign(this, data);
  }

  /**
   * Create a new hostname mapping
   * @param {Object} data - Hostname data
   * @returns {Promise<StoreHostname>}
   */
  static async create(data) {
    const now = new Date().toISOString();
    const record = {
      id: data.id || uuidv4(),
      store_id: data.store_id,
      hostname: data.hostname?.toLowerCase(),
      slug: data.slug?.toLowerCase(),
      is_primary: data.is_primary !== undefined ? data.is_primary : true,
      is_custom_domain: data.is_custom_domain || false,
      ssl_enabled: data.ssl_enabled !== undefined ? data.ssl_enabled : true,
      created_at: now,
      updated_at: now
    };

    const { data: result, error } = await masterDbClient
      .from(TABLE_NAME)
      .insert(record)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create hostname: ${error.message}`);
    }

    return new StoreHostname(result);
  }

  /**
   * Find hostname by ID
   * @param {string} id - Hostname UUID
   * @returns {Promise<StoreHostname|null>}
   */
  static async findByPk(id) {
    const { data, error } = await masterDbClient
      .from(TABLE_NAME)
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to find hostname: ${error.message}`);
    }

    return data ? new StoreHostname(data) : null;
  }

  /**
   * Find one hostname matching criteria
   * @param {Object} options - Query options with 'where' clause
   * @returns {Promise<StoreHostname|null>}
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
      throw new Error(`Failed to find hostname: ${error.message}`);
    }

    return data ? new StoreHostname(data) : null;
  }

  /**
   * Find all hostnames matching criteria
   * @param {Object} options - Query options
   * @returns {Promise<StoreHostname[]>}
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
      throw new Error(`Failed to find hostnames: ${error.message}`);
    }

    return (data || []).map(row => new StoreHostname(row));
  }

  /**
   * Static update (for bulk updates)
   * @param {Object} updates - Fields to update
   * @param {Object} options - Query options with 'where' clause
   * @returns {Promise<number>}
   */
  static async update(updates, options = {}) {
    updates.updated_at = new Date().toISOString();

    let query = masterDbClient.from(TABLE_NAME).update(updates);

    if (options.where) {
      for (const [key, value] of Object.entries(options.where)) {
        if (typeof value === 'object' && value !== null) {
          // Handle Sequelize Op.ne style
          continue; // Skip complex conditions for now
        }
        query = query.eq(key, value);
      }
    }

    const { data, error } = await query.select();

    if (error) {
      throw new Error(`Failed to update hostnames: ${error.message}`);
    }

    return data?.length || 0;
  }

  /**
   * Find store by hostname
   * @param {string} hostname - Full hostname
   * @returns {Promise<StoreHostname|null>}
   */
  static async findByHostname(hostname) {
    return this.findOne({
      where: { hostname: hostname.toLowerCase() }
    });
  }

  /**
   * Find all hostnames for a store
   * @param {string} storeId - Store UUID
   * @returns {Promise<StoreHostname[]>}
   */
  static async findByStore(storeId) {
    return this.findAll({
      where: { store_id: storeId },
      order: [['is_primary', 'DESC'], ['created_at', 'ASC']]
    });
  }

  /**
   * Find primary hostname for store
   * @param {string} storeId - Store UUID
   * @returns {Promise<StoreHostname|null>}
   */
  static async findPrimaryByStore(storeId) {
    return this.findOne({
      where: {
        store_id: storeId,
        is_primary: true
      }
    });
  }

  /**
   * Create hostname mapping
   * @param {string} storeId - Store UUID
   * @param {string} hostname - Full hostname
   * @param {string} slug - Store slug
   * @param {Object} options - Additional options
   * @returns {Promise<StoreHostname>}
   */
  static async createMapping(storeId, hostname, slug, options = {}) {
    return this.create({
      store_id: storeId,
      hostname: hostname.toLowerCase(),
      slug: slug.toLowerCase(),
      is_primary: options.isPrimary !== undefined ? options.isPrimary : true,
      is_custom_domain: options.isCustomDomain || false,
      ssl_enabled: options.sslEnabled !== undefined ? options.sslEnabled : true
    });
  }

  /**
   * Extract slug from hostname
   * @param {string} hostname - Full hostname
   * @returns {string} Extracted slug
   */
  static extractSlug(hostname) {
    const parts = hostname.split('.');
    if (parts.length >= 2) {
      return parts[0] === 'www' ? parts[1] : parts[0];
    }
    return hostname;
  }

  /**
   * Update hostname
   * @param {Object} updates - Fields to update
   * @returns {Promise<StoreHostname>}
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
      throw new Error(`Failed to update hostname: ${error.message}`);
    }

    Object.assign(this, data);
    return this;
  }

  /**
   * Save current instance
   * @returns {Promise<StoreHostname>}
   */
  async save() {
    const updates = { ...this };
    delete updates.id;
    delete updates.created_at;
    return this.update(updates);
  }

  /**
   * Delete hostname
   * @returns {Promise<boolean>}
   */
  async destroy() {
    const { error } = await masterDbClient
      .from(TABLE_NAME)
      .delete()
      .eq('id', this.id);

    if (error) {
      throw new Error(`Failed to delete hostname: ${error.message}`);
    }

    return true;
  }

  /**
   * Set as primary hostname
   * @returns {Promise<void>}
   */
  async setPrimary() {
    // Unset other primary hostnames for this store
    await masterDbClient
      .from(TABLE_NAME)
      .update({ is_primary: false, updated_at: new Date().toISOString() })
      .eq('store_id', this.store_id)
      .neq('id', this.id);

    await this.update({ is_primary: true });
  }

  /**
   * Enable SSL
   * @returns {Promise<void>}
   */
  async enableSSL() {
    await this.update({ ssl_enabled: true });
  }

  /**
   * Disable SSL
   * @returns {Promise<void>}
   */
  async disableSSL() {
    await this.update({ ssl_enabled: false });
  }

  /**
   * Get data values (Sequelize compatibility)
   */
  get dataValues() {
    return { ...this };
  }
}

module.exports = StoreHostname;
