import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import SaveButton from '@/components/ui/save-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MultiSelect } from '@/components/ui/multi-select';
import { Languages } from 'lucide-react';
import TranslationFields from '@/components/admin/TranslationFields';
import { Category } from '@/api/entities';
import { Product } from '@/api/entities';
import { AttributeSet } from '@/api/entities';
import { Attribute } from '@/api/entities';
import { getProductName, getCategoryName } from '@/utils/translationUtils';

export default function CouponForm({ coupon, onSubmit, onCancel, storeId }) {
  const [showTranslations, setShowTranslations] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    discount_type: 'fixed',
    discount_value: 0,
    is_active: true,
    usage_limit: 100, // Default value
    usage_count: 0,
    min_purchase_amount: '',
    max_discount_amount: '',
    start_date: '',
    end_date: '',
    applicable_products: [],
    applicable_categories: [],
    applicable_skus: [],
    applicable_attribute_sets: [], // New field
    applicable_attributes: [], // New field
    buy_quantity: 1, // New field
    get_quantity: 1,  // New field
    translations: {}
  });

  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [attributeSets, setAttributeSets] = useState([]);
  const [attributes, setAttributes] = useState([]);
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    loadData();
  }, [storeId]);

  useEffect(() => {
    if (coupon) {
      let translations = coupon.translations || {};
      if (!translations.en) {
        translations.en = {
          name: coupon.name || '',
          description: coupon.description || ''
        };
      }

      setFormData({
        name: coupon.name || '',
        code: coupon.code || '',
        description: coupon.description || '',
        discount_type: coupon.discount_type || 'fixed',
        discount_value: coupon.discount_value || 0,
        is_active: coupon.is_active !== undefined ? coupon.is_active : true,
        usage_limit: coupon.usage_limit || 100,
        usage_count: coupon.usage_count || 0,
        min_purchase_amount: coupon.min_purchase_amount || '',
        max_discount_amount: coupon.max_discount_amount || '',
        start_date: coupon.start_date ? coupon.start_date.split('T')[0] : '',
        end_date: coupon.end_date ? coupon.end_date.split('T')[0] : '',
        applicable_products: coupon.applicable_products || [],
        applicable_categories: coupon.applicable_categories || [],
        applicable_skus: coupon.applicable_skus || [],
        applicable_attribute_sets: coupon.applicable_attribute_sets || [],
        applicable_attributes: coupon.applicable_attributes || [],
        buy_quantity: coupon.buy_quantity || 1,
        get_quantity: coupon.get_quantity || 1,
        translations: translations
      });
    }
  }, [coupon]);

  const loadData = async () => {
    if (!storeId) return;

    try {
      const [categoriesData, productsData, attributeSetsData, attributesData] = await Promise.all([
        Category.findAll({ store_id: storeId }),
        Product.filter({ store_id: storeId }),
        AttributeSet.filter({ store_id: storeId }),
        Attribute.filter({ store_id: storeId })
      ]);

      setCategories(categoriesData || []);
      setProducts(productsData || []);
      setAttributeSets(attributeSetsData || []);
      setAttributes(attributesData || []);
    } catch (error) {
      console.error('Error loading coupon form data:', error);
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.code.trim()) newErrors.code = 'Code is required';
    if (!formData.discount_value || formData.discount_value <= 0) {
      newErrors.discount_value = 'Discount value must be greater than 0';
    }
    if (formData.usage_limit && formData.usage_limit <= 0) {
      newErrors.usage_limit = 'Usage limit must be greater than 0';
    }
    if (formData.min_purchase_amount && formData.min_purchase_amount < 0) {
      newErrors.min_purchase_amount = 'Minimum purchase amount cannot be negative';
    }
    if (formData.max_discount_amount && formData.max_discount_amount < 0) {
      newErrors.max_discount_amount = 'Maximum discount amount cannot be negative';
    }
    if (formData.discount_type === 'buy_x_get_y') {
      if (!formData.buy_quantity || formData.buy_quantity <= 0) {
        newErrors.buy_quantity = 'Buy quantity is required for Buy X Get Y offers';
      }
      if (!formData.get_quantity || formData.get_quantity <= 0) {
        newErrors.get_quantity = 'Get quantity is required for Buy X Get Y offers';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const submitData = { ...formData };

    // Convert empty strings to null for optional numeric fields
    if (submitData.min_purchase_amount === '') submitData.min_purchase_amount = null;
    if (submitData.max_discount_amount === '') submitData.max_discount_amount = null;
    if (submitData.usage_limit === '') submitData.usage_limit = null;

    // Convert dates to ISO format or null if empty
    if (submitData.start_date) {
      const startDate = new Date(submitData.start_date);
      submitData.start_date = isNaN(startDate.getTime()) ? null : startDate.toISOString();
    } else {
      submitData.start_date = null;
    }

    if (submitData.end_date) {
      const endDate = new Date(submitData.end_date);
      submitData.end_date = isNaN(endDate.getTime()) ? null : endDate.toISOString();
    } else {
      submitData.end_date = null;
    }

    if (coupon?.id) {
      submitData.id = coupon.id;
    }

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      await onSubmit(submitData);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      console.error('Error saving coupon:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const categoryOptions = categories.map(cat => ({ value: cat.id, label: getCategoryName(cat) || cat.name || `Category ${cat.id}` }));
  const productOptions = products.map(prod => ({ value: prod.id, label: `${getProductName(prod) || prod.sku || 'Unnamed Product'} (${prod.sku})` }));
  const attributeSetOptions = attributeSets.map(set => ({ value: set.id, label: set.name }));
  const attributeOptions = attributes.map(attr => ({ value: attr.id, label: `${attr.label || attr.code} (${attr.code})` }));

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Name *</Label>
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
                className={errors.name ? 'border-red-500' : ''}
              />
              {errors.name && <p className="text-sm text-red-500 mt-1">{errors.name}</p>}
              <button
                type="button"
                onClick={() => setShowTranslations(!showTranslations)}
                className="text-sm text-blue-600 hover:text-blue-800 mt-1 inline-flex items-center gap-1"
              >
                <Languages className="w-4 h-4" />
                {showTranslations ? 'Hide translations' : 'Manage translations'}
              </button>
            </div>
            <div>
              <Label htmlFor="code">Coupon Code *</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }));
                }}
                className={errors.code ? 'border-red-500' : ''}
              />
              {errors.code && <p className="text-sm text-red-500 mt-1">{errors.code}</p>}
            </div>
          </div>

          {showTranslations && (
            <div className="border-2 border-blue-200 bg-blue-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-4">
                <Languages className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-semibold text-blue-900">Coupon Translations</h3>
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
                  { name: 'name', label: 'Coupon Name', type: 'text', required: true },
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
                rows={3}
              />
            </div>
          )}

          <div className="flex items-center space-x-2">
            <Checkbox
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
            />
            <Label htmlFor="is_active">Active</Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Discount Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="discount_type">Discount Type</Label>
              <Select
                value={formData.discount_type}
                onValueChange={(value) => setFormData(prev => ({ ...prev, discount_type: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Fixed Amount</SelectItem>
                  <SelectItem value="percentage">Percentage</SelectItem>
                  <SelectItem value="buy_x_get_y">Buy X Get Y</SelectItem>
                  <SelectItem value="free_shipping">Free Shipping</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="discount_value">
                Discount Value * 
                {formData.discount_type === 'percentage' && ' (%)'}
                {formData.discount_type === 'fixed' && ' ($)'}
              </Label>
              <Input
                id="discount_value"
                type="number"
                step="0.01"
                value={formData.discount_value}
                onChange={(e) => setFormData(prev => ({ ...prev, discount_value: parseFloat(e.target.value) || 0 }))}
                className={errors.discount_value ? 'border-red-500' : ''}
                disabled={formData.discount_type === 'free_shipping'}
              />
              {errors.discount_value && <p className="text-sm text-red-500 mt-1">{errors.discount_value}</p>}
            </div>
          </div>

          {formData.discount_type === 'buy_x_get_y' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="buy_quantity">Buy Quantity *</Label>
                <Input
                  id="buy_quantity"
                  type="number"
                  min="1"
                  value={formData.buy_quantity}
                  onChange={(e) => setFormData(prev => ({ ...prev, buy_quantity: parseInt(e.target.value) || 1 }))}
                  className={errors.buy_quantity ? 'border-red-500' : ''}
                />
                {errors.buy_quantity && <p className="text-sm text-red-500 mt-1">{errors.buy_quantity}</p>}
              </div>
              <div>
                <Label htmlFor="get_quantity">Get Quantity *</Label>
                <Input
                  id="get_quantity"
                  type="number"
                  min="1"
                  value={formData.get_quantity}
                  onChange={(e) => setFormData(prev => ({ ...prev, get_quantity: parseInt(e.target.value) || 1 }))}
                  className={errors.get_quantity ? 'border-red-500' : ''}
                />
                {errors.get_quantity && <p className="text-sm text-red-500 mt-1">{errors.get_quantity}</p>}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Usage Limits & Conditions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="usage_limit">Usage Limit</Label>
              <Input
                id="usage_limit"
                type="number"
                min="1"
                value={formData.usage_limit}
                onChange={(e) => setFormData(prev => ({ ...prev, usage_limit: parseInt(e.target.value) || 100 }))}
                placeholder="100 (default)"
                className={errors.usage_limit ? 'border-red-500' : ''}
              />
              {errors.usage_limit && <p className="text-sm text-red-500 mt-1">{errors.usage_limit}</p>}
              <p className="text-sm text-gray-500 mt-1">Leave empty for unlimited usage</p>
            </div>
            <div>
              <Label htmlFor="min_purchase_amount">Min Purchase Amount ($)</Label>
              <Input
                id="min_purchase_amount"
                type="number"
                step="0.01"
                min="0"
                value={formData.min_purchase_amount}
                onChange={(e) => setFormData(prev => ({ ...prev, min_purchase_amount: e.target.value }))}
                placeholder="No minimum"
                className={errors.min_purchase_amount ? 'border-red-500' : ''}
              />
              {errors.min_purchase_amount && <p className="text-sm text-red-500 mt-1">{errors.min_purchase_amount}</p>}
              <p className="text-sm text-gray-500 mt-1">Leave empty for no limit</p>
            </div>
            <div>
              <Label htmlFor="max_discount_amount">Max Discount Amount ($)</Label>
              <Input
                id="max_discount_amount"
                type="number"
                step="0.01"
                min="0"
                value={formData.max_discount_amount}
                onChange={(e) => setFormData(prev => ({ ...prev, max_discount_amount: e.target.value }))}
                placeholder="No maximum"
                className={errors.max_discount_amount ? 'border-red-500' : ''}
              />
              {errors.max_discount_amount && <p className="text-sm text-red-500 mt-1">{errors.max_discount_amount}</p>}
              <p className="text-sm text-gray-500 mt-1">Leave empty for no limit</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start_date">Start Date (Optional)</Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                placeholder="No start date"
              />
              <p className="text-sm text-gray-500 mt-1">Leave empty for immediate activation</p>
            </div>
            <div>
              <Label htmlFor="end_date">End Date (Optional)</Label>
              <Input
                id="end_date"
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                placeholder="No end date"
              />
              <p className="text-sm text-gray-500 mt-1">Leave empty for no expiration</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Applicability Rules</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Categories</Label>
            <MultiSelect
              options={categoryOptions}
              value={formData.applicable_categories}
              onChange={(value) => setFormData(prev => ({ ...prev, applicable_categories: value }))}
              placeholder="Select categories (leave empty for all)"
            />
          </div>

          <div>
            <Label>Attribute Sets</Label>
            <MultiSelect
              options={attributeSetOptions}
              value={formData.applicable_attribute_sets}
              onChange={(value) => setFormData(prev => ({ ...prev, applicable_attribute_sets: value }))}
              placeholder="Select attribute sets"
            />
          </div>

          <div>
            <Label>Attributes</Label>
            <MultiSelect
              options={attributeOptions}
              value={formData.applicable_attributes}
              onChange={(value) => setFormData(prev => ({ ...prev, applicable_attributes: value }))}
              placeholder="Select specific attributes"
            />
          </div>

          <div>
            <Label>Products</Label>
            <MultiSelect
              options={productOptions}
              value={formData.applicable_products}
              onChange={(value) => setFormData(prev => ({ ...prev, applicable_products: value }))}
              placeholder="Select specific products"
            />
          </div>

          <div>
            <Label htmlFor="applicable_skus">SKUs (comma-separated)</Label>
            <Input
              id="applicable_skus"
              value={formData.applicable_skus.join(', ')}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                applicable_skus: e.target.value.split(',').map(sku => sku.trim()).filter(Boolean)
              }))}
              placeholder="SKU1, SKU2, SKU3"
            />
            <p className="text-sm text-gray-500 mt-1">Enter specific SKUs separated by commas</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <SaveButton
          type="submit"
          loading={isSaving}
          success={saveSuccess}
          defaultText={coupon ? 'Update Coupon' : 'Create Coupon'}
          loadingText={coupon ? 'Updating...' : 'Creating...'}
          successText={coupon ? 'Updated!' : 'Created!'}
        />
      </div>
    </form>
  );
}