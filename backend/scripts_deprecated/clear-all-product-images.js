const { sequelize } = require('../src/database/connection');

(async () => {
  try {
    console.log('🧹 Starting to clear ALL product images...');
    console.log('⚠️  WARNING: This will remove all image references from all products!');
    console.log('');
    
    // First, let's see how many products have images
    const [countResult] = await sequelize.query(`
      SELECT COUNT(*) as total_products,
             COUNT(CASE WHEN images IS NOT NULL AND images != '[]' THEN 1 END) as products_with_images
      FROM products
    `);
    
    const stats = countResult[0];
    console.log(`📊 Database statistics:`);
    console.log(`  - Total products: ${stats.total_products}`);
    console.log(`  - Products with images: ${stats.products_with_images}`);
    console.log('');
    
    if (stats.products_with_images === 0) {
      console.log('✅ No products have images. Nothing to clear.');
      await sequelize.close();
      process.exit(0);
    }
    
    // Get sample of products that will be affected
    const [sampleProducts] = await sequelize.query(`
      SELECT id, name, sku, 
             JSON_ARRAY_LENGTH(images) as image_count
      FROM products
      WHERE images IS NOT NULL AND images != '[]'
      LIMIT 5
    `);
    
    console.log('📋 Sample of products that will be affected:');
    sampleProducts.forEach(product => {
      console.log(`  - ${product.name} (SKU: ${product.sku}) - ${product.image_count} images`);
    });
    console.log('');
    
    console.log('🔄 Clearing all product images...');
    
    // Clear all product images
    const [updateResult] = await sequelize.query(`
      UPDATE products 
      SET images = '[]',
          updated_at = NOW()
      WHERE images IS NOT NULL AND images != '[]'
    `);
    
    console.log(`✅ Successfully cleared images from ${stats.products_with_images} products`);
    console.log('');
    console.log('🎯 Final Summary:');
    console.log(`  - Products processed: ${stats.products_with_images}`);
    console.log(`  - All product images have been cleared from the database`);
    console.log('');
    console.log('📝 Notes:');
    console.log('  - Database references have been cleared');
    console.log('  - Physical files in storage (Supabase/S3/etc) remain unchanged');
    console.log('  - To remove physical files, clear them from your storage provider');
    
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error clearing product images:', error.message);
    console.error('Stack:', error.stack);
    await sequelize.close();
    process.exit(1);
  }
})();