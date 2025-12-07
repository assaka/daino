/**
 * ProductSlotsEditor - Refactored to use UnifiedSlotsEditor
 * - Consistent with other slot editors
 * - AI enhancement ready
 * - Maintainable structure
 */

import { Package } from "lucide-react";
import UnifiedSlotsEditor from "@/components/editor/UnifiedSlotsEditor";
import { generateMockProductContext } from '@/utils/mockProductData';
// Unified components are now handled by UnifiedSlotRenderer automatically

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
  // slotComponents are now handled by UnifiedSlotRenderer's component registry
  generateContext: (viewMode, selectedStore) => {
    // Pass real store settings to mock context generator
    const storeSettings = selectedStore?.settings || null;
    return generateMockProductContext(storeSettings);
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