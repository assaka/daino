#!/usr/bin/env node

/**
 * Run AI Context Migration on Supabase PostgreSQL
 */

// Load environment variables
require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });

const { Sequelize } = require('sequelize');
const fs = require('fs');
const path = require('path');

async function runSupabaseMigration() {
  try {
    const databaseUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

    if (!databaseUrl) {
      console.error('❌ No DATABASE_URL or SUPABASE_DB_URL found in environment');
      console.log('Please set one of these variables in backend/.env');
      process.exit(1);
    }

    console.log('🚀 Connecting to Supabase PostgreSQL...');

    // Create Sequelize instance for PostgreSQL
    const sequelize = new Sequelize(databaseUrl, {
      dialect: 'postgres',
      logging: false,
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      }
    });

    // Test connection
    await sequelize.authenticate();
    console.log('✅ Connected to database\n');

    // Read and execute SQL file
    console.log('📄 Reading migration SQL...');
    const sqlPath = path.join(__dirname, '../../migrations/create-ai-context-tables.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('🔄 Creating AI Context tables...');
    await sequelize.query(sql);
    console.log('✅ Tables created successfully!\n');

    // Verify tables exist
    const [tables] = await sequelize.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name LIKE 'ai_%'
      ORDER BY table_name
    `);

    console.log('📋 AI Context Tables:');
    tables.forEach(t => console.log(`  ✓ ${t.table_name}`));

    // Now run the seeds
    console.log('\n🌱 Seeding initial data...');

    const seed1 = require('../src/database/seeds/20250120_seed_ai_context');
    await seed1.up(sequelize.getQueryInterface(), Sequelize);
    console.log('✅ Core context seeded');

    const seed2 = require('../src/database/seeds/20250120_seed_ai_context_all_features');
    await seed2.up(sequelize.getQueryInterface(), Sequelize);
    console.log('✅ Features context seeded');

    // Count records
    const [counts] = await sequelize.query(`
      SELECT
        (SELECT COUNT(*) FROM ai_context_documents) as documents,
        (SELECT COUNT(*) FROM ai_plugin_examples) as examples,
        (SELECT COUNT(*) FROM ai_code_patterns) as patterns
    `);

    console.log('\n📊 Data Summary:');
    console.log(`  Documents: ${counts[0].documents}`);
    console.log(`  Examples: ${counts[0].examples}`);
    console.log(`  Patterns: ${counts[0].patterns}`);

    console.log('\n✨ AI Context System ready on Supabase!');

    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

runSupabaseMigration();
