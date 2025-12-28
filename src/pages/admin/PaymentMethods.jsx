import React, { useState, useEffect } from "react";
import { PaymentMethod } from "@/api/entities";
import { Category } from "@/api/entities";
import { AttributeSet } from "@/api/entities";
import { Attribute } from "@/api/entities";
import { Store } from "@/api/entities";
import { User } from "@/api/entities";
import { useStoreSelection } from "@/contexts/StoreSelectionContext.jsx";
import { useTranslation } from "@/contexts/TranslationContext";
import { getAttributeLabel, getAttributeValueLabel } from "@/utils/attributeUtils";
import { Button } from "@/components/ui/button";
import SaveButton from '@/components/ui/save-button';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Edit, Trash2, CreditCard, Banknote, CheckCircle, AlertCircle, Languages, X, ChevronsUpDown, Check, Building2, Truck, RefreshCw, ExternalLink, Unlink, Eye, EyeOff, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import apiClient from "@/api/client";
import { createStripeConnectAccount, createStripeConnectLink, checkStripeConnectStatus, getStripeConnectOAuthUrl } from "@/api/functions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Link2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import FlashMessage from "@/components/storefront/FlashMessage";
import { CountrySelect } from "@/components/ui/country-select";
import TranslationFields from "@/components/admin/TranslationFields";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import { PageLoader } from "@/components/ui/page-loader";

export default function PaymentMethods() {
  const { selectedStore, getSelectedStoreId } = useStoreSelection();
  const { currentLanguage } = useTranslation();
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [flashMessage, setFlashMessage] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingMethod, setEditingMethod] = useState(null);
  const [showTranslations, setShowTranslations] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [methodToDelete, setMethodToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Stripe Connect state
  const [stripeStatus, setStripeStatus] = useState(null);
  const [loadingStripeStatus, setLoadingStripeStatus] = useState(true);
  const [connectingStripe, setConnectingStripe] = useState(false);
  const [disconnectingStripe, setDisconnectingStripe] = useState(false);
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);
  const [connectingExistingAccount, setConnectingExistingAccount] = useState(false);
  const [showStripeGuideModal, setShowStripeGuideModal] = useState(false);
  const [syncingMethods, setSyncingMethods] = useState(false);
  const [stripeEnabledMethods, setStripeEnabledMethods] = useState(null); // null = not loaded, object = { code: enabled }

  // Conditions data
  const [categories, setCategories] = useState([]);
  const [attributeSets, setAttributeSets] = useState([]);
  const [attributes, setAttributes] = useState([]);
  const [showCategorySelect, setShowCategorySelect] = useState(false);
  const [showAttributeSetSelect, setShowAttributeSetSelect] = useState(false);
  const [skuInput, setSkuInput] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    type: 'credit_card',
    payment_flow: 'offline',
    is_active: true,
    description: '',
    icon_url: '',
    sort_order: 0,
    min_amount: '',
    max_amount: '',
    fee_type: 'none',
    fee_amount: 0,
    availability: 'all',
    countries: [],
    conditions: {
      categories: [],
      attribute_sets: [],
      skus: [],
      attribute_conditions: []
    },
    translations: {}
  });

  // Local formatPrice helper that uses selectedStore's currency
  const formatPrice = (value, decimals = 2) => {
    const num = typeof value === 'number' ? value : parseFloat(value) || 0;
    const symbol = selectedStore?.currency_symbol || selectedStore?.settings?.currency_symbol || store?.currency_symbol || store?.settings?.currency_symbol || '$';
    return `${symbol}${num.toFixed(decimals)}`;
  };

  // Payment providers configuration
  const paymentProviders = [
    { id: 'stripe', name: 'Stripe', description: 'Credit cards, Apple Pay, Google Pay', status: 'available' },
    { id: 'adyen', name: 'Adyen', description: 'Enterprise payment processing', status: 'coming_soon' },
    { id: 'mollie', name: 'Mollie', description: 'European payment methods', status: 'coming_soon' },
    { id: 'paypal', name: 'PayPal', description: 'Pay with PayPal account', status: 'coming_soon' }
  ];

  useEffect(() => {
    if (selectedStore) {
      loadPaymentMethods();
      loadConditionsData();
      loadStripeConnectStatus();
    }
  }, [selectedStore, currentLanguage]);

  // Handle Stripe OAuth return
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('stripe_return') === 'true') {
      setFlashMessage({ type: 'success', message: 'Stripe account connected successfully!' });
      loadStripeConnectStatus();
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (params.get('stripe_refresh') === 'true') {
      setFlashMessage({ type: 'info', message: 'Please complete Stripe onboarding.' });
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (params.get('stripe_oauth_success') === 'true') {
      setFlashMessage({ type: 'success', message: 'Existing Stripe account connected successfully!' });
      loadStripeConnectStatus();
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (params.get('stripe_error')) {
      const errorMsg = decodeURIComponent(params.get('stripe_error'));
      setFlashMessage({ type: 'error', message: `Failed to connect Stripe: ${errorMsg}` });
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const loadStripeConnectStatus = async () => {
    if (!selectedStore?.id) return;

    setLoadingStripeStatus(true);
    try {
      const response = await checkStripeConnectStatus(selectedStore.id);
      const status = response.data?.data || response.data || null;
      setStripeStatus(status);

      // If connected, also fetch enabled payment methods
      if (status?.connected) {
        loadStripeEnabledMethods();
      }
    } catch (error) {
      setStripeStatus(null);
    } finally {
      setLoadingStripeStatus(false);
    }
  };

  const loadStripeEnabledMethods = async () => {
    if (!selectedStore?.id) return;

    try {
      const response = await apiClient.get(`payments/stripe-enabled-methods?store_id=${selectedStore.id}`);
      const data = response.data?.data || response.data;

      console.log('🔍 Stripe enabled methods API response:', data);

      if (data?.methods) {
        // Create a map of code -> enabled status
        const enabledMap = {};
        data.methods.forEach(m => {
          enabledMap[m.code] = m.enabled;
        });
        console.log('🔍 Stripe enabled map:', enabledMap);
        setStripeEnabledMethods(enabledMap);
      }
    } catch (error) {
      console.warn('Could not fetch Stripe enabled methods:', error);
      setStripeEnabledMethods(null);
    }
  };

  const handleConnectStripe = async () => {
    if (!selectedStore?.id) return;

    setConnectingStripe(true);
    try {
      let onboardingUrl;

      try {
        const accountResponse = await createStripeConnectAccount(selectedStore.id);
        onboardingUrl = Array.isArray(accountResponse.data)
          ? accountResponse.data[0]?.onboarding_url
          : accountResponse.data?.onboarding_url;
      } catch (accountError) {
        if (accountError.message?.includes("already exists")) {
          const currentUrl = window.location.origin + window.location.pathname;
          const returnUrl = `${currentUrl}?stripe_return=true`;
          const refreshUrl = `${currentUrl}?stripe_refresh=true`;

          const linkResponse = await createStripeConnectLink(returnUrl, refreshUrl, selectedStore.id);
          onboardingUrl = Array.isArray(linkResponse.data)
            ? linkResponse.data[0]?.url
            : linkResponse.data?.url;
        } else {
          throw accountError;
        }
      }

      if (onboardingUrl) {
        window.location.href = onboardingUrl;
      } else {
        setFlashMessage({ type: 'error', message: 'Unable to connect to Stripe. Please try again.' });
      }
    } catch (error) {
      setFlashMessage({ type: 'error', message: 'Error connecting to Stripe: ' + error.message });
    } finally {
      setConnectingStripe(false);
    }
  };

  const handleDisconnectStripe = async () => {
    if (!selectedStore?.id) return;

    setDisconnectingStripe(true);
    try {
      await apiClient.delete(`payments/disconnect-stripe?store_id=${selectedStore.id}`);
      setFlashMessage({ type: 'success', message: 'Stripe account disconnected successfully.' });
      setStripeStatus(null);
      setDisconnectDialogOpen(false);
      loadStripeConnectStatus();
    } catch (error) {
      setFlashMessage({ type: 'error', message: 'Error disconnecting Stripe: ' + error.message });
    } finally {
      setDisconnectingStripe(false);
    }
  };

  const handleConnectExistingStripeAccount = async () => {
    if (!selectedStore?.id) return;

    setConnectingExistingAccount(true);
    try {
      const response = await getStripeConnectOAuthUrl(selectedStore.id);
      const oauthUrl = response.data?.data?.oauth_url || response.data?.oauth_url;

      if (oauthUrl) {
        // Redirect to Stripe OAuth page
        window.location.href = oauthUrl;
      } else {
        setFlashMessage({ type: 'error', message: 'Unable to generate OAuth URL. Please try again.' });
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message;
      if (errorMessage.includes('STRIPE_CLIENT_ID')) {
        setFlashMessage({ type: 'error', message: 'Stripe OAuth is not configured. Please contact support.' });
      } else {
        setFlashMessage({ type: 'error', message: 'Error connecting to Stripe: ' + errorMessage });
      }
    } finally {
      setConnectingExistingAccount(false);
    }
  };

  const handleAddStripeMethod = async () => {
    if (!store) {
      setFlashMessage({ type: 'error', message: 'Store not found' });
      return;
    }

    // Check if Stripe is connected
    const isConnected = stripeStatus?.connected && stripeStatus?.onboardingComplete;
    if (!isConnected) {
      setFlashMessage({ type: 'error', message: 'Please connect your Stripe account first' });
      return;
    }

    // Check if method already exists
    if (paymentMethods.some(m => m.code === 'stripe')) {
      setFlashMessage({ type: 'warning', message: 'Stripe payment method already exists' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: 'Stripe (Online Payments)',
        code: 'stripe',
        type: 'stripe',
        payment_flow: 'online',
        description: 'Accept credit cards, debit cards, and more via Stripe.',
        store_id: store.id,
        is_active: true,
        sort_order: paymentMethods.length + 1,
        countries: []
      };
      await PaymentMethod.create(payload);
      setFlashMessage({ type: 'success', message: 'Stripe payment method added successfully!' });
      loadPaymentMethods();
    } catch (error) {
      setFlashMessage({ type: 'error', message: 'Failed to add payment method: ' + error.message });
    } finally {
      setSaving(false);
    }
  };

  const handleSyncStripeMethods = async () => {
    if (!selectedStore?.id) return;

    setSyncingMethods(true);
    try {
      const response = await apiClient.post('payments/sync-stripe-methods', {
        store_id: selectedStore.id,
        force_all: true // Insert all methods for Standard accounts (OAuth connected)
      });
      const data = response.data?.data || response.data;

      if (data?.inserted > 0) {
        setFlashMessage({ type: 'success', message: `Synced ${data.inserted} new Stripe payment methods!` });
      } else {
        setFlashMessage({ type: 'success', message: 'Payment methods are already up to date.' });
      }

      // Reload payment methods and enabled status
      loadPaymentMethods();
      loadStripeEnabledMethods();
    } catch (error) {
      setFlashMessage({ type: 'error', message: 'Failed to sync payment methods: ' + error.message });
    } finally {
      setSyncingMethods(false);
    }
  };

  const loadConditionsData = async () => {
    try {
      const storeId = getSelectedStoreId();
      if (!storeId) return;

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
      setAttributeSets([]);
      setAttributes([]);
      setCategories([]);
    }
  };

  const loadPaymentMethods = async () => {
    setLoading(true);
    try {
      const storeId = getSelectedStoreId();
      if (!storeId) {
        setLoading(false);
        return;
      }

      setStore(selectedStore);
      // Use authenticated endpoint to get ALL payment methods (including inactive)
      const response = await apiClient.get(`payment-methods?store_id=${storeId}&limit=100`);
      const methods = response?.data?.payment_methods || response?.payment_methods || [];
      setPaymentMethods(methods);
    } catch (error) {
      setFlashMessage({ type: 'error', message: 'Failed to load payment methods' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!store) {
      setFlashMessage({ type: 'error', message: 'Store not found' });
      return;
    }

    setSaveSuccess(false);
    setSaving(true);
    try {
      const payload = {
        ...formData,
        store_id: store.id,
        min_amount: formData.min_amount ? parseFloat(formData.min_amount) : null,
        max_amount: formData.max_amount ? parseFloat(formData.max_amount) : null,
        fee_amount: formData.fee_amount ? parseFloat(formData.fee_amount) : 0
      };

      if (editingMethod) {
        await PaymentMethod.update(editingMethod.id, payload);
        setFlashMessage({ type: 'success', message: 'Payment method updated successfully!' });
      } else {
        await PaymentMethod.create(payload);
        setFlashMessage({ type: 'success', message: 'Payment method created successfully!' });
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
      setShowForm(false);
      setEditingMethod(null);
      resetForm();
      loadPaymentMethods();
    } catch (error) {
      setFlashMessage({ type: 'error', message: 'Failed to save payment method' });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (method) => {
    let translations = method.translations || {};
    if (!translations.en) {
      translations.en = {
        name: method.name,
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
      name: method.name,
      code: method.code,
      type: method.type || 'other',
      payment_flow: method.payment_flow || 'offline',
      is_active: method.is_active,
      description: method.description || '',
      icon_url: method.icon_url || '',
      sort_order: method.sort_order,
      min_amount: method.min_amount || '',
      max_amount: method.max_amount || '',
      fee_type: method.fee_type || 'none',
      fee_amount: method.fee_amount || 0,
      availability: method.availability || 'all',
      countries: method.countries || [],
      conditions: conditions,
      translations: translations
    });
    setEditingMethod(method);
    setShowForm(true);
  };

  const handleDelete = (method) => {
    setMethodToDelete(method);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!methodToDelete) return;

    setDeleting(true);
    try {
      await PaymentMethod.delete(methodToDelete.id);
      setFlashMessage({ type: 'success', message: 'Payment method deleted successfully!' });
      await loadPaymentMethods();
      setDeleteDialogOpen(false);
      setMethodToDelete(null);
    } catch (error) {
      setFlashMessage({ type: 'error', message: 'Failed to delete payment method' });
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleActive = async (method) => {
    // Check if trying to activate a Stripe method that is not enabled in Stripe dashboard
    const isStripeMethod = method.provider === 'stripe' || method.code?.startsWith('stripe_');
    if (!method.is_active && isStripeMethod && stripeEnabledMethods && stripeEnabledMethods[method.code] === false) {
      setFlashMessage({
        type: 'error',
        message: `Cannot enable "${method.name}" - this payment method is not enabled in your Stripe dashboard. Enable it at dashboard.stripe.com → Settings → Payment methods.`
      });
      return;
    }

    try {
      await PaymentMethod.update(method.id, { is_active: !method.is_active });
      setFlashMessage({
        type: 'success',
        message: `Payment method ${!method.is_active ? 'enabled' : 'disabled'} successfully!`
      });
      await loadPaymentMethods();
    } catch (error) {
      console.error("Error toggling payment method status:", error);
      setFlashMessage({ type: 'error', message: 'Failed to update payment method status' });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      type: 'credit_card',
      payment_flow: 'offline',
      is_active: true,
      description: '',
      icon_url: '',
      sort_order: 0,
      min_amount: '',
      max_amount: '',
      fee_type: 'none',
      fee_amount: 0,
      availability: 'all',
      countries: [],
      conditions: {
        categories: [],
        attribute_sets: [],
        skus: [],
        attribute_conditions: []
      },
      translations: {}
    });
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

  const getAttributeOptions = (attributeCode) => {
    if (!Array.isArray(attributes)) return [];
    const attribute = attributes.find(attr => attr && attr.code === attributeCode);
    return attribute?.options || [];
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

  if (loading) {
    return <PageLoader size="lg" />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <FlashMessage message={flashMessage} onClose={() => setFlashMessage(null)} />
        
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Payment Methods</h1>
          <p className="text-gray-600 mt-2">Configure payment options for your customers</p>
        </div>

        <Card className="material-elevation-1 border-0 mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Payment Providers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {paymentProviders.map(provider => {
                const isComingSoon = provider.status === 'coming_soon';
                const isStripeConnected = stripeStatus?.connected && stripeStatus?.onboardingComplete;
                const hasStripeMethod = paymentMethods.some(m => m.code === 'stripe');

                return (
                  <div
                    key={provider.id}
                    className={`p-4 border rounded-lg text-center ${isComingSoon ? 'opacity-60' : ''}`}
                  >
                    <h3 className={`font-semibold ${isComingSoon ? 'text-gray-500' : ''}`}>
                      {provider.name}
                    </h3>
                    <p className={`text-sm mb-3 ${isComingSoon ? 'text-gray-400' : 'text-gray-600'}`}>
                      {provider.description}
                    </p>

                    {provider.id === 'stripe' && (
                      <>
                        {loadingStripeStatus ? (
                          <RefreshCw className="w-4 h-4 mx-auto animate-spin text-gray-400" />
                        ) : isStripeConnected ? (
                          <div className="space-y-3">
                            <div className="flex items-center justify-center gap-2">
                              <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200">
                                <CheckCircle className="w-3 h-3 mr-1" /> Connected
                              </Badge>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setDisconnectDialogOpen(true)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 h-6 px-2"
                                title="Disconnect Stripe"
                              >
                                <Unlink className="w-3 h-3" />
                              </Button>
                            </div>
                            {stripeStatus?.email && (
                              <p className="text-xs text-gray-500 text-center">
                                {stripeStatus.email}
                              </p>
                            )}
                            <div className="flex items-center justify-center gap-2">
                              {!hasStripeMethod && (
                                <Button
                                  size="sm"
                                  onClick={handleAddStripeMethod}
                                  disabled={saving}
                                >
                                  Add Method
                                </Button>
                              )}
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={handleSyncStripeMethods}
                                      disabled={syncingMethods}
                                    >
                                      <RefreshCw className={`w-4 h-4 ${syncingMethods ? 'animate-spin' : ''}`} />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Sync payment methods from Stripe</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </div>
                        ) : stripeStatus?.connected && !stripeStatus?.onboardingComplete ? (
                          <div className="space-y-3">
                            <div className="flex items-center justify-center gap-2">
                              <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200">
                                <AlertCircle className="w-3 h-3 mr-1" /> Setup Incomplete
                              </Badge>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setDisconnectDialogOpen(true)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 h-6 px-2"
                                title="Reset and choose different account"
                              >
                                <Unlink className="w-3 h-3" />
                              </Button>
                            </div>
                            <Button
                              onClick={handleConnectStripe}
                              disabled={connectingStripe}
                              className="bg-amber-600 hover:bg-amber-700"
                            >
                              {connectingStripe ? (
                                <>
                                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                  Loading...
                                </>
                              ) : (
                                'Continue Setup'
                              )}
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="flex items-center gap-1">
                              <Button
                                onClick={handleConnectExistingStripeAccount}
                                disabled={connectingExistingAccount || connectingStripe}
                                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 flex-1"
                              >
                                {connectingExistingAccount ? (
                                  <>
                                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                    Connecting...
                                  </>
                                ) : (
                                  <><Link2 className="w-4 h-4 mr-2" /> Connect Existing</>
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="px-2 h-9"
                                onClick={() => setShowStripeGuideModal(true)}
                              >
                                <Info className="w-4 h-4 text-gray-400" />
                              </Button>
                            </div>
                            <div className="relative py-2">
                              <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t border-gray-200" />
                              </div>
                              <div className="relative flex justify-center text-xs">
                                <span className="bg-white px-2 text-gray-400">or</span>
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleConnectStripe}
                              disabled={connectingStripe || connectingExistingAccount}
                              className="w-full text-xs"
                            >
                              {connectingStripe ? (
                                <><RefreshCw className="w-3 h-3 mr-1 animate-spin" /> Creating...</>
                              ) : (
                                <><CreditCard className="w-3 h-3 mr-1" /> Create New Account</>
                              )}
                            </Button>
                          </div>
                        )}
                      </>
                    )}

                    {isComingSoon && (
                      <Badge variant="outline" className="text-gray-400 border-gray-300">
                        Coming Soon
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
          <h2 className="text-xl font-semibold">Configured Payment Methods</h2>
          <Button
            onClick={() => {
              resetForm();
              setEditingMethod(null);
              setShowForm(true);
            }}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            disabled={!store}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Custom Method
          </Button>
        </div>

        <p className="text-sm text-gray-500 mb-6 flex items-center gap-1">
          <Info className="w-4 h-4" />
          At checkout, payment methods are shown based on the customer's billing country. Configure available countries in Settings → Allowed Countries.
        </p>

        <div className="grid gap-4">
          {paymentMethods.map(method => {
            console.log('🔍 Payment method:', method.code, 'provider:', method.provider, 'enabled:', stripeEnabledMethods?.[method.code]);
            // Determine icon and color based on payment method type
            const getMethodIcon = () => {
              if (method.icon_url) {
                return <img src={method.icon_url} alt={method.name} className="w-8 h-8 object-contain" />;
              }

              switch (method.type) {
                case 'stripe':
                case 'credit_card':
                case 'debit_card':
                  return <CreditCard className="w-6 h-6 text-blue-600" />;
                case 'paypal':
                  return <CreditCard className="w-6 h-6 text-blue-500" />;
                case 'cash_on_delivery':
                  return <Banknote className="w-6 h-6 text-green-600" />;
                case 'bank_transfer':
                  return <Building2 className="w-6 h-6 text-indigo-600" />;
                default:
                  return <CreditCard className="w-6 h-6 text-gray-600" />;
              }
            };

            const getIconBgColor = () => {
              if (method.icon_url) return 'bg-gray-100';

              switch (method.type) {
                case 'stripe':
                case 'credit_card':
                case 'debit_card':
                  return 'bg-blue-50';
                case 'paypal':
                  return 'bg-blue-50';
                case 'cash_on_delivery':
                  return 'bg-green-50';
                case 'bank_transfer':
                  return 'bg-indigo-50';
                default:
                  return 'bg-gray-100';
              }
            };

            return (
              <Card key={method.id} className="material-elevation-1 border-0">
                <CardContent className="p-3 sm:p-6">
                  <div className="sm:flex space-y-4 sm:space-y-0 items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`hidden sm:flex items-center justify-center w-12 h-12 ${getIconBgColor()} rounded-lg`}>
                        {getMethodIcon()}
                      </div>
                      <div>
                      <h3 className="font-semibold text-lg">{method.name}</h3>
                      <p className="text-gray-600">{method.description}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant={method.type === 'stripe' ? 'default' : 'secondary'}>
                          {method.type}
                        </Badge>
                        <Badge variant={method.is_active ? 'default' : 'secondary'}>
                          {method.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                        <Badge variant={method.payment_flow === 'online' ? 'outline' : 'outline'} className={method.payment_flow === 'online' ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-blue-100 text-blue-700 border-blue-200'}>
                          {method.payment_flow === 'online' ? 'Online' : 'Offline'}
                        </Badge>
                        {method.type === 'stripe' && (
                          <Badge
                            variant={stripeStatus?.connected && stripeStatus?.onboardingComplete ? "outline" : "outline"}
                            className={stripeStatus?.connected && stripeStatus?.onboardingComplete ? "bg-green-100 text-green-700 border-green-200" : "bg-yellow-100 text-yellow-700 border-yellow-200"}
                          >
                            {stripeStatus?.connected && stripeStatus?.onboardingComplete ? (
                              <><CheckCircle className="w-3 h-3 mr-1" /> Connected</>
                            ) : stripeStatus?.connected ? (
                              <><AlertCircle className="w-3 h-3 mr-1" /> Setup Incomplete</>
                            ) : (
                              <><AlertCircle className="w-3 h-3 mr-1" /> Not Connected</>
                            )}
                          </Badge>
                        )}
                        {(method.provider === 'stripe' || method.code?.startsWith('stripe_')) && stripeEnabledMethods && stripeEnabledMethods[method.code] === false && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200">
                                  <AlertCircle className="w-3 h-3 mr-1" /> Not Enabled in Stripe
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>This payment method is not enabled in your Stripe dashboard.</p>
                                <p className="text-xs mt-1">Enable it at dashboard.stripe.com → Settings → Payment methods</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        {method.fee_type && method.fee_type !== 'none' && (
                          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                            {method.fee_type === 'fixed'
                              ? `${formatPrice(method.fee_amount || 0)} fee`
                              : `${method.fee_amount || 0}% fee`
                            }
                          </Badge>
                        )}
                        {method.availability === 'specific_countries' && method.countries && method.countries.length > 0 && (
                          <Badge variant="outline">
                            {method.countries.length} Country{method.countries.length !== 1 ? 's' : ''}
                          </Badge>
                        )}
                        {(method.min_amount || method.max_amount) && (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                            {method.min_amount && method.max_amount
                              ? `${formatPrice(method.min_amount)} - ${formatPrice(method.max_amount)}`
                              : method.min_amount
                                ? `Min ${formatPrice(method.min_amount)}`
                                : `Max ${formatPrice(method.max_amount)}`
                            }
                          </Badge>
                        )}
                      </div>
                      {method.settings?.supported_countries && method.settings.supported_countries.length > 0 && (
                        <div className="mt-2 text-base" title={method.settings.supported_countries.join(', ')}>
                          {method.settings.supported_countries.map(code =>
                            String.fromCodePoint(...[...code.toUpperCase()].map(c => 0x1F1E6 - 65 + c.charCodeAt(0)))
                          ).join(' ')}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleActive(method)}
                      title={method.is_active ? 'Disable payment method' : 'Enable payment method'}
                      className={method.is_active ? 'text-green-600 hover:text-green-700' : 'text-gray-400 hover:text-gray-600'}
                    >
                      {method.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleEdit(method)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDelete(method)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {paymentMethods.length === 0 && !loading && (
            <div className="text-center text-gray-500 py-8">
              No payment methods configured yet. Add one using the buttons above.
            </div>
          )}
          {paymentMethods.length === 0 && !loading && !store && (
            <div className="text-center text-red-500 py-4">
              No store found for your user. Please ensure a store is created to manage payment methods.
            </div>
          )}
        </div>

        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-screen overflow-y-auto">
              <h2 className="text-xl font-semibold mb-4">
                {editingMethod ? 'Edit Payment Method' : 'Add Payment Method'}
              </h2>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => {
                        const newName = e.target.value;
                        setFormData({
                          ...formData,
                          name: newName,
                          translations: {
                            ...formData.translations,
                            en: { ...formData.translations.en, name: newName }
                          }
                        });
                      }}
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
                  <div>
                    <Label htmlFor="code">Code *</Label>
                    <Input
                      id="code"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      required
                    />
                  </div>
                </div>

                {showTranslations && (
                  <div className="border-2 border-blue-200 bg-blue-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-4">
                      <Languages className="w-5 h-5 text-blue-600" />
                      <h3 className="text-base font-semibold text-blue-900">Payment Method Translations</h3>
                    </div>
                    <TranslationFields
                      translations={formData.translations}
                      onChange={(newTranslations) => {
                        setFormData({
                          ...formData,
                          translations: newTranslations,
                          name: newTranslations.en?.name || formData.name,
                          description: newTranslations.en?.description || formData.description
                        });
                      }}
                      fields={[
                        { name: 'name', label: 'Payment Method Name', type: 'text', required: true },
                        { name: 'description', label: 'Description', type: 'textarea', rows: 3, required: false }
                      ]}
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="type">Payment Type</Label>
                    <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="credit_card">Credit Card</SelectItem>
                        <SelectItem value="debit_card">Debit Card</SelectItem>
                        <SelectItem value="paypal">PayPal</SelectItem>
                        <SelectItem value="stripe">Stripe</SelectItem>
                        <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                        <SelectItem value="cash_on_delivery">Cash on Delivery</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="payment_flow">Payment Flow</Label>
                    <Select value={formData.payment_flow} onValueChange={(value) => setFormData({ ...formData, payment_flow: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="online">Online (requires webhook confirmation)</SelectItem>
                        <SelectItem value="offline">Offline (immediate confirmation)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500 mt-1">
                      Online: Stripe, PayPal (wait for webhook). Offline: Bank transfer, Cash on delivery (immediate).
                    </p>
                  </div>
                </div>

                {!showTranslations && (
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => {
                        const newDescription = e.target.value;
                        setFormData({
                          ...formData,
                          description: newDescription,
                          translations: {
                            ...formData.translations,
                            en: { ...formData.translations.en, description: newDescription }
                          }
                        });
                      }}
                      rows={3}
                    />
                  </div>
                )}

                <div>
                  <Label htmlFor="icon_url">Icon URL</Label>
                  <Input
                    id="icon_url"
                    value={formData.icon_url}
                    onChange={(e) => setFormData({ ...formData, icon_url: e.target.value })}
                    placeholder="https://example.com/icon.png"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="sort_order">Sort Order</Label>
                    <Input
                      id="sort_order"
                      type="number"
                      value={formData.sort_order}
                      onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="min_amount">Min Amount</Label>
                    <Input
                      id="min_amount"
                      type="number"
                      step="0.01"
                      value={formData.min_amount}
                      onChange={(e) => setFormData({ ...formData, min_amount: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="max_amount">Max Amount</Label>
                    <Input
                      id="max_amount"
                      type="number"
                      step="0.01"
                      value={formData.max_amount}
                      onChange={(e) => setFormData({ ...formData, max_amount: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="availability">Availability</Label>
                  <Select 
                    value={formData.availability} 
                    onValueChange={(value) => setFormData({ ...formData, availability: value })}
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
                    <Label>Allowed Countries</Label>
                    <CountrySelect
                      value={formData.countries}
                      onChange={(value) => setFormData({ ...formData, countries: value })}
                      placeholder="Select countries where this payment method is available"
                      multiple={true}
                    />
                  </div>
                )}

                <div className="border-t pt-4">
                  <h3 className="text-lg font-medium mb-4">Fee Configuration</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="fee_type">Fee Type</Label>
                      <Select 
                        value={formData.fee_type} 
                        onValueChange={(value) => setFormData({ ...formData, fee_type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No Fee</SelectItem>
                          <SelectItem value="fixed">Fixed Amount</SelectItem>
                          <SelectItem value="percentage">Percentage</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {formData.fee_type !== 'none' && (
                      <div>
                        <Label htmlFor="fee_amount">
                          Fee Amount {formData.fee_type === 'percentage' ? '(%)' : '($)'}
                        </Label>
                        <Input
                          id="fee_amount"
                          type="number"
                          step={formData.fee_type === 'percentage' ? '0.01' : '0.01'}
                          min="0"
                          max={formData.fee_type === 'percentage' ? '100' : undefined}
                          value={formData.fee_amount}
                          onChange={(e) => setFormData({ ...formData, fee_amount: parseFloat(e.target.value) || 0 })}
                          placeholder={formData.fee_type === 'percentage' ? 'e.g., 2.5' : 'e.g., 1.99'}
                        />
                        {formData.fee_type === 'percentage' && (
                          <p className="text-sm text-gray-500 mt-1">
                            Percentage of order total charged as fee
                          </p>
                        )}
                        {formData.fee_type === 'fixed' && (
                          <p className="text-sm text-gray-500 mt-1">
                            Fixed amount charged per transaction
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Conditions (Optional) */}
                <div className="border-t pt-4 space-y-4">
                  <div>
                    <h3 className="text-lg font-medium mb-2">Conditions (Optional)</h3>
                    <p className="text-sm text-gray-600">
                      Optionally specify conditions to control when this payment method is available. If no conditions are specified, the payment method will always be available.
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
                    <p className="text-sm text-gray-500 mb-3">Show this payment method when products have specific attribute values</p>

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
                      Add individual SKUs. This payment method will be available for products matching any of these SKUs.
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                  <Label htmlFor="is_active">Active</Label>
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowForm(false);
                      setEditingMethod(null);
                      resetForm();
                    }}
                  >
                    Cancel
                  </Button>
                  <SaveButton
                    type="submit"
                    loading={saving}
                    success={saveSuccess}
                    defaultText={editingMethod ? "Update" : "Create"}
                  />
                </div>
              </form>
            </div>
          </div>
        )}

        <DeleteConfirmationDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onConfirm={confirmDelete}
          title="Delete Payment Method"
          description={`Are you sure you want to delete "${methodToDelete?.name}"? This action cannot be undone.`}
          loading={deleting}
        />

        <DeleteConfirmationDialog
          open={disconnectDialogOpen}
          onOpenChange={setDisconnectDialogOpen}
          onConfirm={handleDisconnectStripe}
          title="Disconnect Stripe"
          description="Are you sure you want to disconnect your Stripe account? This will disable online payments for your store. You can reconnect at any time."
          confirmText="Disconnect"
          loading={disconnectingStripe}
          icon={Unlink}
          iconClassName="text-orange-600"
          iconBgClassName="bg-orange-100"
        />

        <Dialog open={showStripeGuideModal} onOpenChange={setShowStripeGuideModal}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Link2 className="w-5 h-5 text-blue-600" />
                Connect Your Stripe Account
              </DialogTitle>
              <DialogDescription>
                Follow these steps to connect your existing Stripe account
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-medium">1</div>
                <div>
                  <p className="font-medium">Click "Connect Existing"</p>
                  <p className="text-sm text-gray-600">You will be redirected to Stripe's authorization page.</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-medium">2</div>
                <div>
                  <p className="font-medium">Log in to Stripe</p>
                  <p className="text-sm text-gray-600">Enter your Stripe email and password to log in.</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-sm font-medium">3</div>
                <div>
                  <p className="font-medium text-amber-700">Verify the correct account is selected</p>
                  <p className="text-sm text-gray-600">
                    Check the account shown in the <strong>top-right corner</strong> of the Stripe page.
                    If it's not the account you want to connect, click the dropdown to switch accounts.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-medium">4</div>
                <div>
                  <p className="font-medium">Authorize the connection</p>
                  <p className="text-sm text-gray-600">Click "Connect" or "Authorize" to link your account to your store.</p>
                </div>
              </div>

              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Tip:</strong> If you're already logged into the wrong Stripe account, you can either use an incognito/private browser window, or switch accounts using the dropdown in Stripe.
                </p>
              </div>

              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800 font-medium mb-2">
                  <AlertCircle className="w-4 h-4 inline mr-1" />
                  Important: Business Name Required
                </p>
                <p className="text-sm text-amber-700 mb-2">
                  Your Stripe account must have a business name set before you can accept payments via Checkout.
                </p>
                <p className="text-sm text-amber-700">
                  To set this up: Go to <a href="https://dashboard.stripe.com/account" target="_blank" rel="noopener noreferrer" className="underline font-medium">dashboard.stripe.com/account</a> → Account details → Set your Business name.
                </p>
                <p className="text-xs text-amber-600 mt-2">
                  In test mode, you can use any name like "Test Store".
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowStripeGuideModal(false)}>
                Close
              </Button>
              <Button
                onClick={() => {
                  setShowStripeGuideModal(false);
                  handleConnectExistingStripeAccount();
                }}
                disabled={connectingExistingAccount}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                <Link2 className="w-4 h-4 mr-2" />
                Connect Now
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}