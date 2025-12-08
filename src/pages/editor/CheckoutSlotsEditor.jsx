/**
 * CheckoutSlotsEditor - Checkout page slot editor
 * - Uses preprocessSlotData for consistent rendering with storefront
 * - Supports checkout customization
 * - Maintainable structure
 */

import { ShoppingBag, CreditCard } from "lucide-react";
import UnifiedSlotsEditor from "@/components/editor/UnifiedSlotsEditor";
import { preprocessSlotData } from '@/utils/slotDataPreprocessor';

// Create default slots function - fetches from backend API as fallback when no draft exists
const createDefaultSlots = async () => {
  try {
    const response = await fetch('/api/slot-configurations/defaults/checkout');
    const result = await response.json();
    if (!result.success || !result.data?.slots) {
      console.error('Invalid checkout config from API');
      return null;
    }
    return result.data.slots;
  } catch (error) {
    console.error('Failed to load checkout config:', error);
    return null;
  }
};

// Generate checkout context based on view mode
const generateCheckoutContext = (viewMode, selectedStore) => {
  const storeSettings = selectedStore?.settings || {};

  const rawData = {
    cartItems: [
      {
        id: 1,
        product: { name: 'Sample Product', image_url: '/sample-product.jpg' },
        quantity: 2,
        price: 29.99
      }
    ],
    subtotal: 59.98,
    tax: 4.80,
    total: 64.78,
    shipping: {
      name: '',
      address: '',
      city: '',
      state: '',
      zip: ''
    },
    payment: {
      method: '',
      cardNumber: '',
      expiry: '',
      cvv: ''
    },
    isProcessing: viewMode === 'processing'
  };

  // Use preprocessSlotData for consistent rendering
  return preprocessSlotData('checkout', rawData, selectedStore || {}, storeSettings, {
    translations: {}
  });
};

// Checkout Editor Configuration
const checkoutEditorConfig = {
  pageType: 'checkout',
  pageName: 'Checkout',
  slotType: 'checkout_layout',
  defaultViewMode: 'default',
  viewModes: [
    { key: 'default', label: 'Default', icon: ShoppingBag },
    { key: 'processing', label: 'Processing', icon: CreditCard }
  ],
  generateContext: generateCheckoutContext,
  createDefaultSlots,
  viewModeAdjustments: {},
  cmsBlockPositions: ['checkout_top', 'checkout_bottom', 'checkout_sidebar']
};

const CheckoutSlotsEditor = ({
  mode = 'edit',
  onSave,
  viewMode = 'default'
}) => {
  return (
    <UnifiedSlotsEditor
      config={checkoutEditorConfig}
      mode={mode}
      onSave={onSave}
      viewMode={viewMode}
    />
  );
};

export default CheckoutSlotsEditor;
