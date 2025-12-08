/**
 * SuccessSlotsEditor - Order success/confirmation page slot editor
 * - Uses UnifiedSlotsEditor
 * - Supports success page customization
 * - Maintainable structure
 */

import { CheckCircle, Package } from "lucide-react";
import UnifiedSlotsEditor from "@/components/editor/UnifiedSlotsEditor";
import { preprocessSlotData } from '@/utils/slotDataPreprocessor';

// Create default slots function - fetches from backend API as fallback when no draft exists
const createDefaultSlots = async () => {
  try {
    const response = await fetch('/api/slot-configurations/defaults/success');
    const result = await response.json();
    if (!result.success || !result.data?.slots) {
      console.error('Invalid success config from API');
      return null;
    }
    return result.data.slots;
  } catch (error) {
    console.error('Failed to load success config:', error);
    return null;
  }
};

// Generate success page context based on view mode
const generateSuccessContext = (viewMode, selectedStore) => {
  const storeSettings = selectedStore?.settings || {};

  const rawData = {
    order: viewMode === 'withOrder' ? {
      id: '12345',
      date: new Date().toLocaleDateString(),
      items: [
        {
          id: 1,
          name: 'Sample Product 1',
          image_url: '/sample-product.jpg',
          quantity: 2,
          price: 29.99
        },
        {
          id: 2,
          name: 'Sample Product 2',
          image_url: '/sample-product2.jpg',
          quantity: 1,
          price: 49.99
        }
      ],
      subtotal: 109.97,
      shipping: 10.00,
      tax: 8.00,
      total: 127.97,
      status: 'confirmed'
    } : null,
    shipping: {
      name: 'John Doe',
      address: '123 Main Street',
      city: 'New York',
      state: 'NY',
      zip: '10001',
      country: 'United States',
      method: 'Standard Shipping (5-7 business days)'
    },
    payment: {
      method: 'Credit Card',
      last4: '4242',
      status: 'Paid'
    },
    tracking: {
      number: null,
      carrier: null,
      url: null
    }
  };

  // Use preprocessSlotData for consistent rendering
  return preprocessSlotData('success', rawData, selectedStore || {}, storeSettings, {
    translations: {}
  });
};

// Success Editor Configuration
// Config structure (views, cmsBlocks, slots) comes from database via UnifiedSlotsEditor
const successEditorConfig = {
  pageType: 'success',
  pageName: 'Order Success',
  slotType: 'success_layout',
  defaultViewMode: 'empty',
  viewModes: [
    { key: 'empty', label: 'Empty', icon: CheckCircle },
    { key: 'withOrder', label: 'With Order', icon: Package }
  ],
  slotComponents: {},
  generateContext: generateSuccessContext,
  createDefaultSlots,
  viewModeAdjustments: {},
  cmsBlockPositions: ['success_top', 'success_bottom']
};

const SuccessSlotsEditor = ({
  mode = 'edit',
  onSave,
  viewMode = 'empty'
}) => {
  return (
    <UnifiedSlotsEditor
      config={successEditorConfig}
      mode={mode}
      onSave={onSave}
      viewMode={viewMode}
    />
  );
};

export default SuccessSlotsEditor;
