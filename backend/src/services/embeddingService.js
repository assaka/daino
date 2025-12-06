/**
 * Embedding Service - Vector Embedding Generation using OpenAI
 *
 * Generates and manages vector embeddings for RAG semantic search.
 * Uses OpenAI's text-embedding-3-small (1536 dimensions).
 *
 * Features:
 * - Rate limiting to stay within API limits
 * - Automatic text truncation for long content
 * - Non-blocking embedding generation
 * - Batch processing support
 */

const { masterDbClient } = require('../database/masterConnection');

class EmbeddingService {
  constructor() {
    this.model = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
    this.dimensions = parseInt(process.env.EMBEDDING_DIMENSIONS) || 1536;
    this.maxTokens = 8191; // Max input tokens for embedding model
    this.maxChars = this.maxTokens * 4; // Rough estimate: 4 chars per token
    this.apiKey = process.env.OPENAI_API_KEY;

    // Rate limiting
    this.requestsPerMinute = 3000;
    this.minRequestInterval = 60000 / this.requestsPerMinute; // ~20ms
    this.lastRequestTime = 0;

    // Cache for recently generated embeddings (5 min TTL)
    this.cache = new Map();
    this.cacheTTL = 5 * 60 * 1000;
  }

  /**
   * Generate embedding for a single text
   * @param {string} text - Text to embed
   * @returns {Promise<number[]>} - 1536-dimensional vector
   */
  async generateEmbedding(text) {
    if (!text || typeof text !== 'string') {
      throw new Error('Text must be a non-empty string');
    }

    if (!this.apiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    // Check cache first
    const cacheKey = this.hashText(text);
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return cached.embedding;
    }

    // Truncate if too long
    const truncatedText = text.length > this.maxChars
      ? text.substring(0, this.maxChars)
      : text;

    // Rate limiting
    await this.rateLimitDelay();

    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          input: truncatedText,
          dimensions: this.dimensions
        })
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error?.message || `API error: ${response.status}`);
      }

      const embedding = data.data[0].embedding;

      // Cache the result
      this.cache.set(cacheKey, {
        embedding,
        expiry: Date.now() + this.cacheTTL
      });

      // Clean old cache entries periodically
      if (this.cache.size > 1000) {
        this.cleanCache();
      }

      return embedding;
    } catch (error) {
      console.error('[EmbeddingService] Error generating embedding:', error.message);
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple texts (sequential with rate limiting)
   * @param {string[]} texts - Array of texts to embed
   * @returns {Promise<(number[]|null)[]>} - Array of embeddings (null for failures)
   */
  async generateEmbeddings(texts) {
    const embeddings = [];

    for (const text of texts) {
      try {
        const embedding = await this.generateEmbedding(text);
        embeddings.push(embedding);
      } catch (error) {
        console.error(`[EmbeddingService] Failed to embed text: ${error.message}`);
        embeddings.push(null);
      }
    }

    return embeddings;
  }

  /**
   * Rate limit delay
   */
  async rateLimitDelay() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.minRequestInterval) {
      await new Promise(resolve =>
        setTimeout(resolve, this.minRequestInterval - timeSinceLastRequest)
      );
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Format vector for PostgreSQL pgvector
   * @param {number[]} embedding - Embedding array
   * @returns {string} - PostgreSQL vector string
   */
  formatVectorForPg(embedding) {
    return `[${embedding.join(',')}]`;
  }

  /**
   * Simple hash for cache key
   */
  hashText(text) {
    let hash = 0;
    for (let i = 0; i < Math.min(text.length, 1000); i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString();
  }

  /**
   * Clean expired cache entries
   */
  cleanCache() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (value.expiry < now) {
        this.cache.delete(key);
      }
    }
  }

  // ============================================
  // TABLE-SPECIFIC EMBEDDING METHODS
  // ============================================

  /**
   * Embed and store for ai_context_documents
   * @param {number} documentId - Document ID
   */
  async embedContextDocument(documentId) {
    const { data: doc, error } = await masterDbClient
      .from('ai_context_documents')
      .select('id, title, content, category, type')
      .eq('id', documentId)
      .single();

    if (error || !doc) {
      throw new Error(`Document not found: ${documentId}`);
    }

    // Combine fields for richer embedding
    const textToEmbed = `${doc.title}\n\n${doc.content}`;
    const embedding = await this.generateEmbedding(textToEmbed);

    const { error: updateError } = await masterDbClient
      .from('ai_context_documents')
      .update({
        embedding: this.formatVectorForPg(embedding),
        embedding_updated_at: new Date().toISOString()
      })
      .eq('id', documentId);

    if (updateError) {
      throw updateError;
    }

    return { success: true, documentId };
  }

  /**
   * Embed and store for ai_plugin_examples
   * @param {number} exampleId - Example ID
   */
  async embedPluginExample(exampleId) {
    const { data: example, error } = await masterDbClient
      .from('ai_plugin_examples')
      .select('id, name, description, category, use_cases, features')
      .eq('id', exampleId)
      .single();

    if (error || !example) {
      throw new Error(`Example not found: ${exampleId}`);
    }

    const useCases = Array.isArray(example.use_cases)
      ? example.use_cases.join(', ')
      : (typeof example.use_cases === 'string' ? example.use_cases : '');
    const features = Array.isArray(example.features)
      ? example.features.join(', ')
      : (typeof example.features === 'string' ? example.features : '');

    const textToEmbed = `${example.name}\n${example.description}\nUse cases: ${useCases}\nFeatures: ${features}`;
    const embedding = await this.generateEmbedding(textToEmbed);

    const { error: updateError } = await masterDbClient
      .from('ai_plugin_examples')
      .update({
        embedding: this.formatVectorForPg(embedding),
        embedding_updated_at: new Date().toISOString()
      })
      .eq('id', exampleId);

    if (updateError) {
      throw updateError;
    }

    return { success: true, exampleId };
  }

  /**
   * Embed and store for ai_entity_definitions
   * @param {number} entityId - Entity ID
   */
  async embedEntityDefinition(entityId) {
    const { data: entity, error } = await masterDbClient
      .from('ai_entity_definitions')
      .select('id, entity_name, display_name, description, intent_keywords, example_prompts')
      .eq('id', entityId)
      .single();

    if (error || !entity) {
      throw new Error(`Entity not found: ${entityId}`);
    }

    const keywords = Array.isArray(entity.intent_keywords)
      ? entity.intent_keywords.join(', ')
      : (typeof entity.intent_keywords === 'string' ? entity.intent_keywords : '');
    const prompts = Array.isArray(entity.example_prompts)
      ? entity.example_prompts.join('\n')
      : (typeof entity.example_prompts === 'string' ? entity.example_prompts : '');

    const textToEmbed = `${entity.display_name}: ${entity.description}\nKeywords: ${keywords}\nExample prompts:\n${prompts}`;
    const embedding = await this.generateEmbedding(textToEmbed);

    const { error: updateError } = await masterDbClient
      .from('ai_entity_definitions')
      .update({
        embedding: this.formatVectorForPg(embedding),
        embedding_updated_at: new Date().toISOString()
      })
      .eq('id', entityId);

    if (updateError) {
      throw updateError;
    }

    return { success: true, entityId };
  }

  /**
   * Embed and store for ai_training_candidates
   * @param {string} candidateId - Candidate UUID
   */
  async embedTrainingCandidate(candidateId) {
    const { data: candidate, error } = await masterDbClient
      .from('ai_training_candidates')
      .select('id, user_prompt, detected_entity, detected_operation')
      .eq('id', candidateId)
      .single();

    if (error || !candidate) {
      throw new Error(`Candidate not found: ${candidateId}`);
    }

    const textToEmbed = `${candidate.user_prompt} [${candidate.detected_entity || 'general'}:${candidate.detected_operation || 'query'}]`;
    const embedding = await this.generateEmbedding(textToEmbed);

    const { error: updateError } = await masterDbClient
      .from('ai_training_candidates')
      .update({
        embedding: this.formatVectorForPg(embedding),
        embedding_updated_at: new Date().toISOString()
      })
      .eq('id', candidateId);

    if (updateError) {
      throw updateError;
    }

    return { success: true, candidateId };
  }

  /**
   * Embed content and insert as new context document
   * @param {object} document - Document data
   * @returns {Promise<{success: boolean, documentId: number}>}
   */
  async embedAndInsertDocument(document) {
    const textToEmbed = `${document.title}\n\n${document.content}`;
    const embedding = await this.generateEmbedding(textToEmbed);

    const { data, error } = await masterDbClient
      .from('ai_context_documents')
      .insert({
        type: document.type || 'reference',
        title: document.title,
        content: document.content,
        category: document.category || 'general',
        tags: document.tags || [],
        priority: document.priority || 50,
        mode: document.mode || 'all',
        is_active: true,
        metadata: document.metadata || {},
        embedding: this.formatVectorForPg(embedding),
        embedding_updated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (error) {
      throw error;
    }

    return { success: true, documentId: data.id };
  }

  // ============================================
  // ASYNC (NON-BLOCKING) EMBEDDING METHODS
  // ============================================

  /**
   * Generate embedding asynchronously (non-blocking)
   * Use this after insert operations to not slow down the response
   */
  embedContextDocumentAsync(documentId) {
    setImmediate(async () => {
      try {
        await this.embedContextDocument(documentId);
        console.log(`[EmbeddingService] Embedded document ${documentId}`);
      } catch (err) {
        console.error(`[EmbeddingService] Failed to embed document ${documentId}:`, err.message);
      }
    });
  }

  embedPluginExampleAsync(exampleId) {
    setImmediate(async () => {
      try {
        await this.embedPluginExample(exampleId);
        console.log(`[EmbeddingService] Embedded example ${exampleId}`);
      } catch (err) {
        console.error(`[EmbeddingService] Failed to embed example ${exampleId}:`, err.message);
      }
    });
  }

  embedEntityDefinitionAsync(entityId) {
    setImmediate(async () => {
      try {
        await this.embedEntityDefinition(entityId);
        console.log(`[EmbeddingService] Embedded entity ${entityId}`);
      } catch (err) {
        console.error(`[EmbeddingService] Failed to embed entity ${entityId}:`, err.message);
      }
    });
  }

  embedTrainingCandidateAsync(candidateId) {
    setImmediate(async () => {
      try {
        await this.embedTrainingCandidate(candidateId);
        console.log(`[EmbeddingService] Embedded training candidate ${candidateId}`);
      } catch (err) {
        console.error(`[EmbeddingService] Failed to embed candidate ${candidateId}:`, err.message);
      }
    });
  }
}

module.exports = new EmbeddingService();
