/**
 * Migration: Create Normalized Translation and SEO Tables
 *
 * This migration creates separate normalized tables for:
 * - Entity translations (products, categories, CMS pages, attributes, etc.)
 * - SEO metadata (products, categories, CMS pages)
 *
 * WHY NORMALIZE:
 * - Enable full-text search per language (PostgreSQL GIN indexes)
 * - Faster storefront queries (only load needed language)
 * - Better admin filtering (search by translated fields)
 * - Smaller JSON payloads (optional: send only current language)
 *
 * BACKWARD COMPATIBILITY:
 * - Old JSON columns stay intact during migration
 * - Backend constructs same JSON response format
 * - Frontend sees no changes (uses translationUtils.js)
 * - JSON columns dropped in separate cleanup migration
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🔄 Creating normalized translation and SEO tables...\n');

    // ========================================
    // ENTITY TRANSLATION TABLES
    // ========================================

    // 1. Product Translations
    console.log('📦 Creating product_translations table...');
    await queryInterface.createTable('product_translations', {
      product_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'products',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      language_code: {
        type: Sequelize.STRING(10),
        allowNull: false,
        references: {
          model: 'languages',
          key: 'code'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      short_description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addConstraint('product_translations', {
      fields: ['product_id', 'language_code'],
      type: 'primary key',
      name: 'product_translations_pkey'
    });

    // Full-text search index for product names
    await queryInterface.sequelize.query(`
      CREATE INDEX product_translations_name_search_idx
      ON product_translations
      USING GIN (to_tsvector('english', name));
    `);

    // 2. Category Translations
    console.log('📁 Creating category_translations table...');
    await queryInterface.createTable('category_translations', {
      category_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'categories',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      language_code: {
        type: Sequelize.STRING(10),
        allowNull: false,
        references: {
          model: 'languages',
          key: 'code'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addConstraint('category_translations', {
      fields: ['category_id', 'language_code'],
      type: 'primary key',
      name: 'category_translations_pkey'
    });

    await queryInterface.sequelize.query(`
      CREATE INDEX category_translations_name_search_idx
      ON category_translations
      USING GIN (to_tsvector('english', name));
    `);

    // 3. CMS Page Translations
    console.log('📄 Creating cms_page_translations table...');
    await queryInterface.createTable('cms_page_translations', {
      cms_page_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'cms_pages',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      language_code: {
        type: Sequelize.STRING(10),
        allowNull: false,
        references: {
          model: 'languages',
          key: 'code'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      title: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      content: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      excerpt: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addConstraint('cms_page_translations', {
      fields: ['cms_page_id', 'language_code'],
      type: 'primary key',
      name: 'cms_page_translations_pkey'
    });

    await queryInterface.sequelize.query(`
      CREATE INDEX cms_page_translations_title_search_idx
      ON cms_page_translations
      USING GIN (to_tsvector('english', title));
    `);

    // 4. Attribute Translations
    console.log('🏷️  Creating attribute_translations table...');
    await queryInterface.createTable('attribute_translations', {
      attribute_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'attributes',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      language_code: {
        type: Sequelize.STRING(10),
        allowNull: false,
        references: {
          model: 'languages',
          key: 'code'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      label: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addConstraint('attribute_translations', {
      fields: ['attribute_id', 'language_code'],
      type: 'primary key',
      name: 'attribute_translations_pkey'
    });

    // 5. Attribute Value Translations
    console.log('🎨 Creating attribute_value_translations table...');
    await queryInterface.createTable('attribute_value_translations', {
      attribute_value_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'attribute_values',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      language_code: {
        type: Sequelize.STRING(10),
        allowNull: false,
        references: {
          model: 'languages',
          key: 'code'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      value: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addConstraint('attribute_value_translations', {
      fields: ['attribute_value_id', 'language_code'],
      type: 'primary key',
      name: 'attribute_value_translations_pkey'
    });

    // 6. CMS Block Translations
    console.log('🧱 Creating cms_block_translations table...');
    await queryInterface.createTable('cms_block_translations', {
      cms_block_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'cms_blocks',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      language_code: {
        type: Sequelize.STRING(10),
        allowNull: false,
        references: {
          model: 'languages',
          key: 'code'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      title: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      content: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addConstraint('cms_block_translations', {
      fields: ['cms_block_id', 'language_code'],
      type: 'primary key',
      name: 'cms_block_translations_pkey'
    });

    // 7. Product Tab Translations
    console.log('📑 Creating product_tab_translations table...');
    await queryInterface.createTable('product_tab_translations', {
      product_tab_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'product_tabs',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      language_code: {
        type: Sequelize.STRING(10),
        allowNull: false,
        references: {
          model: 'languages',
          key: 'code'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      content: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addConstraint('product_tab_translations', {
      fields: ['product_tab_id', 'language_code'],
      type: 'primary key',
      name: 'product_tab_translations_pkey'
    });

    // 8. Product Label Translations
    console.log('🏷️  Creating product_label_translations table...');
    await queryInterface.createTable('product_label_translations', {
      product_label_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'product_labels',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      language_code: {
        type: Sequelize.STRING(10),
        allowNull: false,
        references: {
          model: 'languages',
          key: 'code'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      text: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addConstraint('product_label_translations', {
      fields: ['product_label_id', 'language_code'],
      type: 'primary key',
      name: 'product_label_translations_pkey'
    });

    // 9. Coupon Translations
    console.log('🎟️  Creating coupon_translations table...');
    await queryInterface.createTable('coupon_translations', {
      coupon_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'coupons',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      language_code: {
        type: Sequelize.STRING(10),
        allowNull: false,
        references: {
          model: 'languages',
          key: 'code'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addConstraint('coupon_translations', {
      fields: ['coupon_id', 'language_code'],
      type: 'primary key',
      name: 'coupon_translations_pkey'
    });

    // 10. Shipping Method Translations
    console.log('🚚 Creating shipping_method_translations table...');
    await queryInterface.createTable('shipping_method_translations', {
      shipping_method_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'shipping_methods',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      language_code: {
        type: Sequelize.STRING(10),
        allowNull: false,
        references: {
          model: 'languages',
          key: 'code'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addConstraint('shipping_method_translations', {
      fields: ['shipping_method_id', 'language_code'],
      type: 'primary key',
      name: 'shipping_method_translations_pkey'
    });

    // 11. Payment Method Translations
    console.log('💳 Creating payment_method_translations table...');
    await queryInterface.createTable('payment_method_translations', {
      payment_method_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'payment_methods',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      language_code: {
        type: Sequelize.STRING(10),
        allowNull: false,
        references: {
          model: 'languages',
          key: 'code'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addConstraint('payment_method_translations', {
      fields: ['payment_method_id', 'language_code'],
      type: 'primary key',
      name: 'payment_method_translations_pkey'
    });

    // 12. Cookie Consent Settings Translations
    console.log('🍪 Creating cookie_consent_settings_translations table...');
    await queryInterface.createTable('cookie_consent_settings_translations', {
      settings_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'cookie_consent_settings',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      language_code: {
        type: Sequelize.STRING(10),
        allowNull: false,
        references: {
          model: 'languages',
          key: 'code'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      banner_text: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      accept_button_text: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      reject_button_text: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      settings_button_text: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      privacy_policy_text: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addConstraint('cookie_consent_settings_translations', {
      fields: ['settings_id', 'language_code'],
      type: 'primary key',
      name: 'cookie_consent_settings_translations_pkey'
    });

    // ========================================
    // SEO METADATA TABLES
    // ========================================

    // 1. Product SEO
    console.log('🔍 Creating product_seo table...');
    await queryInterface.createTable('product_seo', {
      product_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'products',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      language_code: {
        type: Sequelize.STRING(10),
        allowNull: false,
        references: {
          model: 'languages',
          key: 'code'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      meta_title: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      meta_description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      meta_keywords: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      meta_robots_tag: {
        type: Sequelize.STRING(100),
        allowNull: true,
        defaultValue: 'index, follow'
      },
      og_title: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      og_description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      og_image_url: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      twitter_title: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      twitter_description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      twitter_image_url: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      canonical_url: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addConstraint('product_seo', {
      fields: ['product_id', 'language_code'],
      type: 'primary key',
      name: 'product_seo_pkey'
    });

    // 2. Category SEO
    console.log('🔍 Creating category_seo table...');
    await queryInterface.createTable('category_seo', {
      category_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'categories',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      language_code: {
        type: Sequelize.STRING(10),
        allowNull: false,
        references: {
          model: 'languages',
          key: 'code'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      meta_title: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      meta_description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      meta_keywords: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      meta_robots_tag: {
        type: Sequelize.STRING(100),
        allowNull: true,
        defaultValue: 'index, follow'
      },
      og_title: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      og_description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      og_image_url: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      twitter_title: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      twitter_description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      twitter_image_url: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      canonical_url: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addConstraint('category_seo', {
      fields: ['category_id', 'language_code'],
      type: 'primary key',
      name: 'category_seo_pkey'
    });

    // 3. CMS Page SEO
    console.log('🔍 Creating cms_page_seo table...');
    await queryInterface.createTable('cms_page_seo', {
      cms_page_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'cms_pages',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      language_code: {
        type: Sequelize.STRING(10),
        allowNull: false,
        references: {
          model: 'languages',
          key: 'code'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      meta_title: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      meta_description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      meta_keywords: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      meta_robots_tag: {
        type: Sequelize.STRING(100),
        allowNull: true,
        defaultValue: 'index, follow'
      },
      og_title: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      og_description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      og_image_url: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      twitter_title: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      twitter_description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      twitter_image_url: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      canonical_url: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addConstraint('cms_page_seo', {
      fields: ['cms_page_id', 'language_code'],
      type: 'primary key',
      name: 'cms_page_seo_pkey'
    });

    console.log('\n✅ All normalized translation and SEO tables created successfully!');
    console.log('\n📊 Summary:');
    console.log('   - 12 entity translation tables created');
    console.log('   - 3 SEO metadata tables created');
    console.log('   - Full-text search indexes added for key fields');
    console.log('   - All foreign keys and constraints configured');
    console.log('\n💡 Next step: Run data migration to copy JSON → normalized tables\n');
  },

  down: async (queryInterface, Sequelize) => {
    console.log('⚠️  Rolling back normalized translation and SEO tables...\n');

    // Drop all tables in reverse order (SEO first, then translations)
    const tables = [
      'cms_page_seo',
      'category_seo',
      'product_seo',
      'cookie_consent_settings_translations',
      'payment_method_translations',
      'shipping_method_translations',
      'coupon_translations',
      'product_label_translations',
      'product_tab_translations',
      'cms_block_translations',
      'attribute_value_translations',
      'attribute_translations',
      'cms_page_translations',
      'category_translations',
      'product_translations'
    ];

    for (const table of tables) {
      console.log(`Dropping ${table}...`);
      await queryInterface.dropTable(table);
    }

    console.log('\n✅ All normalized tables dropped successfully');
  }
};
