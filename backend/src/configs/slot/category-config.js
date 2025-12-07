// Category Page Configuration - Slot-based layout with microslots
// Backend version - CommonJS format (simplified for seeding)

const categoryConfig = {
  page_name: 'Category',
  slot_type: 'category_layout',

  slots: {
    page_header: {
      id: 'page_header',
      type: 'container',
      content: '',
      className: 'w-full mb-8',
      parentClassName: '',
      styles: {},
      parentId: null,
      position: { col: 1, row: 1 },
      colSpan: { grid: 12, list: 12 },
      viewMode: ['grid', 'list'],
      metadata: { hierarchical: true }
    },

    breadcrumbs_content: {
      id: 'breadcrumbs_content',
      type: 'component',
      component: 'Breadcrumbs',
      content: '',
      className: '',
      parentClassName: '',
      styles: {},
      parentId: 'page_header',
      position: { col: 1, row: 1 },
      colSpan: { grid: 12, list: 12 },
      viewMode: ['grid', 'list'],
      metadata: {
        hierarchical: false,
        displayName: 'Breadcrumb Navigation'
      }
    },

    category_title: {
      id: 'category_title',
      type: 'text',
      content: '{{category.name}}',
      className: 'w-fit text-4xl font-bold text-gray-900 mb-2',
      parentClassName: '',
      styles: {},
      parentId: 'page_header',
      position: { col: 1, row: 2 },
      colSpan: { default: 12, grid: 12, list: 12 },
      viewMode: ['grid', 'list'],
      metadata: {
        hierarchical: true,
        htmlTag: 'h1'
      }
    },

    category_description: {
      id: 'category_description',
      type: 'text',
      content: '{{t "common.category_description"}}',
      className: 'text-gray-600 mb-6',
      parentClassName: '',
      styles: {},
      parentId: 'page_header',
      position: { col: 1, row: 3 },
      colSpan: { grid: 12, list: 12 },
      viewMode: ['grid', 'list'],
      metadata: {
        hierarchical: false,
        displayName: 'Category Description'
      }
    },

    products_container: {
      id: 'products_container',
      type: 'container',
      content: '',
      className: 'sm:ml-6',
      parentClassName: '',
      styles: {},
      parentId: null,
      position: { col: 4, row: 2 },
      colSpan: { grid: 'col-span-12 sm:col-span-9', list: 'col-span-12 sm:col-span-9' },
      viewMode: ['grid', 'list'],
      metadata: { hierarchical: true }
    },

    sorting_controls: {
      id: 'sorting_controls',
      type: 'container',
      content: '',
      className: 'flex justify-between items-center mb-6 gap-4',
      parentClassName: '',
      styles: {},
      parentId: 'products_container',
      position: { col: 1, row: 1 },
      colSpan: { grid: 12, list: 12 },
      viewMode: ['grid', 'list'],
      metadata: { hierarchical: true }
    },

    product_items: {
      id: 'product_items',
      type: 'component',
      component: 'ProductItemsGrid',
      content: '',
      className: '',
      parentClassName: '',
      styles: {},
      parentId: 'products_container',
      position: { col: 1, row: 3 },
      colSpan: { grid: 12, list: 12 },
      viewMode: ['grid', 'list'],
      metadata: {
        hierarchical: true,
        displayName: 'Product Items Grid'
      }
    },

    empty_products_message: {
      id: 'empty_products_message',
      type: 'component',
      component: 'EmptyProductsMessage',
      content: '',
      className: 'text-center py-12',
      parentClassName: '',
      styles: {},
      parentId: 'products_container',
      position: { col: 1, row: 4 },
      colSpan: { grid: 12, list: 12 },
      viewMode: ['grid', 'list'],
      metadata: {
        hierarchical: false,
        displayName: 'Empty Products Message',
        showWhen: 'products.length === 0'
      }
    },

    pagination_container: {
      id: 'pagination_container',
      type: 'component',
      component: 'PaginationComponent',
      content: '',
      className: '',
      parentClassName: '',
      styles: {},
      parentId: 'products_container',
      position: { col: 1, row: 5 },
      colSpan: { grid: 12, list: 12 },
      viewMode: ['grid', 'list'],
      metadata: {
        hierarchical: false,
        component: 'PaginationComponent'
      }
    },

    filters_container: {
      id: 'filters_container',
      type: 'container',
      content: '',
      className: 'hidden sm:block lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] lg:overflow-y-auto',
      parentClassName: '',
      styles: {
        backgroundColor: 'transparent',
        padding: '1rem',
        paddingRight: 0,
        borderRadius: '0.5rem'
      },
      parentId: null,
      position: { col: 1, row: 2 },
      colSpan: { grid: 'col-span-12 sm:col-span-3', list: 'col-span-12 sm:col-span-3' },
      viewMode: ['grid', 'list'],
      metadata: { hierarchical: true }
    },

    layered_navigation: {
      id: 'layered_navigation',
      type: 'component',
      component: 'LayeredNavigation',
      content: '',
      className: '',
      parentClassName: '',
      styles: {},
      parentId: 'filters_container',
      position: { col: 1, row: 3 },
      colSpan: { grid: 12, list: 12 },
      viewMode: ['grid', 'list'],
      metadata: {
        hierarchical: false,
        component: 'LayeredNavigation',
        displayName: 'Product Filters'
      }
    }
  },

  views: [
    { id: 'grid', label: 'Grid', icon: null },
    { id: 'list', label: 'List', icon: null }
  ],

  cmsBlocks: [
    'category_header',
    'category_above_filters',
    'category_below_filters',
    'category_above_products',
    'category_below_products',
    'category_footer'
  ],

  microslots: {
    breadcrumbs_content: {
      type: 'breadcrumbs',
      editable: true,
      dataBinding: 'category.breadcrumbs',
      categoryBinding: 'category'
    },
    category_title: {
      type: 'text',
      editable: true,
      dataBinding: 'category.name',
      fallback: 'Category Name'
    },
    product_image: {
      type: 'image',
      editable: true,
      dataBinding: 'product.images[0]',
      altBinding: 'product.name'
    },
    product_name: {
      type: 'text',
      editable: true,
      dataBinding: 'product.name',
      linkBinding: 'product.url'
    },
    product_price: {
      type: 'price',
      editable: true,
      dataBinding: 'product.price',
      formatBinding: 'formatDisplayPrice'
    }
  }
};

module.exports = { categoryConfig };
