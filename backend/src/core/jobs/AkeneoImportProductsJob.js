const BaseJobHandler = require('./BaseJobHandler');
const AkeneoIntegration = require('../../services/akeneo-integration');
const IntegrationConfig = require('../../models/IntegrationConfig');
const ImportStatistic = require('../../models/ImportStatistic');

/**
 * Background job handler for Akeneo product imports
 */
class AkeneoImportProductsJob extends BaseJobHandler {
  async execute() {
    this.log('Starting Akeneo products import job');

    const payload = this.getPayload();
    const {
      storeId,
      locale = 'en_US',
      dryRun = false,
      filters = {},
      downloadImages = true,
      batchSize = 50,
      customMappings = {}
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

    let akeneoIntegration;
    let importStats = {
      total: 0,
      imported: 0,
      skipped: 0,
      failed: 0,
      errors: []
    };

    try {
      await this.updateProgress(5, 'Initializing Akeneo integration...');

      // Initialize Akeneo integration
      const integrationConfig = await IntegrationConfig.findByStoreAndType(storeId, 'akeneo');
      if (!integrationConfig || !integrationConfig.config_data) {
        throw new Error('Akeneo integration not configured for this store');
      }
      akeneoIntegration = new AkeneoIntegration(integrationConfig.config_data);

      await this.updateProgress(10, 'Testing Akeneo connection...');

      // Test connection
      const connectionTest = await akeneoIntegration.testConnection();
      if (!connectionTest.success) {
        throw new Error(`Akeneo connection failed: ${connectionTest.message}`);
      }

      this.log('Akeneo connection successful');
      await this.updateProgress(15, 'Fetching products from Akeneo...');

      // Get products from Akeneo
      const products = await this.executeWithTimeout(
        () => akeneoIntegration.client.getAllProducts(filters),
        600000 // 10 minutes timeout
      );

      this.log(`Found ${products.length} products in Akeneo`);
      importStats.total = products.length;

      if (products.length === 0) {
        await this.updateProgress(100, 'No products found to import');
        return {
          success: true,
          message: 'No products found to import',
          stats: importStats
        };
      }

      await this.updateProgress(20, `Processing ${products.length} products...`);

      // Process products in batches
      let processedCount = 0;
      const results = await this.batchProcess(
        products,
        async (product, index) => {
          this.checkAbort();
          
          try {
            if (dryRun) {
              this.log(`[DRY RUN] Would import product: ${product.identifier}`, 'debug');
              return { success: true, product: product.identifier, action: 'dry_run' };
            }

            // Transform and import product
            const transformedProduct = await akeneoIntegration.mapping.transformProduct(
              product,
              storeId,
              locale,
              null,
              customMappings,
              { downloadImages }
            );

            const importResult = await akeneoIntegration.importSingleProduct(
              transformedProduct,
              storeId
            );

            if (importResult.success) {
              importStats.imported++;
            } else if (importResult.skipped) {
              importStats.skipped++;
            } else {
              importStats.failed++;
              importStats.errors.push({
                product: product.identifier,
                error: importResult.error
              });
            }

            return importResult;
          } catch (error) {
            importStats.failed++;
            importStats.errors.push({
              product: product.identifier,
              error: error.message
            });
            
            this.log(`Failed to import product ${product.identifier}: ${error.message}`, 'error');
            return { success: false, error: error.message, product: product.identifier };
          }
        },
        batchSize,
        async (processed, total) => {
          // Update progress based on processed items
          const baseProgress = 20;
          const importProgress = Math.floor(((processed / total) * 70)); // 70% for import process
          await this.updateProgress(
            baseProgress + importProgress,
            `Imported ${importStats.imported} of ${processed} processed products`
          );
        }
      );

      await this.updateProgress(95, 'Saving import statistics...');

      // Save import statistics
      await ImportStatistic.saveImportResults(storeId, 'products', {
        totalProcessed: importStats.total,
        successfulImports: importStats.imported,
        failedImports: importStats.failed,
        skippedImports: importStats.skipped,
        errorDetails: importStats.errors.length > 0 ? JSON.stringify(importStats.errors) : null,
        importMethod: 'background_job'
      });

      await this.updateProgress(100, 'Product import completed');

      const finalResult = {
        success: true,
        message: `Import completed: ${importStats.imported} imported, ${importStats.skipped} skipped, ${importStats.failed} failed`,
        stats: importStats,
        dryRun,
        processingDetails: {
          batchSize,
          totalBatches: Math.ceil(products.length / batchSize),
          downloadImages,
          locale,
          filters
        }
      };

      this.log(`Import completed successfully: ${JSON.stringify(finalResult.stats)}`);
      return finalResult;

    } catch (error) {
      // Save partial statistics if available
      if (importStats.total > 0) {
        await ImportStatistic.saveImportResults(storeId, 'products', {
          totalProcessed: importStats.total,
          successfulImports: importStats.imported,
          failedImports: importStats.failed,
          skippedImports: importStats.skipped,
          errorDetails: importStats.errors.length > 0 ? JSON.stringify(importStats.errors) : error.message,
          importMethod: 'background_job'
        });
      }

      throw error;
    }
  }
}

module.exports = AkeneoImportProductsJob;