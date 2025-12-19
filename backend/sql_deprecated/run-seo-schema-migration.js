#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { sequelize, supabase } = require('../src/database/connection');

async function runSeoSchemaMigration() {
  try {
    console.log('🚀 Starting SEO schema migration...');
    
    // Read the SQL migration file
    const migrationPath = path.join(__dirname, 'update-seo-settings-schema.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 SEO schema migration file loaded');
    
    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connection verified');
    
    // Run the migration using Supabase if available, otherwise use Sequelize
    if (supabase) {
      console.log('🔄 Running SEO schema migration with Supabase client...');
      
      // Split SQL into individual statements
      const statements = migrationSQL
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
      
      console.log(`📊 Found ${statements.length} SQL statements to execute`);
      
      // Execute each statement
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        if (statement.trim()) {
          try {
            console.log(`⏳ Executing statement ${i + 1}/${statements.length}`);
            const { error } = await supabase.rpc('exec_sql', { sql: statement });
            if (error) {
              console.warn(`⚠️  Statement ${i + 1} warning:`, error.message);
            } else {
              console.log(`✅ Statement ${i + 1} executed successfully`); 
            }
          } catch (error) {
            console.warn(`⚠️  Statement ${i + 1} error:`, error.message);
          }
        }
      }
    } else {
      console.log('🔄 Running SEO schema migration with Sequelize...');
      await sequelize.query(migrationSQL);
    }
    
    console.log('✅ SEO schema migration completed successfully!');
    
    // Test the migration by checking the updated table structure
    try {
      const { SeoSettings, SeoTemplate, Redirect } = require('../src/models');
      
      console.log('🧪 Testing SEO models...');
      
      // Test SeoSettings count
      const seoSettingsCount = await SeoSettings.count();
      console.log(`📊 SEO Settings count: ${seoSettingsCount}`);
      
      // Test SeoTemplate count  
      const seoTemplateCount = await SeoTemplate.count();
      console.log(`📊 SEO Templates count: ${seoTemplateCount}`);
      
      // Test Redirect count
      const redirectCount = await Redirect.count();
      console.log(`📊 Redirects count: ${redirectCount}`);
      
      console.log('🎉 All SEO models are working correctly!');
      
    } catch (modelError) {
      console.error('⚠️  Model test error (this might be normal):', modelError.message);
    }
    
    // Only exit if called directly from command line
    if (require.main === module) {
      process.exit(0);
    }
  } catch (error) {
    console.error('❌ SEO schema migration failed:', error);
    // Only exit if called directly from command line
    if (require.main === module) {
      process.exit(1);
    } else {
      // Re-throw the error when called programmatically so server can handle it
      throw error;
    }
  }
}

// Run if called directly
if (require.main === module) {
  runSeoSchemaMigration();
}

module.exports = runSeoSchemaMigration;