import React, { useState, useEffect, useMemo } from 'react';
import { Wand2, Sparkles, Image, Package, FolderOpen, Search, Filter, Grid, List, Loader2, AlertCircle } from 'lucide-react';
import { useStoreSelection } from '@/contexts/StoreSelectionContext';
import { Product, Category } from '@/api/entities';
import { ImageOptimizerModal } from '@/components/image-optimizer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import FlashMessage from '@/components/storefront/FlashMessage';
import { cn } from '@/lib/utils';

const AIImageOptimizer = () => {
  const { getSelectedStoreId } = useStoreSelection();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all'); // all, products, categories, no-image
  const [viewMode, setViewMode] = useState('grid'); // grid, list
  const [flashMessage, setFlashMessage] = useState(null);

  // Optimizer modal state
  const [optimizerOpen, setOptimizerOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedContext, setSelectedContext] = useState(null);

  // Load products and categories
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const storeId = getSelectedStoreId();
        const [productsData, categoriesData] = await Promise.all([
          Product.filter({ store_id: storeId, limit: 500 }),
          Category.filter({ store_id: storeId })
        ]);
        setProducts(Array.isArray(productsData) ? productsData : []);
        setCategories(Array.isArray(categoriesData) ? categoriesData : []);
      } catch (error) {
        console.error('Failed to load data:', error);
        setFlashMessage({ type: 'error', message: 'Failed to load products and categories' });
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [getSelectedStoreId]);

  // Build image items from products and categories
  const imageItems = useMemo(() => {
    const items = [];

    // Add product images
    products.forEach(product => {
      // Main image from media_assets
      if (product.media_assets?.length > 0) {
        product.media_assets.forEach((asset, idx) => {
          items.push({
            id: `product-${product.id}-asset-${asset.id}`,
            type: 'product',
            entityId: product.id,
            entityName: product.name,
            categoryName: categories.find(c => c.id === product.category_id)?.name,
            imageUrl: asset.file_url,
            imageName: asset.file_name,
            isPrimary: idx === 0,
            assetId: asset.id
          });
        });
      }
      // Fallback to product_files
      else if (product.product_files?.length > 0) {
        product.product_files.filter(f => f.media_asset?.file_url).forEach((file, idx) => {
          items.push({
            id: `product-${product.id}-file-${file.id}`,
            type: 'product',
            entityId: product.id,
            entityName: product.name,
            categoryName: categories.find(c => c.id === product.category_id)?.name,
            imageUrl: file.media_asset.file_url,
            imageName: file.media_asset.file_name,
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
            items.push({
              id: `product-${product.id}-img-${idx}`,
              type: 'product',
              entityId: product.id,
              entityName: product.name,
              categoryName: categories.find(c => c.id === product.category_id)?.name,
              imageUrl: url,
              imageName: url.split('/').pop(),
              isPrimary: idx === 0
            });
          }
        });
      }
      // Product with no images
      else {
        items.push({
          id: `product-${product.id}-noimg`,
          type: 'product',
          entityId: product.id,
          entityName: product.name,
          categoryName: categories.find(c => c.id === product.category_id)?.name,
          imageUrl: null,
          imageName: null,
          isPrimary: true,
          noImage: true
        });
      }
    });

    // Add category images
    categories.forEach(category => {
      if (category.image_url) {
        items.push({
          id: `category-${category.id}`,
          type: 'category',
          entityId: category.id,
          entityName: category.name || category.translations?.en?.name || 'Unnamed Category',
          imageUrl: category.image_url,
          imageName: category.image_url.split('/').pop(),
          isPrimary: true
        });
      } else {
        items.push({
          id: `category-${category.id}-noimg`,
          type: 'category',
          entityId: category.id,
          entityName: category.name || category.translations?.en?.name || 'Unnamed Category',
          imageUrl: null,
          imageName: null,
          isPrimary: true,
          noImage: true
        });
      }
    });

    return items;
  }, [products, categories]);

  // Filter items
  const filteredItems = useMemo(() => {
    return imageItems.filter(item => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!item.entityName?.toLowerCase().includes(query) &&
            !item.categoryName?.toLowerCase().includes(query)) {
          return false;
        }
      }

      // Type filter
      if (filterType === 'products' && item.type !== 'product') return false;
      if (filterType === 'categories' && item.type !== 'category') return false;
      if (filterType === 'no-image' && !item.noImage) return false;
      if (filterType === 'with-image' && item.noImage) return false;

      return true;
    });
  }, [imageItems, searchQuery, filterType]);

  // Stats
  const stats = useMemo(() => {
    const productImages = imageItems.filter(i => i.type === 'product' && !i.noImage).length;
    const categoryImages = imageItems.filter(i => i.type === 'category' && !i.noImage).length;
    const noImages = imageItems.filter(i => i.noImage).length;
    return { productImages, categoryImages, noImages, total: productImages + categoryImages };
  }, [imageItems]);

  const handleImageClick = (item) => {
    if (item.noImage) {
      setFlashMessage({ type: 'warning', message: 'This item has no image. Upload an image first.' });
      return;
    }

    setSelectedImage({
      url: item.imageUrl,
      name: item.imageName,
      folder: item.type,
      id: item.assetId
    });
    setSelectedContext({
      name: item.entityName,
      category: item.categoryName
    });
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
      const [productsData, categoriesData] = await Promise.all([
        Product.filter({ store_id: storeId, limit: 500 }),
        Category.filter({ store_id: storeId })
      ]);
      setProducts(Array.isArray(productsData) ? productsData : []);
      setCategories(Array.isArray(categoriesData) ? categoriesData : []);
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
        <div className="flex items-center gap-3 mb-2">
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
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
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
            <span className="text-sm font-medium">Product Images</span>
          </div>
          <div className="text-2xl font-bold">{stats.productImages}</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 text-blue-600 mb-1">
            <FolderOpen className="w-4 h-4" />
            <span className="text-sm font-medium">Category Images</span>
          </div>
          <div className="text-2xl font-bold">{stats.categoryImages}</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm font-medium">Missing Images</span>
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
                { value: 'with-image', label: 'With Image' },
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

          {/* View Mode */}
          <div className="flex gap-1 border rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                "p-1.5 rounded",
                viewMode === 'grid' ? "bg-gray-100" : "hover:bg-gray-50"
              )}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                "p-1.5 rounded",
                viewMode === 'list' ? "bg-gray-100" : "hover:bg-gray-50"
              )}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Image Grid/List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-20">
          <Image className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No images found</h3>
          <p className="text-gray-500">Try adjusting your filters or search query</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filteredItems.map(item => (
            <div
              key={item.id}
              onClick={() => handleImageClick(item)}
              className={cn(
                "group relative bg-white rounded-lg border overflow-hidden cursor-pointer transition-all hover:shadow-lg hover:border-purple-300",
                item.noImage && "opacity-60"
              )}
            >
              {/* Image */}
              <div className="aspect-square bg-gray-100 relative">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.entityName}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Image className="w-8 h-8 text-gray-300" />
                  </div>
                )}

                {/* Hover overlay */}
                {!item.noImage && (
                  <div className="absolute inset-0 bg-purple-600/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="text-center text-white">
                      <Wand2 className="w-8 h-8 mx-auto mb-2" />
                      <span className="text-sm font-medium">Optimize</span>
                    </div>
                  </div>
                )}

                {/* Type badge */}
                <div className={cn(
                  "absolute top-2 left-2 px-2 py-0.5 text-xs rounded-full",
                  item.type === 'product'
                    ? "bg-orange-100 text-orange-700"
                    : "bg-blue-100 text-blue-700"
                )}>
                  {item.type === 'product' ? 'Product' : 'Category'}
                </div>

                {/* Primary badge */}
                {item.isPrimary && !item.noImage && (
                  <div className="absolute top-2 right-2 px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">
                    Primary
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-2">
                <p className="text-sm font-medium text-gray-900 truncate">{item.entityName}</p>
                {item.categoryName && (
                  <p className="text-xs text-gray-500 truncate">{item.categoryName}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg border divide-y">
          {filteredItems.map(item => (
            <div
              key={item.id}
              onClick={() => handleImageClick(item)}
              className={cn(
                "flex items-center gap-4 p-4 cursor-pointer hover:bg-purple-50 transition-colors",
                item.noImage && "opacity-60"
              )}
            >
              {/* Thumbnail */}
              <div className="w-16 h-16 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.entityName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Image className="w-6 h-6 text-gray-300" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{item.entityName}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={cn(
                    "px-2 py-0.5 text-xs rounded-full",
                    item.type === 'product'
                      ? "bg-orange-100 text-orange-700"
                      : "bg-blue-100 text-blue-700"
                  )}>
                    {item.type === 'product' ? 'Product' : 'Category'}
                  </span>
                  {item.categoryName && (
                    <span className="text-xs text-gray-500">{item.categoryName}</span>
                  )}
                  {item.isPrimary && !item.noImage && (
                    <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">Primary</span>
                  )}
                </div>
              </div>

              {/* Action */}
              {!item.noImage && (
                <Button size="sm" variant="outline" className="gap-2">
                  <Wand2 className="w-4 h-4" />
                  Optimize
                </Button>
              )}
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
        onOptimized={() => {
          // Just refresh data, don't close
        }}
        setFlashMessage={setFlashMessage}
      />
    </div>
  );
};

export default AIImageOptimizer;
