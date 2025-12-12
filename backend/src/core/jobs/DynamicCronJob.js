const BaseJobHandler = require('./BaseJobHandler');
const CronJob = require('../../models/CronJob');
const axios = require('axios');
const { sequelize } = require('../../database/connection');

// Lazy-loaded modules for integration handlers
let _jobManager = null;
let _pluginManager = null;

function getJobManager() {
  if (!_jobManager) {
    _jobManager = require('../BackgroundJobManager');
  }
  return _jobManager;
}

function getPluginManager() {
  if (!_pluginManager) {
    _pluginManager = require('../PluginManager');
  }
  return _pluginManager;
}

/**
 * Dynamic Cron Job Handler
 * Executes user-defined cron jobs stored in the database
 */
class DynamicCronJob extends BaseJobHandler {
  constructor(job) {
    super(job);
    this.cronJobId = job.payload.cronJobId;
  }

  async execute() {
    if (!this.cronJobId) {
      throw new Error('cronJobId is required in job payload');
    }

    // Get the cron job configuration from database
    const cronJob = await CronJob.findByPk(this.cronJobId);
    if (!cronJob) {
      throw new Error(`Cron job not found: ${this.cronJobId}`);
    }

    // Check if job can run
    if (!cronJob.canRun()) {
      console.log(`⏭️ Skipping cron job ${cronJob.name} - cannot run (paused, max runs reached, or too many failures)`);
      return {
        success: true,
        skipped: true,
        reason: 'Job cannot run (paused, max runs reached, or too many failures)'
      };
    }

    console.log(`🔄 Executing dynamic cron job: ${cronJob.name} (${cronJob.job_type})`);

    let execution;
    try {
      // Create execution record
      execution = await cronJob.createExecution({
        status: 'running',
        triggered_by: 'scheduler',
        server_instance: process.env.SERVER_INSTANCE_ID || 'unknown'
      });

      // Execute based on job type
      const result = await this.executeJobType(cronJob);

      // Record successful execution
      await execution.complete('success', result);
      await cronJob.recordExecution('success', result);

      console.log(`✅ Cron job ${cronJob.name} completed successfully`);
      
      return {
        success: true,
        cronJobId: cronJob.id,
        jobName: cronJob.name,
        jobType: cronJob.job_type,
        result,
        executionId: execution.id
      };

    } catch (error) {
      console.error(`❌ Cron job ${cronJob.name} failed:`, error.message);

      // Record failed execution
      if (execution) {
        await execution.complete('failed', null, error);
      }
      await cronJob.recordExecution('failed', null, error);

      throw error;
    }
  }

  /**
   * Execute job based on its type
   */
  async executeJobType(cronJob) {
    const { job_type, configuration, source_type, handler } = cronJob;

    switch (job_type) {
      case 'webhook':
        return await this.executeWebhook(configuration);

      case 'email':
        return await this.executeEmail(configuration);

      case 'database_query':
        return await this.executeDatabaseQuery(configuration);

      case 'api_call':
        return await this.executeApiCall(configuration);

      case 'cleanup':
        return await this.executeCleanup(configuration);

      // New unified scheduler job types
      case 'akeneo_import':
        return await this.executeAkeneoImport(cronJob);

      case 'plugin_job':
        return await this.executePluginJob(cronJob);

      case 'shopify_sync':
        return await this.executeShopifySync(cronJob);

      case 'system_job':
        return await this.executeSystemJob(cronJob);

      case 'token_refresh':
        return await this.executeTokenRefresh(cronJob);

      default:
        throw new Error(`Unsupported job type: ${job_type}`);
    }
  }

  /**
   * Execute Akeneo import job type
   * Delegates to the appropriate Akeneo import job handler
   */
  async executeAkeneoImport(cronJob) {
    const { configuration, store_id } = cronJob;
    const { import_type, akeneo_schedule_id, filters, options } = configuration;

    console.log(`🔄 Executing Akeneo ${import_type} import for store ${store_id}`);

    const jobManager = getJobManager();

    // Map import_type to background job type
    const typeMapping = {
      'categories': 'akeneo:import:categories',
      'products': 'akeneo:import:products',
      'attributes': 'akeneo:import:attributes',
      'families': 'akeneo:import:families',
      'all': 'akeneo:import:all'
    };

    const jobType = typeMapping[import_type] || 'akeneo:import:products';

    // Schedule the actual import job
    const importJob = await jobManager.scheduleJob({
      type: jobType,
      payload: {
        storeId: store_id || configuration.store_id,
        locale: options?.locale || 'en_US',
        dryRun: options?.dryRun || false,
        filters: filters || {},
        downloadImages: options?.downloadImages !== false,
        batchSize: options?.batchSize || 50,
        customMappings: options?.customMappings || {},
        scheduleId: akeneo_schedule_id
      },
      priority: 'normal',
      delay: 0,
      maxRetries: 3,
      storeId: store_id || configuration.store_id,
      userId: null,
      metadata: {
        source: 'unified_cron_scheduler',
        cron_job_id: cronJob.id,
        import_type
      }
    });

    // Handle one-time schedules - deactivate after execution
    if (cronJob.metadata?.schedule_type === 'once') {
      await cronJob.update({ is_active: false });
      console.log(`⏹️ Deactivated one-time Akeneo schedule ${akeneo_schedule_id}`);
    }

    return {
      import_type,
      backgroundJobId: importJob.id,
      storeId: store_id,
      scheduleId: akeneo_schedule_id,
      scheduled: true
    };
  }

  /**
   * Execute plugin job type
   * Supports three modes:
   * 1. plugin_cron_id - fetch handler_code from tenant plugin_cron table (Option B - recommended)
   * 2. handler_code - inline code on cronJob (legacy)
   * 3. handler_method - method on plugin class (legacy/file-based)
   */
  async executePluginJob(cronJob) {
    const { configuration, handler, handler_code, store_id } = cronJob;
    const { plugin_slug, plugin_name, plugin_cron_id, params = {} } = configuration || {};

    console.log(`🔌 Executing plugin job: ${plugin_name || plugin_slug}`);

    // Mode 1: Fetch handler_code from tenant plugin_cron table (Option B - source of truth)
    if (plugin_cron_id && store_id) {
      console.log(`📦 Fetching handler from plugin_cron: ${plugin_cron_id}`);

      const { getTenantConnection } = require('../../database/tenant-connection');
      const tenantDb = await getTenantConnection(store_id);

      const { data: pluginCron, error } = await tenantDb
        .from('plugin_cron')
        .select('*')
        .eq('id', plugin_cron_id)
        .single();

      if (error || !pluginCron) {
        throw new Error(`Plugin cron not found: ${plugin_cron_id}`);
      }

      if (!pluginCron.handler_code) {
        throw new Error(`No handler_code defined for plugin cron: ${plugin_cron_id}`);
      }

      // Execute using the handler_code from plugin_cron
      return await this.executeInlineHandlerCode({
        ...cronJob,
        handler_code: pluginCron.handler_code,
        handler_method: pluginCron.handler_method,
        configuration: {
          ...configuration,
          params: pluginCron.handler_params || params
        }
      });
    }

    // Mode 2: Execute inline handler_code from cronJob (legacy - handler_code on central table)
    if (handler_code) {
      return await this.executeInlineHandlerCode(cronJob);
    }

    // Mode 3: Execute method on plugin class (legacy/file-based)
    const pluginManager = getPluginManager();
    const plugin = pluginManager.getPlugin(plugin_slug);

    if (!plugin) {
      throw new Error(`Plugin not found: ${plugin_slug}`);
    }

    if (!plugin.isEnabled) {
      throw new Error(`Plugin ${plugin_slug} is not enabled`);
    }

    const handlerMethod = handler || configuration.handler;
    if (!handlerMethod) {
      throw new Error(`No handler specified for plugin job`);
    }

    if (typeof plugin[handlerMethod] !== 'function') {
      throw new Error(`Handler method '${handlerMethod}' not found on plugin ${plugin_slug}`);
    }

    const result = await plugin[handlerMethod](params, {
      cronJobId: cronJob.id,
      storeId: cronJob.store_id,
      userId: cronJob.user_id
    });

    return {
      plugin: plugin_slug,
      handler: handlerMethod,
      result
    };
  }

  /**
   * Execute inline handler code from database
   * This enables 100% database-driven cron handlers
   */
  async executeInlineHandlerCode(cronJob) {
    const { handler_code, handler_method, store_id, configuration } = cronJob;
    const { params = {} } = configuration || {};

    console.log(`📝 Executing inline handler code for: ${handler_method || 'anonymous'}`);

    // Get tenant database connection
    const { getTenantConnection } = require('../../database/tenant-connection');
    const db = await getTenantConnection(store_id);

    // Build execution context
    const context = {
      db,
      storeId: store_id,
      cronJobId: cronJob.id,
      params,
      apiBaseUrl: process.env.API_BASE_URL || process.env.BACKEND_URL || 'http://localhost:3001'
    };

    try {
      // Create async function from handler_code
      // Available variables: db, storeId, params, fetch, apiBaseUrl
      const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
      const handlerFn = new AsyncFunction(
        'db', 'storeId', 'params', 'fetch', 'apiBaseUrl', 'console',
        handler_code
      );

      // Execute the handler
      const result = await handlerFn(
        db,
        store_id,
        params,
        fetch,
        context.apiBaseUrl,
        console
      );

      console.log(`✅ Handler completed:`, result);

      return {
        handler: handler_method || 'inline',
        executedAt: new Date().toISOString(),
        result
      };

    } catch (error) {
      console.error(`❌ Handler execution failed:`, error.message);
      throw error;
    }
  }

  /**
   * Execute Shopify sync job type
   */
  async executeShopifySync(cronJob) {
    const { configuration, store_id } = cronJob;
    const { sync_type, direction = 'import' } = configuration;

    console.log(`🛍️ Executing Shopify ${direction} ${sync_type} for store ${store_id}`);

    const jobManager = getJobManager();

    // Map sync_type to background job type
    const typeMapping = {
      'products': direction === 'import' ? 'shopify:import:products' : 'shopify:export:products',
      'collections': direction === 'import' ? 'shopify:import:collections' : 'shopify:export:collections',
      'orders': 'shopify:import:orders',
      'all': 'shopify:import:all'
    };

    const jobType = typeMapping[sync_type];
    if (!jobType) {
      throw new Error(`Unknown Shopify sync type: ${sync_type}`);
    }

    const syncJob = await jobManager.scheduleJob({
      type: jobType,
      payload: {
        storeId: store_id,
        ...configuration.options
      },
      priority: 'normal',
      delay: 0,
      maxRetries: 3,
      storeId: store_id,
      userId: null,
      metadata: {
        source: 'unified_cron_scheduler',
        cron_job_id: cronJob.id,
        sync_type,
        direction
      }
    });

    return {
      sync_type,
      direction,
      backgroundJobId: syncJob.id,
      storeId: store_id,
      scheduled: true
    };
  }

  /**
   * Execute system job type
   * For internal system maintenance jobs
   */
  async executeSystemJob(cronJob) {
    const { configuration, handler } = cronJob;
    const { system_action, params = {} } = configuration;

    console.log(`⚙️ Executing system job: ${system_action || handler}`);

    const jobManager = getJobManager();
    const action = system_action || handler;

    // Map system actions to job types
    const systemJobs = {
      'cleanup': 'system:cleanup',
      'backup': 'system:backup',
      'daily_credit_deduction': 'system:daily_credit_deduction',
      'finalize_pending_orders': 'system:finalize_pending_orders'
    };

    const jobType = systemJobs[action];
    if (!jobType) {
      throw new Error(`Unknown system action: ${action}`);
    }

    const systemJob = await jobManager.scheduleJob({
      type: jobType,
      payload: params,
      priority: 'high',
      delay: 0,
      maxRetries: 1,
      storeId: cronJob.store_id,
      userId: null,
      metadata: {
        source: 'unified_cron_scheduler',
        cron_job_id: cronJob.id,
        system_action: action
      }
    });

    return {
      system_action: action,
      backgroundJobId: systemJob.id,
      scheduled: true
    };
  }

  /**
   * Execute token refresh job type
   * Refreshes OAuth tokens for all stores before they expire
   */
  async executeTokenRefresh(cronJob) {
    const { configuration } = cronJob;
    const { bufferMinutes = 60, batchSize = 10 } = configuration;

    console.log(`🔄 Executing OAuth token refresh job`);

    const jobManager = getJobManager();

    const tokenRefreshJob = await jobManager.scheduleJob({
      type: 'system:token_refresh',
      payload: {
        bufferMinutes,
        batchSize
      },
      priority: 'high',
      delay: 0,
      maxRetries: 2,
      storeId: null,  // System-level job
      userId: null,
      metadata: {
        source: 'unified_cron_scheduler',
        cron_job_id: cronJob.id
      }
    });

    return {
      backgroundJobId: tokenRefreshJob.id,
      bufferMinutes,
      batchSize,
      scheduled: true
    };
  }

  /**
   * Execute webhook job type
   */
  async executeWebhook(config) {
    const { url, method = 'GET', headers = {}, body, timeout = 30 } = config;

    const requestConfig = {
      method: method.toUpperCase(),
      url,
      headers: {
        'User-Agent': 'DainoStore-CronJob/1.0',
        ...headers
      },
      timeout: timeout * 1000
    };

    if (body && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
      requestConfig.data = typeof body === 'string' ? body : JSON.stringify(body);
      requestConfig.headers['Content-Type'] = requestConfig.headers['Content-Type'] || 'application/json';
    }

    const response = await axios(requestConfig);

    return {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      data: response.data,
      responseTime: Date.now() - this.startTime
    };
  }

  /**
   * Execute email job type
   */
  async executeEmail(config) {
    const { to, subject, body, template, variables = {} } = config;

    // This would integrate with your email service
    // For now, we'll just log the email details
    console.log(`📧 Sending email to ${to}: ${subject}`);
    
    // In a real implementation, you would use nodemailer, SendGrid, etc.
    // const emailService = require('../../services/email-service');
    // const result = await emailService.send({ to, subject, body, template, variables });

    return {
      to,
      subject,
      sent: true,
      messageId: 'fake-message-id-' + Date.now()
    };
  }

  /**
   * Execute database query job type
   */
  async executeDatabaseQuery(config) {
    const { query, parameters = {}, operation_type } = config;

    // Validate operation type for security
    const allowedOperations = ['SELECT', 'UPDATE', 'DELETE', 'INSERT'];
    if (!allowedOperations.includes(operation_type.toUpperCase())) {
      throw new Error(`Operation type not allowed: ${operation_type}`);
    }

    // Execute query with parameters
    const [results, metadata] = await sequelize.query(query, {
      replacements: parameters,
      type: sequelize.QueryTypes.RAW
    });

    return {
      operation: operation_type,
      rowsAffected: metadata.rowCount || (Array.isArray(results) ? results.length : 0),
      results: operation_type.toUpperCase() === 'SELECT' ? results : null
    };
  }

  /**
   * Execute API call job type
   */
  async executeApiCall(config) {
    const { endpoint, method = 'GET', payload = {}, headers = {} } = config;

    // Build full URL (assuming internal API)
    const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
    const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}/api${endpoint}`;

    const requestConfig = {
      method: method.toUpperCase(),
      url,
      headers: {
        'Authorization': `Bearer ${process.env.INTERNAL_API_TOKEN || ''}`,
        'User-Agent': 'DainoStore-CronJob/1.0',
        ...headers
      },
      timeout: 30000
    };

    if (payload && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
      requestConfig.data = payload;
      requestConfig.headers['Content-Type'] = 'application/json';
    }

    const response = await axios(requestConfig);

    return {
      status: response.status,
      data: response.data,
      headers: response.headers
    };
  }

  /**
   * Execute cleanup job type
   */
  async executeCleanup(config) {
    const { table, condition, older_than_days, max_records = 1000 } = config;

    // Validate table name for security (whitelist approach)
    const allowedTables = [
      'job_executions', 'cron_job_executions', 'logs', 
      'sessions', 'password_reset_tokens', 'email_verification_tokens'
    ];
    
    if (!allowedTables.includes(table)) {
      throw new Error(`Table not allowed for cleanup: ${table}`);
    }

    // Build cleanup query
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - older_than_days);

    let query = `DELETE FROM ${table} WHERE created_at < :cutoffDate`;
    const replacements = { cutoffDate };

    if (condition) {
      query += ` AND ${condition}`;
    }

    query += ` LIMIT ${max_records}`;

    const [results, metadata] = await sequelize.query(query, {
      replacements,
      type: sequelize.QueryTypes.DELETE
    });

    return {
      table,
      recordsDeleted: metadata.rowCount || 0,
      cutoffDate,
      condition
    };
  }

  /**
   * Get job type identifier
   */
  static getJobType() {
    return 'system:dynamic_cron';
  }

  /**
   * Get job description for logging
   */
  getDescription() {
    return `Dynamic cron job execution (ID: ${this.cronJobId})`;
  }

  /**
   * Validate job payload
   */
  validatePayload() {
    if (!this.job.payload.cronJobId) {
      throw new Error('cronJobId is required in job payload');
    }
    return true;
  }
}

module.exports = DynamicCronJob;