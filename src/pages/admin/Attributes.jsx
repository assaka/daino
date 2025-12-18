
import React, { useState, useEffect } from "react";
import { Attribute } from "@/api/entities";
import { AttributeSet } from "@/api/entities";
import { useStoreSelection } from "@/contexts/StoreSelectionContext.jsx";
import NoStoreSelected from "@/components/admin/NoStoreSelected";
import { clearAttributesCache } from "@/utils/cacheUtils";
import {
  Settings,
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  ChevronDown,
  X,
  List,
  Tag,
  Languages
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

import AttributeForm from "@/components/admin/attributes/AttributeForm";
import AttributeSetForm from "@/components/admin/attributes/AttributeSetForm";
import BulkTranslateDialog from "@/components/admin/BulkTranslateDialog";
import { toast } from "sonner";
import { PageLoader } from "@/components/ui/page-loader";
import { useTranslation } from "@/contexts/TranslationContext.jsx";
import { getAttributeLabel } from "@/utils/attributeUtils";

export default function Attributes() {
  const { selectedStore, getSelectedStoreId } = useStoreSelection();
  const { currentLanguage } = useTranslation();
  const [attributes, setAttributes] = useState([]);
  const [attributeSets, setAttributeSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState("all");
  const [editingAttribute, setEditingAttribute] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingSet, setEditingSet] = useState(null);
  const [showSetForm, setShowSetForm] = useState(false);
  const [currentAttributePage, setCurrentAttributePage] = useState(1);
  const [currentSetPage, setCurrentSetPage] = useState(1);
  const [itemsPerPage] = useState(9); // 3x3 grid
  const [attributesTotalItems, setAttributesTotalItems] = useState(0);
  const [attributesTotalPages, setAttributesTotalPages] = useState(0);
  const [setsTotalItems, setSetsTotalItems] = useState(0);
  const [setsTotalPages, setSetsTotalPages] = useState(0);

  // Translation dialog state
  const [showBulkTranslateDialog, setShowBulkTranslateDialog] = useState(false);

  // Delete all state
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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
      console.warn("No store selected");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const filters = { store_id: storeId };

      // Load all attributes and attribute sets without pagination
      const [attributesData, setsData] = await Promise.all([
        Attribute.filter({ ...filters, limit: 10000 }), // Load all attributes
        AttributeSet.filter({ ...filters, limit: 10000 }) // Load all attribute sets
      ]);

      setAttributes(attributesData || []);
      setAttributesTotalItems(attributesData?.length || 0);
      setAttributesTotalPages(1); // Only one page since we load all
      setCurrentAttributePage(1);

      setAttributeSets(setsData || []);
      setSetsTotalItems(setsData?.length || 0);
      setSetsTotalPages(1); // Only one page since we load all
      setCurrentSetPage(1);
    } catch (error) {
      console.error("Error loading data:", error);
      setAttributes([]);
      setAttributeSets([]);
      setAttributesTotalItems(0);
      setAttributesTotalPages(0);
      setSetsTotalItems(0);
      setSetsTotalPages(0);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAttribute = async (attributeData) => {
    const storeId = getSelectedStoreId();
    if (!storeId) {
      throw new Error("No store selected");
    }

    try {
      const result = await Attribute.create({ ...attributeData, store_id: storeId });
      await loadData();
      setShowForm(false);
      // Clear storefront cache for instant updates
      clearAttributesCache(storeId);
      return result; // Return the created attribute
    } catch (error) {
      console.error("Error creating attribute:", error);
      throw error;
    }
  };

  const handleUpdateAttribute = async (attributeData) => {
    const storeId = getSelectedStoreId();
    if (!storeId) {
      throw new Error("No store selected");
    }

    try {
      const { id, ...updateData } = attributeData;
      const result = await Attribute.update(id, { ...updateData, store_id: storeId });
      await loadData();
      setShowForm(false);
      setEditingAttribute(null);
      // Clear storefront cache for instant updates
      clearAttributesCache(storeId);
      return result; // Return the updated attribute
    } catch (error) {
      console.error("Error updating attribute:", error);
      throw error;
    }
  };

  const handleDeleteAttribute = async (attributeId) => {
    if (window.confirm("Are you sure you want to delete this attribute?")) {
      try {
        await Attribute.delete(attributeId);
        await loadData();
        // Clear storefront cache for instant updates
        const storeId = getSelectedStoreId();
        if (storeId) clearAttributesCache(storeId);
      } catch (error) {
        console.error("Error deleting attribute:", error);
      }
    }
  };

  const handleCreateSet = async (setData) => {
    const storeId = getSelectedStoreId();
    if (!storeId) {
      throw new Error("No store selected");
    }

    try {
      await AttributeSet.create({ ...setData, store_id: storeId });
      await loadData();
      setShowSetForm(false);
      // Clear storefront cache for instant updates
      clearAttributesCache(storeId);
    } catch (error) {
      console.error("Error creating attribute set:", error);
    }
  };

  const handleUpdateSet = async (setData) => {
    const storeId = getSelectedStoreId();
    if (!storeId) {
      throw new Error("No store selected");
    }

    try {
      const { id, ...updateData } = setData;
      await AttributeSet.update(id, { ...updateData, store_id: storeId });
      await loadData();
      setShowSetForm(false);
      setEditingSet(null);
      // Clear storefront cache for instant updates
      clearAttributesCache(storeId);
    } catch (error) {
      console.error("Error updating attribute set:", error);
    }
  };

  const handleDeleteAttributeSet = async (attributeSetId) => {
    if (window.confirm("Are you sure you want to delete this attribute set?")) {
      try {
        await AttributeSet.delete(attributeSetId);
        await loadData();
        // Clear storefront cache for instant updates
        const storeId = getSelectedStoreId();
        if (storeId) clearAttributesCache(storeId);
      } catch (error) {
        console.error("Error deleting attribute set:", error);
      }
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
      const response = await fetch('/api/attributes/bulk-translate', {
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

      // Reload attributes to get updated translations
      await loadData();

      return data;
    } catch (error) {
      console.error('Bulk translate error:', error);
      return { success: false, message: error.message };
    }
  };

  const handleDeleteAllAttributes = async () => {
    const storeId = getSelectedStoreId();
    if (!storeId) {
      toast.error("No store selected");
      return;
    }

    setIsDeleting(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/attributes/all?store_id=${storeId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-store-id': storeId
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to delete attributes');
      }

      toast.success(`${data.data?.deleted || 0} attributes deleted successfully`);
      setShowDeleteAllConfirm(false);
      await loadData();
      // Clear cache
      clearAttributesCache(storeId);
    } catch (error) {
      console.error('Delete all attributes error:', error);
      toast.error(error.message || 'Failed to delete attributes');
    } finally {
      setIsDeleting(false);
    }
  };

  // Client-side filtering for search and type (all data is loaded)
  const filteredAttributes = attributes.filter(attribute => {
    const matchesSearch = !searchQuery.trim() ||
      attribute.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      attribute.code.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = selectedTypeFilter === "all" || attribute.type === selectedTypeFilter;

    return matchesSearch && matchesType;
  });

  const filteredAttributeSets = attributeSets.filter(attributeSet =>
    !searchQuery.trim() || 
    attributeSet.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (attributeSet.description && attributeSet.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Client-side pagination for display
  const attributeStartIndex = (currentAttributePage - 1) * itemsPerPage;
  const setStartIndex = (currentSetPage - 1) * itemsPerPage;
  const paginatedAttributes = filteredAttributes.slice(attributeStartIndex, attributeStartIndex + itemsPerPage);
  const paginatedAttributeSets = filteredAttributeSets.slice(setStartIndex, setStartIndex + itemsPerPage);

  // Calculate pagination based on filtered results
  const totalAttributePages = Math.ceil(filteredAttributes.length / itemsPerPage);
  const totalSetPages = Math.ceil(filteredAttributeSets.length / itemsPerPage);

  // Reset to first page when search or type filter changes
  useEffect(() => {
    setCurrentAttributePage(1);
    setCurrentSetPage(1);
  }, [searchQuery, selectedTypeFilter]);

  // Handle page changes (client-side only)
  const handleAttributePageChange = (page) => {
    setCurrentAttributePage(page);
  };

  const handleSetPageChange = (page) => {
    setCurrentSetPage(page);
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

  const getAttributeTypeColor = (type) => {
    const colors = {
      text: "bg-blue-100 text-blue-700",
      number: "bg-green-100 text-green-700",
      select: "bg-purple-100 text-purple-700",
      multiselect: "bg-pink-100 text-pink-700",
      boolean: "bg-orange-100 text-orange-700",
      date: "bg-indigo-100 text-indigo-700",
      file: "bg-yellow-100 text-yellow-700"
    };
    return colors[type] || "bg-gray-100 text-gray-700";
  };

  if (loading) {
    return <PageLoader size="lg" />;
  }

  if (!selectedStore) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <NoStoreSelected message="Please select a store to manage attributes and attribute sets" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Attributes & Sets</h1>
            <p className="text-gray-600 mt-1">Manage product attributes and attribute sets</p>
          </div>
        </div>

        {/* Search and Filters */}
        <Card className="material-elevation-1 border-0 mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  placeholder="Search attributes and sets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select
                value={selectedTypeFilter}
                onValueChange={setSelectedTypeFilter}
              >
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="select">Select</SelectItem>
                  <SelectItem value="multiselect">Multi-select</SelectItem>
                  <SelectItem value="boolean">Boolean</SelectItem>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="file">File</SelectItem>
                </SelectContent>
              </Select>
              {(searchQuery || selectedTypeFilter !== "all") && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedTypeFilter("all");
                  }}
                  className="whitespace-nowrap"
                >
                  <X className="w-4 h-4 mr-2" />
                  Clear Filters
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="attributes" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="attributes" className="flex items-center gap-2">
              <Tag className="w-4 h-4" />
              Attributes
            </TabsTrigger>
            <TabsTrigger value="sets" className="flex items-center gap-2">
              <List className="w-4 h-4" />
              Attribute Sets
            </TabsTrigger>
          </TabsList>

          {/* Attributes Tab */}
          <TabsContent value="attributes">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Attributes ({filteredAttributes.length})</h2>
                {filteredAttributes.length > 0 && (
                  <p className="text-sm text-gray-600 mt-1">
                    Showing {attributeStartIndex + 1} to {Math.min(attributeStartIndex + itemsPerPage, filteredAttributes.length)} of {filteredAttributes.length} attributes
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setShowDeleteAllConfirm(true)}
                  variant="outline"
                  className="border-red-600 text-red-600 hover:bg-red-50"
                  disabled={!selectedStore || attributesTotalItems === 0}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete All ({attributesTotalItems})
                </Button>
                <Button
                  onClick={() => setShowBulkTranslateDialog(true)}
                  variant="outline"
                  className="border-blue-600 text-blue-600 hover:bg-blue-50"
                  disabled={!selectedStore || attributes.length === 0}
                >
                  <Languages className="w-4 h-4 mr-2" />
                  Bulk AI Translate
                </Button>
                <Button
                  onClick={() => {
                    setEditingAttribute(null); // Reset for new creation
                    setShowForm(true); // Open attribute form
                  }}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 material-ripple material-elevation-1"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Attribute
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {paginatedAttributes.map((attribute) => (
                <Card key={attribute.id} className="material-elevation-1 border-0 hover:material-elevation-2 transition-all duration-300">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">{getAttributeLabel(attribute, currentLanguage)}</CardTitle>
                        <p className="text-sm text-gray-500 font-mono">{attribute.code}</p>
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
                              setEditingAttribute(attribute); // Set attribute for editing
                              setShowForm(true); // Open attribute form
                            }}
                          >
                            <Edit className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDeleteAttribute(attribute.id)}
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
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        <Badge className={getAttributeTypeColor(attribute.type)}>
                          {attribute.type}
                        </Badge>
                        {attribute.demo && (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">Demo</Badge>
                        )}
                        {attribute.is_required && (
                          <Badge variant="outline" className="text-red-600">Required</Badge>
                        )}
                        {attribute.is_filterable && (
                          <Badge variant="outline" className="text-blue-600">Filterable</Badge>
                        )}
                        {attribute.is_searchable && (
                          <Badge variant="outline" className="text-green-600">Searchable</Badge>
                        )}
                      </div>

                      {(attribute.type === 'select' || attribute.type === 'multiselect') && (
                        <div>
                          <p className="text-sm font-medium text-gray-700 mb-1">Options:</p>
                          <div className="flex flex-wrap gap-1">
                            {/* Show message to add options if none exist */}
                            {(!attribute.values || attribute.values.length === 0) && (
                              <span className="text-xs text-gray-400 italic">No options yet</span>
                            )}

                            {/* Display attribute values */}
                            {attribute.values && attribute.values.length > 0 && (
                              <>
                                {attribute.values.slice(0, 3).map((value) => (
                                  <Badge key={value.id} variant="outline" className="text-xs">
                                    {value.translations?.en?.label || value.code}
                                  </Badge>
                                ))}
                                {attribute.values.length > 3 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{attribute.values.length - 3} more
                                  </Badge>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {filteredAttributes.length === 0 && !loading && (
              <Card className="material-elevation-1 border-0">
                <CardContent className="text-center py-12">
                  <Tag className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No attributes found</h3>
                  <p className="text-gray-600 mb-6">
                    {searchQuery
                      ? "Try adjusting your search terms"
                      : "Start by creating your first product attribute"}
                  </p>
                  <Button
                    onClick={() => {
                      setEditingAttribute(null); // Reset for new creation
                      setShowForm(true); // Open attribute form
                    }}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 material-ripple"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Attribute
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Enhanced Attributes Pagination */}
            {renderPagination(currentAttributePage, totalAttributePages, handleAttributePageChange)}
          </TabsContent>

          {/* Attribute Sets Tab */}
          <TabsContent value="sets">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Attribute Sets ({filteredAttributeSets.length})</h2>
                {filteredAttributeSets.length > 0 && (
                  <p className="text-sm text-gray-600 mt-1">
                    Showing {setStartIndex + 1} to {Math.min(setStartIndex + itemsPerPage, filteredAttributeSets.length)} of {filteredAttributeSets.length} attribute sets
                  </p>
                )}
              </div>
              <Button
                onClick={() => {
                  setEditingSet(null); // Reset for new creation
                  setShowSetForm(true); // Open attribute set form
                }}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 material-ripple material-elevation-1"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Attribute Set
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {paginatedAttributeSets.map((attributeSet) => (
                <Card key={attributeSet.id} className="material-elevation-1 border-0 hover:material-elevation-2 transition-all duration-300">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">{attributeSet.name}</CardTitle>
                        <p className="text-sm text-gray-500">{attributeSet.description}</p>
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
                              setEditingSet(attributeSet); // Set attribute set for editing
                              setShowSetForm(true); // Open attribute set form
                            }}
                          >
                            <Edit className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDeleteAttributeSet(attributeSet.id)}
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
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {attributeSet.is_default && (
                          <Badge className="bg-green-100 text-green-700">Default</Badge>
                        )}
                        {attributeSet.demo && (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">Demo</Badge>
                        )}
                        <Badge variant="outline">
                          {attributeSet.attribute_ids?.length || 0} attributes
                        </Badge>
                      </div>

                      {attributeSet.attribute_ids && attributeSet.attribute_ids.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-gray-700 mb-2">Attributes:</p>
                          <div className="flex flex-wrap gap-1">
                            {attributes
                              .filter(attr => attributeSet.attribute_ids.includes(attr.id))
                              .slice(0, 4)
                              .map((attr) => (
                                <Badge key={attr.id} variant="outline" className="text-xs">
                                  {getAttributeLabel(attr, currentLanguage)}
                                </Badge>
                              ))}
                            {attributeSet.attribute_ids.length > 4 && (
                              <Badge variant="outline" className="text-xs">
                                +{attributeSet.attribute_ids.length - 4} more
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {filteredAttributeSets.length === 0 && !loading && (
              <Card className="material-elevation-1 border-0">
                <CardContent className="text-center py-12">
                  <List className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No attribute sets found</h3>
                  <p className="text-gray-600 mb-6">
                    {searchQuery
                      ? "Try adjusting your search terms"
                      : "Start by creating your first attribute set"}
                  </p>
                  <Button
                    onClick={() => {
                      setEditingSet(null); // Reset for new creation
                      setShowSetForm(true); // Open attribute set form
                    }}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 material-ripple"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Attribute Set
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Enhanced Attribute Sets Pagination */}
            {renderPagination(currentSetPage, totalSetPages, handleSetPageChange)}
          </TabsContent>
        </Tabs>

        {/* Attribute Form Dialog */}
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingAttribute ? 'Edit Attribute' : 'Add New Attribute'}
              </DialogTitle>
            </DialogHeader>
            <AttributeForm
              attribute={editingAttribute}
              onSubmit={editingAttribute ? handleUpdateAttribute : handleCreateAttribute}
              onCancel={() => {
                setShowForm(false);
                setEditingAttribute(null);
              }}
            />
          </DialogContent>
        </Dialog>

        {/* Attribute Set Form Dialog */}
        <Dialog open={showSetForm} onOpenChange={setShowSetForm}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingSet ? 'Edit Attribute Set' : 'Add New Attribute Set'}
              </DialogTitle>
            </DialogHeader>
            <AttributeSetForm
              attributeSet={editingSet}
              attributes={attributes}
              onSubmit={editingSet ? handleUpdateSet : handleCreateSet}
              onCancel={() => {
                setShowSetForm(false);
                setEditingSet(null);
              }}
            />
          </DialogContent>
        </Dialog>

        <BulkTranslateDialog
          open={showBulkTranslateDialog}
          onOpenChange={setShowBulkTranslateDialog}
          entityType="attributes"
          entityName="Attributes"
          onTranslate={handleBulkTranslate}
        />

        {/* Delete All Confirmation Dialog */}
        <Dialog open={showDeleteAllConfirm} onOpenChange={setShowDeleteAllConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete All Attributes</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="text-gray-600">
                Are you sure you want to delete <strong>all {attributesTotalItems} attributes</strong> in this store?
                This will also delete all attribute values and remove them from products.
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
                onClick={handleDeleteAllAttributes}
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
