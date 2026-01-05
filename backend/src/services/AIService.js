// backend/src/services/AIService.js
const ConnectionManager = require('./database/ConnectionManager');
const { masterDbClient } = require('../database/masterConnection');
const creditService = require('./credit-service'); // Generic credit service
const aiContextService = require('./aiContextService'); // RAG system
const aiProvider = require('./ai-provider-service'); // Unified AI provider
const ServiceCreditCost = require('../models/ServiceCreditCost');
const AIModel = require('../models/AIModel');
const aiModelsService = require('./AIModelsService'); // Centralized model config
const { buildPluginGenerationPrompt, parsePluginResponse } = require('./plugin-generation-context'); // Plugin generation

/**
 * Centralized AI Service
 * Handles AI model interactions, credit management, and usage tracking
 * Integrates with RAG (Retrieval-Augmented Generation) for better context
 * Now uses unified AIProviderService for all provider management
 *
 * Model configurations are fetched from ai_models database table via AIModelsService
 */
class AIService {
  constructor() {
    // Map operation types to service keys in service_credit_costs table
    this.serviceKeyMap = {
      'plugin-generation': 'custom_plugin_creation',
      'plugin-modification': 'ai_code_patch',
      'translation': 'ai_translation',
      'layout-generation': 'ai_layout_generation',
      'code-patch': 'ai_code_patch',
      'general': 'ai_chat'
    };

    // Fallback costs for operation types (not model-specific)
    this.operationFallbackCosts = {
      'plugin-generation': 50,
      'plugin-modification': 30,
      'translation': 20,
      'layout-generation': 40,
      'code-patch': 25,
      'general': 10
    };

    // Initialize models service on first use
    this._initialized = false;
  }

  /**
   * Ensure AIModelsService is initialized
   */
  async _ensureInitialized() {
    if (!this._initialized) {
      await aiModelsService.initialize();
      this._initialized = true;
    }
  }

  /**
   * Get default model from database
   */
  async getDefaultModel() {
    await this._ensureInitialized();
    return await aiModelsService.getDefaultModel('anthropic');
  }

  /**
   * Get model configuration from model ID
   * Fetches from ai_models database table via AIModelsService
   */
  async getModelConfigFromDb(modelId) {
    await this._ensureInitialized();
    return await aiModelsService.getModelConfig(modelId);
  }

  /**
   * Get model configuration from model ID (sync version using cache)
   */
  getModelConfig(modelId) {
    return aiModelsService.getModelConfigSync(modelId);
  }

  /**
   * Get cost for an operation type from the service_credit_costs table
   * @param {string} operationType - Operation type (e.g., 'general', 'plugin-generation')
   * @param {string} serviceKey - Optional explicit service key (e.g., 'ai_chat_claude_sonnet')
   * @param {string} modelId - Optional model ID for model-specific pricing
   */
  async getOperationCost(operationType, serviceKey = null, modelId = null) {
    await this._ensureInitialized();

    // If explicit serviceKey is provided, use it directly
    let resolvedServiceKey = serviceKey;

    // If modelId is provided, get service key from database
    if (!resolvedServiceKey && modelId) {
      resolvedServiceKey = await aiModelsService.getServiceKey(modelId);
    }

    // Fall back to operation type service key
    if (!resolvedServiceKey) {
      resolvedServiceKey = this.serviceKeyMap[operationType];
    }

    if (!resolvedServiceKey) {
      console.warn(`⚠️ Unknown operation type: ${operationType}, using fallback cost`);
      const modelCost = modelId ? await aiModelsService.getFallbackCost(modelId) : null;
      return modelCost || this.operationFallbackCosts[operationType] || this.operationFallbackCosts.general;
    }

    try {
      const cost = await ServiceCreditCost.getCostByKey(resolvedServiceKey);
      console.log(`💰 Cost lookup: ${resolvedServiceKey} = ${cost} credits`);
      return parseFloat(cost);
    } catch (error) {
      console.warn(`⚠️ Could not fetch cost for ${resolvedServiceKey}, using fallback:`, error.message);
      const modelCost = modelId ? await aiModelsService.getFallbackCost(modelId) : null;
      return modelCost || this.operationFallbackCosts[operationType] || this.operationFallbackCosts.general;
    }
  }

  /**
   * Check if user has sufficient credits
   */
  async checkCredits(userId, operationType, serviceKey = null, modelId = null) {
    const cost = await this.getOperationCost(operationType, serviceKey, modelId);

    // Query master DB for user credits
    const { data: user, error } = await masterDbClient
      .from('users')
      .select('credits')
      .eq('id', userId)
      .maybeSingle();

    if (error || !user || user.credits < cost) {
      return {
        hasCredits: false,
        required: cost,
        available: user?.credits || 0
      };
    }

    return {
      hasCredits: true,
      required: cost,
      available: user.credits
    };
  }

  /**
   * Deduct credits from user account
   */
  async deductCredits(userId, operationType, metadata = {}) {
    const cost = await this.getOperationCost(operationType, metadata.serviceKey, metadata.modelId);

    // Get store_id - try to get user's active store if not provided
    let storeId = metadata.storeId;
    if (!storeId) {
      // Get first active store owned by this user (not just any store in DB)
      const { data: store } = await masterDbClient
        .from('stores')
        .select('id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      storeId = store?.id || null;
    }

    // Map operation types to usage_type values
    const usageTypeMap = {
      'plugin-generation': 'ai_plugin_generation',
      'plugin-modification': 'ai_plugin_modification',
      'translation': 'ai_translation',
      'layout-generation': 'ai_layout',
      'code-patch': 'ai_code_patch',
      'general': 'ai_chat'
    };
    const usageType = usageTypeMap[operationType] || 'ai_other';

    // Use generic credit service - logs to master DB credit_usage
    const result = await creditService.deduct(
      userId,
      storeId,
      cost,
      `AI Studio: ${operationType}`,
      {
        ...metadata,
        operationType,
        serviceKey: metadata.serviceKey,
        modelId: metadata.modelId
      },
      metadata.referenceId || null,
      usageType
    );

    console.log(`💳 Credits deducted: ${cost} for ${operationType} (user: ${userId}, store: ${storeId || 'none'})`);

    return cost;
  }

  /**
   * Log AI usage for analytics (tenant data)
   */
  async logUsage(userId, operationType, metadata = {}) {
    // Get storeId from metadata - don't fallback to first store (could be inactive)
    const storeId = metadata.storeId;

    if (!storeId) {
      console.warn('No storeId in metadata for AI usage logging, skipping tenant logging');
      return;
    }

    try {
      // Get tenant connection for AI usage logs
      const connection = await ConnectionManager.getStoreConnection(storeId);

      const { error } = await connection
        .from('ai_usage_logs')
        .insert({
          user_id: userId,
          operation_type: operationType,
          model_used: metadata.model || this.defaultModel,
          tokens_input: metadata.tokensInput || 0,
          tokens_output: metadata.tokensOutput || 0,
          metadata: metadata,
          created_at: new Date().toISOString()
        });

      if (error) {
        console.error('Failed to log AI usage:', error);
        // Don't throw - logging failure shouldn't break the operation
      }
    } catch (connectionError) {
      console.warn('Failed to connect to tenant DB for AI usage logging:', connectionError.message);
      // Don't throw - logging failure shouldn't break the operation
    }
  }

  /**
   * Generate AI response with credit deduction
   */
  async generate(options) {
    await this._ensureInitialized();

    // Get default model from database
    const defaultModel = await this.getDefaultModel();

    const {
      userId,
      operationType,
      prompt,
      systemPrompt = '',
      model = defaultModel,
      modelId = null, // User-selected model ID (e.g., 'claude-sonnet')
      serviceKey = null, // Explicit service key for cost lookup
      maxTokens = 4096,
      temperature = 0.7,
      metadata = {},
      images = null // Array of { base64, type } for vision support
    } = options;

    // Get model configuration if modelId provided (from database)
    const modelConfig = modelId ? await aiModelsService.getModelConfig(modelId) : null;
    const provider = modelConfig?.provider || 'anthropic';
    const actualModel = modelConfig?.model || model;

    console.log(`🤖 AI Generate: modelId=${modelId}, provider=${provider}, model=${actualModel}`);

    // Validate user has credits (with model-specific pricing)
    const creditCheck = await this.checkCredits(userId, operationType, serviceKey, modelId);
    console.log(`💳 Credit check: userId=${userId}, required=${creditCheck.required}, available=${creditCheck.available}, hasCredits=${creditCheck.hasCredits}`);

    if (!creditCheck.hasCredits) {
      console.log(`❌ Insufficient credits for user ${userId}. Required: ${creditCheck.required}, Available: ${creditCheck.available}`);
      throw new Error(
        `Insufficient credits. Required: ${creditCheck.required}, Available: ${creditCheck.available}`
      );
    }

    try {
      // Prepare messages
      const messages = [
        {
          role: 'user',
          content: prompt
        }
      ];

      // Use unified AI provider service with selected model
      const response = await aiProvider.chat(messages, {
        provider,
        model: actualModel,
        maxTokens,
        temperature,
        systemPrompt,
        images // Pass images for vision support
      });

      // Extract response
      const content = response.content;
      const usage = {
        tokensInput: response.usage.input_tokens,
        tokensOutput: response.usage.output_tokens,
        model: response.model
      };

      // Deduct credits (with model-specific pricing)
      await this.deductCredits(userId, operationType, {
        ...metadata,
        ...usage,
        modelId,
        serviceKey
      });

      // Log usage
      await this.logUsage(userId, operationType, {
        ...metadata,
        ...usage,
        modelId,
        provider
      });

      const cost = await this.getOperationCost(operationType, serviceKey, modelId);

      return {
        success: true,
        content,
        usage,
        creditsDeducted: cost
      };

    } catch (error) {
      console.error('AI Generation Error:', error);

      // Log error but don't deduct credits
      await this.logUsage(userId, operationType, {
        ...metadata,
        error: error.message,
        failed: true
      });

      throw error;
    }
  }

  /**
   * Stream AI response with credit deduction
   */
  async *generateStream(options) {
    await this._ensureInitialized();

    // Get default model from database
    const defaultModel = await this.getDefaultModel();

    const {
      userId,
      operationType,
      prompt,
      systemPrompt = '',
      model = defaultModel,
      modelId = null,
      maxTokens = 4096,
      temperature = 0.7,
      metadata = {}
    } = options;

    // Get model configuration if modelId provided (from database)
    const modelConfig = modelId ? await aiModelsService.getModelConfig(modelId) : null;
    const provider = modelConfig?.provider || 'anthropic';
    const actualModel = modelConfig?.model || model;

    // Validate user has credits
    const creditCheck = await this.checkCredits(userId, operationType, null, modelId);
    if (!creditCheck.hasCredits) {
      throw new Error(
        `Insufficient credits. Required: ${creditCheck.required}, Available: ${creditCheck.available}`
      );
    }

    try {
      // Prepare messages
      const messages = [
        {
          role: 'user',
          content: prompt
        }
      ];

      // Use unified AI provider service for streaming
      const stream = await aiProvider.streamWithThinking(messages, {
        model: actualModel,
        maxTokens,
        temperature,
        systemPrompt
      });

      let fullContent = '';
      let usage = {
        tokensInput: 0,
        tokensOutput: 0,
        model: actualModel
      };

      // Yield chunks as they arrive
      for await (const event of stream) {
        if (event.type === 'text') {
          fullContent += event.text;
          yield event.text;
        }

        if (event.type === 'done' && event.usage) {
          usage.tokensInput = event.usage.input_tokens;
          usage.tokensOutput = event.usage.output_tokens;
        }
      }

      // Deduct credits after stream completes
      await this.deductCredits(userId, operationType, {
        ...metadata,
        ...usage
      });

      // Log usage
      await this.logUsage(userId, operationType, {
        ...metadata,
        ...usage
      });

    } catch (error) {
      console.error('AI Stream Error:', error);

      await this.logUsage(userId, operationType, {
        ...metadata,
        error: error.message,
        failed: true
      });

      throw error;
    }
  }

  /**
   * Get user's remaining credits
   */
  async getRemainingCredits(userId) {
    const { data: user, error } = await masterDbClient
      .from('users')
      .select('credits')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Failed to fetch user credits:', error);
      return 0;
    }

    return user?.credits || 0;
  }


  /**
   * Get user's AI usage history (tenant data)
   */
  async getUserUsageHistory(userId, limit = 50, storeId = null) {
    // Get storeId if not provided
    if (!storeId) {
      const { data: store } = await masterDbClient
        .from('stores')
        .select('id')
        .limit(1)
        .maybeSingle();
      storeId = store?.id;
    }

    if (!storeId) {
      console.warn('No store found for AI usage history');
      return [];
    }

    // Get tenant connection for AI usage logs
    const connection = await ConnectionManager.getStoreConnection(storeId);

    const { data, error } = await connection
      .from('ai_usage_logs')
      .select('operation_type, model_used, tokens_input, tokens_output, metadata, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Failed to fetch AI usage history:', error);
      return [];
    }

    return data || [];
  }

  /**
   * ========================================
   * SPECIALIZED OPERATION METHODS
   * ========================================
   */

  /**
   * Generate plugin with RAG context
   * Uses existing plugin architecture knowledge from database
   */
  async generatePlugin(userId, prompt, metadata = {}) {
    // Fetch RAG context for plugin generation (optional additional context)
    let ragContext = '';
    try {
      ragContext = await aiContextService.getContextForQuery({
        mode: 'developer',
        category: metadata.category || 'general',
        query: prompt,
        storeId: metadata.storeId,
        limit: 5
      }) || '';
    } catch (e) {
      console.log('RAG context fetch skipped:', e.message);
    }

    // Use the comprehensive plugin generation prompt with export format
    const systemPrompt = buildPluginGenerationPrompt(ragContext);

    console.log('🔌 Generating plugin with new export format schema');

    const result = await this.generate({
      userId,
      operationType: 'plugin-generation',
      modelId: metadata.modelId, // Use user-selected model if provided
      serviceKey: metadata.serviceKey,
      prompt,
      systemPrompt,
      maxTokens: 4096,
      temperature: 0.7,
      metadata
    });

    // Parse the JSON response using centralized parser
    try {
      const pluginData = parsePluginResponse(result.content);

      // Normalize plugin data to ensure consistent structure
      // Handle both new export format and legacy format
      const normalizedData = {
        // Core plugin info
        name: pluginData.plugin?.name || pluginData.name,
        slug: pluginData.plugin?.slug || pluginData.slug || (pluginData.plugin?.name || pluginData.name || '').toLowerCase().replace(/\s+/g, '-'),
        version: pluginData.plugin?.version || pluginData.version || '1.0.0',
        description: pluginData.plugin?.description || pluginData.description || '',
        author: pluginData.plugin?.author || pluginData.author || 'AI Generated',
        category: pluginData.plugin?.category || pluginData.category || 'utility',
        tags: pluginData.plugin?.tags || pluginData.tags || [],

        // New export format fields
        widgets: pluginData.widgets || [],
        controllers: pluginData.controllers || [],
        entities: pluginData.entities || [],
        migrations: pluginData.migrations || [],
        events: pluginData.events || [],
        hooks: pluginData.hooks || [],
        files: pluginData.files || [],
        pluginData: pluginData.pluginData || [],
        pluginDocs: pluginData.pluginDocs || [],
        adminPages: pluginData.adminPages || [],

        // Keep original for reference
        _raw: pluginData
      };

      console.log('✅ Plugin parsed successfully:', normalizedData.name);

      return {
        ...result,
        pluginData: normalizedData
      };
    } catch (error) {
      console.error('❌ Plugin Parse Error:', error.message);
      console.error('📄 AI response preview:', result.content?.substring(0, 500));
      throw new Error(`Failed to parse plugin data: ${error.message}`);
    }
  }

  /**
   * Save generated plugin to database (call this separately when user wants to create)
   */
  async savePluginToDatabase(pluginData, userId, metadata = {}) {
    try {
      const { randomUUID } = require('crypto');
      const pluginId = randomUUID();
      const slug = pluginData.slug || pluginData.name.toLowerCase().replace(/\s+/g, '-');

      // Validate userId is a proper UUID or null
      if (userId && typeof userId !== 'string') {
        throw new Error('Invalid userId format');
      }

      // Get storeId from metadata or use first store
      let storeId = metadata.storeId;
      if (!storeId) {
        const { data: store } = await masterDbClient
          .from('stores')
          .select('id')
          .limit(1)
          .maybeSingle();
        storeId = store?.id;
      }

      if (!storeId) {
        throw new Error('No store found for plugin creation');
      }

      // Build clean manifest matching starter template structure EXACTLY
      const cleanManifest = {
        name: pluginData.name,
        tags: pluginData.tags || [
          pluginData.category || 'utility',
          'ai-generated'
        ],
        author: pluginData.author || 'AI Generated',
        version: pluginData.version || '1.0.0',
        category: pluginData.category || 'utility',
        homepage: pluginData.homepage || null,
        repository: pluginData.repository || null,
        description: pluginData.description || '',
        permissions: pluginData.permissions || [],
        adminNavigation: pluginData.manifest?.adminNavigation ? {
          icon: pluginData.manifest.adminNavigation.icon || 'Package',
          label: pluginData.manifest.adminNavigation.label || pluginData.name,
          order: pluginData.manifest.adminNavigation.order || 100,
          route: pluginData.manifest.adminNavigation.route || `/admin/plugins/${slug}`,
          enabled: pluginData.manifest.adminNavigation.enabled !== false,
          parentKey: pluginData.manifest.adminNavigation.parentKey || null,
          category: pluginData.manifest.adminNavigation.category || pluginData.category || 'utility',
          description: pluginData.manifest.adminNavigation.description || pluginData.description
        } : null
      };

      // Get tenant connection for plugin data
      const connection = await ConnectionManager.getStoreConnection(storeId);

      // Insert into plugin_registry (tenant DB)
      const { error: insertError } = await connection
        .from('plugin_registry')
        .insert({
          id: pluginId,
          name: pluginData.name,
          slug: slug,
          version: pluginData.version || '1.0.0',
          description: pluginData.description || '',
          author: pluginData.author || 'AI Generated',
          category: pluginData.category || 'utility',
          status: 'active',
          type: 'ai-generated',
          framework: 'react',
          manifest: cleanManifest,
          creator_id: userId || null,
          is_installed: true,
          is_enabled: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (insertError) {
        throw new Error(`Failed to insert plugin: ${insertError.message}`);
      }

      console.log(`✅ Plugin saved to registry: ${pluginData.name} (${pluginId})`);
      console.log(`  📋 Manifest stored in plugin_registry.manifest column`);

      // Generate README.md content
      const readmeContent = `# ${pluginData.name}

${pluginData.description || 'AI-generated plugin for DainoStore e-commerce platform'}

## Features

${pluginData.features ? pluginData.features.map(f => `- ${f}`).join('\n') : '- Custom functionality'}

## Installation

This plugin was generated by AI and installed automatically.

## Configuration

${pluginData.config_schema?.fields ?
  'Configure this plugin in the admin panel:\n\n' +
  pluginData.config_schema.fields.map(f => `- **${f.label}**: ${f.type}`).join('\n')
  : 'No configuration required.'}

## Usage

${pluginData.explanation || 'This plugin is ready to use.'}

## Hooks

${pluginData.hooks && pluginData.hooks.length > 0 ?
  pluginData.hooks.map(h => `- \`${h.name || h}\``).join('\n')
  : 'No hooks registered.'}

## Version

- **Version**: ${pluginData.version || '1.0.0'}
- **Author**: ${pluginData.author || 'AI Generated'}
- **Category**: ${pluginData.category || 'utility'}
- **Generated**: ${new Date().toISOString()}

## Support

For issues or questions, please contact the platform administrator.
`;

      // Save README.md to plugin_docs (for file tree display)
      const { error: docsError } = await connection
        .from('plugin_docs')
        .insert({
          plugin_id: pluginId,
          doc_type: 'readme',
          file_name: 'README.md',
          content: readmeContent,
          format: 'markdown',
          is_visible: true,
          display_order: 1,
          title: pluginData.name,
          description: pluginData.description || ''
        });

      if (docsError) {
        console.warn('Failed to save README.md:', docsError);
      } else {
        console.log(`  📄 Saved README.md to plugin_docs`);
      }

      // Save generated files to plugin_scripts table with proper directory structure
      if (pluginData.generatedFiles && pluginData.generatedFiles.length > 0) {
        console.log(`  📦 Processing ${pluginData.generatedFiles.length} generated files...`);

        for (const file of pluginData.generatedFiles) {
          let fileName = file.name || file.filename || 'unknown.js';
          const fileContent = file.code || file.content || '';

          console.log(`  🔍 Checking file: ${fileName}`);

          // Skip if AI generated manifest.json or README.md (we create our own)
          const baseFileName = fileName.split('/').pop().toLowerCase();
          if (baseFileName === 'manifest.json' || baseFileName === 'readme.md') {
            console.log(`  ⏭️  SKIPPED ${fileName} (auto-generated by system)`);
            continue;
          }

          // Skip index.js if AI generated it (we don't use index.js)
          if (baseFileName === 'index.js' && !fileName.includes('components/')) {
            console.log(`  ⏭️  SKIPPED ${fileName} (database-driven system doesn't use index.js)`);
            continue;
          }

          // Ensure proper directory structure
          // If file doesn't have a path prefix, add 'src/'
          if (!fileName.includes('/') && !fileName.includes('\\')) {
            fileName = `src/${fileName}`;
          }

          if (fileContent) {
            const { error: scriptError } = await connection
              .from('plugin_scripts')
              .insert({
                plugin_id: pluginId,
                file_name: fileName,
                file_content: fileContent,
                script_type: 'js',
                scope: 'frontend',
                load_priority: 0,
                is_enabled: true
              });

            if (scriptError) {
              console.warn(`Failed to save script ${fileName}:`, scriptError);
            } else {
              console.log(`  📄 Saved script: ${fileName}`);
            }
          }
        }
      }

      // Save hooks to plugin_hooks table (from hooks array with inline code)
      const hooks = pluginData.hooks || [];
      if (hooks && hooks.length > 0) {
        for (const hook of hooks) {
          const hookName = hook.name || hook;
          const hookCode = hook.code || `function(value, context) { return value; }`;
          const priority = hook.priority || 10;

          const { error: hookError } = await connection
            .from('plugin_hooks')
            .insert({
              plugin_id: pluginId,
              hook_name: hookName,
              handler_function: hookCode,
              priority: priority,
              is_enabled: true
            });

          if (hookError) {
            console.warn(`Failed to register hook ${hookName}:`, hookError);
          } else {
            console.log(`  🪝 Registered hook: ${hookName}`);
          }
        }
      }

      // Save events to plugin_events table (from events array with inline code)
      const events = pluginData.events || [];
      if (events && events.length > 0) {
        for (const event of events) {
          const eventName = event.eventName || event.name || event;
          const eventCode = event.listenerCode || event.code || `function(eventData, context) { console.log('Event triggered'); }`;
          const priority = event.priority || 10;

          const { error: eventError } = await connection
            .from('plugin_events')
            .insert({
              plugin_id: pluginId,
              event_name: eventName,
              listener_function: eventCode,
              priority: priority,
              is_enabled: true
            });

          if (eventError) {
            console.warn(`Failed to register event ${eventName}:`, eventError);
          } else {
            console.log(`  📡 Registered event: ${eventName}`);
          }
        }
      }

      // ═══════════════════════════════════════════════════════════════════
      // NEW EXPORT FORMAT: Save widgets to plugin_widgets table
      // ═══════════════════════════════════════════════════════════════════
      const widgets = pluginData.widgets || [];
      if (widgets.length > 0) {
        console.log(`  🧩 Processing ${widgets.length} widgets...`);
        for (const widget of widgets) {
          const { error: widgetError } = await connection
            .from('plugin_widgets')
            .insert({
              plugin_id: pluginId,
              widget_id: widget.widgetId || widget.id || `${slug}-widget-${Date.now()}`,
              widget_name: widget.widgetName || widget.name,
              description: widget.description || '',
              component_code: widget.componentCode || widget.code,
              default_config: widget.defaultConfig || widget.config || {},
              category: widget.category || pluginData.category || 'utility',
              icon: widget.icon || 'Package',
              is_enabled: true
            });

          if (widgetError) {
            console.warn(`Failed to save widget ${widget.widgetName}:`, widgetError);
          } else {
            console.log(`  🧩 Saved widget: ${widget.widgetName || widget.name}`);
          }
        }
      }

      // ═══════════════════════════════════════════════════════════════════
      // NEW EXPORT FORMAT: Save controllers to plugin_controllers table
      // ═══════════════════════════════════════════════════════════════════
      const controllers = pluginData.controllers || [];
      if (controllers.length > 0) {
        console.log(`  🎮 Processing ${controllers.length} controllers...`);
        for (const controller of controllers) {
          const { error: controllerError } = await connection
            .from('plugin_controllers')
            .insert({
              plugin_id: pluginId,
              name: controller.name,
              method: controller.method || 'GET',
              path: controller.path,
              handler_code: controller.code || controller.handlerCode,
              description: controller.description || '',
              is_enabled: true
            });

          if (controllerError) {
            console.warn(`Failed to save controller ${controller.name}:`, controllerError);
          } else {
            console.log(`  🎮 Saved controller: ${controller.method} ${controller.path}`);
          }
        }
      }

      // ═══════════════════════════════════════════════════════════════════
      // NEW EXPORT FORMAT: Run migrations for entities
      // ═══════════════════════════════════════════════════════════════════
      const migrations = pluginData.migrations || [];
      if (migrations.length > 0) {
        console.log(`  🗄️  Running ${migrations.length} migrations...`);
        for (const migration of migrations) {
          try {
            // Execute the migration SQL
            const migrationCode = migration.code || migration.sql;
            if (migrationCode) {
              await connection.query(migrationCode);
              console.log(`  🗄️  Executed migration: ${migration.name}`);

              // Record migration in plugin_migrations table
              await connection
                .from('plugin_migrations')
                .insert({
                  plugin_id: pluginId,
                  migration_name: migration.name,
                  migration_version: migration.migrationVersion || migration.version || Date.now().toString(),
                  executed_at: new Date().toISOString()
                });
            }
          } catch (migrationError) {
            console.warn(`Migration ${migration.name} failed:`, migrationError.message);
            // Continue with other migrations
          }
        }
      }

      // ═══════════════════════════════════════════════════════════════════
      // NEW EXPORT FORMAT: Save plugin data (config, settings)
      // ═══════════════════════════════════════════════════════════════════
      const pluginDataItems = pluginData.pluginData || [];
      if (pluginDataItems.length > 0) {
        console.log(`  💾 Saving ${pluginDataItems.length} plugin data items...`);
        for (const item of pluginDataItems) {
          const { error: dataError } = await connection
            .from('plugin_data')
            .insert({
              plugin_id: pluginId,
              key: item.key,
              value: item.value
            });

          if (dataError) {
            console.warn(`Failed to save plugin data ${item.key}:`, dataError);
          } else {
            console.log(`  💾 Saved plugin data: ${item.key}`);
          }
        }
      }

      // ═══════════════════════════════════════════════════════════════════
      // NEW EXPORT FORMAT: Save additional docs
      // ═══════════════════════════════════════════════════════════════════
      const pluginDocs = pluginData.pluginDocs || [];
      if (pluginDocs.length > 0) {
        for (const doc of pluginDocs) {
          // Skip README if we already created one
          if (doc.title === 'README' || doc.fileName === 'README.md') continue;

          const { error: docError } = await connection
            .from('plugin_docs')
            .insert({
              plugin_id: pluginId,
              doc_type: doc.category || 'general',
              file_name: doc.fileName || `${doc.title}.md`,
              content: doc.content,
              format: 'markdown',
              is_visible: true,
              display_order: doc.orderPosition || 10,
              title: doc.title,
              description: ''
            });

          if (docError) {
            console.warn(`Failed to save doc ${doc.title}:`, docError);
          }
        }
      }

      // ═══════════════════════════════════════════════════════════════════
      // NEW EXPORT FORMAT: Save admin pages
      // ═══════════════════════════════════════════════════════════════════
      const adminPages = pluginData.adminPages || [];
      if (adminPages.length > 0) {
        console.log(`  📱 Saving ${adminPages.length} admin pages...`);
        for (const page of adminPages) {
          const { error: pageError } = await connection
            .from('plugin_admin_pages')
            .insert({
              plugin_id: pluginId,
              page_name: page.pageName || page.name,
              slug: page.slug,
              icon: page.icon || 'Settings',
              component_code: page.componentCode || page.code,
              description: page.description || '',
              is_enabled: true
            });

          if (pageError) {
            console.warn(`Failed to save admin page ${page.pageName}:`, pageError);
          } else {
            console.log(`  📱 Saved admin page: ${page.pageName || page.name}`);
          }
        }
      }

      // ═══════════════════════════════════════════════════════════════════
      // NEW EXPORT FORMAT: Save files (global scripts)
      // ═══════════════════════════════════════════════════════════════════
      const files = pluginData.files || [];
      if (files.length > 0) {
        console.log(`  📦 Saving ${files.length} files...`);
        for (const file of files) {
          const { error: fileError } = await connection
            .from('plugin_scripts')
            .insert({
              plugin_id: pluginId,
              file_name: file.name,
              file_content: file.content || file.code,
              script_type: file.type || 'js',
              scope: file.scope || 'frontend',
              load_priority: file.priority || 0,
              is_enabled: true
            });

          if (fileError) {
            console.warn(`Failed to save file ${file.name}:`, fileError);
          } else {
            console.log(`  📦 Saved file: ${file.name}`);
          }
        }
      }

      console.log(`✅ Plugin ${pluginData.name} saved successfully with all components`);

      // Return plugin ID and slug
      return { pluginId, slug, storeId };
    } catch (error) {
      console.error('❌ Error saving plugin to database:', error);
      console.error('Error details:', {
        message: error.message,
        name: error.name,
        userId,
        pluginName: pluginData.name
      });
      // Throw the error so the route handler can catch it
      throw new Error(`Failed to save plugin to database: ${error.message}`);
    }
  }

  /**
   * Modify existing plugin
   */
  async modifyPlugin(userId, prompt, existingCode, metadata = {}) {
    // Use the same comprehensive plugin schema for modifications
    const basePrompt = buildPluginGenerationPrompt();
    const systemPrompt = `${basePrompt}

═══════════════════════════════════════════════════════════════════════════════
MODIFICATION MODE: You are modifying an existing plugin
═══════════════════════════════════════════════════════════════════════════════

Existing Plugin JSON:
\`\`\`json
${existingCode}
\`\`\`

Apply the user's requested changes to this plugin and return the COMPLETE updated plugin JSON.
Preserve all existing functionality unless specifically asked to remove it.`;

    const result = await this.generate({
      userId,
      operationType: 'plugin-modification',
      modelId: metadata.modelId,
      serviceKey: metadata.serviceKey,
      prompt,
      systemPrompt,
      maxTokens: 8192,
      temperature: 0.7,
      metadata
    });

    try {
      const pluginData = parsePluginResponse(result.content);
      return {
        ...result,
        pluginData
      };
    } catch (error) {
      console.error('Failed to parse modified plugin:', error.message);
      throw new Error(`Failed to parse modified plugin data: ${error.message}`);
    }
  }

  /**
   * Generate layout config
   */
  async generateLayout(userId, prompt, configType, metadata = {}) {
    const systemPrompt = `You are an expert frontend developer. Generate a ${configType} layout configuration.

Return a JSON object representing the layout config following the project's structure.`;

    return await this.generate({
      userId,
      operationType: 'layout-generation',
      prompt,
      systemPrompt,
      maxTokens: 2048,
      temperature: 0.7,
      metadata: { ...metadata, configType }
    });
  }

  /**
   * Translate content
   */
  async translateContent(userId, content, targetLanguages, metadata = {}) {
    const systemPrompt = 'You are an expert translator. Provide accurate, culturally appropriate translations.';
    const prompt = `Translate the following content to ${targetLanguages.join(', ')}:\n\n${content}`;

    return await this.generate({
      userId,
      operationType: 'translation',
      prompt,
      systemPrompt,
      maxTokens: 2048,
      temperature: 0.3,
      metadata: { ...metadata, targetLanguages }
    });
  }

  /**
   * Generate code patch (RFC 6902)
   */
  async generateCodePatch(userId, prompt, sourceCode, filePath, metadata = {}) {
    const systemPrompt = `You are an expert code editor. Generate RFC 6902 JSON patches for safe code modifications.

File: ${filePath}

Source Code:
\`\`\`javascript
${sourceCode}
\`\`\`

Generate a JSON patch that safely modifies the code according to the request.`;

    return await this.generate({
      userId,
      operationType: 'code-patch',
      prompt,
      systemPrompt,
      maxTokens: 2048,
      temperature: 0.5,
      metadata: { ...metadata, filePath }
    });
  }
}

module.exports = new AIService();
