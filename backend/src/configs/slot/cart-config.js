// Cart Page Configuration with hierarchical support
// Backend version - CommonJS format

const cartConfig = {
  page_name: 'Cart',
  slot_type: 'cart_layout',

  // Slot configuration with content, styling and metadata
  slots: {
    main_layout: {
      id: 'main_layout',
      type: 'grid',
      content: '',
      className: 'grid grid-cols-1 lg:grid-cols-12 gap-4',
      styles: {},
      parentId: null,
      layout: 'grid',
      gridCols: 12,
      colSpan: {
        emptyCart: 12,
        withProducts: 12
      },
      viewMode: ['emptyCart', 'withProducts'],
      metadata: { hierarchical: true }
    },

    header_container: {
      id: 'header_container',
      type: 'grid',
      content: '',
      className: 'header-container grid grid-cols-12 gap-2',
      styles: { gridColumn: '1 / -1', gridRow: '1' },
      parentId: 'main_layout',
      position: { col: 1, row: 1 },
      layout: 'grid',
      colSpan: {
        emptyCart: 12,
        withProducts: 12
      },
      viewMode: ['emptyCart', 'withProducts'],
      metadata: { hierarchical: true }
    },

    content_area: {
      id: 'content_area',
      type: 'container',
      content: '',
      className: 'content-area',
      styles: { gridRow: '2' },
      parentId: 'main_layout',
      position: { col: 1, row: 2 },
      layout: 'grid',
      colSpan: {
        emptyCart: 12,
        withProducts: 'col-span-12 lg:col-span-9'
      },
      viewMode: ['emptyCart', 'withProducts'],
      metadata: { hierarchical: true }
    },

    sidebar_area: {
      id: 'sidebar_area',
      type: 'flex',
      content: '',
      className: 'sidebar-area space-y-4',
      styles: { flexDirection: 'column', gridRow: '2' },
      parentId: 'main_layout',
      position: { col: 9, row: 2 },
      layout: 'flex',
      colSpan: {
        withProducts: 'col-span-12 lg:col-span-3'
      },
      viewMode: ['withProducts'],
      metadata: { hierarchical: true }
    },

    header_title: {
      id: 'header_title',
      type: 'text',
      content: '{{t "common.my_cart"}}',
      className: 'w-fit text-3xl font-bold text-gray-900 mb-4',
      parentClassName: 'text-center',
      styles: {},
      parentId: 'header_container',
      position: { col: 1, row: 1 },
      viewMode: ['emptyCart', 'withProducts'],
      metadata: { hierarchical: true }
    },

    empty_cart_container: {
      id: 'empty_cart_container',
      type: 'grid',
      content: '',
      className: 'empty-cart-container grid grid-cols-12 gap-2',
      styles: { gridRow: '2' },
      parentId: 'main_layout',
      position: { col: 1, row: 2 },
      layout: 'grid',
      colSpan: {
        emptyCart: 12
      },
      viewMode: ['emptyCart'],
      metadata: { hierarchical: true }
    },

    empty_cart_icon: {
      id: 'empty_cart_icon',
      type: 'image',
      content: 'shopping-cart-icon',
      className: 'w-fit w-16 h-16 mx-auto text-gray-400 mb-4',
      parentClassName: 'text-center',
      styles: {},
      parentId: 'empty_cart_container',
      position: { col: 1, row: 1 },
      colSpan: {
        emptyCart: 12
      },
      viewMode: ['emptyCart'],
      metadata: { hierarchical: true }
    },

    empty_cart_title: {
      id: 'empty_cart_title',
      type: 'text',
      content: '{{t "cart.cart_empty"}}',
      className: 'w-fit text-xl font-semibold text-gray-900 mb-2 mx-auto',
      parentClassName: 'text-center',
      styles: {},
      parentId: 'empty_cart_container',
      position: { col: 1, row: 2 },
      colSpan: {
        emptyCart: 12
      },
      viewMode: ['emptyCart'],
      metadata: { hierarchical: true }
    },

    empty_cart_text: {
      id: 'empty_cart_text',
      type: 'text',
      content: '{{t "cart.cart_empty_message"}}',
      className: 'w-fit text-gray-600 mb-6 mx-auto',
      parentClassName: 'text-center',
      styles: {},
      parentId: 'empty_cart_container',
      position: { col: 1, row: 3 },
      colSpan: {
        emptyCart: 12
      },
      viewMode: ['emptyCart'],
      metadata: { hierarchical: true }
    },

    empty_cart_button: {
      id: 'empty_cart_button',
      type: 'button',
      content: '{{t "common.continue_shopping"}}',
      className: 'w-fit bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded mx-auto',
      parentClassName: 'text-center',
      styles: {},
      parentId: 'empty_cart_container',
      position: { col: 1, row: 4 },
      colSpan: {
        emptyCart: 12
      },
      viewMode: ['emptyCart'],
      metadata: { hierarchical: true }
    },

    cart_items: {
      id: 'cart_items',
      type: 'component',
      component: 'CartItemsSlot',
      content: `{{#each cartItems}}
<div class="cart-item py-4 flex items-start gap-4" data-item-id="{{this.id}}" data-price="{{this.price}}" data-quantity="{{this.quantity}}">
  <div class="w-20 h-20 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden">
    <img src="{{this.product.image_url}}" alt="{{this.product.name}}" class="w-full h-full object-cover" />
  </div>
  <div class="flex-1 min-w-0">
    <h3 class="text-base font-medium text-gray-900 truncate">{{this.product.name}}</h3>
    <div class="text-sm text-gray-600">{{this.price}} × {{this.quantity}}</div>
    <div data-selected-options class="mt-1"></div>
  </div>
  <div class="flex flex-col items-end gap-2">
    <div class="flex items-center gap-2">
      <button data-action="decrease-quantity" data-item-id="{{this.id}}" class="w-8 h-8 flex items-center justify-center rounded-full border border-gray-300 hover:bg-gray-100 transition-colors">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4"></path></svg>
      </button>
      <span class="w-8 text-center font-medium">{{this.quantity}}</span>
      <button data-action="increase-quantity" data-item-id="{{this.id}}" class="w-8 h-8 flex items-center justify-center rounded-full border border-gray-300 hover:bg-gray-100 transition-colors">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
      </button>
    </div>
    <div data-item-total class="text-base font-semibold text-gray-900"></div>
    <button data-action="remove-item" data-item-id="{{this.id}}" class="text-red-600 hover:text-red-800 text-sm flex items-center gap-1">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
      Remove
    </button>
  </div>
</div>
{{/each}}`,
      className: 'cart-items-container bg-white divide-y divide-gray-400',
      styles: { padding: '16px', borderRadius: '8px', boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)' },
      parentId: 'content_area',
      position: { col: 1, row: 1 },
      layout: 'grid',
      colSpan: {
        withProducts: 12
      },
      viewMode: ['withProducts'],
      metadata: { hierarchical: true }
    },

    coupon_section: {
      id: 'coupon_section',
      type: 'component',
      component: 'CartCouponSlot',
      content: `<div class="space-y-4">
  <h3 class="text-lg font-semibold text-gray-900">{{t "common.apply_coupon"}}</h3>
  <div data-coupon-input-section class="flex gap-2">
    <input data-coupon-input type="text" placeholder="{{t 'common.enter_coupon_code'}}" class="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
    <button data-action="apply-coupon" class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">{{t "common.apply"}}</button>
  </div>
  <div data-applied-coupon-section class="hidden">
    <div class="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-md">
      <div class="flex items-center gap-2">
        <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
        <div>
          <span data-coupon-name class="font-medium text-green-800"></span>
          <span data-coupon-discount class="text-sm text-green-600 ml-2"></span>
        </div>
      </div>
      <button data-action="remove-coupon" class="text-red-600 hover:text-red-800">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
      </button>
    </div>
  </div>
</div>`,
      className: 'bg-white',
      styles: { padding: '16px', borderRadius: '8px', boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)' },
      parentId: 'sidebar_area',
      position: { col: 1, row: 1 },
      layout: 'grid',
      colSpan: {
        withProducts: 12
      },
      viewMode: ['withProducts'],
      metadata: { hierarchical: true }
    },

    order_summary: {
      id: 'order_summary',
      type: 'component',
      component: 'CartOrderSummarySlot',
      content: `<div class="space-y-4">
  <h3 class="text-lg font-semibold text-gray-900">{{t "common.order_summary"}}</h3>
  <div class="space-y-2">
    <div class="flex justify-between text-gray-600">
      <span>{{t "common.subtotal"}}</span>
      <span data-subtotal class="font-medium"></span>
    </div>
    <div data-custom-options-row class="flex justify-between text-gray-600" style="display: none;">
      <span>{{t "checkout.custom_options"}}</span>
      <span data-custom-options-total class="font-medium"></span>
    </div>
    <div data-discount-row class="flex justify-between text-green-600" style="display: none;">
      <span data-discount-label>{{t "common.discount"}}</span>
      <span data-discount class="font-medium"></span>
    </div>
    <div class="flex justify-between text-gray-600">
      <span>{{t "common.tax"}}</span>
      <span data-tax class="font-medium"></span>
    </div>
    <div class="border-t pt-2 mt-2">
      <div class="flex justify-between text-lg font-bold text-gray-900">
        <span>{{t "common.total"}}</span>
        <span data-total></span>
      </div>
    </div>
  </div>
  <button data-action="checkout" class="w-full py-3 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors font-medium">
    {{t "checkout.proceed_to_checkout"}}
  </button>
</div>`,
      className: 'bg-white',
      styles: { padding: '16px', borderRadius: '8px', boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)' },
      parentId: 'sidebar_area',
      position: { col: 1, row: 2 },
      layout: 'grid',
      colSpan: {
        withProducts: 12
      },
      viewMode: ['withProducts'],
      metadata: { hierarchical: true }
    }
  },

  metadata: {
    created: new Date().toISOString(),
    lastModified: new Date().toISOString(),
    version: '1.0',
    pageType: 'cart'
  },

  views: [
    { id: 'emptyCart', label: 'Empty Cart', icon: null },
    { id: 'withProducts', label: 'With Products', icon: null }
  ],

  cmsBlocks: [
    'cart_header',
    'cart_above_items',
    'cart_below_items',
    'cart_sidebar',
    'cart_above_total',
    'cart_below_total',
    'cart_footer'
  ]
};

module.exports = { cartConfig };
