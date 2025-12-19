const { sequelize } = require('../src/database/connection');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  try {
    console.log('Starting social media settings consolidation migration...');

    const sqlPath = path.join(__dirname, 'consolidate-social-media-settings.sql');
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
    console.log('\n📋 Next steps:');
    console.log('1. Verify data migration with: SELECT social_media_settings FROM seo_settings LIMIT 5;');
    console.log('2. Test the application thoroughly');
    console.log('3. If everything works, uncomment and run the DROP COLUMN statements in consolidate-social-media-settings.sql');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
