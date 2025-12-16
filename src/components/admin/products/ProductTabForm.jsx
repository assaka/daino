import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import SaveButton from '@/components/ui/save-button';
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Languages } from "lucide-react";
import TranslationFields from "@/components/admin/TranslationFields";
import { useTranslation } from "@/contexts/TranslationContext";
import { getAttributeLabel } from "@/utils/attributeUtils";

export default function ProductTabForm({ tab, attributes = [], attributeSets = [], onSubmit, onCancel }) {
  const { currentLanguage } = useTranslation();
  const [formData, setFormData] = useState({
    name: "",
    tab_type: "text",
    content: "",
    attribute_ids: [],
    attribute_set_ids: [],
    sort_order: 0,
    is_active: true,
    translations: {},
  });
  const [loading, setLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showTranslations, setShowTranslations] = useState(false);

  useEffect(() => {
    if (tab) {

      // Handle translations with backward compatibility
      let translations = tab.translations || {};

      // Ensure English translation exists (backward compatibility)
      if (!translations.en || (!translations.en.name && tab.name)) {
        translations.en = {
          name: tab.name || "",
          content: tab.content || ""
        };
      }

      setFormData({
        name: translations.en?.name || "",
        tab_type: tab.tab_type || "text",
        content: translations.en?.content || "",
        attribute_ids: tab.attribute_ids || [],
        attribute_set_ids: tab.attribute_set_ids || [],
        sort_order: tab.sort_order || 0,
        is_active: tab.is_active ?? true,
        translations: translations,
      });
    }
  }, [tab]);

  const handleInputChange = (field, value) => {
    setFormData(prev => {
      const newState = {
        ...prev,
        [field]: value
      };

      // Sync main fields with English translation (bidirectional)
      if (field === "name") {
        newState.translations = {
          ...prev.translations,
          en: {
            ...prev.translations.en,
            name: value
          }
        };
      } else if (field === "content") {
        newState.translations = {
          ...prev.translations,
          en: {
            ...prev.translations.en,
            content: value
          }
        };
      }

      return newState;
    });
  };

  const handleArrayChange = (field, itemId, isChecked) => {
    setFormData(prev => ({
      ...prev,
      [field]: isChecked 
        ? [...prev[field], itemId]
        : prev[field].filter(id => id !== itemId)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaveSuccess(false);
    setLoading(true);

    try {
      const submitData = {
        ...formData,
        sort_order: parseInt(formData.sort_order) || 0
      };

      // If editing, include the ID
      if (tab && tab.id) {
        submitData.id = tab.id;
      }

      await onSubmit(submitData);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      console.error("Error submitting product tab:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card className="material-elevation-1 border-0">
        <CardContent className="space-y-4">
          <div className="pt-6">
            <Label htmlFor="name">Tab Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              placeholder="Enter tab name (e.g., Features, Specifications)"
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
            <p className="text-sm text-gray-500 mt-1">
              This will be displayed as the tab title on product pages
            </p>
          </div>

          {showTranslations && (
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Languages className="w-5 h-5" />
                  Tab Translations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <TranslationFields
                  translations={formData.translations}
                  onChange={(newTranslations) => {
                    setFormData(prev => ({
                      ...prev,
                      translations: newTranslations,
                      // Sync main fields with English translation
                      name: newTranslations.en?.name || prev.name,
                      content: newTranslations.en?.content || prev.content
                    }));
                  }}
                  fields={[
                    { name: 'name', label: 'Tab Name', type: 'text', required: true },
                    { name: 'content', label: 'Tab Content', type: 'textarea', rows: 6, condition: formData.tab_type === 'text' }
                  ]}
                  defaultLanguage="en"
                />
                <p className="text-sm text-gray-600 mt-3">
                  Note: Content translation only applies when Tab Type is "Text Content"
                </p>
              </CardContent>
            </Card>
          )}

          <div>
            <Label htmlFor="tab_type">Tab Type *</Label>
            <Select value={formData.tab_type} onValueChange={(value) => handleInputChange("tab_type", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select tab type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text Content</SelectItem>
                <SelectItem value="description">Product Description</SelectItem>
                <SelectItem value="attributes">Specific Attributes</SelectItem>
                <SelectItem value="attribute_set">Product Attributes</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-gray-500 mt-1">
              Choose how this tab will display content on product pages
            </p>
          </div>

          {formData.tab_type === 'text' && (
            <div>
              <Label htmlFor="content">Tab Content</Label>
              <Textarea
                id="content"
                value={formData.content}
                onChange={(e) => handleInputChange("content", e.target.value)}
                placeholder="Enter the content for this tab..."
                rows={8}
              />
              <p className="text-sm text-gray-500 mt-1">
                You can use HTML for formatting. This content will be displayed when the tab is clicked.
              </p>
            </div>
          )}

          {formData.tab_type === 'attributes' && (
            <div>
              <Label>Select Attributes</Label>
              <div className="border rounded-md mt-2">
                {attributes.length > 0 && (
                  <div className="flex items-center space-x-2 p-3 border-b bg-gray-50">
                    <Checkbox
                      id="select-all-attributes"
                      checked={attributes.length > 0 && formData.attribute_ids.length === attributes.length}
                      indeterminate={formData.attribute_ids.length > 0 && formData.attribute_ids.length < attributes.length}
                      onCheckedChange={(checked) => {
                        setFormData(prev => ({
                          ...prev,
                          attribute_ids: checked ? attributes.map(a => a.id) : []
                        }));
                      }}
                    />
                    <Label htmlFor="select-all-attributes" className="text-sm font-medium cursor-pointer">
                      {formData.attribute_ids.length === attributes.length ? 'Deselect All' : 'Select All'} ({formData.attribute_ids.length}/{attributes.length})
                    </Label>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3 max-h-60 overflow-y-auto p-3">
                {attributes.length > 0 ? (
                  attributes.map((attribute) => (
                    <div key={attribute.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`attr-${attribute.id}`}
                        checked={formData.attribute_ids.includes(attribute.id)}
                        onCheckedChange={(checked) => handleArrayChange("attribute_ids", attribute.id, checked)}
                      />
                      <Label htmlFor={`attr-${attribute.id}`} className="text-sm cursor-pointer">
                        {getAttributeLabel(attribute, currentLanguage)}
                      </Label>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 col-span-2">No attributes available</p>
                )}
                </div>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Selected attributes will be displayed in this tab for each product
              </p>
            </div>
          )}

          {(formData.tab_type === 'attribute_set' || formData.tab_type === 'attribute_sets') && (
            <div className="bg-blue-50 p-4 rounded-md">
              <p className="text-sm text-blue-800">
                This tab will automatically display all attributes from the product's attribute set. No additional configuration needed.
              </p>
            </div>
          )}

          {formData.tab_type === 'description' && (
            <div className="bg-blue-50 p-4 rounded-md">
              <p className="text-sm text-blue-800">
                This tab will automatically display the product's description. No additional configuration needed.
              </p>
            </div>
          )}

          <div>
            <Label htmlFor="sort_order">Sort Order</Label>
            <Input
              id="sort_order"
              type="number"
              value={formData.sort_order}
              onChange={(e) => handleInputChange("sort_order", e.target.value)}
              placeholder="0"
              min="0"
            />
            <p className="text-sm text-gray-500 mt-1">
              Lower numbers appear first. Use this to control tab order.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => handleInputChange("is_active", checked)}
            />
            <Label htmlFor="is_active">Active</Label>
          </div>

          <div className="flex justify-end space-x-4 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={loading}
            >
              Cancel
            </Button>
            <SaveButton
              type="submit"
              loading={loading}
              success={saveSuccess}
              disabled={!formData.name.trim()}
              defaultText={tab ? "Update Tab" : "Create Tab"}
            />
          </div>
        </CardContent>
      </Card>
    </form>
  );
}