/**
 * AI Context Service - RAG (Retrieval-Augmented Generation) System
 *
 * This service fetches context data from the MASTER database to enhance AI prompts.
 *
 * ALL AI tables are in MASTER DB because:
 * - Knowledge is shared across all stores
 * - Cross-user learning benefits everyone
 * - Centralized training data management
 * - User-specific data uses user_id/store_id columns for filtering
 *
 * Tables in Master DB:
 * - ai_context_documents - Global knowledge base
 * - ai_plugin_examples - Working code examples
 * - ai_entity_definitions - Admin entity schemas
 * - ai_training_candidates - Training data for self-learning (prompts, feedback, outcomes)
 *
 * See: backend/src/services/RAG_SYSTEM.md for full documentation
 */

const { masterDbClient } = require('../database/masterConnection');

class AIContextService {
  constructor() {
    // In-memory cache to reduce database hits (5 minute TTL)
    this.cache = {
      documents: null,
      examples: null,
      patterns: null,
      lastFetch: null,
      ttl: 5 * 60 * 1000 // 5 minutes
    };
  }

  /**
   * MAIN ENTRY POINT: Get complete RAG context for AI prompts
   */
  async getContextForQuery({ mode, category, query, storeId = null, limit = 10 }) {
    const context = {
      documents: await this.getRelevantDocuments({ mode, category, limit: 5 }),
      examples: await this.getRelevantExamples({ category, query, limit: 3 }),
      patterns: await this.getRelevantPatterns({ query, limit: 5 })
    };

    return this.formatContextForAI(context);
  }

  /**
   * Get relevant knowledge base documents from ai_context_documents
   * Always includes 'core' category and 'rules' type documents (critical instructions)
   */
  async getRelevantDocuments({ mode, category, limit = 5 }) {
    try {
      let query = masterDbClient
        .from('ai_context_documents')
        .select('id, type, title, content, category, tags, priority')
        .eq('is_active', true)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(limit);

      // Filter by mode
      if (mode && mode !== 'all') {
        query = query.or(`mode.eq.${mode},mode.eq.all`);
      }

      // Filter by category - ALWAYS include 'core' and 'rules' type docs
      if (category) {
        query = query.or(`category.eq.${category},category.eq.core,type.eq.rules`);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching context documents:', error);
        return [];
      }

      return (data || []).map(doc => ({
        ...doc,
        tags: typeof doc.tags === 'string' ? JSON.parse(doc.tags) : (doc.tags || [])
      }));
    } catch (error) {
      console.error('Error fetching context documents:', error);
      return [];
    }
  }

  /**
   * Get relevant plugin examples from ai_plugin_examples
   */
  async getRelevantExamples({ category, query, limit = 3 }) {
    try {
      let dbQuery = masterDbClient
        .from('ai_plugin_examples')
        .select('id, name, slug, description, category, complexity, code, files, features, use_cases, tags')
        .eq('is_active', true)
        .order('usage_count', { ascending: false })
        .limit(limit);

      if (category) {
        dbQuery = dbQuery.eq('category', category);
      }

      const { data, error } = await dbQuery;

      if (error) {
        console.error('Error fetching plugin examples:', error);
        return [];
      }

      return (data || []).map(r => ({
        ...r,
        files: typeof r.files === 'string' ? JSON.parse(r.files) : (r.files || []),
        features: typeof r.features === 'string' ? JSON.parse(r.features) : (r.features || []),
        use_cases: typeof r.use_cases === 'string' ? JSON.parse(r.use_cases) : (r.use_cases || []),
        tags: typeof r.tags === 'string' ? JSON.parse(r.tags) : (r.tags || [])
      }));
    } catch (error) {
      console.error('Error fetching plugin examples:', error);
      return [];
    }
  }

  /**
   * Get relevant patterns from promoted training candidates
   * (Replaces ai_code_patterns table)
   */
  async getRelevantPatterns({ query, entity, limit = 5 }) {
    try {
      let queryBuilder = masterDbClient
        .from('ai_training_candidates')
        .select('id, user_prompt, ai_response, detected_entity, detected_operation, success_count, metadata')
        .in('training_status', ['approved', 'promoted'])
        .order('success_count', { ascending: false })
        .limit(limit);

      if (entity) {
        queryBuilder = queryBuilder.eq('detected_entity', entity);
      }

      const { data, error } = await queryBuilder;

      if (error) {
        console.error('Error fetching training patterns:', error);
        return [];
      }

      // Format as patterns for backward compatibility
      return (data || []).map(r => ({
        id: r.id,
        name: `${r.detected_entity || 'general'} - ${r.detected_operation || 'query'}`,
        pattern_type: 'successful_prompt',
        description: r.user_prompt,
        code: r.ai_response,
        tags: r.metadata?.tags || [],
        usage_count: r.success_count
      }));
    } catch (error) {
      console.error('Error fetching training patterns:', error);
      return [];
    }
  }

  /**
   * Format context objects into AI-readable markdown string
   */
  formatContextForAI(context) {
    let formatted = '';

    if (context.documents && context.documents.length > 0) {
      formatted += '# KNOWLEDGE BASE\n\n';
      context.documents.forEach(doc => {
        formatted += `## ${doc.title}\n${doc.content}\n\n`;
      });
    }

    if (context.examples && context.examples.length > 0) {
      formatted += '# PLUGIN EXAMPLES\n\n';
      context.examples.forEach(ex => {
        formatted += `## ${ex.name} (${ex.complexity})\n`;
        formatted += `**Description:** ${ex.description}\n`;
        formatted += `**Category:** ${ex.category}\n`;
        if (ex.features && ex.features.length > 0) {
          formatted += `**Features:** ${ex.features.join(', ')}\n\n`;
        }
        formatted += `**Code:**\n\`\`\`javascript\n${ex.code}\n\`\`\`\n\n`;
        if (ex.use_cases && ex.use_cases.length > 0) {
          formatted += `**Use cases:** ${ex.use_cases.join(', ')}\n\n`;
        }
      });
    }

    if (context.patterns && context.patterns.length > 0) {
      formatted += '# CODE PATTERNS & SNIPPETS\n\n';
      context.patterns.forEach(pattern => {
        formatted += `## ${pattern.name} (${pattern.pattern_type})\n`;
        formatted += `**Description:** ${pattern.description}\n`;
        if (pattern.framework) {
          formatted += `**Framework:** ${pattern.framework}\n`;
        }
        formatted += `\n**Code:**\n\`\`\`${pattern.language}\n${pattern.code}\n\`\`\`\n`;
        if (pattern.example_usage) {
          formatted += `\n**Usage:** ${pattern.example_usage}\n`;
        }
        formatted += '\n';
      });
    }

    return formatted;
  }

  /**
   * Track context usage for analytics
   * Now uses ai_training_candidates table (consolidated from ai_context_usage)
   */
  async trackContextUsage({ documentId, exampleId, patternId, userId, sessionId, query, wasHelpful, storeId = null }) {
    try {
      // Insert into ai_training_candidates (consolidated table)
      const { error } = await masterDbClient.from('ai_training_candidates').insert({
        user_prompt: query || '',
        user_id: userId || null,
        session_id: sessionId || null,
        store_id: storeId || null,
        context_document_ids: documentId ? [documentId] : [],
        context_example_ids: exampleId ? [exampleId] : [],
        context_pattern_ids: patternId ? [patternId] : [],
        was_helpful: wasHelpful || null,
        training_status: 'candidate',
        outcome_status: 'pending',
        created_at: new Date().toISOString()
      });

      if (error) {
        console.error('Error tracking context usage:', error);
      }

      // Increment usage counts for examples
      if (exampleId) {
        await masterDbClient.rpc('increment_usage_count', {
          table_name: 'ai_plugin_examples',
          row_id: exampleId
        }).catch(() => {});
      }
    } catch (error) {
      console.error('Error tracking context usage:', error);
    }
  }

  /**
   * Get store intelligence (from TENANT DB - store-specific insights)
   */
  async getStoreIntelligence(storeId) {
    try {
      if (!storeId) {
        return null;
      }

      const ConnectionManager = require('./database/ConnectionManager');
      const db = await ConnectionManager.getStoreConnection(storeId);

      const data = await db
        .from('ai_store_intelligence')
        .where('store_id', storeId)
        .first();

      return data || null;
    } catch (error) {
      console.error('Error fetching store intelligence:', error);
      return null;
    }
  }

  /**
   * Save/update store intelligence (in TENANT DB)
   */
  async saveStoreIntelligence(storeId, intelligence) {
    try {
      if (!storeId) {
        console.error('storeId is required for saving store intelligence');
        return;
      }

      const ConnectionManager = require('./database/ConnectionManager');
      const db = await ConnectionManager.getStoreConnection(storeId);

      const existing = await this.getStoreIntelligence(storeId);

      const data = {
        detected_branch: intelligence.detectedBranch || null,
        branch_confidence: intelligence.branchConfidence || null,
        branch_tags: JSON.stringify(intelligence.branchTags || []),
        conversion_insights: JSON.stringify(intelligence.conversionInsights || {}),
        geographic_insights: JSON.stringify(intelligence.geographicInsights || {}),
        marketing_insights: JSON.stringify(intelligence.marketingInsights || {}),
        product_insights: JSON.stringify(intelligence.productInsights || {}),
        customer_insights: JSON.stringify(intelligence.customerInsights || {}),
        last_analyzed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      if (existing) {
        await db
          .from('ai_store_intelligence')
          .where('store_id', storeId)
          .update(data);
      } else {
        data.store_id = storeId;
        data.created_at = new Date().toISOString();
        await db.from('ai_store_intelligence').insert(data);
      }
    } catch (error) {
      console.error('Error saving store intelligence:', error);
    }
  }

  /**
   * Get branch profile from master DB (generic knowledge for store type)
   */
  async getBranchProfile(branch) {
    try {
      const { data, error } = await masterDbClient
        .from('ai_context_documents')
        .select('*')
        .eq('type', 'branch_profile')
        .eq('category', branch)
        .eq('is_active', true)
        .order('priority', { ascending: false })
        .limit(5);

      if (error) {
        console.error('Error fetching branch profile:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching branch profile:', error);
      return [];
    }
  }

  /**
   * Get smart context combining branch knowledge + store intelligence
   */
  async getSmartContext(storeId, query) {
    try {
      // Get store-specific intelligence
      const storeIntel = await this.getStoreIntelligence(storeId);

      // Get branch knowledge from master if we know the store type
      let branchDocs = [];
      if (storeIntel?.detected_branch) {
        branchDocs = await this.getBranchProfile(storeIntel.detected_branch);
      }

      return {
        branchKnowledge: branchDocs,
        storeIntelligence: storeIntel,
        hasBranchProfile: branchDocs.length > 0,
        hasStoreData: !!storeIntel
      };
    } catch (error) {
      console.error('Error getting smart context:', error);
      return {
        branchKnowledge: [],
        storeIntelligence: null,
        hasBranchProfile: false,
        hasStoreData: false
      };
    }
  }

  /**
   * Add new context document to the knowledge base
   */
  async addContextDocument(document) {
    try {
      const { data, error } = await masterDbClient
        .from('ai_context_documents')
        .insert({
          type: document.type,
          title: document.title,
          content: document.content,
          category: document.category || null,
          tags: document.tags || [],
          priority: document.priority || 0,
          mode: document.mode || 'all',
          is_active: document.isActive !== false,
          metadata: document.metadata || {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (error) {
        throw error;
      }

      this.clearCache();
      return data;
    } catch (error) {
      console.error('Error adding context document:', error);
      throw error;
    }
  }

  /**
   * Save chat message for learning
   * Chat history stored in tenant DB (ai_chat_sessions)
   * Training data stored in master DB (ai_training_candidates)
   */
  async saveChatMessage({ userId, storeId, sessionId, role, content, intent, entity, operation, wasSuccessful, metadata, creditsUsed = 0, aiResponse = null }) {
    try {
      // Save to tenant database for user's chat history
      if (storeId && userId) {
        try {
          const ConnectionManager = require('./database/ConnectionManager');
          const tenantDb = await ConnectionManager.getStoreConnection(storeId);

          await tenantDb.from('ai_chat_sessions').insert({
            user_id: userId,
            session_id: sessionId || `session_${Date.now()}`,
            role,
            content,
            intent: intent || null,
            data: metadata || {},
            credits_used: creditsUsed || 0,
            is_error: wasSuccessful === false,
            created_at: new Date().toISOString()
          });

          // Also save user inputs to input history for autocomplete/suggestions
          if (role === 'user') {
            await tenantDb.from('ai_input_history').upsert({
              user_id: userId,
              input: content,
              created_at: new Date().toISOString()
            }, { onConflict: 'input', ignoreDuplicates: true });
          }
        } catch (tenantError) {
          console.error('Error saving chat message to tenant:', tenantError);
        }
      }

      // For user messages with admin_entity intent, use aiTrainingService for proper learning flow
      // Note: Most AI routes call aiTrainingService.captureTrainingCandidate directly
      // This is a fallback for routes that only call saveChatMessage
      if (role === 'user' && intent === 'admin_entity' && entity) {
        try {
          const aiTrainingService = require('./aiTrainingService');
          const captureResult = await aiTrainingService.captureTrainingCandidate({
            storeId,
            userId,
            sessionId,
            userPrompt: content,
            aiResponse,
            detectedIntent: intent,
            detectedEntity: entity,
            detectedOperation: operation,
            metadata: metadata || {}
          });

          // If action already completed successfully, update outcome
          if (captureResult.captured && wasSuccessful) {
            await aiTrainingService.updateOutcome(captureResult.candidateId, 'success', {
              source: 'saveChatMessage',
              automatic: true
            });
          }
        } catch (trainingError) {
          console.error('Error capturing training candidate:', trainingError);
        }
      }
    } catch (error) {
      console.error('Error saving chat message:', error);
    }
  }

  /**
   * Get successful prompts for an entity (for learning)
   */
  async getSuccessfulPrompts(entity, limit = 5) {
    try {
      const { data, error } = await masterDbClient
        .from('ai_training_candidates')
        .select('user_prompt, ai_response, detected_intent, detected_entity, detected_operation, success_count, metadata')
        .eq('detected_entity', entity)
        .eq('outcome_status', 'success')
        .in('training_status', ['candidate', 'approved', 'promoted'])
        .order('success_count', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching successful prompts:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching successful prompts:', error);
      return [];
    }
  }

  /**
   * Get approved training examples to improve AI responses
   * These are real user prompts that were marked as helpful
   */
  async getApprovedTrainingExamples(intent, queryType = null, limit = 5) {
    try {
      let query = masterDbClient
        .from('ai_training_candidates')
        .select('user_prompt, ai_response, detected_entity, detected_operation, success_count, metadata')
        .in('training_status', ['approved', 'promoted'])
        .gt('success_count', 0)
        .order('success_count', { ascending: false })
        .limit(limit);

      if (intent) {
        query = query.eq('detected_intent', intent);
      }
      if (queryType) {
        query = query.eq('detected_entity', queryType);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching approved training examples:', error);
        return [];
      }

      return (data || []).map(example => ({
        prompt: example.user_prompt,
        response: example.ai_response,
        entity: example.detected_entity,
        operation: example.detected_operation,
        successCount: example.success_count
      }));
    } catch (error) {
      console.error('Error fetching approved training examples:', error);
      return [];
    }
  }

  /**
   * Get learning context for AI - combines entity definitions with approved examples
   */
  async getLearningContext(intent, queryType = null) {
    try {
      // Get approved examples for this intent
      const approvedExamples = await this.getApprovedTrainingExamples(intent, queryType, 5);

      // Get successful historical prompts
      const successfulPrompts = queryType ? await this.getSuccessfulPrompts(queryType, 3) : [];

      if (approvedExamples.length === 0 && successfulPrompts.length === 0) {
        return null;
      }

      let context = '';

      if (approvedExamples.length > 0) {
        context += '\nPREVIOUSLY SUCCESSFUL EXAMPLES:\n';
        approvedExamples.forEach((ex, i) => {
          context += `Example ${i + 1} (used ${ex.successCount}x successfully):\n`;
          context += `  User: "${ex.prompt}"\n`;
          context += `  Response type: ${ex.entity || ex.operation || 'general'}\n`;
        });
      }

      if (successfulPrompts.length > 0) {
        context += '\nUSER PROMPTS THAT WORKED WELL:\n';
        successfulPrompts.forEach((p, i) => {
          context += `- "${p.content}"\n`;
        });
      }

      return context;
    } catch (error) {
      console.error('Error getting learning context:', error);
      return null;
    }
  }

  /**
   * Update training candidate feedback
   * Now uses ai_training_candidates instead of ai_chat_history
   */
  async updateChatFeedback(candidateId, feedback, feedbackText = null) {
    try {
      const isHelpful = feedback === 'helpful';
      const { error } = await masterDbClient
        .from('ai_training_candidates')
        .update({
          was_helpful: isHelpful,
          feedback_text: feedbackText,
          feedback_at: new Date().toISOString(),
          outcome_status: isHelpful ? 'success' : 'failure',
          // Increment success/failure count
          success_count: isHelpful ? masterDbClient.raw('success_count + 1') : undefined,
          failure_count: !isHelpful ? masterDbClient.raw('failure_count + 1') : undefined,
          updated_at: new Date().toISOString()
        })
        .eq('id', candidateId);

      if (error) {
        console.error('Error updating training candidate feedback:', error);
      }
    } catch (error) {
      console.error('Error updating training candidate feedback:', error);
    }
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache = {
      documents: null,
      examples: null,
      patterns: null,
      lastFetch: null,
      ttl: 5 * 60 * 1000
    };
  }

  // ============================================
  // VECTOR SEARCH METHODS (Semantic Similarity)
  // ============================================

  /**
   * Search documents using vector similarity
   * Falls back to keyword search if vector search fails
   */
  async searchDocumentsByVector(query, options = {}) {
    const { limit = 5, threshold = 0.7, mode = null, category = null } = options;

    try {
      const embeddingService = require('./embeddingService');

      // Generate embedding for query
      const queryEmbedding = await embeddingService.generateEmbedding(query);
      const vectorStr = embeddingService.formatVectorForPg(queryEmbedding);

      // Call vector search function
      const { data, error } = await masterDbClient.rpc('search_ai_documents_by_embedding', {
        query_embedding: vectorStr,
        match_threshold: threshold,
        match_count: limit,
        filter_mode: mode,
        filter_category: category
      });

      if (error) {
        console.error('[AIContextService] Vector search error:', error);
        return this.getRelevantDocuments({ mode, category, limit });
      }

      return data || [];
    } catch (error) {
      console.error('[AIContextService] Error in vector search:', error);
      // Fallback to keyword search
      return this.getRelevantDocuments({ mode, category, limit });
    }
  }

  /**
   * Search examples using vector similarity
   */
  async searchExamplesByVector(query, options = {}) {
    const { limit = 3, threshold = 0.7, category = null } = options;

    try {
      const embeddingService = require('./embeddingService');
      const queryEmbedding = await embeddingService.generateEmbedding(query);
      const vectorStr = embeddingService.formatVectorForPg(queryEmbedding);

      const { data, error } = await masterDbClient.rpc('search_ai_examples_by_embedding', {
        query_embedding: vectorStr,
        match_threshold: threshold,
        match_count: limit,
        filter_category: category
      });

      if (error) {
        console.error('[AIContextService] Vector example search error:', error);
        return this.getRelevantExamples({ category, limit });
      }

      return data || [];
    } catch (error) {
      console.error('[AIContextService] Error in vector example search:', error);
      return this.getRelevantExamples({ category, limit });
    }
  }

  /**
   * Search training patterns using vector similarity
   */
  async searchPatternsByVector(query, options = {}) {
    const { limit = 5, threshold = 0.7, entity = null } = options;

    try {
      const embeddingService = require('./embeddingService');
      const queryEmbedding = await embeddingService.generateEmbedding(query);
      const vectorStr = embeddingService.formatVectorForPg(queryEmbedding);

      const { data, error } = await masterDbClient.rpc('search_training_patterns_by_embedding', {
        query_embedding: vectorStr,
        match_threshold: threshold,
        match_count: limit,
        filter_entity: entity
      });

      if (error) {
        console.error('[AIContextService] Vector pattern search error:', error);
        return this.getRelevantPatterns({ entity, limit });
      }

      // Format as patterns for backward compatibility
      return (data || []).map(r => ({
        id: r.id,
        name: `${r.detected_entity || 'general'} - ${r.detected_operation || 'query'}`,
        pattern_type: 'successful_prompt',
        description: r.user_prompt,
        code: r.ai_response,
        similarity: r.similarity,
        usage_count: r.success_count
      }));
    } catch (error) {
      console.error('[AIContextService] Error in vector pattern search:', error);
      return this.getRelevantPatterns({ entity, limit });
    }
  }

  /**
   * Search entity definitions using vector similarity
   */
  async searchEntitiesByVector(query, options = {}) {
    const { limit = 5, threshold = 0.7 } = options;

    try {
      const embeddingService = require('./embeddingService');
      const queryEmbedding = await embeddingService.generateEmbedding(query);
      const vectorStr = embeddingService.formatVectorForPg(queryEmbedding);

      const { data, error } = await masterDbClient.rpc('search_ai_entities_by_embedding', {
        query_embedding: vectorStr,
        match_threshold: threshold,
        match_count: limit
      });

      if (error) {
        console.error('[AIContextService] Vector entity search error:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('[AIContextService] Error in vector entity search:', error);
      return [];
    }
  }

  /**
   * Enhanced getContextForQuery with vector search
   * Uses semantic similarity instead of keyword matching
   */
  async getContextForQueryWithVectors({ mode, category, query, storeId = null, limit = 10, useVectors = true }) {
    // Fall back to keyword search if no query or vectors disabled
    if (!useVectors || !query) {
      return this.getContextForQuery({ mode, category, query, storeId, limit });
    }

    try {
      const context = {
        documents: await this.searchDocumentsByVector(query, { limit: 5, threshold: 0.7, mode, category }),
        examples: await this.searchExamplesByVector(query, { limit: 3, threshold: 0.7, category }),
        patterns: await this.searchPatternsByVector(query, { limit: 5, threshold: 0.7 })
      };

      return this.formatContextForAI(context);
    } catch (error) {
      console.error('[AIContextService] Error in vector context query:', error);
      // Fallback to keyword search
      return this.getContextForQuery({ mode, category, query, storeId, limit });
    }
  }

  /**
   * Find similar existing prompts (for deduplication)
   */
  async findSimilarPrompts(query, threshold = 0.95) {
    try {
      const embeddingService = require('./embeddingService');
      const queryEmbedding = await embeddingService.generateEmbedding(query);
      const vectorStr = embeddingService.formatVectorForPg(queryEmbedding);

      const { data, error } = await masterDbClient.rpc('search_similar_training_candidates', {
        query_embedding: vectorStr,
        similarity_threshold: threshold,
        max_results: 3
      });

      if (error) {
        console.error('[AIContextService] Error finding similar prompts:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('[AIContextService] Error in similarity search:', error);
      return [];
    }
  }
}

module.exports = new AIContextService();
