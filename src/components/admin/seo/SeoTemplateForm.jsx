import React, { useState, useEffect } from 'react';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Info, ChevronDown, ChevronUp, X, ChevronsUpDown, Check, Save } from "lucide-react";
import { Category, AttributeSet, Attribute } from "@/api/entities";
import { useStoreSelection } from "@/contexts/StoreSelectionContext.jsx";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';

export default function SeoTemplateForm({ template, onSubmit, onCancel }) {
  const { getSelectedStoreId } = useStoreSelection();
  const [saving, setSaving] = useState(false);
  const [showVariables, setShowVariables] = useState(false);

  // Conditions data
  const [categories, setCategories] = useState([]);
  const [attributeSets, setAttributeSets] = useState([]);
  const [attributes, setAttributes] = useState([]);
  const [showCategorySelect, setShowCategorySelect] = useState(false);
  const [showAttributeSetSelect, setShowAttributeSetSelect] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    type: '',
    meta_title: '',
    meta_description: '',
    meta_keywords: '',
    meta_robots: '',
    conditions: {
      categories: [],
      attribute_sets: [],
      attribute_conditions: []
    }
  });

  // Initialize form with template data when editing
  useEffect(() => {
    if (template) {
      // Parse conditions if it's a string
      let conditions = template.conditions || {};
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
        attribute_conditions: conditions.attribute_conditions || []
      };

      setFormData({
        name: template.name || '',
        type: template.type || '',
        meta_title: template.template?.meta_title || template.meta_title || '',
        meta_description: template.template?.meta_description || template.meta_description || '',
        meta_keywords: template.template?.meta_keywords || template.meta_keywords || '',
        meta_robots: template.template?.meta_robots || template.meta_robots || '',
        conditions: conditions
      });
    } else {
      // Reset form for new template
      setFormData({
        name: '',
        type: '',
        meta_title: '',
        meta_description: '',
        meta_keywords: '',
        meta_robots: '',
        conditions: {
          categories: [],
          attribute_sets: [],
          attribute_conditions: []
        }
      });
    }
  }, [template]);

  // Load conditions data
  useEffect(() => {
    const loadConditionsData = async () => {
      const storeId = getSelectedStoreId();
      if (!storeId) return;

      try {
        const [attributeSetsData, attributesData, categoriesData] = await Promise.all([
          AttributeSet.filter({ store_id: storeId }).catch(() => []),
          Attribute.filter({ store_id: storeId }).catch(() => []),
          Category.filter({ store_id: storeId }).catch(() => [])
        ]);

        setAttributeSets(Array.isArray(attributeSetsData) ? attributeSetsData : []);
        setCategories(Array.isArray(categoriesData) ? categoriesData : []);

        // Transform attributes to include options for select/multiselect types
        const transformedAttributes = (Array.isArray(attributesData) ? attributesData : []).map(attr => ({
          ...attr,
          options: attr.values?.map(v => ({
            value: v.code,
            label: v.translations?.[0]?.value || v.code
          })) || []
        }));
        setAttributes(transformedAttributes);
      } catch (error) {
        console.error("Error loading conditions data:", error);
        setAttributeSets([]);
        setCategories([]);
        setAttributes([]);
      }
    };

    loadConditionsData();
  }, [getSelectedStoreId]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
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

  const getSelectedCategoryNames = () => {
    if (!Array.isArray(categories)) return [];
    return categories.filter(cat => cat && formData.conditions.categories?.includes(cat.id)).map(cat => cat.name);
  };

  const getSelectedAttributeSetNames = () => {
    if (!Array.isArray(attributeSets)) return [];
    return attributeSets.filter(set => set && formData.conditions.attribute_sets?.includes(set.id)).map(set => set.name);
  };

  // Attribute Conditions handlers
  const addAttributeCondition = () => {
    const currentConditions = formData.conditions.attribute_conditions || [];
    handleConditionChange('attribute_conditions',
      [...currentConditions, { attribute_code: '', attribute_value: '' }]);
  };

  const removeAttributeCondition = (index) => {
    const currentConditions = formData.conditions.attribute_conditions || [];
    handleConditionChange('attribute_conditions',
      currentConditions.filter((_, i) => i !== index));
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

  const getSelectableAttributes = () => {
    return attributes.filter(attr => attr && attr.code);
  };

  const getAttributeLabel = (attr) => {
    return attr.translations?.[0]?.value || attr.label || attr.code;
  };

  const renderConditionValueInput = (condition, index) => {
    const selectedAttr = attributes.find(attr => attr.code === condition.attribute_code);
    const hasOptions = selectedAttr &&
      (selectedAttr.type === 'select' || selectedAttr.type === 'multiselect') &&
      selectedAttr.options?.length > 0;

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

  const handleSubmit = async () => {
    const storeId = getSelectedStoreId();
    if (!storeId) return;

    // Validation
    if (!formData.type || !formData.meta_title) {
      return;
    }

    setSaving(true);
    try {
      // Build template JSON from form fields
      const templateData = {
        meta_title: formData.meta_title,
        meta_description: formData.meta_description,
        meta_keywords: formData.meta_keywords,
        meta_robots: formData.meta_robots
      };

      const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');

      const payload = {
        name: formData.name || (template ? template.name : `${formData.type} Template - ${timestamp}`),
        type: formData.type,
        template: templateData,
        conditions: formData.conditions,
        store_id: storeId
      };

      await onSubmit(payload);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="template-name">Template Name (Optional)</Label>
        <Input
          id="template-name"
          value={formData.name}
          onChange={(e) => handleInputChange('name', e.target.value)}
          placeholder="e.g., Product Page Template"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="page-type">Page Type *</Label>
        <Select
          value={formData.type}
          onValueChange={(value) => handleInputChange('type', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select page type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="product">Product Pages</SelectItem>
            <SelectItem value="category">Category Pages</SelectItem>
            <SelectItem value="cms_page">CMS Pages</SelectItem>
            <SelectItem value="homepage">Homepage</SelectItem>
            <SelectItem value="blog_post">Blog Posts</SelectItem>
            <SelectItem value="brand">Brand Pages</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="title-template">Meta Title Template *</Label>
        <Input
          id="title-template"
          value={formData.meta_title}
          onChange={(e) => handleInputChange('meta_title', e.target.value)}
          placeholder="{{product_name}} | {{store_name}}"
        />
      </div>

      {/* Variable Reference */}
      <Collapsible open={showVariables} onOpenChange={setShowVariables}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" size="sm" className="w-full">
            {showVariables ? <ChevronUp className="h-4 w-4 mr-2" /> : <ChevronDown className="h-4 w-4 mr-2" />}
            {showVariables ? 'Hide' : 'Show'} Available Variables
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2 p-4 border rounded bg-muted/50">
          <div className="space-y-3">
            <div>
              <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                <Info className="h-4 w-4" />
                Common Variables (All Page Types)
              </h4>
              <ul className="text-xs space-y-1 ml-6">
                <li><code className="bg-background px-1 py-0.5 rounded">{'{{store_name}}'}</code> - Your store name</li>
                <li><code className="bg-background px-1 py-0.5 rounded">{'{{store_description}}'}</code> - Store description</li>
                <li><code className="bg-background px-1 py-0.5 rounded">{'{{site_name}}'}</code> - Site name (same as store_name)</li>
                <li><code className="bg-background px-1 py-0.5 rounded">{'{{base_url}}'}</code> - Base URL of your site</li>
                <li><code className="bg-background px-1 py-0.5 rounded">{'{{current_url}}'}</code> - Current page URL</li>
                <li><code className="bg-background px-1 py-0.5 rounded">{'{{separator}}'}</code> - Title separator (e.g., |)</li>
                <li><code className="bg-background px-1 py-0.5 rounded">{'{{year}}'}</code> - Current year (e.g., 2025)</li>
                <li><code className="bg-background px-1 py-0.5 rounded">{'{{month}}'}</code> - Current month name</li>
                <li><code className="bg-background px-1 py-0.5 rounded">{'{{day}}'}</code> - Current day</li>
                <li><code className="bg-background px-1 py-0.5 rounded">{'{{currency}}'}</code> - Store currency</li>
                <li><code className="bg-background px-1 py-0.5 rounded">{'{{language_code}}'}</code> - Current language code</li>
              </ul>
            </div>

            {formData.type === 'product' && (
              <div>
                <h4 className="font-medium text-sm mb-2">Product Page Variables</h4>
                <ul className="text-xs space-y-1 ml-6">
                  <li><code className="bg-background px-1 py-0.5 rounded">{'{{product_name}}'}</code> - Product name (translated)</li>
                  <li><code className="bg-background px-1 py-0.5 rounded">{'{{product_description}}'}</code> - Product description</li>
                  <li><code className="bg-background px-1 py-0.5 rounded">{'{{category_name}}'}</code> - Product's category name</li>
                  <li><code className="bg-background px-1 py-0.5 rounded">{'{{sku}}'}</code> - Product SKU</li>
                  <li><code className="bg-background px-1 py-0.5 rounded">{'{{price}}'}</code> - Product price (formatted)</li>
                  <li><code className="bg-background px-1 py-0.5 rounded">{'{{brand}}'}</code> - Product brand</li>
                </ul>
              </div>
            )}

            {formData.type === 'category' && (
              <div>
                <h4 className="font-medium text-sm mb-2">Category Page Variables</h4>
                <ul className="text-xs space-y-1 ml-6">
                  <li><code className="bg-background px-1 py-0.5 rounded">{'{{category_name}}'}</code> - Category name (translated)</li>
                  <li><code className="bg-background px-1 py-0.5 rounded">{'{{category_description}}'}</code> - Category description</li>
                </ul>
              </div>
            )}

            {formData.type === 'cms_page' && (
              <div>
                <h4 className="font-medium text-sm mb-2">CMS Page Variables</h4>
                <ul className="text-xs space-y-1 ml-6">
                  <li><code className="bg-background px-1 py-0.5 rounded">{'{{page_title}}'}</code> - Page title</li>
                </ul>
              </div>
            )}

            <p className="text-xs text-muted-foreground mt-2">
              Tip: You can use both single and double curly braces (e.g., {'{product_name}'} or {'{{product_name}}'})
            </p>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <div className="space-y-2">
        <Label htmlFor="description-template">Meta Description Template</Label>
        <Textarea
          id="description-template"
          value={formData.meta_description}
          onChange={(e) => handleInputChange('meta_description', e.target.value)}
          placeholder="Shop {{name}} in {{category}}. {{description}}"
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="keywords-template">Meta Keywords Template</Label>
        <Input
          id="keywords-template"
          value={formData.meta_keywords}
          onChange={(e) => handleInputChange('meta_keywords', e.target.value)}
          placeholder="{{name}}, {{category}}, {{brand}}"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="meta-robots">Meta Robots</Label>
        <Select
          value={formData.meta_robots}
          onValueChange={(value) => handleInputChange('meta_robots', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select meta robots directive" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="index, follow">index, follow (Default - Allow indexing and crawling)</SelectItem>
            <SelectItem value="noindex, nofollow">noindex, nofollow (Block indexing and crawling)</SelectItem>
            <SelectItem value="index, nofollow">index, nofollow (Allow indexing, block crawling)</SelectItem>
            <SelectItem value="noindex, follow">noindex, follow (Block indexing, allow crawling)</SelectItem>
            <SelectItem value="none">none (Same as noindex, nofollow)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Conditions (Optional) */}
      <div className="border-t pt-4 space-y-4">
        <div>
          <h3 className="text-lg font-medium mb-2">Conditions (Optional)</h3>
          <p className="text-sm text-gray-600">
            Optionally specify conditions to control when this SEO template is applied. If no conditions are specified, the template will apply to all pages of the selected type.
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

        {/* Specific Attribute Values */}
        <div>
          <Label>Specific Attribute Values</Label>
          <p className="text-sm text-gray-500 mb-3">
            Apply this template when products have specific attribute values
          </p>

          <div className="space-y-3">
            {formData.conditions.attribute_conditions?.map((condition, index) => (
              <div key={index} className="flex items-center space-x-2 p-3 border rounded-lg">
                {/* Attribute Code Select */}
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
                        {getAttributeLabel(attr)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Attribute Value Input (dynamic based on attribute type) */}
                {renderConditionValueInput(condition, index)}

                {/* Remove Button */}
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

            {/* Add New Condition Button */}
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
      </div>

      {/* Form Actions */}
      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={saving || !formData.type || !formData.meta_title}
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
        >
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Saving...' : (template ? 'Update Template' : 'Create Template')}
        </Button>
      </div>
    </div>
  );
}
