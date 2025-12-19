const { sequelize } = require('../src/database/connection');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  try {
    console.log('Starting canonical settings consolidation migration...');

    const sqlPath = path.join(__dirname, 'consolidate-canonical-settings.sql');
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
    console.log('\n📋 Consolidated into canonical_settings JSON:');
    console.log('  - canonical_base_url → base_url');
    console.log('  - auto_canonical_filtered_pages → auto_canonical_filtered_pages');
    console.log('\n✅ Old columns removed successfully!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
