import React, { useState, useEffect } from 'react';
import { Store } from '@/api/entities';
import { useStoreSelection } from '@/contexts/StoreSelectionContext.jsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Receipt, Send, FileText, Package, AlertTriangle } from 'lucide-react';
import SaveButton from '@/components/ui/save-button';
import FlashMessage from '@/components/storefront/FlashMessage';
import { PageLoader } from '@/components/ui/page-loader';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const retryApiCall = async (apiCall, maxRetries = 3, delay = 1000) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await apiCall();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(res => setTimeout(res, delay));
    }
  }
};

export default function SalesSettings() {
  const { selectedStore, getSelectedStoreId } = useStoreSelection();
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [flashMessage, setFlashMessage] = useState(null);

  useEffect(() => {
    if (selectedStore) {
      loadStore();
    }
  }, [selectedStore]);

  const loadStore = async () => {
    try {
      setLoading(true);
      const storeId = getSelectedStoreId();

      if (!storeId || storeId === 'undefined') {
        setLoading(false);
        return;
      }

      const fullStoreResponse = await retryApiCall(() => Store.findById(storeId));
      const fullStoreResponse_normalized = Array.isArray(fullStoreResponse) ? fullStoreResponse[0] : fullStoreResponse;
      const responseData = fullStoreResponse_normalized?.data || fullStoreResponse_normalized;

      // Extract tenant data if present (API returns settings under tenantData)
      const fullStore = responseData?.tenantData || responseData;

      // Ensure settings.sales_settings exists with defaults
      const settings = fullStore?.settings || {};
      const salesSettings = settings.sales_settings || {
        auto_invoice_enabled: false,
        auto_invoice_pdf_enabled: false,
        auto_ship_enabled: false,
        auto_shipment_pdf_enabled: false,
        manual_invoice_send: true,
        manual_shipment_send: true,
        stock_issue_handling: 'manual_review', // 'manual_review' or 'auto_refund'
      };

      setStore({
        ...fullStore,
        id: fullStore?.id || storeId,
        settings: {
          ...settings,
          sales_settings: salesSettings
        }
      });

    } catch (error) {
      console.error("Failed to load store:", error);
      setFlashMessage({ type: 'error', message: 'Could not load sales settings.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (flashMessage) {
      const timer = setTimeout(() => setFlashMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [flashMessage]);

  const handleSalesSettingsChange = (key, value) => {
    setStore(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        sales_settings: {
          ...prev.settings.sales_settings,
          [key]: value
        }
      }
    }));
  };

  const handleSave = async () => {
    if (!store || !store.id) {
      setFlashMessage({ type: 'error', message: 'Store data not loaded. Cannot save.' });
      return;
    }

    setSaving(true);
    setSaveSuccess(false);

    try {
      const payload = {
        settings: {
          ...store.settings,
          sales_settings: {
            auto_invoice_enabled: store.settings.sales_settings.auto_invoice_enabled,
            auto_invoice_pdf_enabled: store.settings.sales_settings.auto_invoice_pdf_enabled,
            auto_ship_enabled: store.settings.sales_settings.auto_ship_enabled,
            auto_shipment_pdf_enabled: store.settings.sales_settings.auto_shipment_pdf_enabled,
            manual_invoice_send: store.settings.sales_settings.manual_invoice_send,
            manual_shipment_send: store.settings.sales_settings.manual_shipment_send,
            stock_issue_handling: store.settings.sales_settings.stock_issue_handling,
          }
        }
      };

      await retryApiCall(() => Store.updateSettings(store.id, payload));

      setFlashMessage({ type: 'success', message: 'Sales settings saved successfully!' });
      setSaveSuccess(true);

      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);

    } catch (error) {
      console.error('Failed to save sales settings:', error);
      setFlashMessage({ type: 'error', message: `Failed to save settings: ${error.message}` });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <PageLoader size="lg" />;
  }

  if (!store) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-700">
        Error: Store data could not be loaded or initialized.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <FlashMessage
        message={flashMessage}
        onClose={() => setFlashMessage(null)}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Sales Settings</h1>
          <p className="text-gray-600 mt-1">Configure invoice and shipment automation for your store</p>
        </div>

        {/* Auto-Invoice Settings */}
        <Card className="material-elevation-1 border-0 mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5" />
              Invoice Settings
            </CardTitle>
            <CardDescription>Configure automatic invoice generation and delivery</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-0.5">
                <Label htmlFor="auto_invoice_enabled" className="text-base">Auto-Generate Invoice</Label>
                <p className="text-sm text-gray-500">
                  Automatically generate invoices when orders are placed
                </p>
              </div>
              <Switch
                id="auto_invoice_enabled"
                checked={store?.settings?.sales_settings?.auto_invoice_enabled || false}
                onCheckedChange={(checked) => handleSalesSettingsChange('auto_invoice_enabled', checked)}
              />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-0.5">
                <Label htmlFor="auto_invoice_pdf_enabled" className="text-base">Include PDF Invoice</Label>
                <p className="text-sm text-gray-500">
                  Attach PDF invoice to automatic emails (requires PDF template in Content → Email)
                </p>
              </div>
              <Switch
                id="auto_invoice_pdf_enabled"
                checked={store?.settings?.sales_settings?.auto_invoice_pdf_enabled || false}
                onCheckedChange={(checked) => handleSalesSettingsChange('auto_invoice_pdf_enabled', checked)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-0.5">
                <Label htmlFor="manual_invoice_send" className="text-base">Manual Invoice Sending</Label>
                <p className="text-sm text-gray-500">
                  Allow manual sending of invoices from the orders page
                </p>
              </div>
              <Switch
                id="manual_invoice_send"
                checked={store?.settings?.sales_settings?.manual_invoice_send ?? true}
                onCheckedChange={(checked) => handleSalesSettingsChange('manual_invoice_send', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Auto-Ship Settings */}
        <Card className="material-elevation-1 border-0 mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="w-5 h-5" />
              Shipment Settings
            </CardTitle>
            <CardDescription>Configure automatic shipment notifications</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-0.5">
                <Label htmlFor="auto_ship_enabled" className="text-base">Auto-Send Shipment Notifications</Label>
                <p className="text-sm text-gray-500">
                  Automatically send shipment confirmation emails when orders are fulfilled
                </p>
              </div>
              <Switch
                id="auto_ship_enabled"
                checked={store?.settings?.sales_settings?.auto_ship_enabled || false}
                onCheckedChange={(checked) => handleSalesSettingsChange('auto_ship_enabled', checked)}
              />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-0.5">
                <Label htmlFor="auto_shipment_pdf_enabled" className="text-base">Include PDF Shipment</Label>
                <p className="text-sm text-gray-500">
                  Attach PDF shipment notice to automatic emails (requires PDF template in Content → PDF Templates)
                </p>
              </div>
              <Switch
                id="auto_shipment_pdf_enabled"
                checked={store?.settings?.sales_settings?.auto_shipment_pdf_enabled || false}
                onCheckedChange={(checked) => handleSalesSettingsChange('auto_shipment_pdf_enabled', checked)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-0.5">
                <Label htmlFor="manual_shipment_send" className="text-base">Manual Shipment Sending</Label>
                <p className="text-sm text-gray-500">
                  Allow manual sending of shipment notifications from the orders page
                </p>
              </div>
              <Switch
                id="manual_shipment_send"
                checked={store?.settings?.sales_settings?.manual_shipment_send ?? true}
                onCheckedChange={(checked) => handleSalesSettingsChange('manual_shipment_send', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Stock Issue Handling Settings */}
        <Card className="material-elevation-1 border-0 mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Stock Issue Handling
            </CardTitle>
            <CardDescription>Configure how to handle orders when stock is insufficient after payment</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-4 border rounded-lg bg-amber-50 border-amber-200">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                <div className="space-y-2">
                  <p className="text-sm text-amber-800">
                    <strong>When does this happen?</strong> In rare cases, two customers may checkout
                    with the same product simultaneously. If only one item is in stock, the second
                    order will have a stock issue after payment.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-base">When stock is insufficient after payment</Label>
              <Select
                value={store?.settings?.sales_settings?.stock_issue_handling || 'manual_review'}
                onValueChange={(value) => handleSalesSettingsChange('stock_issue_handling', value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select handling method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual_review">
                      <span className="font-medium">Manual Review</span>
                  </SelectItem>
                  <SelectItem value="auto_refund">
                    <div className="flex flex-col">
                      <span className="font-medium">Auto-Refund</span>
                      <span className="text-xs text-gray-500">Automatically refund via Stripe and notify customer</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-gray-500">
                {store?.settings?.sales_settings?.stock_issue_handling === 'auto_refund'
                  ? 'Orders with stock issues will be automatically refunded via Stripe and the customer will be notified.'
                  : 'Orders with stock issues will be flagged for your review. You can then choose to refund, wait for restock, or offer alternatives.'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Information Card */}
        <Card className="material-elevation-1 border-0 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-900">
              <FileText className="w-5 h-5" />
              Email Templates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-blue-800">
              To customize invoice and shipment emails, configure your email templates in{' '}
              <strong>Content → Email</strong>. You can create a PDF invoice template and customize
              the email content for invoices and shipment notifications.
            </p>
          </CardContent>
        </Card>

        <div className="flex justify-end mt-8">
          <SaveButton
            onClick={handleSave}
            loading={saving}
            success={saveSuccess}
            disabled={!store?.id}
            defaultText="Save Settings"
          />
        </div>
      </div>
    </div>
  );
}
