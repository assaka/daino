#!/usr/bin/env node
/**
 * Backfill Script - Generate embeddings for all existing AI context data
 *
 * Usage:
 *   node backend/src/scripts/backfill-embeddings.js
 *
 * Options:
 *   --documents   Only backfill ai_context_documents
 *   --examples    Only backfill ai_plugin_examples
 *   --entities    Only backfill ai_entity_definitions
 *   --training    Only backfill ai_training_candidates
 *   --markdown    Only vectorize markdown files
 *   --all         Backfill everything (default)
 *
 * Prerequisites:
 *   1. Run enable-pgvector-embeddings.sql in Supabase
 *   2. Run create-vector-search-functions.sql in Supabase
 *   3. Set OPENAI_API_KEY in environment
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');

// Check for required env vars
if (!process.env.OPENAI_API_KEY) {
  console.error('ERROR: OPENAI_API_KEY environment variable is required');
  process.exit(1);
}

const embeddingService = require('../services/embeddingService');
const documentChunker = require('../utils/documentChunker');
const { masterDbClient } = require('../database/masterConnection');

// Parse command line arguments
const args = process.argv.slice(2);
const runAll = args.length === 0 || args.includes('--all');
const runDocuments = runAll || args.includes('--documents');
const runExamples = runAll || args.includes('--examples');
const runEntities = runAll || args.includes('--entities');
const runTraining = runAll || args.includes('--training');
const runMarkdown = runAll || args.includes('--markdown');

// Stats tracking
const stats = {
  documents: { total: 0, success: 0, failed: 0 },
  examples: { total: 0, success: 0, failed: 0 },
  entities: { total: 0, success: 0, failed: 0 },
  training: { total: 0, success: 0, failed: 0 },
  markdown: { total: 0, success: 0, failed: 0 }
};

/**
 * Backfill ai_context_documents
 */
async function backfillDocuments() {
  console.log('\n=== Backfilling ai_context_documents ===');

  const { data: docs, error } = await masterDbClient
    .from('ai_context_documents')
    .select('id, title')
    .is('embedding', null)
    .eq('is_active', true);

  if (error) {
    console.error('Error fetching documents:', error);
    return;
  }

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

/**
 * Backfill ai_plugin_examples
 */
async function backfillExamples() {
  console.log('\n=== Backfilling ai_plugin_examples ===');

  const { data: examples, error } = await masterDbClient
    .from('ai_plugin_examples')
    .select('id, name')
    .is('embedding', null)
    .eq('is_active', true);

  if (error) {
    console.error('Error fetching examples:', error);
    return;
  }

  stats.examples.total = examples.length;
  console.log(`Found ${examples.length} examples to embed`);

  for (const example of examples) {
    try {
      await embeddingService.embedPluginExample(example.id);
      stats.examples.success++;
      console.log(`  [${stats.examples.success}/${examples.length}] Embedded: ${example.name}`);
    } catch (err) {
      stats.examples.failed++;
      console.error(`  FAILED: ${example.name} - ${err.message}`);
    }
  }
}

/**
 * Backfill ai_entity_definitions
 */
async function backfillEntities() {
  console.log('\n=== Backfilling ai_entity_definitions ===');

  const { data: entities, error } = await masterDbClient
    .from('ai_entity_definitions')
    .select('id, entity_name')
    .is('embedding', null)
    .eq('is_active', true);

  if (error) {
    console.error('Error fetching entities:', error);
    return;
  }

  stats.entities.total = entities.length;
  console.log(`Found ${entities.length} entities to embed`);

  for (const entity of entities) {
    try {
      await embeddingService.embedEntityDefinition(entity.id);
      stats.entities.success++;
      console.log(`  [${stats.entities.success}/${entities.length}] Embedded: ${entity.entity_name}`);
    } catch (err) {
      stats.entities.failed++;
      console.error(`  FAILED: ${entity.entity_name} - ${err.message}`);
    }
  }
}

/**
 * Backfill ai_training_candidates (approved/promoted only)
 */
async function backfillTrainingCandidates() {
  console.log('\n=== Backfilling ai_training_candidates ===');

  const { data: candidates, error } = await masterDbClient
    .from('ai_training_candidates')
    .select('id, user_prompt')
    .is('embedding', null)
    .in('training_status', ['approved', 'promoted']);

  if (error) {
    console.error('Error fetching candidates:', error);
    return;
  }

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

/**
 * Vectorize markdown documentation files
 */
async function vectorizeMarkdownFiles() {
  console.log('\n=== Vectorizing Markdown Files ===');

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
        // Check if this chunk already exists (by title)
        const chunkTitle = chunk.metadata.headers?.[0] || `${file.path} - Chunk ${chunk.metadata.chunkIndex}`;

        const { data: existing } = await masterDbClient
          .from('ai_context_documents')
          .select('id')
          .eq('title', chunkTitle)
          .eq('category', chunk.metadata.category)
          .single();

        if (existing) {
          // Update existing document
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
          // Insert new document with embedding
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
}

/**
 * Print final stats
 */
function printStats() {
  console.log('\n===========================================');
  console.log('           BACKFILL COMPLETE');
  console.log('===========================================\n');

  const table = [
    ['Table', 'Total', 'Success', 'Failed'],
    ['---', '---', '---', '---']
  ];

  if (runDocuments) {
    table.push(['ai_context_documents', stats.documents.total, stats.documents.success, stats.documents.failed]);
  }
  if (runExamples) {
    table.push(['ai_plugin_examples', stats.examples.total, stats.examples.success, stats.examples.failed]);
  }
  if (runEntities) {
    table.push(['ai_entity_definitions', stats.entities.total, stats.entities.success, stats.entities.failed]);
  }
  if (runTraining) {
    table.push(['ai_training_candidates', stats.training.total, stats.training.success, stats.training.failed]);
  }
  if (runMarkdown) {
    table.push(['Markdown chunks', stats.markdown.total, stats.markdown.success, stats.markdown.failed]);
  }

  // Print table
  for (const row of table) {
    console.log(`  ${row[0].padEnd(25)} ${String(row[1]).padEnd(8)} ${String(row[2]).padEnd(10)} ${row[3]}`);
  }

  const totalSuccess = stats.documents.success + stats.examples.success +
    stats.entities.success + stats.training.success + stats.markdown.success;
  const totalFailed = stats.documents.failed + stats.examples.failed +
    stats.entities.failed + stats.training.failed + stats.markdown.failed;

  console.log('\n  TOTAL: ' + totalSuccess + ' succeeded, ' + totalFailed + ' failed');

  if (totalFailed > 0) {
    console.log('\n  Some embeddings failed. You can re-run this script to retry.');
  }

  console.log('\n  Next steps:');
  console.log('  1. Run the IVFFlat index creation SQL (see enable-pgvector-embeddings.sql)');
  console.log('  2. Test vector search in your application');
}

/**
 * Main function
 */
async function main() {
  console.log('===========================================');
  console.log('     AI CONTEXT EMBEDDING BACKFILL');
  console.log('===========================================');
  console.log('\nModel: ' + (process.env.EMBEDDING_MODEL || 'text-embedding-3-small'));
  console.log('Dimensions: ' + (process.env.EMBEDDING_DIMENSIONS || '1536'));

  try {
    if (runDocuments) await backfillDocuments();
    if (runExamples) await backfillExamples();
    if (runEntities) await backfillEntities();
    if (runTraining) await backfillTrainingCandidates();
    if (runMarkdown) await vectorizeMarkdownFiles();

    printStats();
    process.exit(0);
  } catch (error) {
    console.error('\nFATAL ERROR:', error);
    process.exit(1);
  }
}

main();
