
import React, { useState, useEffect } from "react";
import { ProductTab } from "@/api/entities";
import { Store } from "@/api/entities";
import { Attribute } from "@/api/entities";
import { AttributeSet } from "@/api/entities";
import { User } from "@/api/entities"; // Import User entity
import { useStoreSelection } from "@/contexts/StoreSelectionContext.jsx";
import {
  Package,
  Plus,
  Search,
  Edit,
  Trash2,
  AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import FlashMessage from "@/components/storefront/FlashMessage";
import ProductTabForm from "@/components/admin/products/ProductTabForm";
import { useTranslation } from "@/contexts/TranslationContext";
import { getAttributeLabel } from "@/utils/attributeUtils";
import { clearAllCache } from "@/utils/cacheUtils";
import { PageLoader } from "@/components/ui/page-loader";

export default function ProductTabs() {
  const { selectedStore, getSelectedStoreId } = useStoreSelection();
  const { currentLanguage } = useTranslation();
  const [tabs, setTabs] = useState([]); // Renamed from productTabs
  const [attributes, setAttributes] = useState([]);
  const [attributeSets, setAttributeSets] = useState([]);
  const [store, setStore] = useState(null); // Holds the single active store for the user
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingTab, setEditingTab] = useState(null); // Renamed from selectedTab
  const [showForm, setShowForm] = useState(false); // Renamed from showTabForm
  const [flashMessage, setFlashMessage] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [tabToDelete, setTabToDelete] = useState(null);

  useEffect(() => {
    if (selectedStore) {
      loadData();
    }
  }, [selectedStore]);

  // Cache clearing utility function
  const clearProductTabsCache = () => {
    try {
      const storeId = getSelectedStoreId();
      if (!storeId) return;

      // Clear the specific cache entry for product tabs
      const cacheKey = `product-tabs-${storeId}`;

      // Get existing cache
      const cached = localStorage.getItem('storeProviderCache');
      if (cached) {
        try {
          const cacheObj = JSON.parse(cached);
          // Remove the product tabs cache entry
          delete cacheObj[cacheKey];
          // Save back to localStorage
          localStorage.setItem('storeProviderCache', JSON.stringify(cacheObj));
          console.log('🧹 Cleared product tabs cache for store:', storeId);
        } catch (parseError) {
          // If parsing fails, clear entire cache as fallback
          localStorage.removeItem('storeProviderCache');
          console.log('🧹 Cleared entire storefront cache due to parse error');
        }
      }
    } catch (error) {
      console.error('Failed to clear product tabs cache:', error);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);

      const storeId = getSelectedStoreId();
      if (!storeId) {
        console.warn("No store selected");
        setLoading(false);
        return;
      }

      setStore(selectedStore);

      // Filter all data by current store's ID
      const [tabsData, attributesData, setsData] = await Promise.all([
        // Assuming ProductTab.filter can take a sort parameter as the second argument
        ProductTab.filter({ store_id: storeId }, "sort_order"),
        Attribute.filter({ store_id: storeId }),
        AttributeSet.filter({ store_id: storeId })
      ]);

      setTabs(tabsData || []);
      setAttributes(attributesData || []);
      setAttributeSets(setsData || []);
    } catch (error) {
      setTabs([]);
      setAttributes([]);
      setAttributeSets([]);
      setStore(null);
      setFlashMessage({ type: 'error', message: "Failed to load data. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  // Combined create and update into a single handleSubmit function
  const handleSubmit = async (tabData) => {
    const storeId = getSelectedStoreId();
    if (!storeId) {
      setFlashMessage({ type: 'error', message: 'Operation failed: No store selected.' });
      return;
    }

    try {
      if (editingTab) {
        // When editing, tabData will already contain the ID from the form
        const { id, ...updateData } = tabData;
        await ProductTab.update(id, { ...updateData, store_id: storeId });
        setFlashMessage({ type: 'success', message: 'Product tab updated successfully!' });
      } else {
        await ProductTab.create({ ...tabData, store_id: storeId });
        setFlashMessage({ type: 'success', message: 'Product tab created successfully!' });
      }

      await loadData(); // Reload data to reflect changes
      // Clear storefront cache for instant updates
      if (storeId) clearAllCache(storeId);
      setShowForm(false);
      setEditingTab(null);
    } catch (error) {
      setFlashMessage({ type: 'error', message: `Failed to ${editingTab ? 'update' : 'create'} product tab` });
    }
  };

  const handleEdit = async (tab) => {
    if (tab) {
      // Fetch the full tab with all translations from the API
      try {
        const response = await ProductTab.findById(tab.id);
        // Extract the actual tab data from the API response
        const fullTab = response?.data || response;
        setEditingTab(fullTab);
      } catch (error) {
        setFlashMessage({ type: 'error', message: 'Failed to load tab details' });
        return;
      }
    } else {
      setEditingTab(null);
    }
    setShowForm(true);
  };

  const handleDeleteTab = (tab) => {
    setTabToDelete(tab);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!tabToDelete) return;

    try {
      await ProductTab.delete(tabToDelete.id);
      await loadData(); // Reload data after deletion
      // Clear storefront cache for instant updates
      const storeId = getSelectedStoreId();
      if (storeId) clearAllCache(storeId);
      setFlashMessage({ type: 'success', message: 'Product tab deleted successfully!' });
    } catch (error) {
      console.error("Error deleting tab:", error);
      setFlashMessage({ type: 'error', message: 'Failed to delete product tab' });
    } finally {
      setDeleteDialogOpen(false);
      setTabToDelete(null);
    }
  };

  const handleToggleStatus = async (tab) => {
    try {
      const storeId = getSelectedStoreId();
      if (!storeId) {
        setFlashMessage({ type: 'error', message: 'Operation failed: No store selected.' });
        return;
      }
      // Ensure store_id is always included for data isolation
      await ProductTab.update(tab.id, {
        ...tab,
        is_active: !tab.is_active,
        store_id: storeId // Explicitly include store_id in the update payload
      });
      await loadData(); // Reload data after status change
      // Clear storefront cache for instant updates
      if (storeId) clearAllCache(storeId);
      setFlashMessage({
        type: 'success',
        message: `Product tab ${tab.is_active ? 'deactivated' : 'activated'} successfully!`
      });
    } catch (error) {
      setFlashMessage({ type: 'error', message: 'Failed to update tab status' });
    }
  };

  // Filter tabs based on search query (using the new 'tabs' state)
  const filteredTabs = tabs.filter(tab =>
    (tab.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return <PageLoader size="lg" />;
  }

  // Display a message if no store is found for the user
  if (!store && !loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <FlashMessage message={flashMessage} onClose={() => setFlashMessage(null)} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Product Tabs</h1>
          <p className="text-lg text-gray-700">
            It looks like there's no store associated with your account.
          </p>
          <p className="text-gray-600 mt-2">
            To manage product tabs, you must have an active store. Please ensure you have created one or contact support.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <FlashMessage message={flashMessage} onClose={() => setFlashMessage(null)} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Product Tabs</h1>
            <p className="text-gray-600 mt-1">Configure product detail page tabs</p>
          </div>
          <Button
            onClick={() => handleEdit(null)}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 material-ripple material-elevation-1"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Product Tab
          </Button>
        </div>

        {/* Search */}
        <Card className="material-elevation-1 border-0 mb-6">
          <CardContent className="p-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                placeholder="Search product tabs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Tabs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredTabs.map((tab) => (
            <Card key={tab.id} className="material-elevation-1 border-0 hover:material-elevation-2 transition-all duration-300 flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                      <Package className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{tab.name}</CardTitle>
                      <p className="text-sm text-gray-500">
                        {tab.tab_type === 'text' && 'Text Content'}
                        {tab.tab_type === 'description' && 'Product Description'}
                        {tab.tab_type === 'attributes' && 'Specific Attributes'}
                        {tab.tab_type === 'attribute_sets' && 'Attribute Sets'}
                        {!tab.tab_type && 'Text Content'}
                      </p>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-between">
                <div>
                  {tab.tab_type === 'text' && tab.content && (
                    <div className="text-sm mb-4">
                      <p className="text-gray-600 line-clamp-2">{tab.content}</p>
                    </div>
                  )}

                  {tab.tab_type === 'description' && (
                    <div className="text-sm mb-4">
                      <div className="bg-blue-50 p-2 rounded">
                        <p className="text-xs text-blue-700">
                          Displays product description automatically
                        </p>
                      </div>
                    </div>
                  )}

                  {tab.tab_type === 'attributes' && (
                    <div className="text-sm mb-4">
                      <span className="font-medium">Selected Attributes:</span>
                      {tab.attribute_ids && tab.attribute_ids.length > 0 ? (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {tab.attribute_ids.slice(0, 3).map((attrId, idx) => {
                            const attr = attributes.find(a => a.id === attrId);
                            return (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {attr ? getAttributeLabel(attr, currentLanguage) : `Attr ${attrId.slice(0, 8)}`}
                              </Badge>
                            );
                          })}
                          {tab.attribute_ids.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{tab.attribute_ids.length - 3} more
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 mt-1">No attributes selected</p>
                      )}
                    </div>
                  )}

                  {tab.tab_type === 'attribute_sets' && (
                    <div className="text-sm mb-4">
                      <span className="font-medium">Selected Attribute Sets:</span>
                      {tab.attribute_set_ids && tab.attribute_set_ids.length > 0 ? (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {tab.attribute_set_ids.slice(0, 2).map((setId, idx) => {
                            const attrSet = attributeSets.find(s => s.id === setId);
                            return (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {attrSet?.name || `Set ${setId.slice(0, 8)}`}
                              </Badge>
                            );
                          })}
                          {tab.attribute_set_ids.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{tab.attribute_set_ids.length - 2} more
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 mt-1">No attribute sets selected</p>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-center pt-2">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={tab.is_active}
                      onCheckedChange={() => handleToggleStatus(tab)}
                    />
                    <span className="text-sm font-medium">Active</span>
                    {tab.demo && (
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
                        Demo
                      </Badge>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(tab)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDeleteTab(tab)} className="text-red-600 hover:text-red-700">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredTabs.length === 0 && (
          <Card className="material-elevation-1 border-0">
            <CardContent className="text-center py-12">
              <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No product tabs found</h3>
              <p className="text-gray-600 mb-6">
                {searchQuery
                  ? "Try adjusting your search terms"
                  : "Start by creating your first product tab"}
              </p>
              <Button
                onClick={() => handleEdit(null)}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 material-ripple"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Product Tab
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Tab Form Dialog */}
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingTab ? 'Edit Product Tab' : 'Add Product Tab'}
              </DialogTitle>
            </DialogHeader>
            <ProductTabForm
              tab={editingTab} // Pass the tab being edited (or null for new)
              attributes={attributes}
              attributeSets={attributeSets}
              onSubmit={handleSubmit} // Use the combined handleSubmit function
              onCancel={() => {
                setShowForm(false); // Close the form
                setEditingTab(null); // Clear editingTab state
              }}
            />
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                Delete Product Tab
              </AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete the product tab "{tabToDelete?.name}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => {
                setDeleteDialogOpen(false);
                setTabToDelete(null);
              }}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
