import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import SaveButton from '@/components/ui/save-button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CountrySelect } from '@/components/ui/country-select';
import { Textarea } from '@/components/ui/textarea';
import { Languages, X, ChevronsUpDown, Check, Plus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import TranslationFields from '@/components/admin/TranslationFields';
import { Category, AttributeSet, Attribute } from '@/api/entities';
import { useTranslation } from '@/contexts/TranslationContext';
import { getAttributeLabel, getAttributeValueLabel } from '@/utils/attributeUtils';

import { useAlertTypes } from '@/hooks/useAlert';
export default function ShippingMethodForm({ method, storeId, onSubmit, onCancel }) {
  const { showError, showWarning, showInfo, showSuccess, AlertComponent } = useAlertTypes();
  const { currentLanguage } = useTranslation();
  const [showTranslations, setShowTranslations] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_active: true,
    type: 'flat_rate',
    flat_rate_cost: 0,
    free_shipping_min_order: 0,
    weight_ranges: [],
    price_ranges: [],
    availability: 'all',
    countries: [],
    min_delivery_days: 1,
    max_delivery_days: 7,
    sort_order: 0,
    conditions: {
      categories: [],
      attribute_sets: [],
      skus: [],
      attribute_conditions: []
    },
    translations: {}
  });

  const [loading, setLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Conditions data
  const [categories, setCategories] = useState([]);
  const [attributeSets, setAttributeSets] = useState([]);
  const [attributes, setAttributes] = useState([]);
  const [showCategorySelect, setShowCategorySelect] = useState(false);
  const [showAttributeSetSelect, setShowAttributeSetSelect] = useState(false);
  const [skuInput, setSkuInput] = useState('');

  useEffect(() => {
    if (method) {
      let translations = method.translations || {};
      if (!translations.en) {
        translations.en = {
          name: method.name || '',
          description: method.description || ''
        };
      }

      // Parse conditions if it's a string
      let conditions = method.conditions || {};
      if (typeof conditions === 'string') {
        try {
          conditions = JSON.parse(conditions);
        } catch (e) {
          conditions = {};
        }
      }

      // Ensure conditions has all required fields
      conditions = {
        categories: conditions.categories || [],
        attribute_sets: conditions.attribute_sets || [],
        skus: conditions.skus || [],
        attribute_conditions: conditions.attribute_conditions || []
      };

      setFormData({
        name: method.name || '',
        description: method.description || '',
        is_active: method.is_active !== false,
        type: method.type || 'flat_rate',
        flat_rate_cost: method.flat_rate_cost || 0,
        free_shipping_min_order: method.free_shipping_min_order || 0,
        weight_ranges: method.weight_ranges || [],
        price_ranges: method.price_ranges || [],
        availability: method.availability || 'all',
        countries: Array.isArray(method.countries) ? method.countries : [],
        min_delivery_days: method.min_delivery_days || 1,
        max_delivery_days: method.max_delivery_days || 7,
        sort_order: method.sort_order || 0,
        conditions: conditions,
        translations: translations
      });
    }
  }, [method]);

  useEffect(() => {
    const loadConditionsData = async () => {
      if (!storeId) return;

      try {
        const [attributeSetsData, attributesData, categoriesData] = await Promise.all([
          AttributeSet.filter({ store_id: storeId }).catch(() => []),
          Attribute.filter({ store_id: storeId }).catch(() => []),
          Category.filter({ store_id: storeId }).catch(() => [])
        ]);

        // Transform attribute values into options format
        const transformedAttributes = (attributesData || []).map(attr => {
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
        console.error("Error loading conditions data:", error);
        setAttributeSets([]);
        setAttributes([]);
        setCategories([]);
      }
    };

    loadConditionsData();
  }, [storeId, currentLanguage]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!storeId) {
      showWarning('No store selected');
      return;
    }

    setSaveSuccess(false);
    setLoading(true);
    try {
      await onSubmit({ ...formData, store_id: storeId });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      console.error('Error submitting shipping method:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const addWeightRange = () => {
    setFormData(prev => ({
      ...prev,
      weight_ranges: [...prev.weight_ranges, { min_weight: 0, max_weight: 0, cost: 0 }]
    }));
  };

  const updateWeightRange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      weight_ranges: prev.weight_ranges.map((range, i) => 
        i === index ? { ...range, [field]: parseFloat(value) || 0 } : range
      )
    }));
  };

  const removeWeightRange = (index) => {
    setFormData(prev => ({
      ...prev,
      weight_ranges: prev.weight_ranges.filter((_, i) => i !== index)
    }));
  };

  const addPriceRange = () => {
    setFormData(prev => ({
      ...prev,
      price_ranges: [...prev.price_ranges, { min_price: 0, max_price: 0, cost: 0 }]
    }));
  };

  const updatePriceRange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      price_ranges: prev.price_ranges.map((range, i) => 
        i === index ? { ...range, [field]: parseFloat(value) || 0 } : range
      )
    }));
  };

  const removePriceRange = (index) => {
    setFormData(prev => ({
      ...prev,
      price_ranges: prev.price_ranges.filter((_, i) => i !== index)
    }));
  };

  // Conditions handlers
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
    return usableAttributes.length > 0 ? usableAttributes : attributes.slice(0, 20);
  };

  const renderConditionValueInput = (condition, index) => {
    const selectedAttr = attributes.find(attr => attr.code === condition.attribute_code);
    const hasOptions = selectedAttr && (selectedAttr.type === 'select' || selectedAttr.type === 'multiselect') && selectedAttr.options?.length > 0;

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
      <Input
        placeholder="Value"
        value={condition.attribute_value}
        onChange={(e) => updateAttributeCondition(index, 'attribute_value', e.target.value)}
        className="flex-1"
      />
    );
  };

  const renderTypeSpecificFields = () => {
    switch (formData.type) {
      case 'flat_rate':
        return (
          <div>
            <Label htmlFor="flat_rate_cost">Flat Rate Cost ($) *</Label>
            <Input
              id="flat_rate_cost"
              type="number"
              step="0.01"
              min="0"
              value={formData.flat_rate_cost}
              onChange={(e) => handleInputChange('flat_rate_cost', parseFloat(e.target.value) || 0)}
              placeholder="e.g., 9.99"
              required
            />
          </div>
        );

      case 'free_shipping':
        return (
          <div>
            <Label htmlFor="free_shipping_min_order">Minimum Order Amount for Free Shipping ($)</Label>
            <Input
              id="free_shipping_min_order"
              type="number"
              step="0.01"
              min="0"
              value={formData.free_shipping_min_order}
              onChange={(e) => handleInputChange('free_shipping_min_order', parseFloat(e.target.value) || 0)}
              placeholder="e.g., 50.00"
            />
            <p className="text-sm text-gray-500 mt-1">
              Orders above this amount will qualify for free shipping. Set to 0 for always free.
            </p>
          </div>
        );

      case 'weight_based':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Weight-Based Pricing</Label>
              <Button type="button" onClick={addWeightRange} size="sm">
                Add Weight Range
              </Button>
            </div>
            {formData.weight_ranges.map((range, index) => (
              <div key={index} className="grid grid-cols-4 gap-2 items-end p-3 border rounded">
                <div>
                  <Label className="text-xs">Min Weight (kg)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    value={range.min_weight}
                    onChange={(e) => updateWeightRange(index, 'min_weight', e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Max Weight (kg)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    value={range.max_weight}
                    onChange={(e) => updateWeightRange(index, 'max_weight', e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Cost ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={range.cost}
                    onChange={(e) => updateWeightRange(index, 'cost', e.target.value)}
                  />
                </div>
                <Button 
                  type="button" 
                  variant="destructive" 
                  size="sm" 
                  onClick={() => removeWeightRange(index)}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        );

      case 'price_based':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Price-Based Shipping</Label>
              <Button type="button" onClick={addPriceRange} size="sm">
                Add Price Range
              </Button>
            </div>
            {formData.price_ranges.map((range, index) => (
              <div key={index} className="grid grid-cols-4 gap-2 items-end p-3 border rounded">
                <div>
                  <Label className="text-xs">Min Order Value ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={range.min_price}
                    onChange={(e) => updatePriceRange(index, 'min_price', e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Max Order Value ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={range.max_price}
                    onChange={(e) => updatePriceRange(index, 'max_price', e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Shipping Cost ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={range.cost}
                    onChange={(e) => updatePriceRange(index, 'cost', e.target.value)}
                  />
                </div>
                <Button 
                  type="button" 
                  variant="destructive" 
                  size="sm" 
                  onClick={() => removePriceRange(index)}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{method ? 'Edit Shipping Method' : 'Add New Shipping Method'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">

          <div>
            <Label htmlFor="name">Method Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => {
                const newName = e.target.value;
                setFormData(prev => ({
                  ...prev,
                  name: newName,
                  translations: {
                    ...prev.translations,
                    en: { ...prev.translations.en, name: newName }
                  }
                }));
              }}
              placeholder="e.g., Standard Shipping, Express Delivery"
              required
            />
            <button
              type="button"
              onClick={() => setShowTranslations(!showTranslations)}
              className="text-sm text-blue-600 hover:text-blue-800 mt-1 inline-flex items-center gap-1"
            >
              <Languages className="w-4 h-4" />
              {showTranslations ? 'Hide translations' : 'Manage translations'}
            </button>
          </div>

          {showTranslations && (
            <div className="border-2 border-blue-200 bg-blue-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-4">
                <Languages className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-semibold text-blue-900">Shipping Method Translations</h3>
              </div>
              <TranslationFields
                translations={formData.translations}
                onChange={(newTranslations) => {
                  setFormData(prev => ({
                    ...prev,
                    translations: newTranslations,
                    name: newTranslations.en?.name || prev.name,
                    description: newTranslations.en?.description || prev.description
                  }));
                }}
                fields={[
                  { name: 'name', label: 'Method Name', type: 'text', required: true },
                  { name: 'description', label: 'Description', type: 'textarea', rows: 3, required: false }
                ]}
              />
            </div>
          )}

          {!showTranslations && (
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => {
                  const newDescription = e.target.value;
                  setFormData(prev => ({
                    ...prev,
                    description: newDescription,
                    translations: {
                      ...prev.translations,
                      en: { ...prev.translations.en, description: newDescription }
                    }
                  }));
                }}
                placeholder="Brief description of this shipping method"
                rows={3}
              />
            </div>
          )}

          <div className="flex items-center space-x-2">
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => handleInputChange('is_active', checked)}
            />
            <Label htmlFor="is_active">Active</Label>
          </div>

          <div>
            <Label htmlFor="type">Shipping Type *</Label>
            <Select
              value={formData.type}
              onValueChange={(value) => handleInputChange('type', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="flat_rate">Flat Rate</SelectItem>
                <SelectItem value="free_shipping">Free Shipping</SelectItem>
                <SelectItem value="weight_based">Weight Based</SelectItem>
                <SelectItem value="price_based">Price Based</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {renderTypeSpecificFields()}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="min_delivery_days">Min Delivery Days</Label>
              <Input
                id="min_delivery_days"
                type="number"
                min="1"
                value={formData.min_delivery_days}
                onChange={(e) => handleInputChange('min_delivery_days', parseInt(e.target.value) || 1)}
              />
            </div>
            <div>
              <Label htmlFor="max_delivery_days">Max Delivery Days</Label>
              <Input
                id="max_delivery_days"
                type="number"
                min="1"
                value={formData.max_delivery_days}
                onChange={(e) => handleInputChange('max_delivery_days', parseInt(e.target.value) || 7)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="sort_order">Sort Order</Label>
            <Input
              id="sort_order"
              type="number"
              min="0"
              value={formData.sort_order}
              onChange={(e) => handleInputChange('sort_order', parseInt(e.target.value) || 0)}
              placeholder="Order in which this method appears (0 = first)"
            />
          </div>

          <div>
            <Label htmlFor="availability">Availability</Label>
            <Select
              value={formData.availability}
              onValueChange={(value) => handleInputChange('availability', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Countries</SelectItem>
                <SelectItem value="specific_countries">Specific Countries</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.availability === 'specific_countries' && (
            <div>
              <Label htmlFor="countries">Allowed Countries</Label>
              <CountrySelect
                value={formData.countries}
                onChange={(countries) => handleInputChange('countries', countries)}
                multiple={true}
                placeholder="Select countries where this shipping method is available..."
              />
            </div>
          )}

          {/* Conditions (Optional) */}
          <div className="border-t pt-4 space-y-4">
            <div>
              <h3 className="text-lg font-medium mb-2">Conditions (Optional)</h3>
              <p className="text-sm text-gray-600">
                Optionally specify conditions to control when this shipping method is available. If no conditions are specified, the shipping method will always be available.
              </p>
            </div>

            {/* Categories */}
            <div>
              <Label>Categories</Label>
              <Popover open={showCategorySelect} onOpenChange={setShowCategorySelect}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
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
                    type="button"
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
              <p className="text-sm text-gray-500 mb-3">Show this shipping method when products have specific attribute values</p>

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
                Add individual SKUs. This shipping method will be available for products matching any of these SKUs.
              </p>
            </div>
          </div>

          <div className="flex justify-end space-x-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <SaveButton
              type="submit"
              loading={loading}
              success={saveSuccess}
              disabled={!storeId}
              defaultText={method ? "Update Method" : "Create Method"}
            />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}