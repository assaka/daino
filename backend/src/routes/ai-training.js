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

/**
 * POST /api/ai/training/run-comprehensive
 * Run comprehensive AI knowledge training
 * Populates AI tables with system knowledge
 */
router.post('/run-comprehensive', async (req, res) => {
  try {
    console.log('🚀 Starting Comprehensive AI Knowledge Training...');

    // Return immediately, run async
    res.json({
      success: true,
      message: 'Comprehensive AI training started. Check logs for progress.',
      status: 'running'
    });

    // Run training asynchronously
    runComprehensiveTraining().catch(err => {
      console.error('Training error:', err);
    });

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

module.exports = router;
