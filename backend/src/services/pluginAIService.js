/**
 * Plugin AI Service - Claude API Integration
 * Handles AI-powered plugin generation and assistance
 *
 * RAG INTEGRATION:
 * This service uses the RAG (Retrieval-Augmented Generation) system to enhance
 * plugin generation with relevant context from the database.
 *
 * HOW RAG IS USED:
 * 1. Before generating a plugin, fetch relevant docs/examples from aiContextService
 * 2. Inject that context into the AI system prompt
 * 3. AI uses the context to generate better, more accurate plugins
 *
 * WHAT CONTEXT IS FETCHED:
 * - Architecture documentation (how to build plugins)
 * - Working plugin examples (similar to what user wants)
 * - Code patterns (database migrations, API routes, etc.)
 *
 * See: backend/src/services/RAG_SYSTEM.md for full RAG documentation
 * See: backend/src/services/aiContextService.js for context fetching
 */

const aiContextService = require('./aiContextService');
const aiProvider = require('./ai-provider-service');
const aiModelsService = require('./AIModelsService');

class PluginAIService {
  constructor() {
    // Default model (used when none specified)
    this.defaultModel = 'claude-3-haiku-20240307';
    this.defaultProvider = 'anthropic';
  }

  /**
   * Resolve model ID to full API model name
   * Converts short IDs like 'claude-haiku' to full names like 'claude-3-5-haiku-20241022'
   * @param {string} modelId - Short or full model ID
   * @returns {Promise<string>} Full API model name
   */
  async resolveModelId(modelId) {
    if (!modelId) return this.defaultModel;

    // If it looks like a full model name (contains version date), use as-is
    if (modelId.match(/\d{8}$/)) {
      return modelId;
    }

    // Try to resolve via AIModelsService
    try {
      const apiModel = await aiModelsService.getApiModel(modelId);
      if (apiModel) return apiModel;
    } catch (err) {
      console.warn(`Failed to resolve model ID ${modelId}:`, err.message);
    }

    return this.defaultModel;
  }

  /**
   * Map model ID to provider
   * @param {string} modelId - Model ID
   * @returns {string} Provider name
   */
  getProviderFromModel(modelId) {
    if (!modelId) return this.defaultProvider;

    if (modelId.includes('claude')) return 'anthropic';
    if (modelId.includes('gpt')) return 'openai';
    if (modelId.includes('gemini')) return 'gemini';
    if (modelId.includes('llama') || modelId.includes('mixtral')) return 'groq';
    if (modelId.includes('deepseek')) return 'deepseek';

    return this.defaultProvider;
  }

  /**
   * Generate plugin code from natural language description
   *
   * RAG USAGE:
   * This method ALWAYS fetches RAG context from the database before generating
   * the plugin. The context includes:
   * - Architecture docs (how to structure plugins)
   * - Similar plugin examples (e.g., if user wants "reviews", fetch "reviews" example)
   * - Code patterns (migrations, API endpoints)
   *
   * The fetched context is injected into the system prompt, so the AI knows:
   * - How DainoStore plugins work (architecture)
   * - What similar plugins look like (examples)
   * - How to implement specific features (patterns)
   *
   * @param {string} mode - 'nocode' | 'developer' - Which builder mode
   * @param {string} userPrompt - User's natural language description of what they want
   * @param {object} context - Additional context
   * @param {string} context.category - 'commerce' | 'marketing' | 'analytics' etc.
   * @param {number} context.storeId - Store ID for store-specific context
   *
   * @returns {Promise<Object>} Parsed plugin code and metadata
   *
   * @example
   * const plugin = await pluginAIService.generatePlugin(
   *   'nocode',
   *   'Create a wishlist plugin where users can save products',
   *   { category: 'commerce', storeId: 123 }
   * );
   */
  async generatePlugin(mode, userPrompt, context = {}) {
    // ⚡ RAG: Fetch relevant context from database (5 docs + 3 examples + 5 patterns)
    // This gives the AI knowledge about:
    // - How to build DainoStore plugins (docs)
    // - Similar working plugins (examples)
    // - Code snippets for specific tasks (patterns)
    const dynamicContext = await aiContextService.getContextForQuery({
      mode,                      // 'nocode' or 'developer' - filters docs by audience
      category: context.category, // 'commerce', 'marketing' etc - finds relevant examples
      query: userPrompt,          // User's prompt - used for future vector search
      storeId: context.storeId,   // Optional store-specific context
      limit: 13                   // Total: 5 docs + 3 examples + 5 patterns
    });

    const systemPrompt = await this.getSystemPrompt(mode, dynamicContext);

    // Use model/provider from context if provided, otherwise use defaults
    // Resolve short model IDs (e.g., 'claude-haiku') to full API names (e.g., 'claude-3-5-haiku-20241022')
    const shortModelId = context.modelId || this.defaultModel;
    const resolvedModel = await this.resolveModelId(shortModelId);
    const provider = this.getProviderFromModel(shortModelId);

    console.log(`🤖 Plugin AI using provider: ${provider}, model: ${resolvedModel} (from ${shortModelId})`);

    const response = await aiProvider.chat([{
      role: 'user',
      content: this.buildUserPrompt(mode, userPrompt, context)
    }], {
      provider,
      model: resolvedModel,
      maxTokens: 4096,
      temperature: 0.7,
      systemPrompt
    });

    return this.parseAIResponse(response.content, mode);
  }

  /**
   * Generate code suggestions for developer mode
   * @param {string} fileName - Name of file being edited
   * @param {string} currentCode - Current code content
   * @param {string} prompt - User's request
   * @param {object} options - Optional options including modelId
   */
  async generateCodeSuggestion(fileName, currentCode, prompt, options = {}) {
    const shortModelId = options.modelId || this.defaultModel;
    const resolvedModel = await this.resolveModelId(shortModelId);
    const provider = this.getProviderFromModel(shortModelId);

    const response = await aiProvider.chat([{
      role: 'user',
      content: `File: ${fileName}

Current code:
\`\`\`javascript
${currentCode}
\`\`\`

Request: ${prompt}

Please provide the improved code.`
    }], {
      provider,
      model: resolvedModel,
      maxTokens: 2048,
      temperature: 0.5,
      systemPrompt: `You are an expert JavaScript/React developer helping to improve plugin code.
Provide clean, production-ready code following best practices.`
    });

    return response.content;
  }

  /**
   * Answer questions about plugin development
   * @param {string} question - User's question
   * @param {object} pluginContext - Context about the plugin
   * @param {object} options - Optional options including modelId
   */
  async answerQuestion(question, pluginContext, options = {}) {
    const shortModelId = options.modelId || this.defaultModel;
    const resolvedModel = await this.resolveModelId(shortModelId);
    const provider = this.getProviderFromModel(shortModelId);

    const response = await aiProvider.chat([{
      role: 'user',
      content: `Plugin context: ${JSON.stringify(pluginContext, null, 2)}

Question: ${question}`
    }], {
      provider,
      model: resolvedModel,
      maxTokens: 1024,
      temperature: 0.3,
      systemPrompt: `You are a helpful plugin development assistant. Answer questions clearly and concisely.
Focus on practical, actionable advice.`
    });

    return response.content;
  }

  /**
   * Get system prompt with RAG context injected
   *
   * RAG CONTEXT INJECTION:
   * The dynamicContext parameter contains formatted markdown from the database:
   * - Knowledge base documents (architecture, best practices)
   * - Working plugin examples (similar code to reference)
   * - Code patterns (reusable snippets)
   *
   * This context is injected BEFORE the base prompt, so the AI has all the
   * knowledge it needs about:
   * - How DainoStore plugins are structured
   * - What similar plugins look like
   * - How to implement specific features
   *
   * FALLBACK:
   * If dynamicContext is null (RAG fetch failed), falls back to hardcoded
   * architecture docs. This ensures the AI always has SOME context.
   *
   * @param {string} mode - 'nocode' | 'developer'
   * @param {string} dynamicContext - Formatted markdown from aiContextService.getContextForQuery()
   *
   * @returns {Promise<string>} Complete system prompt with RAG context
   */
  async getSystemPrompt(mode, dynamicContext = null) {
    // ⚡ RAG: Use dynamic context from database (preferred)
    // Falls back to hardcoded context if database fetch failed
    const pluginArchitectureContext = dynamicContext || `
# CATALYST PLUGIN ARCHITECTURE (FALLBACK - Update database for latest context!)

## Tech Stack
- Backend: Node.js + Express
- Frontend: React + Vite
- Database: PostgreSQL with Sequelize ORM
- NO PHP - This is a JavaScript/Node.js system!
- NO jQuery - Use modern JavaScript/React!

## Plugin Structure
Plugins are ES6 JavaScript classes that extend the base Plugin class:

\`\`\`javascript
const Plugin = require('../core/Plugin');

class MyPlugin extends Plugin {
  constructor(config = {}) {
    super(config);
    // Initialize plugin properties
  }

  static getMetadata() {
    return {
      name: 'My Plugin Name',
      slug: 'my-plugin',
      version: '1.0.0',
      description: 'What the plugin does',
      author: 'Author Name',
      category: 'commerce|marketing|analytics|integration',
      dependencies: [],
      permissions: []
    };
  }

  async install() {
    await super.install();
    await this.runMigrations();
    // Custom installation logic
  }

  async enable() {
    await this.registerHooks();
    await this.registerRoutes();
    // Start services
  }

  async disable() {
    await this.stopServices();
    // Cleanup
  }

  // Hook methods - render HTML for different page areas
  renderHomepageHeader(config, context) {
    return \`<div>HTML content here</div>\`;
  }

  renderHomepageContent(config, context) {
    return \`<div>More content</div>\`;
  }
}

module.exports = MyPlugin;
\`\`\`

## Simple Plugin Example (No Database)
For simple plugins that just display content:

\`\`\`javascript
class SimplePlugin {
  constructor() {
    this.name = 'Simple Plugin';
    this.version = '1.0.0';
  }

  renderHomepageHeader(config, context) {
    const { message = 'Hello!' } = config;
    return \`
      <div style="padding: 20px; background: #f0f8ff;">
        <h3>\${message}</h3>
        <p>Welcome to \${context.store.name}</p>
      </div>
    \`;
  }

  onEnable() { console.log('Plugin enabled'); }
  onDisable() { console.log('Plugin disabled'); }
}

module.exports = SimplePlugin;
\`\`\`

## Available Hooks
Plugins can implement these render methods:
- renderHomepageHeader(config, context) - Top of homepage
- renderHomepageContent(config, context) - Main homepage content
- renderProductPage(config, context) - Product pages
- renderCheckout(config, context) - Checkout flow
- renderOrderConfirmation(config, context) - After order

## Context Object
The context parameter contains:
- context.store - Store information {id, name, settings}
- context.user - Current user (if logged in)
- context.product - Product data (for product hooks)
- context.order - Order data (for order hooks)

## Database (Sequelize ORM)
For plugins that need data storage:

\`\`\`javascript
async runMigrations() {
  const { DataTypes } = require('sequelize');
  const sequelize = require('../database');

  // Create table
  await sequelize.getQueryInterface().createTable('plugin_data', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    store_id: { type: DataTypes.INTEGER },
    data: { type: DataTypes.JSON },
    created_at: { type: DataTypes.DATE },
    updated_at: { type: DataTypes.DATE }
  });
}
\`\`\`

## API Routes
To add custom API endpoints:

\`\`\`javascript
async registerRoutes() {
  const express = require('express');
  const router = express.Router();

  router.post('/api/my-plugin/action', async (req, res) => {
    // Handle request
    res.json({ success: true });
  });

  return router;
}
\`\`\`
`;

    const basePrompt = `You are an intelligent AI assistant for the DainoStore e-commerce plugin builder.
You can have conversations, answer questions, AND generate plugins when needed.

${pluginArchitectureContext}`;

    const modePrompts = {
      'nocode-ai': `${basePrompt}

You work in NO-CODE mode. Users have ZERO technical knowledge.

YOUR CAPABILITIES:
1. Have friendly conversations and answer questions about plugins
2. Detect when user wants to CREATE a new plugin
3. Detect when user wants to MODIFY/ENHANCE an existing plugin
4. Guide users through the plugin creation process
5. Explain what plugins can do in simple terms

CONVERSATION GUIDELINES:
- Be friendly, helpful, and conversational
- Never mention technical terms (API, webhook, database schemas, etc.)
- Focus on business features and outcomes
- If asked something unrelated to e-commerce plugins, politely redirect: "I'm here to help you build e-commerce plugins! Ask me to create features like customer reviews, loyalty points, wishlists, or custom checkout options."

WHEN TO GENERATE CODE/FILES:
Return JSON with generatedFiles when the user wants to:
- CREATE a new plugin (e.g., "create a wishlist", "build a reviews system")
- ADD features to their store (e.g., "I need loyalty points", "add product recommendations")
- ADD/CREATE a table (e.g., "add a table called chat_hamid", "create a new table")
- ADD database storage (e.g., "store data", "I need a database")

If they're just asking questions or chatting, respond conversationally in plain text.

RESPONSE FORMAT:
For conversations/questions: Respond in plain text naturally.
For plugin generation: Return ONLY valid JSON in this EXACT format:
{
  "name": "Plugin Name",
  "slug": "plugin-name",
  "description": "What it does",
  "category": "commerce|marketing|analytics|integration",
  "version": "1.0.0",
  "author": "Plugin Builder",
  "features": ["List of features in simple terms"],
  "plugin_structure": {
    "main_file": "// Complete plugin code as string",
    "manifest": {
      "name": "Plugin Name",
      "slug": "plugin-name",
      "version": "1.0.0",
      "description": "What it does",
      "category": "commerce|marketing|analytics|integration",
      "adminNavigation": {
        "enabled": true,
        "label": "My Plugin",
        "icon": "Package",
        "route": "/admin/my-plugin",
        "order": 100,
        "parentKey": null,
        "category": "custom",
        "description": "Plugin description for admin navigation"
      }
    }
  },
  "generatedFiles": [
    {
      "name": "index.js",
      "code": "// Complete plugin code"
    }
  ],
  "explanation": "Non-technical explanation: This plugin helps you [benefit]. It works by [simple description]. You can configure [settings]."
}

ADMIN NAVIGATION:
- Include adminNavigation in manifest if the plugin needs an admin page
- Use appropriate Lucide icons (Package, ShoppingCart, Users, Settings, Mail, etc.)
- Set order: 1-50 for core features, 51-100 for plugins, 100+ for utilities
- Leave parentKey null for top-level items, or use existing keys like "products", "orders", "store"
- Set category to match the plugin's purpose (commerce, marketing, analytics, integration, custom)
- Add a clear description to help users understand what the navigation item does

IMPORTANT CODE REQUIREMENTS:
- Use the Simple Plugin structure for basic plugins (no database)
- Use the full Plugin class for complex plugins (with database/APIs)
- Return complete, runnable JavaScript code
- Include proper error handling
- Use template literals for HTML generation
- Escape user input to prevent XSS
- Follow the exact hook method signatures shown above
- Store the complete plugin code in plugin_structure.main_file as a STRING`,

      'guided': `${basePrompt}

You work in GUIDED mode. Users have basic technical understanding.

YOUR CAPABILITIES:
1. Have conversations about plugin architecture and features
2. Help users configure features step-by-step
3. Explain technical concepts in simple terms
4. Suggest best practices and improvements
5. Generate plugin code following the DainoStore structure

CONVERSATION GUIDELINES:
- Be helpful and conversational
- Explain technical concepts simply when asked
- Reference the plugin structure examples above
- If asked unrelated questions, redirect politely to plugin development topics

RESPONSE FORMAT:
For conversations/questions: Respond in plain text naturally.
For plugin generation: Return ONLY valid JSON following the exact structure shown in the architecture context above.`,

      'developer': `${basePrompt}

DEVELOPER MODE - Generate concise, production-ready code.

RESPONSE FORMAT - Always return ONLY valid JSON:
{
  "generatedFiles": [
    { "name": "filename.js", "code": "// working code" }
  ],
  "generatedAdminPages": [
    {
      "pageKey": "settings",
      "pageName": "Settings",
      "route": "/admin/plugins/PLUGIN_SLUG/settings",
      "componentCode": "// React component code",
      "icon": "Settings",
      "description": "Manage plugin settings"
    }
  ],
  "explanation": "One sentence summary."
}

ADMIN PAGE GENERATION:
When user asks to create an admin page, settings page, or management page:
- Include "generatedAdminPages" array in your response
- pageKey: URL-friendly key (e.g., "settings", "dashboard", "emails")
- pageName: Display name for navigation
- route: Full route path - use "/admin/plugins/PLUGIN_SLUG/PAGE_KEY" format
- componentCode: FULL React component code (function component with useState, useEffect, apiClient)
- icon: Lucide icon name (Settings, Users, Mail, BarChart, etc.)

Example admin page component:
\`\`\`javascript
function PluginSettingsPage() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const response = await apiClient.get('plugins/PLUGIN_SLUG/exec/settings');
    setSettings(response.data || {});
    setLoading(false);
  };

  const saveSettings = async () => {
    await apiClient.post('plugins/PLUGIN_SLUG/exec/settings', settings);
    alert('Settings saved!');
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div style={{padding: '20px'}}>
      <h1>Plugin Settings</h1>
      {/* Form fields here */}
      <button onClick={saveSettings}>Save</button>
    </div>
  );
}
\`\`\`

CRITICAL DISTINCTION - generatedFiles vs generatedAdminPages:
- **generatedFiles**: Backend code ONLY (hooks, controllers, events, migrations, entities)
- **generatedAdminPages**: React UI components for admin panel ONLY

When user asks for "admin page", "settings page", "dashboard", "management page":
- Use generatedAdminPages array (NOT generatedFiles!)
- These are React components stored in database and rendered dynamically

DATABASE ENTITIES & MIGRATIONS:
When user asks to "create a table", "add a new table", "add a table called X", "store data", or needs database storage:
You MUST generate BOTH files in the generatedFiles array:
1. An ENTITY file (JSON) with the table schema - name must include "entity" and end with ".json"
2. A MIGRATION file (SQL) to create the table - name must include timestamp and end with ".sql"

EXAMPLE RESPONSE for "add a table called chat_hamid":
{
  "generatedFiles": [
    {
      "name": "chat_hamid_entity.json",
      "code": {
        "entity_name": "ChatHamid",
        "table_name": "chat_hamid",
        "description": "Stores chat session data",
        "schema_definition": {
          "columns": [
            { "name": "id", "type": "UUID", "primary": true, "default": "gen_random_uuid()" },
            { "name": "session_id", "type": "VARCHAR(100)", "notNull": true },
            { "name": "user_id", "type": "UUID", "nullable": true },
            { "name": "data", "type": "JSONB", "nullable": true },
            { "name": "created_at", "type": "TIMESTAMP WITH TIME ZONE", "default": "NOW()" }
          ],
          "indexes": [
            { "name": "idx_chat_hamid_session", "columns": ["session_id"] }
          ]
        }
      }
    },
    {
      "name": "1704200000_create_chat_hamid_migration.sql",
      "code": "-- Migration: Create chat_hamid table\\n-- Version: 1704200000\\n\\nCREATE TABLE IF NOT EXISTS chat_hamid (\\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\\n  session_id VARCHAR(100) NOT NULL,\\n  user_id UUID,\\n  data JSONB,\\n  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()\\n);\\n\\nCREATE INDEX IF NOT EXISTS idx_chat_hamid_session ON chat_hamid(session_id);"
    }
  ],
  "explanation": "Created chat_hamid table with session tracking and JSONB data storage."
}

CRITICAL: For ANY table request, you MUST return BOTH the entity JSON file AND the migration SQL file in generatedFiles array. Never return just one.

API CONTROLLERS:
When user asks for "API endpoint", "REST API", "backend route", or needs custom endpoints:
Generate a controller file (name must include "controller" or "Controller"):

Controller file format:
\`\`\`javascript
// Controller: chat_hamid_controller.js
// Method: POST
// Path: /chat-hamid

module.exports = async (req, res, context) => {
  const { session_id, data } = req.body;
  const { tenantDb, storeId } = context;

  try {
    // Insert into chat_hamid table
    const { data: result, error } = await tenantDb
      .from('chat_hamid')
      .insert({ session_id, data, store_id: storeId })
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
\`\`\`

CRON JOBS (Scheduled Tasks):
When user asks for "scheduled task", "cron job", "run every hour/day/week", "background job":
Generate a cron file (name must include "cron" and end with ".json"):

Cron file format:
\`\`\`json
{
  "cron_name": "cleanup_old_sessions",
  "description": "Clean up expired chat sessions daily",
  "schedule": "0 3 * * *",
  "is_enabled": true,
  "handler_code": "// Available: db (Supabase client), storeId, params, fetch, apiBaseUrl, console\\n\\nconst { data, error } = await db\\n  .from('chat_sessions')\\n  .delete()\\n  .lt('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());\\n\\nif (error) throw error;\\n\\nreturn { deleted: data?.length || 0, message: 'Cleanup completed' };",
  "handler_params": {}
}
\`\`\`

Common cron schedules:
- "*/5 * * * *" = every 5 minutes
- "0 * * * *" = every hour
- "0 0 * * *" = daily at midnight
- "0 3 * * *" = daily at 3 AM
- "0 0 * * 0" = weekly on Sunday
- "0 0 1 * *" = monthly on the 1st

Handler code has access to:
- db: Supabase tenant database client
- storeId: Current store ID
- params: Custom parameters from handler_params
- fetch: For HTTP requests
- apiBaseUrl: Backend API URL
- console: For logging

RULES:
- Return ONLY JSON, no markdown wrapping, no extra text before/after
- Keep explanation to 1-2 sentences maximum
- Generate only the files needed for the specific request
- Do NOT include README.md unless specifically asked
- Use DainoStore plugin hooks and patterns
- For tables: ALWAYS generate BOTH entity JSON AND migration SQL files
- For APIs: Generate controller files that export async handler functions
- For cron: Generate cron JSON files with handler_code as JavaScript string`
    };

    return modePrompts[mode] || basePrompt;
  }

  /**
   * Build user prompt with context
   */
  buildUserPrompt(mode, userPrompt, context) {
    let prompt = '';

    if (mode === 'nocode-ai') {
      prompt = `User wants to create: ${userPrompt}

Current plugin state: ${JSON.stringify(context, null, 2)}

Generate a complete plugin with all necessary code, database tables, and UI components.
Remember: Use NO technical jargon. Focus on business value.`;
    } else if (mode === 'guided') {
      prompt = `User is building a plugin with these requirements: ${userPrompt}

Current configuration: ${JSON.stringify(context, null, 2)}

Help them configure the plugin step-by-step. Suggest database tables, features, and UI components.`;
    } else if (mode === 'developer') {
      // Check if we're editing an existing plugin (has pluginId/pluginName)
      if (context.pluginId || context.pluginName) {
        // Build existing files list with content for context
        let existingFilesList = '';
        if (context.existingFiles && context.existingFiles.length > 0) {
          existingFilesList = '\n**Existing plugin files:**';
          for (const file of context.existingFiles) {
            existingFilesList += `\n\n--- ${file.path} ---\n\`\`\`javascript\n${file.content || '// Empty file'}\n\`\`\``;
          }
        }

        // Build conversation history context
        const conversationContext = context.conversationHistory && context.conversationHistory.length > 0
          ? `\n**Recent conversation:**\n${context.conversationHistory.map(m => `${m.role}: ${m.content.substring(0, 300)}${m.content.length > 300 ? '...' : ''}`).join('\n')}`
          : '';

        const pluginSlug = context.pluginSlug || 'unknown';
        prompt = `Modify plugin "${context.pluginName || 'Unknown'}" (slug: ${pluginSlug}).
${existingFilesList}
${conversationContext}

**Plugin slug for routes:** ${pluginSlug}
**Current request:** ${userPrompt}

RESPONSE FORMAT - Return ONLY this JSON, nothing else:
{
  "generatedFiles": [
    { "name": "filename.js", "code": "// your code here" }
  ],
  "generatedAdminPages": [
    { "pageKey": "settings", "pageName": "Settings", "route": "/admin/plugins/${pluginSlug}/settings", "componentCode": "function SettingsPage() { ... }", "icon": "Settings", "description": "Manage settings" }
  ],
  "explanation": "One sentence describing what was added or modified."
}

OR if the request is unclear, ask for clarification:
{
  "question": "Which file would you like me to modify?",
  "options": ["file1.js", "file2.js"]
}

RULES:
- Return ONLY valid JSON, no markdown, no extra text
- **MINIMAL OUTPUT** - Only requested file(s), no README or docs
- **Short explanation** - Max 10 words
- **ADMIN PAGES GO IN generatedAdminPages, NOT generatedFiles!**
- **If user asks for admin page, settings page, dashboard, or management page:**
  - Put it ONLY in generatedAdminPages array (NOT in generatedFiles)
  - componentCode must be a FULL React function component
  - Use the plugin slug "${pluginSlug}" in routes
- **Look at the conversation history to understand what file was just created/modified**
- **If user says "change it", "update that", etc., modify the file from the previous message**
- **IMPORTANT: When modifying, keep ALL existing logic and only change what was requested**
- **Use the EXACT same filename/path from "Existing plugin files" when modifying**
- **If unclear which file to modify, return a question asking for clarification**
- Generate the COMPLETE file content, not just the changes
- Use DainoStore plugin hooks (cart.add_item, product.view, etc.)`;
      } else {
        // Standard developer mode with current file context
        prompt = `Developer request: ${userPrompt}

Current file: ${context.currentFile?.name || 'N/A'}
Current code:
\`\`\`javascript
${context.currentCode || '// Empty file'}
\`\`\`

Provide production-ready code with proper error handling and best practices.`;
      }
    }

    return prompt;
  }

  /**
   * Parse AI response into structured format
   */
  parseAIResponse(responseText, mode) {
    try {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }

      // Try to parse entire response as JSON
      return JSON.parse(responseText);
    } catch (error) {
      // Not JSON - this is a conversational response
      console.log('AI returned conversational response (not JSON)');

      // Return plain text response in a format the frontend can handle
      // The frontend will display this as a regular chat message
      return {
        type: 'conversation',
        message: responseText,
        isConversational: true
      };
    }
  }

  /**
   * Generate plugin from template
   */
  async generateFromTemplate(templateId, customization = {}) {
    const templates = {
      reviews: {
        name: 'Product Reviews',
        description: '5-star rating system with customer reviews',
        prompt: 'Create a product review system with star ratings, written reviews, and photo uploads'
      },
      wishlist: {
        name: 'Customer Wishlist',
        description: 'Let customers save favorite products',
        prompt: 'Create a wishlist feature where customers can save and manage their favorite products'
      },
      loyalty: {
        name: 'Loyalty Points',
        description: 'Reward repeat customers with points',
        prompt: 'Create a loyalty points system that rewards customers for purchases and allows redemption'
      }
    };

    const template = templates[templateId];
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    const fullPrompt = `${template.prompt}. ${customization.additionalRequirements || ''}`;

    return await this.generatePlugin('nocode-ai', fullPrompt, {
      templateId,
      ...customization
    });
  }

  /**
   * Chat with AI assistant (streaming response)
   */
  async chat(messages, mode = 'nocode-ai') {
    // Get dynamic context for chat
    const dynamicContext = await aiContextService.getContextForQuery({
      mode,
      query: messages[messages.length - 1]?.content || '',
      limit: 5
    });

    const systemPrompt = await this.getSystemPrompt(mode, dynamicContext);

    // TODO: Implement streaming support in aiProvider
    const stream = await this.anthropic.messages.create({
      model: this.model,
      max_tokens: 2048,
      temperature: 0.7,
      system: systemPrompt,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      stream: true
    });

    return stream;
  }

  /**
   * Enhanced chat with context tracking for no-code builder
   */
  async chatWithContext({ message, mode, conversationHistory, pluginConfig, currentStep }) {
    // Fetch relevant context from database
    const dynamicContext = await aiContextService.getContextForQuery({
      mode: mode || 'nocode',
      category: pluginConfig.category,
      query: message,
      storeId: pluginConfig.storeId,
      limit: 8
    });

    const systemPrompt = `You are an AI assistant helping users build plugins through conversation.

${dynamicContext}

Your role:
- Ask clarifying questions to understand what they want to build
- Provide friendly, helpful guidance without technical jargon
- Extract plugin details from their responses
- Update the plugin configuration as you learn more
- Suggest next steps to keep the conversation flowing

Current plugin state: ${JSON.stringify(pluginConfig, null, 2)}
Current step: ${currentStep}

When you respond:
1. Provide a helpful, conversational response
2. Ask follow-up questions if needed
3. Extract any plugin details mentioned (name, features, database needs, etc.)

Be conversational, friendly, and guide them naturally through the process.`;

    // Build conversation context
    const messages = [];

    // Add recent conversation history (last 5 messages)
    conversationHistory.slice(-5).forEach(msg => {
      messages.push({
        role: msg.role,
        content: msg.content
      });
    });

    // Add current user message
    messages.push({
      role: 'user',
      content: message
    });

    // Create streaming response
    // TODO: Implement streaming support in aiProvider
    const stream = await this.anthropic.messages.create({
      model: this.model,
      max_tokens: 2048,
      temperature: 0.7,
      system: systemPrompt,
      messages,
      stream: true
    });

    // Parse the response to extract plugin config and suggestions
    let fullResponse = '';
    const responseStream = {
      stream,
      config: pluginConfig,
      step: currentStep,
      suggestions: []
    };

    return responseStream;
  }

  /**
   * Generate smart contextual suggestions for next steps
   * @param {object} params - Parameters including context, currentStep, pluginConfig, recentMessages, userMessage, modelId
   */
  async generateSmartSuggestions({ context, currentStep, pluginConfig, recentMessages, userMessage, modelId }) {
    const shortModelId = modelId || this.defaultModel;
    const resolvedModel = await this.resolveModelId(shortModelId);
    const provider = this.getProviderFromModel(shortModelId);

    const systemPrompt = `You are an AI assistant that generates helpful suggestions for building plugins.

Based on the conversation context, generate 2-4 short, actionable questions or prompts that would help move the conversation forward.

Current context: ${context}
Current step: ${currentStep}
Plugin config so far: ${JSON.stringify(pluginConfig, null, 2)}
Recent conversation: ${JSON.stringify(recentMessages.slice(-3), null, 2)}
Latest user message: ${userMessage}

Generate suggestions that:
- Help clarify requirements
- Explore additional features
- Move toward completing the plugin
- Are phrased as questions the user might ask

Return ONLY a JSON array of 2-4 short suggestion strings, like:
["What features will this have?", "Will this need database storage?", "How should users access this?"]`;

    try {
      const response = await aiProvider.chat([{
        role: 'user',
        content: 'Generate suggestions for the next steps in this conversation.'
      }], {
        provider,
        model: resolvedModel,
        maxTokens: 512,
        temperature: 0.8,
        systemPrompt
      });

      const responseText = response.content;

      // Try to parse JSON array
      const jsonMatch = responseText.match(/\[[\s\S]*?\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // Fallback suggestions based on context
      return this.getFallbackSuggestions(currentStep, pluginConfig);
    } catch (error) {
      console.error('Error generating smart suggestions:', error);
      return this.getFallbackSuggestions(currentStep, pluginConfig);
    }
  }

  /**
   * Get fallback suggestions when AI generation fails
   */
  getFallbackSuggestions(currentStep, pluginConfig) {
    if (!pluginConfig.name) {
      return [
        "What should we call this plugin?",
        "What problem does this solve?",
        "Who will use this plugin?"
      ];
    }

    if (!pluginConfig.features || pluginConfig.features.length === 0) {
      return [
        "What features do you need?",
        "Should users be able to input data?",
        "Do you need any automated tasks?"
      ];
    }

    return [
      "Should we add more features?",
      "Do you need database storage?",
      "I'm ready to generate the plugin - shall we proceed?"
    ];
  }
}

module.exports = new PluginAIService();
