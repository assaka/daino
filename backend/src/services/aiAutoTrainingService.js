/**
 * AI Auto-Training Service
 *
 * Automatically imports training data from:
 * 1. Markdown documentation files in the project
 * 2. Successful AI chat conversations (auto-captured)
 * 3. Code comments and JSDoc annotations
 *
 * Runs periodically via cron or manually via admin endpoint
 */

const fs = require('fs');
const path = require('path');
const { masterDbClient } = require('../database/masterConnection');
const embeddingService = require('./embeddingService');
const documentChunker = require('../utils/documentChunker');

class AIAutoTrainingService {
  constructor() {
    // Directories to scan for markdown files
    this.docDirectories = [
      { path: 'docs', category: 'documentation', priority: 80 },
      { path: 'docs/internal', category: 'architecture', priority: 90 },
      { path: 'backend/src/services', category: 'services', priority: 70 },
      { path: 'backend/src/database', category: 'database', priority: 75 },
      { path: '.claude/agents', category: 'agents', priority: 85 }
    ];

    // Directories to scan for code patterns
    this.codeDirectories = [
      { path: 'backend/src/services', category: 'services', priority: 85 },
      { path: 'backend/src/routes', category: 'api', priority: 90 },
      { path: 'backend/src/middleware', category: 'middleware', priority: 75 },
      { path: 'backend/src/utils', category: 'utilities', priority: 70 },
      { path: 'src/components', category: 'components', priority: 65 },
      { path: 'src/hooks', category: 'hooks', priority: 70 },
      { path: 'src/contexts', category: 'contexts', priority: 70 }
    ];

    // File patterns to include
    this.includePatterns = ['.md', '.MD'];
    this.codePatterns = ['.js', '.jsx', '.ts', '.tsx'];

    // Files to exclude
    this.excludePatterns = ['node_modules', 'deprecated', 'backup', 'README.md', '.test.', '.spec.', 'dist', 'build'];
  }

  /**
   * Main entry point - run full auto-training
   */
  async runAutoTraining(options = {}) {
    const stats = {
      markdown: { scanned: 0, imported: 0, updated: 0, skipped: 0, errors: [] },
      code: { scanned: 0, extracted: 0, errors: [] },
      chat: { processed: 0, promoted: 0, errors: [] },
      embeddings: { generated: 0, errors: [] },
      startTime: Date.now()
    };

    console.log('🤖 Starting AI Auto-Training...');

    try {
      // 1. Import markdown documentation
      if (options.markdown !== false) {
        await this.importMarkdownDocs(stats);
      }

      // 2. Extract patterns from code
      if (options.code !== false) {
        await this.extractCodePatterns(stats);
      }

      // 3. Process pending training candidates from chat
      if (options.chat !== false) {
        await this.processTrainingCandidates(stats);
      }

      // 4. Generate embeddings for new documents
      if (options.embeddings !== false) {
        await this.generatePendingEmbeddings(stats);
      }

      stats.duration = `${((Date.now() - stats.startTime) / 1000).toFixed(2)}s`;
      console.log('✅ Auto-training complete:', stats);

      return { success: true, stats };
    } catch (error) {
      console.error('❌ Auto-training error:', error);
      return { success: false, error: error.message, stats };
    }
  }

  /**
   * Scan and import markdown files as AI context documents
   */
  async importMarkdownDocs(stats) {
    console.log('\n📄 Scanning markdown documentation...');

    const projectRoot = path.join(__dirname, '..', '..', '..');

    for (const dir of this.docDirectories) {
      const fullPath = path.join(projectRoot, dir.path);

      if (!fs.existsSync(fullPath)) {
        console.log(`  Skipping ${dir.path} (not found)`);
        continue;
      }

      await this.scanDirectory(fullPath, dir, stats, projectRoot);
    }
  }

  /**
   * Recursively scan directory for markdown files
   */
  async scanDirectory(dirPath, config, stats, projectRoot) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(projectRoot, fullPath);

      // Skip excluded patterns
      if (this.excludePatterns.some(p => relativePath.includes(p))) {
        continue;
      }

      if (entry.isDirectory()) {
        await this.scanDirectory(fullPath, config, stats, projectRoot);
      } else if (this.includePatterns.some(p => entry.name.endsWith(p))) {
        stats.markdown.scanned++;
        await this.importMarkdownFile(fullPath, relativePath, config, stats);
      }
    }
  }

  /**
   * Import a single markdown file
   */
  async importMarkdownFile(filePath, relativePath, config, stats) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const fileName = path.basename(filePath, '.md');

      // Create a meaningful title from the filename
      const title = fileName
        .replace(/_/g, ' ')
        .replace(/-/g, ' ')
        .replace(/([A-Z])/g, ' $1')
        .trim();

      // Check if document already exists (by source path)
      const { data: existing } = await masterDbClient
        .from('ai_context_documents')
        .select('id, content, updated_at')
        .eq('metadata->>source_path', relativePath)
        .single();

      // Calculate content hash to detect changes
      const contentHash = this.hashContent(content);

      if (existing) {
        // Check if content changed
        const existingHash = this.hashContent(existing.content);

        if (contentHash === existingHash) {
          stats.markdown.skipped++;
          return;
        }

        // Update existing document
        const { error } = await masterDbClient
          .from('ai_context_documents')
          .update({
            content: content,
            updated_at: new Date().toISOString(),
            embedding: null, // Clear embedding to regenerate
            metadata: {
              source_path: relativePath,
              content_hash: contentHash,
              auto_imported: true,
              last_sync: new Date().toISOString()
            }
          })
          .eq('id', existing.id);

        if (error) throw error;
        stats.markdown.updated++;
        console.log(`  📝 Updated: ${relativePath}`);
      } else {
        // Insert new document
        const { error } = await masterDbClient
          .from('ai_context_documents')
          .insert({
            type: 'documentation',
            title: title,
            content: content,
            category: config.category,
            tags: [relativePath, config.category, fileName],
            priority: config.priority,
            mode: 'all',
            is_active: true,
            metadata: {
              source_path: relativePath,
              content_hash: contentHash,
              auto_imported: true,
              last_sync: new Date().toISOString()
            }
          });

        if (error) throw error;
        stats.markdown.imported++;
        console.log(`  ✅ Imported: ${relativePath}`);
      }
    } catch (error) {
      stats.markdown.errors.push({ file: relativePath, error: error.message });
      console.error(`  ❌ Error importing ${relativePath}:`, error.message);
    }
  }

  /**
   * Extract patterns from code files (JSDoc, routes, services)
   */
  async extractCodePatterns(stats) {
    console.log('\n💻 Extracting patterns from code...');

    const projectRoot = path.join(__dirname, '..', '..', '..');

    for (const dir of this.codeDirectories) {
      const fullPath = path.join(projectRoot, dir.path);

      if (!fs.existsSync(fullPath)) {
        continue;
      }

      await this.scanCodeDirectory(fullPath, dir, stats, projectRoot);
    }
  }

  /**
   * Recursively scan directory for code files
   */
  async scanCodeDirectory(dirPath, config, stats, projectRoot) {
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        const relativePath = path.relative(projectRoot, fullPath);

        // Skip excluded patterns
        if (this.excludePatterns.some(p => relativePath.includes(p))) {
          continue;
        }

        if (entry.isDirectory()) {
          await this.scanCodeDirectory(fullPath, config, stats, projectRoot);
        } else if (this.codePatterns.some(p => entry.name.endsWith(p))) {
          stats.code.scanned++;
          await this.extractFromCodeFile(fullPath, relativePath, config, stats);
        }
      }
    } catch (error) {
      console.error(`  Error scanning ${dirPath}:`, error.message);
    }
  }

  /**
   * Extract training data from a code file
   */
  async extractFromCodeFile(filePath, relativePath, config, stats) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const fileName = path.basename(filePath);
      const examples = [];

      // Extract JSDoc comments with their functions
      const jsdocPattern = /\/\*\*[\s\S]*?\*\/\s*((?:async\s+)?(?:function|const|class|router\.[a-z]+)[^\n{]*)/g;
      let match;

      while ((match = jsdocPattern.exec(content)) !== null) {
        const jsdoc = match[0];
        const funcSignature = match[1];

        // Extract description from JSDoc
        const descMatch = jsdoc.match(/\*\s+([^@*][^\n]+)/);
        const description = descMatch ? descMatch[1].trim() : '';

        if (description && description.length > 20) {
          examples.push({
            type: 'jsdoc',
            description,
            signature: funcSignature.trim(),
            source: relativePath
          });
        }
      }

      // Extract route definitions (Express routes)
      const routePattern = /router\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/g;
      while ((match = routePattern.exec(content)) !== null) {
        const method = match[1].toUpperCase();
        const path = match[2];

        // Find the comment above this route
        const beforeRoute = content.substring(0, match.index);
        const commentMatch = beforeRoute.match(/\/\*\*[\s\S]*?\*\/\s*$/);

        if (commentMatch) {
          const descMatch = commentMatch[0].match(/\*\s+([^@*][^\n]+)/);
          const description = descMatch ? descMatch[1].trim() : '';

          if (description) {
            examples.push({
              type: 'api_route',
              method,
              path,
              description,
              source: relativePath
            });
          }
        }
      }

      // Extract class definitions with their methods
      const classPattern = /class\s+(\w+)[\s\S]*?constructor[\s\S]*?{([\s\S]*?)^\s{2}\}/gm;
      while ((match = classPattern.exec(content)) !== null) {
        const className = match[1];

        // Find the comment above the class
        const beforeClass = content.substring(0, match.index);
        const commentMatch = beforeClass.match(/\/\*\*[\s\S]*?\*\/\s*$/);

        if (commentMatch) {
          const descMatch = commentMatch[0].match(/\*\s+([^@*][^\n]+)/);
          const description = descMatch ? descMatch[1].trim() : '';

          if (description) {
            examples.push({
              type: 'class',
              name: className,
              description,
              source: relativePath
            });
          }
        }
      }

      // Save extracted examples as plugin examples
      for (const example of examples) {
        try {
          const title = example.type === 'api_route'
            ? `${example.method} ${example.path}`
            : example.type === 'class'
              ? `Class: ${example.name}`
              : example.signature?.substring(0, 50) || example.description.substring(0, 50);

          // Check if already exists
          const { data: existing } = await masterDbClient
            .from('ai_plugin_examples')
            .select('id')
            .eq('metadata->>source_path', relativePath)
            .eq('name', title)
            .single();

          if (!existing) {
            await masterDbClient
              .from('ai_plugin_examples')
              .insert({
                name: title,
                slug: this.slugify(title),
                description: example.description,
                category: config.category,
                complexity: 'intermediate',
                code: example.signature || '',
                features: [example.type],
                use_cases: [example.description],
                tags: [relativePath, config.category, example.type],
                is_active: true,
                metadata: {
                  source_path: relativePath,
                  extraction_type: example.type,
                  auto_extracted: true
                }
              });

            stats.code.extracted++;
          }
        } catch (insertError) {
          // Skip duplicates silently
          if (!insertError.message?.includes('duplicate')) {
            stats.code.errors.push({ file: relativePath, error: insertError.message });
          }
        }
      }

      if (examples.length > 0) {
        console.log(`  📦 Extracted ${examples.length} patterns from ${relativePath}`);
      }
    } catch (error) {
      stats.code.errors.push({ file: relativePath, error: error.message });
    }
  }

  /**
   * Create URL-safe slug
   */
  slugify(text) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50);
  }

  /**
   * Process training candidates from chat conversations
   * Auto-promote candidates with positive feedback
   */
  async processTrainingCandidates(stats) {
    console.log('\n💬 Processing training candidates from chat...');

    try {
      // Find candidates with positive feedback that haven't been promoted
      const { data: candidates, error } = await masterDbClient
        .from('ai_training_candidates')
        .select('*')
        .eq('training_status', 'pending')
        .gte('quality_score', 0.7) // Auto-promote high quality
        .is('embedding', null);

      if (error) throw error;

      stats.chat.processed = candidates?.length || 0;
      console.log(`  Found ${stats.chat.processed} candidates to process`);

      for (const candidate of (candidates || [])) {
        try {
          // Auto-approve if quality score is high enough
          if (candidate.quality_score >= 0.8) {
            await masterDbClient
              .from('ai_training_candidates')
              .update({
                training_status: 'approved',
                reviewed_at: new Date().toISOString(),
                reviewed_by: 'auto-training-service'
              })
              .eq('id', candidate.id);

            stats.chat.promoted++;
            console.log(`  ✅ Auto-approved candidate ${candidate.id.slice(0, 8)}...`);
          }
        } catch (err) {
          stats.chat.errors.push({ id: candidate.id, error: err.message });
        }
      }
    } catch (error) {
      console.error('  ❌ Error processing candidates:', error.message);
      stats.chat.errors.push({ error: error.message });
    }
  }

  /**
   * Generate embeddings for all documents without embeddings
   */
  async generatePendingEmbeddings(stats) {
    console.log('\n🧠 Generating embeddings for new documents...');

    try {
      // Get documents without embeddings
      const { data: docs, error } = await masterDbClient
        .from('ai_context_documents')
        .select('id, title')
        .is('embedding', null)
        .eq('is_active', true)
        .limit(100); // Process in batches

      if (error) throw error;

      console.log(`  Found ${docs?.length || 0} documents needing embeddings`);

      for (const doc of (docs || [])) {
        try {
          await embeddingService.embedContextDocument(doc.id);
          stats.embeddings.generated++;
          console.log(`  ✅ Embedded: ${doc.title}`);
        } catch (err) {
          stats.embeddings.errors.push({ id: doc.id, title: doc.title, error: err.message });
          console.error(`  ❌ Failed to embed ${doc.title}:`, err.message);
        }
      }

      // Also process training candidates
      const { data: candidates } = await masterDbClient
        .from('ai_training_candidates')
        .select('id')
        .is('embedding', null)
        .in('training_status', ['approved', 'promoted'])
        .limit(50);

      for (const candidate of (candidates || [])) {
        try {
          await embeddingService.embedTrainingCandidate(candidate.id);
          stats.embeddings.generated++;
        } catch (err) {
          stats.embeddings.errors.push({ id: candidate.id, error: err.message });
        }
      }
    } catch (error) {
      console.error('  ❌ Error generating embeddings:', error.message);
      stats.embeddings.errors.push({ error: error.message });
    }
  }

  /**
   * Simple hash function for content comparison
   */
  hashContent(content) {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  /**
   * Auto-capture successful AI response for training
   * Called after each AI chat interaction
   */
  async captureTrainingData({ userMessage, aiResponse, intent, entity, operation, wasSuccessful, storeId, userId }) {
    try {
      // Only capture successful, substantial interactions
      if (!wasSuccessful || !userMessage || userMessage.length < 10 || !aiResponse) {
        return { captured: false, reason: 'Not substantial enough' };
      }

      // Calculate initial quality score
      const qualityScore = this.calculateQualityScore({ userMessage, aiResponse, wasSuccessful });

      // Insert as training candidate
      const { data, error } = await masterDbClient
        .from('ai_training_candidates')
        .insert({
          user_prompt: userMessage,
          ai_response: aiResponse,
          intent_detected: intent,
          entity_type: entity,
          operation_type: operation,
          was_successful: wasSuccessful,
          quality_score: qualityScore,
          training_status: qualityScore >= 0.8 ? 'approved' : 'pending',
          store_id: storeId,
          user_id: userId,
          metadata: {
            auto_captured: true,
            captured_at: new Date().toISOString()
          }
        })
        .select()
        .single();

      if (error) throw error;

      return { captured: true, id: data.id, qualityScore };
    } catch (error) {
      console.error('Error capturing training data:', error);
      return { captured: false, error: error.message };
    }
  }

  /**
   * Calculate quality score for training candidate
   */
  calculateQualityScore({ userMessage, aiResponse, wasSuccessful }) {
    let score = 0.5; // Base score

    // Boost for successful completion
    if (wasSuccessful) score += 0.2;

    // Boost for substantial response
    if (aiResponse.length > 200) score += 0.1;
    if (aiResponse.length > 500) score += 0.1;

    // Boost for clear user intent
    if (userMessage.length > 20) score += 0.05;

    // Boost if response contains code
    if (aiResponse.includes('```')) score += 0.1;

    // Cap at 1.0
    return Math.min(score, 1.0);
  }
}

module.exports = new AIAutoTrainingService();
