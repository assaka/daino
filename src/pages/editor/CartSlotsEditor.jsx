/**
 * CartSlotsEditor - Refactored to use UnifiedSlotsEditor
 * - Uses preprocessSlotData for consistent rendering with storefront
 * - AI enhancement ready
 * - Maintainable structure
 */

import { useMemo, useCallback } from 'react';
import { ShoppingCart, Package } from "lucide-react";
import UnifiedSlotsEditor from "@/components/editor/UnifiedSlotsEditor";
import { formatPrice } from '@/utils/priceUtils';
import { preprocessSlotData } from '@/utils/slotDataPreprocessor';
import { useStoreSelection } from '@/contexts/StoreSelectionContext';
import { useCategories } from '@/hooks/useApiQueries';
import useDraftConfiguration from '@/hooks/useDraftConfiguration';
import { EditorStoreProvider } from '@/components/editor/EditorStoreProvider';
import { buildEditorHeaderContext } from '@/components/editor/editorHeaderUtils';
import { useAIWorkspace, PAGE_TYPES } from '@/contexts/AIWorkspaceContext';
import slotConfigurationService from '@/services/slotConfigurationService';

// Create default slots function - fetches from backend API as fallback when no draft exists
const createDefaultSlots = async () => {
  try {
    const response = await fetch('/api/slot-configurations/defaults/cart');
    const result = await response.json();
    if (!result.success || !result.data?.slots) {
      console.error('Invalid cart config from API');
      return null;
    }
    return result.data.slots;
  } catch (error) {
    console.error('Failed to load cart config:', error);
    return null;
  }
};

// Generate cart context based on view mode
const generateCartContext = (viewMode, selectedStore) => {
  const storeSettings = selectedStore?.settings || {};

  const rawData = {
    cartItems: viewMode === 'withProducts' ? [
      {
        id: 1,
        product_id: 1,
        quantity: 2,
        price: 29.99,
        product: { id: 1, name: 'Sample Product 1', image_url: '/sample-product.jpg' },
        selected_options: []
      },
      {
        id: 2,
        product_id: 2,
        quantity: 1,
        price: 49.99,
        product: { id: 2, name: 'Sample Product 2', image_url: '/sample-product2.jpg' },
        selected_options: [{ name: 'Size', value: 'Large', price: 5.00 }]
      }
    ] : [],
    subtotal: 109.97,
    discount: 10.00,
    tax: 8.00,
    total: 107.97,
    currencySymbol: '$',
    appliedCoupon: null,
    couponCode: '',
    setCouponCode: () => {},
    handleApplyCoupon: () => {},
    handleRemoveCoupon: () => {},
    updateQuantity: () => {},
    removeItem: () => {},
    handleCheckout: () => {},
    formatDisplayPrice: formatPrice
  };

  // Use preprocessSlotData for consistent rendering
  return preprocessSlotData('cart', rawData, selectedStore || {}, storeSettings, {
    translations: {}
  });
};

// Cart Editor Configuration
const cartEditorConfig = {
  pageType: 'cart',
  pageName: 'Cart',
  slotType: 'cart_layout',
  defaultViewMode: 'emptyCart',
  viewModes: [
    { key: 'emptyCart', label: 'Empty Cart', icon: ShoppingCart },
    { key: 'withProducts', label: 'With Products', icon: Package }
  ],
  generateContext: generateCartContext,
  createDefaultSlots,
  viewModeAdjustments: {
    content_area: {
      colSpan: {
        shouldAdjust: (currentValue) => typeof currentValue === 'number',
        newValue: {
          emptyCart: 12,
          withProducts: 'col-span-12 sm:col-span-12 lg:col-span-8'
        }
      }
    }
  },
  cmsBlockPositions: ['cart_top', 'cart_bottom', 'cart_sidebar']
};

const CartSlotsEditor = ({
  mode = 'edit',
  onSave,
  viewMode = 'emptyCart'
}) => {
  const { selectedStore, getSelectedStoreId } = useStoreSelection();
  const storeId = getSelectedStoreId();

  // Get selectPage from AIWorkspace to enable "Edit Header" functionality
  const { selectPage } = useAIWorkspace();

  // Fetch categories for header context
  const { data: categories = [] } = useCategories(storeId, { enabled: !!storeId });

  // Fetch header DRAFT configuration for combined header + page editing
  // Use useDraftConfiguration to always load draft (not published) in editor
  const { draftConfig: headerDraftConfig } = useDraftConfiguration(storeId, 'header');
  const headerConfig = headerDraftConfig?.configuration || null;

  // Header save callback - saves header config changes to database
  const handleHeaderSave = useCallback(async (headerConfigToSave) => {
    if (!storeId) return;
    try {
      await slotConfigurationService.saveConfiguration(storeId, headerConfigToSave, 'header');
      console.log('[CartSlotsEditor] Header config saved');
    } catch (error) {
      console.error('[CartSlotsEditor] Failed to save header config:', error);
    }
  }, [storeId]);

  // Build config with header integration
  const enhancedConfig = useMemo(() => ({
    ...cartEditorConfig,
    includeHeader: true,
    headerSlots: headerConfig?.slots || null,
    headerContext: buildEditorHeaderContext({
      store: selectedStore,
      settings: selectedStore?.settings || {},
      categories,
      viewport: 'desktop',
      pathname: '/cart'
    }),
    onEditHeader: () => selectPage(PAGE_TYPES.HEADER),
    onHeaderSave: handleHeaderSave
  }), [headerConfig, selectedStore, categories, selectPage, handleHeaderSave]);

  return (
    <EditorStoreProvider>
      <UnifiedSlotsEditor
        config={enhancedConfig}
        mode={mode}
        onSave={onSave}
        viewMode={viewMode}
      />
    </EditorStoreProvider>
  );
};

export default CartSlotsEditor;
