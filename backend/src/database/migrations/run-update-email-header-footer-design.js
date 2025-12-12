/**
 * Migration Runner: Update Email Header/Footer Design
 *
 * This migration updates email header and footer templates to the new Payoneer-style design:
 * - Colorful rainbow top border instead of solid purple header
 * - White background instead of dark colors
 * - Centered logo
 * - Cleaner footer styling
 *
 * Run with: node backend/src/database/migrations/run-update-email-header-footer-design.js
 */

const ConnectionManager = require('../../services/database/ConnectionManager');
const { masterDbClient } = require('../masterConnection');

const NEW_EMAIL_HEADER = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <!-- Colorful Top Border -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; border-radius: 8px 8px 0 0; overflow: hidden;">
                <tr>
                  <td style="height: 4px; width: 16.66%; background-color: #ef4444;"></td>
                  <td style="height: 4px; width: 16.66%; background-color: #f97316;"></td>
                  <td style="height: 4px; width: 16.66%; background-color: #eab308;"></td>
                  <td style="height: 4px; width: 16.66%; background-color: #22c55e;"></td>
                  <td style="height: 4px; width: 16.66%; background-color: #3b82f6;"></td>
                  <td style="height: 4px; width: 16.66%; background-color: #8b5cf6;"></td>
                </tr>
              </table>
              <!-- Header with white background -->
              <div style="background-color: #ffffff; padding: 32px 30px 24px; text-align: center;">
                <img src="{{store_logo_url}}" alt="{{store_name}}" style="max-width: 160px; max-height: 80px; object-fit: contain; margin-bottom: 8px;">
              </div>
            </div>`;

const NEW_EMAIL_FOOTER = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background-color: #ffffff; padding: 24px 30px 32px; text-align: center; border-top: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
                <p style="color: #6b7280; font-size: 13px; margin: 0 0 10px 0;">
                  Questions? Contact us at <a href="mailto:{{contact_email}}" style="color: #6b7280; text-decoration: none;">{{contact_email}}</a>
                </p>
                <p style="color: #9ca3af; font-size: 11px; margin: 10px 0;">
                  {{store_address}}<br>
                  {{store_city}}, {{store_state}} {{store_postal_code}}
                </p>
                <div style="margin: 16px 0;">
                  <a href="{{store_url}}" style="color: #6b7280; text-decoration: none; margin: 0 10px; font-size: 13px;">Visit Store</a>
                  <span style="color: #e5e7eb;">|</span>
                  <a href="{{unsubscribe_url}}" style="color: #9ca3af; text-decoration: none; margin: 0 10px; font-size: 11px;">Unsubscribe</a>
                </div>
                <p style="color: #d1d5db; font-size: 11px; margin: 12px 0 0 0;">
                  © {{current_year}} {{store_name}}. All rights reserved.
                </p>
              </div>
            </div>`;

async function runMigration() {
  console.log('🚀 Starting email header/footer design migration...');

  try {
    // Get all stores
    const { data: stores, error: storesError } = await masterDbClient
      .from('stores')
      .select('id, name')
      .eq('is_active', true);

    if (storesError) {
      throw new Error(`Failed to fetch stores: ${storesError.message}`);
    }

    console.log(`📦 Found ${stores.length} active stores`);

    // Process each store
    for (const store of stores) {
      console.log(`\n📧 Processing store: ${store.name} (${store.id})`);

      try {
        const tenantDb = await ConnectionManager.getStoreConnection(store.id);

        // Update email_header template
        const { data: headerTemplate, error: headerError } = await tenantDb
          .from('email_templates')
          .select('id')
          .eq('identifier', 'email_header')
          .limit(1)
          .maybeSingle();

        if (headerError) {
          console.log(`  ⚠️ Error fetching header template: ${headerError.message}`);
        } else if (headerTemplate) {
          // Update main template
          const { error: updateHeaderError } = await tenantDb
            .from('email_templates')
            .update({
              html_content: NEW_EMAIL_HEADER,
              updated_at: new Date().toISOString()
            })
            .eq('id', headerTemplate.id);

          if (updateHeaderError) {
            console.log(`  ❌ Failed to update header template: ${updateHeaderError.message}`);
          } else {
            console.log(`  ✅ Updated email_header template`);
          }

          // Update translations
          const { error: updateHeaderTransError } = await tenantDb
            .from('email_template_translations')
            .update({
              html_content: NEW_EMAIL_HEADER,
              updated_at: new Date().toISOString()
            })
            .eq('email_template_id', headerTemplate.id);

          if (updateHeaderTransError) {
            console.log(`  ⚠️ Warning updating header translations: ${updateHeaderTransError.message}`);
          } else {
            console.log(`  ✅ Updated email_header translations`);
          }
        } else {
          console.log(`  ⏭️ No email_header template found`);
        }

        // Update email_footer template
        const { data: footerTemplate, error: footerError } = await tenantDb
          .from('email_templates')
          .select('id')
          .eq('identifier', 'email_footer')
          .limit(1)
          .maybeSingle();

        if (footerError) {
          console.log(`  ⚠️ Error fetching footer template: ${footerError.message}`);
        } else if (footerTemplate) {
          // Update main template
          const { error: updateFooterError } = await tenantDb
            .from('email_templates')
            .update({
              html_content: NEW_EMAIL_FOOTER,
              updated_at: new Date().toISOString()
            })
            .eq('id', footerTemplate.id);

          if (updateFooterError) {
            console.log(`  ❌ Failed to update footer template: ${updateFooterError.message}`);
          } else {
            console.log(`  ✅ Updated email_footer template`);
          }

          // Update translations
          const { error: updateFooterTransError } = await tenantDb
            .from('email_template_translations')
            .update({
              html_content: NEW_EMAIL_FOOTER,
              updated_at: new Date().toISOString()
            })
            .eq('email_template_id', footerTemplate.id);

          if (updateFooterTransError) {
            console.log(`  ⚠️ Warning updating footer translations: ${updateFooterTransError.message}`);
          } else {
            console.log(`  ✅ Updated email_footer translations`);
          }
        } else {
          console.log(`  ⏭️ No email_footer template found`);
        }

      } catch (storeError) {
        console.error(`  ❌ Error processing store ${store.name}: ${storeError.message}`);
      }
    }

    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }

  process.exit(0);
}

runMigration();
