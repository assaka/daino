// backend/src/database/migrations/20250127-create-ai-tracking-tables.js
const { sequelize } = require('../connection');

/**
 * Migration: Create AI tracking tables
 * - ai_usage_logs: Track all AI API calls
 * - Updates credit_usage table constraint (already exists)
 */

async function up() {
  console.log('Creating AI tracking tables...');

  // Create ai_usage_logs table
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS ai_usage_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      operation_type VARCHAR(50) NOT NULL,
      model_used VARCHAR(100),
      tokens_input INTEGER DEFAULT 0,
      tokens_output INTEGER DEFAULT 0,
      metadata JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);

  // Create indexes for faster queries
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user_id
    ON ai_usage_logs(user_id);
  `);

  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created_at
    ON ai_usage_logs(created_at DESC);
  `);

  // Update existing credit_usage table constraint to include AI usage types
  try {
    await sequelize.query(`
      ALTER TABLE credit_usage DROP CONSTRAINT IF EXISTS credit_usage_usage_type_check;
    `);

    await sequelize.query(`
      ALTER TABLE credit_usage ADD CONSTRAINT credit_usage_usage_type_check CHECK (
        usage_type IN (
          'akeneo_schedule',
          'akeneo_manual',
          'marketplace_export',
          'shopify_sync',
          'ai_description',
          'ai_plugin_generation',
          'ai_plugin_modification',
          'ai_translation',
          'ai_layout',
          'ai_code_patch',
          'ai_chat',
          'other'
        )
      );
    `);
    console.log('✅ Updated credit_usage table constraint for AI usage types');
  } catch (error) {
    console.log('⚠️ Could not update credit_usage constraint (table may not exist yet):', error.message);
  }

  console.log('✅ AI tracking tables created successfully');
}

async function down() {
  console.log('Dropping AI tracking tables...');

  await sequelize.query('DROP TABLE IF EXISTS ai_usage_logs CASCADE;');

  console.log('✅ AI tracking tables dropped');
}

module.exports = { up, down };
