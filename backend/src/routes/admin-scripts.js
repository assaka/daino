const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middleware/authMiddleware');

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
// Store for tracking background jobs
const backgroundJobs = new Map();

router.post('/backfill-embeddings', verifyCronSecret, async (req, res) => {
  const startTime = Date.now();
  const jobId = `backfill-${Date.now()}`;

  // Check for OpenAI key
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({
      success: false,
      error: 'OPENAI_API_KEY environment variable is required'
    });
  }

  // Parse options from request body
  const {
    documents = true,
    examples = true,
    entities = true,
    training = true,
    markdown = false, // Default to false since files may not exist in Render
    async: runAsync = false // Run in background and return immediately
  } = req.body;

  // If async mode, start the job in background and return immediately
  if (runAsync) {
    backgroundJobs.set(jobId, { status: 'running', startTime, stats: null });

    // Run in background
    runBackfillJob(jobId, { documents, examples, entities, training, markdown });

    return res.json({
      success: true,
      message: 'Backfill job started in background',
      jobId,
      checkStatusUrl: `/api/admin/backfill-embeddings/job/${jobId}`
    });
  }

  try {
    const embeddingService = require('../services/embeddingService');
    const { masterDbClient } = require('../database/masterConnection');

    const stats = {
      documents: { total: 0, success: 0, failed: 0, errors: [] },
      examples: { total: 0, success: 0, failed: 0, errors: [] },
      entities: { total: 0, success: 0, failed: 0, errors: [] },
      training: { total: 0, success: 0, failed: 0, errors: [] },
      markdown: { total: 0, success: 0, failed: 0, errors: [] }
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
            stats.documents.errors.push({ id: doc.id, title: doc.title, error: err.message });
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
            stats.examples.errors.push({ id: example.id, name: example.name, error: err.message });
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
            stats.entities.errors.push({ id: entity.id, name: entity.entity_name, error: err.message });
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
            stats.training.errors.push({ id: candidate.id, error: err.message });
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

    // Limit errors to first 5 per category for response size
    const limitedStats = {
      documents: { ...stats.documents, errors: stats.documents.errors.slice(0, 5) },
      examples: { ...stats.examples, errors: stats.examples.errors.slice(0, 5) },
      entities: { ...stats.entities, errors: stats.entities.errors.slice(0, 5) },
      training: { ...stats.training, errors: stats.training.errors.slice(0, 5) },
      markdown: { ...stats.markdown, errors: stats.markdown.errors.slice(0, 5) }
    };

    res.json({
      success: true,
      message: `Backfill complete: ${totalSuccess} succeeded, ${totalFailed} failed`,
      duration: `${(duration / 1000).toFixed(2)}s`,
      stats: limitedStats
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
 * POST /api/admin/run-backfill-embeddings
 *
 * Store owner accessible endpoint to run embedding backfill.
 * Requires JWT authentication with admin or store_owner role.
 *
 * Body params (all optional, defaults to all):
 *   - documents: boolean
 *   - examples: boolean
 *   - entities: boolean
 *   - training: boolean
 *   - async: boolean (run in background)
 */
router.post('/run-backfill-embeddings', authMiddleware, requireRole('admin', 'store_owner'), async (req, res) => {
  const startTime = Date.now();
  const jobId = `backfill-${Date.now()}`;

  // Check for OpenAI key
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({
      success: false,
      error: 'OPENAI_API_KEY environment variable is required'
    });
  }

  // Parse options from request body
  const {
    documents = true,
    examples = true,
    entities = true,
    training = true,
    async: runAsync = false
  } = req.body || {};

  console.log(`🚀 [${req.user.email}] Triggered embedding backfill (async: ${runAsync})`);

  // If async mode, start the job in background and return immediately
  if (runAsync) {
    backgroundJobs.set(jobId, { status: 'running', startTime, stats: null, triggeredBy: req.user.email });

    // Run in background
    runBackfillJob(jobId, { documents, examples, entities, training, markdown: false });

    return res.json({
      success: true,
      message: 'Backfill job started in background',
      jobId,
      checkStatusUrl: `/api/admin/backfill-embeddings/job/${jobId}`
    });
  }

  try {
    const embeddingService = require('../services/embeddingService');
    const { masterDbClient } = require('../database/masterConnection');

    const stats = {
      documents: { total: 0, success: 0, failed: 0, errors: [] },
      examples: { total: 0, success: 0, failed: 0, errors: [] },
      entities: { total: 0, success: 0, failed: 0, errors: [] },
      training: { total: 0, success: 0, failed: 0, errors: [] }
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
            stats.documents.errors.push({ id: doc.id, title: doc.title, error: err.message });
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
            stats.examples.errors.push({ id: example.id, name: example.name, error: err.message });
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
            stats.entities.errors.push({ id: entity.id, name: entity.entity_name, error: err.message });
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
            stats.training.errors.push({ id: candidate.id, error: err.message });
            console.error(`  FAILED: ${candidate.id} - ${err.message}`);
          }
        }
      }
    }

    const duration = Date.now() - startTime;
    const totalSuccess = stats.documents.success + stats.examples.success +
      stats.entities.success + stats.training.success;
    const totalFailed = stats.documents.failed + stats.examples.failed +
      stats.entities.failed + stats.training.failed;

    console.log('\n===========================================');
    console.log('           BACKFILL COMPLETE');
    console.log('===========================================');
    console.log(`Total: ${totalSuccess} succeeded, ${totalFailed} failed`);
    console.log(`Duration: ${(duration / 1000).toFixed(2)}s`);

    // Limit errors to first 5 per category for response size
    const limitedStats = {
      documents: { ...stats.documents, errors: stats.documents.errors.slice(0, 5) },
      examples: { ...stats.examples, errors: stats.examples.errors.slice(0, 5) },
      entities: { ...stats.entities, errors: stats.entities.errors.slice(0, 5) },
      training: { ...stats.training, errors: stats.training.errors.slice(0, 5) }
    };

    res.json({
      success: true,
      message: `Backfill complete: ${totalSuccess} succeeded, ${totalFailed} failed`,
      duration: `${(duration / 1000).toFixed(2)}s`,
      stats: limitedStats
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
 * GET /api/admin/embedding-status
 *
 * Store owner accessible endpoint to check pending embeddings.
 * Requires JWT authentication with admin or store_owner role.
 */
router.get('/embedding-status', authMiddleware, requireRole('admin', 'store_owner'), async (req, res) => {
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

/**
 * GET /api/admin/backfill-embeddings/status
 *
 * Check how many records need embeddings (cron secret version)
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

/**
 * GET /api/admin/backfill-embeddings/job/:jobId
 *
 * Check status of a background backfill job
 */
router.get('/backfill-embeddings/job/:jobId', verifyCronSecret, async (req, res) => {
  const { jobId } = req.params;
  const job = backgroundJobs.get(jobId);

  if (!job) {
    return res.status(404).json({
      success: false,
      error: 'Job not found'
    });
  }

  res.json({
    success: true,
    jobId,
    ...job
  });
});

/**
 * Background job runner for async mode
 */
async function runBackfillJob(jobId, options) {
  const startTime = Date.now();
  const embeddingService = require('../services/embeddingService');
  const { masterDbClient } = require('../database/masterConnection');

  const stats = {
    documents: { total: 0, success: 0, failed: 0, errors: [] },
    examples: { total: 0, success: 0, failed: 0, errors: [] },
    entities: { total: 0, success: 0, failed: 0, errors: [] },
    training: { total: 0, success: 0, failed: 0, errors: [] },
    markdown: { total: 0, success: 0, failed: 0, errors: [] }
  };

  try {
    console.log(`🚀 [${jobId}] Starting background embedding backfill...`);

    // Backfill ai_context_documents
    if (options.documents) {
      console.log(`[${jobId}] Backfilling ai_context_documents...`);
      const { data: docs, error } = await masterDbClient
        .from('ai_context_documents')
        .select('id, title')
        .is('embedding', null)
        .eq('is_active', true);

      if (!error && docs) {
        stats.documents.total = docs.length;
        for (const doc of docs) {
          try {
            await embeddingService.embedContextDocument(doc.id);
            stats.documents.success++;
          } catch (err) {
            stats.documents.failed++;
            stats.documents.errors.push({ id: doc.id, error: err.message });
          }
        }
      }
    }

    // Backfill ai_plugin_examples
    if (options.examples) {
      console.log(`[${jobId}] Backfilling ai_plugin_examples...`);
      const { data: exampleList, error } = await masterDbClient
        .from('ai_plugin_examples')
        .select('id, name')
        .is('embedding', null)
        .eq('is_active', true);

      if (!error && exampleList) {
        stats.examples.total = exampleList.length;
        for (const example of exampleList) {
          try {
            await embeddingService.embedPluginExample(example.id);
            stats.examples.success++;
          } catch (err) {
            stats.examples.failed++;
            stats.examples.errors.push({ id: example.id, error: err.message });
          }
        }
      }
    }

    // Backfill ai_entity_definitions
    if (options.entities) {
      console.log(`[${jobId}] Backfilling ai_entity_definitions...`);
      const { data: entityList, error } = await masterDbClient
        .from('ai_entity_definitions')
        .select('id, entity_name')
        .is('embedding', null)
        .eq('is_active', true);

      if (!error && entityList) {
        stats.entities.total = entityList.length;
        for (const entity of entityList) {
          try {
            await embeddingService.embedEntityDefinition(entity.id);
            stats.entities.success++;
          } catch (err) {
            stats.entities.failed++;
            stats.entities.errors.push({ id: entity.id, error: err.message });
          }
        }
      }
    }

    // Backfill ai_training_candidates
    if (options.training) {
      console.log(`[${jobId}] Backfilling ai_training_candidates...`);
      const { data: candidates, error } = await masterDbClient
        .from('ai_training_candidates')
        .select('id, user_prompt')
        .is('embedding', null)
        .in('training_status', ['approved', 'promoted']);

      if (!error && candidates) {
        stats.training.total = candidates.length;
        for (const candidate of candidates) {
          try {
            await embeddingService.embedTrainingCandidate(candidate.id);
            stats.training.success++;
          } catch (err) {
            stats.training.failed++;
            stats.training.errors.push({ id: candidate.id, error: err.message });
          }
        }
      }
    }

    const duration = Date.now() - startTime;
    const totalSuccess = stats.documents.success + stats.examples.success +
      stats.entities.success + stats.training.success;
    const totalFailed = stats.documents.failed + stats.examples.failed +
      stats.entities.failed + stats.training.failed;

    console.log(`✅ [${jobId}] Backfill complete: ${totalSuccess} succeeded, ${totalFailed} failed in ${(duration / 1000).toFixed(2)}s`);

    // Limit errors in stored stats
    const limitedStats = {
      documents: { ...stats.documents, errors: stats.documents.errors.slice(0, 5) },
      examples: { ...stats.examples, errors: stats.examples.errors.slice(0, 5) },
      entities: { ...stats.entities, errors: stats.entities.errors.slice(0, 5) },
      training: { ...stats.training, errors: stats.training.errors.slice(0, 5) },
      markdown: stats.markdown
    };

    backgroundJobs.set(jobId, {
      status: 'completed',
      startTime,
      duration: `${(duration / 1000).toFixed(2)}s`,
      message: `${totalSuccess} succeeded, ${totalFailed} failed`,
      stats: limitedStats
    });

  } catch (error) {
    console.error(`❌ [${jobId}] Backfill error:`, error);
    backgroundJobs.set(jobId, {
      status: 'failed',
      startTime,
      error: error.message
    });
  }

  // Clean up old jobs after 1 hour
  setTimeout(() => backgroundJobs.delete(jobId), 60 * 60 * 1000);
}

/**
 * POST /api/admin/refresh-tokens
 *
 * Refreshes OAuth tokens for all stores before they expire.
 * Designed to be called by Render Cron hourly.
 * Requires X-Cron-Secret header.
 *
 * Query params:
 *   - bufferMinutes: number (default 60) - Refresh tokens expiring within this many minutes
 *   - batchSize: number (default 10) - Number of tokens to process at a time
 */
router.post('/refresh-tokens', verifyCronSecret, async (req, res) => {
  const startTime = Date.now();

  try {
    const IntegrationToken = require('../models/master/IntegrationToken');
    const { bufferMinutes = 60, batchSize = 10 } = req.query;

    console.log(`🔄 Starting token refresh job (buffer: ${bufferMinutes}min, batch: ${batchSize})`);

    // Find tokens expiring soon
    const expiringTokens = await IntegrationToken.findExpiringTokens(parseInt(bufferMinutes));

    if (expiringTokens.length === 0) {
      return res.json({
        success: true,
        message: 'No tokens need refresh',
        stats: { total: 0, refreshed: 0, failed: 0 },
        duration: `${Date.now() - startTime}ms`
      });
    }

    console.log(`Found ${expiringTokens.length} tokens to refresh`);

    const stats = { total: expiringTokens.length, refreshed: 0, failed: 0, errors: [] };

    // Process tokens
    for (const tokenRecord of expiringTokens) {
      const { store_id, integration_type, config_key } = tokenRecord;

      try {
        // Get the appropriate service
        let service = null;
        if (integration_type === 'supabase-oauth' || integration_type === 'supabase') {
          service = require('../services/supabase-integration');
        } else if (integration_type === 'cloudflare') {
          service = require('../services/cloudflare-oauth-service');
        }

        if (!service) {
          console.warn(`No refresh service for ${integration_type}`);
          continue;
        }

        // Refresh the token
        const result = await service.refreshAccessToken(store_id);

        if (result.success) {
          const newExpiresAt = result.expires_at || new Date(Date.now() + (result.expires_in || 3600) * 1000);
          await IntegrationToken.recordRefreshSuccess(store_id, integration_type, newExpiresAt, config_key);
          stats.refreshed++;
          console.log(`✅ Refreshed ${integration_type} token for store ${store_id}`);
        } else {
          throw new Error(result.error || 'Refresh failed');
        }

      } catch (error) {
        stats.failed++;
        stats.errors.push({ store_id, integration_type, error: error.message });
        await IntegrationToken.recordRefreshFailure(store_id, integration_type, error.message, config_key);
        console.error(`❌ Failed to refresh ${integration_type} for store ${store_id}:`, error.message);

        // Check for revoked tokens
        if (error.message?.includes('invalid_grant') || error.message?.includes('revoked')) {
          await IntegrationToken.markAsRevoked(store_id, integration_type, config_key);
        }
      }
    }

    const duration = Date.now() - startTime;
    console.log(`🔄 Token refresh completed: ${stats.refreshed}/${stats.total} refreshed, ${stats.failed} failed (${duration}ms)`);

    res.json({
      success: true,
      message: `Refreshed ${stats.refreshed}/${stats.total} tokens`,
      stats,
      duration: `${duration}ms`
    });

  } catch (error) {
    console.error('❌ Token refresh job failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      duration: `${Date.now() - startTime}ms`
    });
  }
});

module.exports = router;
