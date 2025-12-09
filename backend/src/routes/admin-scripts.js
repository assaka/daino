const express = require('express');
const router = express.Router();

// Middleware to verify cron/admin secret
const verifyCronSecret = (req, res, next) => {
  const cronSecret = req.headers['x-cron-secret'];
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    console.warn('⚠️ CRON_SECRET not set in environment variables');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  if (cronSecret !== expectedSecret) {
    console.warn('⚠️ Invalid cron secret provided');
    return res.status(403).json({ error: 'Forbidden' });
  }

  next();
};

/**
 * POST /api/admin/backfill-embeddings
 *
 * Generates embeddings for AI context data.
 * Requires X-Cron-Secret header.
 *
 * Body params (all optional, defaults to all):
 *   - documents: boolean
 *   - examples: boolean
 *   - entities: boolean
 *   - training: boolean
 *   - markdown: boolean (note: may not work in Render if files aren't deployed)
 */
router.post('/backfill-embeddings', verifyCronSecret, async (req, res) => {
  const startTime = Date.now();

  // Check for OpenAI key
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({
      success: false,
      error: 'OPENAI_API_KEY environment variable is required'
    });
  }

  try {
    const embeddingService = require('../services/embeddingService');
    const { masterDbClient } = require('../database/masterConnection');

    // Parse options from request body
    const {
      documents = true,
      examples = true,
      entities = true,
      training = true,
      markdown = false // Default to false since files may not exist in Render
    } = req.body;

    const stats = {
      documents: { total: 0, success: 0, failed: 0 },
      examples: { total: 0, success: 0, failed: 0 },
      entities: { total: 0, success: 0, failed: 0 },
      training: { total: 0, success: 0, failed: 0 },
      markdown: { total: 0, success: 0, failed: 0 }
    };

    console.log('🚀 Starting embedding backfill...');
    console.log('Model:', process.env.EMBEDDING_MODEL || 'text-embedding-3-small');

    // Backfill ai_context_documents
    if (documents) {
      console.log('\n=== Backfilling ai_context_documents ===');
      const { data: docs, error } = await masterDbClient
        .from('ai_context_documents')
        .select('id, title')
        .is('embedding', null)
        .eq('is_active', true);

      if (!error && docs) {
        stats.documents.total = docs.length;
        console.log(`Found ${docs.length} documents to embed`);

        for (const doc of docs) {
          try {
            await embeddingService.embedContextDocument(doc.id);
            stats.documents.success++;
            console.log(`  [${stats.documents.success}/${docs.length}] Embedded: ${doc.title}`);
          } catch (err) {
            stats.documents.failed++;
            console.error(`  FAILED: ${doc.title} - ${err.message}`);
          }
        }
      }
    }

    // Backfill ai_plugin_examples
    if (examples) {
      console.log('\n=== Backfilling ai_plugin_examples ===');
      const { data: exampleList, error } = await masterDbClient
        .from('ai_plugin_examples')
        .select('id, name')
        .is('embedding', null)
        .eq('is_active', true);

      if (!error && exampleList) {
        stats.examples.total = exampleList.length;
        console.log(`Found ${exampleList.length} examples to embed`);

        for (const example of exampleList) {
          try {
            await embeddingService.embedPluginExample(example.id);
            stats.examples.success++;
            console.log(`  [${stats.examples.success}/${exampleList.length}] Embedded: ${example.name}`);
          } catch (err) {
            stats.examples.failed++;
            console.error(`  FAILED: ${example.name} - ${err.message}`);
          }
        }
      }
    }

    // Backfill ai_entity_definitions
    if (entities) {
      console.log('\n=== Backfilling ai_entity_definitions ===');
      const { data: entityList, error } = await masterDbClient
        .from('ai_entity_definitions')
        .select('id, entity_name')
        .is('embedding', null)
        .eq('is_active', true);

      if (!error && entityList) {
        stats.entities.total = entityList.length;
        console.log(`Found ${entityList.length} entities to embed`);

        for (const entity of entityList) {
          try {
            await embeddingService.embedEntityDefinition(entity.id);
            stats.entities.success++;
            console.log(`  [${stats.entities.success}/${entityList.length}] Embedded: ${entity.entity_name}`);
          } catch (err) {
            stats.entities.failed++;
            console.error(`  FAILED: ${entity.entity_name} - ${err.message}`);
          }
        }
      }
    }

    // Backfill ai_training_candidates
    if (training) {
      console.log('\n=== Backfilling ai_training_candidates ===');
      const { data: candidates, error } = await masterDbClient
        .from('ai_training_candidates')
        .select('id, user_prompt')
        .is('embedding', null)
        .in('training_status', ['approved', 'promoted']);

      if (!error && candidates) {
        stats.training.total = candidates.length;
        console.log(`Found ${candidates.length} training candidates to embed`);

        for (const candidate of candidates) {
          try {
            await embeddingService.embedTrainingCandidate(candidate.id);
            stats.training.success++;
            const preview = candidate.user_prompt.substring(0, 50) + '...';
            console.log(`  [${stats.training.success}/${candidates.length}] Embedded: ${preview}`);
          } catch (err) {
            stats.training.failed++;
            console.error(`  FAILED: ${candidate.id} - ${err.message}`);
          }
        }
      }
    }

    // Backfill markdown files (optional, may not work in Render)
    if (markdown) {
      console.log('\n=== Vectorizing Markdown Files ===');
      try {
        const fs = require('fs');
        const path = require('path');
        const documentChunker = require('../utils/documentChunker');

        const projectRoot = path.join(__dirname, '..', '..', '..');
        const markdownFiles = [
          { path: 'AI_TRAINING_CONTEXT.md', category: 'training', type: 'tutorial' },
          { path: 'AI_PLUGIN_ARCHITECTURE.md', category: 'plugins', type: 'architecture' },
          { path: 'CATALYST_AI_USP.md', category: 'core', type: 'reference' }
        ];

        for (const file of markdownFiles) {
          const filePath = path.join(projectRoot, file.path);

          if (!fs.existsSync(filePath)) {
            console.log(`  Skipping ${file.path} (not found)`);
            continue;
          }

          console.log(`\n  Processing: ${file.path}`);
          const content = fs.readFileSync(filePath, 'utf-8');
          const chunks = documentChunker.chunkMarkdown(content, {
            source: file.path,
            category: file.category,
            type: file.type
          });

          console.log(`  Chunked into ${chunks.length} sections`);
          stats.markdown.total += chunks.length;

          for (const chunk of chunks) {
            try {
              const chunkTitle = chunk.metadata.headers?.[0] || `${file.path} - Chunk ${chunk.metadata.chunkIndex}`;

              const { data: existing } = await masterDbClient
                .from('ai_context_documents')
                .select('id')
                .eq('title', chunkTitle)
                .eq('category', chunk.metadata.category)
                .single();

              if (existing) {
                await masterDbClient
                  .from('ai_context_documents')
                  .update({
                    content: chunk.content,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', existing.id);

                await embeddingService.embedContextDocument(existing.id);
                stats.markdown.success++;
                console.log(`    Updated & embedded: ${chunkTitle}`);
              } else {
                await embeddingService.embedAndInsertDocument({
                  type: chunk.metadata.type,
                  title: chunkTitle,
                  content: chunk.content,
                  category: chunk.metadata.category,
                  tags: [file.path, ...(chunk.metadata.headers || [])],
                  priority: 50,
                  mode: 'all',
                  metadata: chunk.metadata
                });
                stats.markdown.success++;
                console.log(`    Created & embedded: ${chunkTitle}`);
              }
            } catch (err) {
              stats.markdown.failed++;
              console.error(`    FAILED chunk ${chunk.metadata.chunkIndex}: ${err.message}`);
            }
          }
        }
      } catch (err) {
        console.error('Markdown processing error:', err.message);
      }
    }

    const duration = Date.now() - startTime;
    const totalSuccess = stats.documents.success + stats.examples.success +
      stats.entities.success + stats.training.success + stats.markdown.success;
    const totalFailed = stats.documents.failed + stats.examples.failed +
      stats.entities.failed + stats.training.failed + stats.markdown.failed;

    console.log('\n===========================================');
    console.log('           BACKFILL COMPLETE');
    console.log('===========================================');
    console.log(`Total: ${totalSuccess} succeeded, ${totalFailed} failed`);
    console.log(`Duration: ${(duration / 1000).toFixed(2)}s`);

    res.json({
      success: true,
      message: `Backfill complete: ${totalSuccess} succeeded, ${totalFailed} failed`,
      duration: `${(duration / 1000).toFixed(2)}s`,
      stats
    });

  } catch (error) {
    console.error('❌ Backfill error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/admin/backfill-embeddings/status
 *
 * Check how many records need embeddings
 */
router.get('/backfill-embeddings/status', verifyCronSecret, async (req, res) => {
  try {
    const { masterDbClient } = require('../database/masterConnection');

    const [documents, examples, entities, training] = await Promise.all([
      masterDbClient
        .from('ai_context_documents')
        .select('id', { count: 'exact', head: true })
        .is('embedding', null)
        .eq('is_active', true),
      masterDbClient
        .from('ai_plugin_examples')
        .select('id', { count: 'exact', head: true })
        .is('embedding', null)
        .eq('is_active', true),
      masterDbClient
        .from('ai_entity_definitions')
        .select('id', { count: 'exact', head: true })
        .is('embedding', null)
        .eq('is_active', true),
      masterDbClient
        .from('ai_training_candidates')
        .select('id', { count: 'exact', head: true })
        .is('embedding', null)
        .in('training_status', ['approved', 'promoted'])
    ]);

    res.json({
      success: true,
      pending: {
        documents: documents.count || 0,
        examples: examples.count || 0,
        entities: entities.count || 0,
        training: training.count || 0,
        total: (documents.count || 0) + (examples.count || 0) +
               (entities.count || 0) + (training.count || 0)
      }
    });

  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
