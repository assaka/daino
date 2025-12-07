import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import SaveButton from '@/components/ui/save-button';
import { Category } from '@/api/entities';
import { AttributeSet } from '@/api/entities';
import { Attribute } from '@/api/entities';
import { useStoreSelection } from '@/contexts/StoreSelectionContext.jsx';
import { X, ChevronsUpDown, Check, Languages, Plus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from '@/components/ui/badge';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import TranslationFields from "@/components/admin/TranslationFields";
import { useTranslation } from "@/contexts/TranslationContext";
import { getAttributeLabel, getAttributeValueLabel } from "@/utils/attributeUtils";

import { useAlertTypes } from '@/hooks/useAlert';
export default function CustomOptionRuleForm({ rule, onSubmit, onCancel }) {
  const { showError, showWarning, showInfo, showSuccess, AlertComponent } = useAlertTypes();
  const { selectedStore, getSelectedStoreId } = useStoreSelection();
  const { currentLanguage } = useTranslation();

  const [formData, setFormData] = useState({
    name: '',
    display_label: 'Custom Options',
    is_active: true,
    conditions: {
      categories: [],
      attribute_sets: [],
      skus: [],
      attribute_conditions: []
    },
    store_id: '',
    translations: {}
  });

  const [customOptionProducts, setCustomOptionProducts] = useState([]);
  const [attributeSets, setAttributeSets] = useState([]);
  const [attributes, setAttributes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Multi-select states
  const [showCategorySelect, setShowCategorySelect] = useState(false);
  const [showAttributeSetSelect, setShowAttributeSetSelect] = useState(false);
  const [showTranslations, setShowTranslations] = useState(false);
  const [skuInput, setSkuInput] = useState('');

  // Load static data using selected store
  useEffect(() => {
    const loadStaticData = async () => {
      const storeId = getSelectedStoreId();
      if (!storeId) {
        console.warn('No store selected');
        return;
      }

      try {
        // Set store ID in form data
        setFormData(prev => ({ ...prev, store_id: storeId }));

        // Load store-specific data
        const [attributeSetsData, attributesData, categoriesData] = await Promise.all([
          AttributeSet.filter({ store_id: storeId }).catch(() => []),
          Attribute.filter({ store_id: storeId }).catch(() => []),
          Category.filter({ store_id: storeId }).catch(() => [])
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

        setAttributeSets(Array.isArray(attributeSetsData) ? attributeSetsData : []);
        setAttributes(transformedAttributes);
        setCategories(Array.isArray(categoriesData) ? categoriesData : []);
      } catch (error) {
        console.error("Error loading static data:", error);
        setAttributeSets([]);
        setAttributes([]);
        setCategories([]);
      }
    };

    if (selectedStore) {
      loadStaticData();
    }
  }, [selectedStore, currentLanguage]);

  // Load custom option products whenever store_id changes (read-only display)
  useEffect(() => {
    const loadProductsForStore = async () => {
      if (!formData.store_id) {
        setCustomOptionProducts([]);
        return;
      }
      setLoadingProducts(true);
      try {
        const { Product } = await import('@/api/entities');
        // Only load products marked as custom options
        const products = await Product.filter({
          is_custom_option: true,
          status: 'active',
          store_id: formData.store_id
        });

        setCustomOptionProducts(Array.isArray(products) ? products : []);
      } catch (error) {
        console.error("Error loading custom option products:", error);
        setCustomOptionProducts([]);
      } finally {
        setLoadingProducts(false);
      }
    };
    loadProductsForStore();
  }, [formData.store_id]);

  // Populate form data when a rule is passed (for editing)
  useEffect(() => {
    if (rule) {
      // Handle translations with backward compatibility
      let translations = rule.translations || {};

      // Ensure English translation exists (backward compatibility)
      if (!translations.en || (!translations.en.display_label && rule.display_label)) {
        translations.en = {
          display_label: rule.display_label || 'Custom Options'
        };
      }

      setFormData({
        name: rule.name || '',
        display_label: translations.en?.display_label || 'Custom Options',
        is_active: rule.is_active !== false,
        conditions: rule.conditions || { categories: [], attribute_sets: [], skus: [], attribute_conditions: [] },
        store_id: rule.store_id || '',
        translations: translations
      });
    }
  }, [rule]);

  const handleInputChange = (field, value) => {
    setFormData(prev => {
      const newState = {
        ...prev,
        [field]: value
      };

      // Sync main field with English translation (bidirectional)
      if (field === "display_label") {
        newState.translations = {
          ...prev.translations,
          en: {
            ...prev.translations.en,
            display_label: value
          }
        };
      }

      return newState;
    });
  };

  const handleConditionChange = (conditionType, value) => {
    setFormData(prev => ({
      ...prev,
      conditions: {
        ...prev.conditions,
        [conditionType]: value
      }
    }));
  };

  const handleMultiSelectToggle = (condition, id) => {
    const currentValues = formData.conditions[condition] || [];
    const newValues = currentValues.includes(id)
      ? currentValues.filter(item => item !== id)
      : [...currentValues, id];
    
    handleConditionChange(condition, newValues);
  };


  const handleSkuAdd = () => {
    const trimmedSku = skuInput.trim();
    if (trimmedSku && !formData.conditions.skus?.includes(trimmedSku)) {
      const currentSkus = formData.conditions.skus || [];
      handleConditionChange('skus', [...currentSkus, trimmedSku]);
      setSkuInput('');
    }
  };

  const handleSkuRemove = (skuToRemove) => {
    const currentSkus = formData.conditions.skus || [];
    handleConditionChange('skus', currentSkus.filter(sku => sku !== skuToRemove));
  };

  const handleSkuKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSkuAdd();
    }
  };

  const addAttributeCondition = () => {
    const currentConditions = formData.conditions.attribute_conditions || [];
    handleConditionChange('attribute_conditions', [...currentConditions, { attribute_code: '', attribute_value: '' }]);
  };

  const removeAttributeCondition = (index) => {
    const currentConditions = formData.conditions.attribute_conditions || [];
    handleConditionChange('attribute_conditions', currentConditions.filter((_, i) => i !== index));
  };

  const updateAttributeCondition = (index, field, value) => {
    const currentConditions = formData.conditions.attribute_conditions || [];
    const updatedConditions = [...currentConditions];
    updatedConditions[index] = {
      ...updatedConditions[index],
      [field]: value,
      // Reset attribute_value when attribute_code changes
      ...(field === 'attribute_code' ? { attribute_value: '' } : {})
    };
    handleConditionChange('attribute_conditions', updatedConditions);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isFormValid) {
      showWarning('Please fill in all required fields: Rule Name is required.');
      return;
    }

    // Validate attribute conditions - check for empty text values
    const attributeConditions = formData.conditions.attribute_conditions || [];
    for (let i = 0; i < attributeConditions.length; i++) {
      const condition = attributeConditions[i];
      const selectedAttr = attributes.find(attr => attr.code === condition.attribute_code);

      // Check if attribute is text type and value is empty
      if (selectedAttr && selectedAttr.type === 'text' && !condition.attribute_value?.trim()) {
        showWarning(`Please provide a value for the text attribute "${getAttributeLabel(selectedAttr, currentLanguage)}" in Specific Attribute Values.`);
        return;
      }

      // Also check if any attribute condition is incomplete
      if (!condition.attribute_code || !condition.attribute_value?.trim()) {
        showWarning('Please complete all attribute conditions or remove incomplete ones.');
        return;
      }
    }

    setSaveSuccess(false);
    setLoading(true);

    try {
      await onSubmit(formData);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      console.error("Error submitting form:", error);
    } finally {
      setLoading(false);
    }
  };

  const getSelectedCategoryNames = () => {
    if (!Array.isArray(categories)) return [];
    return categories.filter(cat => cat && formData.conditions.categories?.includes(cat.id)).map(cat => cat.name);
  };

  const getSelectedAttributeSetNames = () => {
    if (!Array.isArray(attributeSets)) return [];
    return attributeSets.filter(set => set && formData.conditions.attribute_sets?.includes(set.id)).map(set => set.name);
  };

  const getSelectableAttributes = () => {
    if (!Array.isArray(attributes)) return [];
    const usableAttributes = attributes.filter(attr => attr && attr.is_usable_in_conditions);

    // Fallback to all attributes if no attributes are marked as usable
    // Also show all attributes if they exist but none have is_usable_in_conditions = true
    return usableAttributes.length > 0 ? usableAttributes : attributes.slice(0, 20); // Limit to first 20 to prevent UI issues
  };

  const getAttributeOptions = (attributeCode) => {
    if (!Array.isArray(attributes)) return [];
    const attribute = attributes.find(attr => attr && attr.code === attributeCode);
    return attribute?.options || [];
  };

  const isAttributeConditionInvalid = (condition) => {
    if (!condition.attribute_code) return false;

    const selectedAttr = attributes.find(attr => attr.code === condition.attribute_code);
    if (!selectedAttr) return false;

    // For text type attributes, value cannot be empty
    if (selectedAttr.type === 'text' && !condition.attribute_value?.trim()) {
      return true;
    }

    return false;
  };

  const renderConditionValueInput = (condition, index) => {
    const selectedAttr = attributes.find(attr => attr.code === condition.attribute_code);
    const hasOptions = selectedAttr && (selectedAttr.type === 'select' || selectedAttr.type === 'multiselect') && selectedAttr.options?.length > 0;
    const isInvalid = isAttributeConditionInvalid(condition);

    if (hasOptions) {
      return (
        <Select
          value={condition.attribute_value}
          onValueChange={(value) => updateAttributeCondition(index, 'attribute_value', value)}
        >
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Select value" />
          </SelectTrigger>
          <SelectContent>
            {selectedAttr.options.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    return (
      <div className="flex-1">
        <Input
          placeholder="Value"
          value={condition.attribute_value}
          onChange={(e) => updateAttributeCondition(index, 'attribute_value', e.target.value)}
          className={`w-full ${isInvalid ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
        />
        {isInvalid && (
          <p className="text-xs text-red-600 mt-1">Value is required for text attributes</p>
        )}
      </div>
    );
  };

  // Check if rule has any conditions set (for UI display purposes)
  const hasAnyConditions = () => {
    const { categories, attribute_sets, skus, attribute_conditions } = formData.conditions || {};
    return (
      (categories && categories.length > 0) ||
      (attribute_sets && attribute_sets.length > 0) ||
      (skus && skus.length > 0) ||
      (attribute_conditions && attribute_conditions.length > 0)
    );
  };

  const isFormValid = formData.name && formData.store_id;


  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <p className="text-sm text-gray-600">
            Configure which custom options are available for products based on categories, attribute sets, or other conditions.
          </p>
        </CardHeader>
        <CardContent className="p-6 pt-0 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="name">Rule Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Enter rule name"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="display_label">Display Label *</Label>
                <Input
                  id="display_label"
                  value={formData.display_label}
                  onChange={(e) => handleInputChange('display_label', e.target.value)}
                  placeholder="Label shown to customers"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowTranslations(!showTranslations)}
                  className="text-sm text-blue-600 hover:text-blue-800 mt-1 flex items-center gap-1"
                >
                  <Languages className="w-4 h-4" />
                  {showTranslations ? 'Hide translations' : 'Manage translations'}
                </button>
              </div>
            </div>

            {showTranslations && (
              <Card className="border-blue-200 bg-blue-50">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Languages className="w-5 h-5" />
                    Display Label Translations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <TranslationFields
                    translations={formData.translations}
                    onChange={(newTranslations) => {
                      setFormData(prev => ({
                        ...prev,
                        translations: newTranslations,
                        // Sync main field with English translation
                        display_label: newTranslations.en?.display_label || prev.display_label
                      }));
                    }}
                    fields={[
                      { name: 'display_label', label: 'Display Label', type: 'text', required: true }
                    ]}
                  />
                  <p className="text-sm text-gray-600 mt-3">
                    Translate the label shown to customers when these custom options appear (e.g., "Custom Options", "Add-ons", "Extras")
                  </p>
                </CardContent>
              </Card>
            )}

            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => handleInputChange('is_active', checked)}
              />
              <Label htmlFor="is_active">Active</Label>
            </div>

            {/* Available Custom Options (Read-only display) */}
            <Card>
              <CardHeader>
                <CardTitle>Available Custom Options</CardTitle>
                <p className="text-sm text-gray-600">
                  Products with "Set as Custom Option" enabled will automatically appear when this rule's conditions are met.
                </p>
              </CardHeader>
              <CardContent>
                {loadingProducts ? (
                  <div className="text-center py-8 text-gray-500">Loading custom option products...</div>
                ) : customOptionProducts.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {customOptionProducts.map((product) => (
                      <div
                        key={product.id}
                        className="p-4 border rounded-lg border-gray-200 bg-gray-50"
                      >
                        <div className="flex items-center space-x-3">
                          <div>
                            <h4 className="font-medium">{product.name}</h4>
                            <p className="text-sm text-gray-500">SKU: {product.sku}</p>
                            <p className="text-sm font-medium text-green-600">${product.price}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No custom option products available.</p>
                    <p className="text-sm text-gray-400 mt-1">
                      Enable "Set as Custom Option" on products in the Product settings to make them available.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Conditions */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Conditions (Optional)</h3>
              <p className="text-sm text-gray-600">
                {hasAnyConditions()
                  ? "Custom options will appear on products matching these conditions."
                  : "No conditions set - custom options will appear on ALL products."
                }
              </p>

              {/* Categories */}
              <div>
                <Label>Categories</Label>
                <Popover open={showCategorySelect} onOpenChange={setShowCategorySelect}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className={`w-full justify-between ${formData.conditions.categories?.length ? '' : 'text-muted-foreground'}`}
                    >
                      {formData.conditions.categories?.length 
                        ? `${formData.conditions.categories.length} categories selected`
                        : "Select categories..."
                      }
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
                    <Command>
                      <CommandInput placeholder="Search categories..." />
                      <CommandEmpty>No categories found.</CommandEmpty>
                      <CommandList>
                        <CommandGroup>
                          {categories.map((category) => (
                            <CommandItem
                              key={category.id}
                              onSelect={() => handleMultiSelectToggle('categories', category.id)}
                            >
                              <Check
                                className={`mr-2 h-4 w-4 ${
                                  formData.conditions.categories?.includes(category.id) ? "opacity-100" : "opacity-0"
                                }`}
                              />
                              {category.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>

                {formData.conditions.categories?.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {getSelectedCategoryNames().map((name, index) => {
                      const categoryId = categories.find(c => c && c.name === name)?.id;
                      return (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {name}
                          <X
                            className="ml-1 h-3 w-3 cursor-pointer"
                            onClick={() => {
                              if (categoryId) handleMultiSelectToggle('categories', categoryId);
                            }}
                          />
                        </Badge>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Attribute Sets */}
              <div>
                <Label>Attribute Sets</Label>
                <Popover open={showAttributeSetSelect} onOpenChange={setShowAttributeSetSelect}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className={`w-full justify-between ${formData.conditions.attribute_sets?.length ? '' : 'text-muted-foreground'}`}
                    >
                      {formData.conditions.attribute_sets?.length 
                        ? `${formData.conditions.attribute_sets.length} attribute sets selected`
                        : "Select attribute sets..."
                      }
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
                    <Command>
                      <CommandInput placeholder="Search attribute sets..." />
                      <CommandEmpty>No attribute sets found.</CommandEmpty>
                      <CommandList>
                        <CommandGroup>
                          {attributeSets.map((set) => (
                            <CommandItem
                              key={set.id}
                              onSelect={() => handleMultiSelectToggle('attribute_sets', set.id)}
                            >
                              <Check
                                className={`mr-2 h-4 w-4 ${
                                  formData.conditions.attribute_sets?.includes(set.id) ? "opacity-100" : "opacity-0"
                                }`}
                              />
                              {set.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>

                {formData.conditions.attribute_sets?.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {getSelectedAttributeSetNames().map((name, index) => {
                      const setId = attributeSets.find(s => s && s.name === name)?.id;
                      return (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {name}
                          <X
                            className="ml-1 h-3 w-3 cursor-pointer"
                            onClick={() => {
                              if (setId) handleMultiSelectToggle('attribute_sets', setId);
                            }}
                          />
                        </Badge>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Attribute Conditions */}
              <div>
                <Label>Specific Attribute Values</Label>
                <p className="text-sm text-gray-500 mb-3">Show these custom options when products have specific attribute values</p>

                <div className="space-y-3">
                  {formData.conditions.attribute_conditions?.map((condition, index) => (
                    <div key={index} className="flex items-center space-x-2 p-3 border rounded-lg">
                      <Select
                        value={condition.attribute_code}
                        onValueChange={(value) => updateAttributeCondition(index, 'attribute_code', value)}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Select attribute" />
                        </SelectTrigger>
                        <SelectContent>
                          {getSelectableAttributes().map(attr => (
                            <SelectItem key={attr.id} value={attr.code}>
                              {getAttributeLabel(attr, currentLanguage)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {renderConditionValueInput(condition, index)}

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeAttributeCondition(index)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}

                  <Button
                    type="button"
                    variant="outline"
                    onClick={addAttributeCondition}
                    className="w-full"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Attribute Condition
                  </Button>
                </div>
              </div>

              {/* SKUs */}
              <div>
                <Label>SKUs</Label>
                <div className="space-y-2">
                  {formData.conditions.skus?.map((sku, index) => (
                    <div key={index} className="flex items-center justify-between gap-2 p-2 bg-gray-50 rounded">
                      <span className="text-sm font-mono">{sku}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSkuRemove(sku)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}

                  <div className="flex gap-2">
                    <Input
                      id="skus"
                      value={skuInput}
                      onChange={(e) => setSkuInput(e.target.value)}
                      onKeyPress={handleSkuKeyPress}
                      placeholder="Enter SKU and press Enter or click Add"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleSkuAdd}
                      disabled={!skuInput.trim()}
                    >
                      Add
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Add individual SKUs. SKUs can contain any characters including commas. Custom options will appear on products matching any of these SKUs.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-4 pt-6">
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <SaveButton
                type="submit"
                loading={loading}
                success={saveSuccess}
                disabled={!isFormValid}
                defaultText={rule ? "Update Rule" : "Create Rule"}
              />
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}