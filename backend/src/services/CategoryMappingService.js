/**
 * CategoryMappingService - Maps external platform categories to DainoStore categories
 *
 * Supports: Akeneo, Shopify, and other integrations
 *
 * Matching priority:
 * 1. Explicit mapping in integration_category_mappings table
 * 2. Auto-match by exact slug
 * 3. Auto-match by exact name (case-insensitive)
 * 4. Auto-match by parent path + name
 * 5. Leave unmapped for user review
 */

const ConnectionManager = require('./database/ConnectionManager');

class CategoryMappingService {
  constructor(storeId, integrationSource) {
    this.storeId = storeId;
    this.integrationSource = integrationSource; // 'akeneo', 'shopify', etc.
  }

  /**
   * Get all category mappings for this store/integration
   * Note: category names come from category_translations table, not categories
   */
  async getMappings() {
    const tenantDb = await ConnectionManager.getStoreConnection(this.storeId);

    // Fetch mappings without join (FK may not exist)
    const { data: mappings, error } = await tenantDb
      .from('integration_category_mappings')
      .select('*')
      .eq('store_id', this.storeId)
      .eq('integration_source', this.integrationSource)
      .order('external_category_name', { ascending: true });

    if (error) {
      console.error('Error fetching category mappings:', error);
      throw error;
    }

    if (!mappings || mappings.length === 0) {
      return [];
    }

    // Get mapped category IDs
    const categoryIds = mappings
      .filter(m => m.internal_category_id)
      .map(m => m.internal_category_id);

    // Fetch categories separately if there are any mapped
    let categoriesMap = {};
    if (categoryIds.length > 0) {
      const { data: categories } = await tenantDb
        .from('categories')
        .select('id, slug, parent_id')
        .in('id', categoryIds);

      // Fetch translations for category names
      const { data: translations } = await tenantDb
        .from('category_translations')
        .select('category_id, name')
        .in('category_id', categoryIds)
        .eq('language_code', 'en');

      // Build translations map
      const translationsMap = {};
      if (translations) {
        for (const t of translations) {
          translationsMap[t.category_id] = t.name;
        }
      }

      if (categories) {
        for (const cat of categories) {
          categoriesMap[cat.id] = {
            ...cat,
            name: translationsMap[cat.id] || cat.slug
          };
        }
      }
    }

    // Attach category info to mappings and clear orphaned references
    const orphanedMappingIds = [];
    const result = mappings.map(m => {
      // Check if internal category exists
      const categoryExists = m.internal_category_id && categoriesMap[m.internal_category_id];

      // Track orphaned mappings (have internal_category_id but category doesn't exist)
      if (m.internal_category_id && !categoryExists) {
        orphanedMappingIds.push(m.id);
      }

      return {
        ...m,
        // Clear internal_category_id if category doesn't exist
        internal_category_id: categoryExists ? m.internal_category_id : null,
        internal_category: categoryExists ? categoriesMap[m.internal_category_id] : null
      };
    });

    // Clear orphaned internal_category_id references in database (async, don't wait)
    if (orphanedMappingIds.length > 0) {
      tenantDb
        .from('integration_category_mappings')
        .update({ internal_category_id: null, mapping_type: 'manual' })
        .in('id', orphanedMappingIds)
        .then(({ error }) => {
          if (error) {
            console.error('Error clearing orphaned references:', error.message);
          }
        });
    }

    return result;
  }

  /**
   * Get unmapped external categories
   */
  async getUnmappedCategories() {
    const mappings = await this.getMappings();
    return mappings.filter(m => !m.internal_category_id);
  }

  /**
   * Get all store categories for mapping dropdown
   */
  async getStoreCategories() {
    const tenantDb = await ConnectionManager.getStoreConnection(this.storeId);

    const { data: categories, error } = await tenantDb
      .from('categories')
      .select('id, slug, parent_id, level, path')
      .eq('store_id', this.storeId)
      .eq('is_active', true)
      .order('path', { ascending: true });

    if (error) {
      console.error('Error fetching store categories:', error);
      throw error;
    }

    if (!categories || categories.length === 0) {
      return [];
    }

    // Fetch translations for category names
    const categoryIds = categories.map(c => c.id);
    const { data: translations } = await tenantDb
      .from('category_translations')
      .select('category_id, name')
      .in('category_id', categoryIds)
      .eq('language_code', 'en');

    // Build translations map
    const translationsMap = {};
    if (translations) {
      for (const t of translations) {
        translationsMap[t.category_id] = t.name;
      }
    }

    // Attach names to categories
    return categories.map(cat => ({
      ...cat,
      name: translationsMap[cat.id] || cat.slug
    }));
  }

  /**
   * Find or create mapping for an external category
   * Returns the internal category ID if mapped, null if unmapped
   */
  async resolveCategory(externalCategory) {
    const {
      id: externalId,
      code: externalCode,
      name: externalName,
      parent_code: externalParentCode
    } = externalCategory;

    const tenantDb = await ConnectionManager.getStoreConnection(this.storeId);

    // 1. Check for explicit mapping - handle null values properly
    let query = tenantDb
      .from('integration_category_mappings')
      .select('internal_category_id')
      .eq('store_id', this.storeId)
      .eq('integration_source', this.integrationSource)
      .eq('is_active', true);

    // Build OR filter only for non-null values
    const orConditions = [];
    if (externalId) {
      orConditions.push(`external_category_id.eq.${externalId}`);
    }
    if (externalCode) {
      orConditions.push(`external_category_code.eq.${externalCode}`);
    }

    let existingMapping = null;
    if (orConditions.length > 0) {
      const { data } = await query
        .or(orConditions.join(','))
        .maybeSingle();
      existingMapping = data;
    }

    if (existingMapping?.internal_category_id) {
      return existingMapping.internal_category_id;
    }

    // 2. Try auto-matching
    const autoMatch = await this.findAutoMatch(externalCategory);

    // 3. Create or update mapping record
    await this.upsertMapping({
      external_category_id: externalId,
      external_category_code: externalCode,
      external_category_name: externalName,
      external_parent_code: externalParentCode,
      internal_category_id: autoMatch?.categoryId || null,
      mapping_type: autoMatch ? 'auto' : 'manual',
      confidence_score: autoMatch?.confidence || null
    });

    return autoMatch?.categoryId || null;
  }

  /**
   * Try to auto-match an external category to an internal one
   */
  async findAutoMatch(externalCategory) {
    const { code, name, slug } = externalCategory;
    const tenantDb = await ConnectionManager.getStoreConnection(this.storeId);

    // Get all store categories
    const { data: categories } = await tenantDb
      .from('categories')
      .select('id, slug, parent_id')
      .eq('store_id', this.storeId)
      .eq('is_active', true);

    if (!categories || categories.length === 0) {
      return null;
    }

    // Fetch translations for category names
    const categoryIds = categories.map(c => c.id);
    const { data: translations } = await tenantDb
      .from('category_translations')
      .select('category_id, name')
      .in('category_id', categoryIds)
      .eq('language_code', 'en');

    // Build translations map and add names to categories
    const translationsMap = {};
    if (translations) {
      for (const t of translations) {
        translationsMap[t.category_id] = t.name;
      }
    }

    const storeCategories = categories.map(cat => ({
      ...cat,
      name: translationsMap[cat.id] || cat.slug
    }));

    // Normalize for comparison
    const normalizedCode = (code || '').toLowerCase().replace(/[-_]/g, '');
    const normalizedName = (name || '').toLowerCase().trim();
    const normalizedSlug = (slug || code || '').toLowerCase().replace(/[-_]/g, '');

    // Priority 1: Exact slug match (highest confidence)
    for (const cat of storeCategories) {
      const catSlug = (cat.slug || '').toLowerCase().replace(/[-_]/g, '');
      if (catSlug && catSlug === normalizedSlug) {
        return { categoryId: cat.id, confidence: 1.0, matchType: 'slug' };
      }
    }

    // Priority 2: Exact name match (case-insensitive)
    for (const cat of storeCategories) {
      const catName = (cat.name || '').toLowerCase().trim();
      if (catName && catName === normalizedName) {
        return { categoryId: cat.id, confidence: 0.95, matchType: 'name' };
      }
    }

    // Priority 3: Code matches slug
    for (const cat of storeCategories) {
      const catSlug = (cat.slug || '').toLowerCase().replace(/[-_]/g, '');
      if (catSlug && catSlug === normalizedCode) {
        return { categoryId: cat.id, confidence: 0.9, matchType: 'code_slug' };
      }
    }

    // Priority 4: Partial name match (contains)
    for (const cat of storeCategories) {
      const catName = (cat.name || '').toLowerCase().trim();
      if (catName && normalizedName && (
        catName.includes(normalizedName) || normalizedName.includes(catName)
      )) {
        // Only match if strings are similar enough (at least 70% of shorter string)
        const shorter = Math.min(catName.length, normalizedName.length);
        const longer = Math.max(catName.length, normalizedName.length);
        if (shorter / longer >= 0.7) {
          return { categoryId: cat.id, confidence: 0.7, matchType: 'partial' };
        }
      }
    }

    return null;
  }

  /**
   * Insert or update a category mapping
   */
  async upsertMapping(mappingData) {
    const tenantDb = await ConnectionManager.getStoreConnection(this.storeId);

    const record = {
      store_id: this.storeId,
      integration_source: this.integrationSource,
      ...mappingData,
      updated_at: new Date().toISOString()
    };

    // Check if mapping exists - handle null values properly
    let query = tenantDb
      .from('integration_category_mappings')
      .select('id')
      .eq('store_id', this.storeId)
      .eq('integration_source', this.integrationSource);

    // Build OR filter only for non-null values
    const orConditions = [];
    if (mappingData.external_category_id) {
      orConditions.push(`external_category_id.eq.${mappingData.external_category_id}`);
    }
    if (mappingData.external_category_code) {
      orConditions.push(`external_category_code.eq.${mappingData.external_category_code}`);
    }

    if (orConditions.length === 0) {
      // No valid identifiers - can't look up existing
      return null;
    }

    const { data: existing } = await query
      .or(orConditions.join(','))
      .maybeSingle();

    if (existing) {
      // Update existing
      const { error } = await tenantDb
        .from('integration_category_mappings')
        .update(record)
        .eq('id', existing.id);

      if (error) throw error;
      return { ...record, id: existing.id };
    } else {
      // Insert new
      record.created_at = new Date().toISOString();
      const { data, error } = await tenantDb
        .from('integration_category_mappings')
        .insert(record)
        .select()
        .single();

      if (error) throw error;
      return data;
    }
  }

  /**
   * Manually map an external category to an internal category
   */
  async setMapping(externalCategoryCode, internalCategoryId) {
    const tenantDb = await ConnectionManager.getStoreConnection(this.storeId);

    const { error } = await tenantDb
      .from('integration_category_mappings')
      .update({
        internal_category_id: internalCategoryId,
        mapping_type: 'manual',
        confidence_score: 1.0,
        updated_at: new Date().toISOString()
      })
      .eq('store_id', this.storeId)
      .eq('integration_source', this.integrationSource)
      .eq('external_category_code', externalCategoryCode);

    if (error) throw error;

    return true;
  }

  /**
   * Remove mapping (set internal_category_id to null)
   */
  async removeMapping(externalCategoryCode) {
    const tenantDb = await ConnectionManager.getStoreConnection(this.storeId);

    const { error } = await tenantDb
      .from('integration_category_mappings')
      .update({
        internal_category_id: null,
        mapping_type: 'manual',
        updated_at: new Date().toISOString()
      })
      .eq('store_id', this.storeId)
      .eq('integration_source', this.integrationSource)
      .eq('external_category_code', externalCategoryCode);

    if (error) throw error;
    return true;
  }

  /**
   * Reset all mappings (clear internal_category_id) for this integration source
   * This forces all categories to be unmapped and available for reimport
   */
  async resetAllMappings() {
    const tenantDb = await ConnectionManager.getStoreConnection(this.storeId);

    const { data, error } = await tenantDb
      .from('integration_category_mappings')
      .update({
        internal_category_id: null,
        mapping_type: 'manual',
        auto_created: false,
        updated_at: new Date().toISOString()
      })
      .eq('store_id', this.storeId)
      .eq('integration_source', this.integrationSource)
      .not('internal_category_id', 'is', null)
      .select('id');

    if (error) throw error;

    return { count: data?.length || 0 };
  }

  /**
   * Clean up orphaned mappings where internal_category_id points to deleted categories
   * This allows categories to be re-imported after deletion
   */
  async cleanOrphanedMappings() {
    const tenantDb = await ConnectionManager.getStoreConnection(this.storeId);

    // Get all mappings with internal_category_id set
    const { data: mappingsWithInternal, error: fetchError } = await tenantDb
      .from('integration_category_mappings')
      .select('id, internal_category_id')
      .eq('store_id', this.storeId)
      .eq('integration_source', this.integrationSource)
      .not('internal_category_id', 'is', null);

    if (fetchError || !mappingsWithInternal || mappingsWithInternal.length === 0) {
      return { cleaned: 0 };
    }

    // Get unique internal category IDs
    const internalCategoryIds = [...new Set(mappingsWithInternal.map(m => m.internal_category_id))];

    // Check which categories still exist AND are active
    const { data: existingCategories } = await tenantDb
      .from('categories')
      .select('id')
      .eq('store_id', this.storeId)
      .eq('is_active', true)
      .in('id', internalCategoryIds);

    const existingCategoryIds = new Set((existingCategories || []).map(c => c.id));

    // Find orphaned mappings (internal category deleted or inactive)
    const orphanedMappings = mappingsWithInternal.filter(m => !existingCategoryIds.has(m.internal_category_id));

    if (orphanedMappings.length === 0) {
      return { cleaned: 0 };
    }

    // Clear the orphaned mappings
    const orphanedIds = orphanedMappings.map(m => m.id);
    const { error: updateError } = await tenantDb
      .from('integration_category_mappings')
      .update({
        internal_category_id: null,
        mapping_type: 'manual',
        updated_at: new Date().toISOString()
      })
      .in('id', orphanedIds);

    if (updateError) {
      return { cleaned: 0 };
    }

    return { cleaned: orphanedMappings.length };
  }

  /**
   * Sync external categories to the mappings table
   * This creates mapping records for all external categories (without auto-matching)
   * Also removes mappings for categories that no longer exist in external source
   * Optimized with batch operations to avoid N+1 queries
   */
  async syncExternalCategories(externalCategories) {
    const tenantDb = await ConnectionManager.getStoreConnection(this.storeId);
    const results = { created: 0, updated: 0, deleted: 0, reset: 0, errors: [] };
    const now = new Date().toISOString();

    // First, reset all existing mappings (clear internal_category_id)
    // This ensures fresh sync every time and auto-match will find correct matches
    const { data: resetData, error: resetError } = await tenantDb
      .from('integration_category_mappings')
      .update({
        internal_category_id: null,
        auto_created: false,
        updated_at: now
      })
      .eq('store_id', this.storeId)
      .eq('integration_source', this.integrationSource)
      .not('internal_category_id', 'is', null)
      .select('id');

    if (!resetError) {
      results.reset = resetData?.length || 0;
    }

    // If no categories fetched, clear all mappings for this source
    if (!externalCategories || externalCategories.length === 0) {
      const { data: deleted, error: deleteError } = await tenantDb
        .from('integration_category_mappings')
        .delete()
        .eq('store_id', this.storeId)
        .eq('integration_source', this.integrationSource)
        .select('id');

      if (deleteError) {
        results.errors.push({ error: `Delete error: ${deleteError.message}` });
      } else {
        results.deleted = deleted?.length || 0;
      }
      return results;
    }

    try {
      // Fetch existing mappings
      const { data: existingMappings, error: fetchError } = await tenantDb
        .from('integration_category_mappings')
        .select('id, external_category_id, external_category_code, internal_category_id')
        .eq('store_id', this.storeId)
        .eq('integration_source', this.integrationSource);

      if (fetchError) {
        results.errors.push({ error: `Fetch error: ${fetchError.message}` });
        return results;
      }

      // Build lookup maps for existing mappings
      const existingByCode = new Map();
      const existingById = new Map();
      for (const m of (existingMappings || [])) {
        if (m.external_category_code) existingByCode.set(m.external_category_code, m);
        if (m.external_category_id) existingById.set(m.external_category_id, m);
      }

      // 2. Separate into updates and inserts
      const toUpdate = [];
      const toInsert = [];

      for (const extCat of externalCategories) {
        const existing = existingByCode.get(extCat.code) || existingById.get(extCat.id);

        if (existing) {
          toUpdate.push({
            id: existing.id,
            external_category_name: extCat.name,
            external_parent_code: extCat.parent_code,
            updated_at: now
          });
        } else {
          toInsert.push({
            store_id: this.storeId,
            integration_source: this.integrationSource,
            external_category_id: extCat.id,
            external_category_code: extCat.code,
            external_category_name: extCat.name,
            external_parent_code: extCat.parent_code,
            internal_category_id: null,
            mapping_type: 'manual',
            is_active: true,
            created_at: now,
            updated_at: now
          });
        }
      }

      // 2b. Find mappings to delete (exist in DB but not in fetched categories)
      const fetchedCodes = new Set(externalCategories.map(c => c.code).filter(Boolean));
      const fetchedIds = new Set(externalCategories.map(c => c.id).filter(Boolean));
      const toDelete = (existingMappings || []).filter(m => {
        const codeMatch = m.external_category_code && fetchedCodes.has(m.external_category_code);
        const idMatch = m.external_category_id && fetchedIds.has(m.external_category_id);
        return !codeMatch && !idMatch;
      });

      // Batch insert new mappings
      const BATCH_SIZE = 100;
      for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
        const batch = toInsert.slice(i, i + BATCH_SIZE);

        const { error } = await tenantDb
          .from('integration_category_mappings')
          .insert(batch)
          .select();

        if (error) {
          results.errors.push({ batch: `insert ${i}-${i + batch.length}`, error: error.message });
        } else {
          results.created += batch.length;
        }
      }

      // 4. Batch update existing mappings
      // Supabase doesn't support batch updates directly, so we use Promise.all with chunks
      const updateChunks = [];
      for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
        updateChunks.push(toUpdate.slice(i, i + BATCH_SIZE));
      }

      for (const chunk of updateChunks) {
        const updatePromises = chunk.map(record =>
          tenantDb
            .from('integration_category_mappings')
            .update({
              external_category_name: record.external_category_name,
              external_parent_code: record.external_parent_code,
              updated_at: record.updated_at
            })
            .eq('id', record.id)
        );

        const updateResults = await Promise.all(updatePromises);
        for (const result of updateResults) {
          if (result.error) {
            results.errors.push({ error: result.error.message });
          } else {
            results.updated++;
          }
        }
      }

      // Delete mappings for categories no longer in external source
      if (toDelete.length > 0) {
        const deleteIds = toDelete.map(m => m.id);

        for (let i = 0; i < deleteIds.length; i += BATCH_SIZE) {
          const batch = deleteIds.slice(i, i + BATCH_SIZE);
          const { error: deleteError } = await tenantDb
            .from('integration_category_mappings')
            .delete()
            .in('id', batch);

          if (deleteError) {
            results.errors.push({ error: `Delete error: ${deleteError.message}` });
          } else {
            results.deleted += batch.length;
          }
        }
      }

    } catch (err) {
      results.errors.push({ error: err.message });
    }

    return results;
  }

  /**
   * Auto-match all unmapped categories
   */
  async autoMatchAll() {
    const unmapped = await this.getUnmappedCategories();
    const results = { matched: 0, unmatched: 0 };

    for (const mapping of unmapped) {
      const autoMatch = await this.findAutoMatch({
        code: mapping.external_category_code,
        name: mapping.external_category_name,
        slug: mapping.external_category_code
      });

      if (autoMatch) {
        await this.setMapping(mapping.external_category_code, autoMatch.categoryId);
        results.matched++;
      } else {
        results.unmatched++;
      }
    }

    return results;
  }

  /**
   * Get internal category ID for an external category (quick lookup)
   */
  async getInternalCategoryId(externalCode) {
    const tenantDb = await ConnectionManager.getStoreConnection(this.storeId);

    const { data } = await tenantDb
      .from('integration_category_mappings')
      .select('internal_category_id')
      .eq('store_id', this.storeId)
      .eq('integration_source', this.integrationSource)
      .eq('external_category_code', externalCode)
      .eq('is_active', true)
      .maybeSingle();

    return data?.internal_category_id || null;
  }

  /**
   * Get multiple internal category IDs for external codes (batch lookup)
   */
  async getInternalCategoryIds(externalCodes) {
    if (!externalCodes || externalCodes.length === 0) return {};

    const tenantDb = await ConnectionManager.getStoreConnection(this.storeId);

    const { data: mappings } = await tenantDb
      .from('integration_category_mappings')
      .select('external_category_code, internal_category_id')
      .eq('store_id', this.storeId)
      .eq('integration_source', this.integrationSource)
      .in('external_category_code', externalCodes)
      .eq('is_active', true);

    // Build lookup map
    const result = {};
    for (const m of (mappings || [])) {
      if (m.internal_category_id) {
        result[m.external_category_code] = m.internal_category_id;
      }
    }

    return result;
  }

  /**
   * Get all parent category IDs for a given category (including ancestors up to root)
   * This is used to assign products to all parent categories in the hierarchy
   * @param {string} categoryId - The category ID to get parents for
   * @returns {string[]} - Array of parent category IDs (including the original category)
   */
  async getCategoryWithParents(categoryId) {
    if (!categoryId) return [];

    const tenantDb = await ConnectionManager.getStoreConnection(this.storeId);
    const categoryIds = [categoryId];

    // Traverse up the hierarchy
    let currentId = categoryId;
    const maxDepth = 10; // Safety limit
    let depth = 0;

    while (currentId && depth < maxDepth) {
      const { data: category } = await tenantDb
        .from('categories')
        .select('parent_id')
        .eq('id', currentId)
        .maybeSingle();

      if (!category || !category.parent_id) {
        break;
      }

      // Add parent to the list
      if (!categoryIds.includes(category.parent_id)) {
        categoryIds.push(category.parent_id);
      }
      currentId = category.parent_id;
      depth++;
    }

    return categoryIds;
  }

  /**
   * Expand a list of category IDs to include all parent categories
   * @param {string[]} categoryIds - Array of category IDs
   * @returns {string[]} - Array of category IDs including all parents (deduplicated)
   */
  async expandCategoriesWithParents(categoryIds) {
    if (!categoryIds || categoryIds.length === 0) return [];

    const allCategoryIds = new Set();

    for (const categoryId of categoryIds) {
      const withParents = await this.getCategoryWithParents(categoryId);
      withParents.forEach(id => allCategoryIds.add(id));
    }

    return Array.from(allCategoryIds);
  }

  /**
   * Get auto-creation settings
   * Auto-creation during import is disabled by default.
   * Users should use "Create Categories" button to explicitly create categories.
   */
  async getAutoCreateSettings() {
    return {
      enabled: false,
      defaultIsActive: true,
      defaultHideInMenu: true
    };
  }

  /**
   * Auto-create a category in DainoStore from external category data
   * @param {Object} externalCategory - External category data
   * @param {string} externalCategory.id - External ID
   * @param {string} externalCategory.code - External code
   * @param {string} externalCategory.name - Category name
   * @param {string} externalCategory.parent_code - Parent category code
   * @param {Object} options - Creation options
   * @param {string} options.targetRootCategoryId - Root category to place new categories under
   * @returns {string|null} - Created category UUID or null on failure
   */
  async autoCreateCategory(externalCategory, options = {}) {
    const { targetRootCategoryId } = options;
    const { v4: uuidv4 } = require('uuid');
    const tenantDb = await ConnectionManager.getStoreConnection(this.storeId);

    try {
      // Default settings for new categories
      // is_active: true (visible), hide_in_menu: true (hidden from navigation for review)
      const defaultIsActive = true;
      const defaultHideInMenu = true;
      const now = new Date().toISOString();

      // Generate slug from name or code
      const categoryName = externalCategory.name || externalCategory.code || 'Unnamed Category';
      const slug = categoryName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      // Check if category with this slug already exists
      const { data: existing } = await tenantDb
        .from('categories')
        .select('id')
        .eq('store_id', this.storeId)
        .eq('slug', slug)
        .maybeSingle();

      if (existing) {
        // Update the mapping to point to existing category
        await this.upsertMapping({
          external_category_id: externalCategory.id,
          external_category_code: externalCategory.code,
          external_category_name: categoryName,
          external_parent_code: externalCategory.parent_code,
          internal_category_id: existing.id,
          mapping_type: 'auto'
        });
        return existing.id;
      }

      // Resolve parent category
      // Priority: 1. External parent mapping, 2. Target root category, 3. No parent (root level)
      let parentId = null;
      let level = 0;
      let path = slug;

      // First, try to resolve external parent code to internal category
      if (externalCategory.parent_code) {
        parentId = await this.getInternalCategoryId(externalCategory.parent_code);
      }

      // If no mapped parent found and we have a target root category, use that
      if (!parentId && targetRootCategoryId) {
        parentId = targetRootCategoryId;
      }

      // Calculate level and path based on resolved parent
      if (parentId) {
        const { data: parent } = await tenantDb
          .from('categories')
          .select('level, path')
          .eq('id', parentId)
          .single();

        if (parent) {
          level = (parent.level || 0) + 1;
          path = parent.path ? `${parent.path}/${slug}` : slug;
        }
      }

      // Create new category
      const categoryId = uuidv4();
      const { error: categoryError } = await tenantDb
        .from('categories')
        .insert({
          id: categoryId,
          store_id: this.storeId,
          slug: slug,
          parent_id: parentId,
          level: level,
          path: path,
          is_active: defaultIsActive,
          hide_in_menu: defaultHideInMenu,
          sort_order: 0,
          created_at: now,
          updated_at: now
        });

      if (categoryError) {
        console.error(`❌ Failed to create category: ${categoryError.message}`);
        return null;
      }

      // Create category translation
      const { error: translationError } = await tenantDb
        .from('category_translations')
        .insert({
          category_id: categoryId,
          language_code: 'en',
          name: categoryName,
          created_at: now,
          updated_at: now
        });

      if (translationError) {
        console.error(`⚠️ Failed to create category translation: ${translationError.message}`);
        // Continue anyway - category was created
      }

      // Update mapping record to mark as auto-created
      await this.upsertMapping({
        external_category_id: externalCategory.id,
        external_category_code: externalCategory.code,
        external_category_name: categoryName,
        external_parent_code: externalCategory.parent_code,
        internal_category_id: categoryId,
        mapping_type: 'auto'
      });

      return categoryId;

    } catch (error) {
      console.error(`Error auto-creating category "${externalCategory.name}":`, error.message);
      return null;
    }
  }

  /**
   * Resolve category with auto-creation fallback
   * First tries to find existing mapping, then auto-creates if enabled
   * @param {Object} externalCategory - External category data
   * @returns {string|null} - Internal category UUID or null
   */
  async resolveCategoryWithAutoCreate(externalCategory) {
    // First try to find existing mapping
    const existingId = await this.getInternalCategoryId(externalCategory.code);
    if (existingId) {
      return existingId;
    }

    // Check if auto-creation is enabled
    const settings = await this.getAutoCreateSettings();
    if (!settings.enabled) {
      return null;
    }

    // Auto-create the category
    return await this.autoCreateCategory(externalCategory);
  }

  /**
   * Batch resolve categories with auto-creation
   * @param {Array} externalCategories - Array of external category objects
   * @returns {Array} - Array of internal category UUIDs
   */
  async resolveCategoriesWithAutoCreate(externalCategories) {
    if (!externalCategories || externalCategories.length === 0) {
      return [];
    }

    const resolvedIds = [];

    for (const extCat of externalCategories) {
      const internalId = await this.resolveCategoryWithAutoCreate(extCat);
      if (internalId) {
        resolvedIds.push(internalId);
      }
    }

    return resolvedIds;
  }
}

module.exports = CategoryMappingService;
