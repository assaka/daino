/**
 * AkeneoSchedule Model - UNIFIED VERSION
 *
 * Writes directly to tenant's cron_jobs table instead of master's akeneo_schedules.
 * This eliminates the need for sync and provides a single source of truth.
 *
 * The model provides backward-compatible API while storing data in cron_jobs.
 */

const ConnectionManager = require('../services/database/ConnectionManager');
const { v4: uuidv4 } = require('uuid');

/**
 * Convert Akeneo schedule settings to cron expression
 */
function convertToCronExpression(scheduleType, scheduleTime, scheduleDate) {
  // Parse time (format: "HH:MM")
  let hour = 0;
  let minute = 0;
  if (scheduleTime) {
    const [h, m] = scheduleTime.split(':').map(Number);
    hour = h || 0;
    minute = m || 0;
  }

  switch (scheduleType) {
    case 'once':
      // One-time: run at specific time (will be deactivated after run)
      return `${minute} ${hour} * * *`;

    case 'daily':
      return `${minute} ${hour} * * *`;

    case 'weekly':
      // Default to Monday
      return `${minute} ${hour} * * 1`;

    case 'monthly':
      // Default to 1st of month
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
    // Fallback: 1 hour from now
    console.warn(`Could not parse cron expression "${cronExpression}": ${error.message}`);
    return new Date(Date.now() + 60 * 60 * 1000);
  }
}

/**
 * Convert cron_jobs record to AkeneoSchedule format for API compatibility
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
    filters: config.filters || {},
    options: config.options || {},
    last_result: cronJob.last_result,
    credit_cost: config.credit_cost || 0.1,
    last_credit_usage: config.last_credit_usage || null,
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

const AkeneoSchedule = {
  tableName: 'cron_jobs',
  sourceType: 'integration',
  sourceName: 'akeneo',

  /**
   * Create a new Akeneo schedule (stored in cron_jobs)
   */
  async create(scheduleData) {
    const {
      store_id,
      import_type,
      schedule_type,
      schedule_time,
      schedule_date,
      filters = {},
      options = {},
      is_active = true,
      credit_cost = 0.1
    } = scheduleData;

    const tenantDb = await ConnectionManager.getConnection(store_id);
    const cronExpression = convertToCronExpression(schedule_type, schedule_time, schedule_date);
    const nextRun = calculateNextRun(cronExpression);

    const cronJobData = {
      id: uuidv4(),
      name: `Akeneo ${import_type} Import`,
      description: `Scheduled ${import_type} import from Akeneo PIM`,
      cron_expression: cronExpression,
      timezone: 'UTC',
      job_type: 'akeneo_import',
      configuration: {
        import_type,
        filters,
        options,
        credit_cost,
        last_credit_usage: null
      },
      source_type: this.sourceType,
      source_name: this.sourceName,
      handler: 'executeAkeneoImport',
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
        schedule_date: schedule_date || null,
        credit_cost
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
      console.error('Error creating Akeneo schedule:', error);
      throw new Error(`Failed to create schedule: ${error.message}`);
    }

    console.log(`Created Akeneo schedule: ${data.id} (${import_type})`);
    return toCronJobToScheduleFormat(data);
  },

  /**
   * Delete a schedule by id
   */
  async destroy(id) {
    // We need to find the schedule first to get the store_id for tenant connection
    const schedule = await this.findByPk(id);
    if (!schedule) {
      throw new Error('Schedule not found');
    }

    const tenantDb = await ConnectionManager.getConnection(schedule.store_id);

    const { error } = await tenantDb
      .from(this.tableName)
      .delete()
      .eq('id', id)
      .eq('source_type', this.sourceType)
      .eq('source_name', this.sourceName);

    if (error) {
      console.error('Error deleting schedule:', error);
      throw new Error(`Failed to delete schedule: ${error.message}`);
    }

    console.log(`Deleted Akeneo schedule: ${id}`);
    return true;
  },

  /**
   * Find schedule by primary key
   * Note: This searches across all tenants - use findOne with store_id for efficiency
   */
  async findByPk(id) {
    // Try to find in any tenant - this is inefficient but maintains compatibility
    // In practice, routes should pass store_id to use findOne instead
    const { masterDbClient } = require('../database/masterConnection');

    // Get all active stores
    const { data: stores } = await masterDbClient
      .from('stores')
      .select('id')
      .eq('is_active', true);

    for (const store of stores || []) {
      try {
        const tenantDb = await ConnectionManager.getConnection(store.id);
        const { data, error } = await tenantDb
          .from(this.tableName)
          .select('*')
          .eq('id', id)
          .eq('source_type', this.sourceType)
          .eq('source_name', this.sourceName)
          .maybeSingle();

        if (data && !error) {
          return toCronJobToScheduleFormat(data);
        }
      } catch (err) {
        // Continue to next tenant
      }
    }

    return null;
  },

  /**
   * Find one schedule by criteria (preferred method)
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
      .eq('source_type', this.sourceType)
      .eq('source_name', this.sourceName)
      .eq('store_id', store_id);

    // Apply other filters
    Object.keys(otherFilters).forEach(key => {
      if (key === 'id') {
        query = query.eq('id', otherFilters[key]);
      } else if (key === 'is_active') {
        query = query.eq('is_active', otherFilters[key]);
      } else if (key === 'import_type') {
        // Filter by configuration->import_type
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

    let query = tenantDb
      .from(this.tableName)
      .select('*')
      .eq('source_type', this.sourceType)
      .eq('source_name', this.sourceName)
      .eq('store_id', store_id);

    // Apply other filters
    Object.keys(otherFilters).forEach(key => {
      if (key === 'is_active') {
        query = query.eq('is_active', otherFilters[key]);
      } else if (key === 'import_type') {
        query = query.eq('configuration->>import_type', otherFilters[key]);
      }
    });

    // Apply ordering
    if (order && order.length > 0) {
      const [field, direction] = order[0];
      const orderField = field === 'createdAt' ? 'created_at' : field;
      query = query.order(orderField, { ascending: direction === 'ASC' });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error finding schedules:', error);
      return [];
    }

    return (data || []).map(toCronJobToScheduleFormat);
  },

  /**
   * Update a schedule
   */
  async update(id, updateData) {
    const schedule = await this.findByPk(id);
    if (!schedule) {
      throw new Error('Schedule not found');
    }

    const tenantDb = await ConnectionManager.getConnection(schedule.store_id);

    // Build the update object
    const updates = {
      updated_at: new Date().toISOString()
    };

    // Handle schedule-specific fields
    if (updateData.import_type || updateData.filters || updateData.options || updateData.credit_cost !== undefined) {
      const currentConfig = schedule._configuration || {};
      updates.configuration = {
        ...currentConfig,
        import_type: updateData.import_type || schedule.import_type,
        filters: updateData.filters || schedule.filters,
        options: updateData.options || schedule.options,
        credit_cost: updateData.credit_cost !== undefined ? updateData.credit_cost : schedule.credit_cost
      };
    }

    // Handle scheduling fields
    if (updateData.schedule_type || updateData.schedule_time || updateData.schedule_date !== undefined) {
      const scheduleType = updateData.schedule_type || schedule.schedule_type;
      const scheduleTime = updateData.schedule_time || schedule.schedule_time;
      const scheduleDate = updateData.schedule_date !== undefined ? updateData.schedule_date : schedule.schedule_date;

      updates.cron_expression = convertToCronExpression(scheduleType, scheduleTime, scheduleDate);
      updates.next_run_at = calculateNextRun(updates.cron_expression).toISOString();

      // Update metadata
      updates.metadata = {
        ...(schedule._metadata || {}),
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

    // Handle last_run update
    if (updateData.last_run) {
      updates.last_run_at = updateData.last_run;
    }
    if (updateData.last_result) {
      updates.last_result = updateData.last_result;
    }

    const { data, error } = await tenantDb
      .from(this.tableName)
      .update(updates)
      .eq('id', id)
      .eq('source_type', this.sourceType)
      .eq('source_name', this.sourceName)
      .select()
      .single();

    if (error) {
      console.error('Error updating schedule:', error);
      throw new Error(`Failed to update schedule: ${error.message}`);
    }

    console.log(`Updated Akeneo schedule: ${id}`);
    return toCronJobToScheduleFormat(data);
  },

  /**
   * Check if user has enough credits to run schedule
   */
  async checkCreditsBeforeExecution(schedule, userId) {
    const CreditService = require('../services/credit-service');
    const requiredCredits = parseFloat(schedule.credit_cost) || 0.1;
    return await CreditService.hasEnoughCredits(userId, schedule.store_id, requiredCredits);
  },

  /**
   * Deduct credits for schedule execution
   */
  async deductCreditsForExecution(schedule, userId) {
    const CreditService = require('../services/credit-service');
    const requiredCredits = parseFloat(schedule.credit_cost) || 0.1;

    try {
      const result = await CreditService.deduct(
        userId,
        schedule.store_id,
        requiredCredits,
        `Akeneo scheduled ${schedule.import_type} import`,
        {
          import_type: schedule.import_type,
          schedule_type: schedule.schedule_type,
          filters: schedule.filters,
          options: schedule.options
        },
        schedule.id,
        'akeneo_schedule'
      );

      // Update the schedule with the credit usage reference
      const tenantDb = await ConnectionManager.getConnection(schedule.store_id);
      await tenantDb
        .from(this.tableName)
        .update({
          configuration: {
            ...schedule.configuration,
            last_credit_usage: result.usage_id
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', schedule.id);

      return {
        success: true,
        usage_id: result.usage_id,
        credits_deducted: requiredCredits
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Get schedules that need credits
   */
  async getSchedulesNeedingCredits(userId, storeId) {
    const CreditService = require('../services/credit-service');
    const currentBalance = await CreditService.getBalance(userId, storeId);

    // Get active schedules for the store
    const activeSchedules = await this.findAll({
      where: {
        store_id: storeId,
        is_active: true
      }
    });

    // Filter schedules that can't run due to insufficient credits
    const schedulesNeedingCredits = activeSchedules.filter(schedule => {
      const requiredCredits = parseFloat(schedule.credit_cost) || 0.1;
      return currentBalance < requiredCredits;
    });

    return {
      current_balance: currentBalance,
      active_schedules: activeSchedules.length,
      schedules_needing_credits: schedulesNeedingCredits.length,
      schedules: schedulesNeedingCredits
    };
  },

  /**
   * Count schedules (for backward compatibility)
   */
  async count(options = {}) {
    const { where = {} } = options;
    const { store_id } = where;

    if (!store_id) {
      // Count across all tenants - expensive operation
      const { masterDbClient } = require('../database/masterConnection');
      const { data: stores } = await masterDbClient
        .from('stores')
        .select('id')
        .eq('is_active', true);

      let total = 0;
      for (const store of stores || []) {
        try {
          const tenantDb = await ConnectionManager.getConnection(store.id);
          const { count } = await tenantDb
            .from(this.tableName)
            .select('*', { count: 'exact', head: true })
            .eq('source_type', this.sourceType)
            .eq('source_name', this.sourceName);
          total += count || 0;
        } catch (err) {
          // Continue
        }
      }
      return total;
    }

    const tenantDb = await ConnectionManager.getConnection(store_id);
    let query = tenantDb
      .from(this.tableName)
      .select('*', { count: 'exact', head: true })
      .eq('source_type', this.sourceType)
      .eq('source_name', this.sourceName)
      .eq('store_id', store_id);

    if (where.is_active !== undefined) {
      query = query.eq('is_active', where.is_active);
    }

    const { count, error } = await query;

    if (error) {
      console.error('Error counting schedules:', error);
      return 0;
    }

    return count || 0;
  }
};

module.exports = AkeneoSchedule;
