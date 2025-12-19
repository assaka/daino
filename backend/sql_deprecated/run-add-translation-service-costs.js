/**
 * Migration: Add Translation Service Credit Costs
 *
 * Adds service_credit_cost entries for all translation entity types
 * to enable proper credit cost tracking for AI translations.
 */

const { sequelize } = require('../src/database/connection');
const ServiceCreditCost = require('../src/models/ServiceCreditCost');

async function addTranslationServiceCosts() {
  console.log('🚀 Starting translation service costs migration...');

  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established');

    // Define all translation service costs
    const translationServices = [
      {
        service_key: 'ai_translation',
        service_name: 'AI Translation (Standard)',
        service_category: 'ai_services',
        description: 'Standard AI-powered translation service for UI labels and general text',
        cost_per_unit: 0.1,
        billing_type: 'per_use',
        is_active: true,
        is_visible: true,
        display_order: 100
      },
      {
        service_key: 'ai_translation_product',
        service_name: 'AI Translation - Products',
        service_category: 'ai_services',
        description: 'AI translation for product names and descriptions',
        cost_per_unit: 0.1,
        billing_type: 'per_item',
        is_active: true,
        is_visible: true,
        display_order: 101
      },
      {
        service_key: 'ai_translation_category',
        service_name: 'AI Translation - Categories',
        service_category: 'ai_services',
        description: 'AI translation for category names and descriptions',
        cost_per_unit: 0.1,
        billing_type: 'per_item',
        is_active: true,
        is_visible: true,
        display_order: 102
      },
      {
        service_key: 'ai_translation_attribute',
        service_name: 'AI Translation - Attributes',
        service_category: 'ai_services',
        description: 'AI translation for product attributes and their labels',
        cost_per_unit: 0.1,
        billing_type: 'per_item',
        is_active: true,
        is_visible: true,
        display_order: 103
      },
      {
        service_key: 'ai_translation_cms_page',
        service_name: 'AI Translation - CMS Pages',
        service_category: 'ai_services',
        description: 'AI translation for CMS page content (higher cost due to longer content)',
        cost_per_unit: 0.5,
        billing_type: 'per_item',
        is_active: true,
        is_visible: true,
        display_order: 104
      },
      {
        service_key: 'ai_translation_cms_block',
        service_name: 'AI Translation - CMS Blocks',
        service_category: 'ai_services',
        description: 'AI translation for CMS block content',
        cost_per_unit: 0.2,
        billing_type: 'per_item',
        is_active: true,
        is_visible: true,
        display_order: 105
      },
      {
        service_key: 'ai_translation_product_tab',
        service_name: 'AI Translation - Product Tabs',
        service_category: 'ai_services',
        description: 'AI translation for product tab names and content',
        cost_per_unit: 0.1,
        billing_type: 'per_item',
        is_active: true,
        is_visible: true,
        display_order: 106
      },
      {
        service_key: 'ai_translation_product_label',
        service_name: 'AI Translation - Product Labels',
        service_category: 'ai_services',
        description: 'AI translation for product label text',
        cost_per_unit: 0.1,
        billing_type: 'per_item',
        is_active: true,
        is_visible: true,
        display_order: 107
      },
      {
        service_key: 'ai_translation_cookie_consent',
        service_name: 'AI Translation - Cookie Consent',
        service_category: 'ai_services',
        description: 'AI translation for cookie consent banner and settings',
        cost_per_unit: 0.1,
        billing_type: 'per_item',
        is_active: true,
        is_visible: true,
        display_order: 108
      },
      {
        service_key: 'ai_translation_attribute_value',
        service_name: 'AI Translation - Attribute Values',
        service_category: 'ai_services',
        description: 'AI translation for attribute value labels',
        cost_per_unit: 0.1,
        billing_type: 'per_item',
        is_active: true,
        is_visible: true,
        display_order: 109
      },
      {
        service_key: 'ai_translation_email_template',
        service_name: 'AI Translation - Email Templates',
        service_category: 'ai_services',
        description: 'AI translation for email template subjects and content',
        cost_per_unit: 0.1,
        billing_type: 'per_item',
        is_active: true,
        is_visible: true,
        display_order: 110
      },
      {
        service_key: 'ai_translation_pdf_template',
        service_name: 'AI Translation - PDF Templates',
        service_category: 'ai_services',
        description: 'AI translation for PDF template content',
        cost_per_unit: 0.1,
        billing_type: 'per_item',
        is_active: true,
        is_visible: true,
        display_order: 111
      },
      {
        service_key: 'ai_translation_custom_option',
        service_name: 'AI Translation - Custom Options',
        service_category: 'ai_services',
        description: 'AI translation for custom product option labels and values',
        cost_per_unit: 0.1,
        billing_type: 'per_item',
        is_active: true,
        is_visible: true,
        display_order: 112
      },
      {
        service_key: 'ai_translation_stock_label',
        service_name: 'AI Translation - Stock Labels',
        service_category: 'ai_services',
        description: 'AI translation for stock status labels',
        cost_per_unit: 0.1,
        billing_type: 'per_item',
        is_active: true,
        is_visible: true,
        display_order: 113
      }
    ];

    console.log(`📋 Adding ${translationServices.length} translation service cost entries...`);

    let added = 0;
    let updated = 0;
    let skipped = 0;

    for (const service of translationServices) {
      try {
        // Check if service already exists
        const existing = await ServiceCreditCost.findOne({
          where: { service_key: service.service_key }
        });

        if (existing) {
          console.log(`⏭️  Service ${service.service_key} already exists, skipping...`);
          skipped++;
        } else {
          await ServiceCreditCost.create(service);
          console.log(`✅ Added: ${service.service_name} (${service.service_key}) - ${service.cost_per_unit} credits`);
          added++;
        }
      } catch (error) {
        console.error(`❌ Error adding ${service.service_key}:`, error.message);
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   ✅ Added: ${added}`);
    console.log(`   ⏭️  Skipped (already exist): ${skipped}`);
    console.log(`   ❌ Failed: ${translationServices.length - added - skipped}`);
    console.log('\n✅ Translation service costs migration completed!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  addTranslationServiceCosts();
}

module.exports = addTranslationServiceCosts;
