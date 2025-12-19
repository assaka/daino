#!/usr/bin/env node

/**
 * Run AI Context System Migration
 * Creates tables for database-backed AI context and RAG support
 */

const path = require('path');
const { sequelize } = require('../src/database/connection');

async function runAIContextMigration() {
  try {
    console.log('🚀 Starting AI Context System migration...');

    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connection verified');

    // Load and run migration
    const migration = require('./20250120_create_ai_context_system');
    await migration.up(sequelize.getQueryInterface(), require('sequelize'));

    console.log('✅ Migration completed successfully!');

    // Load and run initial seed
    console.log('🌱 Seeding initial AI context data...');
    const seed = require('../src/database/seeds/20250120_seed_ai_context');
    await seed.up(sequelize.getQueryInterface(), require('sequelize'));
    console.log('✅ Initial seed completed!');

    // Load and run all features seed
    console.log('🌱 Seeding all AI features context...');
    const allFeaturesSeed = require('../src/database/seeds/20250120_seed_ai_context_all_features');
    await allFeaturesSeed.up(sequelize.getQueryInterface(), require('sequelize'));
    console.log('✅ All features seed completed!');

    // Verify tables
    const tables = await sequelize.getQueryInterface().showAllTables();
    const aiTables = tables.filter(t => t.startsWith('ai_'));
    console.log(`📊 AI Context tables created: ${aiTables.length}`);
    console.log('📋 Tables:', aiTables.join(', '));

    // Count records
    const [docCount] = await sequelize.query('SELECT COUNT(*) as count FROM ai_context_documents');
    const [exampleCount] = await sequelize.query('SELECT COUNT(*) as count FROM ai_plugin_examples');
    const [patternCount] = await sequelize.query('SELECT COUNT(*) as count FROM ai_code_patterns');

    console.log(`\n📈 Data seeded:`);
    console.log(`   - ${docCount[0].count} context documents`);
    console.log(`   - ${exampleCount[0].count} plugin examples`);
    console.log(`   - ${patternCount[0].count} code patterns`);

    console.log('\n✨ AI Context System is ready for RAG!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runAIContextMigration();
}

module.exports = runAIContextMigration;
