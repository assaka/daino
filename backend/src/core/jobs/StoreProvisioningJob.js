const BaseJobHandler = require('./BaseJobHandler');
const { masterDbClient } = require('../../database/masterConnection');
const ConnectionManager = require('../../services/database/ConnectionManager');
const TenantProvisioningService = require('../../services/database/TenantProvisioningService');
const DemoDataProvisioningService = require('../../services/demo-data-provisioning-service');
const masterEmailService = require('../../services/master-email-service');

/**
 * Store Provisioning Job
 * Runs database provisioning in the background, allowing users to close the browser
 * Sends email notification when provisioning completes
 */
class StoreProvisioningJob extends BaseJobHandler {
  constructor(job) {
    super(job);
  }

  async execute() {
    const payload = this.getPayload();
    const {
      storeId,
      userId,
      userEmail,
      storeName,
      storeSlug,
      serviceRoleKey,
      projectUrl,
      projectId,
      oauthAccessToken,
      themePreset,
      provisionDemoData,
      country
    } = payload;

    this.log(`Starting provisioning for store ${storeId} (${storeName})`);
    this.log(`Job payload - userEmail: ${userEmail}, userId: ${userId}, themePreset: ${themePreset}`);

    try {
      // Update provisioning status to tables_creating
      await this.updateProvisioningStatus(storeId, 'tables_creating', {
        step: 'tables',
        message: 'Creating database tables...',
        demo_requested: !!provisionDemoData
      });
      await this.updateProgress(10, 'Creating database tables...');

      // Get tenant database connection
      const tenantDb = await ConnectionManager.getStoreConnection(storeId);
      if (!tenantDb) {
        throw new Error('Failed to get tenant database connection');
      }

      // Get user password hash from master DB for tenant provisioning
      const { data: masterUser, error: userError } = await masterDbClient
        .from('users')
        .select('password, first_name, last_name')
        .eq('id', userId)
        .single();

      if (userError) {
        this.log(`Warning: Could not fetch user details: ${userError.message}`, 'warn');
      }

      // Run tenant provisioning (create tables, seed data)
      await this.updateProgress(20, 'Running database provisioning...');

      const provisioningResult = await TenantProvisioningService.provisionTenantDatabase(
        tenantDb,
        storeId,
        {
          userId: userId,
          userEmail: userEmail,
          passwordHash: masterUser?.password,
          firstName: masterUser?.first_name || 'Store',
          lastName: masterUser?.last_name || 'Owner',
          storeName: storeName,
          storeSlug: storeSlug,
          force: false,
          oauthAccessToken: oauthAccessToken || null,
          projectId: projectId || null,
          autoProvision: true,
          themePreset: themePreset || 'default',
          country: country || null
        }
      );

      if (!provisioningResult.success) {
        throw new Error(provisioningResult.errors?.[0]?.error || 'Database provisioning failed');
      }

      await this.updateProvisioningStatus(storeId, 'seed_completed', {
        step: 'seed_completed',
        message: 'Core data seeded successfully',
        demo_requested: !!provisionDemoData
      });
      await this.updateProgress(60, 'Core data seeded successfully');

      // Provision demo data if requested
      let demoDataResult = null;
      if (provisionDemoData) {
        await this.updateProvisioningStatus(storeId, 'demo_running', {
          step: 'demo_data',
          message: 'Provisioning demo data...',
          demo_requested: true
        });
        await this.updateProgress(70, 'Provisioning demo data...');

        try {
          const demoService = new DemoDataProvisioningService(storeId);
          demoDataResult = await demoService.provisionDemoData();
          this.log('Demo data provisioned successfully');
        } catch (demoError) {
          this.log(`Demo data provisioning failed (non-critical): ${demoError.message}`, 'warn');
          demoDataResult = { success: false, error: demoError.message };
        }
      }

      await this.updateProgress(90, 'Finalizing store setup...');
      this.log('Step: Finalizing store setup');

      // Determine final status based on demo data
      const finalStatus = provisionDemoData ? 'demo' : 'active';
      this.log(`Final status will be: ${finalStatus}`);

      // Update store to active/demo status
      this.log('Updating store status in master DB...');
      const { error: activateError } = await masterDbClient
        .from('stores')
        .update({
          status: finalStatus,
          is_active: true,
          provisioning_status: 'completed',
          provisioning_progress: {
            step: 'completed',
            message: 'Store setup completed successfully!',
            demo_requested: !!provisionDemoData,
            demo_success: demoDataResult?.success ?? null
          },
          provisioning_completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', storeId);

      if (activateError) {
        throw new Error(`Failed to activate store: ${activateError.message}`);
      }
      console.log(`📧 [PROVISIONING] Store ${storeId} updated to ${finalStatus} - now sending email to ${userEmail}`);

      // Send completion email IMMEDIATELY after store update
      if (userEmail) {
        try {
          console.log(`📧 [PROVISIONING] Calling sendProvisioningCompleteEmail for ${userEmail}`);
          const emailResult = await masterEmailService.sendProvisioningCompleteEmail(
            userEmail,
            storeName,
            `${process.env.FRONTEND_URL || 'https://www.dainostore.com'}/admin/dashboard`,
            true
          );
          console.log(`📧 [PROVISIONING] Email result:`, JSON.stringify(emailResult));

          if (emailResult.success) {
            // Mark email as sent
            await masterDbClient
              .from('stores')
              .update({
                provisioning_progress: {
                  step: 'completed',
                  message: 'Store setup completed successfully!',
                  demo_requested: !!provisionDemoData,
                  demo_success: demoDataResult?.success ?? null,
                  email_sent: true,
                  email_sent_at: new Date().toISOString()
                }
              })
              .eq('id', storeId);
            console.log(`📧 [PROVISIONING] Email sent flag saved for store ${storeId}`);
          }
        } catch (emailError) {
          console.error(`📧 [PROVISIONING] Email failed:`, emailError.message);
        }
      } else {
        console.warn(`📧 [PROVISIONING] No userEmail in payload - cannot send email`);
      }

      await this.updateProgress(100, 'Store provisioning completed!');

      await this.updateProgress(100, 'Store provisioning completed!');
      this.log('Step: Job completed successfully, returning result');

      return {
        success: true,
        message: 'Store provisioned successfully',
        storeId,
        status: finalStatus,
        demoData: demoDataResult,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.log(`Provisioning failed: ${error.message}`, 'error');

      // Update store status to failed
      await masterDbClient
        .from('stores')
        .update({
          status: 'pending_database',
          provisioning_status: 'failed',
          provisioning_progress: {
            step: 'error',
            message: 'Provisioning failed',
            error: error.message
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', storeId);

      // Send failure email
      try {
        this.log(`Sending failure notification email to ${userEmail}`);
        if (!userEmail) {
          this.log('WARNING: userEmail is missing - cannot send failure email', 'warn');
        } else {
          const failEmailResult = await masterEmailService.sendProvisioningCompleteEmail(
            userEmail,
            storeName,
            `${process.env.FRONTEND_URL || 'https://www.dainostore.com'}/admin/onboarding?step=3&storeId=${storeId}&resume=true`,
            false
          );
          this.log(`Failure email result: ${JSON.stringify(failEmailResult)}`);
        }
      } catch (emailError) {
        this.log(`Failed to send failure email: ${emailError.message}`, 'warn');
      }

      throw error;
    }
  }

  /**
   * Update provisioning status in master DB
   */
  async updateProvisioningStatus(storeId, status, progress) {
    try {
      await masterDbClient
        .from('stores')
        .update({
          provisioning_status: status,
          provisioning_progress: progress,
          updated_at: new Date().toISOString()
        })
        .eq('id', storeId);
    } catch (error) {
      this.log(`Failed to update provisioning status: ${error.message}`, 'warn');
    }
  }

  /**
   * Get job type identifier
   */
  static getJobType() {
    return 'store:provision';
  }

  /**
   * Get job description for logging
   */
  getDescription() {
    const payload = this.getPayload();
    return `Provision database for store "${payload.storeName || payload.storeId}"`;
  }

  /**
   * Validate job payload
   */
  validatePayload() {
    const payload = this.getPayload();
    const required = ['storeId', 'userId', 'userEmail', 'storeName'];

    for (const field of required) {
      if (!payload[field]) {
        throw new Error(`Missing required payload field: ${field}`);
      }
    }

    return true;
  }
}

module.exports = StoreProvisioningJob;
