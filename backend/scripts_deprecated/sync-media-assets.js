/**
 * Script to sync existing files from Supabase storage to media_assets table
 * This ensures all uploaded files are properly tracked in the database
 */

const { MediaAsset } = require('../src/models');
const supabaseIntegration = require('../src/services/supabase-integration');
const supabaseStorage = require('../src/services/supabase-storage');

async function syncMediaAssets(storeId) {
  console.log('🔄 Starting media assets synchronization...');
  console.log(`Store ID: ${storeId}`);
  
  try {
    // Check if Supabase is connected
    const connectionStatus = await supabaseIntegration.getConnectionStatus(storeId);
    if (!connectionStatus.connected) {
      console.error('❌ Supabase is not connected for this store');
      return;
    }
    
    console.log('✅ Supabase connection verified');
    
    // Get all files from Supabase storage
    console.log('\n📂 Fetching files from Supabase storage...');
    
    // Sync library files
    console.log('\n📚 Syncing library files...');
    const libraryResult = await supabaseStorage.listImages(storeId, 'library');
    if (libraryResult.success && libraryResult.files) {
      await syncFilesToDatabase(storeId, libraryResult.files, 'library');
    }
    
    // Sync category files
    console.log('\n🏷️ Syncing category files...');
    const categoryResult = await supabaseStorage.listImages(storeId, 'category');
    if (categoryResult.success && categoryResult.files) {
      await syncFilesToDatabase(storeId, categoryResult.files, 'category');
    }
    
    // Sync product files
    console.log('\n📦 Syncing product files...');
    const productResult = await supabaseStorage.listImages(storeId, 'product');
    if (productResult.success && productResult.files) {
      await syncFilesToDatabase(storeId, productResult.files, 'product');
    }
    
    // Get final count
    const totalAssets = await MediaAsset.count({
      where: { store_id: storeId }
    });
    
    console.log('\n✅ Synchronization complete!');
    console.log(`📊 Total media assets in database: ${totalAssets}`);
    
    // Show breakdown by folder
    const folderCounts = await MediaAsset.findAll({
      where: { store_id: storeId },
      attributes: [
        'folder',
        [MediaAsset.sequelize.fn('COUNT', MediaAsset.sequelize.col('id')), 'count']
      ],
      group: ['folder'],
      raw: true
    });
    
    console.log('\n📊 Files by folder:');
    folderCounts.forEach(fc => {
      console.log(`   ${fc.folder}: ${fc.count} files`);
    });
    
  } catch (error) {
    console.error('❌ Sync failed:', error.message);
    console.error(error.stack);
  }
}

async function syncFilesToDatabase(storeId, files, folder) {
  let synced = 0;
  let skipped = 0;
  let failed = 0;
  
  for (const file of files) {
    try {
      // Check if file already exists in database
      const existing = await MediaAsset.findOne({
        where: {
          store_id: storeId,
          file_path: file.fullPath || file.name
        }
      });
      
      if (existing) {
        // Update folder if different
        if (existing.folder !== folder) {
          existing.folder = folder;
          await existing.save();
          console.log(`   ✓ Updated folder for: ${file.name}`);
          synced++;
        } else {
          skipped++;
        }
      } else {
        // Create new media asset record
        await MediaAsset.create({
          store_id: storeId,
          file_name: file.name,
          original_name: file.name,
          file_path: file.fullPath || file.name,
          file_url: file.url || file.publicUrl,
          mime_type: file.mimetype || file.metadata?.mimetype || 'application/octet-stream',
          file_size: file.size || file.metadata?.size || 0,
          folder: folder,
          metadata: {
            bucket: file.bucket || determineBucketFromFolder(folder),
            provider: 'supabase',
            synced_from_storage: true,
            synced_at: new Date()
          }
        });
        console.log(`   ✓ Synced: ${file.name}`);
        synced++;
      }
    } catch (err) {
      console.error(`   ✗ Failed to sync ${file.name}:`, err.message);
      failed++;
    }
  }
  
  console.log(`   📊 Results: ${synced} synced, ${skipped} skipped, ${failed} failed`);
  return { synced, skipped, failed };
}

function determineBucketFromFolder(folder) {
  if (folder === 'library') {
    return 'suprshop-assets';
  } else if (folder === 'category' || folder === 'product') {
    return 'suprshop-catalog';
  }
  return 'suprshop-assets'; // default
}

// Run the sync if called directly
if (require.main === module) {
  const storeId = process.argv[2] || process.env.STORE_ID;
  
  if (!storeId) {
    console.error('❌ Please provide a store ID');
    console.log('Usage: node sync-media-assets.js <store-id>');
    console.log('Or set STORE_ID environment variable');
    process.exit(1);
  }
  
  syncMediaAssets(storeId)
    .then(() => {
      console.log('\n🎉 Media assets sync completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Media assets sync failed:', error);
      process.exit(1);
    });
}

module.exports = { syncMediaAssets };