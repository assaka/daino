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
        .select('id, name, slug, parent_id')
        .in('id', categoryIds);

      if (categories) {
        for (const cat of categories) {
          categoriesMap[cat.id] = cat;
        }
      }
    }

    // Attach category info to mappings
    return mappings.map(m => ({
      ...m,
      internal_category: m.internal_category_id ? categoriesMap[m.internal_category_id] || null : null
    }));
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
      .select('id, name, slug, parent_id, level, path')
      .eq('store_id', this.storeId)
      .eq('is_active', true)
      .order('path', { ascending: true });

    if (error) {
      console.error('Error fetching store categories:', error);
      throw error;
    }

    return categories || [];
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
    const { data: storeCategories } = await tenantDb
      .from('categories')
      .select('id, name, slug, parent_id')
      .eq('store_id', this.storeId)
      .eq('is_active', true);

    if (!storeCategories || storeCategories.length === 0) {
      return null;
    }

    // Normalize for comparison
    const normalizedCode = (code || '').toLowerCase().replace(/[-_]/g, '');
    const normalizedName = (name || '').toLowerCase().trim();
    const normalizedSlug = (slug || code || '').toLowerCase().replace(/[-_]/g, '');

    // Priority 1: Exact slug match (highest confidence)
    for (const cat of storeCategories) {
      const catSlug = (cat.slug || '').toLowerCase().replace(/[-_]/g, '');
      if (catSlug && catSlug === normalizedSlug) {
        console.log(`🎯 Auto-matched by slug: "${code}" → "${cat.name}" (${cat.id})`);
        return { categoryId: cat.id, confidence: 1.0, matchType: 'slug' };
      }
    }

    // Priority 2: Exact name match (case-insensitive)
    for (const cat of storeCategories) {
      const catName = (cat.name || '').toLowerCase().trim();
      if (catName && catName === normalizedName) {
        console.log(`🎯 Auto-matched by name: "${name}" → "${cat.name}" (${cat.id})`);
        return { categoryId: cat.id, confidence: 0.95, matchType: 'name' };
      }
    }

    // Priority 3: Code matches slug
    for (const cat of storeCategories) {
      const catSlug = (cat.slug || '').toLowerCase().replace(/[-_]/g, '');
      if (catSlug && catSlug === normalizedCode) {
        console.log(`🎯 Auto-matched by code→slug: "${code}" → "${cat.name}" (${cat.id})`);
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
          console.log(`🎯 Auto-matched by partial name: "${name}" → "${cat.name}" (${cat.id})`);
          return { categoryId: cat.id, confidence: 0.7, matchType: 'partial' };
        }
      }
    }

    console.log(`⚠️ No auto-match found for: "${name}" (${code})`);
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

    console.log(`✅ Manually mapped: ${externalCategoryCode} → ${internalCategoryId}`);
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
   * Sync external categories to the mappings table
   * This creates mapping records for all external categories (without auto-matching)
   * Optimized with batch operations to avoid N+1 queries
   */
  async syncExternalCategories(externalCategories) {
    const tenantDb = await ConnectionManager.getStoreConnection(this.storeId);
    const results = { created: 0, updated: 0, errors: [] };
    const now = new Date().toISOString();

    console.log(`📁 syncExternalCategories called with ${externalCategories?.length || 0} categories`);
    console.log(`📁 Store ID: ${this.storeId}, Source: ${this.integrationSource}`);

    if (!externalCategories || externalCategories.length === 0) {
      console.log('📁 No categories to sync');
      return results;
    }

    try {
      // 1. Fetch ALL existing mappings in ONE query
      const externalCodes = externalCategories.map(c => c.code).filter(Boolean);
      const externalIds = externalCategories.map(c => c.id).filter(Boolean);

      console.log(`📁 Checking for existing mappings...`);
      const { data: existingMappings, error: fetchError } = await tenantDb
        .from('integration_category_mappings')
        .select('id, external_category_id, external_category_code, internal_category_id')
        .eq('store_id', this.storeId)
        .eq('integration_source', this.integrationSource);

      if (fetchError) {
        console.error('❌ Error fetching existing mappings:', fetchError.message);
        results.errors.push({ error: `Fetch error: ${fetchError.message}` });
        return results;
      }

      console.log(`📁 Found ${existingMappings?.length || 0} existing mappings`);

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

      console.log(`📁 To insert: ${toInsert.length}, To update: ${toUpdate.length}`);

      // 3. Batch insert new mappings (max 100 at a time for Supabase)
      const BATCH_SIZE = 100;
      for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
        const batch = toInsert.slice(i, i + BATCH_SIZE);
        console.log(`📁 Inserting batch ${i}-${i + batch.length}...`);

        console.log(`📁 Batch data sample:`, JSON.stringify(batch[0], null, 2));

        const { data: insertedData, error } = await tenantDb
          .from('integration_category_mappings')
          .insert(batch)
          .select();

        if (error) {
          console.error('❌ Batch insert error:', error.message);
          console.error('❌ Error details:', error.details);
          console.error('❌ Error hint:', error.hint);
          console.error('❌ Error code:', error.code);
          results.errors.push({ batch: `insert ${i}-${i + batch.length}`, error: error.message, details: error.details });
        } else {
          console.log(`✅ Inserted ${insertedData?.length || batch.length} records`);
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

    } catch (err) {
      console.error('Error in batch sync:', err.message);
      results.errors.push({ error: err.message });
    }

    console.log(`📁 Synced ${this.integrationSource} categories: ${results.created} created, ${results.updated} updated`);
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
        slug: mapping.external_category_code // Use code as slug for matching
      });

      if (autoMatch) {
        await this.setMapping(mapping.external_category_code, autoMatch.categoryId);
        results.matched++;
      } else {
        results.unmatched++;
      }
    }

    console.log(`🔄 Auto-match results: ${results.matched} matched, ${results.unmatched} unmatched`);
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
   * @returns {string|null} - Created category UUID or null on failure
   */
  async autoCreateCategory(externalCategory) {
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
        console.log(`📁 Category with slug "${slug}" already exists (${existing.id}), using existing`);
        // Update the mapping to point to existing category
        await this.upsertMapping({
          external_category_id: externalCategory.id,
          external_category_code: externalCategory.code,
          external_category_name: categoryName,
          external_parent_code: externalCategory.parent_code,
          internal_category_id: existing.id,
          mapping_type: 'auto',
          auto_created: false
        });
        return existing.id;
      }

      // Resolve parent category if exists
      let parentId = null;
      let level = 0;
      let path = slug;

      if (externalCategory.parent_code) {
        parentId = await this.getInternalCategoryId(externalCategory.parent_code);
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
          description: '',
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
        mapping_type: 'auto',
        auto_created: true,
        auto_created_at: now
      });

      console.log(`✅ Auto-created category: "${categoryName}" (${slug}) → ${categoryId}`);
      console.log(`   Settings: is_active=${defaultIsActive}, hide_in_menu=${defaultHideInMenu}`);

      return categoryId;

    } catch (error) {
      console.error(`❌ Error auto-creating category "${externalCategory.name}":`, error.message);
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
      console.log(`⚠️ No mapping for "${externalCategory.name}" and auto-create is disabled`);
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
