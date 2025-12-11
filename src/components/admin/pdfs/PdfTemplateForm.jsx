import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import SaveButton from '@/components/ui/save-button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, RotateCcw, Copy, Check, Info, Languages } from 'lucide-react';
import TranslationFields from '@/components/admin/TranslationFields';
import { useStoreSelection } from '@/contexts/StoreSelectionContext.jsx';
import { toast } from 'sonner';
import api from '@/utils/api';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function PdfTemplateForm({ template, onSubmit, onCancel }) {
  const { getSelectedStoreId } = useStoreSelection();
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copiedVariable, setCopiedVariable] = useState(null);
  const [showTranslations, setShowTranslations] = useState(false);

  const [formData, setFormData] = useState({
    html_template: '',
    is_active: true,
    settings: {
      page_size: 'A4',
      orientation: 'portrait',
      margins: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px'
      }
    },
    translations: {
      en: {
        html_template: ''
      }
    }
  });

  useEffect(() => {
    if (template) {
      const translations = template.translations || { en: { html_template: '' } };

      setFormData({
        html_template: translations.en?.html_template || '',
        is_active: template.is_active !== false,
        settings: template.settings || {
          page_size: 'A4',
          orientation: 'portrait',
          margins: {
            top: '20px',
            right: '20px',
            bottom: '20px',
            left: '20px'
          }
        },
        translations
      });
    }
  }, [template]);

  const handleInputChange = (field, value) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };

      // Sync html_template field with en translations
      if (field === 'html_template') {
        updated.translations = {
          ...prev.translations,
          en: {
            ...prev.translations?.en,
            html_template: value
          }
        };
      }

      return updated;
    });
  };

  const handleTranslationsChange = (translations) => {
    setFormData(prev => ({
      ...prev,
      translations
    }));
  };

  const handleSettingsChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        [field]: value
      }
    }));
  };

  const handleMarginChange = (side, value) => {
    setFormData(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        margins: {
          ...prev.settings.margins,
          [side]: value
        }
      }
    }));
  };

  const copyVariable = (variable) => {
    navigator.clipboard.writeText(variable);
    setCopiedVariable(variable);
    toast.success('Variable copied to clipboard');
    setTimeout(() => setCopiedVariable(null), 2000);
  };

  const handleRestoreDefault = async () => {
    if (!template || !template.is_system) return;

    if (!confirm('Are you sure you want to restore this PDF template to default? All customizations and translations will be lost.')) {
      return;
    }

    try {
      setSaving(true);
      const response = await api.post(`/pdf-templates/${template.id}/restore-default`);

      if (response && response.success) {
        toast.success('PDF template restored to default successfully');
        // Reload the template data
        const updated = await api.get(`/pdf-templates/${template.id}`);
        if (updated && updated.success && updated.data) {
          const translations = updated.data.translations || { en: { html_template: '' } };

          setFormData({
            html_template: translations.en?.html_template || '',
            is_active: updated.data.is_active !== false,
            settings: updated.data.settings || formData.settings,
            translations
          });
        }
      }
    } catch (error) {
      console.error('Restore error:', error);
      toast.error('Failed to restore template');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      await onSubmit(formData);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      console.error('Form submit error:', error);
    } finally {
      setSaving(false);
    }
  };

  // Get variables for this template type
  const getVariables = () => {
    if (template?.identifier === 'invoice_pdf') {
      return [
        { key: '{{invoice_number}}', desc: 'Invoice number' },
        { key: '{{invoice_date}}', desc: 'Invoice date' },
        { key: '{{order_number}}', desc: 'Order number' },
        { key: '{{customer_name}}', desc: 'Customer full name' },
        { key: '{{billing_address}}', desc: 'Billing address (formatted)' },
        { key: '{{shipping_address}}', desc: 'Shipping address (formatted)' },
        { key: '{{items_table_rows}}', desc: 'Order items as table rows' },
        { key: '{{order_subtotal}}', desc: 'Order subtotal' },
        { key: '{{order_shipping}}', desc: 'Shipping cost' },
        { key: '{{order_tax}}', desc: 'Tax amount' },
        { key: '{{order_discount}}', desc: 'Discount amount' },
        { key: '{{order_total}}', desc: 'Order total' },
        { key: '{{payment_method}}', desc: 'Payment method' },
        { key: '{{payment_status}}', desc: 'Payment status' },
        { key: '{{store_name}}', desc: 'Store name' },
        { key: '{{store_logo_url}}', desc: 'Store logo URL' },
        { key: '{{store_address}}', desc: 'Store street address' },
        { key: '{{store_city}}', desc: 'Store city' },
        { key: '{{store_state}}', desc: 'Store state' },
        { key: '{{store_postal_code}}', desc: 'Store postal code' },
        { key: '{{store_email}}', desc: 'Store email' },
        { key: '{{store_phone}}', desc: 'Store phone' },
        { key: '{{store_website}}', desc: 'Store website URL' },
        { key: '{{current_year}}', desc: 'Current year' }
      ];
    } else if (template?.identifier === 'shipment_pdf') {
      return [
        { key: '{{order_number}}', desc: 'Order number' },
        { key: '{{ship_date}}', desc: 'Shipment date' },
        { key: '{{tracking_number}}', desc: 'Tracking number' },
        { key: '{{tracking_url}}', desc: 'Tracking URL' },
        { key: '{{shipping_method}}', desc: 'Shipping method name' },
        { key: '{{estimated_delivery_date}}', desc: 'Estimated delivery' },
        { key: '{{delivery_instructions}}', desc: 'Special instructions' },
        { key: '{{shipping_address}}', desc: 'Shipping address (formatted)' },
        { key: '{{items_table_rows}}', desc: 'Shipped items as table rows' },
        { key: '{{items_count}}', desc: 'Total items count' },
        { key: '{{store_name}}', desc: 'Store name' },
        { key: '{{store_logo_url}}', desc: 'Store logo URL' },
        { key: '{{store_address}}', desc: 'Store street address' },
        { key: '{{store_city}}', desc: 'Store city' },
        { key: '{{store_state}}', desc: 'Store state' },
        { key: '{{store_postal_code}}', desc: 'Store postal code' },
        { key: '{{store_email}}', desc: 'Store email' },
        { key: '{{store_phone}}', desc: 'Store phone' },
        { key: '{{store_website}}', desc: 'Store website URL' },
        { key: '{{current_year}}', desc: 'Current year' }
      ];
    }
    return [];
  };

  const variables = getVariables();

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Template Info */}
      {template?.is_system && (
        <Alert className="border-blue-200 bg-blue-50">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-900">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300">
                System Template
              </Badge>
              <span className="text-sm">
                This is a system PDF template. You can customize it, but use "Restore to Default" to revert changes.
              </span>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>PDF Template Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Template Name</Label>
              <p className="text-sm font-medium text-gray-900 mt-1">{template?.name || 'New Template'}</p>
            </div>
            <div>
              <Label>Template Type</Label>
              <Badge variant="secondary" className="mt-1">
                {template?.template_type || 'N/A'}
              </Badge>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="is_active">Active</Label>
              <p className="text-xs text-gray-500">Enable this PDF template</p>
            </div>
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => handleInputChange('is_active', checked)}
            />
          </div>
          <div className="pt-2 border-t">
            <button
              type="button"
              onClick={() => setShowTranslations(!showTranslations)}
              className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              <Languages className="w-4 h-4" />
              {showTranslations ? 'Hide translations' : 'Manage translations'}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Translations Section - Inline like CMS Pages */}
      {showTranslations && (
        <div className="border-2 border-blue-200 bg-blue-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-4">
            <Languages className="w-5 h-5 text-blue-600" />
            <h3 className="text-base font-semibold text-blue-900">PDF Template Translations</h3>
          </div>
          <TranslationFields
            translations={formData.translations}
            onChange={(newTranslations) => {
              setFormData(prev => ({
                ...prev,
                translations: newTranslations,
                // Sync main field with English translation
                html_template: newTranslations.en?.html_template || prev.html_template
              }));
            }}
            fields={[
              { name: 'html_template', label: 'HTML Template', type: 'textarea', rows: 15, required: true }
            ]}
            storeId={getSelectedStoreId()}
            entityType="pdf_template"
          />
          <p className="text-sm text-gray-600 mt-3">
            Translate PDF template content for different languages. Use the magic wand to auto-translate from English.
          </p>
        </div>
      )}

      {/* PDF Settings */}
      <Card>
        <CardHeader>
          <CardTitle>PDF Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Page Size</Label>
              <select
                value={formData.settings.page_size}
                onChange={(e) => handleSettingsChange('page_size', e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="A4">A4</option>
                <option value="Letter">Letter</option>
                <option value="Legal">Legal</option>
              </select>
            </div>
            <div>
              <Label>Orientation</Label>
              <select
                value={formData.settings.orientation}
                onChange={(e) => handleSettingsChange('orientation', e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
              </select>
            </div>
          </div>

          <div>
            <Label>Margins</Label>
            <div className="grid grid-cols-4 gap-2 mt-2">
              <div>
                <input
                  type="text"
                  placeholder="Top"
                  value={formData.settings.margins?.top || '20px'}
                  onChange={(e) => handleMarginChange('top', e.target.value)}
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md"
                />
                <p className="text-xs text-gray-500 mt-1">Top</p>
              </div>
              <div>
                <input
                  type="text"
                  placeholder="Right"
                  value={formData.settings.margins?.right || '20px'}
                  onChange={(e) => handleMarginChange('right', e.target.value)}
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md"
                />
                <p className="text-xs text-gray-500 mt-1">Right</p>
              </div>
              <div>
                <input
                  type="text"
                  placeholder="Bottom"
                  value={formData.settings.margins?.bottom || '20px'}
                  onChange={(e) => handleMarginChange('bottom', e.target.value)}
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md"
                />
                <p className="text-xs text-gray-500 mt-1">Bottom</p>
              </div>
              <div>
                <input
                  type="text"
                  placeholder="Left"
                  value={formData.settings.margins?.left || '20px'}
                  onChange={(e) => handleMarginChange('left', e.target.value)}
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md"
                />
                <p className="text-xs text-gray-500 mt-1">Left</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* HTML Template Editor */}
      <Card>
        <CardHeader>
          <CardTitle>PDF Template HTML</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="html_template">HTML Template</Label>
            <Textarea
              id="html_template"
              value={formData.html_template}
              onChange={(e) => handleInputChange('html_template', e.target.value)}
              placeholder="Enter HTML template for PDF generation..."
              rows={20}
              className="font-mono text-sm"
            />
            <p className="text-xs text-gray-500">
              Use complete HTML including &lt;html&gt;, &lt;head&gt;, and &lt;body&gt; tags. Inline CSS works best for PDFs.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Available Variables */}
      {variables.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Available Variables</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {variables.map((variable) => (
                <div
                  key={variable.key}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer"
                  onClick={() => copyVariable(variable.key)}
                >
                  <div className="flex-1">
                    <code className="text-xs text-blue-600 font-mono">{variable.key}</code>
                    <p className="text-xs text-gray-500">{variable.desc}</p>
                  </div>
                  {copiedVariable === variable.key ? (
                    <Check className="w-4 h-4 text-green-600" />
                  ) : (
                    <Copy className="w-4 h-4 text-gray-400" />
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-3">Click to copy variable to clipboard</p>
          </CardContent>
        </Card>
      )}

      {/* PDF Template Tips */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="text-blue-900 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Using Header & Footer in PDFs
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="bg-white p-4 rounded-lg border border-blue-200">
            <h4 className="font-semibold text-blue-900 mb-2">📄 Shared Header & Footer</h4>
            <p className="text-gray-700 mb-2">PDF templates use the <strong>same header and footer</strong> as emails for consistent branding!</p>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <code className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-mono">{'{{email_header}}'}</code>
                <span className="text-gray-600">- Adds store branding (same as emails)</span>
              </div>
              <div className="flex items-start gap-2">
                <code className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-mono">{'{{email_footer}}'}</code>
                <span className="text-gray-600">- Adds footer with contact info (same as emails)</span>
              </div>
            </div>
            <p className="text-xs text-gray-600 mt-3 italic">
              💡 Tip: Edit email_header and email_footer templates to update both emails AND PDFs!
            </p>
          </div>

          <div className="bg-white p-3 rounded-lg border border-blue-200">
            <h4 className="font-semibold text-blue-900 mb-2">✏️ PDF Template Structure</h4>
            <div className="p-3 bg-gray-50 rounded border border-gray-200">
              <pre className="text-xs text-gray-700 overflow-x-auto">
{`<!DOCTYPE html>
<html>
<head>
  <style>/* Your CSS */</style>
</head>
<body>
  {{email_header}}

  <!-- Your PDF content with variables -->
  <div>{{invoice_number}}</div>

  {{email_footer}}
</body>
</html>`}
              </pre>
            </div>
          </div>

          <div className="bg-white p-3 rounded-lg border border-amber-200">
            <h4 className="font-semibold text-amber-900 mb-2">🎨 Styling Best Practices</h4>
            <ul className="list-disc list-inside space-y-1 text-gray-700 text-xs">
              <li>Use <strong>inline CSS</strong> for all styling</li>
              <li>Include complete HTML structure</li>
              <li>Use simple layouts (complex ones may not render correctly)</li>
              <li>Keep fonts system-standard (Arial, Helvetica, Times)</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Form Actions */}
      <div className="flex justify-between items-center pt-4 border-t">
        <div>
          {template?.is_system && (
            <Button
              type="button"
              variant="outline"
              onClick={handleRestoreDefault}
              disabled={saving}
              className="flex items-center gap-2 text-orange-600 border-orange-300 hover:bg-orange-50"
            >
              <RotateCcw className="w-4 h-4" />
              Restore to Default
            </Button>
          )}
        </div>
        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <SaveButton
            saving={saving}
            saveSuccess={saveSuccess}
            type="submit"
          >
            Update PDF Template
          </SaveButton>
        </div>
      </div>
    </form>
  );
}
