/**
 * Check existing AI training data to see what would be skipped
 * Run: node scripts/check-ai-training-data.js
 */

require('dotenv').config();
const { masterDbClient } = require('../src/database/masterConnection');

async function checkExistingData() {
  if (!masterDbClient) {
    console.error('Master database client not initialized');
    console.error('Required: MASTER_SUPABASE_URL and MASTER_SUPABASE_SERVICE_KEY (or SUPABASE_SERVICE_ROLE_KEY)');
    process.exit(1);
  }

  try {
    console.log('Connected to master database via Supabase\n');

    // Check ai_training_candidates
    console.log('='.repeat(60));
    console.log('AI_TRAINING_CANDIDATES - Existing prompts');
    console.log('='.repeat(60));

    const { data: candidates, error: candError } = await masterDbClient
      .from('ai_training_candidates')
      .select('user_prompt, training_status, detected_entity, detected_operation')
      .order('created_at', { ascending: false });

    if (candError) {
      console.log('Table ai_training_candidates may not exist or is empty:', candError.message);
      console.log('All new training candidates will be INSERTED\n');
    } else {
      console.log(`Total records: ${(candidates || []).length}\n`);

      if (candidates && candidates.length > 0) {
        // Group by status
        const byStatus = {};
        candidates.forEach(c => {
          byStatus[c.training_status] = (byStatus[c.training_status] || 0) + 1;
        });
        console.log('By status:', byStatus);
        console.log('');

        // Show prompts that would be skipped (match new seed data)
        const newPrompts = [
          'delete all products',
          'remove all categories',
          'delete customer accounts',
          'clear all orders',
          'delete all coupons',
          'change store currency to EUR',
          'disable all payment methods',
          'show all products',
          'activate product SKU-123',
          'create a new category called Summer Sale',
          'add a new slot below the add to cart button',
          'add review section below add to cart',
          'move the product title below the price',
          'hide the breadcrumb on mobile',
          'what data do I need for AI shopping',
          'how do I add GTIN to products',
          'add product to category Electronics',
          'how do I increase conversions'
        ];

        const existingPrompts = candidates.map(c => c.user_prompt.toLowerCase().trim());
        const wouldSkip = newPrompts.filter(p =>
          existingPrompts.includes(p.toLowerCase().trim())
        );

        if (wouldSkip.length > 0) {
          console.log('WOULD BE SKIPPED (already exist):');
          wouldSkip.forEach(p => console.log('  - ' + p));
        } else {
          console.log('No conflicts found - all new prompts will be inserted');
        }

        console.log('\nExisting prompts (first 20):');
        candidates.slice(0, 20).forEach((c, i) => {
          console.log(`  ${i+1}. [${c.training_status}] ${c.user_prompt.substring(0, 50)}...`);
        });
      } else {
        console.log('No existing training candidates - all will be inserted');
      }
    }

    // Check ai_context_documents
    console.log('\n' + '='.repeat(60));
    console.log('AI_CONTEXT_DOCUMENTS - Existing documents');
    console.log('='.repeat(60));

    const { data: docs, error: docsError } = await masterDbClient
      .from('ai_context_documents')
      .select('type, title, category')
      .order('type', { ascending: true });

    if (docsError) {
      console.log('Table ai_context_documents may not exist:', docsError.message);
      console.log('All new context documents will be INSERTED\n');
    } else {
      console.log(`Total records: ${(docs || []).length}\n`);

      if (docs && docs.length > 0) {
        // Group by type
        const byType = {};
        docs.forEach(d => {
          if (!byType[d.type]) byType[d.type] = [];
          byType[d.type].push(d.title);
        });

        // Check which types would be DELETED and replaced
        const newTypes = [
          'confirmation_system',
          'slot_system',
          'ai_shopping_system',
          'product_category_system',
          'destructive_operations',
          'webshop_best_practices'
        ];

        console.log('Types that will be REPLACED (deleted then re-inserted):');
        newTypes.forEach(type => {
          if (byType[type]) {
            console.log(`  - ${type}: ${byType[type].length} docs will be replaced`);
          } else {
            console.log(`  - ${type}: (new type, will be added)`);
          }
        });

        console.log('\nExisting types (will NOT be affected):');
        Object.keys(byType).filter(t => !newTypes.includes(t)).forEach(type => {
          console.log(`  - ${type}: ${byType[type].length} docs`);
          byType[type].forEach(title => {
            console.log(`      • ${title.substring(0, 45)}`);
          });
        });
      } else {
        console.log('No existing context documents - all will be inserted');
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log(`
seed-ai-workspace-knowledge.sql:
  - Uses ON CONFLICT DO NOTHING
  - Will INSERT new prompts only if they don't exist
  - Existing prompts will be SKIPPED (not updated)

seed-ai-system-documentation.sql:
  - DELETES existing docs with matching types first
  - Then INSERTS fresh data
  - Types affected: confirmation_system, slot_system, ai_shopping_system,
    product_category_system, destructive_operations, webshop_best_practices
  - Other types will NOT be affected
    `);

  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkExistingData();
