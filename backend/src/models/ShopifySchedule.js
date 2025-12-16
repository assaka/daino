/**
 * ShopifySchedule Model - UNIFIED VERSION
 *
 * Writes directly to tenant's cron_jobs table instead of separate schedules table.
 * This provides a single source of truth for all scheduled jobs.
 */

const ConnectionManager = require('../services/database/ConnectionManager');
const { v4: uuidv4 } = require('uuid');

/**
 * Convert schedule settings to cron expression
 */
function convertToCronExpression(scheduleType, scheduleTime, scheduleDate) {
  let hour = 0;
  let minute = 0;
  if (scheduleTime) {
    const [h, m] = scheduleTime.split(':').map(Number);
    hour = h || 0;
    minute = m || 0;
  }

  switch (scheduleType) {
    case 'once':
      return `${minute} ${hour} * * *`;

    case 'daily':
      return `${minute} ${hour} * * *`;

    case 'weekly':
      return `${minute} ${hour} * * 1`;

    case 'monthly':
      return `${minute} ${hour} 1 * *`;

    case 'hourly':
      return `${minute} * * * *`;

    default:
      console.warn(`Unknown schedule_type: ${scheduleType}, defaulting to daily`);
      return `${minute} ${hour} * * *`;
  }
}

/**
 * Calculate next run time from cron expression
 */
function calculateNextRun(cronExpression, timezone = 'UTC') {
  try {
    const cronParser = require('cron-parser');
    const interval = cronParser.parseExpression(cronExpression, {
      currentDate: new Date(),
      tz: timezone
    });
    return interval.next().toDate();
  } catch (error) {
    console.warn(`Could not parse cron expression "${cronExpression}": ${error.message}`);
    return new Date(Date.now() + 60 * 60 * 1000);
  }
}

/**
 * Convert cron_jobs record to ShopifySchedule format for API compatibility
 */
function toCronJobToScheduleFormat(cronJob) {
  if (!cronJob) return null;

  const config = cronJob.configuration || {};
  const metadata = cronJob.metadata || {};

  return {
    id: cronJob.id,
    store_id: cronJob.store_id,
    import_type: config.import_type || 'products',
    schedule_type: metadata.schedule_type || 'daily',
    schedule_time: metadata.schedule_time || '00:00',
    schedule_date: metadata.schedule_date || null,
    is_active: cronJob.is_active,
    status: cronJob.is_paused ? 'paused' : (cronJob.is_active ? 'scheduled' : 'inactive'),
    last_run: cronJob.last_run_at,
    next_run: cronJob.next_run_at,
    options: config.options || {},
    last_result: cronJob.last_result,
    created_at: cronJob.created_at,
    updated_at: cronJob.updated_at,
    // Include cron_jobs specific fields for debugging
    _cron_expression: cronJob.cron_expression,
    _job_type: cronJob.job_type,
    _run_count: cronJob.run_count,
    _success_count: cronJob.success_count,
    _failure_count: cronJob.failure_count
  };
}

const ShopifySchedule = {
  tableName: 'cron_jobs',
  sourceType: 'integration',
  sourceName: 'shopify',

  /**
   * Create a new Shopify schedule (stored in cron_jobs)
   */
  async create(scheduleData) {
    const {
      store_id,
      import_type,
      schedule_type,
      schedule_time,
      schedule_date,
      options = {},
      is_active = true
    } = scheduleData;

    const tenantDb = await ConnectionManager.getConnection(store_id);
    const cronExpression = convertToCronExpression(schedule_type, schedule_time, schedule_date);
    const nextRun = calculateNextRun(cronExpression);

    const cronJobData = {
      id: uuidv4(),
      name: `Shopify ${import_type} Import`,
      description: `Scheduled ${import_type} import from Shopify`,
      cron_expression: cronExpression,
      timezone: 'UTC',
      job_type: 'shopify_import',
      configuration: {
        import_type,
        options
      },
      source_type: this.sourceType,
      source_name: this.sourceName,
      handler: 'executeShopifyImport',
      store_id,
      is_active,
      is_paused: false,
      is_system: false,
      next_run_at: nextRun.toISOString(),
      run_count: 0,
      success_count: 0,
      failure_count: 0,
      consecutive_failures: 0,
      max_failures: 5,
      timeout_seconds: 600,
      metadata: {
        schedule_type,
        schedule_time,
        schedule_date: schedule_date || null
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await tenantDb
      .from(this.tableName)
      .insert(cronJobData)
      .select()
      .single();

    if (error) {
      console.error('Error creating Shopify schedule:', error);
      throw new Error(`Failed to create schedule: ${error.message}`);
    }

    console.log(`Created Shopify schedule: ${data.id} (${import_type})`);
    return toCronJobToScheduleFormat(data);
  },

  /**
   * Delete a schedule by id
   */
  async destroy(id, storeId) {
    const tenantDb = await ConnectionManager.getConnection(storeId);

    const { error } = await tenantDb
      .from(this.tableName)
      .delete()
      .eq('id', id)
      .eq('job_type', 'shopify_import');

    if (error) {
      console.error('Error deleting schedule:', error);
      throw new Error(`Failed to delete schedule: ${error.message}`);
    }

    console.log(`Deleted Shopify schedule: ${id}`);
    return true;
  },

  /**
   * Find one schedule by criteria
   */
  async findOne(options) {
    const { where } = options;
    const { store_id, ...otherFilters } = where;

    if (!store_id) {
      throw new Error('store_id is required for findOne');
    }

    const tenantDb = await ConnectionManager.getConnection(store_id);

    let query = tenantDb
      .from(this.tableName)
      .select('*')
      .eq('store_id', store_id)
      .eq('job_type', 'shopify_import');

    Object.keys(otherFilters).forEach(key => {
      if (key === 'id') {
        query = query.eq('id', otherFilters[key]);
      } else if (key === 'is_active') {
        query = query.eq('is_active', otherFilters[key]);
      } else if (key === 'import_type') {
        query = query.eq('configuration->>import_type', otherFilters[key]);
      }
    });

    const { data, error } = await query.maybeSingle();

    if (error) {
      console.error('Error finding schedule:', error);
      return null;
    }

    return toCronJobToScheduleFormat(data);
  },

  /**
   * Find all schedules by criteria
   */
  async findAll(options = {}) {
    const { where = {}, order } = options;
    const { store_id, ...otherFilters } = where;

    if (!store_id) {
      throw new Error('store_id is required for findAll');
    }

    const tenantDb = await ConnectionManager.getConnection(store_id);

    // Query for Shopify schedules - match by job_type
    // This ensures we find all Shopify import schedules
    let query = tenantDb
      .from(this.tableName)
      .select('*')
      .eq('store_id', store_id)
      .eq('job_type', 'shopify_import');

    Object.keys(otherFilters).forEach(key => {
      if (key === 'is_active') {
        query = query.eq('is_active', otherFilters[key]);
      } else if (key === 'import_type') {
        query = query.eq('configuration->>import_type', otherFilters[key]);
      }
    });

    if (order && order.length > 0) {
      const [field, direction] = order[0];
      const orderField = field === 'createdAt' ? 'created_at' : field;
      query = query.order(orderField, { ascending: direction === 'ASC' });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    console.log(`[ShopifySchedule.findAll] Querying for store_id: ${store_id}`);

    const { data, error } = await query;

    if (error) {
      console.error('Error finding schedules:', error);
      return [];
    }

    console.log(`[ShopifySchedule.findAll] Found ${data?.length || 0} schedules`);
    return (data || []).map(toCronJobToScheduleFormat);
  },

  /**
   * Update a schedule
   */
  async update(id, updateData, storeId) {
    const tenantDb = await ConnectionManager.getConnection(storeId);

    // First get the current schedule
    const { data: current, error: fetchError } = await tenantDb
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .eq('job_type', 'shopify_import')
      .single();

    if (fetchError || !current) {
      throw new Error('Schedule not found');
    }

    const updates = {
      updated_at: new Date().toISOString()
    };

    // Handle configuration updates
    if (updateData.import_type || updateData.options) {
      const currentConfig = current.configuration || {};
      updates.configuration = {
        ...currentConfig,
        import_type: updateData.import_type || currentConfig.import_type,
        options: updateData.options || currentConfig.options
      };
    }

    // Handle scheduling fields
    if (updateData.schedule_type || updateData.schedule_time || updateData.schedule_date !== undefined) {
      const metadata = current.metadata || {};
      const scheduleType = updateData.schedule_type || metadata.schedule_type;
      const scheduleTime = updateData.schedule_time || metadata.schedule_time;
      const scheduleDate = updateData.schedule_date !== undefined ? updateData.schedule_date : metadata.schedule_date;

      updates.cron_expression = convertToCronExpression(scheduleType, scheduleTime, scheduleDate);
      updates.next_run_at = calculateNextRun(updates.cron_expression).toISOString();

      updates.metadata = {
        ...metadata,
        schedule_type: scheduleType,
        schedule_time: scheduleTime,
        schedule_date: scheduleDate
      };
    }

    // Handle status fields
    if (updateData.is_active !== undefined) {
      updates.is_active = updateData.is_active;
    }
    if (updateData.status === 'paused') {
      updates.is_paused = true;
    } else if (updateData.status === 'scheduled' || updateData.status === 'active') {
      updates.is_paused = false;
    }

    const { data, error } = await tenantDb
      .from(this.tableName)
      .update(updates)
      .eq('id', id)
      .eq('job_type', 'shopify_import')
      .select()
      .single();

    if (error) {
      console.error('Error updating schedule:', error);
      throw new Error(`Failed to update schedule: ${error.message}`);
    }

    console.log(`Updated Shopify schedule: ${id}`);
    return toCronJobToScheduleFormat(data);
  }
};

module.exports = ShopifySchedule;
