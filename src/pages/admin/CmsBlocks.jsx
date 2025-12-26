
import React, { useState, useEffect } from "react";
import { CmsBlock } from "@/api/entities";
import { useStoreSelection } from "@/contexts/StoreSelectionContext.jsx";
import NoStoreSelected from "@/components/admin/NoStoreSelected";
import CmsBlockForm from "@/components/admin/cms/CmsBlockForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getBlockTitle, getBlockContent } from "@/utils/translationUtils";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Edit, Trash2, FileText } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import FlashMessage from "@/components/storefront/FlashMessage";
import { useAlertTypes } from "@/hooks/useAlert";
import { clearCmsBlocksCache } from "@/utils/cacheUtils";
import { PageLoader } from "@/components/ui/page-loader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function CmsBlocks() {
  const { selectedStore, getSelectedStoreId } = useStoreSelection();
  const { showConfirm, AlertComponent } = useAlertTypes();
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingBlock, setEditingBlock] = useState(null);
  const [flashMessage, setFlashMessage] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalBlocks, setTotalBlocks] = useState(0);
  const itemsPerPage = 10;

  useEffect(() => {
    if (selectedStore) {
      loadBlocks();
    }
  }, [selectedStore]);

  // Listen for store changes
  useEffect(() => {
    const handleStoreChange = () => {
      if (selectedStore) {
        loadBlocks();
      }
    };

    window.addEventListener('storeSelectionChanged', handleStoreChange);
    return () => window.removeEventListener('storeSelectionChanged', handleStoreChange);
  }, [selectedStore]);

  const loadBlocks = async (page = currentPage) => {
    const storeId = getSelectedStoreId();
    if (!storeId) {
      console.warn("CmsBlocks: No store selected.");
      setBlocks([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await CmsBlock.filter({
        store_id: storeId,
        page: page,
        limit: itemsPerPage
      });

      // Handle response with pagination data
      if (response && response.blocks) {
        setBlocks(response.blocks || []);
        if (response.pagination) {
          setTotalPages(response.pagination.total_pages || 1);
          setTotalBlocks(response.pagination.total || 0);
          setCurrentPage(response.pagination.current_page || page);
        }
      } else {
        // Fallback for direct array response
        setBlocks(response || []);
        setTotalBlocks(response?.length || 0);
        setTotalPages(Math.ceil((response?.length || 0) / itemsPerPage));
      }
    } catch (error) {
      setBlocks([]);
      setTotalBlocks(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = async (formData) => {
    const storeId = getSelectedStoreId();
    if (!storeId) {
      setFlashMessage({ type: 'error', message: 'Cannot save CMS block: No store selected.' });
      return;
    }

    try {
      // Ensure the store_id is set for new blocks
      if (!formData.store_id) {
        formData.store_id = storeId;
      }

      if (editingBlock) {
        await CmsBlock.update(editingBlock.id, formData);
        setFlashMessage({ type: 'success', message: 'CMS Block updated successfully!' });
      } else {
        await CmsBlock.create(formData);
        setFlashMessage({ type: 'success', message: 'CMS Block created successfully!' });
      }
      closeForm();
      loadBlocks();
      // Clear storefront cache for instant updates
      if (storeId) clearCmsBlocksCache(storeId);
    } catch (error) {
      setFlashMessage({ type: 'error', message: 'Failed to save CMS block.' });
    }
  };

  const handleEdit = (block) => {
    setEditingBlock(block); // Changed from 'setSelectedBlock'
    setShowForm(true);
  };

  const handleDelete = async (blockId) => {
    const confirmed = await showConfirm("Are you sure you want to delete this CMS block?", "Delete CMS Block");
    if (confirmed) {
      try {
        await CmsBlock.delete(blockId);
        setFlashMessage({ type: 'success', message: 'CMS Block deleted successfully!' });
        loadBlocks(); // Call loadBlocks
        // Clear storefront cache for instant updates
        const storeId = getSelectedStoreId();
        if (storeId) clearCmsBlocksCache(storeId);
      } catch (error) {
        setFlashMessage({ type: 'error', message: 'Failed to delete CMS block.' });
      }
    }
  };

  const handleToggleActive = async (block) => {
    try {
      await CmsBlock.update(block.id, { ...block, is_active: !block.is_active });
      setFlashMessage({ type: 'success', message: `CMS Block ${block.is_active ? 'deactivated' : 'activated'} successfully!` });
      loadBlocks(); // Call loadBlocks
      // Clear storefront cache for instant updates
      const storeId = getSelectedStoreId();
      if (storeId) clearCmsBlocksCache(storeId);
    } catch (error) {
      setFlashMessage({ type: 'error', message: 'Failed to toggle block status.' });
    }
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingBlock(null); // Changed from 'setSelectedBlock'
  };

  const getBlockTypeIcon = (identifier) => {
    if (identifier?.includes('banner')) return '🎯';
    if (identifier?.includes('hero')) return '🏆';
    if (identifier?.includes('promo')) return '🎁';
    if (identifier?.includes('footer')) return '👇';
    if (identifier?.includes('header')) return '👆';
    return '📄';
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    loadBlocks(page);
  };

  const renderPagination = () => {
    const getVisiblePages = () => {
      const pages = [];
      if (currentPage > 1) {
        pages.push(currentPage - 1);
      }
      pages.push(currentPage);
      for (let i = 1; i <= 3 && currentPage + i <= totalPages; i++) {
        pages.push(currentPage + i);
      }
      return pages;
    };

    const visiblePages = getVisiblePages();

    const getBlockCountText = () => {
      if (totalBlocks === 0) return '0 blocks';
      if (totalBlocks === 1) return '1 block';

      const start = (currentPage - 1) * itemsPerPage + 1;
      const end = Math.min(currentPage * itemsPerPage, totalBlocks);

      if (start === 1 && end === totalBlocks) {
        return `${totalBlocks} blocks`;
      }
      return `Showing ${start}-${end} of ${totalBlocks} blocks`;
    };

    return (
      <div className="flex items-center justify-between mt-6">
        <p className="text-sm text-gray-700">{getBlockCountText()}</p>

        {totalPages > 1 && (
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              Previous
            </Button>

            {visiblePages.map((page) => (
              <Button
                key={page}
                variant={currentPage === page ? "default" : "outline"}
                size="sm"
                onClick={currentPage === page ? undefined : () => handlePageChange(page)}
                disabled={currentPage === page}
                className={currentPage === page ? "bg-blue-600 text-white cursor-default" : ""}
              >
                {page}
              </Button>
            ))}

            {currentPage + 3 < totalPages && (
              <>
                <span className="px-2 text-gray-500">...</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(totalPages)}
                >
                  {totalPages}
                </Button>
              </>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>

            <div className="ml-4">
              <Select
                value={currentPage.toString()}
                onValueChange={(value) => handlePageChange(parseInt(value))}
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

            <span className="ml-4 text-sm text-gray-600">
              of {totalPages} {totalPages === 1 ? 'page' : 'pages'}
            </span>
          </div>
        )}
      </div>
    );
  };

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
            <h1 className="text-3xl font-bold text-gray-900">CMS Blocks</h1>
            <p className="text-gray-600 mt-1">Manage content blocks for your store</p>
          </div>
          <Button 
            onClick={() => handleEdit(null)}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 material-ripple material-elevation-1"
            disabled={!selectedStore}
          >
            <Plus className="mr-2 h-4 w-4" /> Add Block
          </Button>
        </div>

        {loading ? (
          <PageLoader size="lg" fullScreen={false} className="h-64" />
        ) : blocks.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {blocks.map(block => (
                <Card key={block.id} className="material-elevation-1 border-0 hover:material-elevation-2 transition-all duration-300">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                          <span className="text-xl">{getBlockTypeIcon(block.identifier)}</span>
                        </div>
                        <div>
                          <CardTitle className="text-lg">{getBlockTitle(block)}</CardTitle>
                          <p className="text-sm text-gray-500">/{block.identifier}</p>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Active</span>
                      <Switch
                        checked={block.is_active}
                        onCheckedChange={() => handleToggleActive(block)}
                      />
                    </div>

                    <div className="text-sm text-gray-600">
                      <div className="bg-gray-50 p-2 rounded text-xs font-mono max-h-20 overflow-hidden">
                        {getBlockContent(block)?.substring(0, 100)}...
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-2">
                      <div className="flex gap-2">
                        <Badge variant={block.is_active ? "default" : "secondary"}>
                          {block.is_active ? "Active" : "Inactive"}
                        </Badge>
                        {block.is_system && (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
                            System
                          </Badge>
                        )}
                        {block.demo && (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
                            Demo
                          </Badge>
                        )}
                      </div>
                      <div className="flex space-x-2">
                        <Button variant="outline" size="sm" onClick={() => handleEdit(block)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDelete(block.id)} className="text-red-600 hover:text-red-700">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            {renderPagination()}
          </>
        ) : (
          <Card className="material-elevation-1 border-0">
            <CardContent className="text-center py-12">
              <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No CMS blocks found</h3>
              <p className="text-gray-600 mb-6">
                Create your first content block to customize your store's appearance.
              </p>
              <Button
                onClick={() => handleEdit(null)}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 material-ripple"
                disabled={!selectedStore}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Block
              </Button>
            </CardContent>
          </Card>
        )}

        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingBlock ? 'Edit CMS Block' : 'Add New CMS Block'}</DialogTitle> {/* Changed from 'selectedBlock' */}
            </DialogHeader>
            <CmsBlockForm
              block={editingBlock}
              onSubmit={handleFormSubmit}
              onCancel={closeForm}
            />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
