// Mock product data generator for ProductSlotsEditor
export const generateMockProductContext = (storeSettings = null) => {
  return {
    product: {
      id: 1,
      name: 'Premium Wireless Headphones',
      slug: 'premium-wireless-headphones',
      sku: 'WH-1000XM4',
      price: 349.99,
      compare_price: 399.99,
      description: '<p>Experience exceptional sound quality with these premium wireless headphones featuring industry-leading noise cancellation technology. Perfect for music lovers and professionals alike.</p>',
      short_description: 'Premium wireless headphones with noise cancellation',
      stock_quantity: 15,
      infinite_stock: false,
      track_stock: true,
      status: 'active',
      images: [
        { url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&h=600&fit=crop', alt: 'Premium Wireless Headphones' },
        { url: 'https://images.unsplash.com/photo-1484704849700-f032a568e944?w=600&h=600&fit=crop', alt: 'Premium Wireless Headphones side view' },
        { url: 'https://images.unsplash.com/photo-1487215078519-e21cc028cb29?w=600&h=600&fit=crop', alt: 'Premium Wireless Headphones detail' }
      ],
      attributes: {
        brand: 'AudioTech',
        color: 'Midnight Black',
        connectivity: 'Bluetooth 5.0',
        battery_life: '30 hours',
        weight: '254g',
        warranty: '2 years'
      },
      category_ids: [1, 2],
      created_date: new Date('2024-01-15').toISOString(),
      updated_date: new Date().toISOString()
    },
    categories: [
      { id: 1, name: 'Electronics', slug: 'electronics' },
      { id: 2, name: 'Audio', slug: 'audio' }
    ],
    productTabs: [
      {
        id: 1,
        name: 'Description',
        tab_type: 'description',
        content: '<p>Experience exceptional sound quality with these premium wireless headphones featuring industry-leading noise cancellation technology.</p><ul><li>Active Noise Cancellation</li><li>30-hour battery life</li><li>Quick charging (3 hours in 10 minutes)</li><li>Premium comfort design</li></ul>',
        is_active: true,
        sort_order: 1
      },
      {
        id: 2,
        name: 'Specifications',
        tab_type: 'attributes',
        content: null,
        is_active: true,
        sort_order: 2
      },
      {
        id: 3,
        name: 'Reviews',
        tab_type: 'text',
        content: '<div class="reviews"><h4>Customer Reviews (4.8/5)</h4><p>Excellent sound quality and comfort. Highly recommended!</p></div>',
        is_active: true,
        sort_order: 3
      }
    ],
    customOptions: [
      {
        id: 1,
        name: 'Color',
        type: 'select',
        required: true,
        options: [
          { id: 1, name: 'Midnight Black', value: 'black', price: 0 },
          { id: 2, name: 'Silver', value: 'silver', price: 20 },
          { id: 3, name: 'Blue', value: 'blue', price: 20 }
        ]
      },
      {
        id: 2,
        name: 'Warranty Extension',
        type: 'select',
        required: false,
        options: [
          { id: 1, name: 'Standard (2 years)', value: 'standard', price: 0 },
          { id: 2, name: 'Extended (3 years)', value: 'extended', price: 49.99 },
          { id: 3, name: 'Premium (5 years)', value: 'premium', price: 99.99 }
        ]
      }
    ],
    relatedProducts: [
      {
        id: 2,
        name: 'Wireless Earbuds Pro',
        slug: 'wireless-earbuds-pro',
        price: 199.99,
        compare_price: 249.99,
        images: ['https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=300&h=300&fit=crop'],
        rating: 4.6,
        reviews_count: 234
      },
      {
        id: 3,
        name: 'Gaming Headset RGB',
        slug: 'gaming-headset-rgb',
        price: 129.99,
        images: ['https://images.unsplash.com/photo-1599669454699-248893623440?w=300&h=300&fit=crop'],
        rating: 4.3,
        reviews_count: 156
      },
      {
        id: 4,
        name: 'Studio Monitor Speakers',
        slug: 'studio-monitor-speakers',
        price: 299.99,
        compare_price: 349.99,
        images: ['https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=300&h=300&fit=crop'],
        rating: 4.7,
        reviews_count: 89
      },
      {
        id: 5,
        name: 'Portable Bluetooth Speaker',
        slug: 'portable-bluetooth-speaker',
        price: 79.99,
        images: ['https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=300&h=300&fit=crop'],
        rating: 4.4,
        reviews_count: 312
      }
    ],
    store: {
      id: 1,
      name: 'AudioTech Store',
      slug: 'audiotech-store',
      currency_code: 'USD',
      currency_symbol: '🔴17'
    },
    settings: {
      // Mock defaults
      currency_code: 'USD',
      currency_symbol: '🔴18',
      hide_currency_product: false,
      track_stock: true,
      hide_quantity_selector: false,
      product_gallery_layout: 'horizontal',
      vertical_gallery_position: 'left',
      stock_settings: {
        show_stock_label: true,
        in_stock_label: 'In Stock ({quantity} available)',
        out_of_stock_label: 'Out of Stock',
        low_stock_label: 'Only {quantity} left!'
      },
      theme: {
        // Use same default as storefront (storeSettingsDefaults.js)
        add_to_cart_button_color: '#28a745'
      },
      // Merge with real store settings (overrides defaults)
      ...(storeSettings || {})
    },
    productLabels: [
      {
        id: 1,
        text: 'SALE',
        position: 'top-right',
        background_color: '#dc2626',
        text_color: '#ffffff',
        priority: 10,
        sort_order: 1,
        conditions: {
          price_conditions: {
            has_sale_price: true
          }
        }
      }
    ],
    taxes: [],
    selectedCountry: 'US',
    user: {
      id: 1,
      email: 'demo@example.com',
      name: 'Demo User'
    },
    breadcrumbs: [
      { name: 'Home', url: '/' },
      { name: 'Electronics', url: '/category/electronics' },
      { name: 'Audio', url: '/category/audio' },
      { name: 'Premium Wireless Headphones', url: null }
    ],
    cmsBlocks: [
      {
        id: 1,
        title: 'Product Features Banner',
        identifier: 'product-features-banner',
        content: '<div class="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg mb-6"><h3 class="text-xl font-bold text-gray-900 mb-4">Why Choose Our Headphones?</h3><div class="grid grid-cols-1 md:grid-cols-3 gap-4"><div class="flex items-start"><div class="flex-shrink-0"><svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div><div class="ml-3"><h4 class="font-semibold text-gray-900">Premium Quality</h4><p class="text-sm text-gray-600">Industry-leading sound with crystal clear audio</p></div></div><div class="flex items-start"><div class="flex-shrink-0"><svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div><div class="ml-3"><h4 class="font-semibold text-gray-900">30-Hour Battery</h4><p class="text-sm text-gray-600">All-day listening without interruption</p></div></div><div class="flex items-start"><div class="flex-shrink-0"><svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg></div><div class="ml-3"><h4 class="font-semibold text-gray-900">Free Shipping</h4><p class="text-sm text-gray-600">Fast delivery on all orders</p></div></div></div></div>',
        position: 'product_above',
        is_active: true,
        sort_order: 1
      },
      {
        id: 2,
        title: 'Trust Badges',
        identifier: 'product-trust-badges',
        content: '<div class="border-t border-b border-gray-200 py-6 my-6"><div class="flex flex-wrap justify-center gap-8 items-center"><div class="flex items-center gap-2"><svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg><div><div class="font-semibold text-gray-900">Secure Checkout</div><div class="text-xs text-gray-500">SSL Encrypted</div></div></div><div class="flex items-center gap-2"><svg class="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg><div><div class="font-semibold text-gray-900">Money-back Guarantee</div><div class="text-xs text-gray-500">30 Days Return</div></div></div><div class="flex items-center gap-2"><svg class="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"></path></svg><div><div class="font-semibold text-gray-900">Authentic Products</div><div class="text-xs text-gray-500">100% Genuine</div></div></div></div></div>',
        position: 'product_above',
        is_active: true,
        sort_order: 2
      },
      {
        id: 3,
        title: 'Product Care Information',
        identifier: 'product-care-info',
        content: '<div class="bg-gray-50 p-6 rounded-lg my-6"><h3 class="text-lg font-semibold text-gray-900 mb-4">Care & Maintenance</h3><div class="space-y-3 text-sm text-gray-700"><div class="flex items-start gap-2"><svg class="w-5 h-5 text-gray-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg><span>Clean with a soft, dry cloth. Avoid using water or cleaning solutions.</span></div><div class="flex items-start gap-2"><svg class="w-5 h-5 text-gray-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg><span>Store in the included carrying case when not in use.</span></div><div class="flex items-start gap-2"><svg class="w-5 h-5 text-gray-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg><span>Avoid exposure to extreme temperatures and humidity.</span></div><div class="flex items-start gap-2"><svg class="w-5 h-5 text-gray-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg><span>Charge regularly to maintain optimal battery health.</span></div></div></div>',
        position: 'product_below',
        is_active: true,
        sort_order: 1
      },
      {
        id: 4,
        title: 'Shipping Information',
        identifier: 'product-shipping-info',
        content: '<div class="border border-blue-200 bg-blue-50 p-6 rounded-lg my-6"><h3 class="text-lg font-semibold text-blue-900 mb-4 flex items-center gap-2"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"></path></svg>Fast & Free Shipping</h3><div class="grid md:grid-cols-2 gap-4 text-sm text-blue-900"><div><strong>Standard Shipping:</strong> Free on all orders • 3-5 business days</div><div><strong>Express Shipping:</strong> $9.99 • 1-2 business days</div><div><strong>International:</strong> Calculated at checkout • 7-14 business days</div><div><strong>Order Processing:</strong> Ships within 24 hours on business days</div></div></div>',
        position: 'product_below',
        is_active: true,
        sort_order: 2
      }
    ]
  };
};