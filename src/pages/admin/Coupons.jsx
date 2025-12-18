
import React, { useState, useEffect } from "react";
import { Coupon } from "@/api/entities";
import { Product } from "@/api/entities";
import { Category } from "@/api/entities";
import { useStoreSelection } from "@/contexts/StoreSelectionContext.jsx";
import NoStoreSelected from "@/components/admin/NoStoreSelected";
import {
  Percent,
  Plus,
  Search,
  Edit,
  Trash2,
  Copy,
  Check,
  Calendar,
  Package
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { formatPrice } from "@/utils/priceUtils";

import CouponForm from "@/components/admin/coupons/CouponForm";
import FlashMessage from "@/components/storefront/FlashMessage";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import { PageLoader } from "@/components/ui/page-loader";

export default function CouponsPage() {
  const { selectedStore, getSelectedStoreId } = useStoreSelection();
  const [coupons, setCoupons] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [flashMessage, setFlashMessage] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [couponToDelete, setCouponToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [copiedCode, setCopiedCode] = useState(null);

  useEffect(() => {
    if (selectedStore) {
      loadData();
    }
  }, [selectedStore]);

  // Listen for store changes
  useEffect(() => {
    const handleStoreChange = () => {
      if (selectedStore) {
        loadData();
      }
    };

    window.addEventListener('storeSelectionChanged', handleStoreChange);
    return () => window.removeEventListener('storeSelectionChanged', handleStoreChange);
  }, [selectedStore]);

  const loadData = async () => {
    const storeId = getSelectedStoreId();
    if (!storeId) {
      console.warn("CouponsPage: No store selected.");
      setCoupons([]);
      setCategories([]);
      setProducts([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      // Filter all data by selected store's ID
      const [couponsData, categoriesData, productsData] = await Promise.all([
        Coupon.filter({ store_id: storeId }),
        Category.filter({ store_id: storeId }),
        Product.filter({ store_id: storeId })
      ]);
      
      setCoupons(couponsData || []);
      setCategories(categoriesData || []);
      setProducts(productsData || []);
    } catch (error) {
      console.error("Error loading coupons data:", error);
      setCoupons([]);
      setCategories([]);
      setProducts([]);
      setFlashMessage({ type: 'error', message: 'Failed to load data. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (couponData) => {
    const storeId = getSelectedStoreId();
    if (!storeId) {
      setFlashMessage({ type: 'error', message: 'Cannot save coupon: No store selected.' });
      return;
    }

    try {
      if (editingCoupon) {
        // Update existing coupon
        await Coupon.update(editingCoupon.id, { ...couponData, store_id: storeId });
        setFlashMessage({ type: 'success', message: 'Coupon updated successfully!' });
      } else {
        // Create new coupon
        await Coupon.create({ ...couponData, store_id: storeId });
        setFlashMessage({ type: 'success', message: `Coupon "${couponData.code}" created successfully!` });
      }

      await loadData();
      setShowForm(false);
      setEditingCoupon(null);
    } catch (error) {
      console.error(`Error ${editingCoupon ? 'updating' : 'creating'} coupon:`, error);

      // More detailed error messages
      let errorMessage = `Failed to ${editingCoupon ? 'update' : 'create'} coupon`;
      if (error.response?.data?.error) {
        errorMessage += `: ${error.response.data.error}`;
      } else if (error.message) {
        errorMessage += `: ${error.message}`;
      }

      setFlashMessage({ type: 'error', message: errorMessage });
    }
  };

  const handleDeleteCoupon = (coupon) => {
    setCouponToDelete(coupon);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!couponToDelete) return;

    setDeleting(true);
    try {
      await Coupon.delete(couponToDelete.id);
      await loadData();
      setFlashMessage({ type: 'success', message: 'Coupon deleted successfully!' });
      setDeleteDialogOpen(false);
      setCouponToDelete(null);
    } catch (error) {
      console.error("Error deleting coupon:", error);
      setFlashMessage({ type: 'error', message: 'Failed to delete coupon' });
    } finally {
      setDeleting(false);
    }
  };

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setFlashMessage({ type: 'success', message: 'Coupon code copied to clipboard!' });
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const getDiscountTypeLabel = (type) => {
    switch (type) {
      case "fixed": return "Fixed Amount";
      case "percentage": return "Percentage";
      case "buy_x_get_y": return "Buy X Get Y";
      case "free_shipping": return "Free Shipping";
      default: return type;
    }
  };

  const getDiscountValueDisplay = (coupon) => {
    switch (coupon.discount_type) {
      case "percentage":
        return `${coupon.discount_value}%`;
      case "fixed":
        return formatPrice(coupon.discount_value);
      case "buy_x_get_y":
        return `Buy ${coupon.buy_quantity} Get ${coupon.get_quantity}`;
      case "free_shipping":
        return "Free Shipping";
      default:
        return coupon.discount_value;
    }
  };

  const isExpired = (coupon) => {
    if (!coupon.end_date) return false;
    return new Date(coupon.end_date) < new Date();
  };

  const filteredCoupons = coupons.filter(coupon =>
    coupon.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    coupon.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return <PageLoader size="lg" />;
  }

  if (!selectedStore) {
    return <NoStoreSelected />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <FlashMessage message={flashMessage} onClose={() => setFlashMessage(null)} />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Coupons & Discounts</h1>
            <p className="text-gray-600 mt-1">Create and manage discount codes</p>
          </div>
          <Button
            onClick={() => {
              setEditingCoupon(null); // Clear editing state for new coupon
              setShowForm(true); // Open the form
            }}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 material-ripple material-elevation-1"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Coupon
          </Button>
        </div>

        {/* Search */}
        <Card className="material-elevation-1 border-0 mb-6">
          <CardContent className="p-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                placeholder="Search coupons by name or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Coupons Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredCoupons.map((coupon) => (
            <Card key={coupon.id} className={`material-elevation-1 border-0 hover:material-elevation-2 transition-all duration-300 ${
              isExpired(coupon) ? 'opacity-60' : ''
            }`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-blue-600 rounded-lg flex items-center justify-center">
                      <Percent className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{coupon.name}</CardTitle>
                      <div className="flex items-center space-x-2 mt-1">
                        <code className="text-sm bg-gray-100 px-2 py-1 rounded font-mono">
                          {coupon.code}
                        </code>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCopyCode(coupon.code)}
                          className="h-6 w-6 p-0"
                        >
                          {copiedCode === coupon.code ? (
                            <Check className="w-3 h-3 text-green-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingCoupon(coupon); // Set coupon for editing
                        setShowForm(true); // Open the form
                      }}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteCoupon(coupon)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="text-center p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
                    <p className="text-2xl font-bold text-gray-900">
                      {getDiscountValueDisplay(coupon)}
                    </p>
                    <p className="text-sm text-gray-600">{getDiscountTypeLabel(coupon.discount_type)}</p>
                  </div>
                  
                  <div className="space-y-2">
                    {coupon.min_purchase_amount && (
                      <p className="text-sm text-gray-600">
                        Min purchase: {formatPrice(coupon.min_purchase_amount)}
                      </p>
                    )}
                    
                    {coupon.usage_limit && (
                      <p className="text-sm text-gray-600">
                        Used: {coupon.usage_count || 0} / {coupon.usage_limit}
                      </p>
                    )}
                    
                    {coupon.end_date && (
                      <div className="flex items-center text-sm text-gray-600">
                        <Calendar className="w-4 h-4 mr-1" />
                        Expires: {new Date(coupon.end_date).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={coupon.is_active ? "default" : "secondary"}>
                      {coupon.is_active ? "Active" : "Inactive"}
                    </Badge>
                    {coupon.demo && (
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
                        Demo
                      </Badge>
                    )}

                    {isExpired(coupon) && (
                      <Badge variant="destructive">Expired</Badge>
                    )}
                    
                    {coupon.applicable_products?.length > 0 && (
                      <Badge variant="outline" className="text-xs">
                        <Package className="w-3 h-3 mr-1" />
                        Product specific
                      </Badge>
                    )}
                    
                    {coupon.applicable_categories?.length > 0 && (
                      <Badge variant="outline" className="text-xs">
                        Category specific
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredCoupons.length === 0 && (
          <Card className="material-elevation-1 border-0">
            <CardContent className="text-center py-12">
              <Percent className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No coupons found</h3>
              <p className="text-gray-600 mb-6">
                {searchQuery 
                  ? "Try adjusting your search terms"
                  : "Start by creating your first coupon code"}
              </p>
              <Button
                onClick={() => {
                  setEditingCoupon(null); // Clear editing state for new coupon
                  setShowForm(true); // Open the form
                }}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 material-ripple"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Coupon
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Coupon Form Dialog */}
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingCoupon ? 'Edit Coupon' : 'Create New Coupon'}
              </DialogTitle>
            </DialogHeader>
            <CouponForm
              coupon={editingCoupon}
              storeId={getSelectedStoreId()}
              products={products}
              categories={categories}
              onSubmit={handleSubmit} // Use the combined handleSubmit function
              onCancel={() => {
                setShowForm(false);
                setEditingCoupon(null);
              }}
            />
          </DialogContent>
        </Dialog>

        <DeleteConfirmationDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onConfirm={confirmDelete}
          title="Delete Coupon"
          description={`Are you sure you want to delete the coupon "${couponToDelete?.code}"? This action cannot be undone.`}
          loading={deleting}
        />
      </div>
    </div>
  );
}
