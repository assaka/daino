/**
 * AI Training Routes
 * Admin endpoints for managing AI training data
 * Includes comprehensive knowledge training via LLM analysis
 */

const express = require('express');
const router = express.Router();
const aiTrainingService = require('../services/aiTrainingService');
const Anthropic = require('@anthropic-ai/sdk');
const { masterDbClient } = require('../database/masterConnection');
const embeddingService = require('../services/embeddingService');

const anthropic = new Anthropic();

/**
 * GET /api/ai/training/candidates
 * Get training candidates for review
 */
router.get('/candidates', async (req, res) => {
  try {
    const { status, entity, page = 1, limit = 20 } = req.query;

    const result = await aiTrainingService.getCandidatesForReview({
      status,
      entity,
      page: parseInt(page),
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error fetching training candidates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch training candidates'
    });
  }
});

/**
 * GET /api/ai/training/metrics
 * Get training metrics and statistics
 */
router.get('/metrics', async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;

    const metrics = await aiTrainingService.getTrainingMetrics(dateFrom, dateTo);

    res.json({
      success: true,
      metrics
    });
  } catch (error) {
    console.error('Error fetching training metrics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch training metrics'
    });
  }
});

/**
 * POST /api/ai/training/candidates/:id/approve
 * Manually approve a training candidate
 */
router.post('/candidates/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || req.body.userId;

    const result = await aiTrainingService.approveCandidate(id, userId);

    if (result.success) {
      res.json({
        success: true,
        message: 'Candidate approved successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error || 'Failed to approve candidate'
      });
    }
  } catch (error) {
    console.error('Error approving candidate:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve candidate'
    });
  }
});

/**
 * POST /api/ai/training/candidates/:id/reject
 * Manually reject a training candidate
 */
router.post('/candidates/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user?.id || req.body.userId;

    const result = await aiTrainingService.rejectCandidate(id, userId, reason);

    if (result.success) {
      res.json({
        success: true,
        message: 'Candidate rejected successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error || 'Failed to reject candidate'
      });
    }
  } catch (error) {
    console.error('Error rejecting candidate:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject candidate'
    });
  }
});

/**
 * POST /api/ai/training/candidates/:id/feedback
 * Record user feedback on a candidate
 */
router.post('/candidates/:id/feedback', async (req, res) => {
  try {
    const { id } = req.params;
    const { wasHelpful, feedbackText } = req.body;

    const result = await aiTrainingService.recordUserFeedback(id, wasHelpful, feedbackText);

    res.json({
      success: result.success,
      message: result.success ? 'Feedback recorded' : result.error
    });
  } catch (error) {
    console.error('Error recording feedback:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record feedback'
    });
  }
});

/**
 * POST /api/ai/training/promote
 * Promote all approved candidates to entity definitions
 */
router.post('/promote', async (req, res) => {
  try {
    const result = await aiTrainingService.promoteApprovedCandidates();

    if (result.error) {
      res.status(500).json({
        success: false,
        message: result.error
      });
    } else {
      res.json({
        success: true,
        message: `Promoted ${result.promoted} candidates, ${result.failed} failed`,
        ...result
      });
    }
  } catch (error) {
    console.error('Error promoting candidates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to promote candidates'
    });
  }
});

/**
 * GET /api/ai/training/rules
 * Get training rules
 */
router.get('/rules', async (req, res) => {
  try {
    const rules = await aiTrainingService.getTrainingRules();

    res.json({
      success: true,
      rules
    });
  } catch (error) {
    console.error('Error fetching training rules:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch training rules'
    });
  }
});

/**
 * POST /api/ai/training/capture
 * Manually capture a training candidate (for testing)
 */
router.post('/capture', async (req, res) => {
  try {
    const {
      storeId,
      userId,
      sessionId,
      userPrompt,
      aiResponse,
      detectedIntent,
      detectedEntity,
      detectedOperation,
      actionTaken,
      confidenceScore
    } = req.body;

    const result = await aiTrainingService.captureTrainingCandidate({
      storeId,
      userId,
      sessionId,
      userPrompt,
      aiResponse,
      detectedIntent,
      detectedEntity,
      detectedOperation,
      actionTaken,
      confidenceScore
    });

    res.json({
      success: result.captured,
      candidateId: result.candidateId,
      message: result.captured ? 'Captured successfully' : result.reason || result.error
    });
  } catch (error) {
    console.error('Error capturing candidate:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to capture candidate'
    });
  }
});

/**
 * POST /api/ai/training/candidates/:id/outcome
 * Update outcome for a candidate
 */
router.post('/candidates/:id/outcome', async (req, res) => {
  try {
    const { id } = req.params;
    const { outcomeStatus, outcomeDetails } = req.body;

    const result = await aiTrainingService.updateOutcome(id, outcomeStatus, outcomeDetails);

    res.json({
      success: result.success,
      message: result.success ? 'Outcome updated' : result.error
    });
  } catch (error) {
    console.error('Error updating outcome:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update outcome'
    });
  }
});

// ============================================
// COMPREHENSIVE AI KNOWLEDGE TRAINING
// ============================================

const fs = require('fs');
const path = require('path');

/**
 * POST /api/ai/training/scan-codebase
 * Full codebase scan using Claude to analyze ALL files
 * Extracts comprehensive knowledge about every feature
 */
router.post('/scan-codebase', async (req, res) => {
  try {
    console.log('🔍 Starting Full Codebase Scan...');

    res.json({
      success: true,
      message: 'Full codebase scan started. This will take several minutes.',
      status: 'running'
    });

    // Run scan asynchronously
    runCodebaseScan().catch(err => {
      console.error('Scan error:', err);
    });

  } catch (error) {
    console.error('Scan Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Full codebase scan - analyzes actual code files with Claude
 */
async function runCodebaseScan() {
  console.log('📚 Running full codebase scan with Claude analysis...\n');

  const ROOT_DIR = path.join(__dirname, '../../..');
  const scanPatterns = [
    {
      category: 'db_schemas',
      paths: ['backend/src/database/schemas'],
      extensions: ['.sql'],
      prompt: `Analyze these SQL files and extract ALL tables with columns.
For each table: table_name, description, columns [{name, type, description, is_jsonb}], important_notes.
Return JSON array.`
    },
    {
      category: 'api_routes',
      paths: ['backend/src/routes'],
      extensions: ['.js'],
      prompt: `Analyze these route files and extract ALL API endpoints.
For each: endpoint, method, description, parameters, response, features.
Return JSON array.`
    },
    {
      category: 'services',
      paths: ['backend/src/services'],
      extensions: ['.js'],
      prompt: `Analyze these services and extract business logic.
For each: name, description, key_functions, related_tables, configuration_options.
Focus on FEATURES like tax, shipping, stock, labels, tabs, etc.
Return JSON array.`
    },
    {
      category: 'configs',
      paths: ['backend/src/configs'],
      extensions: ['.js', '.json'],
      prompt: `Analyze these configs and extract feature settings.
For each: name, purpose, options, defaults, how_to_configure.
Include theme presets, default settings, feature flags.
Return JSON array.`
    }
  ];

  for (const pattern of scanPatterns) {
    console.log(`\n📁 Scanning: ${pattern.category}`);

    let allFiles = [];
    for (const basePath of pattern.paths) {
      const files = findFilesRecursive(path.join(ROOT_DIR, basePath), pattern.extensions);
      allFiles.push(...files);
    }

    console.log(`   Found ${allFiles.length} files`);
    if (allFiles.length === 0) continue;

    // Process in batches of 3
    for (let i = 0; i < allFiles.length; i += 3) {
      const batch = allFiles.slice(i, i + 3);
      console.log(`   Analyzing batch ${Math.floor(i/3) + 1}: ${batch.map(f => path.basename(f)).join(', ')}`);

      try {
        const filesContent = batch.map(f => {
          const content = fs.readFileSync(f, 'utf-8').substring(0, 25000);
          return `### ${path.relative(ROOT_DIR, f)}\n\`\`\`\n${content}\n\`\`\``;
        }).join('\n\n');

        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 8192,
          messages: [{
            role: 'user',
            content: `${pattern.prompt}\n\nIMPORTANT: Return ONLY valid JSON array.\n\nFiles:\n${filesContent}`
          }]
        });

        const text = response.content[0]?.text || '';
        let items = [];

        // Parse JSON
        try {
          let jsonText = text.trim();
          if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
          }
          items = JSON.parse(jsonText);
          if (!Array.isArray(items)) items = [items];
        } catch (e) {
          const match = text.match(/\[[\s\S]*\]/);
          if (match) items = JSON.parse(match[0]);
        }

        // Save items
        for (const item of items) {
          if (pattern.category === 'db_schemas') {
            await saveEntityDefinition(item);
          } else {
            await saveContextDocument(pattern.category, item);
          }
        }
        console.log(`     ✅ Extracted ${items.length} items`);

        // Rate limit
        await new Promise(r => setTimeout(r, 1500));
      } catch (err) {
        console.log(`     ❌ Error: ${err.message}`);
      }
    }
  }

  console.log('\n✅ Full codebase scan complete!');
}

function findFilesRecursive(dir, extensions, maxDepth = 5, depth = 0) {
  const files = [];
  if (depth > maxDepth || !fs.existsSync(dir)) return files;

  try {
    for (const item of fs.readdirSync(dir)) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
        files.push(...findFilesRecursive(fullPath, extensions, maxDepth, depth + 1));
      } else if (stat.isFile() && extensions.some(ext => item.endsWith(ext))) {
        files.push(fullPath);
      }
    }
  } catch (e) { /* skip */ }
  return files;
}

/**
 * POST /api/ai/training/run-comprehensive
 * Run comprehensive AI knowledge training
 * Populates AI tables with system knowledge
 * If ?scan=true, also scans codebase with Claude
 */
router.post('/run-comprehensive', async (req, res) => {
  try {
    const { scan = false } = req.query;
    console.log('🚀 Starting Comprehensive AI Knowledge Training...');
    if (scan) console.log('   + Full codebase scan enabled');

    // Return immediately, run async
    res.json({
      success: true,
      message: scan
        ? 'Comprehensive training + codebase scan started. This will take several minutes.'
        : 'Comprehensive AI training started. Check logs for progress.',
      status: 'running',
      scanEnabled: !!scan
    });

    // Run training asynchronously
    runComprehensiveTraining().catch(err => {
      console.error('Training error:', err);
    });

    // If scan enabled, also run codebase scan
    if (scan) {
      runCodebaseScan().catch(err => {
        console.error('Scan error:', err);
      });
    }

  } catch (error) {
    console.error('Training Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/ai/training/knowledge-status
 * Get current knowledge status in AI tables
 */
router.get('/knowledge-status', async (req, res) => {
  try {
    const [entities, docs, patterns] = await Promise.all([
      masterDbClient.from('ai_entity_definitions').select('table_name, description, category', { count: 'exact' }),
      masterDbClient.from('ai_context_documents').select('title, type, category', { count: 'exact' }),
      masterDbClient.from('ai_code_patterns').select('name, type', { count: 'exact' })
    ]);

    res.json({
      success: true,
      stats: {
        entity_definitions: entities.data?.length || 0,
        context_documents: docs.data?.length || 0,
        code_patterns: patterns.data?.length || 0
      },
      entities: entities.data?.map(e => ({ table: e.table_name, desc: e.description?.substring(0, 50) })),
      documents: docs.data?.map(d => ({ title: d.title, type: d.type })),
      patterns: patterns.data?.map(p => ({ name: p.name, type: p.type }))
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Run comprehensive training - populates AI tables with critical system knowledge
 */
async function runComprehensiveTraining() {
  console.log('📚 Running comprehensive AI training...\n');

  // 1. Train DB Schema Knowledge
  console.log('1️⃣ Training DB Schema Knowledge...');
  const schemaKnowledge = getDbSchemaKnowledge();
  for (const schema of schemaKnowledge) {
    try {
      await saveEntityDefinition(schema);
      console.log(`   ✅ ${schema.table_name}`);
    } catch (e) {
      console.log(`   ❌ ${schema.table_name}: ${e.message}`);
    }
  }

  // 2. Train API Endpoint Knowledge
  console.log('\n2️⃣ Training API Endpoint Knowledge...');
  const apiKnowledge = getApiRouteKnowledge();
  for (const api of apiKnowledge) {
    try {
      await saveContextDocument('api_endpoint', api);
      console.log(`   ✅ ${api.endpoint || api.name}`);
    } catch (e) {
      console.log(`   ❌ ${api.endpoint}: ${e.message}`);
    }
  }

  // 3. Train Architecture Knowledge
  console.log('\n3️⃣ Training Architecture Knowledge...');
  const archKnowledge = getArchitectureKnowledge();
  for (const arch of archKnowledge) {
    try {
      await saveContextDocument('architecture', arch);
      console.log(`   ✅ ${arch.name}`);
    } catch (e) {
      console.log(`   ❌ ${arch.name}: ${e.message}`);
    }
  }

  // 4. Train Slot System Knowledge
  console.log('\n4️⃣ Training Slot System Knowledge...');
  const slotKnowledge = getSlotSystemKnowledge();
  for (const slot of slotKnowledge) {
    try {
      await saveContextDocument('slot_system', slot);
      console.log(`   ✅ ${slot.name}`);
    } catch (e) {
      console.log(`   ❌ ${slot.name}: ${e.message}`);
    }
  }

  // 5. Train Store Settings Knowledge - CRITICAL for correct setting identification
  console.log('\n5️⃣ Training Store Settings Knowledge...');
  const settingsKnowledge = getStoreSettingsKnowledge();
  for (const setting of settingsKnowledge) {
    try {
      // Use saveStoreSettingDocument for higher priority
      await saveStoreSettingDocument(setting);
      console.log(`   ✅ ${setting.name}`);
    } catch (e) {
      console.log(`   ❌ ${setting.name}: ${e.message}`);
    }
  }

  console.log('\n✅ Comprehensive AI Training Complete!');
}

/**
 * Critical DB Schema Knowledge
 */
function getDbSchemaKnowledge() {
  return [
    {
      table_name: 'stores',
      description: 'Main store configuration. Logo is in settings.store_logo (JSONB), not logo_url!',
      columns: [
        { name: 'id', type: 'uuid', description: 'Store ID' },
        { name: 'name', type: 'varchar', description: 'Store name' },
        { name: 'slug', type: 'varchar', description: 'URL slug' },
        { name: 'settings', type: 'jsonb', description: 'JSONB: store_logo, favicon, theme.primaryColor, theme.secondaryColor, emailLogo, invoiceLogo', is_jsonb: true },
        { name: 'is_published', type: 'boolean', description: 'Store is live' }
      ],
      important_notes: 'CRITICAL: Logo is at settings.store_logo, NOT logo_url column. Theme at settings.theme.primaryColor'
    },
    {
      table_name: 'slot_configurations',
      description: 'Page layouts with slots. Configuration is JSONB with slots object and rootSlots array.',
      columns: [
        { name: 'id', type: 'uuid', description: 'Config ID' },
        { name: 'page_type', type: 'varchar', description: 'Page type: product, category, cart, checkout, header, footer, homepage' },
        { name: 'configuration', type: 'jsonb', description: 'JSONB: { slots: {id: slotDef}, rootSlots: [ids], metadata: {} }', is_jsonb: true },
        { name: 'is_draft', type: 'boolean', description: 'Draft version' }
      ],
      important_notes: 'Each slot has: type, props, children, styles. Add to slots object AND rootSlots array'
    },
    {
      table_name: 'plugin_registry',
      description: 'Custom plugins and slot components. Custom slots have type="slot_type".',
      columns: [
        { name: 'id', type: 'uuid', description: 'Plugin ID' },
        { name: 'name', type: 'varchar', description: 'Plugin name' },
        { name: 'type', type: 'varchar', description: 'Type: slot_type, extension, widget' },
        { name: 'definition', type: 'jsonb', description: 'Plugin code and config', is_jsonb: true },
        { name: 'is_active', type: 'boolean', description: 'Active status' }
      ],
      important_notes: 'Custom slot components stored with type="slot_type". Definition has React component code.'
    },
    {
      table_name: 'products',
      description: 'Product catalog. Name/description in translations JSONB, not direct columns.',
      columns: [
        { name: 'id', type: 'uuid', description: 'Product ID' },
        { name: 'sku', type: 'varchar', description: 'SKU' },
        { name: 'price', type: 'numeric', description: 'Price' },
        { name: 'translations', type: 'jsonb', description: 'JSONB: { en: { name, description }, de: {...} }', is_jsonb: true },
        { name: 'attributes', type: 'jsonb', description: 'Product attributes', is_jsonb: true }
      ],
      important_notes: 'Name is at translations.{locale}.name, NOT a direct column'
    },
    {
      table_name: 'categories',
      description: 'Product categories with hierarchy. Name in translations JSONB.',
      columns: [
        { name: 'id', type: 'uuid', description: 'Category ID' },
        { name: 'parent_id', type: 'uuid', description: 'Parent for hierarchy' },
        { name: 'code', type: 'varchar', description: 'Category code' },
        { name: 'translations', type: 'jsonb', description: 'JSONB: { en: { name, description } }', is_jsonb: true },
        { name: 'position', type: 'integer', description: 'Sort order' }
      ],
      important_notes: 'Name at translations.{locale}.name. Use parent_id for hierarchy'
    },
    {
      table_name: 'storefronts',
      description: 'Storefront configurations including header/footer/theme settings.',
      columns: [
        { name: 'id', type: 'uuid', description: 'Storefront ID' },
        { name: 'store_id', type: 'uuid', description: 'Owner store' },
        { name: 'name', type: 'varchar', description: 'Storefront name' },
        { name: 'domain', type: 'varchar', description: 'Custom domain' },
        { name: 'settings', type: 'jsonb', description: 'Theme and display settings', is_jsonb: true }
      ]
    }
  ];
}

/**
 * API Route Knowledge
 */
function getApiRouteKnowledge() {
  return [
    {
      name: 'File Upload',
      endpoint: 'POST /api/storage/upload',
      description: 'Upload file to storage. Returns URL to use in database.',
      parameters: 'multipart/form-data: file (required), folder (optional)',
      response: '{ success, data: { url, publicUrl, path, provider } }',
      usage: 'ALWAYS upload files first, then save returned URL to database. Never save base64.'
    },
    {
      name: 'Get Store',
      endpoint: 'GET /api/stores/:storeId',
      description: 'Get store with settings JSONB',
      response: 'Store object including settings.store_logo, settings.theme, etc.'
    },
    {
      name: 'Update Store',
      endpoint: 'PUT /api/stores/:storeId',
      description: 'Update store settings',
      parameters: '{ name, settings: { store_logo: url, theme: {...} } }',
      usage: 'Send partial settings object - will be merged'
    },
    {
      name: 'Get Slot Config',
      endpoint: 'GET /api/slot-configurations/:pageType',
      description: 'Get page layout configuration',
      response: '{ configuration: { slots: {...}, rootSlots: [...] } }'
    },
    {
      name: 'Update Slot Config',
      endpoint: 'PUT /api/slot-configurations/:pageType',
      description: 'Update page layout',
      parameters: '{ configuration: { slots, rootSlots } }',
      usage: 'To add slot: add to slots object AND rootSlots array'
    },
    {
      name: 'List Products',
      endpoint: 'GET /api/products',
      description: 'Get products with translations',
      parameters: 'page, limit, search, category_id'
    },
    {
      name: 'Create Product',
      endpoint: 'POST /api/products',
      description: 'Create new product',
      parameters: '{ sku, price, translations: { en: { name, description } } }'
    }
  ];
}

/**
 * Architecture Knowledge
 */
function getArchitectureKnowledge() {
  return [
    {
      name: 'File Upload Workflow',
      content: `CRITICAL: When user provides an image/file:
1. Upload to storage FIRST: POST /api/storage/upload (multipart/form-data)
2. Get URL from response: data.publicUrl or data.url
3. Save URL to appropriate field

NEVER save base64 or local paths to database.
Images are already uploaded by frontend when user attaches them.
Look for [ATTACHED IMAGES] in message with URLs.`
    },
    {
      name: 'Store Logo Location',
      content: `Store logo is at: stores.settings.store_logo (JSONB path)
NOT stores.logo_url - that column may not exist!

To update logo:
1. Get uploaded image URL (from message or upload)
2. update_store_setting(setting="store_logo", value=URL)
   OR update_record(entity="stores", data={settings: {store_logo: URL}})

Other settings in stores.settings:
- favicon - browser tab icon
- theme.primaryColor - main brand color
- theme.secondaryColor - accent color
- emailLogo - email template logo
- invoiceLogo - receipt/invoice logo`
    },
    {
      name: 'Slot System Overview',
      content: `Slot configurations define page layouts.
Table: slot_configurations
Column: configuration (JSONB)

Structure:
{
  "slots": {
    "slot-uuid": {
      "type": "container|text|image|button|grid|flex|html|custom",
      "props": { content, src, href, etc },
      "children": ["child-slot-id"],
      "styles": { css properties }
    }
  },
  "rootSlots": ["slot-uuid-1", "slot-uuid-2"],
  "metadata": {}
}

Page types: product, category, cart, checkout, header, footer, homepage

To add a component:
1. Create slot object with unique ID
2. Add to slots object
3. Add ID to rootSlots (or as child of another slot)`
    },
    {
      name: 'Admin Panel Structure',
      content: `Admin sections (/admin/*):
- Dashboard (/) - Overview
- Products (/products) - Product CRUD
- Categories (/categories) - Category tree
- Orders (/orders) - Order management
- Customers (/customers) - Customer data
- Design (/design) - Theme editor, slot editor
- Settings (/settings) - Store settings
- Plugins (/plugins) - Plugin management
- AI Workspace (/ai) - AI tools`
    },
    {
      name: 'Translation Pattern',
      content: `Products and categories use translations JSONB:
{
  "en": { "name": "Product Name", "description": "..." },
  "de": { "name": "Produktname", "description": "..." }
}

To get English name: translations.en.name
To update: merge into translations object`
    }
  ];
}

/**
 * Store Settings Knowledge - COMPREHENSIVE
 * All settings in stores.settings JSONB with exact paths and descriptions
 */
function getStoreSettingsKnowledge() {
  return [
    // Currency Display Settings - CRITICAL: Different settings for different pages!
    {
      name: 'Hide Currency on Category Page',
      setting_path: 'settings.hide_currency_category',
      table: 'stores',
      type: 'boolean',
      default_value: false,
      description: 'CATEGORY PAGE: Hides the currency symbol (e.g., $, €) from product prices on CATEGORY/LISTING pages. Does NOT affect product detail pages.',
      usage: 'Use when user says "hide currency on category page" or "remove currency from listings"',
      related_settings: ['hide_currency_product']
    },
    {
      name: 'Hide Currency on Product Page',
      setting_path: 'settings.hide_currency_product',
      table: 'stores',
      type: 'boolean',
      default_value: false,
      description: 'PRODUCT PAGE: Hides the currency symbol from prices on PRODUCT DETAIL pages only. Does NOT affect category/listing pages.',
      usage: 'Use when user says "hide currency on product page" or "remove currency from product details"',
      related_settings: ['hide_currency_category']
    },
    // Header Display Settings
    {
      name: 'Hide Header Cart',
      setting_path: 'settings.hide_header_cart',
      table: 'stores',
      type: 'boolean',
      default_value: false,
      description: 'Hides the shopping cart icon from the header navigation.',
      usage: 'Use when user says "hide cart icon" or "remove cart from header"'
    },
    {
      name: 'Hide Header Checkout',
      setting_path: 'settings.hide_header_checkout',
      table: 'stores',
      type: 'boolean',
      default_value: false,
      description: 'Hides the checkout link from the header navigation.',
      usage: 'Use when user says "hide checkout link" or "remove checkout from header"'
    },
    {
      name: 'Hide Header Search',
      setting_path: 'settings.hide_header_search',
      table: 'stores',
      type: 'boolean',
      default_value: false,
      description: 'Hides the search bar/icon from the header. Use show_permanent_search to control if search is always visible.',
      usage: 'Use when user says "hide search" or "remove search bar"'
    },
    {
      name: 'Show Permanent Search',
      setting_path: 'settings.show_permanent_search',
      table: 'stores',
      type: 'boolean',
      default_value: true,
      description: 'When true, search bar is always visible in header. When false, search is hidden behind an icon.',
      usage: 'Use when user says "always show search" or "expand search bar"'
    },
    {
      name: 'Show Language Selector',
      setting_path: 'settings.show_language_selector',
      table: 'stores',
      type: 'boolean',
      default_value: false,
      description: 'Shows a language/locale selector dropdown in the header.',
      usage: 'Use when user says "add language selector" or "show language picker"'
    },
    // Stock Display Settings
    {
      name: 'Enable Inventory Tracking',
      setting_path: 'settings.enable_inventory',
      table: 'stores',
      type: 'boolean',
      default_value: true,
      description: 'Master switch for inventory/stock tracking system.',
      usage: 'Use when user says "enable inventory" or "track stock"'
    },
    {
      name: 'Display Out of Stock Products',
      setting_path: 'settings.display_out_of_stock',
      table: 'stores',
      type: 'boolean',
      default_value: true,
      description: 'When true, out-of-stock products are still shown (marked as unavailable). When false, they are hidden.',
      usage: 'Use when user says "hide out of stock" or "show unavailable products"'
    },
    {
      name: 'Hide Stock Quantity',
      setting_path: 'settings.hide_stock_quantity',
      table: 'stores',
      type: 'boolean',
      default_value: false,
      description: 'Hides the actual stock number (e.g., "5 in stock"). Only shows in-stock/out-of-stock status.',
      usage: 'Use when user says "hide stock number" or "dont show quantity"'
    },
    {
      name: 'Show Stock Label',
      setting_path: 'settings.show_stock_label',
      table: 'stores',
      type: 'boolean',
      default_value: false,
      description: 'Shows "In Stock", "Out of Stock", "Low Stock" labels on products.',
      usage: 'Use when user says "show stock labels" or "display availability"'
    },
    {
      name: 'Low Stock Threshold',
      setting_path: 'settings.display_low_stock_threshold',
      table: 'stores',
      type: 'number',
      default_value: 0,
      description: 'Quantity threshold below which "Low Stock" warning is shown. 0 = disabled.',
      usage: 'Use when user says "low stock warning at 5" or "show low stock below 10"'
    },
    // Quantity & Cart Settings
    {
      name: 'Hide Quantity Selector',
      setting_path: 'settings.hide_quantity_selector',
      table: 'stores',
      type: 'boolean',
      default_value: false,
      description: 'Hides the quantity input (1, 2, 3...) on product pages. Users can only add 1 at a time.',
      usage: 'Use when user says "hide quantity selector" or "remove quantity input"'
    },
    // Category Page Settings
    {
      name: 'Enable Product Filters',
      setting_path: 'settings.enable_product_filters',
      table: 'stores',
      type: 'boolean',
      default_value: true,
      description: 'Shows the filter sidebar on category/listing pages for filtering by attributes, price, etc.',
      usage: 'Use when user says "enable filters" or "show filter sidebar"'
    },
    {
      name: 'Collapse Filters by Default',
      setting_path: 'settings.collapse_filters',
      table: 'stores',
      type: 'boolean',
      default_value: false,
      description: 'When true, filter groups start collapsed. Users must expand them.',
      usage: 'Use when user says "collapse filters" or "hide filter options"'
    },
    {
      name: 'Max Visible Attributes',
      setting_path: 'settings.max_visible_attributes',
      table: 'stores',
      type: 'number',
      default_value: 5,
      description: 'Maximum number of attribute values shown before "Show more" link appears.',
      usage: 'Use when user says "show 10 filter options" or "limit visible attributes"'
    },
    {
      name: 'Enable View Mode Toggle',
      setting_path: 'settings.enable_view_mode_toggle',
      table: 'stores',
      type: 'boolean',
      default_value: true,
      description: 'Shows grid/list view toggle on category pages.',
      usage: 'Use when user says "enable grid/list toggle" or "view mode switcher"'
    },
    {
      name: 'Default View Mode',
      setting_path: 'settings.default_view_mode',
      table: 'stores',
      type: 'string',
      default_value: 'grid',
      description: 'Default product display mode: "grid" or "list".',
      usage: 'Use when user says "default to list view" or "show grid by default"'
    },
    // Breadcrumb Settings
    {
      name: 'Show Category in Breadcrumb',
      setting_path: 'settings.show_category_in_breadcrumb',
      table: 'stores',
      type: 'boolean',
      default_value: true,
      description: 'Shows category name in breadcrumb trail (Home > Category > Product).',
      usage: 'Use when user says "hide category from breadcrumb" or "show category path"'
    },
    // Checkout Settings
    {
      name: 'Enable Reviews',
      setting_path: 'settings.enable_reviews',
      table: 'stores',
      type: 'boolean',
      default_value: true,
      description: 'Enables product reviews and ratings system.',
      usage: 'Use when user says "enable reviews" or "turn on ratings"'
    },
    {
      name: 'Allow Guest Checkout',
      setting_path: 'settings.allow_guest_checkout',
      table: 'stores',
      type: 'boolean',
      default_value: true,
      description: 'Allows customers to checkout without creating an account.',
      usage: 'Use when user says "enable guest checkout" or "require account to buy"'
    },
    {
      name: 'Require Shipping Address',
      setting_path: 'settings.require_shipping_address',
      table: 'stores',
      type: 'boolean',
      default_value: true,
      description: 'Requires shipping address at checkout. Disable for digital-only stores.',
      usage: 'Use when user says "require shipping" or "no shipping needed"'
    },
    {
      name: 'Collect Phone at Checkout',
      setting_path: 'settings.collect_phone_number_at_checkout',
      table: 'stores',
      type: 'boolean',
      default_value: false,
      description: 'Shows phone number field at checkout.',
      usage: 'Use when user says "ask for phone" or "collect phone number"'
    },
    {
      name: 'Phone Required at Checkout',
      setting_path: 'settings.phone_number_required_at_checkout',
      table: 'stores',
      type: 'boolean',
      default_value: true,
      description: 'Makes phone field required (only if collect_phone_number_at_checkout is true).',
      usage: 'Use when user says "require phone" or "phone optional"'
    },
    {
      name: 'Checkout Steps Count',
      setting_path: 'settings.checkout_steps_count',
      table: 'stores',
      type: 'number',
      default_value: 2,
      description: 'Number of checkout steps: 1 (single page), 2 (info + payment), or 3 (info + shipping + payment).',
      usage: 'Use when user says "one page checkout" or "3 step checkout"'
    },
    // Product Gallery Settings
    {
      name: 'Product Gallery Layout',
      setting_path: 'settings.product_gallery_layout',
      table: 'stores',
      type: 'string',
      default_value: 'horizontal',
      description: 'Product image thumbnails position: "horizontal" (below) or "vertical" (side).',
      usage: 'Use when user says "vertical thumbnails" or "horizontal gallery"'
    },
    {
      name: 'Vertical Gallery Position',
      setting_path: 'settings.vertical_gallery_position',
      table: 'stores',
      type: 'string',
      default_value: 'left',
      description: 'When gallery is vertical, thumbnails on "left" or "right" side.',
      usage: 'Use when user says "thumbnails on right" or "gallery on left"'
    },
    // Navigation Settings
    {
      name: 'Exclude Root from Menu',
      setting_path: 'settings.excludeRootFromMenu',
      table: 'stores',
      type: 'boolean',
      default_value: false,
      description: 'Hides the root category from navigation menu, showing only children.',
      usage: 'Use when user says "hide root category" or "dont show parent in menu"'
    },
    {
      name: 'Expand All Menu Items',
      setting_path: 'settings.expandAllMenuItems',
      table: 'stores',
      type: 'boolean',
      default_value: false,
      description: 'Expands all category tree items by default in navigation.',
      usage: 'Use when user says "expand all categories" or "show full menu tree"'
    },
    {
      name: 'Root Category ID',
      setting_path: 'settings.rootCategoryId',
      table: 'stores',
      type: 'string',
      default_value: null,
      description: 'UUID of category to use as navigation root (null = show all).',
      usage: 'Use when user says "set root category" or "start menu from category X"'
    },
    // Logo and Branding Settings
    {
      name: 'Store Logo',
      setting_path: 'settings.store_logo',
      table: 'stores',
      type: 'string',
      default_value: null,
      description: 'URL of the main store logo displayed in header. NOT a "logo_url" column - its in settings JSONB!',
      usage: 'Use when user says "change logo" or "update store logo"'
    },
    {
      name: 'Favicon',
      setting_path: 'settings.favicon',
      table: 'stores',
      type: 'string',
      default_value: null,
      description: 'URL of favicon (browser tab icon). 32x32 or 16x16 recommended.',
      usage: 'Use when user says "change favicon" or "update tab icon"'
    },
    {
      name: 'Email Logo',
      setting_path: 'settings.emailLogo',
      table: 'stores',
      type: 'string',
      default_value: null,
      description: 'Logo URL used in transactional emails (order confirmation, etc.).',
      usage: 'Use when user says "email logo" or "logo for emails"'
    },
    {
      name: 'Invoice Logo',
      setting_path: 'settings.invoiceLogo',
      table: 'stores',
      type: 'string',
      default_value: null,
      description: 'Logo URL used on invoices and receipts.',
      usage: 'Use when user says "invoice logo" or "receipt logo"'
    },
    // Theme Colors (in settings.theme object)
    {
      name: 'Primary Button Color',
      setting_path: 'settings.theme.primary_button_color',
      table: 'stores',
      type: 'string',
      default_value: '#007bff',
      description: 'Main button color throughout the site.',
      usage: 'Use when user says "change button color" or "primary color"'
    },
    {
      name: 'Add to Cart Button Background',
      setting_path: 'settings.theme.add_to_cart_button_bg_color',
      table: 'stores',
      type: 'string',
      default_value: '#28a745',
      description: 'Background color of "Add to Cart" button.',
      usage: 'Use when user says "add to cart button color" or "cart button green"'
    },
    {
      name: 'Add to Cart Button Text Color',
      setting_path: 'settings.theme.add_to_cart_button_text_color',
      table: 'stores',
      type: 'string',
      default_value: '#FFFFFF',
      description: 'Text color of "Add to Cart" button.',
      usage: 'Use when user says "add to cart text color"'
    },
    {
      name: 'Header Background Color',
      setting_path: 'settings.theme.header_bg_color',
      table: 'stores',
      type: 'string',
      default_value: '#FFFFFF',
      description: 'Background color of the header/navigation bar.',
      usage: 'Use when user says "header background" or "nav bar color"'
    },
    {
      name: 'Header Icon Color',
      setting_path: 'settings.theme.header_icon_color',
      table: 'stores',
      type: 'string',
      default_value: '#374151',
      description: 'Color of icons (cart, search, etc.) in header.',
      usage: 'Use when user says "header icon color" or "nav icons"'
    },
    {
      name: 'Font Family',
      setting_path: 'settings.theme.font_family',
      table: 'stores',
      type: 'string',
      default_value: 'Inter',
      description: 'Main font family for the entire store.',
      usage: 'Use when user says "change font" or "use Arial font"'
    }
  ];
}

/**
 * Slot System Knowledge
 */
function getSlotSystemKnowledge() {
  return [
    {
      name: 'Available Slot Types',
      content: `Built-in slot types:
- container: Wrapper for other slots
- text: Text content with formatting
- image: Image with src, alt
- button: Clickable button
- link: Hyperlink
- html: Raw HTML content
- grid: CSS Grid layout
- flex: Flexbox layout
- input: Form input field

Custom types: Stored in plugin_registry with type="slot_type"`
    },
    {
      name: 'Adding Slots to Pages',
      content: `To add a slot (e.g., reviews section):
1. Generate unique ID: crypto.randomUUID()
2. Create slot definition:
   {
     type: "container",
     props: { className: "reviews-section" },
     children: []
   }
3. Add to configuration.slots[id] = definition
4. Add id to configuration.rootSlots array
   (or to parent slot's children array)
5. Save: PUT /api/slot-configurations/:pageType`
    },
    {
      name: 'Slot Positioning',
      content: `Position slots by:
1. Order in rootSlots array (top to bottom)
2. As children of other slots
3. Using grid/flex containers

To add "above" something:
1. Find target slot in rootSlots
2. Insert new slot ID before it in array

To add "inside" something:
1. Add new slot to slots object
2. Add ID to target slot's children array`
    }
  ];
}

/**
 * Save entity definition to ai_entity_definitions
 */
async function saveEntityDefinition(item) {
  const { data: existing } = await masterDbClient
    .from('ai_entity_definitions')
    .select('id')
    .eq('table_name', item.table_name)
    .maybeSingle();

  const fields = {};
  item.columns?.forEach(col => {
    fields[col.name] = {
      type: col.type,
      description: col.description,
      is_jsonb: col.is_jsonb
    };
  });

  const entityData = {
    entity_name: item.table_name,
    display_name: item.table_name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    description: item.description,
    table_name: item.table_name,
    fields,
    metadata: { important_notes: item.important_notes, trained_at: new Date().toISOString() },
    supported_operations: ['list', 'get', 'create', 'update', 'delete'],
    is_active: true,
    category: 'trained',
    priority: 90,
    updated_at: new Date().toISOString()
  };

  if (existing) {
    await masterDbClient.from('ai_entity_definitions').update(entityData).eq('id', existing.id);
  } else {
    entityData.created_at = new Date().toISOString();
    await masterDbClient.from('ai_entity_definitions').insert(entityData);
  }
}

/**
 * Save context document to ai_context_documents
 */
async function saveContextDocument(type, item) {
  const title = item.name || item.endpoint || 'Unknown';

  const { data: existing } = await masterDbClient
    .from('ai_context_documents')
    .select('id')
    .eq('title', title)
    .maybeSingle();

  const docData = {
    type,
    title,
    content: item.content || JSON.stringify(item, null, 2),
    category: 'trained',
    priority: 90,
    mode: 'store_editing',
    is_active: true,
    updated_at: new Date().toISOString()
  };

  if (existing) {
    await masterDbClient.from('ai_context_documents').update(docData).eq('id', existing.id);
  } else {
    docData.created_at = new Date().toISOString();
    await masterDbClient.from('ai_context_documents').insert(docData);
  }
}

/**
 * Save store setting document with HIGH priority
 * These are critical for AI to distinguish between similar settings
 * (e.g., hide_currency_category vs hide_currency_product)
 */
async function saveStoreSettingDocument(setting) {
  const title = setting.name;

  const { data: existing } = await masterDbClient
    .from('ai_context_documents')
    .select('id')
    .eq('title', title)
    .eq('type', 'store_setting')
    .maybeSingle();

  // Format content to be maximally helpful for AI
  const content = `## ${setting.name}

**Setting Path:** \`${setting.setting_path}\`
**Table:** ${setting.table}
**Type:** ${setting.type}
**Default:** ${setting.default_value === null ? 'null' : setting.default_value}

**Description:** ${setting.description}

**When to Use:** ${setting.usage}

${setting.related_settings ? `**Related Settings:** ${setting.related_settings.join(', ')}` : ''}`;

  const docData = {
    type: 'store_setting',
    title,
    content,
    category: 'core',  // Core category so it's always included
    priority: 100,     // Highest priority - always appears first
    mode: 'store_editing',
    is_active: true,
    metadata: {
      setting_path: setting.setting_path,
      table: setting.table,
      setting_type: setting.type,
      default_value: setting.default_value,
      related_settings: setting.related_settings,
      trained_at: new Date().toISOString()
    },
    updated_at: new Date().toISOString()
  };

  let docId;
  if (existing) {
    await masterDbClient.from('ai_context_documents').update(docData).eq('id', existing.id);
    docId = existing.id;
  } else {
    docData.created_at = new Date().toISOString();
    const { data: inserted } = await masterDbClient
      .from('ai_context_documents')
      .insert(docData)
      .select('id')
      .single();
    docId = inserted?.id;
  }

  // Generate embedding for semantic search (AI-driven retrieval)
  if (docId) {
    try {
      await embeddingService.embedContextDocument(docId);
    } catch (e) {
      console.log(`   ⚠️ Embedding generation failed for ${title}: ${e.message}`);
    }
  }
}

module.exports = router;
