const BaseJobHandler = require('./BaseJobHandler');
const CategoryMappingService = require('../../services/CategoryMappingService');

/**
 * Background job handler for creating store categories from unmapped external categories
 * Works for both Akeneo and Shopify integrations
 */
class IntegrationCreateCategoriesJob extends BaseJobHandler {
  async execute() {
    this.log('Starting create categories from unmapped job');

    const payload = this.getPayload();
    const {
      storeId,
      integrationSource, // 'akeneo' or 'shopify'
      settings = {}
    } = payload;

    if (!storeId) {
      throw new Error('storeId is required in job payload');
    }

    if (!integrationSource) {
      throw new Error('integrationSource is required in job payload');
    }

    const stats = {
      total: 0,
      created: 0,
      failed: 0,
      errors: []
    };

    try {
      await this.updateProgress(0, 'Initializing...');

      const mappingService = new CategoryMappingService(storeId, integrationSource);

      // Get all unmapped categories
      await this.updateProgress(5, 'Fetching unmapped categories...');
      const mappings = await mappingService.getMappings();
      const unmapped = mappings.filter(m => !m.internal_category_id);

      stats.total = unmapped.length;

      if (unmapped.length === 0) {
        await this.updateProgress(100, 'No unmapped categories to create');
        return {
          success: true,
          message: 'No unmapped categories to create',
          stats
        };
      }

      this.log(`Found ${unmapped.length} unmapped categories to create`);
      await this.updateProgress(10, `Creating ${unmapped.length} categories...`);

      // Process each unmapped category
      for (let i = 0; i < unmapped.length; i++) {
        // Check for cancellation
        await this.checkAbort();

        const mapping = unmapped[i];
        const categoryName = mapping.external_category_name || mapping.external_category_code;

        try {
          const newCategoryId = await mappingService.autoCreateCategory({
            id: mapping.external_category_id,
            code: mapping.external_category_code,
            name: categoryName,
            parent_code: mapping.external_parent_code
          });

          if (newCategoryId) {
            stats.created++;
          } else {
            stats.failed++;
            stats.errors.push({ code: mapping.external_category_code, error: 'Failed to create category' });
          }
        } catch (err) {
          stats.failed++;
          stats.errors.push({ code: mapping.external_category_code, error: err.message });
        }

        // Update progress (10% for setup, 90% for category creation)
        const progress = 10 + Math.round(((i + 1) / unmapped.length) * 90);
        await this.updateProgress(
          progress,
          `Created ${stats.created}/${stats.total} categories (${stats.failed} failed)`
        );
      }

      await this.updateProgress(100, 'Category creation completed');

      const result = {
        success: true,
        message: `Created ${stats.created} categories, ${stats.failed} failed`,
        stats,
        integrationSource
      };

      this.log(`Category creation completed: ${JSON.stringify(stats)}`);
      return result;

    } catch (error) {
      // For cancellation, include partial stats in the error
      const isCancellation = error.message?.includes('cancelled') || error.message?.includes('canceled');
      if (isCancellation) {
        error.partialResult = {
          success: false,
          cancelled: true,
          message: `Category creation cancelled: ${stats.created} created before cancellation`,
          stats,
          integrationSource
        };
      }

      throw error;
    }
  }
}

module.exports = IntegrationCreateCategoriesJob;
