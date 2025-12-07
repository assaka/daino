/**
 * CartSlotsEditor - Refactored to use UnifiedSlotsEditor
 * - Consistent with other slot editors
 * - AI enhancement ready
 * - Maintainable structure
 */

import { ShoppingCart, Package } from "lucide-react";
import UnifiedSlotsEditor from "@/components/editor/UnifiedSlotsEditor";
import { getSlotComponent } from '@/components/editor/slot/SlotComponentRegistry';
import { formatPrice } from '@/utils/priceUtils';

// Create default slots function - loads from static config as fallback when no draft exists
const createDefaultSlots = async () => {
  try {
    const configModule = await import('@/components/editor/slot/configs/cart-config');
    const cartConfig = configModule.cartConfig || configModule.default;
    if (!cartConfig || !cartConfig.slots) {
      console.error('Invalid cart config - no slots found');
      return null;
    }
    return cartConfig.slots;
  } catch (error) {
    console.error('Failed to load cart config:', error);
    return null;
  }
};

// Generate cart context based on view mode
const generateCartContext = (viewMode) => ({
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
  currencySymbol: '🔴20',
  appliedCoupon: null,
  couponCode: '',
  setCouponCode: () => {},
  handleApplyCoupon: () => {},
  handleRemoveCoupon: () => {},
  updateQuantity: () => {},
  removeItem: () => {},
  handleCheckout: () => {},
  calculateItemTotal: (item) => item.price * item.quantity,
  formatPrice: formatPrice
});

// Cart Editor Configuration
// Config structure (views, cmsBlocks, slots) comes from database via UnifiedSlotsEditor
const cartEditorConfig = {
  pageType: 'cart',
  pageName: 'Cart',
  slotType: 'cart_layout',
  defaultViewMode: 'emptyCart',
  viewModes: [
    { key: 'emptyCart', label: 'Empty Cart', icon: ShoppingCart },
    { key: 'withProducts', label: 'With Products', icon: Package }
  ],
  slotComponents: {},
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
  return (
    <UnifiedSlotsEditor
      config={cartEditorConfig}
      mode={mode}
      onSave={onSave}
      viewMode={viewMode}
    />
  );
};

export default CartSlotsEditor;
