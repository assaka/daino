/**
 * AI Codebase Scanner & Trainer
 *
 * Scans the entire codebase and uses Claude to analyze and extract
 * comprehensive knowledge about the system.
 *
 * Usage: node scripts/ai-training/scan-and-train.js
 *
 * This will:
 * 1. Scan all SQL schemas → extract table definitions
 * 2. Scan all route files → extract API endpoints
 * 3. Scan all service files → extract business logic
 * 4. Scan all model files → extract entity relationships
 * 5. Scan configs → extract feature configurations
 * 6. Use Claude to analyze and understand each file
 * 7. Save structured knowledge to AI tables
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const fs = require('fs');
const Anthropic = require('@anthropic-ai/sdk');

// Use existing masterConnection which handles env parsing
const { masterDbClient } = require('../../src/database/masterConnection');

if (!masterDbClient) {
  console.error('❌ Master DB not initialized. Check env vars.');
  process.exit(1);
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('❌ Missing ANTHROPIC_API_KEY in .env');
  process.exit(1);
}

console.log('✅ Environment loaded - Master DB connected');

const anthropic = new Anthropic();
const masterDb = masterDbClient;

const ROOT_DIR = path.join(__dirname, '../../..');
const CONFIG = {
  model: 'claude-sonnet-4-20250514',
  maxTokens: 8192,
  batchSize: 3,
  delayMs: 1500
};

// ============================================
// FILE SCANNING
// ============================================

const SCAN_PATTERNS = [
  // Database schemas
  {
    category: 'db_schema',
    paths: ['backend/src/database/schemas'],
    extensions: ['.sql'],
    aiPrompt: `Analyze these SQL schema files and extract ALL tables with their columns.
For each table, identify:
- table_name
- description (infer from column names and comments)
- columns: [{name, type, description, is_jsonb}]
- important_notes (any JSONB structures, special behaviors, relationships)

Be thorough - extract EVERY table you find.
Return as JSON array.`
  },
  // API Routes
  {
    category: 'api_routes',
    paths: ['backend/src/routes'],
    extensions: ['.js'],
    aiPrompt: `Analyze these Express route files and extract ALL API endpoints.
For each endpoint:
- endpoint (full path with params like /api/products/:id)
- method (GET, POST, PUT, DELETE)
- description (what it does)
- parameters (query params, body structure)
- response (what it returns)
- authentication (required or not)
- features (what features/entities it relates to)

Be thorough - extract EVERY route you find.
Return as JSON array.`
  },
  // Services
  {
    category: 'services',
    paths: ['backend/src/services'],
    extensions: ['.js'],
    aiPrompt: `Analyze these service files and extract business logic knowledge.
For each service/feature:
- name
- description (what this service does)
- key_functions [{name, description, what_it_does}]
- related_tables (database tables it uses)
- related_features (other features it connects to)
- configuration_options (any settings/config it uses)

Focus on BUSINESS LOGIC - what features does this enable?
Return as JSON array.`
  },
  // Models
  {
    category: 'models',
    paths: ['backend/src/models'],
    extensions: ['.js'],
    aiPrompt: `Analyze these model files and extract entity definitions.
For each model:
- model_name
- table_name
- fields [{name, type, validation}]
- associations (relationships with other models)
- hooks (lifecycle hooks like beforeCreate)
- business_rules (any validation or business logic)

Return as JSON array.`
  },
  // Configs
  {
    category: 'configs',
    paths: ['backend/src/configs', 'src/configs'],
    extensions: ['.js', '.json'],
    aiPrompt: `Analyze these configuration files and extract feature configurations.
For each config:
- name
- purpose (what this configures)
- options (available settings)
- defaults (default values)
- how_to_use (how to change/configure this)

Focus on FEATURE CONFIGURATION - theme presets, default settings, etc.
Return as JSON array.`
  },
  // Frontend Pages (admin)
  {
    category: 'admin_pages',
    paths: ['src/pages/admin'],
    extensions: ['.jsx', '.tsx'],
    aiPrompt: `Analyze these admin page components and extract admin features.
For each page/feature:
- name
- path (URL path in admin)
- description (what this page does)
- capabilities (what can users do here)
- related_api (API endpoints it uses)

Focus on ADMIN FUNCTIONALITY - what can store owners do?
Return as JSON array.`
  },
  // Slot configs
  {
    category: 'slot_configs',
    paths: ['backend/src/configs/slot', 'src/components/editor/slot/configs'],
    extensions: ['.js'],
    aiPrompt: `Analyze these slot configuration files and extract slot system knowledge.
For each slot type or config:
- name
- type (slot_type, page_type, etc)
- description
- properties (available props)
- usage (how to use this)

Return as JSON array.`
  }
];

// ============================================
// HELPERS
// ============================================

function findFiles(basePath, extensions, maxDepth = 5) {
  const files = [];
  const fullPath = path.join(ROOT_DIR, basePath);

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
            relativePath: path.relative(ROOT_DIR, itemPath),
            name: item,
            size: stat.size
          });
        }
      }
    } catch (e) { /* skip */ }
  }

  walk(fullPath);
  return files;
}

function readFile(filePath, maxSize = 30000) {
  try {
    let content = fs.readFileSync(filePath, 'utf-8');
    if (content.length > maxSize) {
      content = content.substring(0, maxSize) + '\n\n[... truncated ...]';
    }
    return content;
  } catch (e) {
    return null;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// AI ANALYSIS
// ============================================

async function analyzeWithClaude(category, files, aiPrompt) {
  const results = [];

  // Process in batches
  for (let i = 0; i < files.length; i += CONFIG.batchSize) {
    const batch = files.slice(i, i + CONFIG.batchSize);
    const batchNum = Math.floor(i / CONFIG.batchSize) + 1;
    const totalBatches = Math.ceil(files.length / CONFIG.batchSize);

    console.log(`  Batch ${batchNum}/${totalBatches}: ${batch.map(f => f.name).join(', ')}`);

    // Build file content
    const filesContent = batch.map(f => {
      const content = readFile(f.path);
      if (!content) return null;
      return `### File: ${f.relativePath}\n\`\`\`\n${content}\n\`\`\``;
    }).filter(Boolean).join('\n\n');

    if (!filesContent) continue;

    const prompt = `${aiPrompt}

IMPORTANT: Return ONLY valid JSON array. No markdown code blocks, no explanations.

Files to analyze:
${filesContent}`;

    try {
      const response = await anthropic.messages.create({
        model: CONFIG.model,
        max_tokens: CONFIG.maxTokens,
        messages: [{ role: 'user', content: prompt }]
      });

      const text = response.content[0]?.text || '';

      // Try to parse JSON
      try {
        // Remove markdown code blocks if present
        let jsonText = text.trim();
        if (jsonText.startsWith('```')) {
          jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
        }

        const parsed = JSON.parse(jsonText);
        const items = Array.isArray(parsed) ? parsed : [parsed];
        results.push(...items);
        console.log(`    ✅ Extracted ${items.length} items`);
      } catch (parseError) {
        // Try to find JSON array in text
        const arrayMatch = text.match(/\[[\s\S]*\]/);
        if (arrayMatch) {
          try {
            const parsed = JSON.parse(arrayMatch[0]);
            results.push(...parsed);
            console.log(`    ✅ Extracted ${parsed.length} items (from array match)`);
          } catch (e) {
            console.log(`    ⚠️ Could not parse response`);
          }
        } else {
          console.log(`    ⚠️ No JSON found in response`);
        }
      }

      await sleep(CONFIG.delayMs);
    } catch (error) {
      console.log(`    ❌ API error: ${error.message}`);
      await sleep(3000);
    }
  }

  return results;
}

// ============================================
// SAVE TO DATABASE
// ============================================

async function saveEntityDefinition(item) {
  const tableName = item.table_name || item.name;
  if (!tableName) return false;

  try {
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
          is_jsonb: col.is_jsonb
        };
      });
    }

    const data = {
      entity_name: tableName,
      display_name: tableName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      description: item.description,
      table_name: tableName,
      fields,
      metadata: {
        important_notes: item.important_notes,
        relationships: item.relationships,
        scanned_at: new Date().toISOString()
      },
      supported_operations: ['list', 'get', 'create', 'update', 'delete'],
      is_active: true,
      category: 'scanned',
      priority: 70,
      updated_at: new Date().toISOString()
    };

    if (existing) {
      await masterDb.from('ai_entity_definitions').update(data).eq('id', existing.id);
    } else {
      data.created_at = new Date().toISOString();
      await masterDb.from('ai_entity_definitions').insert(data);
    }
    return true;
  } catch (e) {
    console.log(`    Error saving entity ${tableName}: ${e.message}`);
    return false;
  }
}

async function saveContextDocument(type, item) {
  const title = item.name || item.endpoint || item.title || 'Unknown';

  try {
    const { data: existing } = await masterDb
      .from('ai_context_documents')
      .select('id')
      .eq('title', title)
      .eq('type', type)
      .maybeSingle();

    const data = {
      type,
      title,
      content: typeof item === 'string' ? item : JSON.stringify(item, null, 2),
      category: 'scanned',
      priority: 70,
      mode: 'store_editing',
      is_active: true,
      updated_at: new Date().toISOString()
    };

    if (existing) {
      await masterDb.from('ai_context_documents').update(data).eq('id', existing.id);
    } else {
      data.created_at = new Date().toISOString();
      await masterDb.from('ai_context_documents').insert(data);
    }
    return true;
  } catch (e) {
    console.log(`    Error saving doc ${title}: ${e.message}`);
    return false;
  }
}

// ============================================
// MAIN SCANNER
// ============================================

async function runFullScan() {
  console.log('🔍 Starting Full Codebase Scan & AI Training\n');
  console.log('='.repeat(60));

  const stats = {
    filesScanned: 0,
    itemsExtracted: 0,
    itemsSaved: 0,
    errors: 0,
    byCategory: {}
  };

  for (const pattern of SCAN_PATTERNS) {
    console.log(`\n📁 Category: ${pattern.category}`);

    // Find all files
    let allFiles = [];
    for (const basePath of pattern.paths) {
      const files = findFiles(basePath, pattern.extensions);
      allFiles.push(...files);
    }

    console.log(`   Found ${allFiles.length} files to analyze`);
    stats.filesScanned += allFiles.length;

    if (allFiles.length === 0) continue;

    // Analyze with Claude
    const items = await analyzeWithClaude(pattern.category, allFiles, pattern.aiPrompt);
    stats.itemsExtracted += items.length;

    // Save to database
    console.log(`   Saving ${items.length} items to database...`);
    let saved = 0;

    for (const item of items) {
      let success = false;

      if (pattern.category === 'db_schema' || pattern.category === 'models') {
        success = await saveEntityDefinition(item);
      } else {
        success = await saveContextDocument(pattern.category, item);
      }

      if (success) saved++;
      else stats.errors++;
    }

    stats.itemsSaved += saved;
    stats.byCategory[pattern.category] = {
      files: allFiles.length,
      extracted: items.length,
      saved
    };

    console.log(`   ✅ Saved ${saved}/${items.length} items`);
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SCAN COMPLETE - Summary');
  console.log('='.repeat(60));
  console.log(`Files scanned: ${stats.filesScanned}`);
  console.log(`Items extracted: ${stats.itemsExtracted}`);
  console.log(`Items saved: ${stats.itemsSaved}`);
  console.log(`Errors: ${stats.errors}`);
  console.log('\nBy category:');
  for (const [cat, data] of Object.entries(stats.byCategory)) {
    console.log(`  ${cat}: ${data.files} files → ${data.extracted} items → ${data.saved} saved`);
  }
  console.log('\n✅ AI Knowledge Training Complete!');

  return stats;
}

// Run
runFullScan().catch(console.error);
