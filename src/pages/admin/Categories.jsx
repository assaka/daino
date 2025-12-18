
import React, { useState, useEffect } from "react";
import { Category } from "@/api/entities";
import { User } from "@/api/entities";
import { useStoreSelection } from "@/contexts/StoreSelectionContext.jsx";
import { useTranslation } from "@/contexts/TranslationContext.jsx";
import NoStoreSelected from "@/components/admin/NoStoreSelected";
import { clearCategoriesCache } from "@/utils/cacheUtils";
import { toast } from "sonner";
import {
  Tag,
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
  X,
  Folder,
  FolderOpen,
  LayoutGrid,
  Settings,
  TreePine,
  Filter,
  Languages
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
  DialogTitle 
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { PageLoader } from "@/components/ui/page-loader";

import CategoryForm from "@/components/admin/categories/CategoryForm";
import { TranslationIndicator } from "@/components/admin/TranslationFields";
import { getCategoryName, getCategoryDescription } from "@/utils/translationUtils";

export default function Categories() {
  const { selectedStore, getSelectedStoreId, availableStores } = useStoreSelection();
  const { availableLanguages } = useTranslation();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [nameFilter, setNameFilter] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(9); // 3x3 grid
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [viewMode, setViewMode] = useState('hierarchical'); // 'hierarchical' or 'grid'
  const [expandedCategories, setExpandedCategories] = useState(new Set());
  const [selectedRootCategory, setSelectedRootCategory] = useState('');
  const [excludeRootFromMenu, setExcludeRootFromMenu] = useState(false);
  const [rootCategories, setRootCategories] = useState([]);
  const [storeSettings, setStoreSettings] = useState({});
  const [showBulkTranslateDialog, setShowBulkTranslateDialog] = useState(false);
  const [translateFromLang, setTranslateFromLang] = useState('en');
  const [translateToLangs, setTranslateToLangs] = useState([]);
  const [isTranslating, setIsTranslating] = useState(false);
  const [userCredits, setUserCredits] = useState(null);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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

  useEffect(() => {
    if (selectedStore) {
      loadCategories();
      loadStoreSettings();
    }
  }, [selectedStore]);

  // Listen for store changes
  useEffect(() => {
    const handleStoreChange = () => {
      if (selectedStore) {
        loadCategories();
      }
    };

    window.addEventListener('storeSelectionChanged', handleStoreChange);
    return () => window.removeEventListener('storeSelectionChanged', handleStoreChange);
  }, [selectedStore]);

  const loadStoreSettings = async () => {
    const storeId = getSelectedStoreId();
    if (!storeId) return;

    try {
      // Get the proper authentication token (same logic as apiClient)
      const token = localStorage.getItem('store_owner_auth_token') ||
                   localStorage.getItem('customer_auth_token') ||
                   localStorage.getItem('auth_token') ||
                   localStorage.getItem('token') ||
                   localStorage.getItem('authToken') ||
                   sessionStorage.getItem('token') ||
                   sessionStorage.getItem('authToken');

      const response = await fetch(`/api/stores/${storeId}/settings`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        const settings = data.settings || {};

        // Ensure boolean values are properly set
        const updatedSettings = {
          ...settings,
          excludeRootFromMenu: settings.excludeRootFromMenu === true,
          expandAllMenuItems: settings.expandAllMenuItems === true
        };
        
        setStoreSettings(updatedSettings);
        setSelectedRootCategory(settings.rootCategoryId || '');
        setExcludeRootFromMenu(settings.excludeRootFromMenu === true);
      } else if (response.status === 401) {
        console.error('Authentication error loading settings - token may be expired');
      }
    } catch (error) {
      console.error('Error loading store settings:', error);
    }
  };

  const saveStoreSettings = async (newSettings) => {
    const storeId = getSelectedStoreId();
    if (!storeId) return;

    try {
      // Get the proper authentication token (same logic as apiClient)
      const token = localStorage.getItem('store_owner_auth_token') ||
                   localStorage.getItem('customer_auth_token') ||
                   localStorage.getItem('auth_token') ||
                   localStorage.getItem('token') ||
                   localStorage.getItem('authToken') ||
                   sessionStorage.getItem('token') ||
                   sessionStorage.getItem('authToken');
      
      if (!token) {
        console.error('No authentication token found');
        toast.error('Authentication required. Please log in again.');
        return;
      }

      const response = await fetch(`/api/stores/${storeId}/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ settings: { ...storeSettings, ...newSettings } })
      });
      
      if (response.ok) {
        setStoreSettings(prev => ({ ...prev, ...newSettings }));
        // Clear cache to update navigation menus
        clearCategoriesCache(storeId);
        toast.success('Settings updated successfully');
      } else {
        const errorText = await response.text();
        console.error('Failed to save settings:', response.status, errorText);
        if (response.status === 401) {
          toast.error('Authentication expired. Please log in again.');
        } else {
          toast.error('Failed to update settings');
        }
      }
    } catch (error) {
      console.error('Error saving store settings:', error);
      toast.error('Failed to update settings');
    }
  };

  const loadAllCategories = async () => {
    const storeId = getSelectedStoreId();
    if (!storeId) return [];

    try {
      // Load ALL categories without pagination
      let allCategories = [];
      try {
        // First try with large limit
        const result = await Category.findAll({ 
          store_id: storeId,
          limit: 10000,
          order_by: "sort_order"
        });
        allCategories = Array.isArray(result) ? result : [];
      } catch (error) {
        console.warn('Failed to load all categories with limit, trying paginated approach:', error);
        
        // Fallback: Load all categories using pagination
        let currentPage = 1;
        let hasMore = true;
        const batchSize = 100;
        
        while (hasMore) {
          try {
            const batch = await Category.findPaginated(currentPage, batchSize, { 
              store_id: storeId,
              order_by: "sort_order"
            });
            
            if (batch && batch.data && batch.data.length > 0) {
              allCategories = allCategories.concat(batch.data);
              hasMore = currentPage < (batch.pagination?.total_pages || 1);
              currentPage++;
            } else {
              hasMore = false;
            }
          } catch (batchError) {
            console.error(`Error loading batch ${currentPage}:`, batchError);
            hasMore = false;
          }
        }
      }
      return allCategories;
    } catch (error) {
      console.error("Error loading all categories:", error);
      return [];
    }
  };

  const loadCategories = async (page = currentPage) => {
    const storeId = getSelectedStoreId();
    if (!storeId) {
      console.warn("No store selected");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // Always load all categories first to extract root categories and apply filtering
      const allCategories = await loadAllCategories();
      
      // Extract root categories for the selector (categories with no parent)
      const roots = allCategories.filter(cat => !cat.parent_id || cat.parent_id === null);
      setRootCategories(roots);
      
      // Apply root category filter if selected
      let filteredCategories = allCategories;
      if (selectedRootCategory) {
        const findDescendants = (parentId, categories) => {
          const descendants = [];
          const children = categories.filter(cat => cat.parent_id === parentId);
          
          children.forEach(child => {
            descendants.push(child);
            descendants.push(...findDescendants(child.id, categories));
          });
          
          return descendants;
        };
        
        const rootCategory = allCategories.find(cat => cat.id === selectedRootCategory);
        if (rootCategory) {
          const descendants = findDescendants(selectedRootCategory, allCategories);
          filteredCategories = [rootCategory, ...descendants];
        } else {
          filteredCategories = [];
        }
      }
      
      // Apply status filter if present
      if (searchQuery && searchQuery !== '') {
        switch (searchQuery) {
          case 'active':
            filteredCategories = filteredCategories.filter(cat => cat.is_active);
            break;
          case 'inactive':
            filteredCategories = filteredCategories.filter(cat => !cat.is_active);
            break;
          case 'hidden':
            filteredCategories = filteredCategories.filter(cat => cat.hide_in_menu);
            break;
          case 'visible':
            filteredCategories = filteredCategories.filter(cat => !cat.hide_in_menu);
            break;
          default:
            // No additional filtering for empty string or unknown values
            break;
        }
      }
      
      // Apply name filter if present
      if (nameFilter.trim()) {
        const searchTerm = nameFilter.trim().toLowerCase();
        filteredCategories = filteredCategories.filter(cat => {
          const name = getCategoryName(cat).toLowerCase();
          const description = getCategoryDescription(cat).toLowerCase();
          return name.includes(searchTerm) || description.includes(searchTerm);
        });
      }

      if (viewMode === 'hierarchical') {
        // For hierarchical view, show all filtered categories
        setCategories(filteredCategories);
        setTotalItems(filteredCategories.length);
        setTotalPages(1);
        setCurrentPage(1);
      } else {
        // For grid view, apply pagination to filtered results
        const startIndex = (page - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const paginatedCategories = filteredCategories.slice(startIndex, endIndex);
        
        setCategories(paginatedCategories);
        setTotalItems(filteredCategories.length);
        setTotalPages(Math.ceil(filteredCategories.length / itemsPerPage));
        setCurrentPage(page);
      }
    } catch (error) {
      console.error("Error loading categories:", error);
      setCategories([]);
      setTotalItems(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCategory = async (categoryData) => {
    const storeId = getSelectedStoreId();
    if (!storeId) {
      throw new Error("No store selected");
    }

    try {
      await Category.create({ ...categoryData, store_id: storeId });
      await loadCategories();
      setShowCategoryForm(false);
      // Clear storefront cache for instant updates
      clearCategoriesCache(storeId);
    } catch (error) {
      console.error("Error creating category:", error);
    }
  };

  const handleUpdateCategory = async (categoryData) => {
    const storeId = getSelectedStoreId();
    try {
      // Include store_id in the category data for the update request
      await Category.update(selectedCategory.id, { ...categoryData, store_id: storeId });
      await loadCategories(); // Updated function name
      setShowCategoryForm(false);
      setSelectedCategory(null);
      // Clear storefront cache for instant updates
      clearCategoriesCache(storeId);
    } catch (error) {
      console.error("Error updating category:", error);
    }
  };

  const handleDeleteCategory = async (categoryId) => {
    if (window.confirm("Are you sure you want to delete this category?")) {
      try {
        await Category.delete(categoryId);
        await loadCategories(); // Updated function name
        // Clear storefront cache for instant updates
        const storeId = getSelectedStoreId();
        if (storeId) clearCategoriesCache(storeId);
      } catch (error) {
        console.error("Error deleting category:", error);
      }
    }
  };

  const handleToggleStatus = async (category) => {
    const storeId = getSelectedStoreId();
    try {
      await Category.update(category.id, {
        ...category,
        is_active: !category.is_active,
        store_id: storeId
      });
      await loadCategories(); // Updated function name
      // Clear storefront cache for instant updates
      if (storeId) clearCategoriesCache(storeId);
    } catch (error) {
      console.error("Error updating category status:", error);
    }
  };

  const handleToggleMenuVisibility = async (category) => {
    const storeId = getSelectedStoreId();
    try {
      await Category.update(category.id, {
        ...category,
        hide_in_menu: !category.hide_in_menu,
        store_id: storeId
      });
      await loadCategories(); // Updated function name
      // Clear storefront cache for instant updates
      if (storeId) clearCategoriesCache(storeId);
    } catch (error) {
      console.error("Error updating category visibility:", error);
    }
  };

  const handleDeleteAllCategories = async () => {
    const storeId = getSelectedStoreId();
    if (!storeId) {
      toast.error("No store selected");
      return;
    }

    setIsDeleting(true);
    try {
      const token = localStorage.getItem('store_owner_auth_token') ||
                   localStorage.getItem('customer_auth_token') ||
                   localStorage.getItem('auth_token') ||
                   localStorage.getItem('token') ||
                   localStorage.getItem('authToken') ||
                   sessionStorage.getItem('token') ||
                   sessionStorage.getItem('authToken');

      const response = await fetch(`/api/categories/all?store_id=${storeId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-store-id': storeId
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to delete categories');
      }

      toast.success(`${data.data?.deleted || 0} categories deleted successfully`);
      setShowDeleteAllConfirm(false);
      await loadCategories();
      // Clear storefront cache
      clearCategoriesCache(storeId);
    } catch (error) {
      console.error('Delete all categories error:', error);
      toast.error(error.message || 'Failed to delete categories');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkTranslate = async () => {
    if (!translateFromLang || translateToLangs.length === 0) {
      toast.error("Please select source language and at least one target language");
      return;
    }

    if (translateToLangs.includes(translateFromLang)) {
      toast.error("Target languages cannot include the source language");
      return;
    }

    const storeId = getSelectedStoreId();
    if (!storeId) {
      toast.error("No store selected");
      return;
    }

    setIsTranslating(true);
    try {
      const token = localStorage.getItem('store_owner_auth_token') ||
                   localStorage.getItem('customer_auth_token') ||
                   localStorage.getItem('auth_token') ||
                   localStorage.getItem('token') ||
                   localStorage.getItem('authToken') ||
                   sessionStorage.getItem('token') ||
                   sessionStorage.getItem('authToken');

      // Translate to each selected language
      let totalTranslated = 0;
      let totalSkipped = 0;
      let totalFailed = 0;
      const allErrors = [];

      for (const toLang of translateToLangs) {
        const response = await fetch('/api/categories/bulk-translate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            store_id: storeId,
            fromLang: translateFromLang,
            toLang: toLang
          })
        });

        const data = await response.json();

        if (response.ok && data.success) {
          totalTranslated += data.data.translated;
          totalSkipped += data.data.skipped;
          totalFailed += data.data.failed;
          if (data.data.errors && data.data.errors.length > 0) {
            allErrors.push(...data.data.errors.map(err => ({ ...err, toLang })));
          }
        } else {
          toast.error(`Failed to translate to ${toLang}: ${data.message}`);
        }
      }

      if (totalTranslated > 0) {
        toast.success(`Successfully translated ${totalTranslated} categories to ${translateToLangs.length} language(s)`);
      }
      if (totalFailed > 0) {
        console.warn('Translation errors:', allErrors);
        toast.warning(`${totalFailed} translations failed. Check console for details.`);
      }

      setShowBulkTranslateDialog(false);
      setTranslateToLangs([]);
      await loadCategories();
    } catch (error) {
      console.error('Bulk translate error:', error);
      toast.error('Failed to translate categories');
    } finally {
      setIsTranslating(false);
    }
  };

  // Apply client-side filtering for name filter (no page reload)
  const getDisplayCategories = () => {
    let displayCategories = categories;

    // Apply name filter client-side (instant filtering, no reload)
    if (nameFilter.trim()) {
      const searchTerm = nameFilter.trim().toLowerCase();
      displayCategories = displayCategories.filter(cat => {
        const name = getCategoryName(cat).toLowerCase();
        const description = getCategoryDescription(cat).toLowerCase();
        const slug = cat.slug?.toLowerCase() || '';
        return name.includes(searchTerm) || description.includes(searchTerm) || slug.includes(searchTerm);
      });
    }

    return displayCategories;
  };

  // Apply client-side name filtering
  const displayCategories = getDisplayCategories();
  const paginatedCategories = displayCategories;
  const startIndex = (currentPage - 1) * itemsPerPage;

  // Reset to first page and reload data when filter changes
  useEffect(() => {
    if (selectedStore) {
      loadCategories(1); // Always load first page when filter changes
    }
  }, [searchQuery]);


  // Reload when view mode changes
  useEffect(() => {
    if (selectedStore) {
      loadCategories();
    }
  }, [viewMode]);

  // Reload when root category selection changes
  useEffect(() => {
    if (selectedStore) {
      loadCategories(1); // Reset to first page when filter changes
    }
  }, [selectedRootCategory]);

  // Reset page to 1 when name filter changes
  useEffect(() => {
    if (nameFilter.trim()) {
      setCurrentPage(1);
    }
  }, [nameFilter]);

  // Build hierarchical tree from flat category list
  const buildCategoryTree = (categoriesToBuild) => {
    const categoryMap = new Map();
    const rootCategories = [];

    // First, create a map of all categories
    categoriesToBuild.forEach(category => {
      categoryMap.set(category.id, { ...category, children: [] });
    });

    // Then, build the tree structure
    categoriesToBuild.forEach(category => {
      const categoryNode = categoryMap.get(category.id);
      if (category.parent_id && categoryMap.has(category.parent_id)) {
        // This category has a parent, add it to parent's children
        const parent = categoryMap.get(category.parent_id);
        parent.children.push(categoryNode);
      } else {
        // This is a root category
        rootCategories.push(categoryNode);
      }
    });

    return rootCategories;
  };

  const toggleCategoryExpansion = (categoryId) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  // Render hierarchical category tree
  const renderCategoryTree = (categoryNodes, depth = 0) => {
    return categoryNodes.map(category => (
      <div key={category.id} className="w-full">
        <Card className="border border-gray-200 hover:border-gray-300 transition-all duration-200 mb-1">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2" style={{ paddingLeft: `${depth * 16}px` }}>
                {category.children && category.children.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleCategoryExpansion(category.id)}
                    className="p-0 h-5 w-5 hover:bg-gray-100"
                  >
                    <ChevronRight className={`w-3 h-3 transition-transform ${
                      expandedCategories.has(category.id) ? 'rotate-90' : 'rotate-0'
                    }`} />
                  </Button>
                )}
                {(!category.children || category.children.length === 0) && (
                  <div className="w-5 h-5 flex items-center justify-center">
                    {depth > 0 && <div className="w-1.5 h-1.5 bg-gray-300 rounded-full" />}
                  </div>
                )}
                <div className="w-7 h-7 bg-gradient-to-r from-blue-500 to-purple-600 rounded-md flex items-center justify-center">
                  {category.hide_in_menu ? (
                    <Folder className="w-4 h-4 text-white" />
                  ) : (
                    <FolderOpen className="w-4 h-4 text-white" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <h3
                      className={`text-sm font-medium text-gray-900 truncate ${category.children && category.children.length > 0 ? 'cursor-pointer hover:text-blue-600' : ''}`}
                      onClick={() => {
                        if (category.children && category.children.length > 0) {
                          toggleCategoryExpansion(category.id);
                        }
                      }}
                    >
                      {getCategoryName(category)}
                    </h3>
                    <span className="text-xs text-gray-500 font-mono">/{category.slug}</span>
                  </div>
                  {getCategoryDescription(category) && (
                    <p className="text-xs text-gray-600 truncate mt-0.5">
                      {getCategoryDescription(category)}
                    </p>
                  )}
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                {/* Compact badges */}
                <div className="flex items-center space-x-1">
                  <Badge
                    variant={category.is_active ? "default" : "secondary"}
                    className="text-xs px-1.5 py-0.5 h-5"
                  >
                    {category.is_active ? "Active" : "Inactive"}
                  </Badge>
                  {category.hide_in_menu && (
                    <Badge variant="outline" className="text-xs px-1.5 py-0.5 h-5">Hidden</Badge>
                  )}
                  {category.children && category.children.length > 0 && (
                    <Badge variant="outline" className="text-xs px-1.5 py-0.5 h-5">
                      {category.children.length}
                    </Badge>
                  )}
                  <TranslationIndicator
                    translations={category.translations || {}}
                    requiredLanguages={['en', 'nl']}
                  />
                </div>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                      <ChevronDown className="w-3 h-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => {
                        // Get store info - try selectedStore first, then find from availableStores
                        let storeInfo = selectedStore;
                        
                        // If selectedStore doesn't have slug, try to find the full store data
                        if (!storeInfo?.slug && category.store_id) {
                          storeInfo = availableStores?.find(s => s.id === category.store_id);
                        }
                        
                        // If still no store info, try using the first available store
                        if (!storeInfo?.slug && availableStores?.length > 0) {
                          storeInfo = availableStores[0];
                        }
                        
                        const storeCode = storeInfo?.slug;
                        const categorySlug = category.seo?.url_key || category.slug || category.id;
                        
                        if (storeCode && categorySlug) {
                          // Open in new tab to view the storefront category page
                          const url = `/public/${storeCode}/category/${categorySlug}`;
                          window.open(url, '_blank');
                        } else {
                          console.error('Missing store slug or category slug:', { 
                            storeSlug: storeCode, 
                            categorySlug
                          });
                        }
                      }}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      View
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setSelectedCategory(category);
                        setShowCategoryForm(true);
                      }}
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    {category.is_active ? (
                      <DropdownMenuItem
                        onClick={() => handleToggleStatus(category)}
                      >
                        <EyeOff className="w-4 h-4 mr-2" />
                        Deactivate
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        onClick={() => handleToggleStatus(category)}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Activate
                      </DropdownMenuItem>
                    )}
                    {category.hide_in_menu ? (
                      <DropdownMenuItem
                        onClick={() => handleToggleMenuVisibility(category)}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Show in Menu
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        onClick={() => handleToggleMenuVisibility(category)}
                      >
                        <EyeOff className="w-4 h-4 mr-2" />
                        Hide from Menu
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={() => handleDeleteCategory(category.id)}
                      className="text-red-600"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Render children if expanded */}
        {category.children && 
         category.children.length > 0 && 
         expandedCategories.has(category.id) && (
          <div className="ml-3">
            {renderCategoryTree(category.children, depth + 1)}
          </div>
        )}
      </div>
    ));
  };

  // Handle page changes
  const handlePageChange = (page) => {
    setCurrentPage(page);
    loadCategories(page);
  };

  // Enhanced pagination component
  const renderPagination = (currentPage, totalPages, onPageChange) => {
    if (totalPages <= 1) return null;

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

    return (
      <div className="flex items-center justify-center space-x-2 mt-8">
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
          of {totalPages} pages
        </span>
      </div>
    );
  };

  if (loading) {
    return <PageLoader size="lg" />;
  }

  // Determine if adding a category is possible (i.e., a store is assigned to the user)
  const canAddCategory = !!selectedStore;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Categories</h1>
            <p className="text-gray-600 mt-1">Organize your product categories</p>
            {selectedStore && (
              <p className="text-sm text-gray-500 mt-1">
                Currently managing categories for store: <span className="font-semibold">{selectedStore.name}</span>
              </p>
            )}
            {!selectedStore && !loading && (
              <p className="text-sm text-red-500 mt-1">
                No store found for your account. Please set up a store to add categories.
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => setShowDeleteAllConfirm(true)}
              variant="outline"
              className="border-red-600 text-red-600 hover:bg-red-50"
              disabled={!selectedStore || totalItems === 0}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete All ({totalItems})
            </Button>
            <Button
              onClick={() => setShowBulkTranslateDialog(true)}
              variant="outline"
              className="border-blue-600 text-blue-600 hover:bg-blue-50"
              disabled={!selectedStore || categories.length === 0}
            >
              <Languages className="w-4 h-4 mr-2" />
              Bulk AI Translate
            </Button>
            <Button
              onClick={() => {
                setSelectedCategory(null);
                setShowCategoryForm(true);
              }}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 material-ripple material-elevation-1"
              disabled={!selectedStore}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Category
            </Button>
          </div>
        </div>

        {/* Root Category Selector and Settings */}
        <Card className="material-elevation-1 border-0 mb-6">
          <CardContent className="p-6">
            <div className="space-y-4">
              {/* Store-wide Category Settings */}
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Category Navigation Settings
                </h3>
                
                {/* Root Category Selection */}
                <div className="mb-4">
                  <Label htmlFor="store-root-category" className="text-sm font-medium mb-2 block">
                    Root Category
                  </Label>
                  <Select
                    value={storeSettings.rootCategoryId || "none"}
                    onValueChange={(value) => {
                      const newValue = value === "none" ? null : value;
                      saveStoreSettings({ ...storeSettings, rootCategoryId: newValue });
                    }}
                  >
                    <SelectTrigger id="store-root-category" className="w-full">
                      <SelectValue placeholder="Select root category (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Root Category</SelectItem>
                      {rootCategories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {getCategoryName(category)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500 mt-1">
                    Set a default root category for your store's navigation
                  </p>
                </div>

                {/* Navigation Settings - Only show if root category is selected */}
                {storeSettings.rootCategoryId && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <Label htmlFor="exclude_root_from_menu" className="font-medium">
                          Exclude Root Category from Navigation
                        </Label>
                        <p className="text-sm text-gray-500">
                          Hide the root category itself from navigation menus, showing only its children
                        </p>
                      </div>
                      <Switch
                        id="exclude_root_from_menu"
                        checked={storeSettings.excludeRootFromMenu || false}
                        onCheckedChange={(checked) => {
                          saveStoreSettings({ ...storeSettings, excludeRootFromMenu: checked });
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Manage Root Categories */}
                <div className="mt-6 pt-6 border-t">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-md font-semibold">Manage Root Categories</h4>
                    <Button
                      onClick={() => {
                        setSelectedCategory(null);
                        setShowCategoryForm(true);
                      }}
                      className="flex items-center gap-2"
                      size="sm"
                    >
                      <Plus className="w-4 h-4" />
                      Create Root Category
                    </Button>
                  </div>

                  {/* Root Categories List */}
                  {rootCategories.length > 0 ? (
                    <div className="space-y-2">
                      {rootCategories.map((category) => (
                        <div
                          key={category.id}
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex-1">
                            <div className="font-medium">{getCategoryName(category)}</div>
                            <div className="text-sm text-gray-500">
                              {category.slug || 'No slug'}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              onClick={() => {
                                setSelectedCategory(category);
                                setShowCategoryForm(true);
                              }}
                              variant="outline"
                              size="sm"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              onClick={async () => {
                                if (window.confirm(`Are you sure you want to delete "${getCategoryName(category)}"? This will also delete all its subcategories.`)) {
                                  try {
                                    await Category.delete(category.id);
                                    toast.success('Category deleted successfully');
                                    await loadCategories();
                                  } catch (error) {
                                    console.error('Error deleting category:', error);
                                    toast.error('Failed to delete category');
                                  }
                                }
                              }}
                              variant="outline"
                              size="sm"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <p>No root categories found</p>
                      <p className="text-sm">Click "Create Root Category" to add one</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="material-elevation-1 border-0 mb-6">
          <CardContent className="p-6">
            <div className="space-y-4">
              {/* Store-wide Category Settings */}
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Filter className="w-5 h-5" />
                  Category Filters
                </h3>

                {/* Root Category Selection */}
                <div className="mb-4">
                  {/* All Filters and View Toggle in One Line */}
                  <div className="flex flex-wrap items-center gap-3 pt-4 border-t">
                    {/* Root Category Filter */}
                    <Select
                      value={selectedRootCategory || "all"}
                      onValueChange={(value) => {
                        const newValue = value === "all" ? "" : value;
                        setSelectedRootCategory(newValue);
                      }}
                    >
                      <SelectTrigger className="w-[180px]">
                        <TreePine className="w-4 h-4 mr-2" />
                        <SelectValue placeholder="Root Category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {rootCategories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {getCategoryName(category)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Status Filter */}
                    <Select
                      value={searchQuery || "all"}
                      onValueChange={(value) => setSearchQuery(value === "all" ? "" : value)}
                    >
                      <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="Filter Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="active">Active Only</SelectItem>
                        <SelectItem value="inactive">Inactive Only</SelectItem>
                        <SelectItem value="hidden">Hidden from Menu</SelectItem>
                        <SelectItem value="visible">Visible in Menu</SelectItem>
                      </SelectContent>
                    </Select>

                    {/* Name Filter */}
                    <div className="relative flex-1 min-w-[200px] max-w-[300px]">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        placeholder="Filter by name..."
                        value={nameFilter}
                        onChange={(e) => setNameFilter(e.target.value)}
                        className="pl-10 h-9"
                        disabled={!canAddCategory && categories.length === 0}
                      />
                    </div>

                    {/* Spacer */}
                    <div className="flex-1"></div>

                    {/* View Mode Toggle */}
                    <div className="flex items-center rounded-lg border">
                      <Button
                        variant={viewMode === 'hierarchical' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setViewMode('hierarchical')}
                        className="rounded-r-none border-0"
                      >
                        <Folder className="w-4 h-4 mr-1" />
                        Tree
                      </Button>
                      <Button
                        variant={viewMode === 'grid' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setViewMode('grid')}
                        className="rounded-l-none border-0 border-l"
                      >
                        <LayoutGrid className="w-4 h-4 mr-1" />
                        Grid
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Categories Display */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-700">
              {(() => {
                const filteredTotal = displayCategories.length;
                if (filteredTotal > 0) {
                  if (viewMode === 'hierarchical') {
                    return `${filteredTotal} categories${nameFilter ? ` (filtered)` : ''}`;
                  } else {
                    const startIndex = (currentPage - 1) * itemsPerPage;
                    const endIndex = Math.min(startIndex + itemsPerPage, filteredTotal);
                    return `Showing ${startIndex + 1} to ${endIndex} of ${filteredTotal} categories${nameFilter ? ` (filtered)` : ''}`;
                  }
                }
                return '';
              })()}
            </p>
          </div>
          
          {viewMode === 'hierarchical' ? (
            /* Hierarchical Tree View */
            <div className="space-y-0.5 min-h-[400px]">
              {(() => {
                const categoryTree = buildCategoryTree(displayCategories);
                return categoryTree.length > 0 ? (
                  renderCategoryTree(categoryTree)
                ) : (
                  <div className="text-center py-12">
                    <Tag className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No categories found</h3>
                    <p className="text-gray-600 mb-6">
                      {searchQuery || nameFilter
                        ? "Try adjusting your filter selection or search terms"
                        : selectedRootCategory 
                        ? "No categories found under the selected root category"
                        : "Start by creating your first product category"}
                    </p>
                  </div>
                );
              })()
            }
            </div>
          ) : (
            /* Grid View */
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 min-h-[400px]">
                {(() => {
                  // Apply pagination to filtered categories for grid view
                  const startIndex = (currentPage - 1) * itemsPerPage;
                  const endIndex = startIndex + itemsPerPage;
                  const paginatedItems = displayCategories.slice(startIndex, endIndex);
                  
                  return paginatedItems.map((category) => (
                <Card key={category.id} className="material-elevation-1 border-0 hover:material-elevation-2 transition-all duration-300">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                          {category.hide_in_menu ? (
                            <Folder className="w-6 h-6 text-white" />
                          ) : (
                            <FolderOpen className="w-6 h-6 text-white" />
                          )}
                        </div>
                        <div>
                          <CardTitle className="text-lg">{getCategoryName(category)}</CardTitle>
                          <p className="text-sm text-gray-500">/{category.slug}</p>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <ChevronDown className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem
                            onClick={() => {
                              // Get store info - try selectedStore first, then find from availableStores
                              let storeInfo = selectedStore;
                              
                              // If selectedStore doesn't have slug, try to find the full store data
                              if (!storeInfo?.slug && category.store_id) {
                                storeInfo = availableStores?.find(s => s.id === category.store_id);
                              }
                              
                              // If still no store info, try using the first available store
                              if (!storeInfo?.slug && availableStores?.length > 0) {
                                storeInfo = availableStores[0];
                              }
                              
                              const storeCode = storeInfo?.slug;
                              const categorySlug = category.seo?.url_key || category.slug || category.id;
                              
                              if (storeCode && categorySlug) {
                                // Open in new tab to view the storefront category page
                                const url = `/public/${storeCode}/category/${categorySlug}`;
                                window.open(url, '_blank');
                              } else {
                                console.error('Missing store slug or category slug:', { 
                                  storeSlug: storeCode, 
                                  categorySlug
                                });
                              }
                            }}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            View
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedCategory(category);
                              setShowCategoryForm(true);
                            }}
                          >
                            <Edit className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedCategory(category);
                              setShowCategoryForm(true);
                            }}
                          >
                            <Languages className="w-4 h-4 mr-2" />
                            Manage Translations
                          </DropdownMenuItem>
                          {category.is_active ? (
                            <DropdownMenuItem
                              onClick={() => handleToggleStatus(category)}
                            >
                              <EyeOff className="w-4 h-4 mr-2" />
                              Deactivate
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => handleToggleStatus(category)}
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              Activate
                            </DropdownMenuItem>
                          )}
                          {category.hide_in_menu ? (
                            <DropdownMenuItem
                              onClick={() => handleToggleMenuVisibility(category)}
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              Show in Menu
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => handleToggleMenuVisibility(category)}
                            >
                              <EyeOff className="w-4 h-4 mr-2" />
                              Hide from Menu
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => handleDeleteCategory(category.id)}
                            className="text-red-600"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600 text-sm mb-4">
                      {getCategoryDescription(category) || "No description"}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={category.is_active ? "default" : "secondary"}>
                        {category.is_active ? "Active" : "Inactive"}
                      </Badge>
                      {category.hide_in_menu && (
                        <Badge variant="outline">Hidden from Menu</Badge>
                      )}
                      <Badge variant="outline">
                        Order: {category.sort_order || 0}
                      </Badge>
                      <TranslationIndicator
                        translations={category.translations || {}}
                        requiredLanguages={['en', 'nl']}
                      />
                    </div>
                  </CardContent>
                </Card>
                  ));
                })()}
              </div>

              {/* Enhanced Pagination - only show in grid view */}
              {viewMode === 'grid' && (() => {
                const filteredTotal = displayCategories.length;
                const filteredPages = Math.ceil(filteredTotal / itemsPerPage);
                return renderPagination(currentPage, filteredPages, handlePageChange);
              })()}
            </>
          )}
        </div>

        {categories.length === 0 && !loading && (
          <Card className="material-elevation-1 border-0">
            <CardContent className="text-center py-12">
              <Tag className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No categories found</h3>
              <p className="text-gray-600 mb-6">
                {searchQuery || nameFilter
                  ? "Try adjusting your filter selection or search terms"
                  : "Start by creating your first product category"}
              </p>
              <Button
                onClick={() => {
                  setSelectedCategory(null);
                  setShowCategoryForm(true);
                }}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 material-ripple"
                disabled={!selectedStore}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Category
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Category Form Dialog */}
        <Dialog open={showCategoryForm} onOpenChange={setShowCategoryForm}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle>
                {selectedCategory ? 'Edit Category' : 'Add New Category'}
              </DialogTitle>
            </DialogHeader>
            <div className="overflow-y-auto flex-1 px-1">
              <CategoryForm
                category={selectedCategory}
                parentCategories={categories}
                onSubmit={selectedCategory ? handleUpdateCategory : handleCreateCategory}
                onCancel={() => {
                  setShowCategoryForm(false);
                  setSelectedCategory(null);
                }}
              />
            </div>
          </DialogContent>
        </Dialog>

        {/* Bulk Translate Dialog */}
        <Dialog open={showBulkTranslateDialog} onOpenChange={setShowBulkTranslateDialog}>
          <DialogContent className="max-w-md max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>Bulk AI Translate Categories</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4 overflow-y-auto">
              <div className="space-y-2">
                <Label htmlFor="from-lang">From Language</Label>
                <Select value={translateFromLang} onValueChange={setTranslateFromLang}>
                  <SelectTrigger id="from-lang">
                    <SelectValue placeholder="Select source language" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableLanguages.map((lang) => (
                      <SelectItem key={lang.code} value={lang.code}>
                        {lang.name} ({lang.native_name})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>To Languages (Select one or more)</Label>
                <div className="border rounded-lg p-3 space-y-2 max-h-60 overflow-y-auto">
                  {availableLanguages
                    .filter((lang) => lang.code !== translateFromLang)
                    .map((lang) => (
                      <div key={lang.code} className="flex items-center space-x-2">
                        <Checkbox
                          id={`lang-${lang.code}`}
                          checked={translateToLangs.includes(lang.code)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setTranslateToLangs([...translateToLangs, lang.code]);
                            } else {
                              setTranslateToLangs(translateToLangs.filter(code => code !== lang.code));
                            }
                          }}
                        />
                        <Label
                          htmlFor={`lang-${lang.code}`}
                          className="text-sm font-normal cursor-pointer"
                        >
                          {lang.name} ({lang.native_name})
                        </Label>
                      </div>
                    ))}
                </div>
                {translateToLangs.length > 0 && (
                  <p className="text-xs text-gray-600 mt-1">
                    {translateToLangs.length} language(s) selected
                  </p>
                )}
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  {translateToLangs.length > 0 ? (
                    <>
                      This will translate all categories from {translateFromLang} to {translateToLangs.length} selected language(s).
                      <span className="block mt-2 text-xs font-medium">
                        ⚠️ Credits are charged for all items processed.
                      </span>
                    </>
                  ) : (
                    'Please select at least one target language.'
                  )}
                </p>
              </div>

              {/* Credit Cost Estimate */}
              {translateToLangs.length > 0 && totalItems > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-green-800 font-medium">
                      💰 Estimated Cost:
                    </span>
                    <span className="text-green-900 font-bold">
                      {(totalItems * translateToLangs.length * 0.10).toFixed(2)} credits
                    </span>
                  </div>
                  <p className="text-xs text-green-700">
                    {totalItems} {totalItems === 1 ? 'category' : 'categories'} × {translateToLangs.length} lang(s) × 0.10 credits per item
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Standard rate: 0.10 credits per item
                  </p>
                </div>
              )}

              {/* Credit Balance Warning */}
              {translateToLangs.length > 0 && totalItems > 0 && userCredits !== null && userCredits !== undefined && (
                <div className={`p-3 rounded-lg border ${
                  userCredits < (totalItems * translateToLangs.length * 0.10)
                    ? 'bg-red-50 border-red-200'
                    : 'bg-green-50 border-green-200'
                }`}>
                  <div className="flex items-center justify-between text-sm">
                    <span className={userCredits < (totalItems * translateToLangs.length * 0.10) ? 'text-red-800' : 'text-green-800'}>
                      Your balance: {Number(userCredits).toFixed(2)} credits
                    </span>
                    {userCredits < (totalItems * translateToLangs.length * 0.10) && (
                      <span className="text-red-600 font-medium text-xs">
                        ⚠️ Insufficient credits
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowBulkTranslateDialog(false);
                    setTranslateToLangs([]);
                  }}
                  disabled={isTranslating}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleBulkTranslate}
                  disabled={isTranslating || !translateFromLang || translateToLangs.length === 0 || (userCredits !== null && userCredits < (totalItems * translateToLangs.length * 0.10))}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isTranslating ? (
                    <>
                      <span className="animate-spin mr-2">⏳</span>
                      Translating...
                    </>
                  ) : (
                    <>
                      <Languages className="w-4 h-4 mr-2" />
                      Translate to {translateToLangs.length || 0} Language(s)
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete All Confirmation Dialog */}
        <Dialog open={showDeleteAllConfirm} onOpenChange={setShowDeleteAllConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete All Categories</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="text-gray-600">
                Are you sure you want to delete <strong>all {totalItems} categories</strong> in this store?
                This action cannot be undone.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowDeleteAllConfirm(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteAllCategories}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <span className="animate-spin mr-2">⏳</span>
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete All
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
