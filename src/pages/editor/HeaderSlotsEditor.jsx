/**
 * HeaderSlotsEditor - Header and Navigation Customization
 * - Unified editor for header layout
 * - AI enhancement ready
 * - Mobile and desktop views
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Menu, Search } from "lucide-react";
import UnifiedSlotsEditor from "@/components/editor/UnifiedSlotsEditor";
import { useStoreSelection } from '@/contexts/StoreSelectionContext';
import { Store } from '@/api/entities';

// Create default slots function - fetches from backend API as fallback when no draft exists
const createDefaultSlots = async () => {
  try {
    const response = await fetch('/api/slot-configurations/defaults/header');
    const result = await response.json();
    if (!result.success || !result.data?.slots) {
      console.error('Invalid header config from API');
      return null;
    }
    return result.data.slots;
  } catch (error) {
    console.error('Failed to load header config:', error);
    return null;
  }
};

/**
 * HeaderSlotsEditor Component
 */
export default function HeaderSlotsEditor() {
  // State for mobile menu and search toggles
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  // Get selected store from admin context
  const { selectedStore } = useStoreSelection();
  const [storeData, setStoreData] = useState(null);

  // Load full store data including settings
  useEffect(() => {
    const loadStoreData = async () => {
      if (selectedStore?.id) {
        try {
          const fullStoreResponse = await Store.findById(selectedStore.id);

          // Store.findById returns an array, so we need to get the first item
          const fullStoreResponse_normalized = Array.isArray(fullStoreResponse)
            ? fullStoreResponse[0]
            : fullStoreResponse;

          // Handle nested data structure - store data might be in data.settings, not settings
          const store = fullStoreResponse_normalized?.data || fullStoreResponse_normalized;

          setStoreData(store);
        } catch (error) {
          console.error('Failed to load store data:', error);
        }
      }
    };
    loadStoreData();
  }, [selectedStore]);

  // Generate header context with interactive state - memoized with storeData dependency
  const generateHeaderContext = useCallback((viewMode) => {
    const context = {
      isEditor: true,
      responsiveMode: viewMode,
      store: storeData || {
        id: 1,
        name: 'Demo Store',
        slug: 'demo-store',
        logo_url: null
      },
      settings: {
        hide_header_search: storeData?.settings?.hide_header_search || false,
        hide_header_cart: storeData?.settings?.hide_header_cart || false,
        show_permanent_search: storeData?.settings?.show_permanent_search || false,
        show_language_selector: storeData?.settings?.show_language_selector === true,
        allowed_countries: storeData?.settings?.allowed_countries || ['US', 'CA', 'UK'],
        theme: storeData?.settings?.theme || {
          primary_button_color: '#2563EB',
          add_to_cart_button_color: '#10B981'
        }
      },
    user: null,
    userLoading: false,
    categories: [
    {
      id: 1,
      name: 'Electronics',
      slug: 'electronics',
      parent_id: null,
      children: [
        { id: 11, name: 'Computers', slug: 'computers', parent_id: 1, children: [] },
        { id: 12, name: 'Phones & Tablets', slug: 'phones-tablets', parent_id: 1, children: [] },
        { id: 13, name: 'Audio', slug: 'audio', parent_id: 1, children: [] }
      ]
    },
    {
      id: 2,
      name: 'Clothing',
      slug: 'clothing',
      parent_id: null,
      children: [
        { id: 21, name: 'Men', slug: 'men', parent_id: 2, children: [] },
        { id: 22, name: 'Women', slug: 'women', parent_id: 2, children: [] },
        { id: 23, name: 'Kids', slug: 'kids', parent_id: 2, children: [] }
      ]
    },
    {
      id: 3,
      name: 'Home & Garden',
      slug: 'home-garden',
      parent_id: null,
      children: [
        { id: 31, name: 'Furniture', slug: 'furniture', parent_id: 3, children: [] },
        { id: 32, name: 'Decor', slug: 'decor', parent_id: 3, children: [] },
        { id: 33, name: 'Garden', slug: 'garden', parent_id: 3, children: [] }
      ]
    }
  ],
  languages: [
    { id: 1, code: 'en', name: 'English', flag_icon: '🇺🇸' },
    { id: 2, code: 'es', name: 'Español', flag_icon: '🇪🇸' }
    ],
    currentLanguage: 'en',
    selectedCountry: 'US',
    mobileMenuOpen: mobileMenuOpen,
    mobileSearchOpen: mobileSearchOpen,
    setCurrentLanguage: () => {},
    setSelectedCountry: () => {},
    setMobileMenuOpen: setMobileMenuOpen,
    setMobileSearchOpen: setMobileSearchOpen,
    handleCustomerLogout: () => {},
    navigate: () => {},
    location: { pathname: '/' }
  };

    return context;
  }, [storeData, mobileMenuOpen, mobileSearchOpen]);

  // Header Editor Configuration - memoized with generateHeaderContext dependency
  // Config structure (views, cmsBlocks, slots) comes from database via UnifiedSlotsEditor
  const headerEditorConfig = useMemo(() => ({
    pageType: 'header',
    pageName: 'Header',
    slotType: 'header_layout',
    defaultViewMode: 'default',
    viewModes: [{ key: 'default', label: 'Header Layout', icon: null }],
    slotComponents: {},
    generateContext: generateHeaderContext,
    createDefaultSlots,
    viewModeAdjustments: {},
    cmsBlockPositions: ['header_top', 'header_middle', 'header_bottom', 'navigation_before', 'navigation_after']
  }), [generateHeaderContext]);

  return (
    <UnifiedSlotsEditor
      config={headerEditorConfig}
    />
  );
}
