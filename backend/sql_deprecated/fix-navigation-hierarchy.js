#!/usr/bin/env node

const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false
});

// Define category headers with their order positions
const categoryHeaders = [
  { key: 'catalog', label: 'Catalog', icon: 'Package', order: 10 },
  { key: 'sales', label: 'Sales', icon: 'Receipt', order: 20 },
  { key: 'content', label: 'Content', icon: 'FileText', order: 30 },
  { key: 'marketing', label: 'Marketing', icon: 'Megaphone', order: 40 },
  { key: 'seo', label: 'SEO', icon: 'Search', order: 50 },
  { key: 'import_export', label: 'Import & Export', icon: 'Upload', order: 60 },
  { key: 'store', label: 'Store', icon: 'Store', order: 70 },
  { key: 'advanced', label: 'Advanced', icon: 'Settings', order: 80 }
];

async function fixNavigationHierarchy() {
  try {
    console.log('🔧 Fixing navigation hierarchy...\n');

    // Step 1: Create category headers
    console.log('📂 Creating category headers...');
    for (const category of categoryHeaders) {
      await sequelize.query(`
        INSERT INTO admin_navigation_registry
        (key, parent_key, label, icon, route, order_position, is_core, is_visible)
        VALUES ($1, NULL, $2, $3, NULL, $4, true, true)
        ON CONFLICT (key) DO UPDATE SET
          label = EXCLUDED.label,
          icon = EXCLUDED.icon,
          order_position = EXCLUDED.order_position,
          parent_key = NULL,
          route = NULL
      `, {
        bind: [category.key, category.label, category.icon, category.order]
      });
      console.log(`  ✅ Created/Updated: ${category.label}`);
    }

    // Step 2: Update all items to set their parent_key based on category field
    console.log('\n🔗 Updating parent_key for all navigation items...');

    const categoryMap = {
      'catalog': 'catalog',
      'sales': 'sales',
      'content': 'content',
      'marketing': 'marketing',
      'seo': 'seo',
      'import_export': 'import_export',
      'store': 'store',
      'advanced': 'advanced'
    };

    for (const [categoryValue, parentKey] of Object.entries(categoryMap)) {
      const [, metadata] = await sequelize.query(`
        UPDATE admin_navigation_registry
        SET parent_key = $1
        WHERE category = $2
          AND route IS NOT NULL
          AND key != $1
      `, {
        bind: [parentKey, categoryValue]
      });

      console.log(`  ✅ Updated ${metadata.rowCount || 0} items in ${categoryValue} category`);
    }

    // Step 3: Verify the results
    console.log('\n📊 Verification:');

    const [categories] = await sequelize.query(`
      SELECT key, label, parent_key, route
      FROM admin_navigation_registry
      WHERE parent_key IS NULL
      ORDER BY order_position
    `);

    console.log('\n  Main Categories:');
    categories.forEach(cat => {
      console.log(`    - ${cat.label} (key: ${cat.key})`);
    });

    const [stats] = await sequelize.query(`
      SELECT parent_key, COUNT(*) as count
      FROM admin_navigation_registry
      WHERE parent_key IS NOT NULL
      GROUP BY parent_key
      ORDER BY parent_key
    `);

    console.log('\n  Items per category:');
    stats.forEach(stat => {
      const category = categories.find(c => c.key === stat.parent_key);
      console.log(`    ${category?.label || stat.parent_key}: ${stat.count} items`);
    });

    console.log('\n✅ Navigation hierarchy fixed successfully!');

    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    await sequelize.close();
    process.exit(1);
  }
}

fixNavigationHierarchy();
