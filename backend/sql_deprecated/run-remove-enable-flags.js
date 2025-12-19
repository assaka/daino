const { sequelize } = require('../src/database/connection');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  try {
    console.log('Starting remove redundant enable flags migration...');

    const sqlPath = path.join(__dirname, 'remove-redundant-enable-flags.sql');
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
    console.log('\n📋 Removed columns:');
    console.log('  - enable_rich_snippets');
    console.log('  - enable_open_graph');
    console.log('  - enable_twitter_cards');
    console.log('  - enable_sitemap');
    console.log('\nThese features are now controlled via JSON settings.');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
