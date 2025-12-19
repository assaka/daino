const { sequelize } = require('../src/database/connection');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  try {
    console.log('Starting default meta settings consolidation migration...');

    const sqlPath = path.join(__dirname, 'consolidate-default-meta-settings.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Split by statements and execute
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      if (statement.trim()) {
        console.log('Executing:', statement.substring(0, 100) + '...');
        await sequelize.query(statement);
      }
    }

    console.log('✅ Migration completed successfully!');
    console.log('\n📋 Consolidated into default_meta_settings JSON:');
    console.log('  - default_meta_title → meta_title');
    console.log('  - default_meta_description → meta_description');
    console.log('  - default_meta_keywords → meta_keywords');
    console.log('  - default_meta_robots → meta_robots');
    console.log('\n✅ Old columns removed successfully!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
