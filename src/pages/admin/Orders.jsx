
import React, { useState, useEffect } from "react";
import { Order } from "@/api/entities";
import { OrderItem } from "@/api/entities";
import { User } from "@/api/entities";
import { useStoreSelection } from "@/contexts/StoreSelectionContext.jsx";
import NoStoreSelected from "@/components/admin/NoStoreSelected";
import { formatPrice, _setStoreContext } from "@/utils/priceUtils";
import { useAlertTypes } from "@/hooks/useAlert";
import {
  Search,
  ChevronDown,
  ChevronUp,
  Package,
  User as UserIcon,
  MapPin,
  Plus,
  Calendar,
  DollarSign,
  Mail,
  FileText,
  Truck,
  MoreVertical,
  X,
  RefreshCw,
  Info,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SaveButton } from "@/components/ui/save-button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { PageLoader } from "@/components/ui/page-loader";
import FlashMessage from "@/components/storefront/FlashMessage";

export default function Orders() {
  const { selectedStore, getSelectedStoreId } = useStoreSelection();
  const { showConfirm, showError, AlertComponent } = useAlertTypes();
  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState({});
  const [orderItems, setOrderItems] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [openOrderId, setOpenOrderId] = useState(null);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState({});
  const [actionSuccess, setActionSuccess] = useState({});
  const [flashMessage, setFlashMessage] = useState(null);
  const [shipmentModalOpen, setShipmentModalOpen] = useState(false);
  const [selectedOrderForShipment, setSelectedOrderForShipment] = useState(null);
  const [shipmentDetails, setShipmentDetails] = useState({
    trackingNumber: '',
    carrier: '',
    estimatedDeliveryDate: ''
  });

  useEffect(() => {
    if (selectedStore) {
      // Set store context for price formatting with fallback currency symbol
      const storeWithDefaults = {
        ...selectedStore,
        settings: {
          ...selectedStore.settings,
          currency_symbol: selectedStore.settings?.currency_symbol || '$'
        }
      };
      _setStoreContext(storeWithDefaults);
      loadOrders();
    }
  }, [selectedStore]);

  // Listen for store changes
  useEffect(() => {
    const handleStoreChange = () => {
      if (selectedStore) {
        // Update store context when store changes with fallback currency symbol
        const storeWithDefaults = {
          ...selectedStore,
          settings: {
            ...selectedStore.settings,
            currency_symbol: selectedStore.settings?.currency_symbol || '$'
          }
        };
        _setStoreContext(storeWithDefaults);
        loadOrders();
      }
    };

    window.addEventListener('storeSelectionChanged', handleStoreChange);
    return () => window.removeEventListener('storeSelectionChanged', handleStoreChange);
  }, [selectedStore]);

  const loadOrders = async () => {
    const storeId = getSelectedStoreId();
    if (!storeId) {
      console.warn("No store selected");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch orders filtered by the store_id
      const ordersResponse = await Order.filter({ store_id: storeId }, '-created_date');
      
      // The API returns data in a wrapper object
      const ordersData = ordersResponse?.data?.orders || ordersResponse?.orders || ordersResponse || [];
      
      setOrders(Array.isArray(ordersData) ? ordersData : []);

      // Load user data for the customers in these orders
      if (ordersData && ordersData.length > 0) {
        const userIds = [...new Set(ordersData.map(o => o.user_id).filter(Boolean))];
        if (userIds.length > 0) {
          try {
            const usersData = await User.filter({ id__in: userIds });
            const usersMap = usersData.reduce((acc, u) => {
              acc[u.id] = u;
              return acc;
            }, {});
            setUsers(usersMap);
          } catch (userError) {
            console.error("Could not load user data for orders:", userError);
            setUsers({});
          }
        } else {
          setUsers({});
        }

        // Extract order items from the orders data (backend includes them)
        const itemsMap = {};
        ordersData.forEach(order => {
          if (order.OrderItems && Array.isArray(order.OrderItems)) {
            itemsMap[order.id] = order.OrderItems;
          }
        });

        setOrderItems(itemsMap);
      } else {
        setUsers({});
        setOrderItems({});
      }
    } catch (err) {
      console.error("Error loading orders:", err);
      setError("Failed to load orders. Please try again later.");
      setOrders([]);
      setUsers({});
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "processing":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "shipped":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "complete":
        return "bg-green-100 text-green-800 border-green-200";
      case "cancelled":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const filteredOrders = orders.filter(order =>
    order.order_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (users[order.user_id]?.full_name || order.customer_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (users[order.user_id]?.email || order.customer_email || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? 'Invalid Date' : date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const handleResendOrder = async (orderId) => {
    const key = `resend-order-${orderId}`;
    setActionLoading(prev => ({ ...prev, [key]: true }));
    try {
      const storeId = getSelectedStoreId();
      const response = await fetch(`/api/orders/${orderId}/resend-confirmation?store_id=${storeId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('store_owner_auth_token')}`
        }
      });

      if (!response.ok) throw new Error('Failed to resend order confirmation');

      setActionSuccess(prev => ({ ...prev, [key]: true }));
      setTimeout(() => setActionSuccess(prev => ({ ...prev, [key]: false })), 3000);

      // Show success message
      setFlashMessage({
        type: 'success',
        message: 'Order confirmation email sent successfully!'
      });
    } catch (error) {
      console.error('Error resending order:', error);
      setFlashMessage({
        type: 'error',
        message: 'Failed to resend order confirmation'
      });
    } finally {
      setActionLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleSendInvoice = async (orderId) => {
    const key = `send-invoice-${orderId}`;
    setActionLoading(prev => ({ ...prev, [key]: true }));
    try {
      const storeId = getSelectedStoreId();
      const response = await fetch(`/api/orders/${orderId}/send-invoice?store_id=${storeId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('store_owner_auth_token')}`
        },
        body: JSON.stringify({ withPdf: true })
      });

      if (!response.ok) throw new Error('Failed to send invoice');

      setActionSuccess(prev => ({ ...prev, [key]: true }));
      setTimeout(() => setActionSuccess(prev => ({ ...prev, [key]: false })), 3000);

      // Update order status locally
      setOrders(prevOrders =>
        prevOrders.map(order =>
          order.id === orderId
            ? { ...order, status: 'processing', payment_status: 'paid' }
            : order
        )
      );

      // Show success message
      setFlashMessage({
        type: 'success',
        message: 'Invoice email sent successfully with PDF attachment!'
      });
    } catch (error) {
      console.error('Error sending invoice:', error);
      setFlashMessage({
        type: 'error',
        message: 'Failed to send invoice'
      });
    } finally {
      setActionLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  const openShipmentModal = (order) => {
    setSelectedOrderForShipment(order);
    setShipmentDetails({
      trackingNumber: order.tracking_number || '',
      carrier: '',
      estimatedDeliveryDate: ''
    });
    setShipmentModalOpen(true);
  };

  const handleSendShipmentSubmit = async () => {
    if (!selectedOrderForShipment) return;

    const orderId = selectedOrderForShipment.id;
    const key = `send-shipment-${orderId}`;
    setActionLoading(prev => ({ ...prev, [key]: true }));

    try {
      const storeId = getSelectedStoreId();
      const response = await fetch(`/api/orders/${orderId}/send-shipment?store_id=${storeId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('store_owner_auth_token')}`
        },
        body: JSON.stringify({
          trackingNumber: shipmentDetails.trackingNumber,
          carrier: shipmentDetails.carrier,
          estimatedDeliveryDate: shipmentDetails.estimatedDeliveryDate
        })
      });

      if (!response.ok) throw new Error('Failed to send shipment notification');

      setActionSuccess(prev => ({ ...prev, [key]: true }));
      setTimeout(() => setActionSuccess(prev => ({ ...prev, [key]: false })), 3000);

      // Update order status locally
      setOrders(prevOrders =>
        prevOrders.map(order =>
          order.id === orderId
            ? {
                ...order,
                status: 'shipped',
                fulfillment_status: 'shipped',
                tracking_number: shipmentDetails.trackingNumber || order.tracking_number
              }
            : order
        )
      );

      // Close modal
      setShipmentModalOpen(false);

      // Show success message
      setFlashMessage({
        type: 'success',
        message: 'Shipment notification sent successfully with PDF attachment!'
      });
    } catch (error) {
      console.error('Error sending shipment:', error);
      setFlashMessage({
        type: 'error',
        message: 'Failed to send shipment notification'
      });
    } finally {
      setActionLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  const safeFormatPrice = (value) => {
    // Safe wrapper for formatPrice that handles missing store context
    try {
      return formatPrice(value);
    } catch (error) {
      // Fallback if store context not ready
      const num = parseFloat(value) || 0;
      return `$${num.toFixed(2)}`;
    }
  };

  const getInvoiceButtonText = (order) => {
    // If order is processing or later, invoice was already sent
    if (order.status === 'processing' || order.status === 'shipped' || order.status === 'delivered') {
      return 'Resend Invoice';
    }
    return 'Send Invoice';
  };

  const getShipmentButtonText = (order) => {
    // If order is shipped or delivered, shipment was already sent
    if (order.status === 'shipped' || order.status === 'delivered') {
      return 'Resend Shipment';
    }
    return 'Send Shipment';
  };

  const handleCancelOrder = async (orderId) => {
    const confirmed = await showConfirm(
      'Are you sure you want to cancel this order?',
      'Cancel Order'
    );

    if (!confirmed) return;

    const key = `cancel-order-${orderId}`;
    setActionLoading(prev => ({ ...prev, [key]: true }));
    try {
      const storeId = getSelectedStoreId();
      const response = await fetch(`/api/orders/${orderId}?store_id=${storeId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('store_owner_auth_token')}`
        },
        body: JSON.stringify({ status: 'cancelled' })
      });

      if (!response.ok) throw new Error('Failed to cancel order');

      setActionSuccess(prev => ({ ...prev, [key]: true }));
      setTimeout(() => setActionSuccess(prev => ({ ...prev, [key]: false })), 3000);

      // Update order status locally
      setOrders(prevOrders =>
        prevOrders.map(order =>
          order.id === orderId ? { ...order, status: 'cancelled' } : order
        )
      );

      // Show success message
      setFlashMessage({
        type: 'success',
        message: 'Order cancelled successfully'
      });
    } catch (error) {
      console.error('Error cancelling order:', error);
      setFlashMessage({
        type: 'error',
        message: 'Failed to cancel order'
      });
    } finally {
      setActionLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleRefundOrder = async (orderId) => {
    const confirmed = await showConfirm(
      'Are you sure you want to refund this order? This action cannot be undone.',
      'Refund Order'
    );

    if (!confirmed) return;

    const key = `refund-order-${orderId}`;
    setActionLoading(prev => ({ ...prev, [key]: true }));
    try {
      const storeId = getSelectedStoreId();
      const response = await fetch(`/api/orders/${orderId}?store_id=${storeId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('store_owner_auth_token')}`
        },
        body: JSON.stringify({
          status: 'refunded',
          payment_status: 'refunded'
        })
      });

      if (!response.ok) throw new Error('Failed to refund order');

      setActionSuccess(prev => ({ ...prev, [key]: true }));
      setTimeout(() => setActionSuccess(prev => ({ ...prev, [key]: false })), 3000);

      // Update order status locally
      setOrders(prevOrders =>
        prevOrders.map(order =>
          order.id === orderId
            ? { ...order, status: 'refunded', payment_status: 'refunded' }
            : order
        )
      );

      // Show success message
      setFlashMessage({
        type: 'success',
        message: 'Order refunded successfully'
      });
    } catch (error) {
      console.error('Error refunding order:', error);
      setFlashMessage({
        type: 'error',
        message: 'Failed to refund order'
      });
    } finally {
      setActionLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  if (loading) {
    return <PageLoader size="lg" />;
  }

  if (!selectedStore) {
    return <NoStoreSelected />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Orders</h1>
            <p className="text-gray-600 mt-1">View and manage customer orders</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                placeholder="Search orders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-64"
                disabled={!selectedStore}
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-8" role="alert">
            <strong className="font-bold">Error:</strong>
            <span className="block sm:inline"> {error}</span>
          </div>
        )}

        <>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <Card className="material-elevation-1 border-0">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Orders</p>
                      <p className="text-2xl font-bold text-gray-900">{orders.length}</p>
                    </div>
                    <Package className="w-8 h-8 text-blue-600" />
                  </div>
                </CardContent>
              </Card>

              <Card className="material-elevation-1 border-0">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Pending</p>
                      <p className="text-2xl font-bold text-yellow-600">
                        {orders.filter(o => o.status === 'pending').length}
                      </p>
                    </div>
                    <Calendar className="w-8 h-8 text-yellow-600" />
                  </div>
                </CardContent>
              </Card>

              <Card className="material-elevation-1 border-0">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Processing</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {orders.filter(o => o.status === 'processing').length}
                      </p>
                    </div>
                    <Package className="w-8 h-8 text-blue-600" />
                  </div>
                </CardContent>
              </Card>

              <Card className="material-elevation-1 border-0">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                      <p className="text-2xl font-bold text-green-600">
                        {safeFormatPrice(orders.reduce((sum, order) => sum + (order.total_amount || 0), 0))}
                      </p>
                    </div>
                    <DollarSign className="w-8 h-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Orders Table */}
            <Card className="material-elevation-1 border-0">
              <CardContent className="p-0">
                {filteredOrders.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12"></TableHead>
                        <TableHead>Order #</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-20">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOrders.map((order) => (
                        <Collapsible asChild key={order.id} open={openOrderId === order.id} onOpenChange={() => setOpenOrderId(openOrderId === order.id ? null : order.id)}>
                          <>
                            <CollapsibleTrigger asChild>
                              <TableRow className="cursor-pointer hover:bg-gray-50">
                                <TableCell>
                                  {openOrderId === order.id ? (
                                    <ChevronUp className="w-4 h-4" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4" />
                                  )}
                                </TableCell>
                                <TableCell className="font-medium">
                                  #{order.order_number || order.id.slice(-8)}
                                </TableCell>
                                <TableCell>{formatDate(order.created_date || order.createdAt)}</TableCell>
                                <TableCell>
                                  <div>
                                    <p className="font-medium">
                                      {users[order.user_id]?.full_name || 
                                       order.customer_name || 
                                       order.billing_address?.name || 
                                       order.shipping_address?.name || 
                                       'Guest Customer'}
                                    </p>
                                    <p className="text-sm text-gray-500">
                                      {users[order.user_id]?.email || order.customer_email || 'No email'}
                                    </p>
                                  </div>
                                </TableCell>
                                <TableCell className="font-medium">
                                  {safeFormatPrice(order.total_amount)}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1.5">
                                    <Badge variant="outline" className={getStatusBadge(order.status)}>
                                      {order.status?.charAt(0).toUpperCase() + order.status?.slice(1) || 'Pending'}
                                    </Badge>
                                    {order.demo && (
                                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
                                        Demo
                                      </Badge>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell onClick={(e) => e.stopPropagation()}>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="sm">
                                        <MoreVertical className="w-4 h-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem onClick={() => handleResendOrder(order.id)}>
                                        <Mail className="w-4 h-4 mr-2" />
                                        Resend Order
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleSendInvoice(order.id)}>
                                        <FileText className="w-4 h-4 mr-2" />
                                        {getInvoiceButtonText(order)}
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => openShipmentModal(order)}>
                                        <Truck className="w-4 h-4 mr-2" />
                                        {getShipmentButtonText(order)}
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        onClick={() => handleCancelOrder(order.id)}
                                        disabled={order.status === 'cancelled' || order.status === 'refunded'}
                                        className="text-orange-600"
                                      >
                                        <X className="w-4 h-4 mr-2" />
                                        Cancel Order
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => handleRefundOrder(order.id)}
                                        disabled={order.status === 'refunded' || order.payment_status !== 'paid'}
                                        className="text-red-600"
                                      >
                                        <RefreshCw className="w-4 h-4 mr-2" />
                                        Refund Order
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </TableCell>
                              </TableRow>
                            </CollapsibleTrigger>
                            <CollapsibleContent asChild>
                              <TableRow>
                                <TableCell colSpan={7} className="p-0">
                                  <div className="p-6 bg-gray-50 border-t">
                                    {/* Order Items */}
                                    <div className="mb-6">
                                      <h4 className="font-semibold text-gray-900 mb-3">Order Items</h4>
                                      {orderItems[order.id] && orderItems[order.id].length > 0 ? (
                                        <div className="bg-white rounded-lg border overflow-hidden">
                                          <Table>
                                            <TableHeader>
                                              <TableRow>
                                                <TableHead>Product</TableHead>
                                                <TableHead className="text-center">Qty</TableHead>
                                                <TableHead className="text-right">Unit Price</TableHead>
                                                <TableHead className="text-right">Total</TableHead>
                                              </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                              {orderItems[order.id].map((item, index) => (
                                                <TableRow key={index}>
                                                  <TableCell>
                                                    <div>
                                                      <p className="font-medium">{item.product_name || 'Unknown Product'}</p>
                                                      {item.product_sku && (
                                                        <p className="text-sm text-gray-500">SKU: {item.product_sku}</p>
                                                      )}
                                                      {item.selected_options && item.selected_options.length > 0 && (
                                                        <div className="text-sm text-gray-600 mt-2 space-y-1">
                                                          <div className="text-xs text-gray-500 font-medium">Custom Options:</div>
                                                          {item.selected_options.map((option, optIndex) => (
                                                            <div key={optIndex} className="flex justify-between items-center">
                                                              <span>• {option.name}: {option.value}</span>
                                                              {parseFloat(option.price || 0) > 0 && (
                                                                <span className="text-green-600 font-medium">(+{safeFormatPrice(option.price)})</span>
                                                              )}
                                                            </div>
                                                          ))}
                                                        </div>
                                                      )}
                                                    </div>
                                                  </TableCell>
                                                  <TableCell className="text-center">{item.quantity || 1}</TableCell>
                                                  <TableCell className="text-right">
                                                    <div>
                                                      {(() => {
                                                        // Calculate price breakdown
                                                        const unitPrice = parseFloat(item.unit_price || item.price || 0);
                                                        const selectedOptions = item.selected_options || [];
                                                        const optionsPrice = selectedOptions.reduce((sum, option) => {
                                                          const optionPrice = parseFloat(option.price || 0);
                                                          return sum + (isNaN(optionPrice) ? 0 : optionPrice);
                                                        }, 0);
                                                        const baseUnitPrice = Math.max(0, unitPrice - optionsPrice);
                                                        
                                                        // Show original price vs discounted price if applicable
                                                        if (item.original_price && parseFloat(item.original_price) !== unitPrice) {
                                                          return (
                                                            <>
                                                              <p className="text-sm text-gray-500 line-through">{safeFormatPrice(item.original_price)}</p>
                                                              <p className="text-red-600 font-medium">{safeFormatPrice(unitPrice)}</p>
                                                            </>
                                                          );
                                                        }
                                                        
                                                        // Show price breakdown if there are custom options
                                                        if (selectedOptions.length > 0 && optionsPrice > 0) {
                                                          return (
                                                            <div className="space-y-1">
                                                              <div className="text-sm font-medium">{safeFormatPrice(baseUnitPrice)}</div>
                                                              <div className="text-xs text-gray-500">Options: +{safeFormatPrice(optionsPrice)}</div>
                                                              <div className="text-xs font-medium border-t pt-1">Total: {safeFormatPrice(unitPrice)}</div>
                                                            </div>
                                                          );
                                                        }
                                                        
                                                        // Default: show unit price only
                                                        return <p className="font-medium">{safeFormatPrice(unitPrice)}</p>;
                                                      })()}
                                                    </div>
                                                  </TableCell>
                                                  <TableCell className="text-right font-medium">{safeFormatPrice(item.total_price || ((item.unit_price || item.price) * item.quantity))}</TableCell>
                                                </TableRow>
                                              ))}
                                            </TableBody>
                                          </Table>
                                        </div>
                                      ) : (
                                        <div className="bg-white rounded-lg border p-4 text-center text-gray-500">
                                          <Package className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                                          <p>No order items found</p>
                                          <p className="text-sm">Order details may still be processing</p>
                                        </div>
                                      )}
                                    </div>

                                    <div className="grid md:grid-cols-2 gap-6">
                                      {/* Order Details */}
                                      <div>
                                        <h4 className="font-semibold text-gray-900 mb-3">Order Summary</h4>
                                        <div className="space-y-2 text-sm">
                                          <div className="flex justify-between">
                                            <span className="text-gray-600">Subtotal:</span>
                                            <span>{safeFormatPrice(order.subtotal)}</span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span className="text-gray-600">Shipping:</span>
                                            <span>{safeFormatPrice(order.shipping_cost || order.shipping_amount)}</span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span className="text-gray-600">Tax:</span>
                                            <span>{safeFormatPrice(order.tax_amount)}</span>
                                          </div>
                                          {order.discount_amount > 0 && (
                                            <div className="flex justify-between text-green-600">
                                              <span>Discount:</span>
                                              <span>-{safeFormatPrice(order.discount_amount)}</span>
                                            </div>
                                          )}
                                          <Separator />
                                          <div className="flex justify-between font-semibold">
                                            <span>Total:</span>
                                            <span>{safeFormatPrice(order.total_amount)}</span>
                                          </div>
                                        </div>
                                        
                                        {/* Additional Order Info */}
                                        <div className="mt-4 pt-4 border-t space-y-2 text-sm">
                                          <div className="flex justify-between">
                                            <span className="text-gray-600">Payment Method:</span>
                                            <span className="capitalize">{order.payment_method || 'N/A'}</span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span className="text-gray-600">Payment Status:</span>
                                            <Badge className={order.payment_status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                                              {order.payment_status ? order.payment_status.charAt(0).toUpperCase() + order.payment_status.slice(1) : 'Pending'}
                                            </Badge>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Shipping Address */}
                                      <div>
                                        <h4 className="font-semibold text-gray-900 mb-3">Shipping Address</h4>
                                        {order.shipping_address ? (
                                          <div className="text-sm text-gray-600">
                                            <p className="font-medium">{order.shipping_address.full_name || order.shipping_address.name}</p>
                                            <p>{order.shipping_address.street || order.shipping_address.line1 || order.shipping_address.address}</p>
                                            {order.shipping_address.line2 && <p>{order.shipping_address.line2}</p>}
                                            <p>
                                              {[
                                                order.shipping_address.city,
                                                order.shipping_address.state || order.shipping_address.province,
                                                order.shipping_address.postal_code || order.shipping_address.zip
                                              ].filter(Boolean).join(', ')}
                                            </p>
                                            <p>{order.shipping_address.country}</p>
                                            {order.shipping_address.phone && <p>Phone: {order.shipping_address.phone}</p>}
                                          </div>
                                        ) : (
                                          <p className="text-sm text-gray-500">No shipping address provided</p>
                                        )}
                                        
                                        {/* Billing Address if different */}
                                        {order.billing_address && JSON.stringify(order.billing_address) !== JSON.stringify(order.shipping_address) && (
                                          <div className="mt-4">
                                            <h5 className="font-medium text-gray-900 mb-2">Billing Address</h5>
                                            <div className="text-sm text-gray-600">
                                              <p className="font-medium">{order.billing_address.full_name || order.billing_address.name}</p>
                                              <p>{order.billing_address.street || order.billing_address.line1 || order.billing_address.address}</p>
                                              {order.billing_address.line2 && <p>{order.billing_address.line2}</p>}
                                              <p>
                                                {[
                                                  order.billing_address.city,
                                                  order.billing_address.state || order.billing_address.province,
                                                  order.billing_address.postal_code || order.billing_address.zip
                                                ].filter(Boolean).join(', ')}
                                              </p>
                                              <p>{order.billing_address.country}</p>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            </CollapsibleContent>
                          </>
                        </Collapsible>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="p-12 text-center">
                    <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No orders found</h3>
                    <p className="text-gray-500">
                      {searchQuery ? 'Try adjusting your search criteria.' : 'No orders have been placed for this store yet.'}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
      </div>

      {/* Shipment Details Modal */}
      <Dialog open={shipmentModalOpen} onOpenChange={setShipmentModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Shipment Notification</DialogTitle>
          </DialogHeader>

          {/* Coming Soon Notice */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <Sparkles className="w-5 h-5 text-blue-600 mt-0.5" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-blue-900 mb-1">
                  Shipping Provider Integrations Coming Soon!
                </h4>
                <p className="text-xs text-blue-700 leading-relaxed">
                  We're working on direct integrations with FedEx, UPS, DHL, USPS, and other major carriers.
                  Soon you'll be able to automatically generate labels, track shipments in real-time, and sync tracking numbers seamlessly.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="trackingNumber">Tracking Number</Label>
              <Input
                id="trackingNumber"
                placeholder="Enter tracking number"
                value={shipmentDetails.trackingNumber}
                onChange={(e) => setShipmentDetails(prev => ({ ...prev, trackingNumber: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="carrier">Carrier / Shipping Method</Label>
              <Input
                id="carrier"
                placeholder="e.g., FedEx, UPS, DHL"
                value={shipmentDetails.carrier}
                onChange={(e) => setShipmentDetails(prev => ({ ...prev, carrier: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="estimatedDelivery">Estimated Delivery Date</Label>
              <Input
                id="estimatedDelivery"
                type="date"
                value={shipmentDetails.estimatedDeliveryDate}
                onChange={(e) => setShipmentDetails(prev => ({ ...prev, estimatedDeliveryDate: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShipmentModalOpen(false)}>
              Cancel
            </Button>
            <SaveButton
              onClick={handleSendShipmentSubmit}
              loading={actionLoading[`send-shipment-${selectedOrderForShipment?.id}`]}
              success={actionSuccess[`send-shipment-${selectedOrderForShipment?.id}`]}
              defaultText="Send Shipment"
              loadingText="Sending..."
              successText="Sent!"
              icon={<Truck className="w-4 h-4 mr-2" />}
            />
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Alert Dialog Component */}
      <AlertComponent />

      {/* Flash Message */}
      <FlashMessage message={flashMessage} onClose={() => setFlashMessage(null)} />
    </div>
  );
}
