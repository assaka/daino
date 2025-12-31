import { useState, useEffect } from 'react';
import { X, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import SectionHeader from './components/SectionHeader';

/**
 * Specialized sidebar for Header styling
 * Provides controls for logo, search bar, navigation, user menu, etc.
 */
const HeaderEditorSidebar = ({
  slotId,
  slotConfig,
  allSlots = {},
  onClassChange,
  onTextChange,
  onClearSelection
}) => {
  const [expandedSections, setExpandedSections] = useState({
    headerContainer: true,
    logo: true,
    searchBar: true,
    navigation: true,
    userActions: true,
    iconStyles: true,
    mobile: true
  });

  const [headerStyles, setHeaderStyles] = useState({
    // Header Container
    headerBg: '#ffffff',
    headerShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
    headerHeight: '4rem',
    headerPadding: '0 1rem',

    // Logo
    logoSize: '2rem',
    logoUrl: '',
    storeName: '',
    storeNameColor: '#111827',
    storeNameSize: '1.25rem',
    storeNameWeight: '700',

    // Search Bar
    searchBg: '#ffffff',
    searchBorder: '#d1d5db',
    searchBorderRadius: '0.5rem',
    searchPadding: '0.5rem 1rem',
    searchPlaceholder: 'Search products...',
    searchIconColor: '#9ca3af',

    // Navigation Bar
    navBarBg: '#F9FAFB',
    navBarPadding: '0.75rem 0',
    navLinkColor: '#374151',
    navLinkHoverColor: '#2563EB',
    navLinkSize: '0.875rem',
    navLinkWeight: '500',
    navLinkSpacing: '1.5rem',

    // Subcategory Colors
    subcategoryLinkColor: '#6B7280',
    subcategoryLinkHoverColor: '#2563EB',
    subcategoryBgColor: '#ffffff',
    subcategoryBgHoverColor: '#F3F4F6',

    // User Actions (Cart, Wishlist, User Icon)
    actionIconColor: '#374151',
    actionIconHoverColor: '#111827',
    actionIconSize: '1.5rem',
    cartBadgeBg: '#3b82f6',
    cartBadgeColor: '#ffffff',

    // User Menu Button (Sign In)
    userMenuBg: '#2563EB',
    userMenuHoverBg: '#1D4ED8',
    userMenuTextColor: '#ffffff',
    userMenuBorderRadius: '0.5rem',

    // Mobile Menu
    mobileMenuBg: '#ffffff',
    mobileMenuLinkColor: '#374151',
    mobileMenuLinkHoverColor: '#111827',
    mobileMenuItemHoverBg: '#f3f4f6',
    mobileMenuIconColor: '#374151',
    hamburgerSize: '1.5rem',

    // Icon Variants
    wishlistIconVariant: 'outline', // outline, filled
    userIconVariant: 'outline', // outline, filled
    cartIconVariant: 'outline' // outline, filled
  });

  // Load existing styles from slots
  useEffect(() => {
    if (!allSlots) return;

    const updates = {};

    // Header Container
    const headerMain = allSlots['header_main'];
    if (headerMain?.styles) {
      if (headerMain.styles.backgroundColor) updates.headerBg = headerMain.styles.backgroundColor;
      if (headerMain.styles.boxShadow) updates.headerShadow = headerMain.styles.boxShadow;
    }

    const headerTopRow = allSlots['header_top_row'];
    if (headerTopRow?.styles) {
      if (headerTopRow.styles.height) updates.headerHeight = headerTopRow.styles.height;
    }

    // Store Logo
    const storeLogo = allSlots['store_logo'];
    if (storeLogo?.metadata) {
      if (storeLogo.metadata.logoUrl) updates.logoUrl = storeLogo.metadata.logoUrl;
      if (storeLogo.metadata.storeName) updates.storeName = storeLogo.metadata.storeName;
    }
    if (storeLogo?.styles) {
      if (storeLogo.styles.fontSize) updates.storeNameSize = storeLogo.styles.fontSize;
      if (storeLogo.styles.fontWeight) updates.storeNameWeight = storeLogo.styles.fontWeight;
      if (storeLogo.styles.color) updates.storeNameColor = storeLogo.styles.color;
    }

    // Search Bar
    const searchBar = allSlots['search_bar'];
    if (searchBar?.styles) {
      if (searchBar.styles.backgroundColor) updates.searchBg = searchBar.styles.backgroundColor;
      if (searchBar.styles.borderColor) updates.searchBorder = searchBar.styles.borderColor;
      if (searchBar.styles.borderRadius) updates.searchBorderRadius = searchBar.styles.borderRadius;
    }

    // Navigation Bar
    const navBar = allSlots['navigation_bar'];
    if (navBar?.styles) {
      if (navBar.styles.backgroundColor) updates.navBarBg = navBar.styles.backgroundColor;
      if (navBar.styles.padding) updates.navBarPadding = navBar.styles.padding;
    }

    // Navigation Links
    const categoryNav = allSlots['category_navigation'];
    if (categoryNav?.styles) {
      if (categoryNav.styles.color) updates.navLinkColor = categoryNav.styles.color;
      if (categoryNav.styles.hoverColor) updates.navLinkHoverColor = categoryNav.styles.hoverColor;
      if (categoryNav.styles.fontSize) updates.navLinkSize = categoryNav.styles.fontSize;
      if (categoryNav.styles.fontWeight) updates.navLinkWeight = categoryNav.styles.fontWeight;
    }

    // Subcategory styles from metadata
    if (categoryNav?.metadata) {
      if (categoryNav.metadata.subcategoryLinkColor) updates.subcategoryLinkColor = categoryNav.metadata.subcategoryLinkColor;
      if (categoryNav.metadata.subcategoryLinkHoverColor) updates.subcategoryLinkHoverColor = categoryNav.metadata.subcategoryLinkHoverColor;
      if (categoryNav.metadata.subcategoryBgColor) updates.subcategoryBgColor = categoryNav.metadata.subcategoryBgColor;
      if (categoryNav.metadata.subcategoryBgHoverColor) updates.subcategoryBgHoverColor = categoryNav.metadata.subcategoryBgHoverColor;
    }

    // User Account Menu
    const userAccountMenu = allSlots['user_account_menu'];
    if (userAccountMenu?.styles) {
      if (userAccountMenu.styles.backgroundColor) updates.userMenuBg = userAccountMenu.styles.backgroundColor;
      if (userAccountMenu.styles.hoverBackgroundColor) updates.userMenuHoverBg = userAccountMenu.styles.hoverBackgroundColor;
      if (userAccountMenu.styles.color) updates.userMenuTextColor = userAccountMenu.styles.color;
      if (userAccountMenu.styles.borderRadius) updates.userMenuBorderRadius = userAccountMenu.styles.borderRadius;
    }
    if (userAccountMenu?.metadata?.iconVariant) updates.userIconVariant = userAccountMenu.metadata.iconVariant;

    // Mobile Menu
    const mobileMenu = allSlots['mobile_menu'];
    if (mobileMenu?.styles) {
      if (mobileMenu.styles.backgroundColor) updates.mobileMenuBg = mobileMenu.styles.backgroundColor;
    }

    // Mobile Navigation Links
    const mobileNavigation = allSlots['mobile_navigation'];
    if (mobileNavigation?.styles) {
      if (mobileNavigation.styles.color) updates.mobileMenuLinkColor = mobileNavigation.styles.color;
      if (mobileNavigation.styles.hoverColor) updates.mobileMenuLinkHoverColor = mobileNavigation.styles.hoverColor;
      if (mobileNavigation.styles.hoverBackgroundColor) updates.mobileMenuItemHoverBg = mobileNavigation.styles.hoverBackgroundColor;
    }

    // Icon Variants
    const cartIcon = allSlots['cart_icon'];
    if (cartIcon?.metadata?.iconVariant) updates.cartIconVariant = cartIcon.metadata.iconVariant;

    const desktopWishlist = allSlots['desktop_wishlist'];
    if (desktopWishlist?.metadata?.iconVariant) updates.wishlistIconVariant = desktopWishlist.metadata.iconVariant;

    // Mobile icon variants (should match desktop)
    const mobileWishlist = allSlots['mobile_wishlist'];
    if (mobileWishlist?.metadata?.iconVariant) updates.wishlistIconVariant = mobileWishlist.metadata.iconVariant;

    const mobileUserMenu = allSlots['mobile_user_menu'];
    if (mobileUserMenu?.metadata?.iconVariant) updates.userIconVariant = mobileUserMenu.metadata.iconVariant;

    if (Object.keys(updates).length > 0) {
      setHeaderStyles(prev => ({ ...prev, ...updates }));
    }
  }, [allSlots]);

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Special handler for icon variants - updates both desktop and mobile versions
  const handleIconVariantChange = (property, value) => {
    // Update local state
    setHeaderStyles(prev => ({ ...prev, [property]: value }));

    // Map icon variant properties to their slot IDs (both desktop and mobile)
    const iconVariantSlotMap = {
      wishlistIconVariant: ['desktop_wishlist', 'mobile_wishlist'],
      userIconVariant: ['user_account_menu', 'mobile_user_menu'],
      cartIconVariant: ['cart_icon']
    };

    const targetSlots = iconVariantSlotMap[property];
    if (targetSlots && onClassChange) {
      targetSlots.forEach(slotId => {
        const targetSlot = allSlots[slotId];
        if (targetSlot) {
          const metadata = { ...(targetSlot.metadata || {}), iconVariant: value };
          // Update metadata without touching styles
          onClassChange(slotId, targetSlot.className || '', targetSlot.styles || {}, metadata);
        }
      });
    }
  };

  // Handle style changes with automatic slot targeting
  const handleStyleChange = (property, value, targetSlotId) => {
    // Update local state
    setHeaderStyles(prev => ({ ...prev, [property]: value }));

    // Update the target slot
    if (targetSlotId && allSlots[targetSlotId]) {
      const targetSlot = allSlots[targetSlotId];
      // CRITICAL: Start with existing styles and metadata from the slot
      const styles = { ...(targetSlot.styles || {}) };
      const metadata = { ...(targetSlot.metadata || {}) };

      // Map properties to their corresponding slot style/metadata properties
      const styleMap = {
        // Header Container
        headerBg: { slot: 'header_main', type: 'style', prop: 'backgroundColor' },
        headerShadow: { slot: 'header_main', type: 'style', prop: 'boxShadow' },
        headerHeight: { slot: 'header_top_row', type: 'style', prop: 'height' },

        // Logo
        logoUrl: { slot: 'store_logo', type: 'metadata', prop: 'logoUrl' },
        storeName: { slot: 'store_logo', type: 'metadata', prop: 'storeName' },
        storeNameColor: { slot: 'store_logo', type: 'style', prop: 'color' },
        storeNameSize: { slot: 'store_logo', type: 'style', prop: 'fontSize' },
        storeNameWeight: { slot: 'store_logo', type: 'style', prop: 'fontWeight' },

        // Search
        searchBg: { slot: 'search_bar', type: 'style', prop: 'backgroundColor' },
        searchBorder: { slot: 'search_bar', type: 'style', prop: 'borderColor' },
        searchBorderRadius: { slot: 'search_bar', type: 'style', prop: 'borderRadius' },

        // Navigation Bar
        navBarBg: { slot: 'navigation_bar', type: 'style', prop: 'backgroundColor' },
        navBarPadding: { slot: 'navigation_bar', type: 'style', prop: 'padding' },

        // Navigation Links
        navLinkColor: { slot: 'category_navigation', type: 'style', prop: 'color' },
        navLinkHoverColor: { slot: 'category_navigation', type: 'style', prop: 'hoverColor' },
        navLinkSize: { slot: 'category_navigation', type: 'style', prop: 'fontSize' },
        navLinkWeight: { slot: 'category_navigation', type: 'style', prop: 'fontWeight' },

        // Subcategories
        subcategoryLinkColor: { slot: 'category_navigation', type: 'metadata', prop: 'subcategoryLinkColor' },
        subcategoryLinkHoverColor: { slot: 'category_navigation', type: 'metadata', prop: 'subcategoryLinkHoverColor' },
        subcategoryBgColor: { slot: 'category_navigation', type: 'metadata', prop: 'subcategoryBgColor' },
        subcategoryBgHoverColor: { slot: 'category_navigation', type: 'metadata', prop: 'subcategoryBgHoverColor' },

        // User Menu Button
        userMenuBg: { slot: 'user_account_menu', type: 'style', prop: 'backgroundColor' },
        userMenuHoverBg: { slot: 'user_account_menu', type: 'style', prop: 'hoverBackgroundColor' },
        userMenuTextColor: { slot: 'user_account_menu', type: 'style', prop: 'color' },
        userMenuBorderRadius: { slot: 'user_account_menu', type: 'style', prop: 'borderRadius' },

        // Mobile Menu
        mobileMenuBg: { slot: 'mobile_menu', type: 'style', prop: 'backgroundColor' },
        mobileMenuLinkColor: { slot: 'mobile_navigation', type: 'style', prop: 'color' },
        mobileMenuLinkHoverColor: { slot: 'mobile_navigation', type: 'style', prop: 'hoverColor' },
        mobileMenuItemHoverBg: { slot: 'mobile_navigation', type: 'style', prop: 'hoverBackgroundColor' },
        mobileMenuIconColor: { slot: 'mobile_menu_toggle', type: 'style', prop: 'color' },

        // Icon Variants
        wishlistIconVariant: { slot: 'desktop_wishlist', type: 'metadata', prop: 'iconVariant' },
        userIconVariant: { slot: 'user_account_menu', type: 'metadata', prop: 'iconVariant' },
        cartIconVariant: { slot: 'cart_icon', type: 'metadata', prop: 'iconVariant' }
      };

      const mapping = styleMap[property];
      if (mapping && targetSlotId === mapping.slot) {
        // Only update the specific property type
        if (mapping.type === 'style') {
          styles[mapping.prop] = value;
        } else if (mapping.type === 'metadata') {
          metadata[mapping.prop] = value;
        }

        // CRITICAL FIX: Only pass the properties that changed
        // For style changes, pass styles with the className
        // For metadata changes, pass metadata separately without overwriting styles
        if (onClassChange) {
          if (mapping.type === 'style') {
            // Update styles - pass the updated styles
            onClassChange(targetSlotId, targetSlot.className || '', styles, targetSlot.metadata);
          } else if (mapping.type === 'metadata') {
            // Update metadata - pass the existing styles to preserve them
            onClassChange(targetSlotId, targetSlot.className || '', targetSlot.styles || {}, metadata);
          }
        }
      } else {
        console.warn('⚠️ No mapping found for property:', property, 'targetSlotId:', targetSlotId);
      }
    }
  };

  return (
    <div className="fixed top-0 right-0 h-screen w-80 bg-white border-l border-gray-200 shadow-lg flex flex-col editor-sidebar" style={{ zIndex: 1000 }}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">
          Header Settings
        </h2>
        <Button
          onClick={onClearSelection}
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto space-y-0">

        {/* Header Container */}
        <SectionHeader
          title="Header Container"
          section="headerContainer"
          expanded={expandedSections.headerContainer}
          onToggle={toggleSection}
        >
          <div className="space-y-3 p-3">
            <div>
              <Label className="text-xs">Background Color</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={headerStyles.headerBg}
                  onChange={(e) => handleStyleChange('headerBg', e.target.value, 'header_main')}
                  className="w-12 h-8 p-1"
                />
                <Input
                  type="text"
                  value={headerStyles.headerBg}
                  onChange={(e) => handleStyleChange('headerBg', e.target.value, 'header_main')}
                  className="flex-1 h-8 text-xs"
                  placeholder="#ffffff"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Header Height</Label>
              <Input
                type="text"
                value={headerStyles.headerHeight}
                onChange={(e) => handleStyleChange('headerHeight', e.target.value, 'header_top_row')}
                className="h-8 text-xs"
                placeholder="4rem"
              />
            </div>

            <div>
              <Label className="text-xs">Shadow</Label>
              <Input
                type="text"
                value={headerStyles.headerShadow}
                onChange={(e) => handleStyleChange('headerShadow', e.target.value, 'header_main')}
                className="h-8 text-xs"
                placeholder="0 1px 3px rgba(0,0,0,0.1)"
              />
            </div>
          </div>
        </SectionHeader>

        {/* Logo */}
        <SectionHeader
          title="Logo & Branding"
          section="logo"
          expanded={expandedSections.logo}
          onToggle={toggleSection}
        >
          <div className="space-y-3 p-3">
            <div>
              <Label className="text-xs">Logo URL</Label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={headerStyles.logoUrl}
                  onChange={(e) => handleStyleChange('logoUrl', e.target.value, 'store_logo')}
                  className="flex-1 h-8 text-xs"
                  placeholder="https://..."
                />
                <Button size="sm" variant="outline" className="h-8 px-2">
                  <Upload className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-1">Upload logo via Media Storage</p>
            </div>

            <div>
              <Label className="text-xs">Store Name</Label>
              <Input
                type="text"
                value={headerStyles.storeName}
                onChange={(e) => handleStyleChange('storeName', e.target.value, 'store_logo')}
                className="h-8 text-xs"
                placeholder="My Store"
              />
            </div>

            <div>
              <Label className="text-xs">Store Name Color</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={headerStyles.storeNameColor}
                  onChange={(e) => handleStyleChange('storeNameColor', e.target.value, 'store_logo')}
                  className="w-12 h-8 p-1"
                />
                <Input
                  type="text"
                  value={headerStyles.storeNameColor}
                  onChange={(e) => handleStyleChange('storeNameColor', e.target.value, 'store_logo')}
                  className="flex-1 h-8 text-xs"
                  placeholder="#111827"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Store Name Size</Label>
              <Input
                type="text"
                value={headerStyles.storeNameSize}
                onChange={(e) => handleStyleChange('storeNameSize', e.target.value, 'store_logo')}
                className="h-8 text-xs"
                placeholder="1.25rem"
              />
            </div>

            <div>
              <Label className="text-xs">Font Weight</Label>
              <select
                value={headerStyles.storeNameWeight}
                onChange={(e) => handleStyleChange('storeNameWeight', e.target.value, 'store_logo')}
                className="w-full h-8 text-xs border rounded px-2"
              >
                <option value="400">Normal (400)</option>
                <option value="500">Medium (500)</option>
                <option value="600">Semibold (600)</option>
                <option value="700">Bold (700)</option>
                <option value="800">Extra Bold (800)</option>
              </select>
            </div>
          </div>
        </SectionHeader>

        {/* Search Bar */}
        <SectionHeader
          title="Search Bar"
          section="searchBar"
          expanded={expandedSections.searchBar}
          onToggle={toggleSection}
        >
          <div className="space-y-3 p-3">
            <div>
              <Label className="text-xs">Background Color</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={headerStyles.searchBg}
                  onChange={(e) => handleStyleChange('searchBg', e.target.value, 'search_bar')}
                  className="w-12 h-8 p-1"
                />
                <Input
                  type="text"
                  value={headerStyles.searchBg}
                  onChange={(e) => handleStyleChange('searchBg', e.target.value, 'search_bar')}
                  className="flex-1 h-8 text-xs"
                  placeholder="#ffffff"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Border Color</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  type="color"
                  value={headerStyles.searchBorder}
                  onChange={(e) => handleStyleChange('searchBorder', e.target.value, 'search_bar')}
                  className="w-12 h-8 p-1"
                />
                <Input
                  type="text"
                  value={headerStyles.searchBorder}
                  onChange={(e) => handleStyleChange('searchBorder', e.target.value, 'search_bar')}
                  className="flex-1 h-8 text-xs"
                  placeholder="#d1d5db"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Border Radius</Label>
              <Input
                type="text"
                value={headerStyles.searchBorderRadius}
                onChange={(e) => handleStyleChange('searchBorderRadius', e.target.value, 'search_bar')}
                className="h-8 text-xs mt-1"
                placeholder="0.5rem"
              />
            </div>
          </div>
        </SectionHeader>

        {/* Navigation */}
        <SectionHeader
          title="Navigation Bar"
          section="navigation"
          expanded={expandedSections.navigation}
          onToggle={toggleSection}
        >
          <div className="space-y-3 p-3">
            <div>
              <Label className="text-xs font-semibold">Navbar Background</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  type="color"
                  value={headerStyles.navBarBg}
                  onChange={(e) => handleStyleChange('navBarBg', e.target.value, 'navigation_bar')}
                  className="w-12 h-8 p-1"
                />
                <Input
                  type="text"
                  value={headerStyles.navBarBg}
                  onChange={(e) => handleStyleChange('navBarBg', e.target.value, 'navigation_bar')}
                  className="flex-1 h-8 text-xs"
                  placeholder="#F9FAFB"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold">Navbar Padding</Label>
              <Input
                type="text"
                value={headerStyles.navBarPadding}
                onChange={(e) => handleStyleChange('navBarPadding', e.target.value, 'navigation_bar')}
                className="h-8 text-xs mt-1"
                placeholder="0.75rem 0"
              />
            </div>

            <hr className="my-2" />

            <div>
              <Label className="text-xs font-semibold">Main Link Color</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  type="color"
                  value={headerStyles.navLinkColor}
                  onChange={(e) => handleStyleChange('navLinkColor', e.target.value, 'category_navigation')}
                  className="w-12 h-8 p-1"
                />
                <Input
                  type="text"
                  value={headerStyles.navLinkColor}
                  onChange={(e) => handleStyleChange('navLinkColor', e.target.value, 'category_navigation')}
                  className="flex-1 h-8 text-xs"
                  placeholder="#374151"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold">Main Link Hover Color</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  type="color"
                  value={headerStyles.navLinkHoverColor}
                  onChange={(e) => handleStyleChange('navLinkHoverColor', e.target.value, 'category_navigation')}
                  className="w-12 h-8 p-1"
                />
                <Input
                  type="text"
                  value={headerStyles.navLinkHoverColor}
                  onChange={(e) => handleStyleChange('navLinkHoverColor', e.target.value, 'category_navigation')}
                  className="flex-1 h-8 text-xs"
                  placeholder="#2563EB"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Font Size</Label>
              <Input
                type="text"
                value={headerStyles.navLinkSize}
                onChange={(e) => handleStyleChange('navLinkSize', e.target.value, 'category_navigation')}
                className="h-8 text-xs mt-1"
                placeholder="0.875rem"
              />
            </div>

            <div>
              <Label className="text-xs">Font Weight</Label>
              <select
                value={headerStyles.navLinkWeight}
                onChange={(e) => handleStyleChange('navLinkWeight', e.target.value, 'category_navigation')}
                className="w-full h-8 text-xs border rounded px-2 mt-1"
              >
                <option value="400">Normal (400)</option>
                <option value="500">Medium (500)</option>
                <option value="600">Semibold (600)</option>
                <option value="700">Bold (700)</option>
              </select>
            </div>

            <hr className="my-2" />
            <p className="text-xs font-semibold text-gray-700">Subcategory Styling</p>

            <div>
              <Label className="text-xs">Subcategory Link Color</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  type="color"
                  value={headerStyles.subcategoryLinkColor}
                  onChange={(e) => handleStyleChange('subcategoryLinkColor', e.target.value, 'category_navigation')}
                  className="w-12 h-8 p-1"
                />
                <Input
                  type="text"
                  value={headerStyles.subcategoryLinkColor}
                  onChange={(e) => handleStyleChange('subcategoryLinkColor', e.target.value, 'category_navigation')}
                  className="flex-1 h-8 text-xs"
                  placeholder="#6B7280"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Subcategory Hover Color</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  type="color"
                  value={headerStyles.subcategoryLinkHoverColor}
                  onChange={(e) => handleStyleChange('subcategoryLinkHoverColor', e.target.value, 'category_navigation')}
                  className="w-12 h-8 p-1"
                />
                <Input
                  type="text"
                  value={headerStyles.subcategoryLinkHoverColor}
                  onChange={(e) => handleStyleChange('subcategoryLinkHoverColor', e.target.value, 'category_navigation')}
                  className="flex-1 h-8 text-xs"
                  placeholder="#2563EB"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Subcategory Background</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  type="color"
                  value={headerStyles.subcategoryBgColor}
                  onChange={(e) => handleStyleChange('subcategoryBgColor', e.target.value, 'category_navigation')}
                  className="w-12 h-8 p-1"
                />
                <Input
                  type="text"
                  value={headerStyles.subcategoryBgColor}
                  onChange={(e) => handleStyleChange('subcategoryBgColor', e.target.value, 'category_navigation')}
                  className="flex-1 h-8 text-xs"
                  placeholder="#ffffff"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Subcategory Hover Background</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  type="color"
                  value={headerStyles.subcategoryBgHoverColor}
                  onChange={(e) => handleStyleChange('subcategoryBgHoverColor', e.target.value, 'category_navigation')}
                  className="w-12 h-8 p-1"
                />
                <Input
                  type="text"
                  value={headerStyles.subcategoryBgHoverColor}
                  onChange={(e) => handleStyleChange('subcategoryBgHoverColor', e.target.value, 'category_navigation')}
                  className="flex-1 h-8 text-xs"
                  placeholder="#F3F4F6"
                />
              </div>
            </div>
          </div>
        </SectionHeader>

        {/* User Actions */}
        <SectionHeader
          title="User Actions & Sign In"
          section="userActions"
          expanded={expandedSections.userActions}
          onToggle={toggleSection}
        >
          <div className="space-y-3 p-3">
            <div>
              <Label className="text-xs">Icon Color</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  type="color"
                  value={headerStyles.actionIconColor}
                  onChange={(e) => handleStyleChange('actionIconColor', e.target.value, 'actions_section')}
                  className="w-12 h-8 p-1"
                />
                <Input
                  type="text"
                  value={headerStyles.actionIconColor}
                  onChange={(e) => handleStyleChange('actionIconColor', e.target.value, 'actions_section')}
                  className="flex-1 h-8 text-xs"
                  placeholder="#374151"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Cart Badge Background</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  type="color"
                  value={headerStyles.cartBadgeBg}
                  onChange={(e) => handleStyleChange('cartBadgeBg', e.target.value, 'mini_cart')}
                  className="w-12 h-8 p-1"
                />
                <Input
                  type="text"
                  value={headerStyles.cartBadgeBg}
                  onChange={(e) => handleStyleChange('cartBadgeBg', e.target.value, 'mini_cart')}
                  className="flex-1 h-8 text-xs"
                  placeholder="#3b82f6"
                />
              </div>
            </div>

            <hr className="my-2" />
            <p className="text-xs font-semibold text-gray-700">Sign In Button</p>

            <div>
              <Label className="text-xs">Button Background</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  type="color"
                  value={headerStyles.userMenuBg}
                  onChange={(e) => handleStyleChange('userMenuBg', e.target.value, 'user_account_menu')}
                  className="w-12 h-8 p-1"
                />
                <Input
                  type="text"
                  value={headerStyles.userMenuBg}
                  onChange={(e) => handleStyleChange('userMenuBg', e.target.value, 'user_account_menu')}
                  className="flex-1 h-8 text-xs"
                  placeholder="#2563EB"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Button Hover Background</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  type="color"
                  value={headerStyles.userMenuHoverBg}
                  onChange={(e) => handleStyleChange('userMenuHoverBg', e.target.value, 'user_account_menu')}
                  className="w-12 h-8 p-1"
                />
                <Input
                  type="text"
                  value={headerStyles.userMenuHoverBg}
                  onChange={(e) => handleStyleChange('userMenuHoverBg', e.target.value, 'user_account_menu')}
                  className="flex-1 h-8 text-xs"
                  placeholder="#1D4ED8"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Button Text Color</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  type="color"
                  value={headerStyles.userMenuTextColor}
                  onChange={(e) => handleStyleChange('userMenuTextColor', e.target.value, 'user_account_menu')}
                  className="w-12 h-8 p-1"
                />
                <Input
                  type="text"
                  value={headerStyles.userMenuTextColor}
                  onChange={(e) => handleStyleChange('userMenuTextColor', e.target.value, 'user_account_menu')}
                  className="flex-1 h-8 text-xs"
                  placeholder="#ffffff"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Button Border Radius</Label>
              <Input
                type="text"
                value={headerStyles.userMenuBorderRadius}
                onChange={(e) => handleStyleChange('userMenuBorderRadius', e.target.value, 'user_account_menu')}
                className="h-8 text-xs mt-1"
                placeholder="0.5rem"
              />
            </div>
          </div>
        </SectionHeader>

        {/* Icon Styles */}
        <SectionHeader
          title="Icon Styles"
          section="iconStyles"
          expanded={expandedSections.iconStyles}
          onToggle={toggleSection}
        >
          <div className="space-y-3 p-3">
            <p className="text-xs text-gray-600 mb-3">Choose icon variants for cart, wishlist, and user icons (applies to both desktop and mobile)</p>

            <div>
              <Label className="text-xs font-semibold">Cart Icon</Label>
              <select
                value={headerStyles.cartIconVariant}
                onChange={(e) => handleIconVariantChange('cartIconVariant', e.target.value)}
                className="w-full h-8 text-xs border rounded px-2 mt-1"
              >
                <option value="outline">Outline (Default)</option>
                <option value="filled">Filled</option>
                <option value="bag">Shopping Bag</option>
                <option value="bag-filled">Shopping Bag (Filled)</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">Icon style for mini cart button</p>
            </div>

            <div>
              <Label className="text-xs font-semibold">Wishlist Icon</Label>
              <select
                value={headerStyles.wishlistIconVariant}
                onChange={(e) => handleIconVariantChange('wishlistIconVariant', e.target.value)}
                className="w-full h-8 text-xs border rounded px-2 mt-1"
              >
                <option value="outline">Heart Outline (Default)</option>
                <option value="filled">Heart Filled</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">Icon style for wishlist (desktop and mobile)</p>
            </div>

            <div>
              <Label className="text-xs font-semibold">User Icon</Label>
              <select
                value={headerStyles.userIconVariant}
                onChange={(e) => handleIconVariantChange('userIconVariant', e.target.value)}
                className="w-full h-8 text-xs border rounded px-2 mt-1"
              >
                <option value="outline">User Outline (Default)</option>
                <option value="filled">User Filled</option>
                <option value="circle">User Circle</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">Icon style for user account (desktop and mobile)</p>
            </div>
          </div>
        </SectionHeader>

        {/* Mobile Menu */}
        <SectionHeader
          title="Mobile Menu"
          section="mobile"
          expanded={expandedSections.mobile}
          onToggle={toggleSection}
        >
          <div className="space-y-3 p-3">
            <div>
              <Label className="text-xs">Menu Background</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={headerStyles.mobileMenuBg}
                  onChange={(e) => handleStyleChange('mobileMenuBg', e.target.value, 'mobile_menu')}
                  className="w-12 h-8 p-1"
                />
                <Input
                  type="text"
                  value={headerStyles.mobileMenuBg}
                  onChange={(e) => handleStyleChange('mobileMenuBg', e.target.value, 'mobile_menu')}
                  className="flex-1 h-8 text-xs"
                  placeholder="#ffffff"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Link Color</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  type="color"
                  value={headerStyles.mobileMenuLinkColor}
                  onChange={(e) => handleStyleChange('mobileMenuLinkColor', e.target.value, 'mobile_navigation')}
                  className="w-12 h-8 p-1"
                />
                <Input
                  type="text"
                  value={headerStyles.mobileMenuLinkColor}
                  onChange={(e) => handleStyleChange('mobileMenuLinkColor', e.target.value, 'mobile_navigation')}
                  className="flex-1 h-8 text-xs"
                  placeholder="#374151"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Link Hover Color</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  type="color"
                  value={headerStyles.mobileMenuLinkHoverColor}
                  onChange={(e) => handleStyleChange('mobileMenuLinkHoverColor', e.target.value, 'mobile_navigation')}
                  className="w-12 h-8 p-1"
                />
                <Input
                  type="text"
                  value={headerStyles.mobileMenuLinkHoverColor}
                  onChange={(e) => handleStyleChange('mobileMenuLinkHoverColor', e.target.value, 'mobile_navigation')}
                  className="flex-1 h-8 text-xs"
                  placeholder="#111827"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Item Hover Background</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  type="color"
                  value={headerStyles.mobileMenuItemHoverBg}
                  onChange={(e) => handleStyleChange('mobileMenuItemHoverBg', e.target.value, 'mobile_navigation')}
                  className="w-12 h-8 p-1"
                />
                <Input
                  type="text"
                  value={headerStyles.mobileMenuItemHoverBg}
                  onChange={(e) => handleStyleChange('mobileMenuItemHoverBg', e.target.value, 'mobile_navigation')}
                  className="flex-1 h-8 text-xs"
                  placeholder="#f3f4f6"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Hamburger Icon Color</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={headerStyles.mobileMenuIconColor}
                  onChange={(e) => handleStyleChange('mobileMenuIconColor', e.target.value, 'mobile_menu_button')}
                  className="w-12 h-8 p-1"
                />
                <Input
                  type="text"
                  value={headerStyles.mobileMenuIconColor}
                  onChange={(e) => handleStyleChange('mobileMenuIconColor', e.target.value, 'mobile_menu_button')}
                  className="flex-1 h-8 text-xs"
                  placeholder="#374151"
                />
              </div>
            </div>
          </div>
        </SectionHeader>

      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <p className="text-xs text-gray-600">
          Changes are saved automatically when you modify values.
        </p>
      </div>
    </div>
  );
};

export default HeaderEditorSidebar;
