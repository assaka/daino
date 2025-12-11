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

    const { data: mappings, error } = await tenantDb
      .from('integration_category_mappings')
      .select(`
        *,
        internal_category:categories(id, name, slug, parent_id)
      `)
      .eq('store_id', this.storeId)
      .eq('integration_source', this.integrationSource)
      .order('external_category_name', { ascending: true });

    if (error) {
      console.error('Error fetching category mappings:', error);
      throw error;
    }

    return mappings || [];
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

    // 1. Check for explicit mapping
    const { data: existingMapping } = await tenantDb
      .from('integration_category_mappings')
      .select('internal_category_id')
      .eq('store_id', this.storeId)
      .eq('integration_source', this.integrationSource)
      .or(`external_category_id.eq.${externalId},external_category_code.eq.${externalCode}`)
      .eq('is_active', true)
      .maybeSingle();

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

    // Check if mapping exists
    const { data: existing } = await tenantDb
      .from('integration_category_mappings')
      .select('id')
      .eq('store_id', this.storeId)
      .eq('integration_source', this.integrationSource)
      .or(`external_category_id.eq.${mappingData.external_category_id},external_category_code.eq.${mappingData.external_category_code}`)
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
   */
  async syncExternalCategories(externalCategories) {
    const tenantDb = await ConnectionManager.getStoreConnection(this.storeId);
    const results = { created: 0, updated: 0, errors: [] };

    for (const extCat of externalCategories) {
      try {
        // Check if mapping exists
        const { data: existing } = await tenantDb
          .from('integration_category_mappings')
          .select('id, internal_category_id')
          .eq('store_id', this.storeId)
          .eq('integration_source', this.integrationSource)
          .or(`external_category_id.eq.${extCat.id},external_category_code.eq.${extCat.code}`)
          .maybeSingle();

        if (existing) {
          // Update name only, keep existing mapping
          await tenantDb
            .from('integration_category_mappings')
            .update({
              external_category_name: extCat.name,
              external_parent_code: extCat.parent_code,
              updated_at: new Date().toISOString()
            })
            .eq('id', existing.id);
          results.updated++;
        } else {
          // Create new mapping (unmapped by default)
          await tenantDb
            .from('integration_category_mappings')
            .insert({
              store_id: this.storeId,
              integration_source: this.integrationSource,
              external_category_id: extCat.id,
              external_category_code: extCat.code,
              external_category_name: extCat.name,
              external_parent_code: extCat.parent_code,
              internal_category_id: null,
              mapping_type: 'manual',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
          results.created++;
        }
      } catch (err) {
        console.error(`Error syncing category ${extCat.code}:`, err.message);
        results.errors.push({ code: extCat.code, error: err.message });
      }
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
}

module.exports = CategoryMappingService;
