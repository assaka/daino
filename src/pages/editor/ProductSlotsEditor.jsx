/**
 * ProductSlotsEditor - Refactored to use UnifiedSlotsEditor
 * - Uses preprocessSlotData for consistent rendering with storefront
 * - AI enhancement ready
 * - Maintainable structure
 */

import { Package } from "lucide-react";
import UnifiedSlotsEditor from "@/components/editor/UnifiedSlotsEditor";
import { generateMockProductContext } from '@/utils/mockProductData';
import { preprocessSlotData } from '@/utils/slotDataPreprocessor';

// Create default slots function - fetches from backend API as fallback when no draft exists
const createDefaultSlots = async () => {
  try {
    const response = await fetch('/api/slot-configurations/defaults/product');
    const result = await response.json();
    if (!result.success || !result.data?.slots) {
      console.error('Invalid product config from API');
      return null;
    }
    return result.data.slots;
  } catch (error) {
    console.error('Failed to load product config:', error);
    return null;
  }
};

// Product Editor Configuration
const productEditorConfig = {
  pageType: 'product',
  pageName: 'Product Detail',
  slotType: 'product_layout',
  defaultViewMode: 'default',
  viewModes: [
    {
      key: 'default',
      label: 'Default View',
      icon: Package
    }
  ],
  // Generate context using preprocessSlotData for consistency with storefront
  generateContext: (viewMode, selectedStore) => {
    const storeSettings = selectedStore?.settings || {};
    const mockContext = generateMockProductContext(storeSettings);

    // Use preprocessSlotData for consistent rendering
    return preprocessSlotData('product', mockContext, selectedStore || {}, storeSettings, {
      translations: {},
      productLabels: []
    });
  },
  createDefaultSlots,
  cmsBlockPositions: ['product_above', 'product_below']
};

const ProductSlotsEditor = ({
  mode = 'edit',
  onSave,
  viewMode = 'default'
}) => {
  return (
    <UnifiedSlotsEditor
      config={productEditorConfig}
      mode={mode}
      onSave={onSave}
      viewMode={viewMode}
    />
  );
};

export default ProductSlotsEditor;