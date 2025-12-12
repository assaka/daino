// Header Configuration - Slot-based layout for header and navigation
// Backend version - CommonJS format

const headerConfig = {
  page_name: 'Header',
  slot_type: 'header_layout',

  slots: {
    header_main: {
      id: 'header_main',
      type: 'container',
      content: '',
      className: 'bg-white shadow-md sticky top-0 z-40',
      parentClassName: '',
      styles: {
        backgroundColor: '#ffffff',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
        position: 'sticky',
        top: '0',
        zIndex: '40'
      },
      parentId: null,
      position: { col: 1, row: 1 },
      colSpan: { mobile: 12, desktop: 12 },
      viewMode: ['default'],
      metadata: {
        hierarchical: true,
        displayName: 'Main Header Container'
      }
    },

    header_inner: {
      id: 'header_inner',
      type: 'container',
      content: '',
      className: 'max-w-7xl mx-auto px-2 md:px-4 lg:px-8',
      parentClassName: '',
      styles: {},
      parentId: 'header_main',
      position: { col: 1, row: 1 },
      colSpan: { mobile: 12, desktop: 12 },
      viewMode: ['default'],
      metadata: {
        hierarchical: true,
        displayName: 'Header Inner Container'
      }
    },

    header_top_row: {
      id: 'header_top_row',
      type: 'grid',
      content: '',
      className: 'grid grid-cols-12 gap-2 items-center h-16',
      parentClassName: 'w-full',
      styles: {
        display: 'grid',
        gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
        gap: '0.5rem',
        alignItems: 'center',
        height: '4rem'
      },
      parentId: 'header_inner',
      position: { col: 1, row: 1 },
      colSpan: { mobile: 12, desktop: 12 },
      viewMode: ['default'],
      metadata: {
        hierarchical: true,
        displayName: 'Header Top Row'
      }
    },

    logo_section: {
      id: 'logo_section',
      type: 'container',
      content: '',
      className: 'flex items-center',
      parentClassName: '',
      styles: {},
      parentId: 'header_top_row',
      position: { col: 1, row: 1 },
      colSpan: { mobile: 6, desktop: 3 },
      viewMode: ['default'],
      metadata: {
        hierarchical: true,
        displayName: 'Logo Section'
      }
    },

    store_logo: {
      id: 'store_logo',
      type: 'component',
      component: 'StoreLogo',
      content: '',
      className: '',
      parentClassName: '',
      styles: {},
      parentId: 'logo_section',
      position: { col: 1, row: 1 },
      colSpan: { mobile: 12, desktop: 12 },
      viewMode: ['default'],
      metadata: {
        hierarchical: false,
        displayName: 'Store Logo & Name',
        component: 'StoreLogo'
      }
    },

    search_section: {
      id: 'search_section',
      type: 'container',
      content: '',
      className: 'hidden md:flex flex-1 justify-center px-8',
      parentClassName: '',
      styles: {},
      parentId: 'header_top_row',
      position: { col: 4, row: 1 },
      colSpan: { desktop: 6 },
      viewMode: ['default'],
      metadata: {
        hierarchical: true,
        displayName: 'Search Section (Desktop)'
      }
    },

    search_bar: {
      id: 'search_bar',
      type: 'component',
      component: 'HeaderSearch',
      content: '',
      className: 'w-full',
      parentClassName: '',
      styles: {},
      parentId: 'search_section',
      position: { col: 1, row: 1 },
      colSpan: { desktop: 12 },
      viewMode: ['default'],
      metadata: {
        hierarchical: false,
        displayName: 'Search Bar Component',
        component: 'HeaderSearch'
      }
    },

    actions_section: {
      id: 'actions_section',
      type: 'container',
      content: '',
      className: 'flex items-center space-x-1 md:space-x-2',
      parentClassName: '',
      styles: {},
      parentId: 'header_top_row',
      position: { col: 10, row: 1 },
      colSpan: { mobile: 6, desktop: 3 },
      viewMode: ['default'],
      metadata: {
        hierarchical: true,
        displayName: 'Actions Section (Cart, User, Menu)'
      }
    },

    cart_icon: {
      id: 'cart_icon',
      type: 'component',
      component: 'MiniCart',
      content: '',
      className: '',
      parentClassName: '',
      styles: {},
      parentId: 'actions_section',
      position: { col: 2, row: 1 },
      colSpan: { mobile: 12, desktop: 12 },
      viewMode: ['default'],
      metadata: {
        hierarchical: false,
        displayName: 'Shopping Cart Icon',
        component: 'MiniCart'
      }
    },

    navigation_bar: {
      id: 'navigation_bar',
      type: 'container',
      content: '',
      className: 'hidden md:block bg-gray-50 border-b border-gray-200',
      parentClassName: '',
      styles: {
        backgroundColor: '#F9FAFB',
        borderBottom: '1px solid #E5E7EB'
      },
      parentId: null,
      position: { col: 1, row: 2 },
      colSpan: { desktop: 12 },
      viewMode: ['default'],
      metadata: {
        hierarchical: true,
        displayName: 'Navigation Bar (Desktop)'
      }
    },

    category_navigation: {
      id: 'category_navigation',
      type: 'component',
      component: 'CategoryNav',
      content: '',
      className: '',
      parentClassName: '',
      styles: {},
      parentId: 'navigation_bar',
      position: { col: 1, row: 1 },
      colSpan: { desktop: 12 },
      viewMode: ['default'],
      metadata: {
        hierarchical: false,
        displayName: 'Category Navigation',
        component: 'CategoryNav'
      }
    }
  },

  views: [
    { id: 'default', label: 'Header Layout', icon: null }
  ],

  cmsBlocks: [
    'header_top',
    'header_middle',
    'header_bottom',
    'navigation_before',
    'navigation_after'
  ],

  microslots: {
    store_logo: {
      type: 'logo',
      editable: true,
      dataBinding: 'store.logo_url',
      fallback: 'Default Logo Icon'
    },
    store_name: {
      type: 'text',
      editable: true,
      dataBinding: 'store.name',
      fallback: 'Store Name'
    },
    search_bar: {
      type: 'search',
      editable: true,
      placeholder: 'Search products...'
    },
    user_name: {
      type: 'text',
      editable: true,
      dataBinding: 'user.name',
      fallback: 'Sign In'
    },
    cart_count: {
      type: 'badge',
      editable: true,
      dataBinding: 'cart.item_count',
      fallback: '0'
    }
  }
};

module.exports = { headerConfig };
