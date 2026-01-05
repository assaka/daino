/**
 * AI Knowledge Training Script
 *
 * Analyzes the entire codebase using LLM (Anthropic/OpenAI) and populates
 * the AI tables with comprehensive knowledge about the system.
 *
 * This enables the Store Editing AI to answer ANY question intelligently
 * by having full knowledge of:
 * - Database schemas and field mappings
 * - API endpoints and their usage
 * - Frontend components and patterns
 * - Business logic and workflows
 * - Admin UI structure
 * - Slot/plugin system
 *
 * Usage: node scripts/ai-training/train-ai-knowledge.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const fs = require('fs');
const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');

// Verify environment
if (!process.env.MASTER_SUPABASE_URL || !process.env.MASTER_SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing MASTER_SUPABASE_URL or MASTER_SUPABASE_SERVICE_KEY in .env');
  process.exit(1);
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('❌ Missing ANTHROPIC_API_KEY in .env');
  process.exit(1);
}

console.log('✅ Environment loaded');
console.log(`   Master DB: ${process.env.MASTER_SUPABASE_URL.substring(0, 30)}...`);

// Initialize clients
const anthropic = new Anthropic();
const masterDb = createClient(
  process.env.MASTER_SUPABASE_URL,
  process.env.MASTER_SUPABASE_SERVICE_KEY
);

// Configuration
const CONFIG = {
  maxFilesPerBatch: 5,
  maxTokensPerAnalysis: 4096,
  model: 'claude-sonnet-4-20250514',
  categories: [
    'db_schemas',
    'api_routes',
    'models',
    'services',
    'frontend_components',
    'configs',
    'slot_system'
  ]
};

// File patterns to analyze
const FILE_PATTERNS = {
  db_schemas: {
    paths: ['backend/src/database/schemas'],
    extensions: ['.sql'],
    description: 'Database table definitions and schemas'
  },
  api_routes: {
    paths: ['backend/src/routes'],
    extensions: ['.js'],
    description: 'API endpoint definitions'
  },
  models: {
    paths: ['backend/src/models'],
    extensions: ['.js'],
    description: 'Data models and ORM definitions'
  },
  services: {
    paths: ['backend/src/services'],
    extensions: ['.js'],
    description: 'Business logic services'
  },
  frontend_components: {
    paths: ['src/components/admin', 'src/components/storefront', 'src/components/editor'],
    extensions: ['.jsx', '.tsx'],
    description: 'React components for admin and storefront'
  },
  configs: {
    paths: ['backend/src/configs'],
    extensions: ['.js'],
    description: 'Configuration files including slot configs'
  },
  slot_system: {
    paths: ['backend/src/configs/slot', 'src/components/editor/slot'],
    extensions: ['.js', '.jsx'],
    description: 'Slot configuration and rendering system'
  }
};

/**
 * Recursively find files matching patterns
 */
function findFiles(basePath, extensions, maxDepth = 5) {
  const files = [];
  const rootDir = path.join(__dirname, '../../..');
  const fullPath = path.join(rootDir, basePath);

  if (!fs.existsSync(fullPath)) {
    console.log(`  ⚠️ Path not found: ${basePath}`);
    return files;
  }

  function walk(dir, depth = 0) {
    if (depth > maxDepth) return;

    try {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const itemPath = path.join(dir, item);
        const stat = fs.statSync(itemPath);

        if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
          walk(itemPath, depth + 1);
        } else if (stat.isFile() && extensions.some(ext => item.endsWith(ext))) {
          files.push({
            path: itemPath,
            relativePath: path.relative(rootDir, itemPath),
            name: item,
            size: stat.size
          });
        }
      }
    } catch (e) {
      // Skip inaccessible directories
    }
  }

  walk(fullPath);
  return files;
}

/**
 * Read file content with size limit
 */
function readFileContent(filePath, maxSize = 50000) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    if (content.length > maxSize) {
      return content.substring(0, maxSize) + '\n\n[... truncated ...]';
    }
    return content;
  } catch (e) {
    return null;
  }
}

/**
 * Analyze files using Claude
 */
async function analyzeWithAI(category, files, categoryDescription) {
  const results = [];

  console.log(`\n📊 Analyzing ${files.length} files for ${category}...`);

  // Process in batches
  for (let i = 0; i < files.length; i += CONFIG.maxFilesPerBatch) {
    const batch = files.slice(i, i + CONFIG.maxFilesPerBatch);
    const batchNum = Math.floor(i / CONFIG.maxFilesPerBatch) + 1;
    const totalBatches = Math.ceil(files.length / CONFIG.maxFilesPerBatch);

    console.log(`  Batch ${batchNum}/${totalBatches}: ${batch.map(f => f.name).join(', ')}`);

    // Build content for analysis
    const filesContent = batch.map(f => {
      const content = readFileContent(f.path);
      if (!content) return null;
      return `### File: ${f.relativePath}\n\`\`\`\n${content}\n\`\`\``;
    }).filter(Boolean).join('\n\n');

    if (!filesContent) continue;

    const prompt = getAnalysisPrompt(category, categoryDescription, filesContent);

    try {
      const response = await anthropic.messages.create({
        model: CONFIG.model,
        max_tokens: CONFIG.maxTokensPerAnalysis,
        messages: [{ role: 'user', content: prompt }]
      });

      const analysis = response.content[0]?.text;
      if (analysis) {
        // Parse the JSON response
        try {
          const parsed = JSON.parse(analysis);
          results.push(...(Array.isArray(parsed) ? parsed : [parsed]));
          console.log(`    ✅ Extracted ${Array.isArray(parsed) ? parsed.length : 1} knowledge items`);
        } catch (e) {
          // Try to extract JSON from markdown code block
          const jsonMatch = analysis.match(/```json\n?([\s\S]*?)\n?```/);
          if (jsonMatch) {
            try {
              const parsed = JSON.parse(jsonMatch[1]);
              results.push(...(Array.isArray(parsed) ? parsed : [parsed]));
              console.log(`    ✅ Extracted ${Array.isArray(parsed) ? parsed.length : 1} knowledge items`);
            } catch (e2) {
              console.log(`    ⚠️ Failed to parse response`);
            }
          }
        }
      }

      // Rate limiting
      await sleep(1000);
    } catch (error) {
      console.log(`    ❌ API error: ${error.message}`);
      await sleep(2000);
    }
  }

  return results;
}

/**
 * Get analysis prompt based on category
 */
function getAnalysisPrompt(category, description, filesContent) {
  const baseInstruction = `You are analyzing code files from a DainoStore e-commerce platform to extract knowledge for AI training.
Category: ${category} - ${description}

Analyze the following files and extract structured knowledge that would help an AI assistant understand and work with this system.`;

  const categoryPrompts = {
    db_schemas: `${baseInstruction}

For each table/schema found, extract:
- table_name: The table name
- description: What this table stores
- columns: Array of {name, type, description, is_jsonb: boolean}
- relationships: Foreign key relationships
- important_notes: Any special behaviors, triggers, or constraints

Return a JSON array of entity definitions.`,

    api_routes: `${baseInstruction}

For each API endpoint found, extract:
- endpoint: The full path (e.g., /api/products/:id)
- method: HTTP method (GET, POST, PUT, DELETE)
- description: What this endpoint does
- parameters: Query/body parameters
- response: What it returns
- authentication: Required auth level
- related_tables: Database tables it interacts with

Return a JSON array of endpoint definitions.`,

    models: `${baseInstruction}

For each model/entity found, extract:
- model_name: The model name
- table_name: Associated database table
- fields: Array of field definitions with types
- associations: Relationships with other models
- hooks: Any lifecycle hooks (beforeCreate, etc.)
- validation: Validation rules

Return a JSON array of model definitions.`,

    services: `${baseInstruction}

For each service found, extract:
- service_name: The service name
- purpose: What business logic it handles
- key_methods: Array of {name, description, parameters, returns}
- dependencies: Other services/modules it uses
- example_usage: How to use this service

Return a JSON array of service definitions.`,

    frontend_components: `${baseInstruction}

For each React component found, extract:
- component_name: The component name
- type: admin | storefront | editor | shared
- purpose: What this component does
- props: Expected props with types
- features: Key features/capabilities
- related_api: API endpoints it calls

Return a JSON array of component definitions.`,

    configs: `${baseInstruction}

For each configuration found, extract:
- config_name: The config name
- purpose: What it configures
- structure: The structure/schema of the config
- options: Available options/values
- defaults: Default values
- usage: How/where this config is used

Return a JSON array of config definitions.`,

    slot_system: `${baseInstruction}

For the slot/layout system, extract:
- slot_types: Available slot types with their properties
- page_types: Pages that support slots (product, category, cart, etc.)
- configuration_structure: How slot_configurations.configuration is structured
- rendering_logic: How slots are rendered
- available_components: What components can be used in slots
- positioning: How slots are positioned (before, after, replace)

Return a JSON array with comprehensive slot system documentation.`
  };

  return `${categoryPrompts[category] || baseInstruction}

IMPORTANT: Return ONLY valid JSON. No markdown, no explanations outside the JSON.

Files to analyze:
${filesContent}`;
}

/**
 * Save knowledge to AI tables
 */
async function saveToAITables(category, knowledge) {
  console.log(`\n💾 Saving ${knowledge.length} items to AI tables...`);

  let saved = 0;
  let errors = 0;

  for (const item of knowledge) {
    try {
      switch (category) {
        case 'db_schemas':
        case 'models':
          await saveEntityDefinition(item);
          break;
        case 'api_routes':
          await saveContextDocument('api_endpoint', item);
          break;
        case 'services':
          await saveContextDocument('service', item);
          break;
        case 'frontend_components':
          await saveCodePattern('component', item);
          break;
        case 'configs':
        case 'slot_system':
          await saveContextDocument('architecture', item);
          break;
      }
      saved++;
    } catch (e) {
      errors++;
      console.log(`  ❌ Failed to save: ${e.message}`);
    }
  }

  console.log(`  ✅ Saved: ${saved}, Errors: ${errors}`);
  return { saved, errors };
}

/**
 * Save entity definition to ai_entity_definitions
 */
async function saveEntityDefinition(item) {
  const tableName = item.table_name || item.model_name;
  if (!tableName) return;

  // Check if exists
  const { data: existing } = await masterDb
    .from('ai_entity_definitions')
    .select('id')
    .eq('table_name', tableName)
    .maybeSingle();

  const fields = {};
  if (item.columns) {
    item.columns.forEach(col => {
      fields[col.name] = {
        type: col.type,
        description: col.description,
        is_jsonb: col.is_jsonb || col.type?.toLowerCase().includes('json')
      };
    });
  } else if (item.fields) {
    item.fields.forEach(field => {
      fields[field.name || field] = {
        type: field.type || 'unknown',
        description: field.description
      };
    });
  }

  const entityData = {
    entity_name: tableName,
    display_name: tableName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    description: item.description || `${tableName} entity`,
    table_name: tableName,
    fields,
    metadata: {
      relationships: item.relationships || item.associations,
      important_notes: item.important_notes,
      hooks: item.hooks,
      validation: item.validation,
      trained_at: new Date().toISOString(),
      source: 'ai_training_script'
    },
    supported_operations: ['list', 'get', 'create', 'update', 'delete'],
    is_active: true,
    category: 'trained',
    priority: 50,
    updated_at: new Date().toISOString()
  };

  if (existing) {
    await masterDb
      .from('ai_entity_definitions')
      .update(entityData)
      .eq('id', existing.id);
  } else {
    entityData.created_at = new Date().toISOString();
    await masterDb
      .from('ai_entity_definitions')
      .insert(entityData);
  }
}

/**
 * Save context document to ai_context_documents
 */
async function saveContextDocument(type, item) {
  const title = item.endpoint || item.service_name || item.config_name || item.name || 'Unknown';

  // Check if exists
  const { data: existing } = await masterDb
    .from('ai_context_documents')
    .select('id')
    .eq('title', title)
    .eq('type', type)
    .maybeSingle();

  const docData = {
    type,
    title,
    content: JSON.stringify(item, null, 2),
    category: 'trained',
    priority: 50,
    mode: 'store_editing',
    metadata: {
      trained_at: new Date().toISOString(),
      source: 'ai_training_script'
    },
    is_active: true,
    updated_at: new Date().toISOString()
  };

  if (existing) {
    await masterDb
      .from('ai_context_documents')
      .update(docData)
      .eq('id', existing.id);
  } else {
    docData.created_at = new Date().toISOString();
    await masterDb
      .from('ai_context_documents')
      .insert(docData);
  }
}

/**
 * Save code pattern to ai_code_patterns
 */
async function saveCodePattern(type, item) {
  const name = item.component_name || item.name || 'Unknown';

  // Check if exists
  const { data: existing } = await masterDb
    .from('ai_code_patterns')
    .select('id')
    .eq('name', name)
    .maybeSingle();

  const patternData = {
    name,
    type,
    description: item.purpose || item.description,
    pattern: JSON.stringify(item, null, 2),
    metadata: {
      props: item.props,
      features: item.features,
      related_api: item.related_api,
      trained_at: new Date().toISOString(),
      source: 'ai_training_script'
    },
    is_active: true,
    updated_at: new Date().toISOString()
  };

  if (existing) {
    await masterDb
      .from('ai_code_patterns')
      .update(patternData)
      .eq('id', existing.id);
  } else {
    patternData.created_at = new Date().toISOString();
    await masterDb
      .from('ai_code_patterns')
      .insert(patternData);
  }
}

/**
 * Helper: Sleep
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Main training function
 */
async function runTraining() {
  console.log('🚀 Starting AI Knowledge Training...\n');
  console.log('=' .repeat(60));

  const stats = {
    totalFiles: 0,
    totalKnowledge: 0,
    byCategory: {}
  };

  for (const category of CONFIG.categories) {
    const pattern = FILE_PATTERNS[category];
    if (!pattern) continue;

    console.log(`\n📁 Category: ${category}`);
    console.log(`   ${pattern.description}`);

    // Find files
    let allFiles = [];
    for (const basePath of pattern.paths) {
      const files = findFiles(basePath, pattern.extensions);
      allFiles.push(...files);
    }

    console.log(`   Found ${allFiles.length} files`);
    stats.totalFiles += allFiles.length;

    if (allFiles.length === 0) continue;

    // Analyze with AI
    const knowledge = await analyzeWithAI(category, allFiles, pattern.description);

    // Save to AI tables
    const saveResult = await saveToAITables(category, knowledge);

    stats.totalKnowledge += saveResult.saved;
    stats.byCategory[category] = {
      files: allFiles.length,
      knowledge: saveResult.saved,
      errors: saveResult.errors
    };
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Training Summary');
  console.log('='.repeat(60));
  console.log(`Total files analyzed: ${stats.totalFiles}`);
  console.log(`Total knowledge items saved: ${stats.totalKnowledge}`);
  console.log('\nBy category:');
  for (const [cat, data] of Object.entries(stats.byCategory)) {
    console.log(`  ${cat}: ${data.files} files → ${data.knowledge} items`);
  }
  console.log('\n✅ Training complete!');
}

// Run training
runTraining().catch(console.error);
