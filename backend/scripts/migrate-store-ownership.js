/**
 * Script to run the store ownership migration
 * This adds user_id column to stores and migrates existing data
 */

const { sequelize } = require('../src/database/connection');
const { QueryInterface } = require('sequelize');

async function runMigration() {
  console.log('🚀 Starting store ownership migration...');
  
  try {
    // Get the query interface
    const queryInterface = sequelize.getQueryInterface();
    
    // Check if user_id column already exists
    const tableDescription = await queryInterface.describeTable('stores');
    
    if (tableDescription.user_id) {
      console.log('✅ user_id column already exists in stores table');
      
      // Check if we need to migrate data
      const [results] = await sequelize.query(`
        SELECT COUNT(*) as count 
        FROM stores 
        WHERE user_id IS NULL AND owner_email IS NOT NULL
      `);
      
      const unmigrated = results[0].count;
      
      if (unmigrated > 0) {
        console.log(`📊 Found ${unmigrated} stores without user_id, migrating...`);
        
        // Migrate the data
        await sequelize.query(`
          UPDATE stores 
          SET user_id = users.id 
          FROM users 
          WHERE stores.owner_email = users.email 
          AND stores.user_id IS NULL
        `);
        
        console.log('✅ Data migration completed');
      } else {
        console.log('✅ All stores already have user_id');
      }
    } else {
      console.log('🔧 Adding user_id column to stores table...');
      
      // Run the migration
      const migration = require('../sql_deprecated/add-user-id-to-stores');
      await migration.up(queryInterface, sequelize.Sequelize);
      
      console.log('✅ Migration completed successfully');
    }
    
    // Show the results
    const [storeStats] = await sequelize.query(`
      SELECT 
        COUNT(*) as total_stores,
        COUNT(user_id) as stores_with_user_id,
        COUNT(DISTINCT owner_email) as unique_owner_emails
      FROM stores
    `);
    
    console.log('\n📊 Store ownership stats:');
    console.log(`   Total stores: ${storeStats[0].total_stores}`);
    console.log(`   Stores with user_id: ${storeStats[0].stores_with_user_id}`);
    console.log(`   Unique owner emails: ${storeStats[0].unique_owner_emails}`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Run the migration
runMigration();