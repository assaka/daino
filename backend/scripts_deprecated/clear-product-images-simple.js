const { sequelize } = require('../src/database/connection');

(async () => {
  try {
    console.log('🧹 Starting to clear ALL product images...');
    console.log('⚠️  WARNING: This will remove all image references from all products!');
    console.log('');
    
    // Get count of products
    const [countResult] = await sequelize.query(`
      SELECT COUNT(*) as total_products,
             COUNT(CASE WHEN images IS NOT NULL AND images::text != '[]' AND images::text != '' THEN 1 END) as products_with_images
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
      SELECT id, name, sku, images
      FROM products
      WHERE images IS NOT NULL AND images::text != '[]' AND images::text != ''
      LIMIT 5
    `);
    
    console.log('📋 Sample of products that will be affected:');
    sampleProducts.forEach(product => {
      let imageCount = 0;
      try {
        if (product.images && typeof product.images === 'object') {
          imageCount = Array.isArray(product.images) ? product.images.length : 0;
        }
      } catch (e) {
        imageCount = 'unknown';
      }
      console.log(`  - ${product.name} (SKU: ${product.sku}) - ${imageCount} images`);
    });
    console.log('');
    
    console.log('🔄 Clearing all product images...');
    
    // Clear all product images - set to empty array
    const [updateResult] = await sequelize.query(`
      UPDATE products 
      SET images = '[]'::jsonb,
          updated_at = NOW()
      WHERE images IS NOT NULL AND images::text != '[]' AND images::text != ''
    `);
    
    // Get the affected row count
    const affectedRows = updateResult.rowCount || stats.products_with_images;
    
    console.log(`✅ Successfully cleared images from ${affectedRows} products`);
    console.log('');
    console.log('🎯 Final Summary:');
    console.log(`  - Products processed: ${affectedRows}`);
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