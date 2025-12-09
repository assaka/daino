
import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { createPublicUrl } from "@/utils/urlUtils";
import { useStore } from "@/components/storefront/StoreProvider";
import { CustomerWishlist, CustomerAddress, CustomerOrder, CustomerAuth } from "@/api/storefront-entities";
import { Product } from "@/api/entities";
import { useAlertTypes } from "@/hooks/useAlert";
import { t } from '@/utils/translationHelper';

import {
  User as UserIcon,
  MapPin,
  Package,
  Heart,
  ShoppingBag,
  Edit,
  Trash2,
  Plus,
  Eye,
  CreditCard,
  Store,
  Globe,
  Mail,
  Phone,
  ShoppingCart
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import FlashMessage from "@/components/storefront/FlashMessage";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { CountrySelect } from '@/components/ui/country-select';
import { formatPriceWithTax } from '@/utils/priceUtils';
import cartService from '@/services/cartService';
import { PageLoader } from '@/components/ui/page-loader';

// --- Utilities ---
let globalRequestQueue = Promise.resolve();

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const retryApiCall = async (apiCall, maxRetries = 3, baseDelay = 2000) => {
  return new Promise((resolve, reject) => {
    globalRequestQueue = globalRequestQueue.then(async () => {
      await delay(500 + Math.random() * 1000); // Add a jitter before each call in the queue
      for (let i = 0; i < maxRetries; i++) {
        try {
          const result = await apiCall();
          return resolve(result);
        } catch (error) {
          const isRateLimit = error.response?.status === 429 ||
                             error.message?.includes('Rate limit') ||
                             error.detail?.includes('Rate limit');

          if (isRateLimit && i < maxRetries - 1) {
            const delayTime = baseDelay * Math.pow(2, i) + Math.random() * 1000;
            console.warn(`CustomerDashboard: Rate limit hit, retrying in ${delayTime.toFixed(0)}ms... (Attempt ${i + 1}/${maxRetries})`);
            await delay(delayTime);
            continue;
          }

          if (isRateLimit) {
            console.error("CustomerDashboard: Rate limit error after all retries. Returning empty.", error);
            return resolve([]);
          }
          
          return reject(error);
        }
      }
    }).catch(reject);
  });
};


// --- Child Components (Tabs & Helpers) ---

// New StatsCard Component
const StatsCard = ({ icon: Icon, title, value, subtitle }) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <Icon className="h-4 w-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      <p className="text-xs text-muted-foreground">{subtitle}</p>
    </CardContent>
  </Card>
);


const OrdersTab = ({ orders, getCountryName, onStatusUpdate, settings, showConfirm }) => {
  const [expandedOrders, setExpandedOrders] = useState(new Set());
  const [updatingStatus, setUpdatingStatus] = useState(new Set());

  const handleToggleExpand = (orderId) => {
    const newExpanded = new Set(expandedOrders);
    if (newExpanded.has(orderId)) {
      newExpanded.delete(orderId);
    } else {
      newExpanded.add(orderId);
    }
    setExpandedOrders(newExpanded);
  };

  const handleStatusUpdate = async (orderId, newStatus) => {
    const confirmed = await showConfirm(
      `Are you sure you want to ${newStatus} this order?`,
      `${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)} Order`
    );

    if (!confirmed) {
      return;
    }

    setUpdatingStatus(prev => new Set([...prev, orderId]));
    try {
      await CustomerOrder.updateStatus(orderId, newStatus, `Customer requested ${newStatus}`);
      if (onStatusUpdate) {
        onStatusUpdate(orderId, newStatus);
      }
    } catch (error) {
      console.error('Failed to update order status:', error);
      showError(`Failed to ${newStatus} order: ${error.message}`);
    } finally {
      setUpdatingStatus(prev => {
        const newSet = new Set(prev);
        newSet.delete(orderId);
        return newSet;
      });
    }
  };

  const canCancel = (order) => {
    const status = order.status?.toLowerCase();
    return status === 'pending'; // Only pending orders can be cancelled
  };

  const canRequestReturn = (order) => {
    const status = order.status?.toLowerCase();
    return ['processing', 'shipped', 'delivered'].includes(status);
  };

  const getStatusBadgeColor = (status) => {
    const statusLower = status?.toLowerCase();
    switch (statusLower) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'shipped': return 'bg-purple-100 text-purple-800';
      case 'delivered': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'refunded': return 'bg-gray-100 text-gray-800';
      case 'return_requested': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentStatusBadgeColor = (status) => {
    const statusLower = status?.toLowerCase();
    switch (statusLower) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'refunded': return 'bg-gray-100 text-gray-800';
      case 'partially_refunded': return 'bg-orange-100 text-orange-800';
      case 'pending':
      case 'unpaid':
      default: return 'bg-amber-100 text-amber-800';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('order.your_orders', settings)}</CardTitle>
      </CardHeader>
      <CardContent>
        {orders.length === 0 ? (
          <div className="text-center py-8">
            <ShoppingBag className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-lg font-medium text-gray-900 mb-2">{t('order.no_orders_yet', settings)}</p>
            <p className="text-gray-600">{t('order.order_history', settings)}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {orders.map(order => {
              const isExpanded = expandedOrders.has(order.id);
              const isUpdating = updatingStatus.has(order.id);
              
              return (
                <Card key={order.id} className="border-l-4 border-l-blue-500">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <CardTitle className="text-lg mb-2">{t('order.number', settings)} #{order.order_number}</CardTitle>
                        <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-600">
                          <div>
                            <p><strong>{t('order.placed', settings)}:</strong> {(() => {
                              const dateStr = order.created_at || order.created_date || order.createdAt;
                              if (!dateStr) return 'Date not available';
                              try {
                                return new Date(dateStr).toLocaleDateString();
                              } catch (e) {
                                return 'Invalid date';
                              }
                            })()}</p>
                            <p><strong>{t('common.total', settings)}:</strong> ${(() => {
                                const totalAmount = parseFloat(order.total_amount || 0);
                                return isNaN(totalAmount) ? '0.00' : totalAmount.toFixed(2);
                            })()}</p>
                          </div>
                          <div>
                            {order.Store && (
                              <p><strong>{t('order.store', settings)}:</strong> {order.Store.name}</p>
                            )}
                            {order.payment_method && (
                              <p><strong>{t('checkout.payment_method', settings)}:</strong> {order.payment_method}</p>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div className="flex gap-2">
                          <Badge className={getStatusBadgeColor(order.status)}>
                            {t(`common.${order.status || 'pending'}`, settings)}
                          </Badge>
                          <Badge className={getPaymentStatusBadgeColor(order.payment_status)}>
                            {t(`common.${order.payment_status || 'pending'}`, settings)}
                          </Badge>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleExpand(order.id)}
                        >
                          <Eye className="w-4 h-4" />
                          {isExpanded ? t('common.less', settings) : t('common.details', settings)}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  
                  {isExpanded && (
                    <CardContent className="pt-0">
                      <div className="grid md:grid-cols-2 gap-6">
                        {/* Shipping Address */}
                        <div>
                          <h4 className="font-semibold mb-2">{t('common.shipping_address', settings)}</h4>
                          <div className="text-sm text-gray-600 space-y-1">
                            {order.shipping_address ? (
                              <>
                                <p>{order.shipping_address.street}</p>
                                <p>
                                  {order.shipping_address.city}
                                  {order.shipping_address.state ? `, ${order.shipping_address.state}` : ''}
                                  {order.shipping_address.postal_code ? ` ${order.shipping_address.postal_code}` : ''}
                                </p>
                                <p>{getCountryName(order.shipping_address.country)}</p>
                              </>
                            ) : (
                              <p className="text-gray-400">{t('address.no_shipping', settings)}</p>
                            )}
                          </div>
                        </div>

                        {/* Payment Details */}
                        <div>
                          <h4 className="font-semibold mb-2">{t('order.payment_information', settings)}</h4>
                          <div className="text-sm text-gray-600 space-y-1">
                            {order.payment_method && <p><strong>{t('common.method', settings)}:</strong> {order.payment_method}</p>}
                            <p>
                              <strong>{t('common.payment_status', settings)}:</strong>{' '}
                              <Badge className={getPaymentStatusBadgeColor(order.payment_status)}>
                                {t(`common.${order.payment_status || 'pending'}`, settings)}
                              </Badge>
                            </p>
                            {order.payment_status !== 'paid' && (
                              <p className="text-amber-600 text-xs mt-1">
                                {t('order.payment_pending_note', settings) || 'Payment will be collected upon delivery'}
                              </p>
                            )}
                            {order.payment_method_details && (
                              <div>
                                <p><strong>{t('common.details', settings)}:</strong></p>
                                <div className="ml-2 text-xs bg-gray-50 p-2 rounded">
                                  {typeof order.payment_method_details === 'object' ?
                                    JSON.stringify(order.payment_method_details, null, 2) :
                                    order.payment_method_details
                                  }
                                </div>
                              </div>
                            )}
                            {order.total_amount && (
                              <div className="pt-2 border-t">
                                <p><strong>{t('order.total_paid', settings)}:</strong> ${parseFloat(order.total_amount).toFixed(2)}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Order Items */}
                      {order.OrderItems && order.OrderItems.length > 0 && (
                        <div className="mt-6">
                          <h4 className="font-semibold mb-3">{t('order.items', settings)}</h4>
                          <div className="space-y-3">
                            {order.OrderItems.map(item => (
                              <div key={item.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                                {item.Product?.images?.[0] && (
                                  <img 
                                    src={item.Product.images[0]} 
                                    alt={item.product_name || item.Product.name}
                                    className="w-16 h-16 object-cover rounded"
                                  />
                                )}
                                <div className="flex-1">
                                  <h5 className="font-medium">{item.product_name || item.Product?.name}</h5>
                                  {item.product_sku && (
                                    <p className="text-sm text-gray-500">{t('common.sku', settings)}: {item.product_sku}</p>
                                  )}
                                  {item.selected_options && Array.isArray(item.selected_options) && item.selected_options.length > 0 && (
                                    <p className="text-sm text-gray-500">
                                      {t('common.options', settings)}: {item.selected_options.map(opt => `${opt.name}: ${opt.value}`).join(', ')}
                                    </p>
                                  )}
                                </div>
                                <div className="text-right">
                                  <p className="font-medium">{t('common.qty', settings)}: {item.quantity}</p>
                                  <p className="text-sm text-gray-600">
                                    ${parseFloat(item.unit_price || 0).toFixed(2)} {t('common.each', settings)}
                                  </p>
                                  <p className="font-semibold">
                                    ${parseFloat(item.total_price || item.unit_price * item.quantity || 0).toFixed(2)}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Status Notes */}
                      {order.status_notes && (
                        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                          <h5 className="font-medium text-blue-900 mb-1">{t('order.status_notes', settings)}</h5>
                          <p className="text-sm text-blue-800">{order.status_notes}</p>
                        </div>
                      )}

                      {/* Action Buttons - Bottom Right */}
                      <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
                        {canCancel(order) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleStatusUpdate(order.id, 'cancelled')}
                            disabled={isUpdating}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            {isUpdating ? t('order.cancelling', settings) : t('order.cancel', settings)}
                          </Button>
                        )}
                        {canRequestReturn(order) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleStatusUpdate(order.id, 'return_requested')}
                            disabled={isUpdating}
                            className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                          >
                            {isUpdating ? t('order.requesting', settings) : t('order.request_return', settings)}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const WishlistTab = ({ wishlistProducts, setWishlistProducts, store, settings }) => {
  const handleRemove = async (itemId) => {
      try {
          await CustomerWishlist.removeItem(itemId, store?.id);
          setWishlistProducts(prev => prev.filter(p => p.id !== itemId));
          window.dispatchEvent(new CustomEvent('wishlistUpdated'));
      } catch (error) {
          console.error("Failed to remove wishlist item", error);
      }
  };

  const handleAddToCart = async (product) => {
      try {
          if (!product || !product.id) {
              console.error('Invalid product for add to cart');
              return;
          }

          if (!store?.id) {
              console.error('Store ID is required for add to cart');
              return;
          }

          // Add to cart using cartService
          const result = await cartService.addItem(
              product.id, 
              1, // quantity
              product.price || 0,
              [], // selectedOptions 
              store.id
          );

          if (result.success !== false) {
              // Note: cartService.addItem() already dispatches cartUpdated event with fresh data
              // No need for additional dispatch here

              // Optional: Show success message or remove from wishlist
              // You could add a toast notification here
          } else {
              console.error('Failed to add to cart:', result.error);
          }
      } catch (error) {
          console.error("Failed to add to cart", error);
      }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('common.wishlist', settings)}</CardTitle>
      </CardHeader>
      <CardContent>
        {wishlistProducts.length === 0 ? (
          <p>{t('common.your_wishlist_is_empty', settings)}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {wishlistProducts.map(item => (
              <Card key={item.id}>
                <CardContent className="p-4 flex flex-col items-center text-center">
                  <img 
                    src={item.product?.images?.[0] || 'https://placehold.co/128x128?text=No+Image'} 
                    alt={item.product?.name || 'Product'} 
                    className="w-32 h-32 object-cover mb-2 rounded-lg"
                    onError={(e) => {
                      e.target.src = 'https://placehold.co/128x128?text=No+Image';
                    }}
                  />
                  <p className="font-semibold">{item.product?.name || t('common.unknown_product', settings)}</p>
                  <p className="text-sm text-gray-600 mb-3">
                    {formatPriceWithTax(item.product?.price)}
                  </p>
                  <div className="flex gap-2 w-full">
                    <Button 
                      size="sm" 
                      className="flex-1 text-white border-0 hover:brightness-90 transition-all duration-200" 
                      onClick={() => handleAddToCart(item.product)}
                      style={{ 
                        backgroundColor: settings?.theme?.add_to_cart_button_color || '#28a745',
                        color: 'white'
                      }}
                    >
                      <ShoppingCart className="w-4 h-4 mr-1" />
                      {t('common.add_to_cart', settings)}
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      onClick={() => handleRemove(item.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};


const AddressForm = ({ addressForm, handleInputChange, handleAddressSubmit, editingAddress, saving, onCancel, settings }) => {

  const handleSubmit = (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleAddressSubmit(e);
  };

  return (
    <Card className="material-elevation-1 border-0">
      <CardHeader>
        <CardTitle>{editingAddress ? t('address.edit', settings) : t('address.add_new', settings)}</CardTitle>
      </CardHeader>
      <CardContent>
        {!editingAddress && (
          <Alert className="mb-4 border-yellow-200 bg-yellow-50">
            <AlertDescription className="text-yellow-800">
              {t('address.saving_note', settings)}
            </AlertDescription>
          </Alert>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Input
                id="full_name"
                name="full_name"
                placeholder={t('common.full_name', settings)}
                value={addressForm.full_name || ''}
                onChange={(e) => {
                  handleInputChange('full_name', e.target.value);
                }}
                required
              />
            </div>
            <div>
              <Input
                id="phone"
                name="phone"
                placeholder={t('common.phone', settings)}
                value={addressForm.phone || ''}
                onChange={(e) => handleInputChange('phone', e.target.value)}
              />
            </div>
          </div>

          <div>
            <Input
              id="street"
              name="street"
              placeholder={t('common.street_address', settings)}
              value={addressForm.street || ''}
              onChange={(e) => handleInputChange('street', e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Input
                id="city"
                name="city"
                placeholder={t('common.city', settings)}
                value={addressForm.city || ''}
                onChange={(e) => handleInputChange('city', e.target.value)}
                required
              />
            </div>
            <div>
              <Input
                id="state"
                name="state"
                placeholder={t('common.state_province', settings)}
                value={addressForm.state || ''}
                onChange={(e) => handleInputChange('state', e.target.value)}
              />
            </div>
            <div>
              <Input
                id="postal_code"
                name="postal_code"
                placeholder={t('common.postal_code', settings)}
                value={addressForm.postal_code || ''}
                onChange={(e) => handleInputChange('postal_code', e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <CountrySelect
              value={addressForm.country || ''}
              onValueChange={(value) => handleInputChange('country', value)}
              allowedCountries={settings?.allowed_countries}
              placeholder={t('common.country', settings)}
            />
          </div>

          <div>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder={t('common.email', settings)}
              value={addressForm.email || ''}
              onChange={(e) => handleInputChange('email', e.target.value)}
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="is_default_shipping"
              name="is_default_shipping"
              checked={addressForm.is_default_shipping || false}
              onChange={(e) => handleInputChange('is_default_shipping', e.target.checked)}
              className="rounded"
            />
            <Label htmlFor="is_default_shipping">{t('address.default_shipping', settings)}</Label>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="is_default_billing"
              name="is_default_billing"
              checked={addressForm.is_default_billing || false}
              onChange={(e) => handleInputChange('is_default_billing', e.target.checked)}
              className="rounded"
            />
            <Label htmlFor="is_default_billing">{t('address.default_billing', settings)}</Label>
          </div>

          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
            >
              {t('common.cancel', settings)}
            </Button>
            <Button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={saving}
            >
              {saving ? t('common.saving', settings) : (editingAddress ? t('address.update', settings) : t('address.add', settings))}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};


// SprShop Content Component
const SprShopContent = () => (
  <div className="space-y-8">
    <Card className="bg-gradient-to-r from-blue-600 to-purple-600 text-white border-0">
      <CardContent className="p-8">
        <div className="flex items-center space-x-4 mb-6">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
            <Store className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Welcome to SprShop</h2>
            <p className="text-blue-100">Your Premium Shopping Experience</p>
          </div>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="text-center">
            <Globe className="w-8 h-8 mx-auto mb-2 text-blue-200" />
            <h3 className="font-semibold mb-1">Global Shipping</h3>
            <p className="text-sm text-blue-100">Worldwide delivery available</p>
          </div>
          <div className="text-center">
            <CreditCard className="w-8 h-8 mx-auto mb-2 text-blue-200" />
            <h3 className="font-semibold mb-1">Secure Payments</h3>
            <p className="text-sm text-blue-100">Bank-level security</p>
          </div>
          <div className="text-center">
            <Package className="w-8 h-8 mx-auto mb-2 text-blue-200" />
            <h3 className="font-semibold mb-1">Quality Products</h3>
            <p className="text-sm text-blue-100">Premium quality guaranteed</p>
          </div>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Mail className="w-5 h-5" />
          <span>Contact Information</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-semibold mb-2">Customer Service</h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center space-x-2">
                <Mail className="w-4 h-4 text-gray-500" />
                <span>support@sprshop.nl</span>
              </div>
              <div className="flex items-center space-x-2">
                <Phone className="w-4 h-4 text-gray-500" />
                <span>+31 (0) 610 229 965</span>
              </div>
            </div>
          </div>
          <div>
            <h4 className="font-semibold mb-2">Business Hours</h4>
            <div className="space-y-1 text-sm text-gray-600">
              <p>Monday - Friday: 9:00 AM - 6:00 PM</p>
              <p>Saturday: 10:00 AM - 4:00 PM</p>
              <p>Sunday: Closed</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>Why Choose SprShop?</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-semibold mb-3">Our Commitment</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>• Premium quality products only</li>
              <li>• Fast and reliable shipping</li>
              <li>• 30-day return policy</li>
              <li>• 24/7 customer support</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-3">Special Services</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>• Personal shopping assistance</li>
              <li>• Gift wrapping available</li>
              <li>• Bulk order discounts</li>
              <li>• VIP customer program</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
);

// Guest Welcome Component
const GuestWelcome = ({ onLogin, store, settings }) => (
  <div className="space-y-6">
    <Card>
      <CardContent className="p-8 text-center">
        <UserIcon className="w-16 h-16 mx-auto mb-4 text-gray-400" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('account.welcome_guest', settings)}</h2>
        <p className="text-gray-600 mb-6">
          {t('account.browsing_as_guest', settings)}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={onLogin} className="bg-blue-600 hover:bg-blue-700">
            {t('account.sign_in', settings)}
          </Button>
          <Link to={createPublicUrl(store?.slug || 'default', 'CUSTOMER_AUTH')}>
            <Button variant="outline">
              {t('account.create_new', settings)}
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>

    <SprShopContent />
  </div>
);

// --- Main Component ---

export default function CustomerDashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { store, settings, taxes, selectedCountry, loading: storeLoading } = useStore();
  const { showError, showConfirm, AlertComponent } = useAlertTypes();
  const [user, setUser] = useState(null);
  const [isGuest, setIsGuest] = useState(false);
  const [orders, setOrders] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [wishlistProducts, setWishlistProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [flashMessage, setFlashMessage] = useState(null);

  // New state for address management
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);
  const [addressForm, setAddressForm] = useState({
    full_name: '',
    phone: '',
    street: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'US',
    email: '',
    is_default_shipping: false,
    is_default_billing: false,
  });

  const getCountryName = (countryCode) => {
    // Simple country mapping - can be expanded as needed
    const countries = {
      'US': 'United States',
      'CA': 'Canada', 
      'NL': 'Netherlands',
      'GB': 'United Kingdom',
      'DE': 'Germany',
      'FR': 'France',
      'ES': 'Spain',
      'IT': 'Italy',
      'BE': 'Belgium',
      'LU': 'Luxembourg',
      'CH': 'Switzerland',
      'AT': 'Austria',
      'SE': 'Sweden',
      'NO': 'Norway',
      'DK': 'Denmark',
      'FI': 'Finland',
      'PL': 'Poland',
      'CZ': 'Czech Republic',
      'HU': 'Hungary',
      'SK': 'Slovakia',
      'SI': 'Slovenia',
      'HR': 'Croatia',
      'RO': 'Romania',
      'BG': 'Bulgaria',
      'GR': 'Greece',
      'CY': 'Cyprus',
      'MT': 'Malta',
      'IE': 'Ireland',
      'PT': 'Portugal'
    };
    
    return countries[countryCode] || countryCode;
  };

  const resetAddressForm = () => {
    setAddressForm({
      full_name: '',
      phone: '',
      street: '',
      city: '',
      state: '',
      postal_code: '',
      country: 'US',
      email: '',
      is_default_shipping: false,
      is_default_billing: false,
    });
    setEditingAddress(null);
  };

  const handleInputChange = (name, value) => {
    setAddressForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Extracted loadOrders function
  const loadOrders = async (userId) => {
    try {
        const userOrders = await retryApiCall(() => CustomerOrder.findAll());
        if (userOrders && userOrders.length > 0) {
        }
        setOrders(userOrders || []);
    } catch (error) {
        console.error("❌ CustomerDashboard: Error loading orders:", error);
        console.error("❌ CustomerDashboard: Error details:", error.response?.data || error.message);
        setOrders([]);
        setFlashMessage({ type: 'error', message: 'Failed to load orders. Please try again.' });
    }
  };

  // Handle order status updates
  const handleOrderStatusUpdate = async (orderId, newStatus) => {
    // Update the order in the local state immediately for better UX
    setOrders(prevOrders => 
      prevOrders.map(order => 
        order.id === orderId 
          ? { ...order, status: newStatus, updated_at: new Date().toISOString() }
          : order
      )
    );
    
    // Show success message
    setFlashMessage({ 
      type: 'success', 
      message: `Order ${newStatus === 'cancelled' ? 'cancelled' : 'updated'} successfully!` 
    });
    
    // Reload orders to get the latest data from server
    if (user?.id) {
      await loadOrders(user.id);
    }
  };

  const loadAddresses = async (currentUserId) => {
    if (!currentUserId) {
      setAddresses([]);
      return;
    }

    try {
      
      // Try without user_id first - let authentication handle it
      let addressData = await retryApiCall(() => CustomerAddress.findAll());
      
      if (addressData && Array.isArray(addressData)) {
        setAddresses(addressData);
      } else {
        setAddresses([]);
      }
    } catch (error) {
      console.error('🔍 Error loading addresses without user_id:', error);
      
      // Fallback: try with customer_id if needed
      try {
        let fallbackData = await retryApiCall(() => CustomerAddress.findAll({ customer_id: currentUserId }));
        
        if (fallbackData && Array.isArray(fallbackData)) {
          setAddresses(fallbackData);
        } else {
          setAddresses([]);
        }
      } catch (fallbackError) {
        console.error('🔍 Fallback also failed:', fallbackError);
        setAddresses([]);
        setFlashMessage({
          type: 'error',
          message: 'Failed to load addresses. Please try again.'
        });
      }
    }
  };

  // Extracted loadWishlist function (renamed from loadWishlistData)
  const loadWishlist = async (userId) => {
      if (!userId) return;
      try {
        const wishlistItems = await retryApiCall(() => CustomerWishlist.getItems(store?.id));
        if (wishlistItems && wishlistItems.length > 0) {
            const productIds = wishlistItems.map(i => i.product_id);
            const products = await retryApiCall(() => Product.filter({ id: { "$in": productIds } }));
            const productsMap = new Map((products || []).map(p => [p.id, p]));
            const fullWishlist = wishlistItems.map(item => ({ ...item, product: productsMap.get(item.product_id) })).filter(item => item.product);
            setWishlistProducts(fullWishlist);
        } else {
            setWishlistProducts([]);
        }
      } catch (error) {
          console.error("Failed to load wishlist:", error);
          setWishlistProducts([]);
          setFlashMessage({ type: 'error', message: 'Failed to load wishlist. Please try again.' });
      }
  };

  const handleAddressSubmit = async (e) => {
    if (!user || !user.id) {
      console.error("5. ERROR: No user or user.id found");
      setFlashMessage({ type: 'error', message: 'Authentication error. Please log in again.' });
      return;
    }
    
    setSaving(true);
    setFlashMessage(null);

    let dataToSave = { ...addressForm };

    // Clean up data by removing empty/null/undefined fields
    Object.keys(dataToSave).forEach(key => {
      if (dataToSave[key] === undefined || dataToSave[key] === null || dataToSave[key] === '') {
        delete dataToSave[key];
      }
    });

    // Check authentication token
    const customerToken = localStorage.getItem('customer_auth_token');
    
    // Use customer_id instead of user_id for addresses
    delete dataToSave.user_id; // Remove user_id first
    
    if (user && user.id) {
      dataToSave.customer_id = user.id; // Use customer_id instead
    }

    // Validation
    const requiredFields = ['full_name', 'street', 'city', 'postal_code', 'country'];
    const missingFields = requiredFields.filter(field => !dataToSave[field]);
    
    if (missingFields.length > 0) {
      console.error("9. ERROR: Missing required fields:", missingFields);
      setFlashMessage({ type: 'error', message: `Missing required fields: ${missingFields.join(', ')}` });
      setSaving(false);
      return;
    }

    try {
      if (editingAddress) {
        const result = await retryApiCall(() => CustomerAddress.update(editingAddress.id, dataToSave));
        setFlashMessage({ type: 'success', message: 'Address updated successfully!' });
      } else {
        try {
          const result = await retryApiCall(() => CustomerAddress.create(dataToSave));
          setFlashMessage({ type: 'success', message: 'Address added successfully!' });
        } catch (customerAddressError) {
          console.error('🔍 CustomerAddress.create failed:', customerAddressError);
          console.error('🔍 Error response:', customerAddressError.response?.data);
          
          // If user_id is required, we should be using customer_id instead
          if (customerAddressError.response?.data?.message?.includes('user_id is required') ||
              customerAddressError.message?.includes('user_id is required')) {
            console.error('🔍 Backend requires user_id but we are using customer_id instead');
            setFlashMessage({ type: 'error', message: 'Address field mismatch detected. Please contact support.' });
            throw customerAddressError;
          }
          
          // If foreign key constraint error, try with regular Address entity
          if (customerAddressError.message?.includes('constraint') || 
              customerAddressError.message?.includes('foreign key') ||
              customerAddressError.response?.data?.message?.includes('constraint')) {

            // Keep customer_id but remove user_id in fallback attempt
            const fallbackData = { ...dataToSave };
            delete fallbackData.user_id; // Ensure no user_id
            
            try {
              const result = await retryApiCall(() => CustomerAddress.create(fallbackData));
              setFlashMessage({ type: 'success', message: 'Address added successfully!' });
            } catch (fallbackError) {
              console.error('🔍 Fallback also failed:', fallbackError);

              setFlashMessage({ 
                type: 'error', 
                message: 'Unable to save address. This is a known issue with customer accounts. Please contact support.' 
              });
              return; // Don't throw error, just return
            }
          } else {
            throw customerAddressError; // Re-throw if it's not a constraint error
          }
        }
      }

      setShowAddressForm(false);
      resetAddressForm();
      await delay(500);
      await loadAddresses(user.id);
      
    } catch (error) {
      console.error('15. ERROR during address save:', error);
      console.error('🔍 Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        name: error.name
      });
      setFlashMessage({ type: 'error', message: `Failed to save address: ${error.message}` });
    } finally {
      setSaving(false);
    }
  };

  const handleEditAddress = (address) => {
      setAddressForm({
          full_name: address.full_name || '',
          phone: address.phone || '',
          street: address.street || '',
          city: address.city || '',
          state: address.state || '',
          postal_code: address.postal_code || '',
          country: address.country || 'US',
          email: address.email || '',
          is_default_shipping: address.is_default_shipping || false,
          is_default_billing: address.is_default_billing || false,
      });
      setEditingAddress(address);
      setShowAddressForm(true);
  };

  const handleDeleteAddress = async (addressId) => {
      const confirmed = await showConfirm(
        'Are you sure you want to delete this address?',
        'Delete Address'
      );

      if (!confirmed) {
          return;
      }

      setLoading(true);
      setFlashMessage(null);

      try {
          await retryApiCall(() => CustomerAddress.delete(addressId));
          setAddresses(prev => prev.filter(addr => addr.id !== addressId));
          setFlashMessage({ type: 'success', message: 'Address deleted successfully!' });
      } catch (error) {
          console.error("Failed to delete address:", error);
          setFlashMessage({
            type: 'error',
            message: `Failed to delete address: ${error.message || 'Unknown error'}`
          });
      } finally {
          setLoading(false);
      }
  };

  // New checkAuthStatus function to handle guest/authenticated user logic
  useEffect(() => {
    const checkAuthStatus = async () => {
      // Wait for store to be loaded before checking authentication
      if (storeLoading || !store) {
        console.log('⏳ CustomerDashboard: Waiting for store to load...', { storeLoading, store: !!store });
        return;
      }

      console.log('🔍 CustomerDashboard: Starting auth check', { storeSlug: store?.slug });
      setLoading(true);
      try {
        // Check if customer token exists
        const isAuth = CustomerAuth.isAuthenticated();
        console.log('🔑 CustomerDashboard: isAuthenticated =', isAuth);

        if (!isAuth) {
          throw new Error("Not authenticated");
        }

        console.log('📞 CustomerDashboard: Calling CustomerAuth.me()...');
        const userData = await retryApiCall(() => CustomerAuth.me());
        console.log('👤 CustomerDashboard: User data received:', {
          id: userData?.id,
          email: userData?.email,
          role: userData?.role,
          email_verified: userData?.email_verified
        });

        if (!userData || !userData.id || userData.role !== 'customer') {
          throw new Error("Not a customer or not authenticated");
        }

        // Email verification is optional for customers
        // They can access their account without verifying email
        // Verification can be done later if needed for certain features
        if (!userData.email_verified) {
          console.log('📧 CustomerDashboard: Email not verified (optional - continuing to dashboard)');
        }

        console.log('✅ CustomerDashboard: Auth successful, loading user data...');
        setUser(userData);
        setIsGuest(false);

        // Load data in parallel for authenticated user
        await Promise.all([
          loadOrders(userData.id),
          loadAddresses(userData.id),
          loadWishlist(userData.id)
        ]);

      } catch (error) {
        console.error('❌ CustomerDashboard: Auth check failed:', error.message);
        console.error('❌ Full error:', error);
        setUser(null);
        setIsGuest(true);
        // Clear any user-specific data from previous sessions if error occurs
        setOrders([]);
        setAddresses([]);
        setWishlistProducts([]);
      } finally {
        setLoading(false);
      }
    };

    checkAuthStatus();
  }, [storeLoading, store]);

  // Effect for setting active tab from URL search params
  useEffect(() => {
    const tab = searchParams.get('tab') || 'overview';
    setActiveTab(tab);
  }, [searchParams]);

  // Effect for handling wishlist updates (e.g., from other parts of the app)
  useEffect(() => {
    const handleWishlistUpdate = async () => {
        if(user) {
            await loadWishlist(user.id);
        }
    };
    window.addEventListener('wishlistUpdated', handleWishlistUpdate);
    return () => {
        window.removeEventListener('wishlistUpdated', handleWishlistUpdate);
    };
  }, [user]); 

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const handleLogout = async () => {
    try {
      await CustomerAuth.logout();

      // Clear any remaining customer session data
      localStorage.removeItem('customer_auth_token');
      localStorage.removeItem('customer_auth_store_code');
      localStorage.removeItem('customer_user_data');

      // Set a flag to prevent auto-login
      localStorage.setItem('user_logged_out', 'true');

      // Get store code/slug from the current URL or localStorage
      const currentPath = window.location.pathname;
      const storeCodeMatch = currentPath.match(/\/public\/([^\/]+)/);
      const storeSlug = storeCodeMatch?.[1] || store?.slug || store?.code || localStorage.getItem('customer_auth_store_code') || 'default';

      // Redirect to the login page instead of storefront
      const loginUrl = createPublicUrl(storeSlug, 'CUSTOMER_AUTH');
      navigate(loginUrl);
    } catch (error) {
      console.error('❌ Customer logout error:', error);
      // Still clear local data even if API call fails
      localStorage.removeItem('customer_auth_token');
      localStorage.removeItem('customer_auth_store_code');
      localStorage.removeItem('customer_user_data');
      localStorage.setItem('user_logged_out', 'true');

      // Get store code/slug from the current URL or localStorage
      const currentPath = window.location.pathname;
      const storeCodeMatch = currentPath.match(/\/public\/([^\/]+)/);
      const storeSlug = storeCodeMatch?.[1] || store?.slug || store?.code || localStorage.getItem('customer_auth_store_code') || 'default';

      // Redirect to the login page instead of storefront
      const loginUrl = createPublicUrl(storeSlug, 'CUSTOMER_AUTH');
      navigate(loginUrl);
    }
  };

  // New handleLogin function for guest view
  const handleLogin = () => {
    // Save store info for redirect after login
    localStorage.setItem('customer_auth_store_id', store?.id);
    localStorage.setItem('customer_auth_store_code', store?.slug);
    navigate(createPublicUrl(store?.slug, 'CUSTOMER_AUTH'));
  };

  if (loading || storeLoading) {
    return <PageLoader size="lg" />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <FlashMessage message={flashMessage} onClose={() => setFlashMessage(null)} />
        
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            {isGuest ? t('account.welcome_to_store', settings) : t('account.my_account', settings)}
          </h1>
          <p className="text-gray-600 mt-1">
            {isGuest
              ? t('account.discover_products', settings)
              : t('account.manage', settings)
            }
          </p>
        </div>

        {isGuest ? (
          <GuestWelcome onLogin={handleLogin} store={store} settings={settings} />
        ) : (
          <div className="grid lg:grid-cols-4 gap-8">
            {/* Sidebar */}
            <div className="lg:col-span-1">
              <Card>
                <CardContent className="p-6">
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-3">
                      <UserIcon className="w-8 h-8 text-gray-600" />
                    </div>
                    <h3 className="font-semibold text-gray-900">{user?.full_name}</h3>
                    <p className="text-sm text-gray-500">{user?.email}</p>
                  </div>
                  
                  <nav className="space-y-2">
                    <button
                      onClick={() => handleTabChange('overview')}
                      className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                        activeTab === 'overview' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <Package className="w-4 h-4 inline mr-2" />
                      {t('account.overview', settings)}
                    </button>
                    <button
                      onClick={() => handleTabChange('orders')}
                      className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                        activeTab === 'orders' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <ShoppingBag className="w-4 h-4 inline mr-2" />
                      {t('order.your_orders', settings)} ({orders.length})
                    </button>
                    <button
                      onClick={() => handleTabChange('addresses')}
                      className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                        activeTab === 'addresses' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <MapPin className="w-4 h-4 inline mr-2" />
                      {t('address.list', settings)} ({addresses.length})
                    </button>
                    <button
                      onClick={() => handleTabChange('wishlist')}
                      className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                        activeTab === 'wishlist' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <Heart className="w-4 h-4 inline mr-2" />
                      {t('common.wishlist', settings)} ({wishlistProducts.length})
                    </button>
                  </nav>

                  <div className="mt-6 pt-6 border-t">
                    <Button
                      variant="ghost"
                      onClick={handleLogout}
                      className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      {t('account.sign_out', settings)}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Main Content */}
            <div className="lg:col-span-3">
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  <div className="grid md:grid-cols-3 gap-6">
                    <StatsCard
                      icon={ShoppingBag}
                      title={t('order.total_orders', settings)}
                      value={orders.length}
                      subtitle={t('common.all_time', settings)}
                    />
                    <StatsCard
                      icon={MapPin}
                      title={t('address.saved', settings)}
                      value={addresses.length}
                      subtitle={t('address.delivery_locations', settings)}
                    />
                    <StatsCard
                      icon={Heart}
                      title={t('wishlist.items', settings)}
                      value={wishlistProducts.length}
                      subtitle={t('wishlist.saved_for_later', settings)}
                    />
                  </div>
                  
                  <SprShopContent />
                </div>
              )}
              
              {activeTab === 'orders' && (
                <OrdersTab
                  orders={orders}
                  getCountryName={getCountryName}
                  onStatusUpdate={handleOrderStatusUpdate}
                  settings={settings}
                  showConfirm={showConfirm}
                />
              )}

              {activeTab === 'addresses' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-gray-900">{t('address.my', settings)}</h2>
                    <Button
                      onClick={() => {
                        resetAddressForm();
                        setShowAddressForm(true);
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      {t('address.add', settings)}
                    </Button>
                  </div>

                  {showAddressForm && (
                    <div className="mb-6">
                      <AddressForm
                        addressForm={addressForm}
                        handleInputChange={handleInputChange}
                        handleAddressSubmit={handleAddressSubmit}
                        editingAddress={editingAddress}
                        saving={saving}
                        settings={settings}
                        onCancel={() => {
                          setShowAddressForm(false);
                          resetAddressForm();
                        }}
                      />
                    </div>
                  )}

                  <div className="grid gap-4">
                    {addresses.map((address) => (
                      <Card key={address.id} className="material-elevation-1 border-0">
                        <CardContent className="p-6">
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="font-semibold text-lg">{address.full_name}</h3>
                              <p className="text-gray-600">{address.street}</p>
                              <p className="text-gray-600">
                                {address.city}, {address.state} {address.postal_code}
                              </p>
                              <p className="text-gray-600">{getCountryName(address.country)}</p>
                              {address.phone && <p className="text-gray-600">{address.phone}</p>}
                              {address.email && <p className="text-gray-600">{address.email}</p>}
                              
                              <div className="flex gap-2 mt-2">
                                {address.is_default_shipping && (
                                  <Badge className="bg-blue-100 text-blue-800">{t('address.default_shipping_badge', settings)}</Badge>
                                )}
                                {address.is_default_billing && (
                                  <Badge className="bg-green-100 text-green-800">{t('address.default_billing_badge', settings)}</Badge>
                                )}
                              </div>
                            </div>
                            <div className="flex space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditAddress(address)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteAddress(address.id)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    
                    {addresses.length === 0 && !showAddressForm && (
                      <Card className="material-elevation-1 border-0">
                        <CardContent className="text-center py-12">
                          <MapPin className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                          <h3 className="text-lg font-medium text-gray-900 mb-2">{t('address.none_saved', settings)}</h3>
                          <p className="text-gray-600 mb-6">{t('address.add_first', settings)}</p>
                          <Button
                            onClick={() => {
                              resetAddressForm();
                              setShowAddressForm(true);
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            {t('address.add', settings)}
                          </Button>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'wishlist' && (
                <WishlistTab
                  wishlistProducts={wishlistProducts}
                  setWishlistProducts={setWishlistProducts}
                  store={store}
                  settings={settings}
                />
              )}
            </div>
          </div>
        )}
      </div>
      <AlertComponent />
    </div>
  );
}
