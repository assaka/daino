const BaseJobHandler = require('./BaseJobHandler');
const AkeneoIntegration = require('../../services/akeneo-integration');
const IntegrationConfig = require('../../models/IntegrationConfig');

/**
 * Background job handler for complete Akeneo imports (all data types)
 */
class AkeneoImportAllJob extends BaseJobHandler {
  async execute() {
    this.log('Starting complete Akeneo import job');

    const payload = this.getPayload();
    const {
      storeId,
      locale = 'en_US',
      dryRun = false,
      filters = {},
      downloadImages = true,
      customMappings = {},
      importOrder = ['attributes', 'families', 'categories', 'products']
    } = payload;

    if (!storeId) {
      throw new Error('storeId is required in job payload');
    }

    // Validate dependencies
    await this.validateDependencies([
      {
        name: 'Akeneo Integration Config',
        check: async () => {
          const config = await IntegrationConfig.findByStoreAndType(storeId, 'akeneo');
          return !!config;
        },
        message: 'Akeneo integration not configured for this store'
      }
    ]);

    const jobManager = require('../BackgroundJobManager');
    const results = {};
    let overallSuccess = true;

    try {
      await this.updateProgress(5, 'Planning complete import sequence...');

      // Schedule individual import jobs in sequence
      let progressIncrement = 90 / importOrder.length;
      let currentProgress = 10;

      for (const importType of importOrder) {
        await this.checkAbort();
        
        await this.updateProgress(currentProgress, `Starting ${importType} import...`);

        try {
          // Create appropriate job type
          const jobType = `akeneo:import:${importType}`;
          const subJobPayload = {
            storeId,
            locale,
            dryRun,
            filters,
            ...(importType === 'products' ? { downloadImages, customMappings } : {})
          };

          // Schedule and wait for the sub-job
          const subJob = await jobManager.scheduleJob({
            type: jobType,
            payload: subJobPayload,
            priority: 'high',
            storeId,
            userId: this.job.user_id,
            metadata: {
              parent_job_id: this.job.id,
              import_sequence: importOrder.indexOf(importType) + 1,
              total_imports: importOrder.length
            }
          });

          // Wait for the sub-job to complete (simplified polling)
          const subResult = await this.waitForJobCompletion(subJob);
          results[importType] = subResult;

          if (!subResult.success) {
            overallSuccess = false;
            this.log(`${importType} import failed: ${subResult.message}`, 'error');
          } else {
            this.log(`${importType} import completed successfully`);
          }

        } catch (error) {
          overallSuccess = false;
          results[importType] = {
            success: false,
            error: error.message
          };
          this.log(`${importType} import failed: ${error.message}`, 'error');
        }

        currentProgress += progressIncrement;
        await this.updateProgress(currentProgress, `${importType} import completed`);
      }

      await this.updateProgress(100, 'Complete import finished');

      const finalResult = {
        success: overallSuccess,
        message: overallSuccess ? 
          'All imports completed successfully' : 
          'Some imports failed - check individual results',
        results,
        importOrder,
        dryRun,
        locale
      };

      this.log(`Complete import finished: ${JSON.stringify({
        success: overallSuccess,
        resultsKeys: Object.keys(results)
      })}`);

      return finalResult;

    } catch (error) {
      this.log(`Complete import failed: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Wait for a sub-job to complete (simplified implementation)
   */
  async waitForJobCompletion(job, timeoutMs = 1800000) { // 30 minutes
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      await job.reload();
      
      if (job.status === 'completed') {
        return {
          success: true,
          result: job.result,
          message: 'Job completed successfully'
        };
      } else if (job.status === 'failed') {
        return {
          success: false,
          error: job.last_error,
          message: 'Job failed'
        };
      } else if (job.status === 'cancelled') {
        return {
          success: false,
          message: 'Job was cancelled'
        };
      }

      // Wait before checking again
      await new Promise(resolve => setTimeout(resolve, 5000)); // 5 seconds
    }

    throw new Error(`Sub-job ${job.id} timed out after ${timeoutMs}ms`);
  }
}

module.exports = AkeneoImportAllJob;