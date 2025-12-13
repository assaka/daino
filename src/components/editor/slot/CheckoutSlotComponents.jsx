/**
 * Checkout Slot Components
 * Unified components for checkout page
 */

import React from 'react';
import { createSlotComponent, registerSlotComponent } from './SlotComponentRegistry';
import { formatPrice } from '@/utils/priceUtils';

/**
 * CheckoutStepsSlot - Checkout progress steps
 */
const CheckoutStepsSlot = createSlotComponent({
  name: 'CheckoutStepsSlot',
  render: ({ slot, context }) => {
    return (
      <div className={slot.className} style={slot.styles}>
        <div className="flex justify-between mb-8">
          <div className="flex-1 text-center">
            <div className="w-10 h-10 bg-blue-600 text-white rounded-full mx-auto mb-2 flex items-center justify-center">1</div>
            <p className="text-sm font-medium">Shipping</p>
          </div>
          <div className="flex-1 text-center">
            <div className="w-10 h-10 bg-gray-200 text-gray-600 rounded-full mx-auto mb-2 flex items-center justify-center">2</div>
            <p className="text-sm">Payment</p>
          </div>
          <div className="flex-1 text-center">
            <div className="w-10 h-10 bg-gray-200 text-gray-600 rounded-full mx-auto mb-2 flex items-center justify-center">3</div>
            <p className="text-sm">Review</p>
          </div>
        </div>
      </div>
    );
  }
});

/**
 * ShippingFormSlot - Shipping address form
 */
const ShippingFormSlot = createSlotComponent({
  name: 'ShippingFormSlot',
  render: ({ slot, context }) => {
    return (
      <div className={slot.className} style={slot.styles}>
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Shipping Information</h2>
          <form className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                <input type="text" required className="w-full border border-gray-300 rounded-md px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                <input type="text" required className="w-full border border-gray-300 rounded-md px-3 py-2" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <input type="text" required className="w-full border border-gray-300 rounded-md px-3 py-2" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                <input type="text" required className="w-full border border-gray-300 rounded-md px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                <input type="text" required className="w-full border border-gray-300 rounded-md px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ZIP</label>
                <input type="text" required className="w-full border border-gray-300 rounded-md px-3 py-2" />
              </div>
            </div>
          </form>
        </div>
      </div>
    );
  }
});

/**
 * PaymentFormSlot - Payment information form
 */
const PaymentFormSlot = createSlotComponent({
  name: 'PaymentFormSlot',
  render: ({ slot, context }) => {
    return (
      <div className={slot.className} style={slot.styles}>
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Payment Information</h2>
          <form className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Card Number</label>
              <input type="text" required className="w-full border border-gray-300 rounded-md px-3 py-2" placeholder="1234 5678 9012 3456" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
                <input type="text" required className="w-full border border-gray-300 rounded-md px-3 py-2" placeholder="MM/YY" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CVV</label>
                <input type="text" required className="w-full border border-gray-300 rounded-md px-3 py-2" placeholder="123" />
              </div>
            </div>
          </form>
        </div>
      </div>
    );
  }
});

/**
 * OrderSummarySlot - Checkout order summary
 */
const OrderSummarySlot = createSlotComponent({
  name: 'OrderSummarySlot',
  render: ({ slot, context, variableContext }) => {
    const cartItems = variableContext?.cartItems || [];
    const subtotal = variableContext?.subtotal || 0;
    const tax = variableContext?.tax || 0;
    const total = variableContext?.total || 0;
    const taxDetails = variableContext?.taxDetails || null;

    return (
      <div className={slot.className} style={slot.styles}>
        <div className="bg-white rounded-lg shadow p-6 sticky top-4">
          <h2 className="text-xl font-semibold mb-4">Order Summary</h2>
          <div className="space-y-3 mb-4">
            <div className="flex justify-between text-sm">
              <span>Subtotal</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Shipping</span>
              <span>{formatPrice(0)}</span>
            </div>
            {tax > 0 && (
              <div className="flex justify-between text-sm">
                <span>
                  Tax
                  {taxDetails && taxDetails.country && taxDetails.effectiveRate > 0 && (
                    <span className="text-gray-500 text-xs ml-1">
                      ({taxDetails.country} {taxDetails.effectiveRate}%)
                    </span>
                  )}
                </span>
                <span>{formatPrice(tax)}</span>
              </div>
            )}
            <div className="border-t pt-3 flex justify-between font-bold">
              <span>Total</span>
              <span>{formatPrice(total)}</span>
            </div>
          </div>
          <button className="w-full btn-place-order text-white font-medium py-3 rounded-md">
            Place Order
          </button>
        </div>
      </div>
    );
  }
});

// Register all components
registerSlotComponent('CheckoutStepsSlot', CheckoutStepsSlot);
registerSlotComponent('ShippingFormSlot', ShippingFormSlot);
registerSlotComponent('PaymentFormSlot', PaymentFormSlot);
registerSlotComponent('OrderSummarySlot', OrderSummarySlot);

export {
  CheckoutStepsSlot,
  ShippingFormSlot,
  PaymentFormSlot,
  OrderSummarySlot
};
