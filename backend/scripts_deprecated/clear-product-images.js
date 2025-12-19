const { sequelize } = require('../src/database/connection');
const { Product } = require('../src/models');

(async () => {
  try {
    console.log('🧹 Starting to clear all product images...');
    
    // Get all products with images
    const products = await Product.findAll({
      where: sequelize.where(
        sequelize.fn('JSON_ARRAY_LENGTH', sequelize.col('images')),
        '>',
        0
      )
    });
    
    console.log(`📊 Found ${products.length} products with images`);
    
    if (products.length === 0) {
      console.log('✅ No products with images found. Nothing to clear.');
      await sequelize.close();
      process.exit(0);
    }
    
    // Clear images for each product
    let clearedCount = 0;
    for (const product of products) {
      const imageCount = product.images ? product.images.length : 0;
      
      // Update product to have empty images array
      await Product.update(
        { images: [] },
        { where: { id: product.id } }
      );
      
      console.log(`  ✓ Cleared ${imageCount} images from product: ${product.name} (ID: ${product.id})`);
      clearedCount++;
    }
    
    console.log('');
    console.log('🎯 Summary:');
    console.log(`  - Products processed: ${clearedCount}`);
    console.log(`  - All product images have been cleared from the database`);
    console.log('');
    console.log('✅ Product images cleared successfully!');
    console.log('');
    console.log('Note: This only clears database references. Physical files in storage remain.');
    console.log('To also remove physical files, you would need to clear them from your storage provider.');
    
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error clearing product images:', error.message);
    console.error('Stack:', error.stack);
    await sequelize.close();
    process.exit(1);
  }
})();