#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { sequelize, supabase } = require('../src/database/connection');

class MigrationTracker {
  constructor() {
    this.migrationsDir = __dirname;
  }

  // Create migrations tracking table if it doesn't exist
  async ensureMigrationsTable() {
    try {
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS _migrations (
          id SERIAL PRIMARY KEY,
          filename VARCHAR(255) NOT NULL UNIQUE,
          executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          checksum VARCHAR(64),
          execution_time_ms INTEGER
        );
        
        CREATE INDEX IF NOT EXISTS idx_migrations_filename ON _migrations(filename);
        CREATE INDEX IF NOT EXISTS idx_migrations_executed_at ON _migrations(executed_at);
      `;

      if (supabase) {
        const { error } = await supabase.rpc('exec_sql', { sql: createTableSQL });
        if (error) {
          console.warn('⚠️ Warning creating migrations table:', error.message);
        }
      } else {
        await sequelize.query(createTableSQL);
      }
      
      console.log('✅ Migrations tracking table ready');
    } catch (error) {
      console.error('❌ Failed to create migrations table:', error.message);
      throw error;
    }
  }

  // Get list of executed migrations from database
  async getExecutedMigrations() {
    try {
      let result;
      if (supabase) {
        const { data, error } = await supabase
          .from('_migrations')
          .select('filename, executed_at')
          .order('executed_at');
        
        if (error) throw error;
        result = data || [];
      } else {
        const [rows] = await sequelize.query(
          'SELECT filename, executed_at FROM _migrations ORDER BY executed_at',
          { type: sequelize.QueryTypes.SELECT }
        );
        result = rows || [];
      }
      
      return result.map(row => row.filename);
    } catch (error) {
      console.warn('⚠️ Failed to get executed migrations (table might not exist yet):', error.message);
      return [];
    }
  }

  // Get list of available migration files
  getAvailableMigrations() {
    try {
      const files = fs.readdirSync(this.migrationsDir)
        .filter(file => file.endsWith('.sql'))
        .filter(file => !file.includes('drop-all-tables')) // Skip dangerous migrations
        .sort(); // Ensure consistent order
      
      console.log(`📊 Found ${files.length} migration files:`, files);
      return files;
    } catch (error) {
      console.error('❌ Failed to read migrations directory:', error.message);
      return [];
    }
  }

  // Calculate simple checksum for migration file
  calculateChecksum(content) {
    const crypto = require('crypto');
    return crypto.createHash('md5').update(content).digest('hex');
  }

  // Execute a single migration file
  async executeMigration(filename) {
    const startTime = Date.now();
    console.log(`🔄 Executing migration: ${filename}`);
    
    try {
      const filePath = path.join(this.migrationsDir, filename);
      const migrationSQL = fs.readFileSync(filePath, 'utf8');
      const checksum = this.calculateChecksum(migrationSQL);
      
      // Execute the migration
      if (supabase) {
        // Split SQL into individual statements for Supabase
        const statements = migrationSQL
          .split(';')
          .map(stmt => stmt.trim())
          .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
        
        console.log(`📊 Executing ${statements.length} SQL statements from ${filename}`);
        
        for (let i = 0; i < statements.length; i++) {
          const statement = statements[i];
          if (statement.trim()) {
            try {
              const { error } = await supabase.rpc('exec_sql', { sql: statement });
              if (error) {
                console.warn(`⚠️ Statement ${i + 1} warning:`, error.message);
              }
            } catch (stmtError) {
              console.warn(`⚠️ Statement ${i + 1} error:`, stmtError.message);
            }
          }
        }
      } else {
        await sequelize.query(migrationSQL);
      }
      
      const executionTime = Date.now() - startTime;
      
      // Record the migration as executed
      await this.recordMigration(filename, checksum, executionTime);
      
      console.log(`✅ Migration ${filename} completed in ${executionTime}ms`);
      return true;
    } catch (error) {
      console.error(`❌ Migration ${filename} failed:`, error.message);
      return false;
    }
  }

  // Record a migration as executed
  async recordMigration(filename, checksum, executionTimeMs) {
    try {
      if (supabase) {
        const { error } = await supabase
          .from('_migrations')
          .insert({
            filename,
            checksum,
            execution_time_ms: executionTimeMs
          });
        
        if (error) {
          console.warn('⚠️ Warning recording migration:', error.message);
        }
      } else {
        await sequelize.query(
          'INSERT INTO _migrations (filename, checksum, execution_time_ms) VALUES (?, ?, ?)',
          {
            replacements: [filename, checksum, executionTimeMs],
            type: sequelize.QueryTypes.INSERT
          }
        );
      }
    } catch (error) {
      console.warn('⚠️ Failed to record migration:', error.message);
    }
  }

  // Run all pending migrations
  async runPendingMigrations() {
    try {
      console.log('🚀 Starting migration check...');
      
      // Ensure migrations table exists
      await this.ensureMigrationsTable();
      
      // Get executed and available migrations
      const executedMigrations = await this.getExecutedMigrations();
      const availableMigrations = this.getAvailableMigrations();
      
      // Find pending migrations
      const pendingMigrations = availableMigrations.filter(
        migration => !executedMigrations.includes(migration)
      );
      
      console.log(`📊 Migration status:`);
      console.log(`   - Available migrations: ${availableMigrations.length}`);
      console.log(`   - Executed migrations: ${executedMigrations.length}`);
      console.log(`   - Pending migrations: ${pendingMigrations.length}`);
      
      if (pendingMigrations.length === 0) {
        console.log('✅ All migrations are up to date!');
        return { success: true, migrationsRun: 0 };
      }
      
      console.log(`🔄 Running ${pendingMigrations.length} pending migrations:`);
      pendingMigrations.forEach(migration => console.log(`   - ${migration}`));
      
      // Execute pending migrations
      let successCount = 0;
      for (const migration of pendingMigrations) {
        const success = await this.executeMigration(migration);
        if (success) {
          successCount++;
        }
      }
      
      console.log(`✅ Migration check completed: ${successCount}/${pendingMigrations.length} migrations successful`);
      
      return {
        success: successCount === pendingMigrations.length,
        migrationsRun: successCount,
        totalPending: pendingMigrations.length
      };
      
    } catch (error) {
      console.error('❌ Migration check failed:', error.message);
      return { success: false, error: error.message };
    }
  }
}

// Function to run migrations (for use in server startup)
async function runPendingMigrations() {
  const tracker = new MigrationTracker();
  return await tracker.runPendingMigrations();
}

// Run if called directly
if (require.main === module) {
  runPendingMigrations()
    .then(result => {
      console.log('Migration result:', result);
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { MigrationTracker, runPendingMigrations };