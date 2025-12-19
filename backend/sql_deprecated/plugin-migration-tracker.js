#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { sequelize } = require('../src/database/connection');

class PluginMigrationTracker {
  constructor() {
    this.migrationsDir = __dirname;
  }

  // Create plugin_migrations tracking table if it doesn't exist
  async ensurePluginMigrationsTable() {
    try {
      const createTableSQL = fs.readFileSync(
        path.join(this.migrationsDir, 'create-plugin-migrations-table.sql'),
        'utf8'
      );

      await sequelize.query(createTableSQL);
      console.log('✅ Plugin migrations tracking table ready');
    } catch (error) {
      console.error('❌ Failed to create plugin_migrations table:', error.message);
      throw error;
    }
  }

  // Calculate checksum for migration file
  calculateChecksum(content) {
    return crypto.createHash('md5').update(content).digest('hex');
  }

  // Parse migration file to extract up/down SQL
  parseMigrationFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');

    // Extract metadata from comments
    const pluginIdMatch = content.match(/Plugin:.*\(([a-f0-9-]+)\)/i);
    const versionMatch = content.match(/Version:\s*(\S+)/i);
    const descriptionMatch = content.match(/Description:\s*(.+)/i);
    const pluginNameMatch = content.match(/Plugin:\s*([^(]+)/i);

    // Split by DOWN Migration comment
    const parts = content.split(/--\s*DOWN Migration/i);
    const upSql = parts[0].replace(/^[\s\S]*?-- UP Migration\s*/i, '').trim();
    const downSql = parts[1] ? parts[1].replace(/^[\s\S]*?--\s*/gm, '').trim() : '';

    return {
      pluginId: pluginIdMatch ? pluginIdMatch[1] : null,
      pluginName: pluginNameMatch ? pluginNameMatch[1].trim() : 'Unknown',
      version: versionMatch ? versionMatch[1] : null,
      description: descriptionMatch ? descriptionMatch[1].trim() : '',
      upSql: upSql,
      downSql: downSql,
      checksum: this.calculateChecksum(content)
    };
  }

  // Check if migration has been executed
  async isMigrationExecuted(pluginId, version) {
    const result = await sequelize.query(`
      SELECT id, status FROM plugin_migrations
      WHERE plugin_id = $1 AND migration_version = $2
    `, {
      bind: [pluginId, version],
      type: sequelize.QueryTypes.SELECT
    });

    return result.length > 0 ? result[0] : null;
  }

  // Execute a plugin migration
  async executeMigration(filename, options = {}) {
    const { dryRun = false, force = false } = options;
    const startTime = Date.now();

    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔄 ${dryRun ? 'DRY RUN: ' : ''}Executing migration: ${filename}`);
    console.log(`${'='.repeat(60)}\n`);

    try {
      const filePath = path.join(this.migrationsDir, filename);
      const migration = this.parseMigrationFile(filePath);

      if (!migration.pluginId || !migration.version) {
        throw new Error('Migration file missing Plugin ID or Version in comments');
      }

      console.log(`📦 Plugin: ${migration.pluginName} (${migration.pluginId})`);
      console.log(`📅 Version: ${migration.version}`);
      console.log(`📝 Description: ${migration.description}`);

      // Check if already executed
      const existing = await this.isMigrationExecuted(migration.pluginId, migration.version);

      if (existing && existing.status === 'completed' && !force) {
        console.log(`⏭️  Migration already executed on ${existing.executed_at}`);
        return { success: true, skipped: true };
      }

      if (dryRun) {
        console.log('\n📋 UP SQL (would execute):');
        console.log('-'.repeat(60));
        console.log(migration.upSql);
        console.log('-'.repeat(60));
        console.log('\n✅ DRY RUN completed - no changes made');
        return { success: true, dryRun: true };
      }

      // Record migration as running
      let migrationId;
      if (existing) {
        migrationId = existing.id;
        await sequelize.query(`
          UPDATE plugin_migrations
          SET status = 'running', executed_at = NOW(), updated_at = NOW()
          WHERE id = $1
        `, { bind: [migrationId] });
      } else {
        const result = await sequelize.query(`
          INSERT INTO plugin_migrations (
            plugin_id, plugin_name, migration_name, migration_version,
            migration_description, status, executed_at, up_sql, down_sql, checksum
          ) VALUES ($1, $2, $3, $4, $5, 'running', NOW(), $6, $7, $8)
          RETURNING id
        `, {
          bind: [
            migration.pluginId,
            migration.pluginName,
            filename,
            migration.version,
            migration.description,
            migration.upSql,
            migration.downSql,
            migration.checksum
          ],
          type: sequelize.QueryTypes.INSERT
        });
        migrationId = result[0][0].id;
      }

      // Execute the migration SQL
      console.log('\n🚀 Executing migration SQL...');
      await sequelize.query(migration.upSql);

      const executionTime = Date.now() - startTime;

      // Record as completed
      await sequelize.query(`
        UPDATE plugin_migrations
        SET status = 'completed',
            completed_at = NOW(),
            execution_time_ms = $1,
            updated_at = NOW()
        WHERE id = $2
      `, { bind: [executionTime, migrationId] });

      console.log(`\n✅ Migration completed successfully in ${executionTime}ms`);
      console.log(`${'='.repeat(60)}\n`);

      return {
        success: true,
        executionTime,
        migrationId
      };

    } catch (error) {
      console.error(`\n❌ Migration failed: ${error.message}`);
      console.error(error.stack);
      console.log(`${'='.repeat(60)}\n`);

      // Record the failure
      try {
        await sequelize.query(`
          UPDATE plugin_migrations
          SET status = 'failed',
              error_message = $1,
              updated_at = NOW()
          WHERE plugin_id = $2 AND migration_version = $3
        `, {
          bind: [error.message, migration.pluginId, migration.version]
        });
      } catch (recordError) {
        console.error('Failed to record migration failure:', recordError.message);
      }

      return {
        success: false,
        error: error.message
      };
    }
  }

  // Rollback a plugin migration
  async rollbackMigration(pluginId, version) {
    console.log(`\n🔄 Rolling back migration: ${version} for plugin ${pluginId}`);

    try {
      // Get migration details
      const migrations = await sequelize.query(`
        SELECT id, migration_name, down_sql FROM plugin_migrations
        WHERE plugin_id = $1 AND migration_version = $2 AND status = 'completed'
      `, {
        bind: [pluginId, version],
        type: sequelize.QueryTypes.SELECT
      });

      if (migrations.length === 0) {
        console.log('⚠️  Migration not found or not completed');
        return { success: false, error: 'Migration not found or not completed' };
      }

      const migration = migrations[0];

      if (!migration.down_sql) {
        console.log('⚠️  No rollback SQL defined for this migration');
        return { success: false, error: 'No rollback SQL defined' };
      }

      // Execute rollback SQL
      console.log('🚀 Executing rollback SQL...');
      await sequelize.query(migration.down_sql);

      // Update status
      await sequelize.query(`
        UPDATE plugin_migrations
        SET status = 'rolled_back', rolled_back_at = NOW(), updated_at = NOW()
        WHERE id = $1
      `, { bind: [migration.id] });

      console.log('✅ Migration rolled back successfully\n');

      return { success: true };

    } catch (error) {
      console.error(`❌ Rollback failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  // List all plugin migrations
  async listMigrations(pluginId = null) {
    let query = 'SELECT * FROM plugin_migrations';
    let bind = [];

    if (pluginId) {
      query += ' WHERE plugin_id = $1';
      bind.push(pluginId);
    }

    query += ' ORDER BY executed_at DESC';

    const migrations = await sequelize.query(query, {
      bind,
      type: sequelize.QueryTypes.SELECT
    });

    console.log('\n📊 Plugin Migrations:');
    console.log('='.repeat(100));

    if (migrations.length === 0) {
      console.log('No migrations found');
    } else {
      migrations.forEach(m => {
        const status = m.status === 'completed' ? '✅' : m.status === 'failed' ? '❌' : '⏸️';
        console.log(`${status} ${m.migration_version.padEnd(25)} | ${m.plugin_name.padEnd(20)} | ${m.status.padEnd(12)} | ${m.executed_at || 'N/A'}`);
      });
    }

    console.log('='.repeat(100) + '\n');

    return migrations;
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  const tracker = new PluginMigrationTracker();

  try {
    // Always ensure table exists
    await tracker.ensurePluginMigrationsTable();

    switch (command) {
      case 'run':
        const filename = args[1];
        const force = args.includes('--force');
        const dryRun = args.includes('--dry-run');

        if (!filename) {
          console.error('❌ Usage: node plugin-migration-tracker.js run <filename> [--force] [--dry-run]');
          process.exit(1);
        }

        const result = await tracker.executeMigration(filename, { force, dryRun });
        process.exit(result.success ? 0 : 1);
        break;

      case 'rollback':
        const pluginId = args[1];
        const version = args[2];

        if (!pluginId || !version) {
          console.error('❌ Usage: node plugin-migration-tracker.js rollback <plugin-id> <version>');
          process.exit(1);
        }

        const rollbackResult = await tracker.rollbackMigration(pluginId, version);
        process.exit(rollbackResult.success ? 0 : 1);
        break;

      case 'list':
        const listPluginId = args[1] || null;
        await tracker.listMigrations(listPluginId);
        process.exit(0);
        break;

      default:
        console.log('Plugin Migration Tracker');
        console.log('========================\n');
        console.log('Usage:');
        console.log('  node plugin-migration-tracker.js run <filename> [--force] [--dry-run]');
        console.log('  node plugin-migration-tracker.js rollback <plugin-id> <version>');
        console.log('  node plugin-migration-tracker.js list [plugin-id]');
        console.log('\nExamples:');
        console.log('  node plugin-migration-tracker.js run 20250129_143000_create_hamid_cart_table.sql');
        console.log('  node plugin-migration-tracker.js run 20250129_143000_create_hamid_cart_table.sql --dry-run');
        console.log('  node plugin-migration-tracker.js rollback 109c940f-5d33-472c-b7df-c48e68c35696 20250129_143000');
        console.log('  node plugin-migration-tracker.js list');
        console.log('  node plugin-migration-tracker.js list 109c940f-5d33-472c-b7df-c48e68c35696');
        process.exit(0);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { PluginMigrationTracker };
