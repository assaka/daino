import React, { useState, useEffect, useMemo } from 'react';
import { Wand2, Image, Package, FolderOpen, Search, Loader2, Filter } from 'lucide-react';
import { useStoreSelection } from '@/contexts/StoreSelectionContext';
import { Product, Category } from '@/api/entities';
import apiClient from '@/api/client';
import { ImageOptimizerModal } from '@/components/image-optimizer';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { getProductName, getCategoryName } from '@/utils/translationUtils';

/**
 * AIImageOptimizerGrid - Reusable grid component for AI image optimization
 *
 * Props:
 * - filterType: 'products' | 'categories' | 'library' | 'all' - Which items to show
 * - products: array - Optional pre-loaded products (if not provided, will load)
 * - categories: array - Optional pre-loaded categories (if not provided, will load)
 * - onRefresh: function - Called after optimization to refresh parent data
 * - showSearch: boolean - Whether to show search input (default: true)
 * - showFilterBadges: boolean - Whether to show filter badges when filterType is 'all' (default: true)
 * - compact: boolean - Use compact layout (default: false)
 */
const AIImageOptimizerGrid = ({
  filterType = 'all',
  products: externalProducts,
  categories: externalCategories,
  onRefresh,
  showSearch = true,
  showFilterBadges = true,
  compact = false
}) => {
  const { getSelectedStoreId } = useStoreSelection();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [libraryFiles, setLibraryFiles] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [flashMessage, setFlashMessage] = useState(null);

  // Local filter for 'all' mode
  const [activeFilter, setActiveFilter] = useState('all');

  // Optimizer modal state
  const [optimizerOpen, setOptimizerOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedContext, setSelectedContext] = useState(null);

  // Load data based on filterType
  useEffect(() => {
    const loadData = async () => {
      // Use external data if provided
      if (filterType === 'products' && externalProducts) {
        setProducts(externalProducts);
        setCategories(externalCategories || []);
        setLoading(false);
        return;
      }
      if (filterType === 'categories' && externalCategories) {
        setCategories(externalCategories);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const storeId = getSelectedStoreId();
        const promises = [];

        // Only load what we need based on filterType
        if (filterType === 'all' || filterType === 'products') {
          promises.push(Product.findPaginated(1, 500, { store_id: storeId }));
        } else {
          promises.push(Promise.resolve(null));
        }

        if (filterType === 'all' || filterType === 'categories' || filterType === 'products') {
          // Request all categories (high limit to get subcategories too)
          promises.push(Category.filter({ store_id: storeId, limit: 1000 }));
        } else {
          promises.push(Promise.resolve(null));
        }

        if (filterType === 'all' || filterType === 'library') {
          promises.push(
            apiClient.get('/storage/media-assets?folder=library').then(response => {
              const files = response.files || [];
              return files.filter(f => {
                const url = f.url;
                const mimeType = f.mimeType || '';
                return url && (mimeType.startsWith('image/') ||
                  /\.(jpg|jpeg|png|gif|webp|avif)$/i.test(f.name || url));
              }).map(f => ({
                id: f.id,
                file_url: f.url,
                file_name: f.name,
                mime_type: f.mimeType
              }));
            })
          );
        } else {
          promises.push(Promise.resolve(null));
        }

        const [productsResult, categoriesData, libraryData] = await Promise.all(promises);

        if (productsResult) {
          const productsData = productsResult?.data || productsResult || [];
          setProducts(Array.isArray(productsData) ? productsData : []);
        }
        if (categoriesData) {
          setCategories(Array.isArray(categoriesData) ? categoriesData : []);
        }
        if (libraryData) {
          const imageFiles = (Array.isArray(libraryData) ? libraryData : []).filter(f =>
            f.file_url && (f.mime_type?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|avif)$/i.test(f.file_url))
          );
          setLibraryFiles(imageFiles);
        }
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [getSelectedStoreId, filterType, externalProducts, externalCategories]);

  // Effective filter (use activeFilter when filterType is 'all')
  const effectiveFilter = filterType === 'all' ? activeFilter : filterType;

  // Build grouped items
  const groupedItems = useMemo(() => {
    const items = [];

    // Add products with their images
    if (effectiveFilter === 'all' || effectiveFilter === 'products') {
      products.forEach(product => {
        const images = [];

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
        } else if (product.product_files?.length > 0) {
          product.product_files.filter(f => f.media_asset?.file_url).forEach((file, idx) => {
            images.push({
              id: file.id,
              url: file.media_asset.file_url,
              name: file.media_asset.file_name,
              isPrimary: file.is_primary || idx === 0,
              assetId: file.media_asset_id
            });
          });
        } else if (product.images?.length > 0) {
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

        if (images.length > 0) {
          const productCategory = categories.find(c => c.id === product.category_id);
          items.push({
            id: `product-${product.id}`,
            type: 'product',
            entityId: product.id,
            name: getProductName(product) || product.name || 'Unnamed Product',
            categoryName: productCategory ? getCategoryName(productCategory) : null,
            images: images
          });
        }
      });
    }

    // Add categories with their images
    if (effectiveFilter === 'all' || effectiveFilter === 'categories') {
      categories.forEach(category => {
        if (category.image_url) {
          items.push({
            id: `category-${category.id}`,
            type: 'category',
            entityId: category.id,
            name: getCategoryName(category) || category.name || 'Unnamed Category',
            images: [{
              id: `cat-img-${category.id}`,
              url: category.image_url,
              name: category.image_url.split('/').pop(),
              isPrimary: true,
              assetId: category.media_asset_id
            }]
          });
        }
      });
    }

    // Add library files
    if (effectiveFilter === 'all' || effectiveFilter === 'library') {
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
          }))
        });
      }
    }

    return items;
  }, [products, categories, libraryFiles, effectiveFilter]);

  // Filter items by search
  const filteredItems = useMemo(() => {
    if (!searchQuery) return groupedItems;
    const query = searchQuery.toLowerCase();
    return groupedItems.filter(item =>
      item.name?.toLowerCase().includes(query) ||
      item.categoryName?.toLowerCase().includes(query)
    );
  }, [groupedItems, searchQuery]);

  // Stats
  const totalImages = useMemo(() => {
    return filteredItems.reduce((sum, item) => sum + item.images.length, 0);
  }, [filteredItems]);

  const handleImageClick = (item, image) => {
    setSelectedImage({
      url: image.url,
      name: image.name,
      folder: item.type,
      id: image.assetId
    });
    // For library files, use the file name; for products/categories use item name
    const contextName = item.type === 'library'
      ? (image.name?.replace(/\.[^/.]+$/, '') || 'Image') // Remove file extension
      : item.name;
    setSelectedContext({
      name: contextName,
      category: item.categoryName
    });
    setOptimizerOpen(true);
  };

  const handleOptimizerClose = async () => {
    setOptimizerOpen(false);
    setSelectedImage(null);
    setSelectedContext(null);

    // Reload data
    if (onRefresh) {
      onRefresh();
    } else {
      setLoading(true);
      try {
        const storeId = getSelectedStoreId();
        const [productsResult, categoriesData, libraryData] = await Promise.all([
          filterType === 'all' || filterType === 'products'
            ? Product.findPaginated(1, 500, { store_id: storeId })
            : Promise.resolve(null),
          filterType === 'all' || filterType === 'categories' || filterType === 'products'
            ? Category.filter({ store_id: storeId })
            : Promise.resolve(null),
          filterType === 'all' || filterType === 'library'
            ? apiClient.get('/storage/media-assets?folder=library').then(response => {
                const files = response.files || [];
                return files.filter(f => {
                  const url = f.url;
                  const mimeType = f.mimeType || '';
                  return url && (mimeType.startsWith('image/') ||
                    /\.(jpg|jpeg|png|gif|webp|avif)$/i.test(f.name || url));
                }).map(f => ({
                  id: f.id,
                  file_url: f.url,
                  file_name: f.name,
                  mime_type: f.mimeType
                }));
              })
            : Promise.resolve(null)
        ]);
        if (productsResult) {
          const productsData = productsResult?.data || productsResult || [];
          setProducts(Array.isArray(productsData) ? productsData : []);
        }
        if (categoriesData) {
          setCategories(Array.isArray(categoriesData) ? categoriesData : []);
        }
        if (libraryData) {
          setLibraryFiles(Array.isArray(libraryData) ? libraryData : []);
        }
      } catch (error) {
        console.error('Failed to reload data:', error);
      } finally {
        setLoading(false);
      }
    }
  };

  // Count stats for filter badges (calculate before early returns)
  const productCount = products.filter(p =>
    (p.media_assets?.length > 0) || (p.product_files?.length > 0) || (p.images?.length > 0)
  ).length;
  const categoryCount = categories.filter(c => c.image_url).length;
  const libraryCount = libraryFiles.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div>
      {/* Header with stats, filter badges, and search */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Wand2 className="w-4 h-4 text-purple-600" />
          <span className="font-medium">{totalImages} images</span>
          <span className="text-gray-400">• Click to optimize</span>
        </div>

        {/* Filter badges - only show when filterType is 'all' */}
        {filterType === 'all' && showFilterBadges && (
          <div className="flex items-center gap-1">
            <Filter className="w-4 h-4 text-gray-400 mr-1" />
            {[
              { value: 'all', label: 'All' },
              { value: 'products', label: `Products (${productCount})`, icon: Package },
              { value: 'categories', label: `Categories (${categoryCount})`, icon: FolderOpen },
              { value: 'library', label: `Library (${libraryCount})`, icon: Image }
            ].map(option => (
              <button
                key={option.value}
                onClick={() => setActiveFilter(option.value)}
                className={cn(
                  "px-3 py-1.5 text-xs rounded-full transition-colors flex items-center gap-1",
                  activeFilter === option.value
                    ? "bg-purple-100 text-purple-700"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}
              >
                {option.icon && <option.icon className="w-3 h-3" />}
                {option.label}
              </button>
            ))}
          </div>
        )}

        {showSearch && (
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-8 text-sm"
            />
          </div>
        )}
      </div>

      {/* Grid */}
      {filteredItems.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border">
          <Image className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No images found</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border divide-y">
          {filteredItems.map(item => (
            <div
              key={item.id}
              className={cn(
                "flex items-center gap-4 px-4 hover:bg-gray-50",
                compact ? "py-2" : "py-3"
              )}
            >
              {/* Type icon */}
              <div className={cn(
                "rounded-lg flex items-center justify-center flex-shrink-0",
                compact ? "w-6 h-6" : "w-8 h-8",
                item.type === 'product' ? "bg-orange-100" : item.type === 'category' ? "bg-blue-100" : "bg-green-100"
              )}>
                {item.type === 'product' ? (
                  <Package className={cn(compact ? "w-3 h-3" : "w-4 h-4", "text-orange-600")} />
                ) : item.type === 'category' ? (
                  <FolderOpen className={cn(compact ? "w-3 h-3" : "w-4 h-4", "text-blue-600")} />
                ) : (
                  <Image className={cn(compact ? "w-3 h-3" : "w-4 h-4", "text-green-600")} />
                )}
              </div>

              {/* Name */}
              <div className={cn("flex-shrink-0", compact ? "w-36" : "w-48")}>
                <p className={cn("font-medium text-gray-900 truncate", compact ? "text-xs" : "text-sm")}>{item.name}</p>
                {item.categoryName && (
                  <p className="text-xs text-gray-500 truncate">{item.categoryName}</p>
                )}
              </div>

              {/* Thumbnails */}
              <div className="flex-1 flex items-center gap-2 overflow-x-auto py-1">
                {item.images.map((image, idx) => (
                  <div
                    key={image.id}
                    onClick={() => handleImageClick(item, image)}
                    className={cn(
                      "group relative rounded-lg overflow-hidden bg-gray-100 cursor-pointer border-2 border-transparent hover:border-purple-400 transition-all flex-shrink-0",
                      compact ? "w-10 h-10" : "w-14 h-14"
                    )}
                  >
                    <img
                      src={image.url}
                      alt={`${item.name} - ${idx + 1}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-purple-600/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Wand2 className={cn(compact ? "w-3 h-3" : "w-4 h-4", "text-white")} />
                    </div>
                  </div>
                ))}
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
        onOptimized={() => {}}
        setFlashMessage={setFlashMessage}
      />
    </div>
  );
};

export default AIImageOptimizerGrid;
