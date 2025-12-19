const BaseJobHandler = require('./BaseJobHandler');
const CategoryMappingService = require('../../services/CategoryMappingService');

/**
 * Background job handler for creating store categories from unmapped external categories
 * Works for both Akeneo and Shopify integrations
 */
class IntegrationCreateCategoriesJob extends BaseJobHandler {
  /**
   * Check if a category belongs to one of the given root categories
   * by traversing the parent chain in the mappings
   */
  isCategoryDescendantOfRoots(categoryCode, rootCodes, allMappings) {
    // Build a map of code -> mapping for quick lookups
    const mappingsByCode = {};
    for (const m of allMappings) {
      mappingsByCode[m.external_category_code] = m;
    }

    // If category code is itself a root, include it
    if (rootCodes.includes(categoryCode)) {
      return true;
    }

    // Traverse parent chain
    let currentCode = categoryCode;
    const visited = new Set();
    const maxDepth = 20;
    let depth = 0;

    while (currentCode && depth < maxDepth) {
      if (visited.has(currentCode)) break; // Circular reference protection
      visited.add(currentCode);

      const mapping = mappingsByCode[currentCode];
      if (!mapping) break;

      const parentCode = mapping.external_parent_code;
      if (!parentCode) {
        // Reached a root - check if it's in our filter list
        return rootCodes.includes(currentCode);
      }

      // Check if parent is one of the roots
      if (rootCodes.includes(parentCode)) {
        return true;
      }

      currentCode = parentCode;
      depth++;
    }

    return false;
  }

  async execute() {
    this.log('Starting create categories from unmapped job');

    const payload = this.getPayload();
    const {
      storeId,
      integrationSource, // 'akeneo' or 'shopify'
      settings = {},
      targetRootCategoryId, // Required: root category to place new categories under
      filters = {} // Optional: filter by external root categories
    } = payload;

    if (!storeId) {
      throw new Error('storeId is required in job payload');
    }

    if (!integrationSource) {
      throw new Error('integrationSource is required in job payload');
    }

    if (!targetRootCategoryId) {
      throw new Error('targetRootCategoryId is required. Please select a root category for imported categories.');
    }

    const stats = {
      total: 0,
      created: 0,
      failed: 0,
      filtered: 0,
      errors: []
    };

    try {
      await this.updateProgress(0, 'Initializing...');

      const mappingService = new CategoryMappingService(storeId, integrationSource);

      // Get all unmapped categories
      await this.updateProgress(5, 'Fetching unmapped categories...');
      const mappings = await mappingService.getMappings();
      let unmapped = mappings.filter(m => !m.internal_category_id);

      // Apply external root category filter if provided
      if (filters.rootCategories && filters.rootCategories.length > 0) {
        this.log(`Filtering to categories under root(s): ${filters.rootCategories.join(', ')}`);
        const beforeCount = unmapped.length;

        unmapped = unmapped.filter(m =>
          this.isCategoryDescendantOfRoots(m.external_category_code, filters.rootCategories, mappings)
        );

        stats.filtered = beforeCount - unmapped.length;
        this.log(`Filtered from ${beforeCount} to ${unmapped.length} categories (${stats.filtered} excluded)`);
      }

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
          const newCategoryId = await mappingService.autoCreateCategory(
            {
              id: mapping.external_category_id,
              code: mapping.external_category_code,
              name: categoryName,
              parent_code: mapping.external_parent_code
            },
            { targetRootCategoryId }
          );

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

      const filterMsg = stats.filtered > 0 ? `, ${stats.filtered} excluded by filter` : '';
      const result = {
        success: true,
        message: `Created ${stats.created} categories, ${stats.failed} failed${filterMsg}`,
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
