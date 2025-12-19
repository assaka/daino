#!/usr/bin/env node

/**
 * Seed AI Context Data Only
 * For when tables already exist
 */

const { sequelize } = require('../src/database/connection');

async function seedAIContext() {
  try {
    console.log('🌱 Starting AI Context data seeding...');

    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connection verified');

    // Check if tables exist
    const tables = await sequelize.getQueryInterface().showAllTables();
    const aiTables = tables.filter(t => t.startsWith('ai_'));

    if (aiTables.length === 0) {
      console.log('❌ AI Context tables not found. Run migration first.');
      process.exit(1);
    }

    console.log(`✅ Found ${aiTables.length} AI Context tables`);

    // Clear existing data
    console.log('🧹 Clearing existing data...');
    await sequelize.query('DELETE FROM ai_context_usage');
    await sequelize.query('DELETE FROM ai_code_patterns');
    await sequelize.query('DELETE FROM ai_plugin_examples');
    await sequelize.query('DELETE FROM ai_context_documents');
    console.log('✅ Existing data cleared');

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

    // Count records
    const [docCount] = await sequelize.query('SELECT COUNT(*) as count FROM ai_context_documents');
    const [exampleCount] = await sequelize.query('SELECT COUNT(*) as count FROM ai_plugin_examples');
    const [patternCount] = await sequelize.query('SELECT COUNT(*) as count FROM ai_code_patterns');

    console.log(`\n📈 Data seeded:`);
    console.log(`   - ${docCount[0].count} context documents`);
    console.log(`   - ${exampleCount[0].count} plugin examples`);
    console.log(`   - ${patternCount[0].count} code patterns`);

    console.log('\n✨ AI Context System is ready!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  seedAIContext();
}

module.exports = seedAIContext;
