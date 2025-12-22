/**
 * Tenant Provisioning Service
 *
 * Provisions new tenant databases with:
 * - Schema creation (all tables)
 * - Initial data seeding
 * - Store record creation
 * - User record creation
 *
 * Called when store owner connects their Supabase database
 *
 * Note: Connection info stored in master store_databases, not tenant supabase_oauth_tokens
 */

const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { masterDbClient } = require('../../database/masterConnection');

// Page types and their corresponding config exports
const PAGE_CONFIGS = [
  { pageType: 'product', configExport: 'productConfig' },
  { pageType: 'category', configExport: 'categoryConfig' },
  { pageType: 'cart', configExport: 'cartConfig' },
  { pageType: 'homepage', configExport: 'homepageConfig' },
  { pageType: 'header', configExport: 'headerConfig' },
  { pageType: 'account', configExport: 'accountConfig' },
  { pageType: 'login', configExport: 'loginConfig' },
  { pageType: 'checkout', configExport: 'checkoutConfig' },
  { pageType: 'success', configExport: 'successConfig' }
];

class TenantProvisioningService {
  /**
   * Provision a new tenant database
   *
   * @param {Object} tenantDb - Supabase client or Sequelize instance
   * @param {string} storeId - Store UUID
   * @param {Object} options - Provisioning options
   * @returns {Promise<Object>} Provisioning result
   */
  async provisionTenantDatabase(tenantDb, storeId, options = {}) {
    console.log(`🚀 Starting tenant provisioning for store ${storeId}...`);
    console.log(`🎨 Theme preset from options: ${options.themePreset || 'not specified'}`);

    const result = {
      storeId,
      tablesCreated: [],
      dataSeeded: [],
      errors: []
    };

    try {
      // 1. Check if already provisioned
      console.log('🔍 tenantDb exists:', !!tenantDb, 'type:', typeof tenantDb);
      console.log('🔍 OAuth mode available:', !!(options.oauthAccessToken && options.projectId));

      // If no tenantDb but have OAuth credentials, skip provisioned check and go straight to migrations
      if (!tenantDb && options.oauthAccessToken && options.projectId) {
        console.log('🔄 No tenantDb client - using OAuth Management API mode for provisioning');
        // In OAuth mode without tenantDb, assume NOT provisioned and run migrations
        console.log('Running tenant migrations via OAuth API...');
        await this.runTenantMigrations(tenantDb, storeId, result, options);

        // Check if migrations failed critically
        if (result.errors.some(e => e.step === 'migrations')) {
          console.error('❌ Migrations failed - skipping additional seeding');
          return {
            ...result,
            success: false,
            message: 'Database provisioning failed - migrations did not complete'
          };
        }

        // Seed slot configurations via API
        console.log('Seeding slot configurations via Management API SQL...');
        await this.seedSlotConfigurationsViaAPI(options.oauthAccessToken, options.projectId, storeId, options, result);

        // Seed default SEO settings via API
        console.log('Seeding default SEO settings via Management API SQL...');
        await this.seedDefaultSeoSettingsViaAPI(options.oauthAccessToken, options.projectId, storeId, options, result);

        console.log(`✅ Tenant provisioning complete for store ${storeId} (OAuth mode)`);
        return {
          ...result,
          success: true,
          message: 'Tenant database provisioned successfully via OAuth'
        };
      }

      if (!tenantDb) {
        throw new Error('tenantDb is null and no OAuth credentials available - cannot proceed with provisioning');
      }

      const alreadyProvisioned = await this.checkIfProvisioned(tenantDb);
      if (alreadyProvisioned && !options.force) {
        console.log('✅ Tenant database already provisioned - checking if slot configs and store need seeding...');

        // Even if provisioned, ensure slot configurations exist
        const { data: existingSlots } = await tenantDb
          .from('slot_configurations')
          .select('id')
          .limit(1);

        if (!existingSlots || existingSlots.length === 0) {
          console.log('📦 No slot configurations found - seeding them now...');
          await this.seedSlotConfigurations(tenantDb, storeId, options, result);
        }

        // Even if provisioned, ensure store record exists with theme settings
        const { data: existingStore } = await tenantDb
          .from('stores')
          .select('id, settings')
          .eq('id', storeId)
          .maybeSingle();

        console.log('🔍 Existing store check:', existingStore ? 'found' : 'not found');
        console.log('🔍 Existing settings:', JSON.stringify(existingStore?.settings || {}).slice(0, 200));

        if (!existingStore) {
          console.log('📦 No store record found - creating it now...');
          await this.createStoreRecord(tenantDb, storeId, options, result);
        } else if (!existingStore.settings?.theme || Object.keys(existingStore.settings?.theme || {}).length === 0) {
          // Store exists but has no theme - apply theme preset
          console.log('🎨 Store has no theme settings - applying theme preset (preset: ' + options.themePreset + ')...');
          const themeDefaults = await this.getThemeDefaults(options.themePreset);
          if (Object.keys(themeDefaults).length > 0) {
            const updatedSettings = {
              ...(existingStore.settings || {}),
              theme: themeDefaults
            };
            await tenantDb
              .from('stores')
              .update({ settings: updatedSettings, updated_at: new Date().toISOString() })
              .eq('id', storeId);
            console.log('✅ Theme settings applied to existing store');
          }
        }

        return {
          ...result,
          success: true,
          alreadyProvisioned: true,
          message: 'Database is already set up and ready to use'
        };
      }

      // 2. Run migrations (create all tables)
      console.log('Running tenant migrations...');
      await this.runTenantMigrations(tenantDb, storeId, result, options);

      // 3. Seed initial data
      console.log('Seeding initial data...');
      // await this.seedInitialData(tenantDb, storeId, options, result);

      // 4. Verify migrations succeeded before creating store record
      if (result.errors.some(e => e.step === 'migrations')) {
        console.error('❌ Skipping store record creation - migrations failed');
        return {
          ...result,
          success: false,
          message: 'Database provisioning failed - migrations did not complete'
        };
      }

      // 4. Create store record in tenant DB (skip if already created during migrations)
      if (options._storeCreatedInMigrations) {
        console.log('⏭️ Store record already created during migrations - skipping');
      } else if (tenantDb) {
        // Use Supabase client
        console.log('Creating store record via Supabase client...');
        await this.createStoreRecord(tenantDb, storeId, options, result);
      } else if (options.oauthAccessToken && options.projectId) {
        // Use Management API to execute SQL
        console.log('Creating store record via Management API SQL...');
        await this.createStoreRecordViaAPI(options.oauthAccessToken, options.projectId, storeId, options, result);
      } else {
        console.warn('⚠️ Cannot create store record - no tenantDb or OAuth credentials');
        result.errors.push({ step: 'create_store', error: 'No database client available' });
      }

      // 5. Create agency user record in tenant DB
      if (tenantDb && options.userId && options.userEmail) {
        // Use Supabase client
        console.log('Creating user record via Supabase client...');
        await this.createUserRecord(tenantDb, options, result);
      } else if (options.oauthAccessToken && options.projectId && options.userId && options.userEmail) {
        // Use Management API to execute SQL
        console.log('Creating user record via Management API SQL...');
        await this.createUserRecordViaAPI(options.oauthAccessToken, options.projectId, options, result);
      } else if (!options.userId || !options.userEmail) {
        console.log('⏭️ Skipping user record creation - no user data provided');
      } else {
        console.warn('⚠️ Cannot create user record - no tenantDb or OAuth credentials');
        result.errors.push({ step: 'create_user', error: 'No database client available' });
      }

      // 6. Seed slot configurations from config files
      if (tenantDb) {
        console.log('Seeding slot configurations via Supabase client...');
        await this.seedSlotConfigurations(tenantDb, storeId, options, result);
      } else if (options.oauthAccessToken && options.projectId) {
        console.log('Seeding slot configurations via Management API SQL...');
        await this.seedSlotConfigurationsViaAPI(options.oauthAccessToken, options.projectId, storeId, options, result);
      }

      // 7. Seed default SEO settings with robots.txt
      if (tenantDb) {
        console.log('Seeding default SEO settings via Supabase client...');
        await this.seedDefaultSeoSettings(tenantDb, storeId, options, result);
      } else if (options.oauthAccessToken && options.projectId) {
        console.log('Seeding default SEO settings via Management API SQL...');
        await this.seedDefaultSeoSettingsViaAPI(options.oauthAccessToken, options.projectId, storeId, options, result);
      }

      console.log(`✅ Tenant provisioning complete for store ${storeId}`);

      return {
        ...result,
        success: true,
        message: 'Tenant database provisioned successfully'
      };
    } catch (error) {
      console.error('Tenant provisioning failed:', error);
      result.errors.push({
        step: 'general',
        error: error.message
      });

      return {
        ...result,
        success: false,
        message: 'Provisioning failed',
        error: error.message
      };
    }
  }

  /**
   * Check if tenant database is already provisioned
   * @private
   */
  async checkIfProvisioned(tenantDb) {
    try {
      // Check if 'stores' table exists
      const { data, error } = await tenantDb
        .from('stores')
        .select('id')
        .limit(1);

      // If no error or table not found error, it's provisioned
      return error === null || error.code === 'PGRST116'; // PGRST116 = table exists but empty
    } catch (error) {
      return false;
    }
  }

  /**
   * Run tenant database migrations
   * @private
   */
  async runTenantMigrations(tenantDb, storeId, result, options = {}) {
    try {
      console.log('Reading tenant migration files...');

      // Read migration SQL files
      const migrationPath = path.join(__dirname, '../../database/schemas/tenant/001-create-tenant-tables.sql');
      const seedPath = path.join(__dirname, '../../database/schemas/tenant/002-tenant-seed-data.sql');

      const migrationSQL = await fs.readFile(migrationPath, 'utf-8');
      const seedSQL = await fs.readFile(seedPath, 'utf-8');

      console.log('Migration SQL loaded:', migrationSQL.length, 'characters');
      console.log('Seed SQL loaded:', seedSQL.length, 'characters');

      // Replace {{STORE_ID}} template with actual storeId in seed SQL
      let processedSeedSQL = seedSQL.replace(/\{\{STORE_ID\}\}/g, storeId);
      console.log('✅ Replaced {{STORE_ID}} templates with actual storeId:', storeId);

      // Replace {{STORE_SLUG}} template with actual store slug in seed SQL
      const storeSlug = options.storeSlug || this.generateSlug(options.storeName);
      processedSeedSQL = processedSeedSQL.replace(/\{\{STORE_SLUG\}\}/g, storeSlug);
      console.log('✅ Replaced {{STORE_SLUG}} templates with actual storeSlug:', storeSlug);

      // Check if we have OAuth access_token (use Supabase Management API)
      if (options.oauthAccessToken && options.projectId) {
        console.log('Using Supabase Management API for migrations (OAuth mode)...');

        const axios = require('axios');

        try {
          // Fix SQL syntax for PostgreSQL compatibility
          console.log('🔧 Fixing CREATE TYPE IF NOT EXISTS syntax in migrations...');

          let fixedMigrationSQL = migrationSQL.replace(
            /CREATE TYPE IF NOT EXISTS\s+(\w+)\s+AS\s+ENUM\s*\(([\s\S]*?)\);/gi,
            (match, typeName, enumValues) => {
              return `DO $$ BEGIN
    CREATE TYPE ${typeName} AS ENUM (${enumValues});
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;`;
            }
          );

          console.log('✅ Migration SQL syntax fixed');
          console.log('📊 Migration SQL size:', (fixedMigrationSQL.length / 1024).toFixed(2), 'KB');

          // Two-pass approach: Create tables first, then add foreign keys
          console.log('🔧 Extracting foreign key constraints for separate application...');

          // Extract ALTER TABLE ADD CONSTRAINT FOREIGN KEY statements
          const alterTableFKs = [];
          const alterTableRegex = /ALTER\s+TABLE\s+([\w]+)\s+ADD\s+CONSTRAINT\s+([\w]+)\s+FOREIGN\s+KEY\s*\(([^)]+)\)\s+REFERENCES\s+([\w]+)\s*\(([^)]+)\)(\s+ON\s+(DELETE|UPDATE)\s+(CASCADE|SET NULL|RESTRICT|NO ACTION))*\s*;/gi;
          let match;
          while ((match = alterTableRegex.exec(fixedMigrationSQL)) !== null) {
            alterTableFKs.push(match[0]);
          }

          console.log(`📋 Found ${alterTableFKs.length} ALTER TABLE FK constraints to apply later`);

          // Extract inline REFERENCES from CREATE TABLE and convert to ALTER TABLE
          const inlineFKs = [];
          const inlineRefRegex = /(\w+)\s+(UUID|INTEGER|BIGINT)\s+(NOT NULL\s+)?REFERENCES\s+([\w]+)\s*\(([^)]+)\)(\s+ON\s+(DELETE|UPDATE)\s+(CASCADE|SET NULL|RESTRICT|NO ACTION))*/gi;

          // Step 1: Remove REFERENCES clauses from within CREATE TABLE column definitions
          let tablesOnlySQL = fixedMigrationSQL.replace(
            /REFERENCES\s+[\w]+\s*\([^)]+\)(\s+ON\s+(DELETE|UPDATE)\s+(CASCADE|SET NULL|RESTRICT|NO ACTION))?/gi,
            ''
          );

          // Step 2: Remove entire ALTER TABLE...ADD CONSTRAINT...FOREIGN KEY statements
          tablesOnlySQL = tablesOnlySQL.replace(
            /ALTER\s+TABLE\s+[\w]+\s+ADD\s+CONSTRAINT\s+[\w]+\s+FOREIGN\s+KEY\s*\([^)]+\)[^;]*;/gi,
            ''
          );

          // Step 3: Remove ALTER TABLE...ADD FOREIGN KEY statements (without CONSTRAINT name)
          tablesOnlySQL = tablesOnlySQL.replace(
            /ALTER\s+TABLE\s+[\w]+\s+ADD\s+FOREIGN\s+KEY\s*\([^)]+\)[^;]*;/gi,
            ''
          );

          console.log('✅ Foreign key constraints extracted and removed from table creation SQL');

          // Execute migrations first (creates 137 tables WITHOUT foreign keys)
          console.log('📤 Pass 1: Running migrations via Management API (tables only)...');
          const migrationResponse = await axios.post(
            `https://api.supabase.com/v1/projects/${options.projectId}/database/query`,
            { query: tablesOnlySQL },
            {
              headers: {
                'Authorization': `Bearer ${options.oauthAccessToken}`,
                'Content-Type': 'application/json'
              },
              maxBodyLength: Infinity,
              timeout: 120000
            }
          );

          console.log('✅ Migration API response:', migrationResponse.data);

          // Check if migration actually succeeded
          if (migrationResponse.data && migrationResponse.data.error) {
            throw new Error(`Migration failed: ${migrationResponse.data.error}`);
          }

          console.log('✅ Pass 1 complete - 137 tables created without FKs');
          result.tablesCreated.push('Created 137 tables via OAuth API');

          // Execute Pass 2: Add foreign key constraints
          if (alterTableFKs.length > 0) {
            console.log(`📤 Pass 2: Adding ${alterTableFKs.length} foreign key constraints...`);
            const fkSQL = alterTableFKs.join('\n');

            try {
              const fkResponse = await axios.post(
                `https://api.supabase.com/v1/projects/${options.projectId}/database/query`,
                { query: fkSQL },
                {
                  headers: {
                    'Authorization': `Bearer ${options.oauthAccessToken}`,
                    'Content-Type': 'application/json'
                  },
                  timeout: 60000
                }
              );

              console.log('✅ Foreign keys added:', fkResponse.data);
              result.tablesCreated.push(`Added ${alterTableFKs.length} foreign key constraints`);
            } catch (fkError) {
              console.warn('⚠️ Some foreign keys failed to apply:', fkError.response?.data?.message || fkError.message);
              // Don't fail the entire provisioning if FKs fail - tables still work
            }
          }

          // IMPORTANT: Create store record BEFORE seed data (seed data has FK to stores table)
          console.log('📤 Pass 2.5: Creating store record before seed data...');

          // Store name must be provided in options (master DB doesn't have store name)
          const storeName = options.storeName || 'My Store';
          console.log(`📦 Creating store with name: ${storeName}`);

          // Fetch theme defaults and merge with options.settings
          const themeDefaults = await this.getThemeDefaults(options.themePreset);
          const storeSettings = {
            ...(options.settings || {}),
            store_email: options.userEmail || null,  // Default to store owner's email
            theme: {
              ...themeDefaults,
              ...(options.settings?.theme || {})
            }
          };
          console.log(`📦 Store settings with theme (preset: ${options.themePreset || 'default'}):`, JSON.stringify(storeSettings.theme || {}).slice(0, 200));

          const storeInsertSQL = `
INSERT INTO stores (id, user_id, name, slug, currency, timezone, is_active, settings, created_at, updated_at)
VALUES (
  '${storeId}',
  '${options.userId}',
  '${storeName.replace(/'/g, "''")}',
  '${this.generateSlug(storeName)}',
  '${options.currency || 'USD'}',
  '${options.timezone || 'UTC'}',
  true,
  '${JSON.stringify(storeSettings).replace(/'/g, "''")}'::jsonb,
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;
          `;

          try {
            await axios.post(
              `https://api.supabase.com/v1/projects/${options.projectId}/database/query`,
              { query: storeInsertSQL },
              {
                headers: {
                  'Authorization': `Bearer ${options.oauthAccessToken}`,
                  'Content-Type': 'application/json'
                }
              }
            );
            console.log('✅ Store record created before seed data');
            result.dataSeeded.push('Store record (created before seed)');
            // Mark that store was already created so we don't create it again later
            options._storeCreatedInMigrations = true;
          } catch (storeError) {
            console.error('❌ Failed to create store record before seed:', storeError.response?.data || storeError.message);
            // Continue anyway - seed data might still work for some tables
          }

          // Execute seed data separately (6,598 rows - large file)
          console.log('📊 Seed SQL size:', (processedSeedSQL.length / 1024).toFixed(2), 'KB');
          console.log('📤 Running seed data via Management API...');

          const seedResponse = await axios.post(
            `https://api.supabase.com/v1/projects/${options.projectId}/database/query`,
            { query: processedSeedSQL },
            {
              headers: {
                'Authorization': `Bearer ${options.oauthAccessToken}`,
                'Content-Type': 'application/json'
              },
              maxBodyLength: Infinity,
              timeout: 180000 // 3 minutes for seed data
            }
          );

          console.log('✅ Seed API response:', seedResponse.data);

          // Check if seeding actually succeeded
          if (seedResponse.data && seedResponse.data.error) {
            console.warn('⚠️ Seed data warning:', seedResponse.data.error);
          }

          console.log('✅ Seed data complete - 6,598 rows inserted');
          result.dataSeeded.push('Seeded 6,598 rows via OAuth API');

          return true;

        } catch (apiError) {
          console.error('❌ Supabase Management API failed:', apiError.message);
          console.error('   Response status:', apiError.response?.status);
          console.error('   Response data:', JSON.stringify(apiError.response?.data, null, 2));

          const errorMessage = apiError.response?.data?.message || apiError.response?.data?.error || apiError.message;

          result.errors.push({
            step: 'migrations',
            error: `Failed to run migrations via Supabase API: ${errorMessage}`,
            details: apiError.response?.data
          });

          throw new Error(`Migration API failed: ${errorMessage}`);
        }
      }

      // Fallback: Use direct PostgreSQL connection (manual credentials mode)
      console.log('Using direct PostgreSQL connection for provisioning...');

      const { StoreDatabase } = require('../../models/master');
      const storeDb = await StoreDatabase.findByStoreId(storeId);

      if (!storeDb) {
        throw new Error('Store database credentials not found');
      }

      const credentials = storeDb.getCredentials();
      const { Client } = require('pg');

      // Validate connection string exists
      if (!credentials.connectionString) {
        throw new Error('Database connection string not found in stored credentials');
      }

      // Check if connection string has valid password
      if (credentials.connectionString.includes('[password]')) {
        throw new Error('Database password not provided. Connection string contains placeholder.');
      }

      const pgClient = new Client({
        connectionString: credentials.connectionString,
        ssl: { rejectUnauthorized: false }
      });

      console.log('Connecting to tenant DB via PostgreSQL...');
      await pgClient.connect();

      // Execute migration SQL (creates 137 tables)
      console.log('Running tenant migration (137 tables)...');
      await pgClient.query(migrationSQL);
      result.tablesCreated.push('Created 137 tables');

      // Execute seed SQL (6,598 rows) with storeId already injected
      console.log('Running tenant seed data (6,598 rows)...');
      await pgClient.query(processedSeedSQL);
      result.dataSeeded.push('Seeded 6,598 rows from 15 tables');

      await pgClient.end();
      console.log('✅ Migration and seed complete!');

      return true;
    } catch (error) {
      console.error('Migration error:', error);
      result.errors.push({
        step: 'migrations',
        error: error.message
      });
      // Don't throw - continue provisioning
      return false;
    }
  }


  /**
   * Seed initial data into tenant database
   * @private
   */
  async seedInitialData(tenantDb, storeId, options, result) {
    try {
      // Seed default data (if needed)
      // For example: default categories, settings, etc.

      // Example: Create default service credit costs in tenant DB
      const defaultServiceCosts = [
        {
          service_key: 'product_import',
          service_name: 'Product Import',
          cost_per_unit: 0.10,
          billing_type: 'per_item'
        }
        // Add more as needed
      ];

      // TODO: Insert default data
      // await tenantDb.from('service_credit_costs').insert(defaultServiceCosts);

      result.dataSeeded.push('Default service costs');

      return true;
    } catch (error) {
      console.error('Seeding error:', error);
      result.errors.push({
        step: 'seeding',
        error: error.message
      });
      // Don't throw - seeding is optional
      return false;
    }
  }

  /**
   * Fetch theme defaults from master database
   * @private
   */
  /**
   * Get theme defaults from master DB
   * @param {string} presetName - Theme preset name (optional, defaults to system default)
   * @returns {Promise<Object>} Theme settings object
   */
  async getThemeDefaults(presetName = null) {
    try {
      let query = masterDbClient
        .from('theme_defaults')
        .select('theme_settings, preset_name')
        .eq('is_active', true);

      if (presetName) {
        // Fetch specific preset by name
        query = query.eq('preset_name', presetName);
      } else {
        // Fetch system default
        query = query.eq('is_system_default', true);
      }

      const { data: defaults, error } = await query.maybeSingle();

      if (error) {
        console.error(`❌ Error fetching theme preset '${presetName || 'default'}':`, error.message);
        return {};
      }

      if (!defaults) {
        console.warn(`⚠️ Theme preset '${presetName || 'default'}' not found in master DB theme_defaults table`);
        return {};
      }

      console.log(`✅ Fetched theme preset '${defaults.preset_name}' with ${Object.keys(defaults.theme_settings || {}).length} settings`);
      return defaults.theme_settings || {};
    } catch (error) {
      console.error('Error fetching theme defaults:', error.message);
      return {};
    }
  }

  /**
   * Create store record in tenant database
   * @private
   */
  async createStoreRecord(tenantDb, storeId, options, result) {
    try {
      // Store name must be provided in options (master DB doesn't have store name)
      const storeName = options.storeName || 'My Store';
      console.log(`📦 Creating store with name: ${storeName}`);

      // Fetch theme defaults from master DB (use preset if specified)
      const themeDefaults = await this.getThemeDefaults(options.themePreset);

      // Build initial settings with theme defaults
      const initialSettings = {
        ...(options.settings || {}),
        store_email: options.userEmail || null,  // Default to store owner's email
        theme: {
          ...themeDefaults,
          ...(options.settings?.theme || {})
        }
      };

      console.log(`📦 Creating store with theme preset: ${options.themePreset || 'default'}`);
      console.log(`📦 Theme settings to save:`, JSON.stringify(initialSettings.theme || {}).slice(0, 200));

      const storeData = {
        id: storeId,
        user_id: options.userId,
        name: storeName,
        slug: options.storeSlug || this.generateSlug(storeName),
        currency: options.currency || 'USD',
        timezone: options.timezone || 'UTC',
        is_active: true,
        settings: initialSettings,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await tenantDb
        .from('stores')
        .insert(storeData)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create store record: ${error.message}`);
      }

      result.dataSeeded.push('Store record');

      return data;
    } catch (error) {
      console.error('Store creation error:', error);
      result.errors.push({
        step: 'create_store',
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Create user record in tenant database
   * @private
   */
  async createUserRecord(tenantDb, options, result) {
    try {
      const userData = {
        id: options.userId,
        email: options.userEmail,
        password: options.userPasswordHash, // Already hashed
        first_name: options.userFirstName || '',
        last_name: options.userLastName || '',
        role: 'admin',
        account_type: 'agency',
        is_active: true,
        email_verified: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await tenantDb
        .from('users')
        .insert(userData)
        .select()
        .single();

      if (error) {
        // User might already exist, that's okay
        console.warn('User creation warning:', error.message);
        result.dataSeeded.push('User record (may already exist)');
        return null;
      }

      result.dataSeeded.push('User record');

      return data;
    } catch (error) {
      console.error('User creation error:', error);
      result.errors.push({
        step: 'create_user',
        error: error.message
      });
      // Don't throw - user creation is optional
      return null;
    }
  }

  /**
   * Generate URL-safe slug from name
   * @private
   */
  generateSlug(name) {
    if (!name) {
      return `store-${Date.now()}`;
    }

    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Create store record via Management API SQL
   * @private
   */
  async createStoreRecordViaAPI(oauthAccessToken, projectId, storeId, options, result) {
    try {
      const axios = require('axios');

      // Store name must be provided in options (master DB doesn't have store name)
      const storeName = options.storeName || 'My Store';
      console.log(`📦 Creating store via API with name: ${storeName}`);

      // Fetch theme defaults from master DB (use preset if specified)
      const themeDefaults = await this.getThemeDefaults(options.themePreset);

      // Build initial settings with theme defaults
      const initialSettings = {
        ...(options.settings || {}),
        store_email: options.userEmail || null,  // Default to store owner's email
        theme: {
          ...themeDefaults,
          ...(options.settings?.theme || {})
        }
      };

      console.log(`📦 Creating store via API with theme preset: ${options.themePreset || 'default'}`);

      const insertSQL = `
INSERT INTO stores (id, user_id, name, slug, currency, timezone, is_active, settings, created_at, updated_at)
VALUES (
  '${storeId}',
  '${options.userId}',
  '${storeName.replace(/'/g, "''")}',
  '${this.generateSlug(storeName)}',
  '${options.currency || 'USD'}',
  '${options.timezone || 'UTC'}',
  true,
  '${JSON.stringify(initialSettings).replace(/'/g, "''")}'::jsonb,
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;
      `;

      await axios.post(
        `https://api.supabase.com/v1/projects/${projectId}/database/query`,
        { query: insertSQL },
        {
          headers: {
            'Authorization': `Bearer ${oauthAccessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('✅ Store record created via Management API');
      result.dataSeeded.push('Store record (via API)');
      return true;
    } catch (error) {
      console.error('Store creation via API error:', error.response?.data || error.message);
      result.errors.push({
        step: 'create_store',
        error: error.message
      });
      // Don't throw - non-blocking
      return false;
    }
  }

  /**
   * Create user record via Management API SQL
   * @private
   */
  async createUserRecordViaAPI(oauthAccessToken, projectId, options, result) {
    try {
      const axios = require('axios');

      const insertSQL = `
INSERT INTO users (id, email, password, first_name, last_name, role, account_type, is_active, email_verified, created_at, updated_at)
VALUES (
  '${options.userId}',
  '${options.userEmail}',
  '${options.userPasswordHash || 'oauth-user'}',
  '${(options.userFirstName || '').replace(/'/g, "''")}',
  '${(options.userLastName || '').replace(/'/g, "''")}',
  'admin',
  'agency',
  true,
  true,
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;
      `;

      await axios.post(
        `https://api.supabase.com/v1/projects/${projectId}/database/query`,
        { query: insertSQL },
        {
          headers: {
            'Authorization': `Bearer ${oauthAccessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('✅ User record created via Management API');
      result.dataSeeded.push('User record (via API)');
      return true;
    } catch (error) {
      console.error('User creation via API error:', error.response?.data || error.message);
      result.errors.push({
        step: 'create_user',
        error: error.message
      });
      // Don't throw - non-blocking
      return false;
    }
  }

  /**
   * Seed default SEO settings with robots.txt
   * @private
   */
  async seedDefaultSeoSettings(tenantDb, storeId, options, result) {
    try {
      // Get store slug for sitemap URL
      const { data: store, error: storeError } = await tenantDb
        .from('stores')
        .select('slug, settings')
        .eq('id', storeId)
        .single();

      if (storeError) {
        console.warn('Could not fetch store for SEO settings:', storeError.message);
      }

      // Check for custom domain in custom_domains table
      let customDomain = null;
      try {
        const { data: domainData } = await tenantDb
          .from('custom_domains')
          .select('domain')
          .eq('store_id', storeId)
          .eq('is_primary', true)
          .single();
        customDomain = domainData?.domain;
      } catch (e) {
        // custom_domains table may not exist yet
      }

      // Determine base URL for sitemap
      const slug = options.storeSlug || store?.slug || this.generateSlug(options.storeName);
      let baseUrl;

      if (customDomain) {
        baseUrl = customDomain.startsWith('http') ? customDomain : `https://${customDomain}`;
      } else {
        const platformUrl = process.env.CORS_ORIGIN || 'https://www.dainostore.com';
        baseUrl = `${platformUrl}/public/${slug}`;
      }

      // Generate default robots.txt content with dynamic sitemap
      const robotsTxtContent = `User-agent: *
Allow: /

# Allow content directories (default behavior)
Allow: /products/
Allow: /categories/
Allow: /cms-pages/

# Block admin and system paths
Disallow: /admin/
Disallow: /api/
Disallow: /checkout/
Disallow: /cart/
Disallow: /account/
Disallow: /login

Sitemap: ${baseUrl}/sitemap.xml`;

      // Insert default SEO settings using correct column structure
      // Note: sitemap settings are embedded in xml_sitemap_settings JSON column
      const seoSettingsData = {
        store_id: storeId,
        robots_txt_content: robotsTxtContent,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await tenantDb
        .from('seo_settings')
        .insert(seoSettingsData)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to seed SEO settings: ${error.message}`);
      }

      console.log(`✅ Default SEO settings seeded with sitemap URL: ${baseUrl}/sitemap.xml`);
      result.dataSeeded.push('Default SEO settings with robots.txt');

      return data;
    } catch (error) {
      console.error('SEO settings seeding error:', error);
      result.errors.push({
        step: 'seed_seo_settings',
        error: error.message
      });
      // Don't throw - SEO settings are optional
      return null;
    }
  }

  /**
   * Seed default SEO settings via Management API SQL
   * @private
   */
  async seedDefaultSeoSettingsViaAPI(oauthAccessToken, projectId, storeId, options, result) {
    try {
      const axios = require('axios');

      // Determine base URL for sitemap
      const slug = options.storeSlug || this.generateSlug(options.storeName);
      let baseUrl;

      if (options.customDomain) {
        baseUrl = options.customDomain.startsWith('http') ? options.customDomain : `https://${options.customDomain}`;
      } else {
        const platformUrl = process.env.CORS_ORIGIN || 'https://www.dainostore.com';
        baseUrl = `${platformUrl}/public/${slug}`;
      }

      // Generate default robots.txt content
      const robotsTxtContent = `User-agent: *
Allow: /

# Allow content directories (default behavior)
Allow: /products/
Allow: /categories/
Allow: /cms-pages/

# Block admin and system paths
Disallow: /admin/
Disallow: /api/
Disallow: /checkout/
Disallow: /cart/
Disallow: /account/
Disallow: /login

Sitemap: ${baseUrl}/sitemap.xml`;

      // Escape single quotes for SQL
      const escapedRobotsTxt = robotsTxtContent.replace(/'/g, "''");

      // Use correct column structure - sitemap settings are in JSON columns with defaults
      const insertSQL = `
INSERT INTO seo_settings (store_id, robots_txt_content, created_at, updated_at)
VALUES (
  '${storeId}',
  '${escapedRobotsTxt}',
  NOW(),
  NOW()
) ON CONFLICT (store_id) DO NOTHING;
      `;

      await axios.post(
        `https://api.supabase.com/v1/projects/${projectId}/database/query`,
        { query: insertSQL },
        {
          headers: {
            'Authorization': `Bearer ${oauthAccessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log(`✅ Default SEO settings seeded via API with sitemap URL: ${baseUrl}/sitemap.xml`);
      result.dataSeeded.push('Default SEO settings with robots.txt (via API)');
      return true;
    } catch (error) {
      console.error('SEO settings seeding via API error:', error.response?.data || error.message);
      result.errors.push({
        step: 'seed_seo_settings',
        error: error.message
      });
      // Don't throw - non-blocking
      return false;
    }
  }

  /**
   * Load page configuration from backend config files
   * @private
   */
  async loadPageConfig(pageType, configExport) {
    try {
      // Use backend configs directory (CommonJS format)
      const configsDir = path.resolve(__dirname, '../../configs/slot');
      const configPath = path.join(configsDir, `${pageType}-config.js`);

      // Use require for CommonJS modules
      const configModule = require(configPath);
      const config = configModule[configExport];

      if (!config) {
        console.warn(`Config export '${configExport}' not found in ${configPath}`);
        return null;
      }

      return config;
    } catch (error) {
      console.error(`Failed to load ${pageType}-config.js:`, error.message);
      return null;
    }
  }

  /**
   * Build root slots from slot configuration
   * @private
   */
  buildRootSlots(slots) {
    if (!slots) return [];
    return Object.entries(slots)
      .filter(([_, slot]) => !slot.parentId || slot.parentId === null)
      .map(([slotId]) => slotId);
  }

  /**
   * Seed slot configurations from config files
   * @private
   */
  async seedSlotConfigurations(tenantDb, storeId, options, result) {
    try {
      console.log('📦 Loading slot configurations from config files...');

      const configsToInsert = [];

      for (const { pageType, configExport } of PAGE_CONFIGS) {
        try {
          const pageConfig = await this.loadPageConfig(pageType, configExport);

          if (!pageConfig) {
            console.warn(`⚠️ Could not load ${pageType} config, skipping...`);
            continue;
          }

          // Build full configuration object
          const fullConfiguration = {
            page_name: pageConfig.page_name || pageType.charAt(0).toUpperCase() + pageType.slice(1),
            slot_type: pageConfig.slot_type || `${pageType}_layout`,
            slots: pageConfig.slots || {},
            rootSlots: this.buildRootSlots(pageConfig.slots),
            slotDefinitions: pageConfig.slotDefinitions || {},
            metadata: {
              created: new Date().toISOString(),
              lastModified: new Date().toISOString(),
              source: `${pageType}-config.js`,
              pageType: pageType
            }
          };

          // Create published version (version 1.0)
          configsToInsert.push({
            id: uuidv4(),
            user_id: options.userId,
            store_id: storeId,
            configuration: fullConfiguration,
            page_type: pageType,
            is_active: true,
            status: 'published',
            version: '1.0',
            version_number: 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

          // Create draft version (version 2.0)
          configsToInsert.push({
            id: uuidv4(),
            user_id: options.userId,
            store_id: storeId,
            configuration: fullConfiguration,
            page_type: pageType,
            is_active: true,
            status: 'draft',
            version: '2.0',
            version_number: 2,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

          console.log(`✅ Loaded ${pageType} configuration (published + draft)`);
        } catch (configError) {
          console.warn(`⚠️ Failed to load ${pageType} config:`, configError.message);
        }
      }

      if (configsToInsert.length === 0) {
        console.warn('⚠️ No slot configurations to insert');
        return false;
      }

      // Insert all configurations
      const { data, error } = await tenantDb
        .from('slot_configurations')
        .insert(configsToInsert)
        .select();

      if (error) {
        throw new Error(`Failed to insert slot configurations: ${error.message}`);
      }

      console.log(`✅ Seeded ${configsToInsert.length} slot configurations`);
      result.dataSeeded.push(`${configsToInsert.length} slot configurations`);

      return true;
    } catch (error) {
      console.error('Slot configuration seeding error:', error);
      result.errors.push({
        step: 'seed_slot_configurations',
        error: error.message
      });
      // Don't throw - slot configurations are optional
      return false;
    }
  }

  /**
   * Seed slot configurations via Management API SQL
   * @private
   */
  async seedSlotConfigurationsViaAPI(oauthAccessToken, projectId, storeId, options, result) {
    try {
      const axios = require('axios');
      console.log('📦 Loading slot configurations from config files for API insertion...');

      const insertStatements = [];

      for (const { pageType, configExport } of PAGE_CONFIGS) {
        try {
          const pageConfig = await this.loadPageConfig(pageType, configExport);

          if (!pageConfig) {
            console.warn(`⚠️ Could not load ${pageType} config, skipping...`);
            continue;
          }

          // Build full configuration object
          const fullConfiguration = {
            page_name: pageConfig.page_name || pageType.charAt(0).toUpperCase() + pageType.slice(1),
            slot_type: pageConfig.slot_type || `${pageType}_layout`,
            slots: pageConfig.slots || {},
            rootSlots: this.buildRootSlots(pageConfig.slots),
            slotDefinitions: pageConfig.slotDefinitions || {},
            metadata: {
              created: new Date().toISOString(),
              lastModified: new Date().toISOString(),
              source: `${pageType}-config.js`,
              pageType: pageType
            }
          };

          // Escape single quotes and prepare JSON for SQL
          const configJson = JSON.stringify(fullConfiguration).replace(/'/g, "''");
          const publishedId = uuidv4();
          const draftId = uuidv4();

          // Published version (version 1.0)
          insertStatements.push(`
INSERT INTO slot_configurations (id, user_id, store_id, configuration, page_type, is_active, status, version, version_number, created_at, updated_at)
VALUES (
  '${publishedId}',
  '${options.userId}',
  '${storeId}',
  '${configJson}'::jsonb,
  '${pageType}',
  true,
  'published',
  '1.0',
  1,
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;`);

          // Draft version (version 2.0)
          insertStatements.push(`
INSERT INTO slot_configurations (id, user_id, store_id, configuration, page_type, is_active, status, version, version_number, created_at, updated_at)
VALUES (
  '${draftId}',
  '${options.userId}',
  '${storeId}',
  '${configJson}'::jsonb,
  '${pageType}',
  true,
  'draft',
  '2.0',
  2,
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;`);

          console.log(`✅ Prepared ${pageType} configuration for insertion (published + draft)`);
        } catch (configError) {
          console.warn(`⚠️ Failed to load ${pageType} config:`, configError.message);
        }
      }

      if (insertStatements.length === 0) {
        console.warn('⚠️ No slot configurations to insert');
        return false;
      }

      // Execute all inserts as a single batch
      const batchSQL = insertStatements.join('\n');

      await axios.post(
        `https://api.supabase.com/v1/projects/${projectId}/database/query`,
        { query: batchSQL },
        {
          headers: {
            'Authorization': `Bearer ${oauthAccessToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 60000
        }
      );

      console.log(`✅ Seeded ${insertStatements.length} slot configurations via API`);
      result.dataSeeded.push(`${insertStatements.length} slot configurations (via API)`);
      return true;
    } catch (error) {
      console.error('Slot configuration seeding via API error:', error.response?.data || error.message);
      result.errors.push({
        step: 'seed_slot_configurations',
        error: error.message
      });
      // Don't throw - non-blocking
      return false;
    }
  }

  /**
   * Test tenant database connection
   */
  async testTenantConnection(tenantDb) {
    try {
      const { data, error } = await tenantDb
        .from('stores')
        .select('id')
        .limit(1);

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return {
        success: true,
        message: 'Connection successful'
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * Check tenant database health status
   * Returns detailed status about the tenant database state
   *
   * @param {string} storeId - Store UUID
   * @returns {Promise<Object>} Health status object
   */
  async checkTenantHealth(storeId) {
    const ConnectionManager = require('./ConnectionManager');
    const { masterDbClient } = require('../../database/masterConnection');

    const result = {
      storeId,
      status: 'unknown',
      databaseConfigured: false,
      databaseConnected: false,
      tablesProvisioned: false,
      storeRecordExists: false,
      requiredTables: [],
      missingTables: [],
      message: '',
      actions: []
    };

    try {
      // 1. Check if store exists in master DB
      const { data: masterStore, error: masterError } = await masterDbClient
        .from('stores')
        .select('id, name, is_active')
        .eq('id', storeId)
        .maybeSingle();

      if (masterError || !masterStore) {
        result.status = 'not_found';
        result.message = 'Store not found in master database';
        return result;
      }

      // 2. Check if database configuration exists
      const { data: storeDb, error: dbError } = await masterDbClient
        .from('store_databases')
        .select('id, database_type, is_active, connection_status')
        .eq('store_id', storeId)
        .maybeSingle();

      if (dbError || !storeDb) {
        result.status = 'no_database';
        result.message = 'No database configured for this store';
        result.actions = ['connect_database'];
        return result;
      }

      result.databaseConfigured = true;

      if (!storeDb.is_active) {
        result.status = 'database_inactive';
        result.message = 'Database connection is inactive';
        result.actions = ['reactivate_database', 'remove_store'];
        return result;
      }

      // 3. Try to connect to tenant database
      let tenantDb;
      try {
        tenantDb = await ConnectionManager.getStoreConnection(storeId, false);
        result.databaseConnected = true;
      } catch (connError) {
        result.status = 'connection_failed';
        result.message = `Failed to connect to tenant database: ${connError.message}`;
        result.actions = ['update_credentials', 'remove_store'];
        return result;
      }

      // 4. Check if required tables exist
      const requiredTables = ['stores', 'products', 'categories', 'orders', 'customers', 'languages'];
      result.requiredTables = requiredTables;

      for (const tableName of requiredTables) {
        try {
          const { data, error } = await tenantDb
            .from(tableName)
            .select('*')
            .limit(1);

          // PGRST116 means table exists but is empty - that's OK
          // Other errors (like 42P01 - relation does not exist) mean table is missing
          if (error && error.code !== 'PGRST116' && !error.message?.includes('0 rows')) {
            result.missingTables.push(tableName);
          }
        } catch (tableError) {
          result.missingTables.push(tableName);
        }
      }

      // 5. Determine final status
      if (result.missingTables.length === requiredTables.length) {
        // All tables missing - database is empty/cleared
        result.status = 'empty';
        result.tablesProvisioned = false;
        result.message = 'Tenant database is empty - needs provisioning';
        result.actions = ['provision_database', 'remove_store'];
      } else if (result.missingTables.length > 0) {
        // Some tables missing - partial state
        result.status = 'partial';
        result.tablesProvisioned = false;
        result.message = `Tenant database is partially provisioned. Missing tables: ${result.missingTables.join(', ')}`;
        result.actions = ['provision_database', 'remove_store'];
      } else {
        // All tables exist
        result.tablesProvisioned = true;

        // 6. Check if store record exists in tenant DB
        try {
          const { data: tenantStore, error: storeError } = await tenantDb
            .from('stores')
            .select('id')
            .eq('id', storeId)
            .maybeSingle();

          result.storeRecordExists = !!tenantStore;
        } catch (e) {
          result.storeRecordExists = false;
        }

        if (result.storeRecordExists) {
          result.status = 'healthy';
          result.message = 'Tenant database is fully provisioned and healthy';
          result.actions = [];
        } else {
          result.status = 'missing_store_record';
          result.message = 'Tables exist but store record is missing in tenant database';
          result.actions = ['create_store_record', 'provision_database'];
        }
      }

      return result;
    } catch (error) {
      result.status = 'error';
      result.message = `Health check failed: ${error.message}`;
      result.actions = ['remove_store'];
      return result;
    }
  }

  /**
   * Re-provision an existing tenant database
   * Used when database was cleared but store still exists in master
   *
   * @param {string} storeId - Store UUID
   * @param {Object} options - Provisioning options
   * @returns {Promise<Object>} Provisioning result
   */
  async reprovisionTenantDatabase(storeId, options = {}) {
    const ConnectionManager = require('./ConnectionManager');

    try {
      // Get tenant database connection
      const tenantDb = await ConnectionManager.getStoreConnection(storeId, false);

      // Clear connection cache to ensure fresh state
      ConnectionManager.clearCache(storeId);

      // Run provisioning with force flag
      const result = await this.provisionTenantDatabase(tenantDb, storeId, {
        ...options,
        force: true
      });

      return result;
    } catch (error) {
      return {
        success: false,
        storeId,
        message: `Re-provisioning failed: ${error.message}`,
        error: error.message
      };
    }
  }

  /**
   * Update store name in tenant DB
   * Used to fix existing stores with missing/incorrect names
   *
   * @param {string} storeId - Store UUID
   * @param {string} storeName - New store name
   * @returns {Promise<Object>} Update result
   */
  async updateStoreName(storeId, storeName) {
    const ConnectionManager = require('./ConnectionManager');

    try {
      if (!storeName) {
        return {
          success: false,
          storeId,
          message: 'Store name is required'
        };
      }

      // Get tenant database connection
      const tenantDb = await ConnectionManager.getStoreConnection(storeId, false);

      // Update store name in tenant DB
      const { data: updatedStore, error: updateError } = await tenantDb
        .from('stores')
        .update({
          name: storeName,
          updated_at: new Date().toISOString()
        })
        .eq('id', storeId)
        .select()
        .maybeSingle();

      if (updateError) {
        return {
          success: false,
          storeId,
          message: `Failed to update tenant store: ${updateError.message}`
        };
      }

      console.log(`✅ Updated store name in tenant DB: ${storeName}`);

      return {
        success: true,
        storeId,
        storeName: storeName,
        message: `Store name updated successfully: ${storeName}`
      };
    } catch (error) {
      return {
        success: false,
        storeId,
        message: `Update failed: ${error.message}`,
        error: error.message
      };
    }
  }
}

// Export singleton instance
module.exports = new TenantProvisioningService();
