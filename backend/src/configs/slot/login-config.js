// Login Page Configuration - 2 Column Layout
// Backend version - CommonJS format

const loginConfig = {
  page_name: 'Login',
  slot_type: 'login_layout',

  slotLayout: {
    page_header: { name: 'Page Header', colSpan: 12, order: 0 },
    login_column: { name: 'Login Column', colSpan: 6, order: 1 },
    register_column: { name: 'Register Column', colSpan: 6, order: 2 },
    login_footer: { name: 'Login Footer', colSpan: 12, order: 3 }
  },

  slots: {
    main_layout: {
      id: 'main_layout',
      type: 'grid',
      content: '',
      className: 'grid grid-cols-12 gap-8 max-w-7xl mx-auto px-4 py-8',
      styles: {},
      parentId: null,
      layout: 'grid',
      gridCols: 12,
      colSpan: 12,
      metadata: { hierarchical: true }
    },

    page_header: {
      id: 'page_header',
      type: 'text',
      content: '{{t "common.welcome_back"}}',
      className: 'text-3xl font-bold text-center text-gray-900',
      styles: { paddingTop: '2rem', paddingBottom: '2rem', gridColumn: '1 / -1' },
      parentId: 'main_layout',
      position: { col: 1, row: 1 },
      colSpan: 12,
      metadata: { hierarchical: true }
    },

    login_column: {
      id: 'login_column',
      type: 'container',
      content: '',
      className: 'bg-white',
      styles: { padding: '20px', borderRadius: '10px', boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)' },
      parentId: 'main_layout',
      position: { col: 1, row: 2 },
      colSpan: 'col-span-12 md:col-span-6',
      metadata: { hierarchical: true }
    },

    login_title: {
      id: 'login_title',
      type: 'text',
      content: '{{t "common.already_registered_login"}}',
      className: 'text-2xl font-bold text-gray-900',
      styles: { marginBottom: '10px' },
      parentId: 'login_column',
      position: { col: 1, row: 1 },
      colSpan: 12,
      metadata: { hierarchical: true }
    },

    login_form: {
      id: 'login_form',
      type: 'component',
      component: 'LoginFormSlot',
      content: '',
      className: '',
      styles: {},
      parentId: 'login_column',
      position: { col: 1, row: 2 },
      colSpan: 12,
      metadata: { hierarchical: true }
    },

    register_column: {
      id: 'register_column',
      type: 'container',
      content: '',
      className: 'bg-white',
      styles: { padding: '20px', borderRadius: '10px', boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)' },
      parentId: 'main_layout',
      position: { col: 2, row: 2 },
      colSpan: 'col-span-12 md:col-span-6',
      metadata: { hierarchical: true }
    },

    register_title: {
      id: 'register_title',
      type: 'text',
      content: '{{t "common.create_account"}}',
      className: 'text-2xl font-bold text-gray-900',
      styles: { marginBottom: '20px' },
      parentId: 'register_column',
      position: { col: 1, row: 1 },
      colSpan: 12,
      metadata: { hierarchical: true }
    },

    register_form: {
      id: 'register_form',
      type: 'component',
      component: 'RegisterFormSlot',
      content: '',
      className: '',
      styles: {},
      parentId: 'register_column',
      position: { col: 1, row: 2 },
      colSpan: 12,
      metadata: { hierarchical: true }
    },

    login_footer: {
      id: 'login_footer',
      type: 'component',
      component: 'AuthAgreementSlot',
      content: '',
      className: 'text-center text-sm text-gray-600',
      parentClassName: 'text-center',
      styles: { paddingTop: '20px', paddingBottom: '20px', gridColumn: '1 / -1' },
      parentId: 'main_layout',
      position: { col: 1, row: 3 },
      colSpan: 12,
      metadata: { hierarchical: true }
    }
  },

  metadata: {
    created: new Date().toISOString(),
    lastModified: new Date().toISOString(),
    version: '1.0',
    pageType: 'login'
  },

  views: [
    { id: 'login', label: 'Login View', icon: null },
    { id: 'register', label: 'Register View', icon: null }
  ],

  cmsBlocks: [
    'login_header',
    'login_footer',
    'social_login',
    'login_banner',
    'register_banner'
  ]
};

module.exports = { loginConfig };
