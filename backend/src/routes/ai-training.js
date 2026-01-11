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
 * GET /api/ai/training/debug-schema-count
 * Debug endpoint to check how many tables are defined in getDbSchemaKnowledge
 */
router.get('/debug-schema-count', async (req, res) => {
  try {
    const schemaKnowledge = getDbSchemaKnowledge();
    const apiKnowledge = getApiRouteKnowledge();
    const settingsKnowledge = getStoreSettingsKnowledge();

    res.json({
      success: true,
      counts: {
        db_schema_tables: schemaKnowledge.length,
        api_routes: apiKnowledge.length,
        store_settings: settingsKnowledge.length
      },
      db_tables: schemaKnowledge.map(t => t.table_name)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/ai/training/test-entity-insert
 * Test inserting entities to debug failures
 */
router.post('/test-entity-insert', async (req, res) => {
  try {
    const schemaKnowledge = getDbSchemaKnowledge();
    const results = [];

    for (const schema of schemaKnowledge) {
      try {
        await saveEntityDefinition(schema);
        results.push({ table: schema.table_name, status: 'success' });
      } catch (e) {
        results.push({ table: schema.table_name, status: 'error', error: e.message });
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;

    res.json({
      success: true,
      summary: { total: results.length, success: successCount, errors: errorCount },
      results
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, stack: error.stack });
  }
});

/**
 * GET /api/ai/training/knowledge-status
 * Get current knowledge status in AI tables
 */
router.get('/knowledge-status', async (req, res) => {
  try {
    const [entities, docs, patterns, docsWithEmbeddings, storeSettings] = await Promise.all([
      masterDbClient.from('ai_entity_definitions').select('table_name, description, category', { count: 'exact' }),
      masterDbClient.from('ai_context_documents').select('title, type, category', { count: 'exact' }),
      masterDbClient.from('ai_code_patterns').select('name, type', { count: 'exact' }),
      // Count documents WITH embeddings
      masterDbClient.from('ai_context_documents').select('id', { count: 'exact' }).not('embedding', 'is', null),
      // Get store_setting docs with embedding status
      masterDbClient.from('ai_context_documents')
        .select('title, type, embedding')
        .eq('type', 'store_setting')
        .order('title')
    ]);

    const storeSettingsWithEmbeddings = storeSettings.data?.filter(s => s.embedding !== null).length || 0;
    const storeSettingsTotal = storeSettings.data?.length || 0;

    res.json({
      success: true,
      stats: {
        entity_definitions: entities.data?.length || 0,
        context_documents: docs.data?.length || 0,
        code_patterns: patterns.data?.length || 0,
        documents_with_embeddings: docsWithEmbeddings.data?.length || 0,
        store_settings_total: storeSettingsTotal,
        store_settings_with_embeddings: storeSettingsWithEmbeddings
      },
      embedding_status: {
        total_docs: docs.data?.length || 0,
        with_embeddings: docsWithEmbeddings.data?.length || 0,
        missing_embeddings: (docs.data?.length || 0) - (docsWithEmbeddings.data?.length || 0),
        store_settings: `${storeSettingsWithEmbeddings}/${storeSettingsTotal} have embeddings`
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

  // 6. Train Common Operations - Examples of how to execute common requests
  console.log('\n6️⃣ Training Common Operations...');
  const operationsKnowledge = getCommonOperationsKnowledge();
  for (const op of operationsKnowledge) {
    try {
      await saveOperationDocument(op);
      console.log(`   ✅ ${op.name}`);
    } catch (e) {
      console.log(`   ❌ ${op.name}: ${e.message}`);
    }
  }

  // 7. Train Workflow Knowledge - Multi-step task guides
  console.log('\n7️⃣ Training Workflow Knowledge...');
  const workflowKnowledge = getWorkflowKnowledge();
  for (const workflow of workflowKnowledge) {
    try {
      await saveContextDocument('workflow', {
        name: workflow.name,
        content: `${workflow.description}\n\nSteps:\n${workflow.steps.join('\n')}\n\nExamples: ${workflow.examples.join(', ')}`
      });
      console.log(`   ✅ ${workflow.name}`);
    } catch (e) {
      console.log(`   ❌ ${workflow.name}: ${e.message}`);
    }
  }

  // 8. Train Troubleshooting Knowledge
  console.log('\n8️⃣ Training Troubleshooting Knowledge...');
  const troubleshootingKnowledge = getTroubleshootingKnowledge();
  for (const issue of troubleshootingKnowledge) {
    try {
      await saveContextDocument('troubleshooting', {
        name: issue.problem,
        content: `Problem: ${issue.problem}\n\nPossible causes:\n- ${issue.causes.join('\n- ')}\n\nSolutions:\n- ${issue.solutions.join('\n- ')}`
      });
      console.log(`   ✅ ${issue.problem}`);
    } catch (e) {
      console.log(`   ❌ ${issue.problem}: ${e.message}`);
    }
  }

  // 9. Train Credit Pricing Knowledge
  console.log('\n9️⃣ Training Credit Pricing Knowledge...');
  const creditKnowledge = getCreditPricingKnowledge();
  for (const credit of creditKnowledge) {
    try {
      await saveContextDocument('credit_pricing', credit);
      console.log(`   ✅ ${credit.name}`);
    } catch (e) {
      console.log(`   ❌ ${credit.name}: ${e.message}`);
    }
  }

  // 10. Train LLM Model Selection Knowledge
  console.log('\n🔟 Training LLM Model Selection Knowledge...');
  const llmKnowledge = getLLMModelKnowledge();
  for (const model of llmKnowledge) {
    try {
      await saveContextDocument('llm_models', model);
      console.log(`   ✅ ${model.name}`);
    } catch (e) {
      console.log(`   ❌ ${model.name}: ${e.message}`);
    }
  }

  // 11. Train AI Translation Knowledge
  console.log('\n1️⃣1️⃣ Training AI Translation Knowledge...');
  const translationKnowledge = getAITranslationKnowledge();
  for (const trans of translationKnowledge) {
    try {
      await saveContextDocument('ai_translation', trans);
      console.log(`   ✅ ${trans.name}`);
    } catch (e) {
      console.log(`   ❌ ${trans.name}: ${e.message}`);
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
    },
    // Product Labels
    {
      table_name: 'product_labels',
      description: 'Labels/badges displayed on products (Sale, New, Bestseller, etc.).',
      columns: [
        { name: 'id', type: 'uuid', description: 'Label ID' },
        { name: 'store_id', type: 'uuid', description: 'Store ID' },
        { name: 'name', type: 'varchar', description: 'Label name' },
        { name: 'label_type', type: 'varchar', description: 'Type: text, image, or both' },
        { name: 'text_content', type: 'varchar', description: 'Label text' },
        { name: 'background_color', type: 'varchar', description: 'Background hex color' },
        { name: 'text_color', type: 'varchar', description: 'Text hex color' },
        { name: 'position', type: 'varchar', description: 'Position: top-left, top-right, bottom-left, bottom-right' },
        { name: 'is_active', type: 'boolean', description: 'Enable/disable label' },
        { name: 'priority', type: 'integer', description: 'Display priority (lower = higher)' }
      ],
      important_notes: 'Labels can be automatic (rule-based) or manual (assigned to products). Position controls where badge appears on product image.'
    },
    // Attributes
    {
      table_name: 'attributes',
      description: 'Product attributes (Color, Size, Material, etc.) used for filtering and variants.',
      columns: [
        { name: 'id', type: 'uuid', description: 'Attribute ID' },
        { name: 'store_id', type: 'uuid', description: 'Store ID' },
        { name: 'code', type: 'varchar', description: 'Attribute code (e.g., color, size)' },
        { name: 'name', type: 'varchar', description: 'Display name' },
        { name: 'type', type: 'varchar', description: 'Type: select, multiselect, text, boolean, number' },
        { name: 'is_filterable', type: 'boolean', description: 'Show in category filters' },
        { name: 'is_visible', type: 'boolean', description: 'Show on product page' },
        { name: 'options', type: 'jsonb', description: 'For select/multiselect: array of {value, label}', is_jsonb: true }
      ],
      important_notes: 'Attributes define product characteristics. Options array contains possible values for select types.'
    },
    // SEO Templates
    {
      table_name: 'seo_templates',
      description: 'SEO meta templates for products, categories, and pages.',
      columns: [
        { name: 'id', type: 'uuid', description: 'Template ID' },
        { name: 'store_id', type: 'uuid', description: 'Store ID' },
        { name: 'entity_type', type: 'varchar', description: 'Type: product, category, page' },
        { name: 'meta_title_template', type: 'text', description: 'Title template with variables like {{product.name}}' },
        { name: 'meta_description_template', type: 'text', description: 'Description template' },
        { name: 'is_active', type: 'boolean', description: 'Enable template' }
      ],
      important_notes: 'Templates support variables: {{product.name}}, {{product.price}}, {{category.name}}, {{store.name}}'
    },
    // Custom Options
    {
      table_name: 'custom_options',
      description: 'Product customization options (engraving, gift wrap, custom text).',
      columns: [
        { name: 'id', type: 'uuid', description: 'Option ID' },
        { name: 'product_id', type: 'uuid', description: 'Product ID' },
        { name: 'name', type: 'varchar', description: 'Option name' },
        { name: 'type', type: 'varchar', description: 'Type: text, textarea, select, checkbox, file' },
        { name: 'is_required', type: 'boolean', description: 'Required option' },
        { name: 'price_adjustment', type: 'numeric', description: 'Additional price' },
        { name: 'options', type: 'jsonb', description: 'For select: array of choices', is_jsonb: true }
      ],
      important_notes: 'Custom options add product personalization. Price adjustment adds to product price.'
    },
    // Product Tabs
    {
      table_name: 'product_tabs',
      description: 'Custom tabs on product page (Details, Specifications, Reviews, etc.).',
      columns: [
        { name: 'id', type: 'uuid', description: 'Tab ID' },
        { name: 'store_id', type: 'uuid', description: 'Store ID' },
        { name: 'name', type: 'varchar', description: 'Tab name' },
        { name: 'content_type', type: 'varchar', description: 'Type: attribute, html, cms_block' },
        { name: 'content', type: 'text', description: 'Tab content or CMS block ID' },
        { name: 'attribute_code', type: 'varchar', description: 'For attribute type: which attribute to display' },
        { name: 'position', type: 'integer', description: 'Tab order' },
        { name: 'is_active', type: 'boolean', description: 'Show tab' }
      ],
      important_notes: 'Tabs can show HTML content, CMS blocks, or product attributes.'
    },
    // Cookie Consent Settings
    {
      table_name: 'cookie_consent_settings',
      description: 'GDPR cookie consent banner configuration.',
      columns: [
        { name: 'id', type: 'uuid', description: 'Settings ID' },
        { name: 'store_id', type: 'uuid', description: 'Store ID' },
        { name: 'enabled', type: 'boolean', description: 'Enable cookie consent' },
        { name: 'gdpr_mode', type: 'boolean', description: 'Strict GDPR mode (opt-in)' },
        { name: 'banner_position', type: 'varchar', description: 'Position: bottom, top, bottom-left, bottom-right' },
        { name: 'accept_button_bg_color', type: 'varchar', description: 'Accept button background color' },
        { name: 'consent_expiry_days', type: 'integer', description: 'Days until consent expires' }
      ],
      important_notes: 'GDPR mode requires explicit opt-in. Banner text is in translations table.'
    },
    // Custom Domains
    {
      table_name: 'store_domains',
      description: 'Custom domains for stores. Maps external domains to stores.',
      columns: [
        { name: 'id', type: 'uuid', description: 'Domain ID' },
        { name: 'store_id', type: 'uuid', description: 'Store ID' },
        { name: 'domain', type: 'varchar', description: 'Full domain name (e.g., shop.example.com)' },
        { name: 'is_primary', type: 'boolean', description: 'Primary domain for the store' },
        { name: 'ssl_status', type: 'varchar', description: 'SSL certificate status: pending, active, failed' },
        { name: 'is_verified', type: 'boolean', description: 'DNS verification status' }
      ],
      important_notes: 'Domains need DNS verification. SSL is auto-provisioned after verification.'
    },
    // Payment Methods
    {
      table_name: 'payment_methods',
      description: 'Available payment methods for checkout (Stripe, PayPal, Bank Transfer, etc.).',
      columns: [
        { name: 'id', type: 'uuid', description: 'Payment method ID' },
        { name: 'store_id', type: 'uuid', description: 'Store ID' },
        { name: 'code', type: 'varchar', description: 'Method code: stripe, paypal, bank_transfer, cod, mollie' },
        { name: 'name', type: 'varchar', description: 'Display name' },
        { name: 'is_active', type: 'boolean', description: 'Enable/disable method' },
        { name: 'settings', type: 'jsonb', description: 'Provider-specific settings (API keys, etc.)', is_jsonb: true },
        { name: 'countries', type: 'jsonb', description: 'Allowed countries array', is_jsonb: true },
        { name: 'min_order_amount', type: 'numeric', description: 'Minimum order amount' },
        { name: 'max_order_amount', type: 'numeric', description: 'Maximum order amount' },
        { name: 'sort_order', type: 'integer', description: 'Display order at checkout' }
      ],
      important_notes: 'API keys stored in settings JSONB. Each provider has different required settings.'
    },
    // Shipping Methods
    {
      table_name: 'shipping_methods',
      description: 'Shipping/delivery methods with rates and conditions.',
      columns: [
        { name: 'id', type: 'uuid', description: 'Shipping method ID' },
        { name: 'store_id', type: 'uuid', description: 'Store ID' },
        { name: 'code', type: 'varchar', description: 'Method code: flat_rate, free_shipping, table_rate, pickup' },
        { name: 'name', type: 'varchar', description: 'Display name' },
        { name: 'is_active', type: 'boolean', description: 'Enable/disable method' },
        { name: 'price', type: 'numeric', description: 'Shipping price (for flat rate)' },
        { name: 'free_shipping_threshold', type: 'numeric', description: 'Order amount for free shipping' },
        { name: 'countries', type: 'jsonb', description: 'Allowed countries', is_jsonb: true },
        { name: 'conditions', type: 'jsonb', description: 'Weight/price conditions', is_jsonb: true },
        { name: 'estimated_days', type: 'varchar', description: 'Estimated delivery time text' },
        { name: 'sort_order', type: 'integer', description: 'Display order' }
      ],
      important_notes: 'Table rates use conditions JSONB for weight/price-based pricing.'
    },
    // CMS Pages
    {
      table_name: 'cms_pages',
      description: 'Static content pages (About, Contact, Terms, Privacy, etc.).',
      columns: [
        { name: 'id', type: 'uuid', description: 'Page ID' },
        { name: 'store_id', type: 'uuid', description: 'Store ID' },
        { name: 'slug', type: 'varchar', description: 'URL slug (e.g., about-us)' },
        { name: 'title', type: 'varchar', description: 'Page title' },
        { name: 'content', type: 'text', description: 'HTML content' },
        { name: 'meta_title', type: 'varchar', description: 'SEO title' },
        { name: 'meta_description', type: 'text', description: 'SEO description' },
        { name: 'is_active', type: 'boolean', description: 'Published status' },
        { name: 'translations', type: 'jsonb', description: 'Translations: { en: { title, content } }', is_jsonb: true }
      ],
      important_notes: 'Content can be HTML or use slot-based layout. Translations for multilingual.'
    },
    // CMS Blocks
    {
      table_name: 'cms_blocks',
      description: 'Reusable content blocks for embedding in pages/layouts.',
      columns: [
        { name: 'id', type: 'uuid', description: 'Block ID' },
        { name: 'store_id', type: 'uuid', description: 'Store ID' },
        { name: 'identifier', type: 'varchar', description: 'Unique identifier for embedding' },
        { name: 'title', type: 'varchar', description: 'Block title' },
        { name: 'content', type: 'text', description: 'HTML content' },
        { name: 'is_active', type: 'boolean', description: 'Active status' },
        { name: 'translations', type: 'jsonb', description: 'Translations', is_jsonb: true }
      ],
      important_notes: 'Embed blocks using identifier. Can be placed in slot configurations.'
    },
    // Tax Rates
    {
      table_name: 'tax_rates',
      description: 'Tax rates by country/region.',
      columns: [
        { name: 'id', type: 'uuid', description: 'Tax rate ID' },
        { name: 'store_id', type: 'uuid', description: 'Store ID' },
        { name: 'name', type: 'varchar', description: 'Rate name (e.g., VAT 21%)' },
        { name: 'rate', type: 'numeric', description: 'Tax percentage (e.g., 21.00)' },
        { name: 'country', type: 'varchar', description: 'Country code (e.g., NL, DE, US)' },
        { name: 'region', type: 'varchar', description: 'State/region (optional)' },
        { name: 'postcode', type: 'varchar', description: 'Postcode range (optional)' },
        { name: 'is_active', type: 'boolean', description: 'Active status' },
        { name: 'priority', type: 'integer', description: 'Priority when multiple rates match' }
      ],
      important_notes: 'Rates are matched by country > region > postcode. Priority resolves conflicts.'
    },
    // Tax Classes
    {
      table_name: 'tax_classes',
      description: 'Tax classes for products (Standard, Reduced, Zero, etc.).',
      columns: [
        { name: 'id', type: 'uuid', description: 'Tax class ID' },
        { name: 'store_id', type: 'uuid', description: 'Store ID' },
        { name: 'name', type: 'varchar', description: 'Class name' },
        { name: 'code', type: 'varchar', description: 'Class code' },
        { name: 'is_default', type: 'boolean', description: 'Default class for new products' }
      ],
      important_notes: 'Products are assigned a tax class. Tax rates are linked to tax classes.'
    },
    // Coupons
    {
      table_name: 'coupons',
      description: 'Discount coupons and promo codes.',
      columns: [
        { name: 'id', type: 'uuid', description: 'Coupon ID' },
        { name: 'store_id', type: 'uuid', description: 'Store ID' },
        { name: 'code', type: 'varchar', description: 'Coupon code (e.g., SAVE20)' },
        { name: 'name', type: 'varchar', description: 'Internal name' },
        { name: 'discount_type', type: 'varchar', description: 'Type: percentage, fixed_amount, free_shipping' },
        { name: 'discount_value', type: 'numeric', description: 'Discount value (% or amount)' },
        { name: 'min_order_amount', type: 'numeric', description: 'Minimum order to apply' },
        { name: 'max_uses', type: 'integer', description: 'Total usage limit' },
        { name: 'max_uses_per_customer', type: 'integer', description: 'Per-customer limit' },
        { name: 'times_used', type: 'integer', description: 'Current usage count' },
        { name: 'starts_at', type: 'timestamp', description: 'Valid from date' },
        { name: 'expires_at', type: 'timestamp', description: 'Expiration date' },
        { name: 'is_active', type: 'boolean', description: 'Active status' },
        { name: 'conditions', type: 'jsonb', description: 'Advanced conditions (products, categories)', is_jsonb: true }
      ],
      important_notes: 'Conditions JSONB can limit to specific products/categories. Check times_used < max_uses.'
    },
    // Customer Blacklist
    {
      table_name: 'customer_blacklist',
      description: 'Blacklisted customers/emails/IPs for fraud prevention.',
      columns: [
        { name: 'id', type: 'uuid', description: 'Entry ID' },
        { name: 'store_id', type: 'uuid', description: 'Store ID' },
        { name: 'type', type: 'varchar', description: 'Type: email, ip, phone, customer_id' },
        { name: 'value', type: 'varchar', description: 'Blocked value' },
        { name: 'reason', type: 'text', description: 'Reason for blocking' },
        { name: 'is_active', type: 'boolean', description: 'Active status' },
        { name: 'expires_at', type: 'timestamp', description: 'Optional expiration' }
      ],
      important_notes: 'Checked during checkout. Can block by email, IP, phone, or customer ID.'
    },
    // Analytics Settings (Google Tag Manager, etc.)
    {
      table_name: 'analytics_settings',
      description: 'Analytics and tracking settings (GTM, GA4, Facebook Pixel, etc.).',
      columns: [
        { name: 'id', type: 'uuid', description: 'Settings ID' },
        { name: 'store_id', type: 'uuid', description: 'Store ID' },
        { name: 'gtm_container_id', type: 'varchar', description: 'Google Tag Manager ID (GTM-XXXXX)' },
        { name: 'ga4_measurement_id', type: 'varchar', description: 'Google Analytics 4 ID (G-XXXXX)' },
        { name: 'facebook_pixel_id', type: 'varchar', description: 'Facebook/Meta Pixel ID' },
        { name: 'enable_ecommerce_tracking', type: 'boolean', description: 'Enable e-commerce events' },
        { name: 'custom_scripts', type: 'jsonb', description: 'Custom tracking scripts', is_jsonb: true }
      ],
      important_notes: 'GTM is preferred - load all tags through GTM. E-commerce tracking sends purchase events.'
    },
    // Credits/Usage
    {
      table_name: 'credits_usage',
      description: 'AI/API credits usage tracking.',
      columns: [
        { name: 'id', type: 'uuid', description: 'Usage ID' },
        { name: 'store_id', type: 'uuid', description: 'Store ID' },
        { name: 'user_id', type: 'uuid', description: 'User ID' },
        { name: 'service', type: 'varchar', description: 'Service: ai_chat, image_generation, api_calls' },
        { name: 'credits_used', type: 'numeric', description: 'Credits consumed' },
        { name: 'operation', type: 'varchar', description: 'Operation performed' },
        { name: 'metadata', type: 'jsonb', description: 'Additional details', is_jsonb: true },
        { name: 'created_at', type: 'timestamp', description: 'Usage timestamp' }
      ],
      important_notes: 'Track credits for billing. Aggregate by store_id for usage reports.'
    },
    // Background Jobs
    {
      table_name: 'background_jobs',
      description: 'Async background job queue (imports, exports, emails, etc.).',
      columns: [
        { name: 'id', type: 'uuid', description: 'Job ID' },
        { name: 'store_id', type: 'uuid', description: 'Store ID' },
        { name: 'type', type: 'varchar', description: 'Job type: import, export, email, sync, cleanup' },
        { name: 'status', type: 'varchar', description: 'Status: pending, running, completed, failed' },
        { name: 'payload', type: 'jsonb', description: 'Job data/parameters', is_jsonb: true },
        { name: 'result', type: 'jsonb', description: 'Job result/output', is_jsonb: true },
        { name: 'error', type: 'text', description: 'Error message if failed' },
        { name: 'progress', type: 'integer', description: 'Progress percentage 0-100' },
        { name: 'started_at', type: 'timestamp', description: 'Start time' },
        { name: 'completed_at', type: 'timestamp', description: 'Completion time' },
        { name: 'created_at', type: 'timestamp', description: 'Created time' }
      ],
      important_notes: 'Used for long-running operations. Poll status for progress updates.'
    },
    // Email Templates
    {
      table_name: 'email_templates',
      description: 'Transactional email templates (order confirmation, shipping, etc.).',
      columns: [
        { name: 'id', type: 'uuid', description: 'Template ID' },
        { name: 'store_id', type: 'uuid', description: 'Store ID' },
        { name: 'code', type: 'varchar', description: 'Template code: order_confirmation, shipping_notification, password_reset' },
        { name: 'subject', type: 'varchar', description: 'Email subject' },
        { name: 'body_html', type: 'text', description: 'HTML body with variables' },
        { name: 'body_text', type: 'text', description: 'Plain text body' },
        { name: 'is_active', type: 'boolean', description: 'Active status' },
        { name: 'translations', type: 'jsonb', description: 'Translations by locale', is_jsonb: true }
      ],
      important_notes: 'Templates use variables like {{order.number}}, {{customer.name}}. HTML and text versions.'
    },
    // Customers
    {
      table_name: 'customers',
      description: 'Customer accounts and profiles.',
      columns: [
        { name: 'id', type: 'uuid', description: 'Customer ID' },
        { name: 'store_id', type: 'uuid', description: 'Store ID' },
        { name: 'email', type: 'varchar', description: 'Email address' },
        { name: 'first_name', type: 'varchar', description: 'First name' },
        { name: 'last_name', type: 'varchar', description: 'Last name' },
        { name: 'phone', type: 'varchar', description: 'Phone number' },
        { name: 'is_active', type: 'boolean', description: 'Account active' },
        { name: 'is_verified', type: 'boolean', description: 'Email verified' },
        { name: 'metadata', type: 'jsonb', description: 'Custom fields', is_jsonb: true },
        { name: 'created_at', type: 'timestamp', description: 'Registration date' }
      ],
      important_notes: 'Customers can have multiple addresses. Orders linked by customer_id.'
    },
    // Customer Addresses
    {
      table_name: 'customer_addresses',
      description: 'Customer shipping/billing addresses.',
      columns: [
        { name: 'id', type: 'uuid', description: 'Address ID' },
        { name: 'customer_id', type: 'uuid', description: 'Customer ID' },
        { name: 'type', type: 'varchar', description: 'Type: shipping, billing' },
        { name: 'is_default', type: 'boolean', description: 'Default address' },
        { name: 'first_name', type: 'varchar', description: 'First name' },
        { name: 'last_name', type: 'varchar', description: 'Last name' },
        { name: 'company', type: 'varchar', description: 'Company name' },
        { name: 'address_line_1', type: 'varchar', description: 'Street address' },
        { name: 'address_line_2', type: 'varchar', description: 'Apt/Suite' },
        { name: 'city', type: 'varchar', description: 'City' },
        { name: 'state', type: 'varchar', description: 'State/Province' },
        { name: 'postcode', type: 'varchar', description: 'Postal code' },
        { name: 'country', type: 'varchar', description: 'Country code' },
        { name: 'phone', type: 'varchar', description: 'Phone number' }
      ],
      important_notes: 'Each customer can have multiple addresses with one default per type.'
    },
    // Wishlists
    {
      table_name: 'wishlists',
      description: 'Customer wishlists/favorites.',
      columns: [
        { name: 'id', type: 'uuid', description: 'Wishlist ID' },
        { name: 'customer_id', type: 'uuid', description: 'Customer ID' },
        { name: 'store_id', type: 'uuid', description: 'Store ID' },
        { name: 'product_id', type: 'uuid', description: 'Product ID' },
        { name: 'created_at', type: 'timestamp', description: 'Added date' }
      ],
      important_notes: 'Simple product-customer association. One entry per product per customer.'
    },
    // Product Reviews
    {
      table_name: 'product_reviews',
      description: 'Customer product reviews and ratings.',
      columns: [
        { name: 'id', type: 'uuid', description: 'Review ID' },
        { name: 'store_id', type: 'uuid', description: 'Store ID' },
        { name: 'product_id', type: 'uuid', description: 'Product ID' },
        { name: 'customer_id', type: 'uuid', description: 'Customer ID (optional for guest)' },
        { name: 'customer_name', type: 'varchar', description: 'Reviewer name' },
        { name: 'rating', type: 'integer', description: 'Rating 1-5' },
        { name: 'title', type: 'varchar', description: 'Review title' },
        { name: 'content', type: 'text', description: 'Review content' },
        { name: 'status', type: 'varchar', description: 'Status: pending, approved, rejected' },
        { name: 'is_verified_purchase', type: 'boolean', description: 'Verified buyer' },
        { name: 'created_at', type: 'timestamp', description: 'Review date' }
      ],
      important_notes: 'Reviews can require approval (status=pending). is_verified_purchase checked against orders.'
    },
    // Inventory/Stock
    {
      table_name: 'inventory',
      description: 'Product stock/inventory tracking.',
      columns: [
        { name: 'id', type: 'uuid', description: 'Inventory ID' },
        { name: 'product_id', type: 'uuid', description: 'Product ID' },
        { name: 'variant_id', type: 'uuid', description: 'Variant ID (optional)' },
        { name: 'warehouse_id', type: 'uuid', description: 'Warehouse location' },
        { name: 'quantity', type: 'integer', description: 'Current stock quantity' },
        { name: 'reserved', type: 'integer', description: 'Reserved for pending orders' },
        { name: 'low_stock_threshold', type: 'integer', description: 'Alert threshold' }
      ],
      important_notes: 'Available = quantity - reserved. Can have multiple warehouses per product.'
    },
    // Product Variants
    {
      table_name: 'product_variants',
      description: 'Product variants (size/color combinations).',
      columns: [
        { name: 'id', type: 'uuid', description: 'Variant ID' },
        { name: 'product_id', type: 'uuid', description: 'Parent product ID' },
        { name: 'sku', type: 'varchar', description: 'Variant SKU' },
        { name: 'price', type: 'numeric', description: 'Variant price (null = use parent)' },
        { name: 'attributes', type: 'jsonb', description: 'Variant attributes: { color: "red", size: "M" }', is_jsonb: true },
        { name: 'stock_quantity', type: 'integer', description: 'Stock quantity' },
        { name: 'is_active', type: 'boolean', description: 'Active status' }
      ],
      important_notes: 'Variants inherit from parent product. Attributes define the variant combination.'
    },
    // Import/Export Jobs
    {
      table_name: 'import_jobs',
      description: 'Product/order import jobs from CSV/Excel.',
      columns: [
        { name: 'id', type: 'uuid', description: 'Job ID' },
        { name: 'store_id', type: 'uuid', description: 'Store ID' },
        { name: 'type', type: 'varchar', description: 'Import type: products, orders, customers, inventory' },
        { name: 'file_url', type: 'varchar', description: 'Uploaded file URL' },
        { name: 'status', type: 'varchar', description: 'Status: pending, processing, completed, failed' },
        { name: 'total_rows', type: 'integer', description: 'Total rows in file' },
        { name: 'processed_rows', type: 'integer', description: 'Rows processed' },
        { name: 'success_count', type: 'integer', description: 'Successful imports' },
        { name: 'error_count', type: 'integer', description: 'Failed imports' },
        { name: 'errors', type: 'jsonb', description: 'Error details per row', is_jsonb: true }
      ],
      important_notes: 'Import is async. Poll status for progress. Errors array contains row-level failures.'
    },
    // Redirects
    {
      table_name: 'url_redirects',
      description: 'URL redirects (301/302) for SEO.',
      columns: [
        { name: 'id', type: 'uuid', description: 'Redirect ID' },
        { name: 'store_id', type: 'uuid', description: 'Store ID' },
        { name: 'source_path', type: 'varchar', description: 'Source URL path' },
        { name: 'target_path', type: 'varchar', description: 'Target URL path' },
        { name: 'redirect_type', type: 'integer', description: 'HTTP code: 301 (permanent) or 302 (temporary)' },
        { name: 'is_active', type: 'boolean', description: 'Active status' }
      ],
      important_notes: 'Use 301 for permanent moves (SEO). 302 for temporary. Auto-created when slugs change.'
    },
    // Notifications
    {
      table_name: 'notifications',
      description: 'Admin notifications and alerts.',
      columns: [
        { name: 'id', type: 'uuid', description: 'Notification ID' },
        { name: 'store_id', type: 'uuid', description: 'Store ID' },
        { name: 'user_id', type: 'uuid', description: 'Target user ID' },
        { name: 'type', type: 'varchar', description: 'Type: order, low_stock, review, system' },
        { name: 'title', type: 'varchar', description: 'Notification title' },
        { name: 'message', type: 'text', description: 'Notification message' },
        { name: 'is_read', type: 'boolean', description: 'Read status' },
        { name: 'link', type: 'varchar', description: 'Link to related item' },
        { name: 'created_at', type: 'timestamp', description: 'Created date' }
      ],
      important_notes: 'Notifications appear in admin panel. Can be filtered by type.'
    },
    // Store Currencies
    {
      table_name: 'store_currencies',
      description: 'Store currency settings and exchange rates.',
      columns: [
        { name: 'id', type: 'uuid', description: 'Currency ID' },
        { name: 'store_id', type: 'uuid', description: 'Store ID' },
        { name: 'code', type: 'varchar', description: 'Currency code (USD, EUR, GBP)' },
        { name: 'symbol', type: 'varchar', description: 'Currency symbol ($, €, £)' },
        { name: 'exchange_rate', type: 'numeric', description: 'Exchange rate to base currency' },
        { name: 'is_default', type: 'boolean', description: 'Default/base currency' },
        { name: 'is_active', type: 'boolean', description: 'Available for customers' },
        { name: 'decimal_places', type: 'integer', description: 'Decimal places to display' }
      ],
      important_notes: 'One currency must be default (is_default=true). Exchange rates relative to default.'
    },
    // Store Languages
    {
      table_name: 'store_languages',
      description: 'Store language settings.',
      columns: [
        { name: 'id', type: 'uuid', description: 'Language ID' },
        { name: 'store_id', type: 'uuid', description: 'Store ID' },
        { name: 'code', type: 'varchar', description: 'Language code (en, de, nl, fr)' },
        { name: 'name', type: 'varchar', description: 'Language name' },
        { name: 'is_default', type: 'boolean', description: 'Default language' },
        { name: 'is_active', type: 'boolean', description: 'Available for customers' },
        { name: 'is_rtl', type: 'boolean', description: 'Right-to-left language' }
      ],
      important_notes: 'Default language used when translation missing. RTL affects layout direction.'
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
    },
    // Product Labels API
    {
      name: 'List Product Labels',
      endpoint: 'GET /api/product-labels',
      description: 'Get all product labels for the store',
      response: 'Array of label objects with id, name, position, is_active, colors'
    },
    {
      name: 'Create Product Label',
      endpoint: 'POST /api/product-labels',
      description: 'Create a new product label/badge',
      parameters: '{ name, text_content, background_color, text_color, position, is_active }',
      usage: 'Use when user says "create a sale label" or "add new badge"'
    },
    {
      name: 'Update Product Label',
      endpoint: 'PUT /api/product-labels/:id',
      description: 'Update label properties',
      parameters: '{ name, text_content, background_color, text_color, position, is_active }',
      usage: 'Use when user says "change label position" or "disable label"'
    },
    {
      name: 'Delete Product Label',
      endpoint: 'DELETE /api/product-labels/:id',
      description: 'Delete a product label',
      usage: 'Use when user says "delete the sale label" or "remove badge"'
    },
    // Attributes API
    {
      name: 'List Attributes',
      endpoint: 'GET /api/attributes',
      description: 'Get all product attributes',
      response: 'Array of attribute objects with code, name, type, options'
    },
    {
      name: 'Create Attribute',
      endpoint: 'POST /api/attributes',
      description: 'Create a new product attribute',
      parameters: '{ code, name, type, is_filterable, is_visible, options: [{value, label}] }',
      usage: 'Use when user says "create color attribute" or "add size attribute"'
    },
    {
      name: 'Update Attribute',
      endpoint: 'PUT /api/attributes/:id',
      description: 'Update attribute properties',
      parameters: '{ name, is_filterable, is_visible, options }',
      usage: 'Use when user says "make attribute filterable" or "add option to attribute"'
    },
    // SEO Templates API
    {
      name: 'List SEO Templates',
      endpoint: 'GET /api/seo-templates',
      description: 'Get SEO templates',
      response: 'Array of templates with entity_type, meta_title_template, meta_description_template'
    },
    {
      name: 'Create SEO Template',
      endpoint: 'POST /api/seo-templates',
      description: 'Create a new SEO template',
      parameters: '{ entity_type: "product"|"category"|"page", meta_title_template, meta_description_template }',
      usage: 'Use when user says "create SEO template for products" or "add meta template"'
    },
    {
      name: 'Update SEO Template',
      endpoint: 'PUT /api/seo-templates/:id',
      description: 'Update SEO template',
      parameters: '{ meta_title_template, meta_description_template, is_active }',
      usage: 'Use when user says "update product SEO template"'
    },
    // Custom Options API
    {
      name: 'List Custom Options',
      endpoint: 'GET /api/custom-options?product_id=:id',
      description: 'Get custom options for a product',
      response: 'Array of options with name, type, is_required, price_adjustment'
    },
    {
      name: 'Create Custom Option',
      endpoint: 'POST /api/custom-options',
      description: 'Add custom option to a product',
      parameters: '{ product_id, name, type: "text"|"select"|"checkbox", is_required, price_adjustment, options }',
      usage: 'Use when user says "add engraving option" or "add gift wrap option"'
    },
    // Product Tabs API
    {
      name: 'List Product Tabs',
      endpoint: 'GET /api/product-tabs',
      description: 'Get product tabs',
      response: 'Array of tabs with name, content_type, position, is_active'
    },
    {
      name: 'Create Product Tab',
      endpoint: 'POST /api/product-tabs',
      description: 'Create a new product tab',
      parameters: '{ name, content_type: "html"|"attribute"|"cms_block", content, position, is_active }',
      usage: 'Use when user says "add specifications tab" or "create details tab"'
    },
    {
      name: 'Update Product Tab',
      endpoint: 'PUT /api/product-tabs/:id',
      description: 'Update product tab',
      parameters: '{ name, content, position, is_active }',
      usage: 'Use when user says "reorder tabs" or "disable tab"'
    },
    // Cookie Consent API
    {
      name: 'Get Cookie Consent Settings',
      endpoint: 'GET /api/cookie-consent-settings',
      description: 'Get cookie consent configuration',
      response: 'Settings object with enabled, gdpr_mode, banner_position, colors'
    },
    {
      name: 'Update Cookie Consent',
      endpoint: 'PUT /api/cookie-consent-settings/:id',
      description: 'Update cookie consent settings',
      parameters: '{ enabled, gdpr_mode, banner_position, accept_button_bg_color, consent_expiry_days }',
      usage: 'Use when user says "enable GDPR mode" or "change cookie banner position"'
    },
    // Categories API
    {
      name: 'Create Category',
      endpoint: 'POST /api/categories',
      description: 'Create a new category',
      parameters: '{ parent_id, code, translations: { en: { name, description } }, position }',
      usage: 'Use when user says "create category" or "add subcategory"'
    },
    {
      name: 'Update Category',
      endpoint: 'PUT /api/categories/:id',
      description: 'Update category',
      parameters: '{ translations, parent_id, position, is_active }',
      usage: 'Use when user says "rename category" or "move category"'
    },
    // Orders API
    {
      name: 'List Orders',
      endpoint: 'GET /api/orders',
      description: 'Get orders with filtering',
      parameters: 'status, date_from, date_to, page, limit'
    },
    {
      name: 'Update Order Status',
      endpoint: 'PUT /api/orders/:id/status',
      description: 'Update order status',
      parameters: '{ status: "pending"|"processing"|"shipped"|"delivered"|"cancelled" }',
      usage: 'Use when user says "mark order as shipped" or "cancel order"'
    },
    // Custom Domains API
    {
      name: 'List Domains',
      endpoint: 'GET /api/domains',
      description: 'Get all custom domains for the store',
      response: 'Array of domain objects with domain, is_primary, ssl_status, is_verified'
    },
    {
      name: 'Add Domain',
      endpoint: 'POST /api/domains',
      description: 'Add a custom domain',
      parameters: '{ domain, is_primary }',
      usage: 'Use when user says "add custom domain" or "connect domain shop.example.com"'
    },
    {
      name: 'Verify Domain',
      endpoint: 'POST /api/domains/:id/verify',
      description: 'Trigger DNS verification for domain',
      usage: 'Use when user says "verify domain" or "check DNS"'
    },
    {
      name: 'Delete Domain',
      endpoint: 'DELETE /api/domains/:id',
      description: 'Remove a custom domain',
      usage: 'Use when user says "remove domain" or "delete custom domain"'
    },
    // Payment Methods API
    {
      name: 'List Payment Methods',
      endpoint: 'GET /api/payment-methods',
      description: 'Get all payment methods',
      response: 'Array with code, name, is_active, settings'
    },
    {
      name: 'Create Payment Method',
      endpoint: 'POST /api/payment-methods',
      description: 'Add a new payment method',
      parameters: '{ code: "stripe"|"paypal"|"bank_transfer"|"cod", name, is_active, settings: { api_key, secret_key } }',
      usage: 'Use when user says "add payment method" or "enable Stripe"'
    },
    {
      name: 'Update Payment Method',
      endpoint: 'PUT /api/payment-methods/:id',
      description: 'Update payment method settings',
      parameters: '{ is_active, settings, min_order_amount, max_order_amount, countries }',
      usage: 'Use when user says "disable PayPal" or "set minimum order for COD"'
    },
    {
      name: 'Delete Payment Method',
      endpoint: 'DELETE /api/payment-methods/:id',
      description: 'Remove a payment method',
      usage: 'Use when user says "remove payment method"'
    },
    // Shipping Methods API
    {
      name: 'List Shipping Methods',
      endpoint: 'GET /api/shipping-methods',
      description: 'Get all shipping methods',
      response: 'Array with code, name, price, is_active, conditions'
    },
    {
      name: 'Create Shipping Method',
      endpoint: 'POST /api/shipping-methods',
      description: 'Add a new shipping method',
      parameters: '{ code: "flat_rate"|"free_shipping"|"table_rate"|"pickup", name, price, free_shipping_threshold, estimated_days, countries }',
      usage: 'Use when user says "add shipping method" or "create free shipping"'
    },
    {
      name: 'Update Shipping Method',
      endpoint: 'PUT /api/shipping-methods/:id',
      description: 'Update shipping method',
      parameters: '{ name, price, is_active, free_shipping_threshold, conditions, countries }',
      usage: 'Use when user says "change shipping price" or "set free shipping threshold"'
    },
    {
      name: 'Delete Shipping Method',
      endpoint: 'DELETE /api/shipping-methods/:id',
      description: 'Remove a shipping method',
      usage: 'Use when user says "remove shipping option"'
    },
    // CMS Pages API
    {
      name: 'List CMS Pages',
      endpoint: 'GET /api/cms-pages',
      description: 'Get all CMS pages',
      response: 'Array of pages with slug, title, is_active'
    },
    {
      name: 'Create CMS Page',
      endpoint: 'POST /api/cms-pages',
      description: 'Create a new static page',
      parameters: '{ slug, title, content, meta_title, meta_description, is_active }',
      usage: 'Use when user says "create about page" or "add terms page"'
    },
    {
      name: 'Update CMS Page',
      endpoint: 'PUT /api/cms-pages/:id',
      description: 'Update a CMS page',
      parameters: '{ title, content, meta_title, meta_description, is_active }',
      usage: 'Use when user says "update about page" or "change terms content"'
    },
    {
      name: 'Delete CMS Page',
      endpoint: 'DELETE /api/cms-pages/:id',
      description: 'Delete a CMS page',
      usage: 'Use when user says "delete page"'
    },
    // CMS Blocks API
    {
      name: 'List CMS Blocks',
      endpoint: 'GET /api/cms-blocks',
      description: 'Get all reusable content blocks',
      response: 'Array of blocks with identifier, title, is_active'
    },
    {
      name: 'Create CMS Block',
      endpoint: 'POST /api/cms-blocks',
      description: 'Create a reusable content block',
      parameters: '{ identifier, title, content, is_active }',
      usage: 'Use when user says "create content block" or "add banner block"'
    },
    {
      name: 'Update CMS Block',
      endpoint: 'PUT /api/cms-blocks/:id',
      description: 'Update a CMS block',
      parameters: '{ title, content, is_active }',
      usage: 'Use when user says "update banner block" or "change block content"'
    },
    // Tax API
    {
      name: 'List Tax Rates',
      endpoint: 'GET /api/tax-rates',
      description: 'Get all tax rates',
      response: 'Array of rates with name, rate, country, region'
    },
    {
      name: 'Create Tax Rate',
      endpoint: 'POST /api/tax-rates',
      description: 'Create a new tax rate',
      parameters: '{ name, rate, country, region, postcode, is_active, priority }',
      usage: 'Use when user says "add tax rate" or "create VAT 21% for Netherlands"'
    },
    {
      name: 'Update Tax Rate',
      endpoint: 'PUT /api/tax-rates/:id',
      description: 'Update a tax rate',
      parameters: '{ name, rate, is_active }',
      usage: 'Use when user says "change tax rate" or "update VAT percentage"'
    },
    {
      name: 'Delete Tax Rate',
      endpoint: 'DELETE /api/tax-rates/:id',
      description: 'Delete a tax rate',
      usage: 'Use when user says "remove tax rate"'
    },
    {
      name: 'List Tax Classes',
      endpoint: 'GET /api/tax-classes',
      description: 'Get all tax classes',
      response: 'Array of classes with name, code, is_default'
    },
    {
      name: 'Create Tax Class',
      endpoint: 'POST /api/tax-classes',
      description: 'Create a new tax class',
      parameters: '{ name, code, is_default }',
      usage: 'Use when user says "add tax class" or "create reduced tax class"'
    },
    // Coupons API
    {
      name: 'List Coupons',
      endpoint: 'GET /api/coupons',
      description: 'Get all discount coupons',
      response: 'Array of coupons with code, discount_type, discount_value, is_active'
    },
    {
      name: 'Create Coupon',
      endpoint: 'POST /api/coupons',
      description: 'Create a new discount coupon',
      parameters: '{ code, name, discount_type: "percentage"|"fixed_amount"|"free_shipping", discount_value, min_order_amount, max_uses, starts_at, expires_at, is_active }',
      usage: 'Use when user says "create coupon SAVE20" or "add 20% discount code"'
    },
    {
      name: 'Update Coupon',
      endpoint: 'PUT /api/coupons/:id',
      description: 'Update a coupon',
      parameters: '{ discount_value, max_uses, expires_at, is_active }',
      usage: 'Use when user says "disable coupon" or "extend coupon expiry"'
    },
    {
      name: 'Delete Coupon',
      endpoint: 'DELETE /api/coupons/:id',
      description: 'Delete a coupon',
      usage: 'Use when user says "delete coupon" or "remove promo code"'
    },
    // Blacklist API
    {
      name: 'List Blacklist',
      endpoint: 'GET /api/blacklist',
      description: 'Get all blacklisted entries',
      response: 'Array with type, value, reason, is_active'
    },
    {
      name: 'Add to Blacklist',
      endpoint: 'POST /api/blacklist',
      description: 'Add entry to blacklist',
      parameters: '{ type: "email"|"ip"|"phone"|"customer_id", value, reason, expires_at }',
      usage: 'Use when user says "blacklist email" or "block IP address"'
    },
    {
      name: 'Remove from Blacklist',
      endpoint: 'DELETE /api/blacklist/:id',
      description: 'Remove entry from blacklist',
      usage: 'Use when user says "remove from blacklist" or "unblock email"'
    },
    // Analytics Settings API
    {
      name: 'Get Analytics Settings',
      endpoint: 'GET /api/analytics-settings',
      description: 'Get analytics/tracking configuration',
      response: 'Settings with gtm_container_id, ga4_measurement_id, facebook_pixel_id'
    },
    {
      name: 'Update Analytics Settings',
      endpoint: 'PUT /api/analytics-settings',
      description: 'Update analytics settings',
      parameters: '{ gtm_container_id, ga4_measurement_id, facebook_pixel_id, enable_ecommerce_tracking }',
      usage: 'Use when user says "set Google Tag Manager ID" or "add Facebook Pixel"'
    },
    // Email Templates API
    {
      name: 'List Email Templates',
      endpoint: 'GET /api/email-templates',
      description: 'Get all email templates',
      response: 'Array with code, subject, is_active'
    },
    {
      name: 'Update Email Template',
      endpoint: 'PUT /api/email-templates/:id',
      description: 'Update an email template',
      parameters: '{ subject, body_html, body_text, is_active }',
      usage: 'Use when user says "update order confirmation email" or "change email template"'
    },
    // Customers API
    {
      name: 'List Customers',
      endpoint: 'GET /api/customers',
      description: 'Get all customers',
      parameters: 'search, is_active, page, limit',
      response: 'Array of customers with email, name, is_active'
    },
    {
      name: 'Get Customer',
      endpoint: 'GET /api/customers/:id',
      description: 'Get customer details with orders and addresses',
      response: 'Customer object with orders, addresses, metadata'
    },
    {
      name: 'Update Customer',
      endpoint: 'PUT /api/customers/:id',
      description: 'Update customer details',
      parameters: '{ first_name, last_name, phone, is_active, metadata }',
      usage: 'Use when user says "update customer" or "deactivate customer account"'
    },
    // Product Reviews API
    {
      name: 'List Reviews',
      endpoint: 'GET /api/reviews',
      description: 'Get all product reviews',
      parameters: 'status, product_id, rating, page, limit'
    },
    {
      name: 'Approve Review',
      endpoint: 'PUT /api/reviews/:id/approve',
      description: 'Approve a pending review',
      usage: 'Use when user says "approve review" or "publish review"'
    },
    {
      name: 'Reject Review',
      endpoint: 'PUT /api/reviews/:id/reject',
      description: 'Reject a review',
      usage: 'Use when user says "reject review" or "remove review"'
    },
    // Inventory API
    {
      name: 'Get Inventory',
      endpoint: 'GET /api/inventory',
      description: 'Get inventory/stock levels',
      parameters: 'product_id, low_stock, page, limit'
    },
    {
      name: 'Update Inventory',
      endpoint: 'PUT /api/inventory/:productId',
      description: 'Update stock quantity',
      parameters: '{ quantity, low_stock_threshold }',
      usage: 'Use when user says "update stock" or "set inventory to 50"'
    },
    // Product Variants API
    {
      name: 'List Variants',
      endpoint: 'GET /api/products/:productId/variants',
      description: 'Get variants for a product',
      response: 'Array of variants with sku, price, attributes, stock_quantity'
    },
    {
      name: 'Create Variant',
      endpoint: 'POST /api/products/:productId/variants',
      description: 'Add a product variant',
      parameters: '{ sku, price, attributes: { color: "red", size: "M" }, stock_quantity }',
      usage: 'Use when user says "add variant" or "create size M variant"'
    },
    {
      name: 'Update Variant',
      endpoint: 'PUT /api/variants/:id',
      description: 'Update a variant',
      parameters: '{ price, stock_quantity, is_active }',
      usage: 'Use when user says "update variant price" or "disable variant"'
    },
    // Import/Export API
    {
      name: 'Start Import',
      endpoint: 'POST /api/imports',
      description: 'Start a product/order import job',
      parameters: '{ type: "products"|"orders"|"customers"|"inventory", file_url }',
      usage: 'Use when user says "import products from CSV" or "bulk import"'
    },
    {
      name: 'Get Import Status',
      endpoint: 'GET /api/imports/:id',
      description: 'Get import job progress',
      response: '{ status, progress, success_count, error_count, errors }'
    },
    {
      name: 'Export Data',
      endpoint: 'POST /api/exports',
      description: 'Export data to CSV/Excel',
      parameters: '{ type: "products"|"orders"|"customers", format: "csv"|"xlsx", filters }',
      usage: 'Use when user says "export orders" or "download products as CSV"'
    },
    // URL Redirects API
    {
      name: 'List Redirects',
      endpoint: 'GET /api/redirects',
      description: 'Get all URL redirects',
      response: 'Array with source_path, target_path, redirect_type'
    },
    {
      name: 'Create Redirect',
      endpoint: 'POST /api/redirects',
      description: 'Create a URL redirect',
      parameters: '{ source_path, target_path, redirect_type: 301|302 }',
      usage: 'Use when user says "add redirect" or "redirect old URL to new"'
    },
    {
      name: 'Delete Redirect',
      endpoint: 'DELETE /api/redirects/:id',
      description: 'Remove a redirect',
      usage: 'Use when user says "remove redirect"'
    },
    // Currencies API
    {
      name: 'List Currencies',
      endpoint: 'GET /api/currencies',
      description: 'Get store currencies',
      response: 'Array with code, symbol, exchange_rate, is_default'
    },
    {
      name: 'Add Currency',
      endpoint: 'POST /api/currencies',
      description: 'Add a new currency',
      parameters: '{ code, symbol, exchange_rate, is_active, decimal_places }',
      usage: 'Use when user says "add EUR currency" or "enable Euro"'
    },
    {
      name: 'Update Currency',
      endpoint: 'PUT /api/currencies/:id',
      description: 'Update currency settings',
      parameters: '{ exchange_rate, is_active, is_default }',
      usage: 'Use when user says "update exchange rate" or "set default currency"'
    },
    // Languages API
    {
      name: 'List Languages',
      endpoint: 'GET /api/languages',
      description: 'Get store languages',
      response: 'Array with code, name, is_default, is_active'
    },
    {
      name: 'Add Language',
      endpoint: 'POST /api/languages',
      description: 'Add a new language',
      parameters: '{ code, name, is_active, is_rtl }',
      usage: 'Use when user says "add German language" or "enable Dutch"'
    },
    {
      name: 'Update Language',
      endpoint: 'PUT /api/languages/:id',
      description: 'Update language settings',
      parameters: '{ is_active, is_default }',
      usage: 'Use when user says "set default language" or "disable language"'
    },
    // Background Jobs API
    {
      name: 'List Background Jobs',
      endpoint: 'GET /api/jobs',
      description: 'Get background jobs',
      parameters: 'type, status, page, limit',
      response: 'Array with type, status, progress, created_at'
    },
    {
      name: 'Get Job Status',
      endpoint: 'GET /api/jobs/:id',
      description: 'Get specific job details and progress',
      response: '{ type, status, progress, result, error }'
    },
    {
      name: 'Cancel Job',
      endpoint: 'DELETE /api/jobs/:id',
      description: 'Cancel a running job',
      usage: 'Use when user says "cancel import" or "stop job"'
    },
    // Credits/Usage API
    {
      name: 'Get Credits Usage',
      endpoint: 'GET /api/credits/usage',
      description: 'Get credits usage summary',
      parameters: 'date_from, date_to',
      response: '{ total_used, by_service: { ai_chat, image_generation } }'
    },
    {
      name: 'Get Credits Balance',
      endpoint: 'GET /api/credits/balance',
      description: 'Get current credits balance',
      response: '{ balance, plan_limit, reset_date }'
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
      name: 'Frontend Structure',
      content: `src/ directory structure:
- components/ - Reusable React components
  - storefront/ - Customer-facing components (Header, ProductCard, Cart)
  - admin/ - Admin panel components
  - editor/ - Slot editor components (UnifiedSlotsEditor, SlotRenderer)
  - ui/ - Base UI components (Button, Input, Modal) using shadcn/ui
  - ai-workspace/ - AI chat and workspace components
- pages/ - Route components
  - storefront/ - Customer pages (ProductDetail, CategoryPage, Checkout)
  - admin/ - Admin pages
  - editor/ - Slot editor pages (ProductSlotsEditor, HeaderSlotsEditor)
- contexts/ - React contexts
  - StoreSelectionContext - Current store selection
  - AIWorkspaceContext - AI workspace state
  - CartContext - Shopping cart state
  - TranslationContext - i18n translations
- hooks/ - Custom React hooks
  - useApiQueries - React Query hooks for API calls
  - useStoreBootstrap - Fetch store config on load
  - useDraftConfiguration - Draft vs published configs
- services/ - API service functions
- utils/ - Utility functions`
    },
    {
      name: 'Backend Structure',
      content: `backend/src/ directory structure:
- routes/ - Express route handlers
  - ai.js - AI chat endpoint (/api/ai/chat)
  - ai-training.js - AI training endpoints
  - products.js - Product CRUD
  - orders.js - Order management
  - stores.js - Store settings
  - public/ - Public storefront API
- services/ - Business logic
  - pluginService.js - Plugin execution
  - orderService.js - Order processing
  - emailService.js - Email sending
- database/ - Database connections
  - masterConnection.js - Master (shared) DB
  - tenantConnection.js - Per-store DB
- middleware/ - Express middleware
  - tenantMiddleware.js - Multi-tenant routing
  - authMiddleware.js - Authentication`
    },
    {
      name: 'Key React Components',
      content: `Important components:
- UnifiedSlotsEditor (src/components/editor/) - Main slot editor, handles all page types
- SlotRenderer - Renders slot configurations to React components
- ResponsiveIframe - Preview iframe with context bridging
- StoreProvider - Provides store context to storefront
- EditorStoreProvider - Provides store context to editor
- WorkspaceAIPanel - AI chat interface in workspace
- ProductCard - Product display in listings
- MiniCart - Cart dropdown in header
- StorefrontHeader - Main header component`
    },
    {
      name: 'Key Backend Services',
      content: `Important services:
- slotConfigurationService - Save/load slot configs
- pluginService - Execute plugins on events
- storageService - File uploads (Supabase/R2)
- emailService - Transactional emails
- analyticsService - Track events
- importService - CSV/Excel imports
- exportService - Data exports`
    },
    {
      name: 'Data Flow Pattern',
      content: `Storefront data flow:
1. User visits store URL
2. tenantMiddleware resolves store from domain/slug
3. Bootstrap API loads store config, settings, categories
4. StoreProvider provides data to all components
5. Components render using slot configurations

Editor data flow:
1. Admin selects store in StoreSelectionContext
2. EditorStoreProvider fetches store data
3. UnifiedSlotsEditor loads slot configuration
4. User edits slots visually
5. Save writes to slot_configurations table`
    },
    {
      name: 'Multi-Tenant Architecture',
      content: `Two database types:
1. Master DB (Supabase) - Shared data
   - tenants, users, subscriptions
   - ai_* tables for AI knowledge
   - plugin_registry

2. Tenant DBs (per-store) - Store-specific
   - products, categories, orders
   - customers, slot_configurations
   - store settings in stores.settings JSONB

Connection: tenantMiddleware.js resolves DB from request`
    },
    {
      name: 'API Patterns',
      content: `API conventions:
- GET /api/public/* - Public storefront APIs (no auth)
- GET/POST/PUT/DELETE /api/* - Admin APIs (auth required)
- Responses: { success: true, data: {...} } or { success: false, message: "error" }
- Pagination: ?page=1&limit=20
- Filtering: ?status=active&store_id=uuid
- Sorting: ?sort=created_at&order=desc`
    },
    {
      name: 'Slot Types Reference',
      content: `Available slot types for slot editor:
- container - Wrapper div
- text - Text content with HTML
- image - Image with src, alt
- button - Clickable button
- grid - CSS Grid layout
- flex - Flexbox layout
- html - Raw HTML injection
- product-card - Product display
- category-card - Category display
- breadcrumb - Navigation breadcrumb
- cms-block - Embedded CMS block
- custom - Custom component by name`
    },
    {
      name: 'Plugin System',
      content: `Plugin types:
1. Event Plugins - Trigger on storefront events
   - Triggers: page_view, add_to_cart, checkout_complete
   - Actions: show_popup, inject_script, send_webhook

2. Integration Plugins - Connect external services
   - Bol.com, Amazon, Shopify imports
   - Payment gateways (Stripe, PayPal, Mollie)

3. AI Plugins - AI-generated automations
   - Created via AI chat
   - Stored in plugin_data table`
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
      usage: 'Use when user says "hide quantity selector", "remove quantity input", "hide quantity", "no quantity picker", "disable quantity selection"'
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
    // Checkout Step Names (2-step checkout)
    {
      name: 'Checkout Step 1 Name (2-step)',
      setting_path: 'settings.checkout_2step_step1_name',
      table: 'stores',
      type: 'string',
      default_value: 'Information',
      description: 'Label for the first step in 2-step checkout.',
      usage: 'Use when user says "rename first checkout step" or "call step 1 Contact Info"'
    },
    {
      name: 'Checkout Step 2 Name (2-step)',
      setting_path: 'settings.checkout_2step_step2_name',
      table: 'stores',
      type: 'string',
      default_value: 'Payment',
      description: 'Label for the second step in 2-step checkout.',
      usage: 'Use when user says "rename payment step" or "call step 2 Complete Order"'
    },
    // Checkout Step Names (3-step checkout)
    {
      name: 'Checkout Step 1 Name (3-step)',
      setting_path: 'settings.checkout_3step_step1_name',
      table: 'stores',
      type: 'string',
      default_value: 'Information',
      description: 'Label for the first step in 3-step checkout.',
      usage: 'Use when user says "rename first step in 3-step checkout"'
    },
    {
      name: 'Checkout Step 2 Name (3-step)',
      setting_path: 'settings.checkout_3step_step2_name',
      table: 'stores',
      type: 'string',
      default_value: 'Shipping',
      description: 'Label for the second step in 3-step checkout.',
      usage: 'Use when user says "rename shipping step"'
    },
    {
      name: 'Checkout Step 3 Name (3-step)',
      setting_path: 'settings.checkout_3step_step3_name',
      table: 'stores',
      type: 'string',
      default_value: 'Payment',
      description: 'Label for the third step in 3-step checkout.',
      usage: 'Use when user says "rename final checkout step"'
    },
    // Product Gallery Settings
    // IMPORTANT: For "thumbnails on left/right", you must set BOTH product_gallery_layout AND vertical_gallery_position
    {
      name: 'Product Gallery Layout',
      setting_path: 'settings.product_gallery_layout',
      table: 'stores',
      type: 'string',
      default_value: 'horizontal',
      description: 'Product image thumbnails layout: "horizontal" (thumbnails below main image) or "vertical" (thumbnails on side). IMPORTANT: When user says "thumbnails on left" or "thumbnails on right", set this to "vertical" AND set vertical_gallery_position accordingly.',
      usage: 'Use when user says "thumbnails below", "horizontal gallery", "thumbnails on left", "thumbnails on right", "thumbnails on side"'
    },
    {
      name: 'Vertical Gallery Position',
      setting_path: 'settings.vertical_gallery_position',
      table: 'stores',
      type: 'string',
      default_value: 'left',
      description: 'When product_gallery_layout is "vertical", determines which side: "left" or "right". MUST be used together with product_gallery_layout="vertical".',
      usage: 'Use when user says "thumbnails on left" (set to "left") or "thumbnails on right" (set to "right"). Always set product_gallery_layout to "vertical" first.'
    },
    {
      name: 'Mobile Gallery Layout',
      setting_path: 'settings.mobile_gallery_layout',
      table: 'stores',
      type: 'string',
      default_value: 'below',
      description: 'How product thumbnails appear on mobile: "above" (thumbnails above main image) or "below" (thumbnails below main image).',
      usage: 'Use when user says "mobile thumbnails above", "thumbnails on top on mobile", "mobile gallery below"'
    },
    // Mobile & Pagination Settings
    {
      name: 'Mobile Filter Mode',
      setting_path: 'settings.mobile_filter_mode',
      table: 'stores',
      type: 'string',
      default_value: 'drawer',
      description: 'How filters appear on mobile: "drawer" (slide-out panel) or "inline" (shown inline on page).',
      usage: 'Use when user says "mobile filters as drawer", "inline filters on mobile", "filter panel on mobile"'
    },
    {
      name: 'Pagination Style',
      setting_path: 'settings.pagination',
      table: 'stores',
      type: 'string',
      default_value: 'numbered',
      description: 'Category page pagination style: "numbered" (page numbers), "load_more" (load more button), or "infinite" (infinite scroll).',
      usage: 'Use when user says "infinite scroll", "load more button", "page numbers", "numbered pagination"'
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
    },
    // Additional Button Colors
    {
      name: 'Checkout Button Color',
      setting_path: 'settings.theme.checkout_button_color',
      table: 'stores',
      type: 'string',
      default_value: '#000000',
      description: 'Color of the Checkout button in cart.',
      usage: 'Use when user says "checkout button color" or "change checkout button"'
    },
    {
      name: 'View Cart Button Color',
      setting_path: 'settings.theme.view_cart_button_color',
      table: 'stores',
      type: 'string',
      default_value: '#000000',
      description: 'Color of the View Cart button.',
      usage: 'Use when user says "view cart button color"'
    },
    {
      name: 'Place Order Button Color',
      setting_path: 'settings.theme.place_order_button_color',
      table: 'stores',
      type: 'string',
      default_value: '#000000',
      description: 'Color of the Place Order button on checkout.',
      usage: 'Use when user says "place order button color" or "order button"'
    },
    {
      name: 'Secondary Button Color',
      setting_path: 'settings.theme.secondary_button_color',
      table: 'stores',
      type: 'string',
      default_value: '#6b7280',
      description: 'Color of secondary/outline buttons.',
      usage: 'Use when user says "secondary button color"'
    },
    // Product Tabs Styling
    {
      name: 'Product Tabs Active Background',
      setting_path: 'settings.theme.product_tabs_active_bg',
      table: 'stores',
      type: 'string',
      default_value: '#000000',
      description: 'Background color of active product tab.',
      usage: 'Use when user says "active tab color" or "selected tab background"'
    },
    {
      name: 'Product Tabs Inactive Background',
      setting_path: 'settings.theme.product_tabs_inactive_bg',
      table: 'stores',
      type: 'string',
      default_value: '#f3f4f6',
      description: 'Background color of inactive product tabs.',
      usage: 'Use when user says "inactive tab color" or "unselected tab background"'
    },
    {
      name: 'Product Tabs Border Radius',
      setting_path: 'settings.theme.product_tabs_border_radius',
      table: 'stores',
      type: 'string',
      default_value: '8px',
      description: 'Border radius of product tabs.',
      usage: 'Use when user says "tab corners" or "rounded tabs"'
    }
  ];
}

/**
 * Common Operations Training Data
 * Examples of how to execute common user requests
 */
function getCommonOperationsKnowledge() {
  return [
    {
      name: 'Change Button Colors',
      operation_type: 'theme_setting',
      examples: [
        'change add to cart button color',
        'make add to cart red',
        'change cart button to blue',
        'update button color'
      ],
      tool: 'update_store_setting',
      pattern: 'update_store_setting(setting="add_to_cart_button_bg_color", value="#HEX_COLOR")',
      description: 'To change the Add to Cart button color, use update_store_setting with setting="add_to_cart_button_bg_color" and a hex color value. For text color use add_to_cart_button_text_color.',
      related_settings: ['add_to_cart_button_bg_color', 'add_to_cart_button_text_color', 'primary_button_color']
    },
    {
      name: 'Change Header Colors',
      operation_type: 'theme_setting',
      examples: [
        'change header background',
        'make header black',
        'change navigation color',
        'header icon color'
      ],
      tool: 'update_store_setting',
      pattern: 'update_store_setting(setting="header_bg_color", value="#HEX_COLOR")',
      description: 'To change header colors: header_bg_color for background, header_icon_color for icons.',
      related_settings: ['header_bg_color', 'header_icon_color', 'header_text_color']
    },
    {
      name: 'Add Component to Page',
      operation_type: 'layout_modification',
      examples: [
        'add banner to category page',
        'add reviews to product page',
        'add section to homepage',
        'add widget to cart'
      ],
      tool: 'configure_layout',
      pattern: 'configure_layout(pageType="PAGE", operation="add_slot", slotType="COMPONENT", position="POSITION")',
      description: 'To add components/sections to pages, use configure_layout with operation="add_slot". pageType can be: home, category, product, cart, checkout. Position can be: top, bottom, before:element, after:element.',
      page_types: ['home', 'category', 'product', 'cart', 'checkout', 'header', 'footer']
    },
    {
      name: 'Toggle Display Settings',
      operation_type: 'display_setting',
      examples: [
        'hide cart icon',
        'show language selector',
        'hide search bar',
        'enable reviews'
      ],
      tool: 'update_store_setting',
      pattern: 'update_store_setting(setting="SETTING_NAME", value=true|false)',
      description: 'To show/hide elements, use update_store_setting with boolean values. Common settings: hide_header_cart, hide_header_search, show_language_selector, enable_reviews.',
      common_toggles: ['hide_header_cart', 'hide_header_checkout', 'hide_header_search', 'show_permanent_search', 'show_language_selector', 'enable_reviews', 'enable_product_filters']
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
 * Workflow Knowledge - Multi-step task guides
 */
function getWorkflowKnowledge() {
  return [
    {
      name: 'Launch a Sale',
      workflow_type: 'multi_step',
      description: 'How to set up a store-wide or product sale',
      steps: [
        '1. Create coupon: POST /api/coupons with discount_type, discount_value, dates',
        '2. Optionally create "SALE" product label: POST /api/product-labels',
        '3. Assign label to sale products: PUT /api/products/:id with label_ids',
        '4. Update homepage banner via slot editor if needed',
        '5. Send email campaign (external)'
      ],
      examples: ['start a 20% off sale', 'create black friday discount', 'launch summer sale']
    },
    {
      name: 'Add New Product with Variants',
      workflow_type: 'multi_step',
      description: 'Create a product with size/color variants',
      steps: [
        '1. Create base product: POST /api/products',
        '2. Upload images: POST /api/storage/upload for each image',
        '3. Update product with image URLs',
        '4. Create variants: POST /api/products/:id/variants for each size/color',
        '5. Set inventory per variant: PUT /api/inventory/:productId'
      ],
      examples: ['add new t-shirt with sizes', 'create product with color options']
    },
    {
      name: 'Set Up Multi-Currency',
      workflow_type: 'configuration',
      description: 'Enable multiple currencies for the store',
      steps: [
        '1. Add currencies: POST /api/currencies for each (EUR, GBP, etc.)',
        '2. Set exchange rates relative to default currency',
        '3. Enable currency selector: update_store_setting(show_currency_selector, true)',
        '4. Test checkout with different currencies'
      ],
      examples: ['enable euro currency', 'add gbp to store', 'set up multi-currency']
    },
    {
      name: 'Set Up Shipping',
      workflow_type: 'configuration',
      description: 'Configure shipping methods and rates',
      steps: [
        '1. Create shipping methods: POST /api/shipping-methods',
        '2. Set prices and conditions per method',
        '3. Configure free shipping threshold if desired',
        '4. Assign countries to each method'
      ],
      examples: ['add free shipping over 50', 'set up flat rate shipping', 'configure shipping for europe']
    },
    {
      name: 'Configure Payment Methods',
      workflow_type: 'configuration',
      description: 'Set up payment options',
      steps: [
        '1. Add payment method: POST /api/payment-methods',
        '2. Configure provider settings (API keys)',
        '3. Set min/max order amounts if needed',
        '4. Assign allowed countries',
        '5. Test checkout flow'
      ],
      examples: ['enable paypal', 'add stripe payment', 'set up bank transfer']
    },
    {
      name: 'Import Products from CSV',
      workflow_type: 'bulk_operation',
      description: 'Bulk import products from spreadsheet',
      steps: [
        '1. Upload CSV file: POST /api/storage/upload',
        '2. Start import job: POST /api/imports with file_url and type="products"',
        '3. Poll job status: GET /api/imports/:id',
        '4. Review any errors in import result'
      ],
      examples: ['import products from csv', 'bulk upload products', 'import from spreadsheet']
    },
    {
      name: 'Set Up SEO',
      workflow_type: 'configuration',
      description: 'Configure SEO settings and templates',
      steps: [
        '1. Create SEO templates: POST /api/seo-templates for products/categories',
        '2. Set meta title pattern: {{product.name}} | {{store.name}}',
        '3. Set meta description pattern',
        '4. Configure URL redirects for old URLs: POST /api/redirects',
        '5. Update Google Analytics: PUT /api/analytics-settings'
      ],
      examples: ['improve seo', 'set up meta tags', 'configure google analytics']
    },
    {
      name: 'Customize Checkout Flow',
      workflow_type: 'configuration',
      description: 'Configure checkout experience',
      steps: [
        '1. Set checkout steps: update_store_setting(checkout_steps_count, 2 or 3)',
        '2. Rename steps: update_store_setting(checkout_2step_step1_name, "Your Info")',
        '3. Configure guest checkout: update_store_setting(allow_guest_checkout, true)',
        '4. Set phone requirement: update_store_setting(collect_phone_number_at_checkout, true)'
      ],
      examples: ['enable guest checkout', 'make checkout 3 steps', 'require phone at checkout']
    }
  ];
}

/**
 * Troubleshooting Knowledge
 */
function getTroubleshootingKnowledge() {
  return [
    {
      problem: 'Products not showing on storefront',
      causes: ['Product status is not "active"', 'Product not assigned to category', 'Category is not active', 'No stock (if inventory tracking enabled)'],
      solutions: [
        'Check product status: GET /api/products/:id - ensure status="active"',
        'Verify category assignment: product.category_ids should contain valid IDs',
        'Check category status: GET /api/categories/:id - ensure is_active=true',
        'If using inventory: ensure stock_quantity > 0 or infinite_stock=true'
      ]
    },
    {
      problem: 'Images not loading',
      causes: ['Invalid image URL', 'CORS issues', 'Storage bucket permissions', 'CDN cache'],
      solutions: [
        'Verify URL is accessible directly in browser',
        'Check Supabase storage bucket is public',
        'Re-upload image via /api/storage/upload',
        'Clear CDN cache if using'
      ]
    },
    {
      problem: 'Checkout not working',
      causes: ['Payment method not configured', 'No shipping method for country', 'Cart validation failed'],
      solutions: [
        'Check payment methods: GET /api/payment-methods - ensure at least one is_active',
        'Check shipping methods: GET /api/shipping-methods - ensure country is covered',
        'Check product stock availability',
        'Verify minimum order amount is met'
      ]
    },
    {
      problem: 'Settings not saving',
      causes: ['Cache not invalidated', 'React Query stale time', 'Database error'],
      solutions: [
        'Refresh the page',
        'Clear browser cache',
        'Check browser console for errors',
        'Verify API response shows success:true'
      ]
    },
    {
      problem: 'Slot editor changes not showing',
      causes: ['Draft not published', 'Browser cache', 'Preview vs Live mode'],
      solutions: [
        'Click Publish in slot editor',
        'Clear cache or use incognito',
        'Check if viewing draft or published version',
        'Verify slot_configurations table has correct page_type'
      ]
    },
    {
      problem: 'Translations missing',
      causes: ['Translation key not defined', 'Wrong language code', 'Not in translations JSONB'],
      solutions: [
        'Check translations table for store_id + language_code',
        'Verify JSONB structure: { key: "value" }',
        'Add missing translation via admin panel or API'
      ]
    }
  ];
}

/**
 * AI Credit Pricing Knowledge
 */
function getCreditPricingKnowledge() {
  return [
    {
      name: 'Credit System Overview',
      content: `AI features use a credit-based system. Credits are deducted based on:
- Model used (more powerful = more credits)
- Input tokens (text sent to AI)
- Output tokens (AI response length)
- Task complexity

Credit Balance: Check at Admin → Settings → Usage or GET /api/credits/balance
Usage History: Admin → Settings → Usage History or GET /api/credits/usage`
    },
    {
      name: 'Credit Costs by Model',
      content: `Credit costs per 1000 tokens (approximate):

CLAUDE MODELS (Anthropic):
- Claude 3.5 Sonnet: 3 credits input / 15 credits output - Best for complex coding, analysis
- Claude 3 Haiku: 0.25 credits input / 1.25 credits output - Fast, cheap for simple tasks
- Claude 3 Opus: 15 credits input / 75 credits output - Most powerful, use sparingly

GPT MODELS (OpenAI):
- GPT-4o: 2.5 credits input / 10 credits output - Good all-rounder
- GPT-4o-mini: 0.15 credits input / 0.6 credits output - Cheapest, basic tasks
- GPT-4 Turbo: 10 credits input / 30 credits output - Complex reasoning

GEMINI MODELS (Google):
- Gemini 1.5 Pro: 1.25 credits input / 5 credits output - Long context, good value
- Gemini 1.5 Flash: 0.075 credits input / 0.3 credits output - Very fast and cheap`
    },
    {
      name: 'Task Credit Estimates',
      content: `Typical credit usage per task:

LIGHT TASKS (1-5 credits):
- Simple chat response
- Quick question answer
- Short text generation

MEDIUM TASKS (5-20 credits):
- Product description generation
- Code snippet creation
- Translation of short text

HEAVY TASKS (20-100 credits):
- Full page content generation
- Complex code generation
- Plugin creation
- Bulk translations

VERY HEAVY (100+ credits):
- Full codebase analysis
- Large document processing
- Batch operations with AI`
    },
    {
      name: 'Credit Optimization Tips',
      content: `How to reduce credit usage:

1. USE THE RIGHT MODEL:
   - Simple tasks → Haiku or GPT-4o-mini (10x cheaper)
   - Complex tasks → Sonnet or GPT-4o
   - Only use Opus for critical complex work

2. REDUCE TOKEN USAGE:
   - Be concise in prompts
   - Don't repeat information
   - Use system prompts efficiently

3. CACHE RESULTS:
   - Store AI responses for reuse
   - Don't regenerate same content

4. BATCH OPERATIONS:
   - Group similar requests
   - Use bulk endpoints when available

5. SET LIMITS:
   - Configure max_tokens in requests
   - Set daily/monthly credit limits per user`
    },
    {
      name: 'Credit Plans and Limits',
      content: `Subscription plans include monthly credits:

STARTER: 1,000 credits/month
- Basic AI chat
- Simple automations

PROFESSIONAL: 10,000 credits/month
- Full AI workspace
- Plugin generation
- Bulk operations

ENTERPRISE: 100,000+ credits/month
- Custom limits
- Priority processing
- Dedicated support

Overage: Additional credits at $0.01 per credit
Credits reset monthly on billing date
Unused credits do NOT roll over`
    }
  ];
}

/**
 * LLM Model Selection Knowledge
 */
function getLLMModelKnowledge() {
  return [
    {
      name: 'Model Selection Guide',
      content: `Choosing the right model for each task:

FOR CHAT/CONVERSATION:
- Default: Claude 3.5 Sonnet - Best balance of quality and speed
- Budget: Claude 3 Haiku - Fast responses, lower cost
- Complex: Claude 3 Opus - When highest quality matters

FOR CODE GENERATION:
- Recommended: Claude 3.5 Sonnet - Excellent at coding
- Alternative: GPT-4o - Good for diverse languages
- Quick fixes: Claude 3 Haiku - Simple code changes

FOR TRANSLATIONS:
- Best quality: Claude 3.5 Sonnet - Understands context well
- Bulk/cheap: GPT-4o-mini or Gemini Flash - Good enough for most
- Technical: GPT-4o - Better for technical terminology

FOR CONTENT GENERATION:
- Marketing copy: Claude 3.5 Sonnet - Creative and on-brand
- Product descriptions: GPT-4o-mini - Fast and adequate
- Long-form: Gemini 1.5 Pro - Handles large context

FOR ANALYSIS/REASONING:
- Complex: Claude 3 Opus - Best reasoning capability
- Standard: Claude 3.5 Sonnet - Good for most analysis
- Quick: GPT-4o - Fast analytical responses`
    },
    {
      name: 'Model Capabilities Comparison',
      content: `Model strengths and weaknesses:

CLAUDE 3.5 SONNET:
✅ Best coding ability
✅ Follows instructions precisely
✅ Good at structured output (JSON)
✅ Excellent reasoning
❌ Higher cost than Haiku/mini

CLAUDE 3 HAIKU:
✅ Very fast (< 1 second)
✅ Very cheap
✅ Good for simple tasks
❌ Less capable for complex reasoning
❌ May miss nuances

CLAUDE 3 OPUS:
✅ Highest quality output
✅ Best for complex analysis
✅ Most creative
❌ Expensive (5x Sonnet)
❌ Slower response

GPT-4o:
✅ Good all-rounder
✅ Handles images well
✅ Wide language support
❌ Sometimes verbose

GPT-4o-mini:
✅ Cheapest option
✅ Fast responses
✅ Good for basic tasks
❌ Lower quality on complex tasks

GEMINI 1.5 PRO:
✅ 1M token context window
✅ Good for large documents
✅ Competitive pricing
❌ Sometimes inconsistent`
    },
    {
      name: 'Model Configuration in Code',
      content: `How to specify models in API calls:

// In AI chat endpoint
POST /api/ai/chat
{
  "message": "Generate product description",
  "model": "claude-3-5-sonnet",  // or "gpt-4o", "claude-3-haiku"
  "max_tokens": 1000
}

// Available model IDs:
Claude: claude-3-5-sonnet, claude-3-haiku, claude-3-opus
GPT: gpt-4o, gpt-4o-mini, gpt-4-turbo
Gemini: gemini-1.5-pro, gemini-1.5-flash

// In plugin code
const response = await ai.generate({
  model: 'claude-3-haiku',  // Use cheapest for simple tasks
  prompt: 'Summarize this text',
  maxTokens: 500
});

// Default model (if not specified): claude-3-5-sonnet`
    },
    {
      name: 'When to Use Each Model',
      content: `Quick decision guide:

"I need it fast and cheap" → Claude 3 Haiku or GPT-4o-mini
"I need good quality" → Claude 3.5 Sonnet (default)
"I need the absolute best" → Claude 3 Opus
"I have a huge document" → Gemini 1.5 Pro
"I need to process images" → GPT-4o or Claude 3.5 Sonnet

TASK → RECOMMENDED MODEL:
- Chat responses → Sonnet
- Quick Q&A → Haiku
- Code generation → Sonnet
- Code review → Sonnet or Opus
- Translations → Sonnet or GPT-4o-mini (bulk)
- Product descriptions → GPT-4o-mini or Haiku
- Complex analysis → Opus
- Plugin generation → Sonnet
- Email generation → Haiku
- SEO content → Sonnet`
    }
  ];
}

/**
 * AI Translation Knowledge
 */
function getAITranslationKnowledge() {
  return [
    {
      name: 'AI Translation System Overview',
      content: `The platform supports AI-powered translations:

AUTOMATIC TRANSLATION:
- Products, categories, CMS pages can be auto-translated
- Triggered manually or via background jobs
- Uses context-aware AI for better quality

TRANSLATION STORAGE:
- Stored in 'translations' JSONB column on each entity
- Structure: { "en": { "name": "...", "description": "..." }, "de": { ... } }
- Fallback to default language if translation missing

SUPPORTED ENTITIES:
- Products (name, description, meta_title, meta_description)
- Categories (name, description)
- CMS Pages (title, content)
- CMS Blocks (content)
- Email templates (subject, body)
- UI Labels (via translations table)`
    },
    {
      name: 'Translate via Admin Panel',
      content: `To translate content in admin:

FOR PRODUCTS:
1. Go to Admin → Products → Click product
2. Click "Translations" tab
3. Select target language from dropdown
4. Click "Auto-Translate" button to fill with AI
5. Review and edit translations
6. Click "Save"

FOR CATEGORIES:
1. Go to Admin → Categories → Click category
2. Same process as products

FOR CMS PAGES:
1. Go to Admin → Content → Pages
2. Click page → Translations tab
3. Auto-translate or manual entry

BULK TRANSLATION:
1. Go to Admin → Settings → Languages
2. Click "Translate All" for a language
3. Background job processes all content
4. Check progress in Admin → Jobs`
    },
    {
      name: 'Translation API Endpoints',
      content: `API endpoints for translations:

TRANSLATE SINGLE ENTITY:
POST /api/translations/translate
{
  "entity_type": "product",
  "entity_id": "uuid",
  "source_language": "en",
  "target_language": "de",
  "fields": ["name", "description"]
}

BULK TRANSLATE:
POST /api/translations/bulk
{
  "entity_type": "product",
  "target_language": "de",
  "limit": 100  // Process in batches
}

GET TRANSLATIONS:
GET /api/products/:id?include_translations=true

UPDATE TRANSLATIONS MANUALLY:
PUT /api/products/:id
{
  "translations": {
    "de": { "name": "Produktname", "description": "..." }
  }
}`
    },
    {
      name: 'Translation Best Practices',
      content: `Tips for quality translations:

1. ALWAYS REVIEW AI TRANSLATIONS:
   - AI is good but not perfect
   - Check product names, technical terms
   - Verify pricing/sizing terminology

2. USE GLOSSARY:
   - Define brand terms that shouldn't translate
   - Add technical terms with specific translations
   - Store in Admin → Settings → Translation Glossary

3. TRANSLATE IN ORDER:
   - First: UI labels (small, reusable)
   - Then: Categories (affects navigation)
   - Then: Products (bulk, review samples)
   - Last: CMS pages (longer content)

4. CONTEXT MATTERS:
   - AI uses product context for better translations
   - Category names help translate products correctly
   - Always translate parent before children

5. COST OPTIMIZATION:
   - Use GPT-4o-mini for bulk translations
   - Use Sonnet for important marketing content
   - Cache translations, don't re-translate unchanged content`
    },
    {
      name: 'Language Configuration',
      content: `Setting up store languages:

ADD NEW LANGUAGE:
1. Admin → Settings → Languages
2. Click "Add Language"
3. Select language code (de, fr, nl, es, etc.)
4. Set display name
5. Check "Active" to enable on storefront
6. Optionally set as default

LANGUAGE SETTINGS:
- Default Language: Shown when no translation exists
- Active Languages: Available on storefront selector
- RTL Support: For Arabic, Hebrew (is_rtl = true)

STOREFRONT LANGUAGE SELECTOR:
- Enable in Settings → Theme → show_language_selector = true
- Shows in header as dropdown
- Remembers customer preference in localStorage

URL STRUCTURE:
- Default: /product/my-product
- With language: /de/product/mein-produkt
- Slug can be translated per language`
    },
    {
      name: 'Translation Cron Jobs',
      content: `Automated translation jobs:

SETUP AUTO-TRANSLATION:
- Runs nightly for new/updated content
- Configure in Admin → Settings → Automation
- Select languages to auto-translate

JOB TYPES:
- translate_new_products: Products without translations
- translate_updated_products: Changed since last translation
- translate_categories: Category tree
- translate_cms: CMS pages and blocks

MONITOR JOBS:
GET /api/jobs?type=translation
- Shows status: pending, running, completed, failed
- Shows progress percentage
- Shows error count and details

RETRY FAILED:
POST /api/jobs/:id/retry
- Re-runs failed translation job
- Picks up where it left off`
    }
  ];
}

/**
 * Save entity definition to ai_entity_definitions
 */
async function saveEntityDefinition(item) {
  const { data: existing, error: selectError } = await masterDbClient
    .from('ai_entity_definitions')
    .select('id')
    .eq('table_name', item.table_name)
    .maybeSingle();

  if (selectError) {
    throw new Error(`Select failed for ${item.table_name}: ${selectError.message}`);
  }

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
    description: item.description + (item.important_notes ? ` Note: ${item.important_notes}` : ''),
    table_name: item.table_name,
    fields,
    supported_operations: ['list', 'get', 'create', 'update', 'delete'],
    is_active: true,
    category: 'trained',
    priority: 90,
    updated_at: new Date().toISOString()
  };

  if (existing) {
    const { error: updateError } = await masterDbClient.from('ai_entity_definitions').update(entityData).eq('id', existing.id);
    if (updateError) {
      throw new Error(`Update failed for ${item.table_name}: ${updateError.message}`);
    }
  } else {
    entityData.created_at = new Date().toISOString();
    const { error: insertError } = await masterDbClient.from('ai_entity_definitions').insert(entityData);
    if (insertError) {
      throw new Error(`Insert failed for ${item.table_name}: ${insertError.message}`);
    }
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
 * Save operation document for common AI operations
 * These help the AI understand which tool to use for common requests
 */
async function saveOperationDocument(op) {
  const title = op.name;

  const { data: existing } = await masterDbClient
    .from('ai_context_documents')
    .select('id')
    .eq('title', title)
    .eq('type', 'operation_pattern')
    .maybeSingle();

  // Format content with examples and pattern
  const content = `## ${op.name}

**Operation Type:** ${op.operation_type}
**Tool to Use:** ${op.tool}

**Pattern:**
\`${op.pattern}\`

**Description:** ${op.description}

**Example User Requests:**
${op.examples.map(e => `- "${e}"`).join('\n')}

${op.related_settings ? `**Related Settings:** ${op.related_settings.join(', ')}` : ''}
${op.page_types ? `**Page Types:** ${op.page_types.join(', ')}` : ''}
${op.common_toggles ? `**Common Toggles:** ${op.common_toggles.join(', ')}` : ''}`;

  const docData = {
    type: 'operation_pattern',
    title,
    content,
    category: 'core',
    priority: 95,  // High priority - show before general docs
    mode: 'store_editing',
    is_active: true,
    metadata: {
      operation_type: op.operation_type,
      tool: op.tool,
      examples: op.examples,
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

  // Generate embedding for semantic search
  if (docId) {
    try {
      await embeddingService.embedContextDocument(docId);
    } catch (e) {
      console.log(`   ⚠️ Embedding generation failed for ${title}: ${e.message}`);
    }
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
