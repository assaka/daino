
import React, { useState, useEffect } from 'react';
import { ProductLabel } from '@/api/entities';
import { Attribute } from '@/api/entities';
import { useStoreSelection } from '@/contexts/StoreSelectionContext.jsx';
import ProductLabelForm from '@/components/admin/products/ProductLabelForm';
import { clearLabelsCache } from '@/utils/cacheUtils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Plus, Edit, Trash2, Tag } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getAttributeValueLabel } from '@/utils/attributeUtils';
import { useTranslation } from '@/contexts/TranslationContext';
import FlashMessage from '@/components/storefront/FlashMessage';
import { PageLoader } from '@/components/ui/page-loader';

import { useAlertTypes } from '@/hooks/useAlert';
export default function ProductLabels() {

  const { showWarning, showInfo, showConfirm, AlertComponent } = useAlertTypes();
  const [flashMessage, setFlashMessage] = useState(null);
const [labels, setLabels] = useState([]);
  const [attributes, setAttributes] = useState([]);
  const { selectedStore, getSelectedStoreId } = useStoreSelection();
  const { currentLanguage } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingLabel, setEditingLabel] = useState(null); // Renamed from selectedLabel for clarity

  useEffect(() => {
    if (selectedStore) {
      loadData();
    }
  }, [selectedStore, currentLanguage]);

  const loadData = async () => {
    setLoading(true);
    try {
      const storeId = getSelectedStoreId();
      if (!storeId) {
        console.warn("No store selected");
        setLoading(false);
        return;
      }

      // Load attributes and labels for the selected store
      const [attributesData, labelsData] = await Promise.all([
        Attribute.filter({ store_id: storeId }),
        ProductLabel.filter({ store_id: storeId })
      ]);

      // Transform attribute values into options format for the form
      const transformedAttributes = (attributesData || []).map(attr => {
        // If attribute has values (for select/multiselect types), transform them to options
        if (attr.values && Array.isArray(attr.values)) {
          return {
            ...attr,
            options: attr.values.map(v => ({
              value: v.code,
              label: getAttributeValueLabel(v, currentLanguage)
            }))
          };
        }
        return attr;
      });

      setAttributes(transformedAttributes);
      setLabels(labelsData || []);
    } catch (error) {
      console.error("Failed to load product labels or attributes", error);
      setLabels([]);
      setAttributes([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (labelData) => {

    const storeId = getSelectedStoreId();
    if (!storeId) {
      console.error("Cannot save product label: No store selected.");
      return;
    }

    // Validate required fields
    if (!labelData.name || !labelData.name.trim()) {
      console.error("Cannot save product label: Name is required.");
      showWarning('Please enter a name for the product label.');
      return;
    }

    if (!labelData.text || !labelData.text.trim()) {
      console.error("Cannot save product label: Display text is required.");
      showWarning('Please enter display text for the product label.');
      return;
    }

    // Map frontend field names to backend field names
    const backendData = {
      ...labelData,
      color: labelData.text_color, // Map text_color to color
      store_id: storeId,
      priority: parseInt(labelData.priority) || 0, // Ensure priority is a number
      sort_order: parseInt(labelData.sort_order) || 0 // Ensure sort_order is a number
    };

    // Remove the frontend field name
    delete backendData.text_color;

    try {
      if (editingLabel) {
        await ProductLabel.update(editingLabel.id, backendData);
        setFlashMessage({ type: 'success', message: 'Product label updated successfully!' });
      } else {
        await ProductLabel.create(backendData);
        setFlashMessage({ type: 'success', message: 'Product label created successfully!' });
      }

      closeForm();
      loadData();
      // Clear storefront cache for instant updates
      const storeId = getSelectedStoreId();
      if (storeId) clearLabelsCache(storeId);
    } catch (error) {
      console.error("Failed to save product label", error);
      setFlashMessage({ type: 'error', message: 'Failed to save product label' });
    }
  };

  const handleEdit = async (label) => {
    if (label) {
      // Fetch the full label with all translations from the API
      try {
        const response = await ProductLabel.findById(label.id);
        // Extract the actual label data from the API response
        const fullLabel = response?.data || response;
        setEditingLabel(fullLabel);
      } catch (error) {
        console.error('Failed to fetch full label:', error);
        setFlashMessage({ type: 'error', message: 'Failed to load label details' });
        return;
      }
    } else {
      setEditingLabel(null);
    }
    setShowForm(true); // Show the form
  };

  const handleDelete = async (labelId) => {
    const confirmed = await showConfirm("Are you sure you want to delete this label?", "Delete Label");
    if (confirmed) {
      try {
        await ProductLabel.delete(labelId);
        setFlashMessage({ type: 'success', message: 'Product label deleted successfully!' });
        loadData(); // Reload data after deletion
        // Clear storefront cache for instant updates
        const storeId = getSelectedStoreId();
        if (storeId) clearLabelsCache(storeId);
      } catch (error) {
        console.error("Failed to delete product label", error);
        setFlashMessage({ type: 'error', message: 'Failed to delete product label' });
      }
    }
  };

  const handleToggleActive = async (label) => {
    try {
      // Toggle the is_active status of the label
      await ProductLabel.update(label.id, { ...label, is_active: !label.is_active });
      loadData(); // Reload data to reflect the status change
      // Clear storefront cache for instant updates
      const storeId = getSelectedStoreId();
      if (storeId) clearLabelsCache(storeId);
    } catch (error) {
      console.error("Failed to toggle label status", error);
    }
  };


  const closeForm = () => {
    setShowForm(false);
    setEditingLabel(null); // Reset the editingLabel when closing the form
  };

  const getPositionDisplay = (position) => {
    const positions = {
      'top-left': 'Top Left',
      'top-right': 'Top Right',
      'top-center': 'Top Center',
      'center-left': 'Center Left',
      'center-right': 'Center Right',
      'bottom-left': 'Bottom Left',
      'bottom-right': 'Bottom Right',
      'bottom-center': 'Bottom Center'
    };
    return positions[position] || position;
  };

  const getPositionClasses = (position) => {
    const positions = {
      'top-left': 'top-2 left-2',
      'top-right': 'top-2 right-2',
      'top-center': 'top-2 left-1/2 transform -translate-x-1/2',
      'center-left': 'top-1/2 left-2 transform -translate-y-1/2',
      'center-right': 'top-1/2 right-2 transform -translate-y-1/2',
      'bottom-left': 'bottom-2 left-2',
      'bottom-right': 'bottom-2 right-2',
      'bottom-center': 'bottom-2 left-1/2 transform -translate-x-1/2'
    };
    return positions[position] || positions['top-right'];
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <FlashMessage
        message={flashMessage}
        onClose={() => setFlashMessage(null)}
      />
      <AlertComponent />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Product Labels</h1>
            <p className="text-gray-600 mt-1">Create dynamic labels that appear on product images</p>
          </div>
          <Button 
            onClick={() => handleEdit(null)} // Call handleEdit with null to signify adding a new label
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 material-ripple material-elevation-1"
          >
            <Plus className="mr-2 h-4 w-4" /> Add Label
          </Button>
        </div>

        {loading ? (
          <PageLoader size="lg" fullScreen={false} className="h-64" />
        ) : labels.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {labels.map(label => (
              <Card key={label.id} className="material-elevation-1 border-0 hover:material-elevation-2 transition-all duration-300 flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="relative w-16 h-16 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300">
                        <div
                          className={`absolute px-2 py-1 text-xs font-bold rounded shadow-lg ${getPositionClasses(label.position)}`}
                          style={{
                            backgroundColor: label.background_color || '#FF0000',
                            color: label.color || '#FFFFFF'
                          }}
                        >
                          {label.text}
                        </div>
                      </div>
                      <div>
                        <CardTitle className="text-lg">{label.name}</CardTitle>
                        <p className="text-sm text-gray-500">{getPositionDisplay(label.position)}</p>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col justify-between">
                  <div>
                    {(label.conditions?.attribute_conditions?.length > 0 ||
                      label.conditions?.price_conditions?.has_sale_price ||
                      label.conditions?.price_conditions?.is_new) && (
                      <div className="text-sm mb-4">
                        <span className="font-medium">Conditions:</span>
                        <div className="mt-1 space-y-1">
                          {label.conditions?.attribute_conditions?.length > 0 && (
                            <Badge variant="outline" className="mr-1">
                              {label.conditions.attribute_conditions.length} Attribute Rules
                            </Badge>
                          )}
                          {label.conditions?.price_conditions?.has_sale_price && (
                            <Badge variant="outline" className="mr-1">
                              On Sale
                            </Badge>
                          )}
                          {label.conditions?.price_conditions?.is_new && (
                            <Badge variant="outline" className="mr-1">
                              New Products
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-center pt-2">
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={label.is_active}
                        onCheckedChange={() => handleToggleActive(label)}
                      />
                      <span className="text-sm font-medium">Active</span>
                      {label.demo && (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
                          Demo
                        </Badge>
                      )}
                    </div>
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(label)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDelete(label.id)} className="text-red-600 hover:text-red-700">
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
              <Tag className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No product labels found</h3>
              <p className="text-gray-600 mb-6">
                Create labels to highlight special products like "New", "Sale", or custom attributes.
              </p>
              <Button
                onClick={() => handleEdit(null)}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 material-ripple"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Label
              </Button>
            </CardContent>
          </Card>
        )}

        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby="product-label-description">
            <DialogHeader>
              <DialogTitle>{editingLabel ? 'Edit Product Label' : 'Add New Product Label'}</DialogTitle>
              <p id="product-label-description" className="text-sm text-gray-600">
                {editingLabel ? 'Modify the settings for this product label.' : 'Create a new label to highlight products with special attributes or conditions.'}
              </p>
            </DialogHeader>
            <ProductLabelForm
              label={editingLabel}
              attributes={attributes}
              onSubmit={handleSubmit}
              onCancel={closeForm}
            />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
