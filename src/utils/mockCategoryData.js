/**
 * Mock category data generator for editor preview
 * Can optionally receive real filterableAttributes and storeSettings from StoreProvider to maintain uniform flow
 */

export const generateMockCategoryContext = (realFilterableAttributes = null, storeSettings = null) => {
  const brands = ['Apple', 'Samsung', 'Google', 'OnePlus', 'Sony', 'LG'];
  const colors = ['Black', 'White', 'Blue', 'Red', 'Silver', 'Gold'];
  const sizes = ['Small', 'Medium', 'Large', 'XL', 'XXL'];
  const materials = ['Cotton', 'Polyester', 'Leather', 'Metal', 'Plastic', 'Glass'];

  // Real working Unsplash product images
  const productImages = [
    'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop', // Headphones
    'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&fit=crop', // Watch
    'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=400&h=400&fit=crop', // Sunglasses
    'https://images.unsplash.com/photo-1560343090-f0409e92791a?w=400&h=400&fit=crop', // Camera
    'https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=400&h=400&fit=crop', // Sneakers
    'https://images.unsplash.com/photo-1585386959984-a4155224a1ad?w=400&h=400&fit=crop'  // Perfume bottle
  ];

  const sampleProducts = Array.from({ length: 6 }, (_, i) => {
    return {
      id: i + 1,
      name: `Sample Product ${i + 1}`,
      description: `Description for sample product ${i + 1}`,
      price: 99.99 + (i * 50),
      compare_price: i % 2 ? 99.99 + (i * 50) + 20 : null,
      images: [{ url: productImages[i], alt: `Sample Product ${i + 1}` }],
      stock_status: 'in_stock',
      rating: 4.0 + (i % 10) * 0.1,
      slug: `sample-product-${i + 1}`,
      attributes: {
        color: colors[i % colors.length],
        brand: brands[i % brands.length],
        size: sizes[i % sizes.length],
        material: materials[i % materials.length]
      }
    };
  });

  // Use real filterableAttributes from database if provided, otherwise use mock data
  const filterableAttributesToUse = realFilterableAttributes && realFilterableAttributes.length > 0
    ? realFilterableAttributes
    : [
        {
          code: 'color',
          name: 'Color',
          is_filterable: true,
          options: colors.map(color => ({ value: color, label: color }))
        },
        {
          code: 'brand',
          name: 'Brand',
          is_filterable: true,
          options: brands.map(brand => ({ value: brand, label: brand }))
        },
        {
          code: 'size',
          name: 'Size',
          is_filterable: true,
          options: sizes.map(size => ({ value: size, label: size }))
        },
        {
          code: 'material',
          name: 'Material',
          is_filterable: true,
          options: materials.map(material => ({ value: material, label: material }))
        }
      ];

  // Build filters object with proper structure for templates
  // Build attribute filters from filterableAttributes (same as storefront)
  const attributeFilters = filterableAttributesToUse.map(attr => {
    const attrCode = attr.code;

    // For mock data, create some sample options if not provided
    let options = attr.options || [];
    if (options.length === 0) {
      // Generate mock options based on attribute code
      const mockValues = {
        'brand': brands,
        'color': colors,
        'size': sizes,
        'material': materials
      };
      const values = mockValues[attrCode] || ['Option 1', 'Option 2', 'Option 3'];
      options = values.map(val => ({ value: val, label: val }));
    }

    return {
      code: attrCode,
      label: attr.label || attrCode,
      options: options.map(opt => ({
        value: opt.value,
        label: opt.label || opt.value,
        count: Math.floor(Math.random() * 10) + 1,
        active: false,
        attributeCode: attrCode
      }))
    };
  });

  const filters = {
    price: {
      min: 50,
      max: 500,
      selected: [50, 500],
      type: 'slider'
    },
    attributes: attributeFilters
  };

  // Pagination data
  const totalProducts = sampleProducts.length;
  const productsPerPage = 12;
  const currentPage = 1;
  const totalPages = Math.ceil(totalProducts / productsPerPage);
  const startIndex = (currentPage - 1) * productsPerPage;
  const endIndex = Math.min(startIndex + productsPerPage, totalProducts);

  const pagination = {
    start: startIndex + 1,
    end: endIndex,
    total: totalProducts,
    currentPage,
    totalPages,
    perPage: productsPerPage,
    hasPrev: currentPage > 1,
    hasNext: currentPage < totalPages,
    prevPage: currentPage - 1,
    nextPage: currentPage + 1,
    pages: Array.from({ length: Math.min(totalPages, 5) }, (_, i) => ({
      number: i + 1,
      isCurrent: i + 1 === currentPage,
      isEllipsis: false
    }))
  };

  return {
    category: {
      id: 1,
      name: 'Sample Category',
      description: 'This is a sample category for the editor preview',
      slug: 'sample-category',
      image_url: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&h=400&fit=crop'
    },
    products: sampleProducts,
    allProducts: sampleProducts,
    filters,
    filterableAttributes: filterableAttributesToUse,
    pagination,
    sortOption: 'default',
    currentPage: 1,
    totalPages: 1,
    subcategories: [],
    breadcrumbs: [
      { name: 'Home', url: '/' },
      { name: 'Sample Category', url: '/sample' }
    ],
    selectedFilters: {},
    settings: {
      currency_symbol: '🔴19',
      ...(storeSettings || {}),
      // Ensure theme is explicitly preserved if it exists in storeSettings
      theme: storeSettings?.theme || {}
    },
    store: { id: 1, name: 'Demo Store', code: 'demo' },
    productLabels: [
      {
        id: 'new',
        name: 'New',
        text: 'New',
        background_color: '#10B981',
        color: '#FFFFFF',
        text_color: '#FFFFFF',
        position: 'top-left',
        priority: 1,
        conditions: {
          product_ids: [1, 3]  // Products 1 and 3 get "New" label
        }
      },
      {
        id: 'sale',
        name: 'Sale',
        text: 'Sale',
        background_color: '#EF4444',
        color: '#FFFFFF',
        text_color: '#FFFFFF',
        position: 'top-left',
        priority: 2,
        conditions: {
          product_ids: [2]  // Product 2 gets "Sale" label
        }
      },
      {
        id: 'bestseller',
        name: 'Bestseller',
        text: 'Bestseller',
        background_color: '#F59E0B',
        color: '#FFFFFF',
        text_color: '#FFFFFF',
        position: 'top-right',
        priority: 1,
        conditions: {
          product_ids: [1, 4]  // Products 1 and 4 get "Bestseller" label
        }
      }
    ],
    handleFilterChange: () => {},
    handleSortChange: () => {},
    handlePageChange: () => {},
    clearFilters: () => {},
    formatDisplayPrice: (price) => `¥${price}`, // Mock data - uses fixed symbol for editor preview
    getProductImageUrl: (product) => {
      const img = product?.images?.[0];
      if (!img) return '/placeholder-product.jpg';
      if (typeof img === 'string') return img;
      return img.url || '/placeholder-product.jpg';
    },
    navigate: () => {},
    onProductClick: () => {}
  };
};