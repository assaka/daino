
import React, { useState, useEffect } from "react";
import { Tax } from "@/api/entities";
import { useStoreSelection } from "@/contexts/StoreSelectionContext.jsx";
import NoStoreSelected from "@/components/admin/NoStoreSelected";
import { clearTaxesCache } from "@/utils/cacheUtils";
import FlashMessage from "@/components/storefront/FlashMessage";
import {
  Receipt,
  Plus,
  Search,
  Edit,
  Trash2,
  ChevronDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAlertTypes } from "@/hooks/useAlert";

import TaxForm from "@/components/admin/tax/TaxForm";
import { PageLoader } from "@/components/ui/page-loader";

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const retryApiCall = async (apiCall, maxRetries = 5, baseDelay = 3000) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await apiCall();
    } catch (error) {
      if (error.response?.status === 429 && i < maxRetries - 1) {
        const delayTime = baseDelay * Math.pow(2, i) + Math.random() * 2000;
        console.warn(`Tax: Rate limit hit, retrying in ${delayTime.toFixed(0)}ms... (Attempt ${i + 1}/${maxRetries})`);
        await delay(delayTime);
        continue;
      }
      throw error;
    }
  }
};

export default function TaxPage() {
  const { selectedStore, getSelectedStoreId } = useStoreSelection();
  const { showError, showConfirm, AlertComponent } = useAlertTypes();
  const [taxes, setTaxes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTax, setSelectedTax] = useState(null);
  const [showTaxForm, setShowTaxForm] = useState(false);
  const [flashMessage, setFlashMessage] = useState(null);
  // Local state for store settings to avoid reload on changes
  const [localStoreSettings, setLocalStoreSettings] = useState(selectedStore?.settings || {});

  useEffect(() => {
    document.title = "Tax Rules - Admin Dashboard";
    if (selectedStore) {
      loadData();
      // Sync local settings with context when store changes
      setLocalStoreSettings(selectedStore.settings || {});
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
      console.warn("Tax: No store selected");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const taxData = await retryApiCall(() => Tax.filter({ store_id: storeId }, "-created_date"));
      setTaxes(Array.isArray(taxData) ? taxData : []);
    } catch (error) {
      console.error("Error loading tax data:", error);
      setTaxes([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSettingsChange = async (key, value) => {
    if (!selectedStore) {
      console.warn("No store selected to update settings.");
      return;
    }

    // Create a deep copy of the settings object to avoid mutation issues
    // and ensure `settings` object exists if it's null/undefined
    const newSettings = { ...localStoreSettings };

    // Update the specific setting
    newSettings[key] = value;

    // Update local state immediately for instant UI feedback
    setLocalStoreSettings(newSettings);

    try {
      // Update the entire settings object in the store using admin API
      const { Store } = await import('@/api/entities');
      await Store.update(selectedStore.id, { settings: newSettings });

      // Clear storefront cache to ensure tax setting changes are reflected immediately
      if (typeof window !== 'undefined') {
        // Clear localStorage cache used by StoreProvider
        localStorage.removeItem('storeProviderCache');

        // Clear any manual cache clearing flags
        localStorage.setItem('forceRefreshStore', 'true');

        // Trigger global cache clear if available
        if (window.clearCache) {
          window.clearCache();
        }
      }

      // Show success notification
      setFlashMessage({ type: 'success', message: 'Tax settings saved successfully!' });

    } catch (error) {
      // Revert local state on error
      setLocalStoreSettings(selectedStore.settings || {});
      setFlashMessage({ type: 'error', message: `Failed to update tax settings: ${error.message}` });
    }
  };

  const handleCreateTax = async (taxData) => {
    const storeId = getSelectedStoreId();
    if (!storeId) {
      throw new Error("No store selected");
    }

    try {
      await Tax.create({ ...taxData, store_id: storeId });
      await loadData();
      setShowTaxForm(false);
      // Clear storefront cache for instant updates
      clearTaxesCache(storeId);
    } catch (error) {
      console.error("Error creating tax rule:", error);
      throw error;
    }
  };

  const handleUpdateTax = async (taxData) => {
    if (!selectedTax?.id) {
      console.error("No tax selected for update");
      throw new Error("No tax selected for update");
    }

    try {
      await Tax.update(selectedTax.id, taxData);
      await loadData();
      setShowTaxForm(false);
      setSelectedTax(null);
      // Clear storefront cache for instant updates
      const storeId = getSelectedStoreId();
      if (storeId) clearTaxesCache(storeId);
    } catch (error) {
      console.error("Error updating tax rule:", error);
      await loadData();
      throw error;
    }
  };

  const handleDeleteTax = async (taxId) => {
    const confirmed = await showConfirm("Are you sure you want to delete this tax rule?");
    if (confirmed) {
      try {
        await Tax.delete(taxId);
        await loadData();
        // Clear storefront cache for instant updates
        const storeId = getSelectedStoreId();
        if (storeId) clearTaxesCache(storeId);
      } catch (error) {
        console.error("Error deleting tax rule:", error);
      }
    }
  };

  const filteredTaxes = taxes.filter(tax => {
    if (!tax) return false;
    
    const matchesSearch = !searchQuery || 
      (tax.name && tax.name.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesSearch;
  });

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
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Tax</h1>
            <p className="text-gray-600 mt-1">Manage tax rates and global settings</p>
          </div>
          <Button
            onClick={() => {
              setSelectedTax(null);
              setShowTaxForm(true);
            }}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 material-ripple material-elevation-1"
            disabled={!selectedStore}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Tax Rule
          </Button>
        </div>

        <Card className="material-elevation-1 border-0 mb-6">
          <CardHeader>
            <CardTitle>Global Tax Settings</CardTitle>
            <CardDescription>Configure how taxes are calculated and displayed across your store.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg bg-white">
              <div>
                <Label htmlFor="default_tax_included_in_prices" className="font-medium">Prices Include Tax by Default</Label>
                <p className="text-sm text-gray-500">Determines if entered product prices already include tax.</p>
              </div>
              <Switch
                id="default_tax_included_in_prices"
                checked={localStoreSettings.default_tax_included_in_prices || false}
                onCheckedChange={(checked) => {
                  handleSettingsChange('default_tax_included_in_prices', checked);
                }}
                disabled={!selectedStore}
              />
            </div>
            <div className="flex items-center justify-between p-4 border rounded-lg bg-white">
              <div>
                <Label htmlFor="display_tax_inclusive_prices" className="font-medium">Display Tax-Inclusive Prices</Label>
                <p className="text-sm text-gray-500">Shows prices with tax included on your storefront.</p>
              </div>
              <Switch
                id="display_tax_inclusive_prices"
                checked={localStoreSettings.display_tax_inclusive_prices || false}
                onCheckedChange={(checked) => {
                  handleSettingsChange('display_tax_inclusive_prices', checked);
                }}
                disabled={!selectedStore}
              />
            </div>
            <div className="flex items-center justify-between p-4 border rounded-lg bg-white">
              <div>
                <Label htmlFor="calculate_tax_after_discount" className="font-medium">Calculate Tax After Discount</Label>
                <p className="text-sm text-gray-500">Applies tax calculation after discounts have been applied.</p>
              </div>
              <Switch
                id="calculate_tax_after_discount"
                checked={localStoreSettings.calculate_tax_after_discount !== false} // default to true if undefined/null
                onCheckedChange={(checked) => handleSettingsChange('calculate_tax_after_discount', checked)}
                disabled={!selectedStore}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="material-elevation-1 border-0 mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  placeholder="Search tax rules..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="material-elevation-1 border-0">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Tax Rules ({filteredTaxes.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredTaxes.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-medium text-gray-900">Name</th>
                      <th className="hidden md:table-cell text-left py-3 px-4 font-medium text-gray-900">Description</th>
                      <th className="hidden md:table-cell text-left py-3 px-4 font-medium text-gray-900">Countries</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900">Default</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTaxes.map((tax) => (
                      <tr key={tax.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-4 px-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                              <Receipt className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{tax.name}</p>
                            </div>
                          </div>
                        </td>
                        <td className="hidden md:table-cell py-4 px-4">
                          <p className="text-gray-600 truncate max-w-xs">
                            {tax.description || "No description"}
                          </p>
                        </td>
                        <td className="hidden md:table-cell py-4 px-4">
                          <div className="flex flex-wrap gap-1">
                            {tax.country_rates && tax.country_rates.map((rate, index) => (
                              <Badge key={index} className="bg-gray-100 text-gray-700">
                                {rate.country}: {rate.rate}%
                              </Badge>
                            ))}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-1.5">
                            {tax.is_default && (
                              <Badge className="bg-green-100 text-green-700">
                                Default
                              </Badge>
                            )}
                            {tax.demo && (
                              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
                                Demo
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center space-x-2">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <ChevronDown className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedTax(tax);
                                    setShowTaxForm(true);
                                  }}
                                >
                                  <Edit className="w-4 h-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleDeleteTax(tax.id)}
                                  className="text-red-600"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <Receipt className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No tax rules found</h3>
                <p className="text-gray-600 mb-6">
                  {searchQuery
                    ? "Try adjusting your search"
                    : selectedStore
                      ? "Start by adding your first tax rule to handle different tax rates"
                      : "You don't have any stores yet. Please create a store first to manage tax rules."}
                </p>
                <Button
                  onClick={() => {
                    setSelectedTax(null);
                    setShowTaxForm(true);
                  }}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 material-ripple"
                  disabled={!selectedStore}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Tax Rule
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={showTaxForm} onOpenChange={setShowTaxForm}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedTax ? 'Edit Tax Rule' : 'Add New Tax Rule'}
              </DialogTitle>
            </DialogHeader>
            <TaxForm
              tax={selectedTax}
              onSubmit={selectedTax ? handleUpdateTax : handleCreateTax}
              onCancel={() => {
                setShowTaxForm(false);
                setSelectedTax(null);
              }}
            />
          </DialogContent>
        </Dialog>
        <AlertComponent />
      </div>
    </div>
  );
}
