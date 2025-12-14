/**
 * MasterUser Model (Master Database)
 *
 * Stores agency/store owner users in master database
 * Uses Supabase REST API via masterDbClient
 */

const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { masterDbClient } = require('../../database/masterConnection');

const TABLE_NAME = 'users';

/**
 * MasterUser - Supabase-based model for master database users
 */
class MasterUser {
  constructor(data = {}) {
    Object.assign(this, data);
  }

  /**
   * Create a new user
   * @param {Object} userData - User data
   * @returns {Promise<MasterUser>}
   */
  static async create(userData) {
    // Hash password if not already hashed
    let password = userData.password;
    if (password && !password.startsWith('$2')) {
      password = await bcrypt.hash(password, 10);
    }

    const now = new Date().toISOString();
    const record = {
      id: userData.id || uuidv4(),
      email: userData.email,
      password: password,
      first_name: userData.first_name,
      last_name: userData.last_name,
      phone: userData.phone || null,
      avatar_url: userData.avatar_url || null,
      is_active: userData.is_active !== undefined ? userData.is_active : true,
      email_verified: userData.email_verified || false,
      email_verification_token: userData.email_verification_token || null,
      password_reset_token: userData.password_reset_token || null,
      password_reset_expires: userData.password_reset_expires || null,
      last_login: userData.last_login || null,
      role: userData.role || 'store_owner',
      account_type: 'agency', // Always agency in master DB
      credits: userData.credits || 0,
      created_at: now,
      updated_at: now
    };

    const { data, error } = await masterDbClient
      .from(TABLE_NAME)
      .insert(record)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create user: ${error.message}`);
    }

    return new MasterUser(data);
  }

  /**
   * Find user by ID
   * @param {string} id - User UUID
   * @returns {Promise<MasterUser|null>}
   */
  static async findByPk(id) {
    const { data, error } = await masterDbClient
      .from(TABLE_NAME)
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to find user: ${error.message}`);
    }

    return data ? new MasterUser(data) : null;
  }

  /**
   * Find one user matching criteria
   * @param {Object} options - Query options with 'where' clause
   * @returns {Promise<MasterUser|null>}
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
      throw new Error(`Failed to find user: ${error.message}`);
    }

    return data ? new MasterUser(data) : null;
  }

  /**
   * Find all users matching criteria
   * @param {Object} options - Query options
   * @returns {Promise<MasterUser[]>}
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
      throw new Error(`Failed to find users: ${error.message}`);
    }

    return (data || []).map(row => new MasterUser(row));
  }

  /**
   * Find user by email
   * @param {string} email
   * @returns {Promise<MasterUser|null>}
   */
  static async findByEmail(email) {
    return this.findOne({ where: { email } });
  }

  /**
   * Find active agency users
   * @returns {Promise<MasterUser[]>}
   */
  static async findActiveAgencies() {
    return this.findAll({
      where: {
        account_type: 'agency',
        is_active: true
      },
      order: [['created_at', 'DESC']]
    });
  }

  /**
   * Update user
   * @param {Object} updates - Fields to update
   * @returns {Promise<MasterUser>}
   */
  async update(updates) {
    // Hash password if being changed and not already hashed
    if (updates.password && !updates.password.startsWith('$2')) {
      updates.password = await bcrypt.hash(updates.password, 10);
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await masterDbClient
      .from(TABLE_NAME)
      .update(updates)
      .eq('id', this.id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update user: ${error.message}`);
    }

    Object.assign(this, data);
    return this;
  }

  /**
   * Save current instance
   * @returns {Promise<MasterUser>}
   */
  async save() {
    const updates = { ...this };
    delete updates.id;
    delete updates.created_at;
    return this.update(updates);
  }

  /**
   * Delete user
   * @returns {Promise<boolean>}
   */
  async destroy() {
    const { error } = await masterDbClient
      .from(TABLE_NAME)
      .delete()
      .eq('id', this.id);

    if (error) {
      throw new Error(`Failed to delete user: ${error.message}`);
    }

    return true;
  }

  /**
   * Compare password with hash
   * @param {string} candidatePassword - Password to check
   * @returns {Promise<boolean>}
   */
  async comparePassword(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
  }

  /**
   * Update last login timestamp
   * @returns {Promise<void>}
   */
  async updateLastLogin() {
    await this.update({ last_login: new Date().toISOString() });
  }

  /**
   * Serialize user for JSON (remove sensitive fields)
   * @returns {Object}
   */
  toJSON() {
    const values = { ...this };
    delete values.password;
    delete values.email_verification_token;
    delete values.password_reset_token;
    delete values.password_reset_expires;
    return values;
  }

  /**
   * Get data values (Sequelize compatibility)
   */
  get dataValues() {
    return { ...this };
  }
}

module.exports = MasterUser;
