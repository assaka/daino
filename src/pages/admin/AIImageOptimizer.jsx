import React, { useState, useEffect, useMemo } from 'react';
import { Wand2, Image, Package, FolderOpen, Search, Filter, Loader2, AlertCircle, ImagePlus } from 'lucide-react';
import { useStoreSelection } from '@/contexts/StoreSelectionContext';
import { Product, Category } from '@/api/entities';
import apiClient from '@/api/client';
import { ImageOptimizerModal } from '@/components/image-optimizer';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import FlashMessage from '@/components/storefront/FlashMessage';
import { cn } from '@/lib/utils';
import { getProductName, getCategoryName } from '@/utils/translationUtils';

const AIImageOptimizer = () => {
  const { getSelectedStoreId } = useStoreSelection();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [libraryFiles, setLibraryFiles] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all'); // all, products, categories, library
  const [flashMessage, setFlashMessage] = useState(null);

  // Optimizer modal state
  const [optimizerOpen, setOptimizerOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedContext, setSelectedContext] = useState(null);
  const [generateMode, setGenerateMode] = useState(false);

  // Load products, categories, and library files
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const storeId = getSelectedStoreId();

        // Load products and categories from database
        const [productsResult, categoriesData] = await Promise.all([
          Product.findPaginated(1, 500, { store_id: storeId }),
          Category.filter({ store_id: storeId })
        ]);

        // findPaginated returns { data: [...], pagination: {...} }
        const productsData = productsResult?.data || productsResult || [];
        setProducts(Array.isArray(productsData) ? productsData : []);
        setCategories(Array.isArray(categoriesData) ? categoriesData : []);

        // Load library files from unified storage API (works with any provider)
        try {
          const storageResponse = await apiClient.get('/storage/list');
          // Unified endpoint returns { success, data: { files, total, provider } }
          const files = storageResponse.data?.files || storageResponse.files || [];
          if (files.length > 0) {
            // Filter only image files
            const imageFiles = files.filter(f =>
              (f.url || f.publicUrl) && (f.mimeType?.startsWith('image/') || f.metadata?.mimetype?.startsWith('image/') ||
                /\.(jpg|jpeg|png|gif|webp|avif)$/i.test(f.name || f.url || ''))
            ).map(f => ({
              id: f.id || f.name,
              file_url: f.url || f.publicUrl,
              file_name: f.name,
              mime_type: f.mimeType || f.metadata?.mimetype
            }));
            setLibraryFiles(imageFiles);
          }
        } catch (storageError) {
          console.warn('Failed to load storage files:', storageError);
          setLibraryFiles([]);
        }
      } catch (error) {
        console.error('Failed to load data:', error);
        setFlashMessage({ type: 'error', message: 'Failed to load data' });
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [getSelectedStoreId]);

  // Build grouped items (product/category with their images)
  const groupedItems = useMemo(() => {
    const items = [];

    // Add products with their images
    products.forEach(product => {
      const images = [];

      // Main image from media_assets
      if (product.media_assets?.length > 0) {
        product.media_assets.forEach((asset, idx) => {
          images.push({
            id: asset.id,
            url: asset.file_url,
            name: asset.file_name,
            isPrimary: idx === 0,
            assetId: asset.id
          });
        });
      }
      // Fallback to product_files
      else if (product.product_files?.length > 0) {
        product.product_files.filter(f => f.media_asset?.file_url).forEach((file, idx) => {
          images.push({
            id: file.id,
            url: file.media_asset.file_url,
            name: file.media_asset.file_name,
            isPrimary: file.is_primary || idx === 0,
            assetId: file.media_asset_id
          });
        });
      }
      // Fallback to images array
      else if (product.images?.length > 0) {
        product.images.forEach((img, idx) => {
          const url = typeof img === 'string' ? img : img.url;
          if (url) {
            images.push({
              id: `img-${idx}`,
              url: url,
              name: url.split('/').pop(),
              isPrimary: idx === 0
            });
          }
        });
      }

      const productCategory = categories.find(c => c.id === product.category_id);
      items.push({
        id: `product-${product.id}`,
        type: 'product',
        entityId: product.id,
        name: getProductName(product) || product.name || 'Unnamed Product',
        categoryName: productCategory ? getCategoryName(productCategory) : null,
        images: images,
        hasImages: images.length > 0
      });
    });

    // Add categories with their images
    categories.forEach(category => {
      const images = [];
      if (category.image_url) {
        images.push({
          id: `cat-img-${category.id}`,
          url: category.image_url,
          name: category.image_url.split('/').pop(),
          isPrimary: true,
          assetId: category.media_asset_id
        });
      }

      items.push({
        id: `category-${category.id}`,
        type: 'category',
        entityId: category.id,
        name: getCategoryName(category) || category.name || 'Unnamed Category',
        images: images,
        hasImages: images.length > 0
      });
    });

    // Add library files (grouped as "Library")
    if (libraryFiles.length > 0) {
      items.push({
        id: 'library',
        type: 'library',
        entityId: 'library',
        name: 'File Library',
        images: libraryFiles.map(file => ({
          id: file.id,
          url: file.file_url,
          name: file.file_name || file.file_url?.split('/').pop(),
          isPrimary: false,
          assetId: file.id
        })),
        hasImages: true
      });
    }

    return items;
  }, [products, categories, libraryFiles]);

  // Filter items
  const filteredItems = useMemo(() => {
    return groupedItems.filter(item => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!item.name?.toLowerCase().includes(query) &&
            !item.categoryName?.toLowerCase().includes(query)) {
          return false;
        }
      }

      // Type filter
      if (filterType === 'products' && item.type !== 'product') return false;
      if (filterType === 'categories' && item.type !== 'category') return false;
      if (filterType === 'library' && item.type !== 'library') return false;
      if (filterType === 'no-image' && item.hasImages) return false;
      if (filterType === 'with-image' && !item.hasImages) return false;

      return true;
    });
  }, [groupedItems, searchQuery, filterType]);

  // Stats
  const stats = useMemo(() => {
    const productImages = groupedItems.filter(i => i.type === 'product').reduce((sum, p) => sum + p.images.length, 0);
    const categoryImages = groupedItems.filter(i => i.type === 'category').reduce((sum, c) => sum + c.images.length, 0);
    const libraryImages = libraryFiles.length;
    const noImages = groupedItems.filter(i => !i.hasImages).length;
    return { productImages, categoryImages, libraryImages, noImages, total: productImages + categoryImages + libraryImages };
  }, [groupedItems, libraryFiles]);

  const handleImageClick = (item, image) => {
    setSelectedImage({
      url: image.url,
      name: image.name,
      folder: item.type,
      id: image.assetId
    });
    setSelectedContext({
      name: item.name,
      category: item.categoryName
    });
    setGenerateMode(false);
    setOptimizerOpen(true);
  };

  const handleOpenGenerator = () => {
    setSelectedImage(null);
    setSelectedContext(null);
    setGenerateMode(true);
    setOptimizerOpen(true);
  };

  const handleOptimizerClose = async () => {
    setOptimizerOpen(false);
    setSelectedImage(null);
    setSelectedContext(null);
    // Reload data to show updated images
    setLoading(true);
    try {
      const storeId = getSelectedStoreId();

      // Load products and categories from database
      const [productsResult, categoriesData] = await Promise.all([
        Product.findPaginated(1, 500, { store_id: storeId }),
        Category.filter({ store_id: storeId })
      ]);

      const productsData = productsResult?.data || productsResult || [];
      setProducts(Array.isArray(productsData) ? productsData : []);
      setCategories(Array.isArray(categoriesData) ? categoriesData : []);

      // Load library files from unified storage API (works with any provider)
      try {
        const storageResponse = await apiClient.get('/storage/list');
        // Unified endpoint returns { success, data: { files, total, provider } }
        const files = storageResponse.data?.files || storageResponse.files || [];
        if (files.length > 0) {
          const imageFiles = files.filter(f =>
            (f.url || f.publicUrl) && (f.mimeType?.startsWith('image/') || f.metadata?.mimetype?.startsWith('image/') ||
              /\.(jpg|jpeg|png|gif|webp|avif)$/i.test(f.name || f.url || ''))
          ).map(f => ({
            id: f.id || f.name,
            file_url: f.url || f.publicUrl,
            file_name: f.name,
            mime_type: f.mimeType || f.metadata?.mimetype
          }));
          setLibraryFiles(imageFiles);
        }
      } catch (storageError) {
        console.warn('Failed to load storage files:', storageError);
        setLibraryFiles([]);
      }
    } catch (error) {
      console.error('Failed to reload data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {flashMessage && (
        <FlashMessage
          message={flashMessage.message}
          type={flashMessage.type}
          onClose={() => setFlashMessage(null)}
        />
      )}

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Wand2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">AI Image Optimizer</h1>
              <p className="text-gray-600 text-sm">
                Click any image to enhance with AI - upscale, remove background, or stage in environments
              </p>
            </div>
          </div>
          <Button
            onClick={handleOpenGenerator}
            className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
          >
            <ImagePlus className="w-4 h-4 mr-2" />
            Generate AI Image
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 text-purple-600 mb-1">
            <Image className="w-4 h-4" />
            <span className="text-sm font-medium">Total Images</span>
          </div>
          <div className="text-2xl font-bold">{stats.total}</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 text-orange-600 mb-1">
            <Package className="w-4 h-4" />
            <span className="text-sm font-medium">Products</span>
          </div>
          <div className="text-2xl font-bold">{stats.productImages}</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 text-blue-600 mb-1">
            <FolderOpen className="w-4 h-4" />
            <span className="text-sm font-medium">Categories</span>
          </div>
          <div className="text-2xl font-bold">{stats.categoryImages}</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 text-green-600 mb-1">
            <Image className="w-4 h-4" />
            <span className="text-sm font-medium">Library</span>
          </div>
          <div className="text-2xl font-bold">{stats.libraryImages}</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm font-medium">Missing</span>
          </div>
          <div className="text-2xl font-bold">{stats.noImages}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search products or categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <div className="flex gap-1">
              {[
                { value: 'all', label: 'All' },
                { value: 'products', label: 'Products' },
                { value: 'categories', label: 'Categories' },
                { value: 'library', label: 'Library' },
                { value: 'no-image', label: 'No Image' }
              ].map(option => (
                <button
                  key={option.value}
                  onClick={() => setFilterType(option.value)}
                  className={cn(
                    "px-3 py-1.5 text-xs rounded-full transition-colors",
                    filterType === option.value
                      ? "bg-purple-100 text-purple-700"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Products/Categories with Images */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-20">
          <Image className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No items found</h3>
          <p className="text-gray-500">Try adjusting your filters or search query</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border divide-y">
          {filteredItems.map(item => (
            <div
              key={item.id}
              className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50"
            >
              {/* Type icon */}
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                item.type === 'product' ? "bg-orange-100" : item.type === 'category' ? "bg-blue-100" : "bg-green-100"
              )}>
                {item.type === 'product' ? (
                  <Package className="w-4 h-4 text-orange-600" />
                ) : item.type === 'category' ? (
                  <FolderOpen className="w-4 h-4 text-blue-600" />
                ) : (
                  <Image className="w-4 h-4 text-green-600" />
                )}
              </div>

              {/* Name */}
              <div className="w-48 flex-shrink-0">
                <p className="font-medium text-gray-900 truncate text-sm">{item.name}</p>
                {item.categoryName && (
                  <p className="text-xs text-gray-500 truncate">{item.categoryName}</p>
                )}
              </div>

              {/* Thumbnails */}
              <div className="flex-1 flex items-center gap-2 overflow-x-auto py-1">
                {item.images.length > 0 ? (
                  item.images.map((image, idx) => (
                    <div
                      key={image.id}
                      onClick={() => handleImageClick(item, image)}
                      className="group relative w-14 h-14 rounded-lg overflow-hidden bg-gray-100 cursor-pointer border-2 border-transparent hover:border-purple-400 transition-all flex-shrink-0"
                    >
                      <img
                        src={image.url}
                        alt={`${item.name} - ${idx + 1}`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      {/* Hover overlay */}
                      <div className="absolute inset-0 bg-purple-600/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Wand2 className="w-4 h-4 text-white" />
                      </div>
                    </div>
                  ))
                ) : (
                  <span className="text-sm text-gray-400">No images</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Optimizer Modal */}
      <ImageOptimizerModal
        isOpen={optimizerOpen}
        onClose={handleOptimizerClose}
        storeId={getSelectedStoreId()}
        fileToOptimize={selectedImage}
        selectedFiles={[]}
        productContext={selectedContext}
        defaultOperation={generateMode ? 'generate' : undefined}
        onOptimized={() => {
          // Just refresh data, don't close
        }}
        setFlashMessage={setFlashMessage}
      />
    </div>
  );
};

export default AIImageOptimizer;
