/**
 * Seed Cart Alert plugin cron jobs
 * Run with: node backend/scripts/seed-cart-alert-cron.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');

const PLUGIN_ID = 'ef537565-3db0-466e-8b56-1694499f6a03';

async function seedCronJobs() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('🔄 Seeding cron jobs for Cart Alert plugin...');

  // First, check if the plugin exists
  const { data: plugin, error: pluginError } = await supabase
    .from('plugin_registry')
    .select('id, name, slug')
    .eq('id', PLUGIN_ID)
    .single();

  if (pluginError || !plugin) {
    console.error('❌ Plugin not found:', PLUGIN_ID);
    console.error('Error:', pluginError?.message);
    process.exit(1);
  }

  console.log(`✅ Found plugin: ${plugin.name} (${plugin.slug})`);

  // Define cron jobs to create
  const cronJobs = [
    {
      plugin_id: PLUGIN_ID,
      cron_name: 'send-cart-reminders',
      description: 'Send abandoned cart reminder emails to customers who left items in their cart',
      cron_schedule: '0 9 * * *',  // Daily at 9 AM
      timezone: 'UTC',
      handler_method: 'sendCartReminders',
      handler_params: {
        reminderDelayHours: 24,
        maxReminders: 3,
        emailTemplate: 'cart-reminder'
      },
      is_enabled: true,
      priority: 10,
      timeout_seconds: 300,
      max_failures: 5
    },
    {
      plugin_id: PLUGIN_ID,
      cron_name: 'cleanup-old-carts',
      description: 'Clean up abandoned carts older than 30 days',
      cron_schedule: '0 3 * * 0',  // Weekly on Sunday at 3 AM
      timezone: 'UTC',
      handler_method: 'cleanupOldCarts',
      handler_params: {
        olderThanDays: 30
      },
      is_enabled: true,
      priority: 5,
      timeout_seconds: 600,
      max_failures: 3
    }
  ];

  // Insert or update each cron job
  for (const cronJob of cronJobs) {
    // Check if exists
    const { data: existing } = await supabase
      .from('plugin_cron')
      .select('id')
      .eq('plugin_id', cronJob.plugin_id)
      .eq('cron_name', cronJob.cron_name)
      .single();

    if (existing) {
      // Update
      const { error } = await supabase
        .from('plugin_cron')
        .update({
          ...cronJob,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);

      if (error) {
        console.error(`❌ Failed to update ${cronJob.cron_name}:`, error.message);
      } else {
        console.log(`🔄 Updated cron job: ${cronJob.cron_name} (${cronJob.cron_schedule})`);
      }
    } else {
      // Insert
      const { error } = await supabase
        .from('plugin_cron')
        .insert({
          ...cronJob,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error(`❌ Failed to create ${cronJob.cron_name}:`, error.message);
      } else {
        console.log(`✅ Created cron job: ${cronJob.cron_name} (${cronJob.cron_schedule})`);
      }
    }
  }

  console.log('\n✅ Done! Cron jobs seeded for Cart Alert plugin.');
  console.log('\nScheduled jobs:');
  console.log('  - send-cart-reminders: Daily at 9 AM UTC');
  console.log('  - cleanup-old-carts: Weekly on Sunday at 3 AM UTC');
}

seedCronJobs().catch(console.error);
