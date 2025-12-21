/**
 * AI Entity Service - Dynamic Entity Operations
 *
 * This service handles database-driven entity operations for AI chat.
 * It loads entity definitions from ai_entity_definitions table (MASTER DB)
 * and executes CRUD operations on tenant data tables.
 *
 * Database split:
 * - MASTER DB: ai_entity_definitions (shared entity schemas)
 * - TENANT DB: Actual data tables (product_tabs, coupons, etc.)
 *
 * Usage:
 *   const aiEntityService = require('./aiEntityService');
 *   const entities = await aiEntityService.getEntityDefinitions();
 *   const result = await aiEntityService.executeEntityOperation(storeId, 'product_tabs', 'update', { id: '123', name: 'New Name' });
 */

const { masterDbClient } = require('../database/masterConnection');
const ConnectionManager = require('./database/ConnectionManager');

class AIEntityService {
  constructor() {
    // Cache entity definitions (5 minute TTL)
    this.cache = {
      definitions: null,
      lastFetch: null,
      ttl: 5 * 60 * 1000
    };
  }

  /**
   * Get all active entity definitions from MASTER database
   * Entity definitions are shared across all stores
   * @returns {Promise<Array>} Array of entity definitions
   */
  async getEntityDefinitions() {
    try {
      // Check cache
      const now = Date.now();
      if (this.cache.definitions && this.cache.lastFetch && (now - this.cache.lastFetch < this.cache.ttl)) {
        return this.cache.definitions;
      }

      // Query from MASTER DB (shared across all stores)
      const { data, error } = await masterDbClient
        .from('ai_entity_definitions')
        .select('*')
        .eq('is_active', true)
        .order('priority', { ascending: false });

      if (error) {
        console.error('[AIEntityService] Error fetching entity definitions:', error);
        return [];
      }

      const definitions = data || [];

      // Parse JSON fields
      const parsed = definitions.map(def => ({
        ...def,
        related_tables: this._parseJson(def.related_tables, []),
        supported_operations: this._parseJson(def.supported_operations, []),
        fields: this._parseJson(def.fields, []),
        intent_keywords: this._parseJson(def.intent_keywords, []),
        example_prompts: this._parseJson(def.example_prompts, []),
        example_responses: this._parseJson(def.example_responses, []),
        validation_rules: this._parseJson(def.validation_rules, {})
      }));

      // Update cache
      this.cache.definitions = parsed;
      this.cache.lastFetch = now;

      return parsed;
    } catch (error) {
      console.error('[AIEntityService] Error fetching entity definitions:', error);
      return [];
    }
  }

  /**
   * Get a single entity definition by name (from MASTER DB)
   */
  async getEntityDefinition(entityName) {
    const definitions = await this.getEntityDefinitions();
    return definitions.find(d => d.entity_name === entityName);
  }

  /**
   * Generate dynamic intent detection prompt based on entity definitions
   * @returns {Promise<string>} Intent detection prompt with all entity definitions
   */
  async generateIntentPrompt() {
    const entities = await this.getEntityDefinitions();

    // Group by category
    const byCategory = {};
    entities.forEach(e => {
      const cat = e.category || 'general';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(e);
    });

    // Build entity definitions for prompt
    let entityDefs = '';
    for (const [category, ents] of Object.entries(byCategory)) {
      entityDefs += `\n### ${category.toUpperCase()} ENTITIES:\n`;
      ents.forEach(e => {
        entityDefs += `\n**${e.entity_name}** (${e.display_name}):\n`;
        entityDefs += `- Description: ${e.description}\n`;
        entityDefs += `- Keywords: ${e.intent_keywords.join(', ')}\n`;
        entityDefs += `- Operations: ${e.supported_operations.join(', ')}\n`;
        entityDefs += `- Example prompts: ${e.example_prompts.slice(0, 2).join('; ')}\n`;
      });
    }

    return `You are an AI assistant for an e-commerce admin panel. Analyze user messages and determine:
1. Is this an INFORMATIONAL QUESTION or an ACTION REQUEST?
2. Which entity they want to interact with (if action)
3. What operation they want to perform (if action)
4. Extract relevant parameters (if action)

CRITICAL: Distinguish between QUESTIONS and ACTIONS:
- QUESTIONS ask "How do I...", "What is...", "Can you explain...", "How does...", "Tell me about..." → Use intent "info"
- ACTIONS request something to be done: "Create a...", "Make a...", "Add...", "Delete...", "Update...", "Change..." → Use intent "admin_entity"

AVAILABLE ENTITIES:
${entityDefs}

RESPONSE FORMAT (JSON):
{
  "intent": "info" | "admin_entity" | "styling" | "layout" | "layout_modify" | "translation" | "plugin" | "chat",
  "entity": "entity_name (if admin_entity intent)",
  "operation": "list" | "get" | "create" | "update" | "delete",
  "params": {
    "id": "entity id (for get/update/delete)",
    "field_name": "new_value",
    ...
  },
  "search_term": "if user wants to find specific item by name",
  "confidence": 0.0-1.0
}

EXAMPLES - INFORMATIONAL (do NOT take action):
- "How do I create a coupon?" → { "intent": "info", "entity": "coupons", "confidence": 0.95 }
- "What is the difference between flat rate and weight-based shipping?" → { "intent": "info", "entity": "shipping_methods", "confidence": 0.9 }
- "How does the refund process work?" → { "intent": "info", "entity": "orders", "confidence": 0.9 }
- "Can you explain how translations work?" → { "intent": "info", "confidence": 0.85 }
- "Tell me about product labels" → { "intent": "info", "entity": "product_labels", "confidence": 0.9 }

EXAMPLES - ACTIONS (execute the operation):
- "rename the specs tab to Technical Details" → { "intent": "admin_entity", "entity": "product_tabs", "operation": "update", "search_term": "specs", "params": { "name": "Technical Details" }, "confidence": 0.95 }
- "create a 20% discount coupon SUMMER20" → { "intent": "admin_entity", "entity": "coupons", "operation": "create", "params": { "code": "SUMMER20", "discount_type": "percentage", "discount_value": 20 }, "confidence": 0.9 }
- "disable PayPal payments" → { "intent": "admin_entity", "entity": "payment_methods", "operation": "update", "search_term": "paypal", "params": { "is_active": false }, "confidence": 0.85 }

Return ONLY valid JSON.`;
  }

  /**
   * Detect which entity and operation user wants based on their message
   * @param {string} message - User message
   * @param {object} aiService - AI service instance for generating response
   * @param {string} userId - User ID for AI credits
   * @param {string} storeId - Store ID (for logging purposes)
   * @returns {Promise<object>} Detected intent with entity and operation
   */
  async detectEntityIntent(message, aiService, userId, storeId = null) {
    const intentPrompt = await this.generateIntentPrompt();

    const result = await aiService.generate({
      userId,
      operationType: 'general',
      prompt: `${intentPrompt}\n\nUser message: "${message}"`,
      systemPrompt: 'You are an intent classifier for an admin panel. Return ONLY valid JSON.',
      maxTokens: 512,
      temperature: 0.2,
      metadata: { type: 'entity-intent-detection', storeId }
    });

    try {
      const jsonMatch = result.content.match(/\{[\s\S]*\}/);
      const intent = JSON.parse(jsonMatch ? jsonMatch[0] : result.content);
      return {
        ...intent,
        creditsUsed: result.creditsDeducted
      };
    } catch (e) {
      console.error('[AIEntityService] Failed to parse intent:', e);
      return { intent: 'chat', creditsUsed: result.creditsDeducted };
    }
  }

  /**
   * Execute an operation on an entity
   * Entity definitions from MASTER DB, data operations on TENANT DB
   * @param {string} storeId - Store ID for tenant data access
   * @param {string} entityName - Entity name (e.g., 'product_tabs')
   * @param {string} operation - Operation (list, get, create, update, delete)
   * @param {object} params - Operation parameters
   * @param {object} options - Additional options
   * @returns {Promise<object>} Operation result
   */
  async executeEntityOperation(storeId, entityName, operation, params = {}, options = {}) {
    // Get entity definition from MASTER DB
    const entityDef = await this.getEntityDefinition(entityName);

    if (!entityDef) {
      throw new Error(`Unknown entity: ${entityName}`);
    }

    if (!entityDef.supported_operations.includes(operation)) {
      throw new Error(`Operation '${operation}' not supported for ${entityName}`);
    }

    const db = await ConnectionManager.getStoreConnection(storeId);
    const tableName = entityDef.table_name;
    const tenantColumn = entityDef.tenant_column;
    const primaryKey = entityDef.primary_key || 'id';

    let result;

    switch (operation) {
      case 'list':
        result = await this._listEntities(db, tableName, tenantColumn, storeId, params);
        break;

      case 'get':
        result = await this._getEntity(db, tableName, primaryKey, params.id, tenantColumn, storeId);
        break;

      case 'create':
        result = await this._createEntity(db, tableName, tenantColumn, storeId, params, entityDef);
        break;

      case 'update':
        result = await this._updateEntity(db, tableName, primaryKey, params.id, tenantColumn, storeId, params, entityDef, options);
        break;

      case 'delete':
        result = await this._deleteEntity(db, tableName, primaryKey, params.id, tenantColumn, storeId);
        break;

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return {
      success: true,
      entity: entityName,
      operation,
      data: result
    };
  }

  /**
   * Find an entity by search term (name, code, etc.)
   * Entity definition from MASTER DB, actual search on TENANT DB
   */
  async findEntityBySearchTerm(storeId, entityName, searchTerm) {
    // Get entity definition from MASTER DB
    const entityDef = await this.getEntityDefinition(entityName);
    if (!entityDef) return null;

    // Search actual data in TENANT DB
    const db = await ConnectionManager.getStoreConnection(storeId);
    const tableName = entityDef.table_name;
    const tenantColumn = entityDef.tenant_column;

    // Search in common fields: name, code, title, slug
    const searchFields = ['name', 'code', 'title', 'slug'];
    const availableFields = entityDef.fields.map(f => f.name);
    const fieldsToSearch = searchFields.filter(f => availableFields.includes(f));

    if (fieldsToSearch.length === 0) {
      console.warn(`[AIEntityService] No searchable fields for ${entityName}`);
      return null;
    }

    let query = db.from(tableName);

    // Add tenant filter if applicable
    if (tenantColumn) {
      query = query.where(tenantColumn, storeId);
    }

    // Build OR conditions for search
    query = query.where(function() {
      fieldsToSearch.forEach((field, idx) => {
        if (idx === 0) {
          this.whereRaw(`LOWER(${field}) LIKE ?`, [`%${searchTerm.toLowerCase()}%`]);
        } else {
          this.orWhereRaw(`LOWER(${field}) LIKE ?`, [`%${searchTerm.toLowerCase()}%`]);
        }
      });
    });

    const results = await query.limit(5);

    if (results.length === 0) {
      return null;
    }

    // If multiple results, return all for AI to choose
    return results.length === 1 ? results[0] : results;
  }

  // === PRIVATE METHODS ===

  _parseJson(value, defaultValue) {
    if (!value) return defaultValue;
    if (typeof value === 'object') return value;
    try {
      return JSON.parse(value);
    } catch {
      return defaultValue;
    }
  }

  async _listEntities(db, tableName, tenantColumn, storeId, params = {}) {
    let query = db.from(tableName).select('*');

    if (tenantColumn) {
      query = query.where(tenantColumn, storeId);
    }

    // Apply filters
    if (params.is_active !== undefined) {
      query = query.where('is_active', params.is_active);
    }

    // Apply ordering
    if (params.order_by) {
      query = query.orderBy(params.order_by, params.order_dir || 'asc');
    }

    // Apply limit
    query = query.limit(params.limit || 100);

    return query;
  }

  async _getEntity(db, tableName, primaryKey, id, tenantColumn, storeId) {
    let query = db.from(tableName).where(primaryKey, id);

    if (tenantColumn) {
      query = query.where(tenantColumn, storeId);
    }

    return query.first();
  }

  async _createEntity(db, tableName, tenantColumn, storeId, params, entityDef) {
    // Build insert data
    const insertData = { ...params };

    // Add tenant column
    if (tenantColumn) {
      insertData[tenantColumn] = storeId;
    }

    // Add timestamps
    insertData.created_at = new Date().toISOString();
    insertData.updated_at = new Date().toISOString();

    // Remove non-field params
    delete insertData.id;

    const [result] = await db.from(tableName).insert(insertData).returning('*');
    return result;
  }

  async _updateEntity(db, tableName, primaryKey, id, tenantColumn, storeId, params, entityDef, options = {}) {
    // If we have a search_term instead of ID, find the entity first
    if (!id && options.search_term) {
      const found = await this.findEntityBySearchTerm(storeId, entityDef.entity_name, options.search_term);
      if (!found) {
        throw new Error(`Could not find ${entityDef.display_name} matching "${options.search_term}"`);
      }
      if (Array.isArray(found)) {
        throw new Error(`Multiple ${entityDef.display_name} found matching "${options.search_term}". Please be more specific.`);
      }
      id = found[primaryKey];
    }

    if (!id) {
      throw new Error(`No ${primaryKey} provided for update operation`);
    }

    // Build update data
    const updateData = { ...params };
    delete updateData.id;
    delete updateData[primaryKey];

    // Add updated timestamp
    updateData.updated_at = new Date().toISOString();

    // Remove null/undefined values
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    let query = db.from(tableName).where(primaryKey, id);

    if (tenantColumn) {
      query = query.where(tenantColumn, storeId);
    }

    const [result] = await query.update(updateData).returning('*');

    if (!result) {
      throw new Error(`${entityDef.display_name} with ${primaryKey}=${id} not found`);
    }

    return result;
  }

  async _deleteEntity(db, tableName, primaryKey, id, tenantColumn, storeId) {
    if (!id) {
      throw new Error(`No ${primaryKey} provided for delete operation`);
    }

    let query = db.from(tableName).where(primaryKey, id);

    if (tenantColumn) {
      query = query.where(tenantColumn, storeId);
    }

    const deleted = await query.delete();
    return { deleted: deleted > 0 };
  }

  /**
   * Generate a natural response for entity operations
   */
  async generateEntityResponse(storeId, entityDef, operation, result, aiService, userId, originalMessage) {
    const responsePrompt = `The user asked: "${originalMessage}"

I performed a ${operation} operation on ${entityDef.display_name}.

Result: ${JSON.stringify(result, null, 2)}

Generate a brief, friendly confirmation message (1-2 sentences). Be conversational and helpful.
Mention the specific changes made. Don't use markdown or emojis.`;

    const response = await aiService.generate({
      userId,
      operationType: 'general',
      prompt: responsePrompt,
      systemPrompt: 'You are a helpful admin assistant. Generate brief, friendly responses.',
      maxTokens: 150,
      temperature: 0.7,
      metadata: { type: 'entity-response', storeId }
    });

    return {
      message: response.content,
      creditsUsed: response.creditsDeducted
    };
  }

  /**
   * Clear the entity definitions cache
   */
  clearCache() {
    this.cache.definitions = null;
    this.cache.lastFetch = null;
  }
}

module.exports = new AIEntityService();
