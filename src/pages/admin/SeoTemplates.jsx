import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Plus, Trash2, Edit } from "lucide-react";
import { SeoTemplate } from "@/api/entities";
import { useStoreSelection } from "@/contexts/StoreSelectionContext.jsx";
import NoStoreSelected from "@/components/admin/NoStoreSelected";
import FlashMessage from "@/components/storefront/FlashMessage";
import { Badge } from '@/components/ui/badge';
import { clearSeoTemplatesCache } from "@/utils/cacheUtils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAlertTypes } from "@/hooks/useAlert";
import { PageLoader } from "@/components/ui/page-loader";
import SeoTemplateForm from "@/components/admin/seo/SeoTemplateForm";

export default function SeoTemplates() {
  const { selectedStore, getSelectedStoreId } = useStoreSelection();
  const { showConfirm, AlertComponent } = useAlertTypes();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [flashMessage, setFlashMessage] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);

  useEffect(() => {
    if (selectedStore) {
      loadTemplates();
    }
  }, [selectedStore]);

  // Listen for store changes
  useEffect(() => {
    const handleStoreChange = () => {
      if (selectedStore) {
        loadTemplates();
      }
    };

    window.addEventListener('storeSelectionChanged', handleStoreChange);
    return () => window.removeEventListener('storeSelectionChanged', handleStoreChange);
  }, [selectedStore]);

  const loadTemplates = async () => {
    const storeId = getSelectedStoreId();
    if (!storeId) {
      setTemplates([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await SeoTemplate.filter({ store_id: storeId });
      setTemplates(data || []);
    } catch (error) {
      console.error('Error loading SEO templates:', error);
      setFlashMessage({
        type: 'error',
        message: 'Failed to load SEO templates'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (template) => {
    setEditingTemplate(template);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingTemplate(null);
  };

  const handleFormSubmit = async (formData) => {
    const storeId = getSelectedStoreId();
    if (!storeId) {
      setFlashMessage({
        type: 'error',
        message: 'No store selected'
      });
      return;
    }

    try {
      if (editingTemplate) {
        await SeoTemplate.update(editingTemplate.id, formData);
        setFlashMessage({
          type: 'success',
          message: 'SEO template updated successfully'
        });
      } else {
        await SeoTemplate.create(formData);
        setFlashMessage({
          type: 'success',
          message: 'SEO template created successfully'
        });
      }

      closeForm();
      await loadTemplates();

      // Clear storefront cache for instant updates
      if (storeId) clearSeoTemplatesCache(storeId);
    } catch (error) {
      console.error('Error saving SEO template:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to save SEO template';
      setFlashMessage({
        type: 'error',
        message: errorMessage
      });
    }
  };

  const handleDelete = async (template) => {
    const confirmed = await showConfirm(
      `Are you sure you want to delete "${template.name || template.type + ' Template'}"? This action cannot be undone.`,
      "Delete SEO Template"
    );

    if (confirmed) {
      try {
        await SeoTemplate.delete(template.id);
        await loadTemplates();

        setFlashMessage({
          type: 'success',
          message: 'SEO template deleted successfully'
        });

        // Clear storefront cache for instant updates
        const storeId = getSelectedStoreId();
        if (storeId) clearSeoTemplatesCache(storeId);
      } catch (error) {
        console.error('Error deleting SEO template:', error);
        setFlashMessage({
          type: 'error',
          message: 'Failed to delete SEO template'
        });
      }
    }
  };

  const getTemplateTypeIcon = (type) => {
    switch (type) {
      case 'product': return '🛍️';
      case 'category': return '📁';
      case 'cms_page': return '📄';
      case 'homepage': return '🏠';
      case 'blog_post': return '📝';
      case 'brand': return '🏷️';
      default: return '📋';
    }
  };

  const getTemplateTypeLabel = (type) => {
    switch (type) {
      case 'product': return 'Product Pages';
      case 'category': return 'Category Pages';
      case 'cms_page': return 'CMS Pages';
      case 'homepage': return 'Homepage';
      case 'blog_post': return 'Blog Posts';
      case 'brand': return 'Brand Pages';
      default: return type;
    }
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
            <h1 className="text-3xl font-bold text-gray-900">SEO Templates</h1>
            <p className="text-gray-600 mt-1">Manage SEO meta tags for your store pages</p>
          </div>
          <Button
            onClick={() => handleEdit(null)}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 material-ripple material-elevation-1"
            disabled={!selectedStore}
          >
            <Plus className="mr-2 h-4 w-4" /> Create Template
          </Button>
        </div>

        {loading ? (
          <PageLoader size="lg" fullScreen={false} className="h-64" />
        ) : templates.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {templates.map(template => (
              <Card key={template.id} className="material-elevation-1 border-0 hover:material-elevation-2 transition-all duration-300">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                        <span className="text-xl">{getTemplateTypeIcon(template.type)}</span>
                      </div>
                      <div>
                        <CardTitle className="text-lg">
                          {template.name || `${getTemplateTypeLabel(template.type)} Template`}
                        </CardTitle>
                        <p className="text-sm text-gray-500">{getTemplateTypeLabel(template.type)}</p>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-sm text-gray-600">
                    <div className="mb-2">
                      <span className="font-medium">Title: </span>
                      <span className="font-mono text-xs bg-gray-100 px-1 py-0.5 rounded">
                        {template.template?.meta_title || template.meta_title || '-'}
                      </span>
                    </div>
                    {(template.template?.meta_description || template.meta_description) && (
                      <div className="bg-gray-50 p-2 rounded text-xs max-h-16 overflow-hidden">
                        {(template.template?.meta_description || template.meta_description)?.substring(0, 100)}...
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-center pt-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="capitalize">
                        {template.type?.replace('_', ' ')}
                      </Badge>
                      {template.demo && (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
                          Demo
                        </Badge>
                      )}
                    </div>
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(template)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(template)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="material-elevation-1 border-0">
            <CardContent className="text-center py-12">
              <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No SEO templates found</h3>
              <p className="text-gray-600 mb-6">
                Create your first SEO template to optimize your store's search engine presence.
              </p>
              <Button
                onClick={() => handleEdit(null)}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 material-ripple"
                disabled={!selectedStore}
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Template
              </Button>
            </CardContent>
          </Card>
        )}

        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingTemplate ? 'Edit SEO Template' : 'Create SEO Template'}</DialogTitle>
            </DialogHeader>
            <SeoTemplateForm
              template={editingTemplate}
              onSubmit={handleFormSubmit}
              onCancel={closeForm}
            />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
