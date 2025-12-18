
import React, { useState, useEffect } from "react";
import { CmsPage } from "@/api/entities";
import { Product } from "@/api/entities";
import { Store } from "@/api/entities";
import { useStoreSelection } from "@/contexts/StoreSelectionContext.jsx";
import NoStoreSelected from "@/components/admin/NoStoreSelected";
import {
  FileText,
  Plus,
  Search,
  Edit,
  Trash2
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
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { createCmsPageUrl } from "@/utils/urlUtils";
import FlashMessage from "@/components/storefront/FlashMessage";
import CmsPageForm from "@/components/admin/cms/CmsPageForm";
import { getPageTitle } from "@/utils/translationUtils";
import { useAlertTypes } from "@/hooks/useAlert";
import { clearCmsPagesCache } from "@/utils/cacheUtils";
import { PageLoader } from "@/components/ui/page-loader";

export default function CmsPages() {
  const { selectedStore, getSelectedStoreId } = useStoreSelection();
  const { showConfirm, AlertComponent } = useAlertTypes();
  const [pages, setPages] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingPage, setEditingPage] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [flashMessage, setFlashMessage] = useState(null);
  const [fullStore, setFullStore] = useState(null);

  useEffect(() => {
    if (selectedStore) {
      loadPages();
      loadFullStore();
    }
  }, [selectedStore]);

  const loadFullStore = async () => {
    if (selectedStore?.id) {
      try {
        const fullStoreData = await Store.findById(selectedStore.id);
        const store = Array.isArray(fullStoreData) ? fullStoreData[0] : fullStoreData;
        setFullStore(store);
      } catch (error) {
        console.error('Error loading full store data:', error);
      }
    }
  };

  // Listen for store changes
  useEffect(() => {
    const handleStoreChange = () => {
      if (selectedStore) {
        loadPages();
      }
    };

    window.addEventListener('storeSelectionChanged', handleStoreChange);
    return () => window.removeEventListener('storeSelectionChanged', handleStoreChange);
  }, [selectedStore]);

  const loadPages = async () => {
    const storeId = getSelectedStoreId();
    if (!storeId) {
      console.warn("CmsPages: No store selected.");
      setPages([]);
      setProducts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {

      const [pagesData, productsData] = await Promise.all([
        CmsPage.filter({ store_id: storeId }),
        Product.filter({ store_id: storeId, include_all_translations: 'true' })
      ]);
      setPages(pagesData || []);
      setProducts(productsData || []);
    } catch (error) {
      console.error("Error loading CMS pages:", error);
      setPages([]);
      setProducts([]);
      setFlashMessage({ type: 'error', message: 'Failed to load CMS pages.' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePage = async (pageData) => {
    const storeId = getSelectedStoreId();
    if (!storeId) {
      setFlashMessage({ type: 'error', message: 'Cannot create page: No store selected.' });
      return;
    }

    try {
      if (!pageData.store_id) {
        pageData.store_id = storeId;
      }

      await CmsPage.create(pageData);
      await loadPages();
      setShowForm(false);
      setFlashMessage({ type: 'success', message: 'CMS Page created successfully!' });
      // Clear storefront cache for instant updates
      if (storeId) clearCmsPagesCache(storeId);
    } catch (error) {
      console.error("❌ Error creating CMS page:", error);
      console.error("❌ Error response data:", error.response?.data);
      console.error("❌ Error response status:", error.response?.status);
      console.error("❌ Full error object:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));

      const errorMsg = error.response?.data?.error ||
                      error.response?.data?.message ||
                      error.message ||
                      'Unknown error';

      setFlashMessage({ type: 'error', message: `Failed to create CMS page: ${errorMsg}` });
    }
  };

  const handleUpdatePage = async (pageData) => {
    try {
      await CmsPage.update(editingPage.id, pageData);
      await loadPages();
      setShowForm(false);
      setEditingPage(null);
      setFlashMessage({ type: 'success', message: 'CMS Page updated successfully!' });
      // Clear storefront cache for instant updates
      const storeId = getSelectedStoreId();
      if (storeId) clearCmsPagesCache(storeId);
    } catch (error) {
      console.error("❌ Error updating CMS page:", error);
      console.error("❌ Error response data:", error.response?.data);
      console.error("❌ Error response status:", error.response?.status);
      console.error("❌ Full error object:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));

      const errorMsg = error.response?.data?.error ||
                      error.response?.data?.message ||
                      error.message ||
                      'Unknown error';

      setFlashMessage({ type: 'error', message: `Failed to update CMS page: ${errorMsg}` });
    }
  };

  const handleToggleActive = async (page) => {
    try {
      await CmsPage.update(page.id, { ...page, is_active: !page.is_active });
      setFlashMessage({ type: 'success', message: `CMS Page ${page.is_active ? 'deactivated' : 'activated'} successfully!` });
      await loadPages();
      // Clear storefront cache for instant updates
      const storeId = getSelectedStoreId();
      if (storeId) clearCmsPagesCache(storeId);
    } catch (error) {
      console.error("Failed to toggle page status", error);
      setFlashMessage({ type: 'error', message: 'Failed to toggle page status.' });
    }
  };

  const handleDeletePage = async (pageId, isSystem) => {
    // Prevent deletion of system pages
    if (isSystem) {
      setFlashMessage({
        type: 'error',
        message: 'Cannot delete system pages. System pages like 404 are critical for site functionality.'
      });
      return;
    }

    const confirmed = await showConfirm("Are you sure you want to delete this CMS page?", "Delete CMS Page");
    if (confirmed) {
      try {
        await CmsPage.delete(pageId);
        await loadPages();
        setFlashMessage({ type: 'success', message: 'CMS Page deleted successfully!' });
        // Clear storefront cache for instant updates
        const storeId = getSelectedStoreId();
        if (storeId) clearCmsPagesCache(storeId);
      } catch (error) {
        console.error("Error deleting CMS page:", error);
        setFlashMessage({ type: 'error', message: 'Failed to delete CMS page.' });
      }
    }
  };

  const filteredPages = pages.filter(page => {
    const pageTitle = getPageTitle(page);
    return pageTitle.toLowerCase().includes(searchQuery.toLowerCase());
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
      <AlertComponent />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">CMS Pages</h1>
            <p className="text-gray-600 mt-1">Manage your content pages</p>
          </div>
          <Button
            onClick={() => {
              setEditingPage(null); // Updated state setter
              setShowForm(true); // Updated state setter
            }}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 material-ripple material-elevation-1"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add CMS Page
          </Button>
        </div>

        <Card className="material-elevation-1 border-0 mb-6">
          <CardContent className="p-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                placeholder="Search pages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredPages.map((page) => ( // Mapping over filteredPages
            <Card key={page.id} className="material-elevation-1 border-0 hover:material-elevation-2 transition-all duration-300">
              <CardHeader>
                <CardTitle className="flex justify-between items-start">
                  <span>{getPageTitle(page)}</span>
                  <div className="flex gap-2">
                    {page.is_system && (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                        System
                      </Badge>
                    )}
                    {page.demo && (
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
                        Demo
                      </Badge>
                    )}
                    <Badge variant={page.is_active ? "default" : "secondary"}>
                      {page.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </CardTitle>
                <p className="text-sm text-gray-500">/{page.slug}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Active</span>
                  <Switch
                    checked={page.is_active}
                    onCheckedChange={() => handleToggleActive(page)}
                  />
                </div>

                <div className="flex justify-between items-center">
                  <div className="flex space-x-2">
                    {(fullStore?.slug || selectedStore?.slug) ? (
                      <Link to={createCmsPageUrl(fullStore?.slug || selectedStore?.slug, page.slug)} target="_blank">
                        <Button variant="outline" size="sm">View</Button>
                      </Link>
                    ) : (
                      <Button variant="outline" size="sm" disabled title="Store slug not available">View</Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingPage(page);
                        setShowForm(true);
                      }}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    {!page.is_system && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeletePage(page.id, page.is_system)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Dialog open={showForm} onOpenChange={setShowForm}> {/* Updated state variable and setter */}
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingPage ? 'Edit CMS Page' : 'Add New CMS Page'} {/* Updated state variable */}
              </DialogTitle>
            </DialogHeader>
            <CmsPageForm
              page={editingPage} // Updated state variable
              stores={selectedStore ? [selectedStore] : []}
              products={products}
              onSubmit={editingPage ? handleUpdatePage : handleCreatePage} // Updated state variable
              onCancel={() => setShowForm(false)} // Updated state setter
            />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
