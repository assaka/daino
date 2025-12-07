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
// Slots come from database via UnifiedSlotsEditor - no static defaults needed

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