
import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Product } from "@/api/entities";
import { Category } from "@/api/entities";
import { Tax } from "@/api/entities";
import { Attribute } from "@/api/entities";
import { AttributeSet } from "@/api/entities";
import { User } from "@/api/entities";
import { useStoreSelection } from "@/contexts/StoreSelectionContext.jsx";
import NoStoreSelected from "@/components/admin/NoStoreSelected";
import { getPrimaryImageUrl } from "@/utils/imageUtils";
import {
  Package,
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  ChevronDown,
  X,
  CheckSquare,
  Square,
  Settings,
  Tag,
  FolderOpen,
  Languages,
  Globe,
  Save,
  MoreVertical,
  Wand2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PageLoader } from "@/components/ui/page-loader";

import ProductForm from "@/components/admin/products/ProductForm";
import ProductFilters from "@/components/admin/products/ProductFilters";
import BulkTranslateDialog from "@/components/admin/BulkTranslateDialog";
import FlashMessage from "@/components/storefront/FlashMessage";
import { getCategoryName as getTranslatedCategoryName, getProductName, getProductShortDescription } from "@/utils/translationUtils";
import { toast } from "sonner";
import { useTranslation } from "@/contexts/TranslationContext.jsx";
import { SaveButton } from "@/components/ui/save-button";
import api from "@/utils/api";

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const retryApiCall = async (apiCall, maxRetries = 5, baseDelay = 3000) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await apiCall();
    } catch (error) {
      if (error.response?.status === 429 && i < maxRetries - 1) {
        const delayTime = baseDelay * Math.pow(2, i) + Math.random() * 2000;
        console.warn(`ProductsPage: Rate limit hit, retrying in ${delayTime.toFixed(0)}ms... (Attempt ${i + 1}/${maxRetries})`);
        await delay(delayTime);
        continue;
      }
      throw error;
    }
  }
};

export default function Products() {
  const navigate = useNavigate();
  const { selectedStore, getSelectedStoreId, availableStores } = useStoreSelection();
  const { availableLanguages, t } = useTranslation();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [taxes, setTaxes] = useState([]);
  const [attributes, setAttributes] = useState([]);
  const [attributeSets, setAttributeSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showProductForm, setShowProductForm] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [filters, setFilters] = useState({
    status: "all",
    category: "all",
    priceRange: "all"
  });

  // Bulk action states
  const [selectedProducts, setSelectedProducts] = useState(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [bulkActionInProgress, setBulkActionInProgress] = useState(false);
  const [bulkDeleteInProgress, setBulkDeleteInProgress] = useState(false);

  // Translation dialog state
  const [showBulkTranslateDialog, setShowBulkTranslateDialog] = useState(false);

  // Translation Mode states
  const [translationMode, setTranslationMode] = useState(false);
  const [selectedTranslationLanguages, setSelectedTranslationLanguages] = useState(['en', 'nl']);
  const [editingTranslation, setEditingTranslation] = useState({}); // { productId: { lang: 'value' } }
  const [failedImages, setFailedImages] = useState(new Set()); // Track failed image loads
  const [translating, setTranslating] = useState({}); // { productId-langCode: boolean } for AI translation loading

  // FlashMessage state
  const [flashMessage, setFlashMessage] = useState(null);

  // User credits for AI translations
  const [userCredits, setUserCredits] = useState(null);

  // Confirmation modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmModalTitle, setConfirmModalTitle] = useState('');
  const [confirmModalMessage, setConfirmModalMessage] = useState('');
  const [confirmModalAction, setConfirmModalAction] = useState(null);

  useEffect(() => {
    document.title = "Products - Admin Dashboard";
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
      console.warn("No store selected");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Build filters for products API - load products using admin API
      const productFilters = {
        store_id: storeId,
        order_by: "-created_date",
        _t: Date.now() // Cache-busting timestamp
      };

      // First, load other data and get initial product batch
      // Use 1000 as page size (Supabase max rows per query)
      const PAGE_SIZE = 1000;
      const [firstProductBatch, categoriesData, taxesData, attributesData, attributeSetsData] = await Promise.all([
        retryApiCall(() => {
          return Product.findPaginated(1, PAGE_SIZE, productFilters);
        }).catch((error) => {
          console.error('❌ Product.findPaginated failed:', error);
          return { data: [], pagination: { total: 0, total_pages: 0, current_page: 1 } };
        }),
        retryApiCall(() => Category.findAll({ store_id: storeId, limit: 1000 })).catch((error) => {
          console.error('❌ Category.findAll failed:', error);
          return [];
        }),
        retryApiCall(() => Tax.filter({ store_id: storeId, limit: 1000 })).catch((error) => {
          console.error('❌ Tax.filter failed:', error);
          return [];
        }),
        retryApiCall(() => Attribute.filter({ store_id: storeId, limit: 1000 })).catch((error) => {
          console.error('❌ Attribute.filter failed:', error);
          return [];
        }),
        retryApiCall(() => AttributeSet.filter({ store_id: storeId, limit: 1000 })).catch((error) => {
          console.error('❌ AttributeSet.filter failed:', error);
          return [];
        })
      ]);

      // Set other data immediately
      setCategories(Array.isArray(categoriesData) ? categoriesData : []);
      setTaxes(Array.isArray(taxesData) ? taxesData : []);
      setAttributes(Array.isArray(attributesData) ? attributesData : []);
      setAttributeSets(Array.isArray(attributeSetsData) ? attributeSetsData : []);

      // Collect all products
      let allProducts = Array.isArray(firstProductBatch.data) ? [...firstProductBatch.data] : [];
      const totalProductsInStore = firstProductBatch.pagination?.total || 0;
      const totalPages = firstProductBatch.pagination?.total_pages || 1;

      // Check if we need to load more products
      if (totalPages > 1) {
        // Load pages 2 onwards in smaller batches to avoid timeout
        const batchSize = 3; // Load 3 pages at a time

        for (let page = 2; page <= totalPages; page += batchSize) {
          const pagesToLoad = [];
          const endPage = Math.min(page + batchSize - 1, totalPages);

          // Create promises for this batch
          for (let p = page; p <= endPage; p++) {
            pagesToLoad.push(
              retryApiCall(() => Product.findPaginated(p, PAGE_SIZE, productFilters))
                .catch((error) => {
                  console.error(`❌ Failed to load page ${p}:`, error);
                  return { data: [] };
                })
            );
          }

          // Load this batch of pages
          const batchResults = await Promise.all(pagesToLoad);

          // Add products from each page
          for (const result of batchResults) {
            if (result.data && Array.isArray(result.data)) {
              allProducts = [...allProducts, ...result.data];
            }
          }

          // Update UI with current progress - force re-render
          setProducts([...allProducts]); // Create new array to force React re-render
          setTotalItems(totalProductsInStore);
          setTotalPages(Math.ceil(allProducts.length / itemsPerPage));

          // Small delay to ensure UI updates properly
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // Final state update - ensure fresh array reference
      setProducts([...allProducts]); // Force React re-render with new array reference
      setTotalItems(totalProductsInStore);
      setTotalPages(Math.ceil(allProducts.length / itemsPerPage));
      setCurrentPage(1);

    } catch (error) {
      console.error("❌ Products: Error loading data:", error);
      console.error("❌ Error details:", error.message, error.stack);
      setProducts([]);
      setCategories([]);
      setTaxes([]);
      setAttributes([]);
      setAttributeSets([]);
      setTotalItems(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  };

  // Load user credits for AI translation checks
  const loadUserCredits = async () => {
    try {
      const userData = await User.me();
      setUserCredits(userData.credits || 0);
    } catch (error) {
      console.error('Failed to load user credits:', error);
      setUserCredits(0);
    }
  };

  // Load user credits on component mount
  useEffect(() => {
    loadUserCredits();
  }, []);

  // Fetch fresh product data for editing (includes attributes from product_attribute_values)
  const handleEditProduct = async (product) => {
    try {
      const freshProduct = await Product.findById(product.id);
      setSelectedProduct(freshProduct || product);
      setShowProductForm(true);
    } catch (error) {
      console.error("Error fetching product for edit:", error);
      // Fallback to list data if fetch fails
      setSelectedProduct(product);
      setShowProductForm(true);
    }
  };

  const handleCreateProduct = async (productData) => {
    const storeId = getSelectedStoreId();
    if (!storeId) {
      throw new Error("No store selected");
    }

    try {
      const result = await Product.create({ ...productData, store_id: storeId });
      await loadData();
      setShowProductForm(false);
    } catch (error) {
      console.error("Error creating product:", error);
      throw error;
    }
  };

  const handleUpdateProduct = async (productData) => {
    try {
      const { id, ...updateData } = productData;

      const result = await Product.update(id, updateData);

      // Clear selected product and close form BEFORE reloading data
      // This prevents the modal from reopening with stale data
      setSelectedProduct(null);
      setShowProductForm(false);

      // Reload the product list with fresh data
      await loadData();

    } catch (error) {
      console.error("Error updating product:", error);
      await loadData();
      throw error;
    }
  };

  const handleDeleteProduct = (productId) => {
    setConfirmModalTitle('Delete Product');
    setConfirmModalMessage('Are you sure you want to delete this product? This action cannot be undone.');
    setConfirmModalAction(() => async () => {
      try {
        await Product.delete(productId);
        await loadData();
        setShowConfirmModal(false);
        setFlashMessage({ type: 'success', message: 'Product deleted successfully' });
      } catch (error) {
        console.error("Error deleting product:", error);
        setShowConfirmModal(false);
        setFlashMessage({
          type: 'error',
          message: error.message || 'Failed to delete product'
        });
      }
    });
    setShowConfirmModal(true);
  };

  // Bulk action handlers
  const handleSelectProduct = (productId) => {
    const newSelected = new Set(selectedProducts);
    if (newSelected.has(productId)) {
      newSelected.delete(productId);
    } else {
      newSelected.add(productId);
    }
    setSelectedProducts(newSelected);
    setShowBulkActions(newSelected.size > 0);
  };

  const handleSelectAll = () => {
    if (selectedProducts.size === paginatedProducts.length) {
      setSelectedProducts(new Set());
      setShowBulkActions(false);
    } else {
      const allIds = new Set(paginatedProducts.map(p => p.id));
      setSelectedProducts(allIds);
      setShowBulkActions(true);
    }
  };

  const handleBulkDelete = () => {
    if (selectedProducts.size === 0) return;

    const count = selectedProducts.size;
    setConfirmModalTitle('Delete Products');
    setConfirmModalMessage(`Are you sure you want to delete ${count} selected product${count > 1 ? 's' : ''}? This action cannot be undone.`);
    setConfirmModalAction(() => async () => {
      setShowConfirmModal(false);
      setBulkDeleteInProgress(true);

      // Delete products one by one to handle individual errors
      const results = { success: [], failed: [] };

      for (const id of Array.from(selectedProducts)) {
        try {
          await Product.delete(id);
          results.success.push(id);
        } catch (error) {
          console.error(`Error deleting product ${id}:`, error);
          results.failed.push({ id, error });
        }
      }

      // Clear selection and refresh
      setSelectedProducts(new Set());
      setShowBulkActions(false);
      await loadData();

      setBulkDeleteInProgress(false);

      // Show appropriate message
      if (results.failed.length === 0) {
        // All succeeded
        setFlashMessage({
          type: 'success',
          message: `${results.success.length} product${results.success.length > 1 ? 's' : ''} deleted successfully`
        });
      } else if (results.success.length === 0) {
        // All failed
        const firstError = results.failed[0].error;
        setFlashMessage({
          type: 'error',
          message: firstError.message || 'Failed to delete products'
        });
      } else {
        // Partial success
        setFlashMessage({
          type: 'warning',
          message: `${results.success.length} product${results.success.length > 1 ? 's' : ''} deleted, ${results.failed.length} failed`
        });
      }
    });
    setShowConfirmModal(true);
  };

  const handleBulkStatusChange = async (newStatus) => {
    if (selectedProducts.size === 0) return;

    // Prevent double execution
    if (bulkActionInProgress) {
      return;
    }

    setBulkActionInProgress(true);

    try {
      const updatePromises = Array.from(selectedProducts).map(id => {
        // Find product in full products array, not just paginated/filtered ones
        const product = products.find(p => p.id === id);
        if (!product) {
          console.warn(`❌ Product with id ${id} not found in products array`);
          return Promise.resolve();
        }
        return Product.update(id, { status: newStatus })
          .catch(error => {
            console.error(`❌ Failed to update product ${id}:`, error);
            throw error;
          });
      });

      await Promise.all(updatePromises);

      setSelectedProducts(new Set());
      setShowBulkActions(false);

      await loadData();
    } catch (error) {
      console.error("❌ Error updating product statuses:", error);
    } finally {
      setBulkActionInProgress(false);
    }
  };

  // Helper function to get all parent category IDs recursively
  const getParentCategoryIds = (categoryId, allCategories) => {
    const parentIds = [];
    let currentCategory = allCategories.find(c => c.id === categoryId);

    while (currentCategory && currentCategory.parent_id) {
      parentIds.push(currentCategory.parent_id);
      currentCategory = allCategories.find(c => c.id === currentCategory.parent_id);
    }

    return parentIds;
  };

  const handleBulkCategoryChange = async (categoryId) => {
    if (selectedProducts.size === 0) return;

    try {
      const updatePromises = Array.from(selectedProducts).map(id => {
        const product = paginatedProducts.find(p => p.id === id);
        let newCategories = [];

        if (categoryId) {
          // Include the selected category and all its parent categories
          const parentIds = getParentCategoryIds(categoryId, categories);
          newCategories = [categoryId, ...parentIds];
        }

        return Product.update(id, { ...product, category_ids: newCategories });
      });
      await Promise.all(updatePromises);
      setSelectedProducts(new Set());
      setShowBulkActions(false);
      await loadData();
    } catch (error) {
      console.error("Error updating product categories:", error);
    }
  };

  const handleBulkAttributeSetChange = async (attributeSetId) => {
    if (selectedProducts.size === 0) return;

    try {
      const updatePromises = Array.from(selectedProducts).map(id => {
        const product = paginatedProducts.find(p => p.id === id);
        return Product.update(id, { ...product, attribute_set_id: attributeSetId });
      });
      await Promise.all(updatePromises);
      setSelectedProducts(new Set());
      setShowBulkActions(false);
      await loadData();
    } catch (error) {
      console.error("Error updating product attribute sets:", error);
    }
  };

  const handleBulkTranslate = async (fromLang, toLang) => {
    const storeId = getSelectedStoreId();
    if (!storeId) {
      toast.error("No store selected");
      return { success: false, message: "No store selected" };
    }

    try {
      const token = localStorage.getItem("token");
      const response = await fetch('/api/products/bulk-translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          store_id: storeId,
          fromLang,
          toLang
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Translation failed');
      }

      // Reload products to get updated translations
      await loadData();

      return data;
    } catch (error) {
      console.error('Bulk translate error:', error);
      return { success: false, message: error.message };
    }
  };

  const handleStatusChange = async (product, newStatus) => {
    try {
      await Product.update(product.id, { status: newStatus });

      // Reset status filter to "all" to show updated product regardless of its new status
      setFilters(prev => ({ ...prev, status: "all" }));

      await loadData();
    } catch (error) {
      console.error("Error updating product status:", error);
    }
  };

  // Translation Mode handlers
  const handleToggleTranslationLanguage = (langCode) => {
    setSelectedTranslationLanguages(prev => {
      if (prev.includes(langCode)) {
        // Don't allow removing if it's the last language
        if (prev.length === 1) return prev;
        return prev.filter(l => l !== langCode);
      } else {
        return [...prev, langCode];
      }
    });
  };

  const handleTranslationEdit = (productId, langCode, value) => {
    setEditingTranslation(prev => ({
      ...prev,
      [productId]: {
        ...(prev[productId] || {}),
        [langCode]: value
      }
    }));
  };

  const handleSaveTranslation = async (product) => {
    const productId = product.id;
    const edits = editingTranslation[productId];

    if (!edits) return;

    try {
      // Merge edits with existing translations
      const updatedTranslations = {
        ...(product.translations || {}),
        ...Object.keys(edits).reduce((acc, lang) => {
          acc[lang] = {
            ...(product.translations?.[lang] || {}),
            name: edits[lang]
          };
          return acc;
        }, {})
      };

      await Product.update(productId, { translations: updatedTranslations });

      // Update local state instead of reloading
      setProducts(prevProducts => prevProducts.map(p =>
        p.id === productId ? { ...p, translations: updatedTranslations } : p
      ));

      // Clear editing state for this product
      setEditingTranslation(prev => {
        const newState = { ...prev };
        delete newState[productId];
        return newState;
      });

      toast.success('Translations saved successfully');
    } catch (error) {
      console.error('Error saving translations:', error);
      toast.error('Failed to save translations');
    }
  };

  // AI translate product name from English to target language
  const handleAITranslate = async (product, toLang) => {
    const storeId = getSelectedStoreId();
    const sourceText = product.translations?.en?.name || product.name;

    if (!sourceText || !sourceText.trim()) {
      toast.error('No English product name found for translation');
      return;
    }

    const translatingKey = `${product.id}-${toLang}`;
    try {
      setTranslating(prev => ({ ...prev, [translatingKey]: true }));

      const response = await api.post('/translations/ai-translate', {
        text: sourceText,
        fromLang: 'en',
        toLang,
        storeId,
        entityType: 'product'
      });

      if (response && response.success && response.data) {
        // Update the editing translation state with the AI-translated text
        handleTranslationEdit(product.id, toLang, response.data.translated);
        toast.success(`Product name translated to ${toLang.toUpperCase()} (0.1 credits charged)`);
      }
    } catch (error) {
      console.error('AI translate error:', error);
      if (error.response?.status === 402) {
        toast.error('Insufficient credits for translation');
      } else {
        toast.error('Failed to translate product name');
      }
    } finally {
      setTranslating(prev => ({ ...prev, [translatingKey]: false }));
    }
  };

  const getTranslationStats = (product) => {
    if (!product.translations) return { completed: 0, total: availableLanguages.length };

    const completed = availableLanguages.filter(lang => {
      const translation = product.translations[lang.code];
      return translation && translation.name && translation.name.trim().length > 0;
    }).length;

    return { completed, total: availableLanguages.length };
  };

  const handleImageError = (productId) => {
    setFailedImages(prev => new Set([...prev, productId]));
  };

  // Client-side filtering for search and filters (all data is loaded)
  const filteredProducts = products.filter(product => {
    // Search filter - use translation utilities
    const productName = getProductName(product);
    const productShortDesc = getProductShortDescription(product);
    const matchesSearch = !searchQuery.trim() ||
      productName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      productShortDesc?.toLowerCase().includes(searchQuery.toLowerCase());

    // Status filter
    const matchesStatus = filters.status === "all" || product.status === filters.status;

    // Category filter
    const matchesCategory = filters.category === "all" ||
      (product.category_ids && product.category_ids.includes(filters.category));

    // Price range filter
    let matchesPriceRange = true;
    if (filters.priceRange !== "all") {
      const price = parseFloat(product.price || 0);
      switch (filters.priceRange) {
        case "under50":
          matchesPriceRange = price < 50;
          break;
        case "50-200":
          matchesPriceRange = price >= 50 && price <= 200;
          break;
        case "over200":
          matchesPriceRange = price > 200;
          break;
      }
    }

    return matchesSearch && matchesStatus && matchesCategory && matchesPriceRange;
  });

  // Client-side pagination for display
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedProducts = filteredProducts.slice(startIndex, startIndex + itemsPerPage);
  
  // Calculate pagination based on filtered results
  const calculatedTotalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  
  // Memoized calculations for bulk actions
  const isAllSelected = useMemo(() => {
    return paginatedProducts.length > 0 && selectedProducts.size === paginatedProducts.length;
  }, [selectedProducts, paginatedProducts]);
  
  const isPartiallySelected = useMemo(() => {
    return selectedProducts.size > 0 && selectedProducts.size < paginatedProducts.length;
  }, [selectedProducts, paginatedProducts]);

  // Handle page changes (client-side only)
  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  // Reset to first page when search or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filters]);

  // Enhanced pagination component
  const renderPagination = (currentPage, totalPages, onPageChange) => {
    const getVisiblePages = () => {
      const pages = [];

      // Always show previous page if exists
      if (currentPage > 1) {
        pages.push(currentPage - 1);
      }

      // Always show current page (non-clickable, highlighted)
      pages.push(currentPage);

      // Show next 3 pages if they exist
      for (let i = 1; i <= 3 && currentPage + i <= totalPages; i++) {
        pages.push(currentPage + i);
      }

      return pages;
    };

    const visiblePages = getVisiblePages();

    // Build the product count text with proper singular/plural
    const getProductCountText = () => {
      const total = filteredProducts.length;
      if (total === 0) return `0 ${t('common.products', 'products')}`;
      if (total === 1) return `1 ${t('common.product', 'product')}`;

      const start = startIndex + 1;
      const end = Math.min(startIndex + itemsPerPage, total);

      // If showing all products on one page, just show the count
      if (start === 1 && end === total) {
        return `${total} ${t('common.products', 'products')}`;
      }

      return `${t('common.showing', 'Showing')} ${start}-${end} ${t('common.of', 'of')} ${total} ${t('common.products', 'products')}`;
    };

    return (
      <div className="flex items-center justify-between mt-6">
        <p className="text-sm text-gray-700">
          {getProductCountText()}
        </p>

        {/* Only show navigation when there are multiple pages */}
        {totalPages > 1 && (
          <div className="flex items-center space-x-2">
            {/* Previous Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              Previous
            </Button>

            {/* Page Numbers */}
            {visiblePages.map((page) => (
              <Button
                key={page}
                variant={currentPage === page ? "default" : "outline"}
                size="sm"
                onClick={currentPage === page ? undefined : () => onPageChange(page)}
                disabled={currentPage === page}
                className={currentPage === page ? "bg-blue-600 text-white cursor-default" : ""}
              >
                {page}
              </Button>
            ))}

            {/* Show ellipsis and last page if there are more pages */}
            {currentPage + 3 < totalPages && (
              <>
                <span className="px-2 text-gray-500">...</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPageChange(totalPages)}
                >
                  {totalPages}
                </Button>
              </>
            )}

            {/* Next Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>

            {/* Page Dropdown */}
            <div className="ml-4">
              <Select
                value={currentPage.toString()}
                onValueChange={(value) => onPageChange(parseInt(value))}
              >
                <SelectTrigger className="w-20">
                  <SelectValue placeholder={currentPage} />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <SelectItem key={page} value={page.toString()}>
                      {page}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Page Info */}
            <span className="ml-4 text-sm text-gray-600">
              of {totalPages} {totalPages === 1 ? t('common.page', 'page') : t('common.pages', 'pages')}
            </span>
          </div>
        )}
      </div>
    );
  };

  const getCategoryName = (categoryIds) => {
    if (!categoryIds || !Array.isArray(categoryIds) || categoryIds.length === 0) {
      return "Uncategorized";
    }

    const category = categories.find(cat => cat && categoryIds.includes(cat.id));
    return category ? getTranslatedCategoryName(category) : "Uncategorized";
  };

  const statusColors = {
    draft: "bg-gray-100 text-gray-700",
    active: "bg-green-100 text-green-700",
    inactive: "bg-red-100 text-red-700"
  };

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
            <h1 className="text-3xl font-bold text-gray-900">Products</h1>
            <p className="text-gray-600 mt-1">Manage your product catalog</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setTranslationMode(!translationMode)}
              variant={translationMode ? "default" : "outline"}
              className={translationMode
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "border-blue-600 text-blue-600 hover:bg-blue-50"
              }
              disabled={!selectedStore || products.length === 0}
            >
              <Languages className="w-4 h-4 mr-2" />
              Translation Mode
            </Button>
            <Button
              onClick={() => setShowBulkTranslateDialog(true)}
              variant="outline"
              className="border-blue-600 text-blue-600 hover:bg-blue-50"
              disabled={!selectedStore || products.length === 0}
            >
              <Languages className="w-4 h-4 mr-2" />
              Bulk AI Translate
            </Button>
            <Button
            onClick={() => {
              setSelectedProduct(null);
              setShowProductForm(true);
            }}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 material-ripple material-elevation-1"
            disabled={!selectedStore}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Product
          </Button>
          </div>
        </div>

        <Card className="material-elevation-1 border-0 mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  placeholder="Search products by name or SKU..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <ProductFilters
                filters={filters}
                setFilters={setFilters}
                categories={categories}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="material-elevation-1 border-0">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{filteredProducts.length === 1 ? t('common.product', 'Product') : t('common.products', 'Products')} ({filteredProducts.length})</span>
              {(searchQuery || Object.values(filters).some(f => f !== "all")) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchQuery("");
                    setFilters({ status: "all", category: "all", priceRange: "all" });
                  }}
                >
                  <X className="w-4 h-4 mr-2" />
                  Clear Filters
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {paginatedProducts.length > 0 ? (
              <>
                {/* Bulk Actions Bar */}
                {showBulkActions && (
                  <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4 rounded-r-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <p className="text-sm font-medium text-blue-800">
                          {selectedProducts.size} product{selectedProducts.size > 1 ? 's' : ''} selected
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Eye className="w-4 h-4 mr-2" />
                              Change Status
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => handleBulkStatusChange('active')}>
                              <Eye className="w-4 h-4 mr-2" />
                              Activate
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleBulkStatusChange('inactive')}>
                              <EyeOff className="w-4 h-4 mr-2" />
                              Deactivate
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleBulkStatusChange('draft')}>
                              <Edit className="w-4 h-4 mr-2" />
                              Set as Draft
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                              <FolderOpen className="w-4 h-4 mr-2" />
                              Move to Category
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => handleBulkCategoryChange(null)}>
                              Remove from categories
                            </DropdownMenuItem>
                            {categories.map((category) => (
                              <DropdownMenuItem
                                key={category.id}
                                onClick={() => handleBulkCategoryChange(category.id)}
                              >
                                <Tag className="w-4 h-4 mr-2" />
                                {getTranslatedCategoryName(category)}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Settings className="w-4 h-4 mr-2" />
                              Change Attribute Set
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            {attributeSets.map((attributeSet) => (
                              <DropdownMenuItem 
                                key={attributeSet.id} 
                                onClick={() => handleBulkAttributeSetChange(attributeSet.id)}
                              >
                                <Settings className="w-4 h-4 mr-2" />
                                {attributeSet.name}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        
                        <SaveButton
                          defaultText="Delete Selected"
                          loadingText="Deleting..."
                          successText="Deleted!"
                          onClick={handleBulkDelete}
                          loading={bulkDeleteInProgress}
                          disabled={bulkDeleteInProgress}
                          size="sm"
                          className="bg-red-600 hover:bg-red-700 text-white"
                          icon={<Trash2 className="w-4 h-4 mr-2" />}
                        />
                        
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => {
                            setSelectedProducts(new Set());
                            setShowBulkActions(false);
                          }}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        {!translationMode && (
                          <th className="text-left py-3 px-4 font-medium text-gray-900 w-12">
                            <button
                              onClick={handleSelectAll}
                              className="flex items-center justify-center w-6 h-6 rounded border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              {isAllSelected ? (
                                <CheckSquare className="w-4 h-4 text-blue-600" />
                              ) : isPartiallySelected ? (
                                <div className="w-3 h-3 bg-blue-600 rounded-sm" />
                              ) : (
                                <Square className="w-4 h-4 text-gray-400" />
                              )}
                            </button>
                          </th>
                        )}
                        <th className="text-left py-3 px-4 font-medium text-gray-900">
                          {translationMode ? (
                            <div className="space-y-2">
                              <div className="text-sm font-semibold text-gray-900">Product Translations</div>
                              <div className="flex flex-wrap gap-2">
                                {availableLanguages.map((lang) => (
                                  <label
                                    key={lang.code}
                                    className="flex items-center gap-1.5 px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 cursor-pointer text-xs"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={selectedTranslationLanguages.includes(lang.code)}
                                      onChange={() => handleToggleTranslationLanguage(lang.code)}
                                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="font-medium">{lang.code.toUpperCase()}</span>
                                    <span className="text-gray-600">({lang.native_name})</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          ) : (
                            'Product'
                          )}
                        </th>
                        {!translationMode && (
                          <>
                            <th className="text-left py-3 px-4 font-medium text-gray-900">SKU</th>
                            <th className="text-left py-3 px-4 font-medium text-gray-900">Price</th>
                            <th className="text-left py-3 px-4 font-medium text-gray-900">Stock</th>
                            <th className="text-left py-3 px-4 font-medium text-gray-900">Status</th>
                            <th className="text-left py-3 px-4 font-medium text-gray-900">Actions</th>
                          </>
                        )}
                        {translationMode && (
                          <th className="text-left py-3 px-4 font-medium text-gray-900">Actions</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedProducts.map((product) => {
                        const stats = translationMode ? getTranslationStats(product) : null;
                        const hasEdits = editingTranslation[product.id] && Object.keys(editingTranslation[product.id]).length > 0;

                        return (
                          <tr key={product.id} className={`border-b border-gray-100 hover:bg-gray-50 ${selectedProducts.has(product.id) ? 'bg-blue-50' : ''}`}>
                            {!translationMode && (
                              <td className="py-4 px-4">
                                <button
                                  onClick={() => handleSelectProduct(product.id)}
                                  className="flex items-center justify-center w-6 h-6 rounded border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                  {selectedProducts.has(product.id) ? (
                                    <CheckSquare className="w-4 h-4 text-blue-600" />
                                  ) : (
                                    <Square className="w-4 h-4 text-gray-400" />
                                  )}
                                </button>
                              </td>
                            )}
                            <td className="py-4 px-4">
                              {translationMode ? (
                                <div className="space-y-3">
                                  <div className="flex items-center gap-3 pb-2 border-b border-gray-200">
                                    <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                      {product.images && product.images.length > 0 && !failedImages.has(product.id) ? (
                                        <img
                                          src={getPrimaryImageUrl(product.images)}
                                          alt={product.name}
                                          className="w-full h-full object-cover rounded-lg"
                                          onError={() => handleImageError(product.id)}
                                        />
                                      ) : (
                                        <Package className="w-6 h-6 text-gray-400" />
                                      )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="font-medium text-gray-900 truncate">{product.sku}</p>
                                      <p className="text-sm text-gray-500">
                                        {stats && (
                                          <span className={`inline-flex items-center gap-1 ${stats.completed === stats.total ? 'text-green-600' : 'text-gray-500'}`}>
                                            <Globe className="w-3 h-3" />
                                            {stats.completed}/{stats.total} languages
                                          </span>
                                        )}
                                      </p>
                                    </div>
                                  </div>
                                  {selectedTranslationLanguages.map((langCode) => {
                                    const lang = availableLanguages.find(l => l.code === langCode);
                                    const isRTL = lang?.is_rtl || false;
                                    const currentValue = editingTranslation[product.id]?.[langCode]
                                      ?? product.translations?.[langCode]?.name
                                      ?? '';
                                    const translatingKey = `${product.id}-${langCode}`;

                                    return (
                                      <div key={langCode} className="flex items-center gap-2">
                                        <label className="text-xs font-medium text-gray-700 w-10 flex-shrink-0">
                                          {langCode.toUpperCase()}
                                        </label>
                                        <Input
                                          type="text"
                                          value={currentValue}
                                          onChange={(e) => handleTranslationEdit(product.id, langCode, e.target.value)}
                                          dir={isRTL ? 'rtl' : 'ltr'}
                                          className={`flex-1 text-sm ${isRTL ? 'text-right' : 'text-left'}`}
                                          placeholder={`${lang?.native_name || langCode} product name`}
                                        />
                                        {langCode !== 'en' && (
                                          <TooltipProvider>
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <Button
                                                  type="button"
                                                  variant="ghost"
                                                  size="sm"
                                                  onClick={() => handleAITranslate(product, langCode)}
                                                  disabled={translating[translatingKey] || !(product.translations?.en?.name || product.name)}
                                                  className="flex-shrink-0 h-8 w-8 p-0"
                                                >
                                                  <Wand2 className={`w-4 h-4 ${translating[translatingKey] ? 'animate-spin' : ''}`} />
                                                </Button>
                                              </TooltipTrigger>
                                              <TooltipContent>
                                                <p>Cost: 0.1 credits per translation</p>
                                              </TooltipContent>
                                            </Tooltip>
                                          </TooltipProvider>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="flex items-center space-x-3">
                                  <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                                    {product.images && product.images.length > 0 && !failedImages.has(product.id) ? (
                                      <img
                                        src={getPrimaryImageUrl(product.images)}
                                        alt={product.name}
                                        className="w-full h-full object-cover rounded-lg"
                                        onError={() => handleImageError(product.id)}
                                      />
                                    ) : (
                                      <Package className="w-6 h-6 text-gray-400" />
                                    )}
                                  </div>
                                  <div>
                                    <p className="font-medium text-gray-900">{getProductName(product)}</p>
                                    <p className="text-sm text-gray-500 truncate max-w-xs">
                                      {getProductShortDescription(product)}
                                    </p>
                                  </div>
                                </div>
                              )}
                            </td>
                            {!translationMode && (
                              <>
                                <td className="py-4 px-4">
                                  <span className="font-mono text-sm text-gray-600">{product.sku}</span>
                                </td>
                                <td className="py-4 px-4">
                                  <span className="font-medium text-gray-900">${product.price}</span>
                                  {product.compare_price && (
                                    <span className="block text-sm text-green-600">
                                      Sale: ${product.compare_price}
                                    </span>
                                  )}
                                </td>
                                <td className="py-4 px-4">
                                  <span className={`font-medium ${
                                    product.stock_quantity < 10 ? 'text-red-600' : 'text-gray-900'
                                  }`}>
                                    {product.stock_quantity}
                                  </span>
                                </td>
                                <td className="py-4 px-4">
                                  <Badge variant="outline" className={statusColors[product.status]}>
                                    {product.status}
                                  </Badge>
                                </td>
                              </>
                            )}
                            <td className="py-4 px-4">
                              {translationMode ? (
                                <div className="flex items-center gap-2">
                                  <Button
                                    onClick={() => handleSaveTranslation(product)}
                                    disabled={!hasEdits}
                                    size="sm"
                                    className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                                  >
                                    <Save className="w-4 h-4 mr-1" />
                                    Save
                                  </Button>
                                  {hasEdits && (
                                    <Button
                                      onClick={() => {
                                        setEditingTranslation(prev => {
                                          const newState = { ...prev };
                                          delete newState[product.id];
                                          return newState;
                                        });
                                      }}
                                      variant="ghost"
                                      size="sm"
                                    >
                                      <X className="w-4 h-4" />
                                    </Button>
                                  )}
                                </div>
                              ) : (
                                <div className="flex items-center space-x-2">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="sm">
                                        <MoreVertical className="w-4 h-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent>
                                      <DropdownMenuItem
                                        onClick={() => {
                                          let storeInfo = selectedStore;
                                          if (!storeInfo?.slug && product.store_id) {
                                            storeInfo = availableStores?.find(s => s.id === product.store_id);
                                          }
                                          if (!storeInfo?.slug && availableStores?.length > 0) {
                                            storeInfo = availableStores[0];
                                          }
                                          const storeCode = storeInfo?.slug;
                                          const productSlug = product.seo?.url_key || product.slug || product.id;
                                          if (storeCode && productSlug) {
                                            const url = `/public/${storeCode}/product/${productSlug}`;
                                            window.open(url, '_blank');
                                          } else {
                                            console.error('Missing store slug or product slug:', {
                                              storeSlug: storeCode,
                                              productSlug
                                            });
                                          }
                                        }}
                                      >
                                        <Eye className="w-4 h-4 mr-2" />
                                        View
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => handleEditProduct(product)}
                                      >
                                        <Edit className="w-4 h-4 mr-2" />
                                        Edit
                                      </DropdownMenuItem>
                                      {product.status === 'active' ? (
                                        <DropdownMenuItem
                                          onClick={() => handleStatusChange(product, 'inactive')}
                                        >
                                          <EyeOff className="w-4 h-4 mr-2" />
                                          Deactivate
                                        </DropdownMenuItem>
                                      ) : (
                                        <DropdownMenuItem
                                          onClick={() => handleStatusChange(product, 'active')}
                                        >
                                          <Eye className="w-4 h-4 mr-2" />
                                          Activate
                                        </DropdownMenuItem>
                                      )}
                                      <DropdownMenuItem
                                        onClick={() => handleDeleteProduct(product.id)}
                                        className="text-red-600"
                                      >
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        Delete
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Enhanced Pagination */}
                {renderPagination(currentPage, calculatedTotalPages, handlePageChange)}
              </>
            ) : (
              <div className="text-center py-12">
                <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No products found</h3>
                <p className="text-gray-600 mb-6">
                  {searchQuery || Object.values(filters).some(f => f !== "all")
                    ? "Try adjusting your search terms or filters"
                    : "Start by adding your first product to your catalog"}
                </p>
                <Button
                  onClick={() => {
                    setSelectedProduct(null);
                    setShowProductForm(true);
                  }}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 material-ripple"
                  disabled={!selectedStore}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Product
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={showProductForm} onOpenChange={(open) => {
          setShowProductForm(open);
          // Clear selected product when dialog is closed
          if (!open) {
            setSelectedProduct(null);
          }
        }}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedProduct ? 'Edit Product' : 'Add New Product'}
              </DialogTitle>
            </DialogHeader>
            <ProductForm
              product={selectedProduct}
              categories={categories}
              stores={[]}
              taxes={taxes}
              attributes={attributes.filter(attr => attr.type !== 'image')}
              attributeSets={attributeSets}
              onSubmit={selectedProduct ? handleUpdateProduct : handleCreateProduct}
              onCancel={() => {
                setShowProductForm(false);
                setSelectedProduct(null);
              }}
            />
          </DialogContent>
        </Dialog>

        <BulkTranslateDialog
          open={showBulkTranslateDialog}
          onOpenChange={setShowBulkTranslateDialog}
          entityType="products"
          entityName="Products"
          onTranslate={handleBulkTranslate}
          itemCount={totalItems}
          userCredits={userCredits}
          onCreditsUpdate={loadUserCredits}
          onComplete={loadData}
        />

        {/* Confirmation Modal */}
        <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{confirmModalTitle}</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="text-gray-600">{confirmModalMessage}</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowConfirmModal(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => confirmModalAction && confirmModalAction()}
              >
                Delete
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
