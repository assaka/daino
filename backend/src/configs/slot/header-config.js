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
      className: 'shadow-md sticky top-0 z-40 relative',
      parentClassName: '',
      styles: {
        // Empty backgroundColor - use theme settings (settings.theme.header_bg_color)
        // Theme settings are applied in HeaderSlotRenderer via headerBgColor fallback
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
      },
      parentId: null,
      position: { col: 1, row: 1 },
      colSpan: { mobile: 12, desktop: 12 },
      viewMode: ['default'],
      metadata: {
        hierarchical: true,
        displayName: 'Main Header Container',
        editorSidebar: 'HeaderEditorSidebar'
      }
    },

    header_inner: {
      id: 'header_inner',
      type: 'container',
      content: '',
      className: 'max-w-7xl mx-auto px-2 md:px-4 lg:px-8',
      parentClassName: '',
      styles: {
        // No explicit margins - mx-auto class handles centering
        // This prevents double margin in editor preview
      },
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
      className: 'grid grid-cols-12 items-center gap-2 h-16',
      parentClassName: 'w-full',
      styles: {
        display: 'grid',
        alignItems: 'center',
        gap: '0.5rem',
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
      colSpan: { mobile: 4, desktop: 2 },
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
      className: 'hidden md:flex justify-center min-w-0',
      parentClassName: '',
      styles: { minWidth: 0 },
      parentId: 'header_top_row',
      position: { col: 2, row: 1 },
      colSpan: { mobile: 1, desktop: 5 },
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
      className: 'w-full max-h-10',
      parentClassName: '',
      styles: {
        maxHeight: '40px'
      },
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
      type: 'grid',
      content: '',
      className: 'grid items-center justify-end',
      parentClassName: '',
      styles: {
        display: 'grid',
        gridTemplateColumns: 'repeat(8, auto)',
        alignItems: 'center',
        justifyContent: 'end',
        gap: '0.25rem'
      },
      parentId: 'header_top_row',
      position: { col: 3, row: 1 },
      colSpan: { mobile: 8, desktop: 5 },
      viewMode: ['default'],
      metadata: {
        hierarchical: true,
        displayName: 'Actions Section (Cart, User, Menu)'
      }
    },

    mobile_search_toggle: {
      id: 'mobile_search_toggle',
      type: 'component',
      component: 'MobileSearchToggle',
      content: '',
      className: 'md:hidden',
      parentClassName: '',
      styles: {},
      parentId: 'actions_section',
      position: { col: 1, row: 1 },
      colSpan: { mobile: 1, desktop: 1 },
      viewMode: ['default'],
      metadata: {
        hierarchical: false,
        displayName: 'Mobile Search Toggle',
        component: 'MobileSearchToggle'
      }
    },

    // Mobile user menu (shows on mobile only)
    mobile_user_menu: {
      id: 'mobile_user_menu',
      type: 'component',
      component: 'MobileUserMenu',
      content: '',
      className: 'md:hidden',
      parentClassName: '',
      styles: {},
      parentId: 'actions_section',
      position: { col: 2, row: 1 },
      colSpan: { mobile: 1, desktop: 1 },
      viewMode: ['default'],
      metadata: {
        hierarchical: false,
        displayName: 'Mobile User Menu',
        component: 'MobileUserMenu'
      }
    },

    // Language selector (extra large screens only >= 1280px - hides first)
    language_selector: {
      id: 'language_selector',
      type: 'component',
      component: 'LanguageSelector',
      content: '',
      className: 'hidden xl:block',
      parentClassName: '',
      styles: {},
      parentId: 'actions_section',
      position: { col: 3, row: 1 },
      colSpan: { mobile: 1, desktop: 1 },
      viewMode: ['default'],
      metadata: {
        hierarchical: false,
        displayName: 'Language Selector',
        component: 'LanguageSelector'
      }
    },

    // Country selector (large screens only >= 1024px)
    country_selector: {
      id: 'country_selector',
      type: 'component',
      component: 'CountrySelect',
      content: '',
      className: 'hidden lg:block',
      parentClassName: '',
      styles: {},
      parentId: 'actions_section',
      position: { col: 4, row: 1 },
      colSpan: { mobile: 1, desktop: 1 },
      viewMode: ['default'],
      metadata: {
        hierarchical: false,
        displayName: 'Country Selector',
        component: 'CountrySelect'
      }
    },

    // User account menu (medium screens and up >= 768px - always visible on desktop/tablet)
    user_account_menu: {
      id: 'user_account_menu',
      type: 'component',
      component: 'UserAccountMenu',
      content: '',
      className: 'hidden md:block',
      parentClassName: '',
      styles: {},
      parentId: 'actions_section',
      position: { col: 5, row: 1 },
      colSpan: { mobile: 1, desktop: 1 },
      viewMode: ['default'],
      metadata: {
        hierarchical: false,
        displayName: 'User Account Menu',
        component: 'UserAccountMenu'
      }
    },

    // Wishlist dropdown (after Sign In, before Cart)
    wishlist_icon: {
      id: 'wishlist_icon',
      type: 'component',
      component: 'WishlistDropdown',
      content: '',
      className: '',
      parentClassName: '',
      styles: {},
      parentId: 'actions_section',
      position: { col: 6, row: 1 },
      colSpan: { mobile: 1, desktop: 1 },
      viewMode: ['default'],
      metadata: {
        hierarchical: false,
        displayName: 'Wishlist Icon',
        component: 'WishlistDropdown'
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
      position: { col: 7, row: 1 },
      colSpan: { mobile: 1, desktop: 1 },
      viewMode: ['default'],
      metadata: {
        hierarchical: false,
        displayName: 'Shopping Cart Icon',
        component: 'MiniCart'
      }
    },

    mobile_menu_toggle: {
      id: 'mobile_menu_toggle',
      type: 'component',
      component: 'MobileMenuToggle',
      content: '',
      className: 'md:hidden',
      parentClassName: '',
      styles: {},
      parentId: 'actions_section',
      position: { col: 8, row: 1 },
      colSpan: { mobile: 1, desktop: 1 },
      viewMode: ['default'],
      metadata: {
        hierarchical: false,
        displayName: 'Mobile Menu Toggle (Hamburger)',
        component: 'MobileMenuToggle'
      }
    },

    mobile_menu: {
      id: 'mobile_menu',
      type: 'container',
      content: '',
      className: 'md:hidden absolute top-full left-0 right-0 shadow-lg border-t border-gray-200 z-50',
      parentClassName: '',
      styles: {
        // Empty backgroundColor - use theme settings (settings.theme.header_bg_color)
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
      },
      parentId: 'header_main',
      position: { col: 1, row: 2 },
      colSpan: { mobile: 12, desktop: 12 },
      viewMode: ['default'],
      metadata: {
        hierarchical: true,
        displayName: 'Mobile Menu Container'
      }
    },

    mobile_navigation: {
      id: 'mobile_navigation',
      type: 'component',
      component: 'MobileNavigation',
      content: '',
      className: '',
      parentClassName: '',
      styles: {},
      parentId: 'mobile_menu',
      position: { col: 1, row: 1 },
      colSpan: { mobile: 12, desktop: 12 },
      viewMode: ['default'],
      metadata: {
        hierarchical: false,
        displayName: 'Mobile Category Navigation',
        component: 'MobileNavigation'
      }
    },

    mobile_search_bar: {
      id: 'mobile_search_bar',
      type: 'component',
      component: 'HeaderSearch',
      content: '',
      className: 'md:hidden px-4 py-2',
      parentClassName: '',
      styles: {},
      parentId: 'header_main',
      position: { col: 1, row: 3 },
      colSpan: { mobile: 12, desktop: 12 },
      viewMode: ['default'],
      metadata: {
        hierarchical: false,
        displayName: 'Mobile Search Bar',
        component: 'HeaderSearch'
      }
    },

    navigation_bar: {
      id: 'navigation_bar',
      type: 'container',
      content: '',
      className: 'hidden md:block border-b border-gray-200',
      parentClassName: '',
      styles: {
        // Empty backgroundColor - use theme settings (settings.theme.header_nav_bg_color)
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
