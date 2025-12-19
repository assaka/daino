const { sequelize } = require('../src/database/connection');

(async () => {
  try {
    console.log('🔍 Verifying product images status...');
    console.log('');
    
    // Check overall statistics
    const [stats] = await sequelize.query(`
      SELECT 
        COUNT(*) as total_products,
        COUNT(CASE WHEN images IS NULL THEN 1 END) as products_with_null_images,
        COUNT(CASE WHEN images::text = '[]' THEN 1 END) as products_with_empty_array,
        COUNT(CASE WHEN images IS NOT NULL AND images::text != '[]' THEN 1 END) as products_with_images
      FROM products
    `);
    
    const result = stats[0];
    
    console.log('📊 Product Images Statistics:');
    console.log(`  - Total products: ${result.total_products}`);
    console.log(`  - Products with NULL images: ${result.products_with_null_images}`);
    console.log(`  - Products with empty array []: ${result.products_with_empty_array}`);
    console.log(`  - Products WITH images: ${result.products_with_images}`);
    console.log('');
    
    if (result.products_with_images > 0) {
      // Show some products that still have images
      const [productsWithImages] = await sequelize.query(`
        SELECT id, name, sku, images
        FROM products
        WHERE images IS NOT NULL AND images::text != '[]'
        LIMIT 10
      `);
      
      console.log('⚠️  Found products that still have images:');
      productsWithImages.forEach(product => {
        let imageCount = 0;
        try {
          if (product.images && Array.isArray(product.images)) {
            imageCount = product.images.length;
          }
        } catch (e) {
          imageCount = 'unknown';
        }
        console.log(`  - ${product.name} (ID: ${product.id}, SKU: ${product.sku}) - ${imageCount} images`);
      });
    } else {
      console.log('✅ SUCCESS: All product images have been cleared!');
      console.log('   All products now have empty image arrays.');
    }
    
    console.log('');
    console.log('📝 Summary:');
    if (result.products_with_images === 0) {
      console.log('  ✅ Database is clean - no products have images');
    } else {
      console.log(`  ⚠️  ${result.products_with_images} products still have images`);
      console.log('  Run clear-product-images-simple.js to remove them');
    }
    
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error verifying product images:', error.message);
    await sequelize.close();
    process.exit(1);
  }
})();