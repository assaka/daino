import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import SaveButton from '@/components/ui/save-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
// Simple collapsible components if not available in UI library
import { ChevronDown, ChevronRight, MapPin, Home, ShoppingCart, Package, CreditCard, Layout, ImagePlus, User, CheckCircle, Languages, Wand2 } from 'lucide-react';
import MediaBrowser from './MediaBrowser';
import TranslationFields from '@/components/admin/TranslationFields';
import { useStoreSelection } from '@/contexts/StoreSelectionContext.jsx';

import { useAlertTypes } from '@/hooks/useAlert';
export default function CmsBlockForm({ block, onSubmit, onCancel }) {
  const { showError, showWarning, showInfo, showSuccess, AlertComponent } = useAlertTypes();
  const { selectedStore } = useStoreSelection();
  const contentTextareaRef = useRef(null);
  const [showMediaBrowser, setShowMediaBrowser] = useState(false);
  const [showTranslations, setShowTranslations] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [hasManuallyEditedIdentifier, setHasManuallyEditedIdentifier] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    identifier: '',
    content: '',
    is_active: true,
    placement: ['content'], // Array of placement locations
    translations: {
      en: {
        title: '',
        content: ''
      }
    }
  });

  const [openSections, setOpenSections] = useState({
    global: true,
    homepage: false,
    product: false,
    category: false,
    cart: false,
    account: false,
    success: false
  });

  useEffect(() => {
    if (block) {

      // Initialize translations with existing data or empty structure
      const translations = block.translations || {
        en: {
          title: block.title || '',
          content: block.content || ''
        }
      };

      setFormData({
        title: translations.en?.title || block.title || '',
        identifier: block.identifier || '',
        content: translations.en?.content || block.content || '',
        is_active: block.is_active !== false,
        placement: Array.isArray(block.placement) ? block.placement :
                  typeof block.placement === 'string' ? [block.placement] : ['content'],
        translations: translations
      });

      // If block has an identifier, consider it manually set
      setHasManuallyEditedIdentifier(!!(block.identifier));
    } else {
      // For new blocks, reset the manual edit flag
      setHasManuallyEditedIdentifier(false);
    }
  }, [block]);

  const handleInputChange = (field, value) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };

      // Special handling for title to update identifier (only if not manually edited)
      if (field === 'title') {
        if (!hasManuallyEditedIdentifier) {
          const newIdentifier = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
          updated.identifier = newIdentifier;
        }

        // Bidirectional syncing: title ↔ translations.en
        updated.translations = {
          ...prev.translations,
          en: {
            ...prev.translations?.en,
            title: value
          }
        };
      } else if (field === 'identifier') {
        // Direct identifier edit
        setHasManuallyEditedIdentifier(true);
      } else if (field === 'content') {
        // Bidirectional syncing: content ↔ translations.en
        updated.translations = {
          ...prev.translations,
          en: {
            ...prev.translations?.en,
            content: value
          }
        };
      }

      return updated;
    });
  };

  const handlePlacementChange = (placement, checked) => {
    setFormData(prev => ({
      ...prev,
      placement: checked 
        ? [...prev.placement, placement]
        : prev.placement.filter(p => p !== placement)
    }));
  };

  const toggleSection = (section) => {
    setOpenSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleMediaInsert = (htmlContent) => {
    if (contentTextareaRef.current) {
      const textarea = contentTextareaRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const currentContent = formData.content || '';

      // Insert HTML at cursor position or replace selection
      const newContent =
        currentContent.substring(0, start) +
        htmlContent +
        currentContent.substring(end);

      // Update content AND sync to English translation to mark as changed
      setFormData(prev => ({
        ...prev,
        content: newContent,
        translations: {
          ...prev.translations,
          en: {
            ...prev.translations?.en,
            content: newContent
          }
        }
      }));

      // Set cursor position after inserted content
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + htmlContent.length;
        textarea.focus();
      }, 0);
    }
  };

  const placementSections = {
    global: {
      title: 'Global Positions',
      icon: Layout,
      description: 'Show on every page',
      options: [
        { value: 'header', label: 'Site Header', description: 'Top of every page' },
        { value: 'footer', label: 'Site Footer', description: 'Bottom of every page' },
        { value: 'sidebar', label: 'Sidebar', description: 'Side navigation area' },
        { value: 'before_content', label: 'Before Main Content', description: 'Above page content' },
        { value: 'content', label: 'Content Area', description: 'Within page content' },
        { value: 'after_content', label: 'After Main Content', description: 'Below page content' }
      ]
    },
    homepage: {
      title: 'Homepage',
      icon: Home,
      description: 'Homepage-specific locations',
      options: [
        { value: 'homepage_above_hero', label: 'Above Hero Section', description: 'Top banner area' },
        { value: 'homepage_hero', label: 'Hero Section', description: 'Main banner/hero area' },
        { value: 'homepage_below_hero', label: 'Below Hero Section', description: 'After main banner' },
        { value: 'homepage_above_featured', label: 'Above Featured Products', description: 'Before product showcase' },
        { value: 'homepage_below_featured', label: 'Below Featured Products', description: 'After product showcase' },
        { value: 'homepage_above_content', label: 'Above Main Content', description: 'Before homepage content' },
        { value: 'homepage_below_content', label: 'Below Main Content', description: 'After homepage content' }
      ]
    },
    product: {
      title: 'Product Pages',
      icon: Package,
      description: 'Individual product page locations',
      options: [
        { value: 'product_above_title', label: 'Above Product Title', description: 'Top of product info' },
        { value: 'product_below_title', label: 'Below Product Title', description: 'After product name' },
        { value: 'product_above_price', label: 'Above Price', description: 'Before pricing info' },
        { value: 'product_below_price', label: 'Below Price', description: 'After pricing info' },
        { value: 'product_above_cart_button', label: 'Above Add to Cart', description: 'Before purchase button' },
        { value: 'product_below_cart_button', label: 'Below Add to Cart', description: 'After purchase button' },
        { value: 'product_above_description', label: 'Above Description', description: 'Before product details' },
        { value: 'product_below_description', label: 'Below Description', description: 'After product details' }
      ]
    },
    category: {
      title: 'Category Pages',
      icon: MapPin,
      description: 'Product listing page locations',
      options: [
        { value: 'category_above_products', label: 'Above Product Grid', description: 'Before product listings' },
        { value: 'category_below_products', label: 'Below Product Grid', description: 'After product listings' },
        { value: 'category_above_filters', label: 'Above Filters', description: 'Before filter options' },
        { value: 'category_below_filters', label: 'Below Filters', description: 'After filter options' }
      ]
    },
    cart: {
      title: 'Cart & Checkout',
      icon: ShoppingCart,
      description: 'Shopping and payment pages',
      options: [
        { value: 'cart_above_items', label: 'Cart: Above Items', description: 'Before cart contents' },
        { value: 'cart_below_items', label: 'Cart: Below Items', description: 'After cart contents' },
        { value: 'cart_above_total', label: 'Cart: Above Total', description: 'Before cart summary' },
        { value: 'cart_below_total', label: 'Cart: Below Total', description: 'After cart summary' },
        { value: 'checkout_above_form', label: 'Checkout: Above Form', description: 'Before checkout form' },
        { value: 'checkout_below_form', label: 'Checkout: Below Form', description: 'After checkout form' },
        { value: 'checkout_above_payment', label: 'Checkout: Above Payment', description: 'Before payment section' },
        { value: 'checkout_below_payment', label: 'Checkout: Below Payment', description: 'After payment section' }
      ]
    },
    account: {
      title: 'Account Pages',
      icon: User,
      description: 'Customer account page locations',
      options: [
        { value: 'account_cms_above', label: 'Above Content', description: 'Full-width area above account content' },
        { value: 'account_cms_below', label: 'Below Content', description: 'Full-width area below account content' }
      ]
    },
    success: {
      title: 'Success Page',
      icon: CheckCircle,
      description: 'Order success/confirmation page',
      options: [
        { value: 'success_above_content', label: 'Above Content', description: 'Above order confirmation details' },
        { value: 'success_below_content', label: 'Below Content', description: 'Below order confirmation details' }
      ]
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate that at least one placement is selected
    if (formData.placement.length === 0) {
      showWarning('Please select at least one placement location for this block.');
      return;
    }

    try {
      setSaving(true);
      setSaveSuccess(false);

      // Prepare payload with translations
      const payload = {
        title: formData.title,
        identifier: formData.identifier,
        content: formData.content,
        is_active: formData.is_active,
        placement: formData.placement,
        translations: formData.translations || {
          en: {
            title: formData.title,
            content: formData.content
          }
        }
      };
      await onSubmit(payload);

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{block ? 'Edit CMS Block' : 'Create CMS Block'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="title">Block Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              placeholder="Enter block title"
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

            {showTranslations && (
              <div className="mt-4 border-2 border-blue-200 bg-blue-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Languages className="w-5 h-5 text-blue-600" />
                  <Wand2 className="w-5 h-5 text-purple-500" />
                  <h3 className="text-base font-semibold text-blue-900">Block Translations</h3>
                </div>
                <TranslationFields
                  translations={formData.translations}
                  onChange={(newTranslations) => {
                    setFormData(prev => ({
                      ...prev,
                      translations: newTranslations,
                      // Sync main fields with English translation
                      title: newTranslations.en?.title || prev.title,
                      content: newTranslations.en?.content || prev.content
                    }));
                  }}
                  fields={[
                    { name: 'title', label: 'Block Title', type: 'text', required: true },
                    { name: 'content', label: 'Block Content', type: 'textarea', rows: 8 }
                  ]}
                  storeId={selectedStore?.id}
                  entityType="cms_block"
                />
                <p className="text-sm text-gray-600 mt-3">
                  Translate block content to provide a localized experience for your customers
                </p>
              </div>
            )}
          </div>

          {/* Content field - Hidden when translations shown */}
          {!showTranslations && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label htmlFor="content">Content</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowMediaBrowser(true)}
                  className="flex items-center gap-2"
                >
                  <ImagePlus className="w-4 h-4" />
                  Insert Media
                </Button>
              </div>
              <Textarea
                ref={contentTextareaRef}
                id="content"
                value={formData.content}
                onChange={(e) => handleInputChange('content', e.target.value)}
                placeholder="Enter block content (HTML allowed)"
                rows={8}
              />
            </div>
          )}

          <div>
            <Label htmlFor="identifier">Identifier</Label>
            <Input
              id="identifier"
              value={formData.identifier}
              onChange={(e) => handleInputChange('identifier', e.target.value)}
              placeholder="unique-block-identifier"
            />
          </div>

          <div>
            <Label>Placement Locations</Label>
            <p className="text-sm text-gray-500 mb-4">Select where this block should appear on your store</p>
            
            <div className="space-y-3">
              {Object.entries(placementSections).map(([sectionKey, section]) => {
                const Icon = section.icon;
                const isOpen = openSections[sectionKey];
                const selectedCount = section.options.filter(option => 
                  formData.placement.includes(option.value)
                ).length;

                return (
                  <div key={sectionKey} className="border border-gray-200 rounded-lg">
                    <button
                      type="button"
                      onClick={() => toggleSection(sectionKey)}
                      className="flex items-center justify-between w-full p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <Icon className="w-5 h-5 text-gray-600" />
                        <div className="text-left">
                          <div className="font-medium text-gray-900">{section.title}</div>
                          <div className="text-sm text-gray-500">{section.description}</div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {selectedCount > 0 && (
                          <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full">
                            {selectedCount} selected
                          </span>
                        )}
                        {isOpen ? (
                          <ChevronDown className="w-4 h-4 text-gray-500" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-500" />
                        )}
                      </div>
                    </button>
                    {isOpen && (
                      <div className="px-3 pb-3">
                        <div className="grid grid-cols-1 gap-3 mt-3">
                          {section.options.map(option => (
                            <div key={option.value} className="flex items-start space-x-3 p-2 hover:bg-gray-50 rounded">
                              <Checkbox
                                id={`placement-${option.value}`}
                                checked={formData.placement.includes(option.value)}
                                onCheckedChange={(checked) => handlePlacementChange(option.value, checked)}
                                className="mt-1"
                              />
                              <div className="flex-1">
                                <Label htmlFor={`placement-${option.value}`} className="text-sm font-medium cursor-pointer">
                                  {option.label}
                                </Label>
                                <p className="text-xs text-gray-500 mt-1">{option.description}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            
            {formData.placement.length > 0 ? (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <h4 className="text-sm font-medium text-blue-900 mb-2">Selected Locations ({formData.placement.length})</h4>
                <div className="flex flex-wrap gap-2">
                  {formData.placement.map(placement => {
                    const option = Object.values(placementSections)
                      .flatMap(section => section.options)
                      .find(opt => opt.value === placement);
                    return (
                      <span key={placement} className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full">
                        {option?.label || placement}
                      </span>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  ⚠️ Please select at least one placement location where this block should appear.
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => handleInputChange('is_active', checked)}
            />
            <Label htmlFor="is_active">Active</Label>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <SaveButton
          type="submit"
          loading={saving}
          success={saveSuccess}
          defaultText={block ? "Update Block" : "Create Block"}
          loadingText={block ? "Updating..." : "Creating..."}
          successText={block ? "Updated!" : "Created!"}
        />
      </div>

      {/* Media Browser Dialog */}
      <MediaBrowser
        isOpen={showMediaBrowser}
        onClose={() => setShowMediaBrowser(false)}
        onInsert={handleMediaInsert}
        allowMultiple={true}
      />
    </form>
  );
}