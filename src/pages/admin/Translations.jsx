import React, { useState, useEffect } from 'react';
import { Plus, Search, Globe, Edit2, Trash2, Save, X, Wand2, Languages } from 'lucide-react';
import api from '../../utils/api';
import { User } from '@/api/entities';
import { useTranslation } from '../../contexts/TranslationContext';
import { useStoreSelection } from '../../contexts/StoreSelectionContext';
import BulkTranslateDialog from '../../components/admin/BulkTranslateDialog';
import EntityTranslationCard from '../../components/admin/EntityTranslationCard';
import MultiEntityTranslateDialog from '../../components/admin/MultiEntityTranslateDialog';
import TranslationWizard from '../../components/admin/TranslationWizard';
import ProductTranslationRow from '../../components/admin/translations/ProductTranslationRow';
import CategoryTranslationRow from '../../components/admin/translations/CategoryTranslationRow';
import AttributeTranslationRow from '../../components/admin/translations/AttributeTranslationRow';
import CmsPageTranslationRow from '../../components/admin/translations/CmsPageTranslationRow';
import CmsBlockTranslationRow from '../../components/admin/translations/CmsBlockTranslationRow';
import ProductTabTranslationRow from '../../components/admin/translations/ProductTabTranslationRow';
import EmailTemplateTranslationRow from '../../components/admin/translations/EmailTemplateTranslationRow';
import PdfTemplateTranslationRow from '../../components/admin/translations/PdfTemplateTranslationRow';
import ProductLabelTranslationRow from '../../components/admin/translations/ProductLabelTranslationRow';
import CookieConsentTranslationRow from '../../components/admin/translations/CookieConsentTranslationRow';
import CustomOptionTranslationRow from '../../components/admin/translations/CustomOptionTranslationRow';
import StockLabelTranslationRow from '../../components/admin/translations/StockLabelTranslationRow';
import FlashMessage from '../../components/storefront/FlashMessage';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { toast } from 'sonner';
import { PageLoader } from '../../components/ui/page-loader';

export default function Translations() {
  const { availableLanguages, currentLanguage, changeLanguage } = useTranslation();
  const { selectedStore, getSelectedStoreId } = useStoreSelection();

  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedLanguage, setSelectedLanguage] = useState(currentLanguage);
  const [labels, setLabels] = useState([]);
  const [filteredLabels, setFilteredLabels] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingKey, setEditingKey] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [showBulkAddForm, setShowBulkAddForm] = useState(false);
  const [bulkTranslations, setBulkTranslations] = useState({});
  const [autoTranslate, setAutoTranslate] = useState(false);
  const [message, setMessage] = useState(null);
  const [showFlashMessage, setShowFlashMessage] = useState(false);
  const [flashMessageData, setFlashMessageData] = useState(null);
  const [showBulkTranslateDialog, setShowBulkTranslateDialog] = useState(false);
  const [showMultiEntityTranslateDialog, setShowMultiEntityTranslateDialog] = useState(false);
  const [showTranslationWizard, setShowTranslationWizard] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [labelToDelete, setLabelToDelete] = useState(null);

  // Entity translation states
  const [entityStats, setEntityStats] = useState([]);
  const [loadingEntityStats, setLoadingEntityStats] = useState(false);
  const [selectedEntityType, setSelectedEntityType] = useState(null);
  const [selectedEntityName, setSelectedEntityName] = useState(null);
  const [selectedEntityItemCount, setSelectedEntityItemCount] = useState(0);

  // Products tab states
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productSearchQuery, setProductSearchQuery] = useState('');

  // Categories tab states
  const [productCategories, setProductCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState('');

  // Attributes tab states
  const [productAttributes, setProductAttributes] = useState([]);
  const [loadingAttributes, setLoadingAttributes] = useState(false);
  const [attributeSearchQuery, setAttributeSearchQuery] = useState('');

  // CMS Content tab states
  const [cmsPages, setCmsPages] = useState([]);
  const [cmsBlocks, setCmsBlocks] = useState([]);
  const [loadingCms, setLoadingCms] = useState(false);
  const [cmsSearchQuery, setCmsSearchQuery] = useState('');
  const [cmsContentType, setCmsContentType] = useState('all'); // 'all', 'pages', 'blocks'

  // Product Tabs tab states
  const [productTabs, setProductTabs] = useState([]);
  const [loadingProductTabs, setLoadingProductTabs] = useState(false);
  const [productTabSearchQuery, setProductTabSearchQuery] = useState('');

  // Product Labels tab states
  const [productLabels, setProductLabels] = useState([]);
  const [loadingProductLabels, setLoadingProductLabels] = useState(false);
  const [productLabelSearchQuery, setProductLabelSearchQuery] = useState('');

  // Cookie Consent tab states
  const [cookieConsent, setCookieConsent] = useState([]);
  const [loadingCookieConsent, setLoadingCookieConsent] = useState(false);

  // Custom Options tab states
  const [customOptions, setCustomOptions] = useState([]);
  const [loadingCustomOptions, setLoadingCustomOptions] = useState(false);
  const [customOptionSearchQuery, setCustomOptionSearchQuery] = useState('');

  // Stock Labels state
  const [stockSettings, setStockSettings] = useState(null);

  // Email Templates tab states
  const [emailTemplates, setEmailTemplates] = useState([]);
  const [loadingEmailTemplates, setLoadingEmailTemplates] = useState(false);
  const [emailTemplateSearchQuery, setEmailTemplateSearchQuery] = useState('');

  // PDF Templates tab states
  const [pdfTemplates, setPdfTemplates] = useState([]);
  const [loadingPdfTemplates, setLoadingPdfTemplates] = useState(false);
  const [pdfTemplateSearchQuery, setPdfTemplateSearchQuery] = useState('');
  const [loadingStockSettings, setLoadingStockSettings] = useState(false);

  // Language selection for translations
  const [selectedTranslationLanguages, setSelectedTranslationLanguages] = useState(['en', 'nl']);

  // User credits for AI translations
  const [userCredits, setUserCredits] = useState(null);
  const [loadingCredits, setLoadingCredits] = useState(true);

  // Service credit costs for AI translations
  const [serviceCosts, setServiceCosts] = useState({});
  const [loadingServiceCosts, setLoadingServiceCosts] = useState(true);

  const categories = ['common', 'navigation', 'product', 'checkout', 'account', 'admin'];

  /**
   * Load UI labels for selected language
   */
  const loadLabels = async (lang) => {
    try {
      setLoading(true);
      const storeId = getSelectedStoreId();
      if (!storeId) {
        showMessage('Please select a store first', 'error');
        setLoading(false);
        return;
      }
      const response = await api.get(`/translations/ui-labels?store_id=${storeId}&lang=${lang}`);

      if (response && response.success && response.data && response.data.labels) {
        // Flatten nested objects into separate label entries
        const labelsArray = [];

        const flattenObject = (obj, prefix = '') => {
          Object.entries(obj).forEach(([key, value]) => {
            const fullKey = prefix ? `${prefix}.${key}` : key;

            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
              // Recursively flatten nested objects
              flattenObject(value, fullKey);
            } else {
              // This is a leaf node - create a label entry
              const category = fullKey.split('.')[0] || 'common';
              const stringValue = String(value || '');

              // Determine if this is a system or custom translation
              // System translations typically come from the API with predefined keys
              // Custom translations are user-added (we'll check if it exists in response metadata)
              const type = response.data.customKeys?.includes(fullKey) ? 'custom' : 'system';

              labelsArray.push({
                key: fullKey,
                value: stringValue,
                category,
                type
              });
            }
          });
        };

        flattenObject(response.data.labels);

        setLabels(labelsArray);
        setFilteredLabels(labelsArray);
      } else {
        showMessage('Unexpected response format', 'error');
      }
    } catch (error) {
      showMessage(`Failed to load translations: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Load user credits for AI translation checks
   */
  const loadUserCredits = async () => {
    try {
      setLoadingCredits(true);
      const userData = await User.me();
      setUserCredits(userData.credits || 0);
    } catch (error) {
      console.error('Failed to load user credits:', error);
      setUserCredits(0);
    } finally {
      setLoadingCredits(false);
    }
  };

  /**
   * Load service credit costs for AI translations
   */
  const loadServiceCosts = async () => {
    try {
      setLoadingServiceCosts(true);
      const response = await api.get('/service-credit-costs?category=ai_services&active_only=true');

      if (response && response.success && response.services) {
        // Create a map of service_key -> cost_per_unit
        const costsMap = {};
        response.services.forEach(service => {
          costsMap[service.service_key] = service.cost_per_unit;
        });
        setServiceCosts(costsMap);
      }
    } catch (error) {
      console.error('Failed to load service costs:', error);
      setServiceCosts({});
    } finally {
      setLoadingServiceCosts(false);
    }
  };

  /**
   * Handle credits deducted after translation
   */
  const handleCreditsDeducted = (amount) => {
    setUserCredits(prev => Math.max(0, (prev || 0) - amount));
  };

  /**
   * Filter labels based on search and category
   */
  useEffect(() => {
    let filtered = labels;

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(label => {
        const keyMatch = label.key.toLowerCase().includes(searchQuery.toLowerCase());
        const valueStr = typeof label.value === 'string' ? label.value : JSON.stringify(label.value);
        const valueMatch = valueStr.toLowerCase().includes(searchQuery.toLowerCase());
        return keyMatch || valueMatch;
      });
    }

    // Filter by category
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(label => label.category === categoryFilter);
    }

    setFilteredLabels(filtered);
  }, [searchQuery, categoryFilter, labels]);

  /**
   * Save label translation
   */
  const saveLabel = async (key, value, category = 'common', type = 'system') => {
    try {
      setSaving(true);
      const storeId = getSelectedStoreId();
      if (!storeId) {
        showMessage('Please select a store first', 'error');
        setSaving(false);
        return;
      }
      const response = await api.post('/translations/ui-labels', {
        store_id: storeId,
        key,
        language_code: selectedLanguage,
        value,
        category,
        type
      });

      if (response && response.success) {
        // Update labels state using functional form to avoid stale closures
        setLabels(prev => prev.map(label =>
          label.key === key ? { ...label, value, category, type } : label
        ));

        // Close edit mode
        setEditingKey(null);
        setEditValue('');
        setSaving(false);

        // Show success message
        showMessage('Translation saved successfully', 'success');
      } else {
        setSaving(false);
      }
    } catch (error) {
      console.error('Failed to save label:', error);
      showMessage('Failed to save translation', 'error');
      setSaving(false);
    }
  };

  /**
   * Delete label translation - opens confirmation modal
   */
  const deleteLabel = (key) => {
    setLabelToDelete(key);
    setIsDeleteModalOpen(true);
  };

  /**
   * Confirm and execute label deletion
   */
  const confirmDeleteLabel = async () => {
    if (!labelToDelete) return;

    try {
      const storeId = getSelectedStoreId();
      if (!storeId) {
        showMessage('Please select a store first', 'error');
        setIsDeleteModalOpen(false);
        return;
      }
      await api.delete(`/translations/ui-labels/${encodeURIComponent(labelToDelete)}/${selectedLanguage}`, {
        data: { store_id: storeId }
      });
      showMessage('Translation deleted successfully', 'success');
      await loadLabels(selectedLanguage);
      setIsDeleteModalOpen(false);
      setLabelToDelete(null);
    } catch (error) {
      console.error('Failed to delete label:', error);
      showMessage('Failed to delete translation', 'error');
    }
  };

  /**
   * Handle bulk translate using the new BulkTranslateDialog
   * Now runs in background on the server
   */
  const handleBulkTranslate = async (fromLang, toLang, onProgress) => {
    console.log('🎯 handleBulkTranslate called with:', { fromLang, toLang, hasProgressCallback: !!onProgress });
    try {
      const storeId = getSelectedStoreId();
      if (!storeId) {
        toast.error('Please select a store first');
        return { success: false, message: 'No store selected' };
      }

      // Call backend endpoint which now runs in background
      const data = await api.post('translations/ui-labels/bulk-translate', {
        store_id: storeId,
        fromLang,
        toLang
      });

      console.log('📥 Bulk translate response:', data);

      if (data.success) {
        // Show toast notification about background processing
        toast.info(data.message || 'Translation started in background. You will receive an email notification when complete.', {
          duration: 10000
        });

        // Return a response that indicates background processing
        return {
          success: true,
          data: {
            translated: 0,
            skipped: 0,
            failed: 0,
            backgroundProcessing: true,
            estimatedItems: data.data?.estimatedItems || 0,
            estimatedMinutes: data.data?.estimatedMinutes || 10
          },
          creditsDeducted: data.data?.estimatedCost || 0,
          message: data.message
        };
      }

      return data;
    } catch (error) {
      console.error('Bulk translate error:', error);
      return { success: false, message: error.message || 'Translation failed' };
    }
  };

  /**
   * Toggle language selection
   */
  const handleToggleTranslationLanguage = (langCode) => {
    setSelectedTranslationLanguages(prev => {
      if (prev.includes(langCode)) {
        // Don't allow removing if it's the last language
        if (prev.length === 1) return prev;
        return prev.filter(l => l !== langCode);
      } else {
        return [...prev, langCode];
      }
    });
  };

  /**
   * Load products for translation management
   */
  const loadProducts = async () => {
    const storeId = getSelectedStoreId();
    if (!storeId) {
      setProducts([]);
      return;
    }

    try {
      setLoadingProducts(true);
      const response = await api.get(`/products?store_id=${storeId}&limit=1000&include_all_translations=true`);

      console.log('🔍 loadProducts - API Response:', {
        success: response?.success,
        productsCount: response?.data?.products?.length,
        firstProduct: response?.data?.products?.[0] ? {
          id: response.data.products[0].id,
          name: response.data.products[0].name,
          sku: response.data.products[0].sku,
          translations: response.data.products[0].translations,
          translationKeys: Object.keys(response.data.products[0].translations || {})
        } : null
      });

      if (response && response.success && response.data) {
        setProducts(response.data.products || []);
      }
    } catch (error) {
      console.error('Failed to load products:', error);
      showMessage('Failed to load products', 'error');
    } finally {
      setLoadingProducts(false);
    }
  };

  /**
   * Load categories for translation management
   */
  const loadCategories = async () => {
    const storeId = getSelectedStoreId();
    if (!storeId) {
      setProductCategories([]);
      return;
    }

    try {
      setLoadingCategories(true);
      const response = await api.get(`/categories?store_id=${storeId}&limit=1000&include_all_translations=true`);

      console.log('🔍 loadCategories - API Response:', {
        success: response?.success,
        categoriesCount: response?.data?.categories?.length,
        firstCategory: response?.data?.categories?.[0] ? {
          id: response.data.categories[0].id,
          name: response.data.categories[0].name,
          slug: response.data.categories[0].slug,
          translations: response.data.categories[0].translations,
          translationKeys: Object.keys(response.data.categories[0].translations || {})
        } : null
      });

      if (response && response.success && response.data) {
        setProductCategories(response.data.categories || []);
      }
    } catch (error) {
      console.error('Failed to load categories:', error);
      showMessage('Failed to load categories', 'error');
    } finally {
      setLoadingCategories(false);
    }
  };

  /**
   * Load attributes for translation management
   */
  const loadAttributes = async () => {
    const storeId = getSelectedStoreId();
    if (!storeId) {
      setProductAttributes([]);
      return;
    }

    try {
      setLoadingAttributes(true);
      const response = await api.get(`/attributes?store_id=${storeId}&limit=1000`);

      if (response && response.success && response.data) {
        console.log('📊 Attributes response:', response.data.attributes?.slice(0, 2));
        if (response.data.attributes?.length > 0) {
          console.log('📊 First attribute translations:', response.data.attributes[0].translations);
        }
        setProductAttributes(response.data.attributes || []);
      }
    } catch (error) {
      console.error('Failed to load attributes:', error);
      showMessage('Failed to load attributes', 'error');
    } finally {
      setLoadingAttributes(false);
    }
  };

  /**
   * Load CMS content (pages and blocks) for translation management
   */
  const loadCmsContent = async () => {
    const storeId = getSelectedStoreId();
    if (!storeId) {
      setCmsPages([]);
      setCmsBlocks([]);
      return;
    }

    try {
      setLoadingCms(true);

      // Load both pages and blocks in parallel
      const [pagesResponse, blocksResponse] = await Promise.all([
        api.get(`/cms-pages?store_id=${storeId}&limit=1000`),
        api.get(`/cms-blocks?store_id=${storeId}&limit=1000`)
      ]);

      if (pagesResponse && pagesResponse.success && pagesResponse.data) {
        setCmsPages(pagesResponse.data.pages || []);
      }

      if (blocksResponse && blocksResponse.success && blocksResponse.data) {
        setCmsBlocks(blocksResponse.data.blocks || []);
      }
    } catch (error) {
      console.error('Failed to load CMS content:', error);
      showMessage('Failed to load CMS content', 'error');
    } finally {
      setLoadingCms(false);
    }
  };

  const loadEmailTemplates = async () => {
    const storeId = getSelectedStoreId();
    if (!storeId) {
      setEmailTemplates([]);
      return;
    }

    try {
      setLoadingEmailTemplates(true);
      const response = await api.get(`/email-templates?store_id=${storeId}`);

      if (response && response.success && response.data) {
        setEmailTemplates(response.data || []);
      }
    } catch (error) {
      console.error('Failed to load email templates:', error);
      showMessage('Failed to load email templates', 'error');
    } finally {
      setLoadingEmailTemplates(false);
    }
  };

  const loadPdfTemplates = async () => {
    const storeId = getSelectedStoreId();
    if (!storeId) {
      setPdfTemplates([]);
      return;
    }

    try {
      setLoadingPdfTemplates(true);
      const response = await api.get(`/pdf-templates?store_id=${storeId}`);

      if (response && response.success && response.data) {
        setPdfTemplates(response.data || []);
      }
    } catch (error) {
      console.error('Failed to load PDF templates:', error);
      showMessage('Failed to load PDF templates', 'error');
    } finally {
      setLoadingPdfTemplates(false);
    }
  };

  /**
   * Load product tabs for translation management
   */
  const loadProductTabs = async () => {
    const storeId = getSelectedStoreId();
    if (!storeId) {
      setProductTabs([]);
      return;
    }

    try {
      setLoadingProductTabs(true);
      const response = await api.get(`/product-tabs?store_id=${storeId}&limit=1000`);

      console.log('Product tabs response:', response);

      if (response && response.success && response.data) {
        // Response.data is directly the array of tabs
        const tabs = Array.isArray(response.data) ? response.data : [];
        console.log('Setting product tabs:', tabs);
        setProductTabs(tabs);
      } else {
        console.warn('Unexpected product tabs response format:', response);
        setProductTabs([]);
      }
    } catch (error) {
      console.error('Failed to load product tabs:', error);
      showMessage('Failed to load product tabs', 'error');
      setProductTabs([]);
    } finally {
      setLoadingProductTabs(false);
    }
  };

  /**
   * Load product labels for translation management
   */
  const loadProductLabels = async () => {
    const storeId = getSelectedStoreId();
    if (!storeId) {
      setProductLabels([]);
      return;
    }

    try {
      setLoadingProductLabels(true);
      const response = await api.get(`/product-labels?store_id=${storeId}&limit=1000`);

      if (response && response.success && response.data) {
        // Response.data contains { product_labels: [...] }
        const labels = response.data.product_labels || [];
        setProductLabels(Array.isArray(labels) ? labels : []);
      } else {
        setProductLabels([]);
      }
    } catch (error) {
      showMessage('Failed to load product labels', 'error');
      setProductLabels([]);
    } finally {
      setLoadingProductLabels(false);
    }
  };

  /**
   * Load cookie consent settings for translation management
   */
  const loadCookieConsent = async () => {
    const storeId = getSelectedStoreId();
    if (!storeId) {
      setCookieConsent([]);
      return;
    }

    try {
      setLoadingCookieConsent(true);
      const response = await api.get(`/cookie-consent-settings?store_id=${storeId}`);

      if (response && response.success && response.data) {
        // Response.data is an array of settings (might be multiple per store or one)
        const settings = Array.isArray(response.data) ? response.data : [];

        // Filter out any null/undefined and only keep valid settings
        setCookieConsent(settings.filter(s => s && s.id));
      } else {
        setCookieConsent([]);
      }
    } catch (error) {
      showMessage('Failed to load cookie consent', 'error');
      setCookieConsent([]);
    } finally {
      setLoadingCookieConsent(false);
    }
  };

  /**
   * Load stock settings for translation management
   */
  const loadStockSettings = async () => {
    if (!selectedStore) {
      setStockSettings(null);
      return;
    }

    try {
      setLoadingStockSettings(true);
      const storeSettings = selectedStore.settings || {};
      const stockSettingsData = storeSettings.stock_settings || {};

      // Ensure translations exist with defaults
      const translations = stockSettingsData.translations || {};
      if (!translations.en) {
        translations.en = {
          in_stock_label: stockSettingsData.in_stock_label || 'In Stock',
          out_of_stock_label: stockSettingsData.out_of_stock_label || 'Out of Stock',
          low_stock_label: stockSettingsData.low_stock_label || 'Low stock, {just {quantity} left}'
        };
      }

      setStockSettings({
        ...stockSettingsData,
        translations
      });
    } catch (error) {
      console.error('Failed to load stock settings:', error);
      showMessage('Failed to load stock settings', 'error');
    } finally {
      setLoadingStockSettings(false);
    }
  };

  /**
   * Load custom option rules for translation management
   */
  const loadCustomOptions = async () => {
    const storeId = getSelectedStoreId();
    if (!storeId) {
      setCustomOptions([]);
      return;
    }

    try {
      setLoadingCustomOptions(true);
      const response = await api.get(`/custom-option-rules?store_id=${storeId}&limit=1000`);


      // Custom options API returns array directly, not wrapped in success/data
      if (response) {
        const options = Array.isArray(response) ? response : [];
        setCustomOptions(options);
      } else {
        setCustomOptions([]);
      }
    } catch (error) {
      showMessage('Failed to load custom options', 'error');
      setCustomOptions([]);
    } finally {
      setLoadingCustomOptions(false);
    }
  };

  /**
   * Load entity translation statistics
   */
  const loadEntityStats = async () => {
    const storeId = getSelectedStoreId();
    if (!storeId) {
      setEntityStats([]);
      return;
    }

    try {
      setLoadingEntityStats(true);
      const response = await api.get(`/translations/entity-stats?store_id=${storeId}`);

      if (response && response.success && response.data) {
        setEntityStats(response.data.stats || []);
      }
    } catch (error) {
      showMessage('Failed to load translation statistics', 'error');
    } finally {
      setLoadingEntityStats(false);
    }
  };

  /**
   * Handle entity translation
   */
  const handleEntityTranslate = async (fromLang, toLang) => {
    const storeId = getSelectedStoreId();
    if (!storeId) {
      toast.error("No store selected");
      return { success: false, message: "No store selected" };
    }

    try {
      const endpoint = selectedEntityType === 'category' ? 'categories' :
                       selectedEntityType === 'product' ? 'products' :
                       selectedEntityType === 'attribute' ? 'attributes' :
                       selectedEntityType === 'attribute_value' ? 'attributes/values' :
                       selectedEntityType === 'cms_page' ? 'cms' :
                       selectedEntityType === 'cms_block' ? 'cms-blocks' :
                       selectedEntityType === 'product_tab' ? 'product-tabs' :
                       selectedEntityType === 'product_label' ? 'product-labels' :
                       selectedEntityType === 'cookie_consent' ? 'cookie-consent-settings' :
                       selectedEntityType === 'custom_option' ? 'custom-option-rules' :
                       selectedEntityType === 'email_template' ? 'email-templates' :
                       selectedEntityType === 'pdf_template' ? 'pdf-templates' : null;

      if (!endpoint) {
        throw new Error('Invalid entity type');
      }

      // Use api client which automatically handles authentication

      const data = await api.post(`${endpoint}/bulk-translate`, {
        store_id: storeId,
        fromLang,
        toLang
      });

      // Reload entity stats to update progress
      await loadEntityStats();

      return data;
    } catch (error) {
      return { success: false, message: error.message };
    }
  };

  /**
   * Open translation dialog for specific entity
   */
  const handleOpenEntityTranslation = (entityType, entityName, itemCount = 0) => {
    setSelectedEntityType(entityType);
    setSelectedEntityName(entityName);
    setSelectedEntityItemCount(itemCount);
    setShowBulkTranslateDialog(true);
  };

  /**
   * Handle multi-entity translation
   */
  const handleMultiEntityTranslate = async (entityTypes, fromLang, toLang) => {
    const storeId = getSelectedStoreId();
    if (!storeId) {
      toast.error("No store selected");
      return { success: false, message: "No store selected" };
    }

    try {
      // Use api client which automatically handles authentication
      const data = await api.post('translations/bulk-translate-entities', {
        store_id: storeId,
        entity_types: entityTypes,
        fromLang,
        toLang
      });

      // Reload entity stats to update progress
      await loadEntityStats();

      return data;
    } catch (error) {
      return { success: false, message: error.message };
    }
  };

  /**
   * Add bulk translations
   */
  const addBulkTranslations = async () => {
    const baseKey = bulkTranslations.baseKey;
    if (!baseKey) {
      showMessage('Base key is required', 'error');
      return;
    }

    try {
      setSaving(true);
      const category = bulkTranslations.category || 'common';
      const fullKey = category ? `${category}.${baseKey}` : baseKey;

      const languages = availableLanguages || [];
      const translationsToSave = [];

      if (autoTranslate) {
        // Auto-translate: get the source value from the first filled language or use a specific one
        let sourceValue = null;
        let sourceLang = selectedLanguage;

        // Try to find a value from the form
        for (const lang of languages) {
          const value = bulkTranslations[lang.code];
          if (value && value.trim()) {
            sourceValue = value.trim();
            sourceLang = lang.code;
            break;
          }
        }

        if (!sourceValue) {
          showMessage('Please enter at least one translation value', 'error');
          setSaving(false);
          return;
        }

        // Auto-translate to all languages
        for (const lang of languages) {
          let translatedValue = sourceValue;

          if (lang.code !== sourceLang) {
            try {
              const response = await api.post('/translations/ai-translate', {
                text: sourceValue,
                fromLang: sourceLang,
                toLang: lang.code
              });
              if (response && response.success && response.data) {
                translatedValue = response.data.translated;
              }
            } catch (error) {
              // Skip this language if translation fails
              continue;
            }
          }

          translationsToSave.push({
            key: fullKey,
            language_code: lang.code,
            value: translatedValue,
            category,
            type: 'custom'
          });
        }
      } else {
        // Manual mode: only save languages with values
        for (const lang of languages) {
          const value = bulkTranslations[lang.code];
          if (value && value.trim()) {
            translationsToSave.push({
              key: fullKey,
              language_code: lang.code,
              value: value.trim(),
              category,
              type: 'custom'
            });
          }
        }
      }

      if (translationsToSave.length === 0) {
        showMessage('Please add at least one translation', 'error');
        setSaving(false);
        return;
      }

      // Save in bulk
      const storeId = getSelectedStoreId();
      if (!storeId) {
        showMessage('Please select a store first', 'error');
        setSaving(false);
        return;
      }

      await api.post('/translations/ui-labels/bulk', { store_id: storeId, labels: translationsToSave });

      if (autoTranslate) {
        showMessage(`Successfully added and auto-translated to ${translationsToSave.length} languages`, 'success');
      } else {
        showMessage(`Successfully added translations in ${translationsToSave.length} languages`, 'success');
      }

      // Reload the list from server to ensure fresh data
      await loadLabels(selectedLanguage);

      // Clear form
      setBulkTranslations({});
      setShowBulkAddForm(false);
      setAutoTranslate(false);
    } catch (error) {
      showMessage('Failed to add translations', 'error');
    } finally {
      setSaving(false);
    }
  };

  /**
   * Show message
   */
  const showMessage = (text, type = 'info') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  };

  const showFlash = (text, type = 'success') => {
    setFlashMessageData({ type, message: text });
    setShowFlashMessage(true);
    setTimeout(() => setShowFlashMessage(false), 3000);
  };

  // Load labels when language changes
  useEffect(() => {
    loadLabels(selectedLanguage);
  }, [selectedLanguage]);

  // Load user credits and service costs on component mount
  useEffect(() => {
    loadUserCredits();
    loadServiceCosts();
  }, []);

  // Load entity stats when switching to dashboard or entity tabs or when store changes
  useEffect(() => {
    if (activeTab === 'dashboard' && selectedStore) {
      loadEntityStats();
    }
  }, [activeTab, selectedStore]);

  // Load products when switching to products tab
  useEffect(() => {
    if (activeTab === 'products' && selectedStore) {
      loadProducts();
    }
  }, [activeTab, selectedStore]);

  // Load categories when switching to categories tab
  useEffect(() => {
    if (activeTab === 'categories' && selectedStore) {
      loadCategories();
    }
  }, [activeTab, selectedStore]);

  // Load attributes when switching to attributes tab
  useEffect(() => {
    if (activeTab === 'attributes' && selectedStore) {
      loadAttributes();
    }
  }, [activeTab, selectedStore]);

  // Load CMS pages when switching to CMS Pages tab
  useEffect(() => {
    if (activeTab === 'cms-pages' && selectedStore) {
      loadCmsContent();
    }
  }, [activeTab, selectedStore]);

  // Load CMS blocks when switching to CMS Blocks tab
  useEffect(() => {
    if (activeTab === 'cms-blocks' && selectedStore) {
      loadCmsContent();
    }
  }, [activeTab, selectedStore]);

  // Load email templates when switching to Email Templates tab
  useEffect(() => {
    if (activeTab === 'email-templates' && selectedStore) {
      loadEmailTemplates();
    }
  }, [activeTab, selectedStore]);

  // Load PDF templates when switching to PDF Templates tab
  useEffect(() => {
    if (activeTab === 'pdf-templates' && selectedStore) {
      loadPdfTemplates();
    }
  }, [activeTab, selectedStore]);

  // Load various settings when switching to various tab
  useEffect(() => {
    if (activeTab === 'various' && selectedStore) {
      loadProductTabs();
      loadProductLabels();
      loadCookieConsent();
      loadCustomOptions();
      loadStockSettings();
    }
  }, [activeTab, selectedStore]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Translations</h1>
          <p className="text-gray-600">
            Manage multilingual content for your store
          </p>
        </div>
        <Button
          onClick={() => setShowTranslationWizard(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
        >
          <Wand2 className="w-4 h-4" />
          Translation Wizard
        </Button>
      </div>

      {/* Flash Message */}
      <FlashMessage
        message={message ? { type: message.type, message: message.text } : null}
        onClose={() => setMessage(null)}
      />

      {/* Flash Message for Save Success */}
      {showFlashMessage && (
        <FlashMessage
          message={flashMessageData}
          onClose={() => setShowFlashMessage(false)}
        />
      )}

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <div className="flex gap-4 overflow-x-auto">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`
              px-4 py-2 font-medium border-b-2 transition-colors whitespace-nowrap
              ${activeTab === 'dashboard'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
              }
            `}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('ui-labels')}
            className={`
              px-4 py-2 font-medium border-b-2 transition-colors whitespace-nowrap
              ${activeTab === 'ui-labels'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
              }
            `}
          >
            UI Labels
          </button>
          <button
            onClick={() => setActiveTab('products')}
            className={`
              px-4 py-2 font-medium border-b-2 transition-colors whitespace-nowrap
              ${activeTab === 'products'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
              }
            `}
          >
            Products
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={`
              px-4 py-2 font-medium border-b-2 transition-colors whitespace-nowrap
              ${activeTab === 'categories'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
              }
            `}
          >
            Categories
          </button>
          <button
            onClick={() => setActiveTab('attributes')}
            className={`
              px-4 py-2 font-medium border-b-2 transition-colors whitespace-nowrap
              ${activeTab === 'attributes'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
              }
            `}
          >
            Attributes
          </button>
          <button
            onClick={() => setActiveTab('cms-pages')}
            className={`
              px-4 py-2 font-medium border-b-2 transition-colors whitespace-nowrap
              ${activeTab === 'cms-pages'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
              }
            `}
          >
            CMS Pages
          </button>
          <button
            onClick={() => setActiveTab('cms-blocks')}
            className={`
              px-4 py-2 font-medium border-b-2 transition-colors whitespace-nowrap
              ${activeTab === 'cms-blocks'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
              }
            `}
          >
            CMS Blocks
          </button>
          <button
            onClick={() => setActiveTab('email-templates')}
            className={`
              px-4 py-2 font-medium border-b-2 transition-colors whitespace-nowrap
              ${activeTab === 'email-templates'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
              }
            `}
          >
            Email Templates
          </button>
          <button
            onClick={() => setActiveTab('pdf-templates')}
            className={`
              px-4 py-2 font-medium border-b-2 transition-colors whitespace-nowrap
              ${activeTab === 'pdf-templates'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
              }
            `}
          >
            PDF Templates
          </button>
          <button
            onClick={() => setActiveTab('various')}
            className={`
              px-4 py-2 font-medium border-b-2 transition-colors whitespace-nowrap
              ${activeTab === 'various'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
              }
            `}
          >
            Various
          </button>
        </div>
      </div>

      {/* UI Labels Tab */}
      {activeTab === 'ui-labels' && (
        <div className="space-y-6" onKeyDown={(e) => {
          if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
            e.preventDefault();
          }
        }}>
          {/* Controls */}
          <div className="flex flex-wrap items-center gap-4">
            {/* Language selector */}
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-gray-400" />
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {(availableLanguages || []).map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.native_name || lang.name || lang.code} ({lang.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Search */}
            <div className="flex-1 max-w-md relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search labels by key or text..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Category filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

            {/* Actions */}
            <div className="flex gap-2 ml-auto">
              <button
                type="button"
                onClick={() => {
                  setSelectedEntityType(null);
                  setSelectedEntityName('UI Labels');
                  setSelectedEntityItemCount(filteredLabels.length);
                  setShowBulkTranslateDialog(true);
                }}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
              >
                <Languages className="w-4 h-4" />
                Bulk AI Translate UI Labels
              </button>

              <button
                type="button"
                onClick={() => setShowBulkAddForm(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Translation
              </button>
            </div>
          </div>

          {/* Bulk Add form */}
          {showBulkAddForm && (
            <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Add Translation in Multiple Languages</h3>
                <button
                  type="button"
                  onClick={() => setShowBulkAddForm(false)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={bulkTranslations.category || 'common'}
                    onChange={(e) => setBulkTranslations({ ...bulkTranslations, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Key</label>
                  <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500">
                    <span className="px-3 py-2 bg-gray-100 text-gray-600 text-sm font-mono border-r border-gray-300">
                      {bulkTranslations.category || 'common'}.
                    </span>
                    <input
                      type="text"
                      placeholder="button_submit"
                      value={bulkTranslations.baseKey || ''}
                      onChange={(e) => setBulkTranslations({ ...bulkTranslations, baseKey: e.target.value })}
                      className="flex-1 px-3 py-2 border-0 focus:outline-none focus:ring-0"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <input
                  type="checkbox"
                  id="autoTranslate"
                  checked={autoTranslate}
                  onChange={(e) => setAutoTranslate(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="autoTranslate" className="text-sm text-blue-900 cursor-pointer">
                  Auto-translate to all active languages using AI (just fill in one language)
                </label>
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">
                  {autoTranslate ? `Source Translation (${selectedLanguage})` : 'Translations by Language'}
                </label>
                {autoTranslate ? (
                  // Auto-translate mode: only show selected language input
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-gray-600">
                      {(availableLanguages || []).find(l => l.code === selectedLanguage)?.native_name || selectedLanguage} ({selectedLanguage})
                    </label>
                    <textarea
                      placeholder={`Enter ${selectedLanguage} translation to auto-translate...`}
                      value={bulkTranslations[selectedLanguage] || ''}
                      onChange={(e) => setBulkTranslations({ ...bulkTranslations, [selectedLanguage]: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      autoFocus
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      This will be automatically translated to {(availableLanguages || []).length - 1} other active {(availableLanguages || []).length - 1 === 1 ? 'language' : 'languages'}
                    </p>
                  </div>
                ) : (
                  // Manual mode: show all language inputs
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(availableLanguages || []).map((lang) => (
                      <div key={lang.code} className="space-y-1">
                        <label className="block text-xs font-medium text-gray-600">
                          {lang.native_name || lang.name} ({lang.code})
                        </label>
                        <textarea
                          placeholder={`Enter ${lang.code} translation...`}
                          value={bulkTranslations[lang.code] || ''}
                          onChange={(e) => setBulkTranslations({ ...bulkTranslations, [lang.code]: e.target.value })}
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={addBulkTranslations}
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {saving ? 'Saving...' : (autoTranslate ? 'Add & Auto-translate' : 'Add Translations')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowBulkAddForm(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Labels table */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-gray-500">Loading translations...</div>
            ) : filteredLabels.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No translations found. {selectedLanguage !== 'en' && 'Try using AI Translate All to get started.'}
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Key</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Category</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Type</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Value</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredLabels.map((label) => (
                    <tr key={label.key} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-mono text-gray-600">
                        {label.key}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                          {label.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          label.type === 'custom'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {label.type || 'system'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {editingKey === label.key ? (
                          <textarea
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              e.stopPropagation();
                            }}
                            rows={2}
                            className="w-full px-2 py-1 border border-gray-300 rounded"
                            autoFocus
                          />
                        ) : (
                          <span className="text-gray-900">
                            {typeof label.value === 'object' ? JSON.stringify(label.value) : String(label.value || '')}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        {editingKey === label.key ? (
                          <div className="flex gap-2 justify-end">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                saveLabel(label.key, editValue, label.category, label.type);
                                return false;
                              }}
                              disabled={saving}
                              className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            >
                              <Save className="w-4 h-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setEditingKey(null);
                                return false;
                              }}
                              className="text-gray-600 hover:text-gray-700 hover:bg-gray-100"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex gap-2 justify-end">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingKey(label.key);
                                setEditValue(label.value);
                              }}
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              title="Edit translation"
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            {label.type === 'custom' && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteLabel(label.key)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                title="Delete custom translation"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Stats */}
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>
              Showing {filteredLabels.length} of {labels.length} labels
            </span>
            <span>
              Language: {(availableLanguages || []).find(l => l.code === selectedLanguage)?.native_name || selectedLanguage}
            </span>
          </div>
        </div>
      )}

      {/* Products Tab */}
      {activeTab === 'products' && (
        <div className="space-y-6">
          {!selectedStore ? (
            <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-500">
              <Globe className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                No Store Selected
              </h3>
              <p>
                Please select a store to manage product translations.
              </p>
            </div>
          ) : (
            <>
              {/* Header and Search */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">Product Translations</h2>
                    <p className="text-sm text-gray-600 mt-1">
                      Manage translations for all product fields across languages
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedEntityType('product');
                      setSelectedEntityName('Products');
                      setSelectedEntityItemCount(products.length);
                      setShowBulkTranslateDialog(true);
                    }}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
                  >
                    <Languages className="w-4 h-4" />
                    Bulk AI Translate Products
                  </button>
                </div>

                {/* Language Selection */}
                <div className="mb-4">
                  <div className="flex flex-wrap gap-2">
                    {availableLanguages.map((lang) => (
                      <label
                        key={lang.code}
                        className="flex items-center gap-1.5 px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 cursor-pointer text-xs"
                      >
                        <input
                          type="checkbox"
                          checked={selectedTranslationLanguages.includes(lang.code)}
                          onChange={() => handleToggleTranslationLanguage(lang.code)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="font-medium">{lang.code.toUpperCase()}</span>
                        <span className="text-gray-600">({lang.native_name})</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Search Bar */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search products by name or SKU..."
                    value={productSearchQuery}
                    onChange={(e) => setProductSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Products List */}
              {loadingProducts ? (
                <PageLoader size="lg" fullScreen={false} className="bg-white border border-gray-200 rounded-lg p-12" text="Loading products..." />
              ) : products.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-500">
                  <Globe className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">
                    No Products Found
                  </h3>
                  <p>
                    Start by adding products to your store.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {products
                    .filter(product => {
                      if (!productSearchQuery.trim()) return true;
                      const query = productSearchQuery.toLowerCase();
                      const name = (product.translations?.en?.name || product.name || '').toLowerCase();
                      const sku = (product.sku || '').toLowerCase();
                      return name.includes(query) || sku.includes(query);
                    })
                    .map((product) => (
                      <ProductTranslationRow
                        key={product.id}
                        product={product}
                        selectedLanguages={selectedTranslationLanguages}
                        onFlashMessage={showFlash}
                        userCredits={userCredits}
                        onUpdate={(productId, translations) => {
                          // Update local state
                          setProducts(products.map(p =>
                            p.id === productId ? { ...p, translations } : p
                          ));
                        }}
                        storeId={getSelectedStoreId()}
                      />
                    ))}
                </div>
              )}

              {/* Count Info */}
              {products.length > 0 && (
                <div className="text-sm text-gray-600 text-center">
                  Showing {products.filter(product => {
                    if (!productSearchQuery.trim()) return true;
                    const query = productSearchQuery.toLowerCase();
                    const name = (product.translations?.en?.name || product.name || '').toLowerCase();
                    const sku = (product.sku || '').toLowerCase();
                    return name.includes(query) || sku.includes(query);
                  }).length} of {products.length} products
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Categories Tab */}
      {activeTab === 'categories' && (
        <div className="space-y-6">
          {!selectedStore ? (
            <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-500">
              <Globe className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                No Store Selected
              </h3>
              <p>
                Please select a store to manage category translations.
              </p>
            </div>
          ) : (
            <>
              {/* Header and Search */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">Category Translations</h2>
                    <p className="text-sm text-gray-600 mt-1">
                      Manage translations for all category fields across languages
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedEntityType('category');
                      setSelectedEntityName('Categories');
                      setSelectedEntityItemCount(productCategories.length);
                      setShowBulkTranslateDialog(true);
                    }}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
                  >
                    <Languages className="w-4 h-4" />
                    Bulk AI Translate Categories
                  </button>
                </div>

                {/* Language Selection */}
                <div className="mb-4">
                  <div className="flex flex-wrap gap-2">
                    {availableLanguages.map((lang) => (
                      <label
                        key={lang.code}
                        className="flex items-center gap-1.5 px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 cursor-pointer text-xs"
                      >
                        <input
                          type="checkbox"
                          checked={selectedTranslationLanguages.includes(lang.code)}
                          onChange={() => handleToggleTranslationLanguage(lang.code)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="font-medium">{lang.code.toUpperCase()}</span>
                        <span className="text-gray-600">({lang.native_name})</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Search Bar */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search categories by name or slug..."
                    value={categorySearchQuery}
                    onChange={(e) => setCategorySearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Categories List */}
              {loadingCategories ? (
                <PageLoader size="lg" fullScreen={false} className="bg-white border border-gray-200 rounded-lg p-12" text="Loading categories..." />
              ) : productCategories.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-500">
                  <Globe className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">
                    No Categories Found
                  </h3>
                  <p>
                    Start by adding categories to your store.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {productCategories
                    .filter(category => {
                      if (!categorySearchQuery.trim()) return true;
                      const query = categorySearchQuery.toLowerCase();
                      const name = (category.translations?.en?.name || category.name || '').toLowerCase();
                      const slug = (category.slug || '').toLowerCase();
                      return name.includes(query) || slug.includes(query);
                    })
                    .map((category) => (
                      <CategoryTranslationRow
                        key={category.id}
                        category={category}
                        selectedLanguages={selectedTranslationLanguages}
                        onFlashMessage={showFlash}
                        userCredits={userCredits}
                        onUpdate={(categoryId, translations) => {
                          // Update local state
                          setProductCategories(productCategories.map(c =>
                            c.id === categoryId ? { ...c, translations } : c
                          ));
                        }}
                        storeId={getSelectedStoreId()}
                      />
                    ))}
                </div>
              )}

              {/* Count Info */}
              {productCategories.length > 0 && (
                <div className="text-sm text-gray-600 text-center">
                  Showing {productCategories.filter(category => {
                    if (!categorySearchQuery.trim()) return true;
                    const query = categorySearchQuery.toLowerCase();
                    const name = (category.translations?.en?.name || category.name || '').toLowerCase();
                    const slug = (category.slug || '').toLowerCase();
                    return name.includes(query) || slug.includes(query);
                  }).length} of {productCategories.length} categories
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Attributes Tab */}
      {activeTab === 'attributes' && (
        <div className="space-y-6">
          {!selectedStore ? (
            <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-500">
              <Globe className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                No Store Selected
              </h3>
              <p>
                Please select a store to manage attribute translations.
              </p>
            </div>
          ) : (
            <>
              {/* Header and Search */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">Attribute Translations</h2>
                    <p className="text-sm text-gray-600 mt-1">
                      Manage translations for attribute names and options across languages
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedEntityType('attribute');
                      setSelectedEntityName('Attributes');
                      setSelectedEntityItemCount(productAttributes.length);
                      setShowBulkTranslateDialog(true);
                    }}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
                  >
                    <Languages className="w-4 h-4" />
                    Bulk AI Translate Attributes
                  </button>
                </div>

                {/* Language Selection */}
                <div className="mb-4">
                  <div className="flex flex-wrap gap-2">
                    {availableLanguages.map((lang) => (
                      <label
                        key={lang.code}
                        className="flex items-center gap-1.5 px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 cursor-pointer text-xs"
                      >
                        <input
                          type="checkbox"
                          checked={selectedTranslationLanguages.includes(lang.code)}
                          onChange={() => handleToggleTranslationLanguage(lang.code)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="font-medium">{lang.code.toUpperCase()}</span>
                        <span className="text-gray-600">({lang.native_name})</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Search Bar */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search attributes by name or code..."
                    value={attributeSearchQuery}
                    onChange={(e) => setAttributeSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Attributes List */}
              {loadingAttributes ? (
                <PageLoader size="lg" fullScreen={false} className="bg-white border border-gray-200 rounded-lg p-12" text="Loading attributes..." />
              ) : productAttributes.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-500">
                  <Globe className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">
                    No Attributes Found
                  </h3>
                  <p>
                    Start by adding attributes to your store.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {productAttributes
                    .filter(attribute => {
                      if (!attributeSearchQuery.trim()) return true;
                      const query = attributeSearchQuery.toLowerCase();
                      const name = (attribute.translations?.en?.name || attribute.name || '').toLowerCase();
                      const code = (attribute.code || '').toLowerCase();
                      return name.includes(query) || code.includes(query);
                    })
                    .map((attribute) => (
                      <AttributeTranslationRow
                        key={attribute.id}
                        attribute={attribute}
                        selectedLanguages={selectedTranslationLanguages}
                        onFlashMessage={showFlash}
                        userCredits={userCredits}
                        onUpdate={(attributeId, translations, values) => {
                          // Update local state
                          setProductAttributes(productAttributes.map(a =>
                            a.id === attributeId ? { ...a, translations, values } : a
                          ));
                        }}
                        storeId={getSelectedStoreId()}
                      />
                    ))}
                </div>
              )}

              {/* Count Info */}
              {productAttributes.length > 0 && (
                <div className="text-sm text-gray-600 text-center">
                  Showing {productAttributes.filter(attribute => {
                    if (!attributeSearchQuery.trim()) return true;
                    const query = attributeSearchQuery.toLowerCase();
                    const name = (attribute.translations?.en?.name || attribute.name || '').toLowerCase();
                    const code = (attribute.code || '').toLowerCase();
                    return name.includes(query) || code.includes(query);
                  }).length} of {productAttributes.length} attributes
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* CMS Pages Tab */}
      {activeTab === 'cms-pages' && (
        <div className="space-y-6">
          {!selectedStore ? (
            <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-500">
              <Globe className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                No Store Selected
              </h3>
              <p>
                Please select a store to manage CMS content translations.
              </p>
            </div>
          ) : (
            <>
              {/* Header and Search */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">CMS Pages Translations</h2>
                    <p className="text-sm text-gray-600 mt-1">
                      Manage translations for CMS pages across languages
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedEntityType('cms_page');
                      setSelectedEntityName('CMS Pages');
                      setSelectedEntityItemCount(cmsPages.length);
                      setShowBulkTranslateDialog(true);
                    }}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
                  >
                    <Languages className="w-4 h-4" />
                    Bulk AI Translate CMS Pages
                  </button>
                </div>

                {/* Language Selection */}
                <div className="mb-4">
                  <div className="flex flex-wrap gap-2">
                    {availableLanguages.map((lang) => (
                      <label
                        key={lang.code}
                        className="flex items-center gap-1.5 px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 cursor-pointer text-xs"
                      >
                        <input
                          type="checkbox"
                          checked={selectedTranslationLanguages.includes(lang.code)}
                          onChange={() => handleToggleTranslationLanguage(lang.code)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="font-medium">{lang.code.toUpperCase()}</span>
                        <span className="text-gray-600">({lang.native_name})</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Search Bar */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search pages by title or slug..."
                    value={cmsSearchQuery}
                    onChange={(e) => setCmsSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* CMS Pages List */}
              {loadingCms ? (
                <PageLoader size="lg" fullScreen={false} className="bg-white border border-gray-200 rounded-lg p-12" text="Loading CMS pages..." />
              ) : cmsPages.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-500">
                  <Globe className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">
                    No CMS Pages Found
                  </h3>
                  <p>
                    Start by adding CMS pages to your store.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cmsPages
                    .filter(page => {
                      if (!cmsSearchQuery.trim()) return true;
                      const query = cmsSearchQuery.toLowerCase();
                      const title = (page.translations?.en?.title || '').toLowerCase();
                      const slug = (page.slug || '').toLowerCase();
                      return title.includes(query) || slug.includes(query);
                    })
                    .map((page) => (
                      <CmsPageTranslationRow
                        key={page.id}
                        page={page}
                        selectedLanguages={selectedTranslationLanguages}
                        onFlashMessage={showFlash}
                        userCredits={userCredits}
                        onUpdate={(pageId, translations) => {
                          setCmsPages(cmsPages.map(p =>
                            p.id === pageId ? { ...p, translations } : p
                          ));
                        }}
                        storeId={getSelectedStoreId()}
                        translationCost={serviceCosts['ai_translation_cms_page'] || 0.5}
                        onCreditsDeducted={handleCreditsDeducted}
                      />
                    ))}
                </div>
              )}

              {/* Count Info */}
              {cmsPages.length > 0 && (
                <div className="text-sm text-gray-600 text-center">
                  <span>
                    Showing {cmsPages.filter(page => {
                      if (!cmsSearchQuery.trim()) return true;
                      const query = cmsSearchQuery.toLowerCase();
                      const title = (page.translations?.en?.title || '').toLowerCase();
                      const slug = (page.slug || '').toLowerCase();
                      return title.includes(query) || slug.includes(query);
                    }).length} of {cmsPages.length} pages
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* CMS Blocks Tab */}
      {activeTab === 'cms-blocks' && (
        <div className="space-y-6">
          {!selectedStore ? (
            <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-500">
              <Globe className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                No Store Selected
              </h3>
              <p>
                Please select a store to manage CMS block translations.
              </p>
            </div>
          ) : (
            <>
              {/* Header and Search */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">CMS Blocks Translations</h2>
                    <p className="text-sm text-gray-600 mt-1">
                      Manage translations for CMS blocks across languages
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedEntityType('cms_block');
                      setSelectedEntityName('CMS Blocks');
                      setSelectedEntityItemCount(cmsBlocks.length);
                      setShowBulkTranslateDialog(true);
                    }}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
                  >
                    <Languages className="w-4 h-4" />
                    Bulk AI Translate CMS Blocks
                  </button>
                </div>

                {/* Language Selection */}
                <div className="mb-4">
                  <div className="flex flex-wrap gap-2">
                    {availableLanguages.map((lang) => (
                      <label
                        key={lang.code}
                        className="flex items-center gap-1.5 px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 cursor-pointer text-xs"
                      >
                        <input
                          type="checkbox"
                          checked={selectedTranslationLanguages.includes(lang.code)}
                          onChange={() => handleToggleTranslationLanguage(lang.code)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="font-medium">{lang.code.toUpperCase()}</span>
                        <span className="text-gray-600">({lang.native_name})</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Search Bar */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search blocks by title or identifier..."
                    value={cmsSearchQuery}
                    onChange={(e) => setCmsSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* CMS Blocks List */}
              {loadingCms ? (
                <PageLoader size="lg" fullScreen={false} className="bg-white border border-gray-200 rounded-lg p-12" text="Loading CMS blocks..." />
              ) : cmsBlocks.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-500">
                  <Globe className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">
                    No CMS Blocks Found
                  </h3>
                  <p>
                    Start by adding CMS blocks to your store.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cmsBlocks
                    .filter(block => {
                      if (!cmsSearchQuery.trim()) return true;
                      const query = cmsSearchQuery.toLowerCase();
                      const title = (block.translations?.en?.title || block.title || '').toLowerCase();
                      const identifier = (block.identifier || '').toLowerCase();
                      return title.includes(query) || identifier.includes(query);
                    })
                    .map((block) => (
                      <CmsBlockTranslationRow
                        key={block.id}
                        block={block}
                        selectedLanguages={selectedTranslationLanguages}
                        onFlashMessage={showFlash}
                        userCredits={userCredits}
                        onUpdate={(blockId, translations) => {
                          setCmsBlocks(cmsBlocks.map(b =>
                            b.id === blockId ? { ...b, translations } : b
                          ));
                        }}
                        storeId={getSelectedStoreId()}
                      />
                    ))}
                </div>
              )}

              {/* Count Info */}
              {cmsBlocks.length > 0 && (
                <div className="text-sm text-gray-600 text-center">
                  <span>
                    Showing {cmsBlocks.filter(block => {
                      if (!cmsSearchQuery.trim()) return true;
                      const query = cmsSearchQuery.toLowerCase();
                      const title = (block.translations?.en?.title || block.title || '').toLowerCase();
                      const identifier = (block.identifier || '').toLowerCase();
                      return title.includes(query) || identifier.includes(query);
                    }).length} of {cmsBlocks.length} blocks
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Email Templates Tab */}
      {activeTab === 'email-templates' && (
        <div className="space-y-6">
          {!selectedStore ? (
            <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-500">
              <Globe className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                No Store Selected
              </h3>
              <p>
                Please select a store to manage email template translations.
              </p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">Email Template Translations</h2>
                    <p className="text-sm text-gray-600">
                      Manage translations for email templates sent to customers
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedEntityType('email_template');
                      setSelectedEntityName('Email Templates');
                      setSelectedEntityItemCount(emailTemplates.length);
                      setShowBulkTranslateDialog(true);
                    }}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
                  >
                    <Languages className="w-4 h-4" />
                    Bulk AI Translate Email Templates
                  </button>
                </div>

                {/* Language Selection */}
                <div className="flex flex-wrap gap-2">
                  {availableLanguages.map((lang) => (
                    <label
                      key={lang.code}
                      className="flex items-center gap-1.5 px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 cursor-pointer text-xs"
                    >
                      <input
                        type="checkbox"
                        checked={selectedTranslationLanguages.includes(lang.code)}
                        onChange={() => handleToggleTranslationLanguage(lang.code)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="font-medium">{lang.code.toUpperCase()}</span>
                      <span className="text-gray-600">({lang.native_name})</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Loading State */}
              {loadingEmailTemplates && (
                <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-4 text-gray-600">Loading email templates...</p>
                </div>
              )}

              {/* Email Templates List */}
              {!loadingEmailTemplates && emailTemplates.length > 0 && (
                <div className="space-y-4">
                  {emailTemplates
                    .filter((template) => {
                      if (!emailTemplateSearchQuery) return true;
                      const query = emailTemplateSearchQuery.toLowerCase();
                      return (
                        template.identifier?.toLowerCase().includes(query) ||
                        template.translations?.en?.subject?.toLowerCase().includes(query)
                      );
                    })
                    .map((template) => (
                      <EmailTemplateTranslationRow
                        key={template.id}
                        template={template}
                        onUpdate={(id, translations) => {
                          setEmailTemplates(prev => prev.map(t => t.id === id ? { ...t, translations } : t));
                        }}
                        selectedLanguages={selectedTranslationLanguages}
                        onFlashMessage={showFlash}
                        storeId={getSelectedStoreId()}
                        userCredits={userCredits}
                        translationCost={serviceCosts['ai_translation_email_template'] || 1}
                        onCreditsDeducted={handleCreditsDeducted}
                      />
                    ))}
                </div>
              )}

              {/* Empty State */}
              {!loadingEmailTemplates && emailTemplates.length === 0 && (
                <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-500">
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">
                    No Email Templates Found
                  </h3>
                  <p>
                    Create email templates in Settings → Email Templates to manage translations.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* PDF Templates Tab */}
      {activeTab === 'pdf-templates' && (
        <div className="space-y-6">
          {!selectedStore ? (
            <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-500">
              <Globe className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                No Store Selected
              </h3>
              <p>
                Please select a store to manage PDF template translations.
              </p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">PDF Template Translations</h2>
                    <p className="text-sm text-gray-600">
                      Manage translations for PDF documents (invoices, shipments, etc.)
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedEntityType('pdf_template');
                      setSelectedEntityName('PDF Templates');
                      setSelectedEntityItemCount(pdfTemplates.length);
                      setShowBulkTranslateDialog(true);
                    }}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
                  >
                    <Languages className="w-4 h-4" />
                    Bulk AI Translate PDF Templates
                  </button>
                </div>

                {/* Language Selection */}
                <div className="flex flex-wrap gap-2">
                  {availableLanguages.map((lang) => (
                    <label
                      key={lang.code}
                      className="flex items-center gap-1.5 px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 cursor-pointer text-xs"
                    >
                      <input
                        type="checkbox"
                        checked={selectedTranslationLanguages.includes(lang.code)}
                        onChange={() => handleToggleTranslationLanguage(lang.code)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="font-medium">{lang.code.toUpperCase()}</span>
                      <span className="text-gray-600">({lang.native_name})</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Loading State */}
              {loadingPdfTemplates && (
                <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-4 text-gray-600">Loading PDF templates...</p>
                </div>
              )}

              {/* PDF Templates List */}
              {!loadingPdfTemplates && pdfTemplates.length > 0 && (
                <div className="space-y-4">
                  {pdfTemplates
                    .filter((template) => {
                      if (!pdfTemplateSearchQuery) return true;
                      const query = pdfTemplateSearchQuery.toLowerCase();
                      return (
                        template.identifier?.toLowerCase().includes(query) ||
                        template.name?.toLowerCase().includes(query) ||
                        template.template_type?.toLowerCase().includes(query)
                      );
                    })
                    .map((template) => (
                      <PdfTemplateTranslationRow
                        key={template.id}
                        template={template}
                        onUpdate={(id, translations) => {
                          setPdfTemplates(prev => prev.map(t => t.id === id ? { ...t, translations } : t));
                        }}
                        selectedLanguages={selectedTranslationLanguages}
                        onFlashMessage={showFlash}
                        storeId={getSelectedStoreId()}
                        userCredits={userCredits}
                        translationCost={serviceCosts['ai_translation_pdf_template'] || 0.1}
                        onCreditsDeducted={handleCreditsDeducted}
                      />
                    ))}
                </div>
              )}

              {/* Empty State */}
              {!loadingPdfTemplates && pdfTemplates.length === 0 && (
                <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-500">
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">
                    No PDF Templates Found
                  </h3>
                  <p>
                    PDF templates are automatically created for your store.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Various Tab (Product Tabs, Labels, Cookie Consent, Custom Options, Stock Settings) */}
      {activeTab === 'various' && (
        <div className="space-y-6">
          {!selectedStore ? (
            <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-500">
              <Globe className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                No Store Selected
              </h3>
              <p>
                Please select a store to manage various translations.
              </p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="mb-4">
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">Various Translations</h2>
                  <p className="text-sm text-gray-600">
                    Manage translations for cookie consent and other miscellaneous settings
                  </p>
                </div>

                {/* Language Selection */}
                <div className="flex flex-wrap gap-2">
                  {availableLanguages.map((lang) => (
                    <label
                      key={lang.code}
                      className="flex items-center gap-1.5 px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 cursor-pointer text-xs"
                    >
                      <input
                        type="checkbox"
                        checked={selectedTranslationLanguages.includes(lang.code)}
                        onChange={() => handleToggleTranslationLanguage(lang.code)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="font-medium">{lang.code.toUpperCase()}</span>
                      <span className="text-gray-600">({lang.native_name})</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Product Tabs Section */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Product Tabs</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Custom tabs shown on product detail pages
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedEntityType('product_tab');
                      setSelectedEntityName('Product Tabs');
                      setSelectedEntityItemCount(productTabs.length);
                      setShowBulkTranslateDialog(true);
                    }}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
                  >
                    <Languages className="w-4 h-4" />
                    Bulk AI Translate Tabs
                  </button>
                </div>

                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search product tabs..."
                    value={productTabSearchQuery}
                    onChange={(e) => setProductTabSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {loadingProductTabs ? (
                  <div className="py-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <p className="text-sm text-gray-600">Loading product tabs...</p>
                  </div>
                ) : productTabs.length === 0 ? (
                  <div className="py-6 text-center text-gray-500">
                    <p className="text-sm">No product tabs found. Start by adding tabs to your store.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {productTabs
                      .filter(tab => {
                        if (!productTabSearchQuery.trim()) return true;
                        const query = productTabSearchQuery.toLowerCase();
                        const title = (tab.translations?.en?.title || tab.title || '').toLowerCase();
                        return title.includes(query);
                      })
                      .map((tab) => (
                        <ProductTabTranslationRow
                          key={tab.id}
                          tab={tab}
                          selectedLanguages={selectedTranslationLanguages}
                          onFlashMessage={showFlash}
                          userCredits={userCredits}
                          onUpdate={(tabId, translations) => {
                            setProductTabs(productTabs.map(t =>
                              t.id === tabId ? { ...t, translations } : t
                            ));
                          }}
                          storeId={getSelectedStoreId()}
                        />
                      ))}
                  </div>
                )}
              </div>

              {/* Product Labels Section */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Product Labels</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Labels like "New", "Sale", "Featured" shown on products
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedEntityType('product_label');
                      setSelectedEntityName('Product Labels');
                      setSelectedEntityItemCount(productLabels.length);
                      setShowBulkTranslateDialog(true);
                    }}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
                  >
                    <Languages className="w-4 h-4" />
                    Bulk AI Translate Labels
                  </button>
                </div>

                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search product labels..."
                    value={productLabelSearchQuery}
                    onChange={(e) => setProductLabelSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {loadingProductLabels ? (
                  <div className="py-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <p className="text-sm text-gray-600">Loading product labels...</p>
                  </div>
                ) : productLabels.length === 0 ? (
                  <div className="py-6 text-center text-gray-500">
                    <p className="text-sm">No product labels found. Start by adding labels to your store.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {productLabels
                      .filter(label => {
                        if (!productLabelSearchQuery.trim()) return true;
                        const query = productLabelSearchQuery.toLowerCase();
                        const text = (label.translations?.en?.text || label.text || '').toLowerCase();
                        return text.includes(query);
                      })
                      .map((label) => (
                        <ProductLabelTranslationRow
                          key={label.id}
                          label={label}
                          selectedLanguages={selectedTranslationLanguages}
                          onFlashMessage={showFlash}
                          userCredits={userCredits}
                          onUpdate={(labelId, translations) => {
                            setProductLabels(productLabels.map(l =>
                              l.id === labelId ? { ...l, translations } : l
                            ));
                          }}
                          storeId={getSelectedStoreId()}
                        />
                      ))}
                  </div>
                )}
              </div>

              {/* Cookie Consent Section */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Cookie Consent</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Configure text shown in cookie consent banners
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedEntityType('cookie_consent');
                      setSelectedEntityName('Cookie Consent');
                      setSelectedEntityItemCount(cookieConsent.length);
                      setShowBulkTranslateDialog(true);
                    }}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
                  >
                    <Languages className="w-4 h-4" />
                    Bulk AI Translate
                  </button>
                </div>

                {loadingCookieConsent ? (
                  <div className="py-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <p className="text-sm text-gray-600">Loading cookie consent...</p>
                  </div>
                ) : cookieConsent.length === 0 ? (
                  <div className="py-6 text-center text-gray-500">
                    <p className="text-sm">No cookie consent settings found. Configure settings for your store.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {cookieConsent.map((settings) => (
                      <CookieConsentTranslationRow
                        key={settings.id}
                        settings={settings}
                        selectedLanguages={selectedTranslationLanguages}
                        onFlashMessage={showFlash}
                        userCredits={userCredits}
                        onUpdate={(settingsId, translations) => {
                          setCookieConsent(cookieConsent.map(s =>
                            s.id === settingsId ? { ...s, translations } : s
                          ));
                        }}
                        storeId={getSelectedStoreId()}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Custom Options Section */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Custom Options</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Custom product option rules and configurations
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedEntityType('custom_option');
                      setSelectedEntityName('Custom Options');
                      setSelectedEntityItemCount(customOptions.length);
                      setShowBulkTranslateDialog(true);
                    }}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
                  >
                    <Languages className="w-4 h-4" />
                    Bulk AI Translate Options
                  </button>
                </div>

                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search custom options..."
                    value={customOptionSearchQuery}
                    onChange={(e) => setCustomOptionSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {loadingCustomOptions ? (
                  <div className="py-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <p className="text-sm text-gray-600">Loading custom options...</p>
                  </div>
                ) : customOptions.length === 0 ? (
                  <div className="py-6 text-center text-gray-500">
                    <p className="text-sm">No custom options found. Start by adding custom option rules to your store.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {customOptions
                      .filter(option => {
                        if (!customOptionSearchQuery.trim()) return true;
                        const query = customOptionSearchQuery.toLowerCase();
                        const name = (option.name || '').toLowerCase();
                        const displayLabel = (option.translations?.en?.display_label || option.display_label || '').toLowerCase();
                        return name.includes(query) || displayLabel.includes(query);
                      })
                      .map((option) => (
                        <CustomOptionTranslationRow
                          key={option.id}
                          rule={option}
                          selectedLanguages={selectedTranslationLanguages}
                          onFlashMessage={showFlash}
                          userCredits={userCredits}
                          onUpdate={(ruleId, translations) => {
                            setCustomOptions(customOptions.map(o =>
                              o.id === ruleId ? { ...o, translations } : o
                            ));
                          }}
                          storeId={getSelectedStoreId()}
                        />
                      ))}
                  </div>
                )}
              </div>

              {/* Stock Labels Section */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Stock Labels</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Translatable text labels shown on products based on stock status
                  </p>
                </div>

                {loadingStockSettings ? (
                  <div className="py-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <p className="text-sm text-gray-600">Loading stock labels...</p>
                  </div>
                ) : !stockSettings ? (
                  <div className="py-6 text-center text-gray-500">
                    <p className="text-sm">No stock label settings found.</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-3">
                      <StockLabelTranslationRow
                        storeId={getSelectedStoreId()}
                        stockSettings={stockSettings}
                        selectedLanguages={selectedTranslationLanguages}
                        onFlashMessage={showFlash}
                        onUpdate={(translations) => {
                          setStockSettings({ ...stockSettings, translations });
                        }}
                      />
                    </div>

                    {/* Compact Help Documentation */}
                    <div className="mt-6 border-l-4 border-blue-500 bg-blue-50 p-4 rounded">
                      <h4 className="font-semibold text-blue-900 mb-3">Dynamic Placeholders & Examples</h4>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-4">
                        <div className="bg-white border border-blue-200 rounded p-3">
                          <div className="font-medium text-gray-900 mb-2">Available Placeholders</div>
                          <div className="space-y-1 text-xs">
                            <div><code className="bg-blue-100 px-1 rounded">{'{quantity}'}</code> → Stock number (5, 20, etc.)</div>
                            <div><code className="bg-blue-100 px-1 rounded">{'{item}'}</code> → Translatable (common.item/common.items)</div>
                            <div><code className="bg-blue-100 px-1 rounded">{'{unit}'}</code> → Translatable (common.unit/common.units)</div>
                            <div><code className="bg-blue-100 px-1 rounded">{'{piece}'}</code> → Translatable (common.piece/common.pieces)</div>
                          </div>
                        </div>

                        <div className="bg-white border border-blue-200 rounded p-3">
                          <div className="font-medium text-gray-900 mb-2">Usage Examples</div>
                          <div className="space-y-1 text-xs">
                            <div className="font-mono bg-gray-50 p-1 rounded">In Stock {'{({quantity} left)}'}</div>
                            <div className="text-gray-600">→ "In Stock (5 left)" or "In Stock"</div>
                            <div className="font-mono bg-gray-50 p-1 rounded mt-2">Low stock{', {just {quantity} {item}}'}</div>
                            <div className="text-gray-600">→ "Low stock, just 2 items" or "Low stock"</div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white border border-blue-200 rounded p-3 text-xs space-y-1">
                        <div><strong>Smart Privacy:</strong> Nested braces <code className="bg-blue-100 px-1">{'{...}'}</code> are auto-hidden when "Hide Stock Quantity" is enabled</div>
                        <div><strong>Multi-Language:</strong> Translate the full message, placeholders work the same in all languages</div>
                        <div><strong>Settings:</strong> Colors and thresholds configured in <strong>Catalog → Stock Settings</strong></div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {!selectedStore ? (
            <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-500">
              <Globe className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                No Store Selected
              </h3>
              <p>
                Please select a store to view entity translation statistics.
              </p>
            </div>
          ) : loadingEntityStats ? (
            <PageLoader size="lg" fullScreen={false} className="bg-white border border-gray-200 rounded-lg p-12" text="Loading translation statistics..." />
          ) : (
            <>
              {/* Header with overall stats */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-xl font-semibold text-gray-900">Entity Translation Dashboard</h2>
                  <button
                    onClick={() => setShowMultiEntityTranslateDialog(true)}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2 transition-colors"
                  >
                    <Languages className="w-4 h-4" />
                    Translate Multiple Entities
                  </button>
                </div>
                <p className="text-gray-600 mb-4">
                  Manage translations for all your store content from one central location.
                </p>
                {entityStats.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white rounded-lg p-4 border border-blue-100">
                      <p className="text-sm text-gray-600">Total Items</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {entityStats.reduce((sum, stat) => sum + stat.totalItems, 0)}
                      </p>
                    </div>
                    <div className="bg-white rounded-lg p-4 border border-blue-100">
                      <p className="text-sm text-gray-600">Fully Translated</p>
                      <p className="text-2xl font-bold text-green-600">
                        {entityStats.reduce((sum, stat) => sum + stat.translatedItems, 0)}
                      </p>
                    </div>
                    <div className="bg-white rounded-lg p-4 border border-blue-100">
                      <p className="text-sm text-gray-600">Average Completion</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {entityStats.length > 0
                          ? Math.round(entityStats.reduce((sum, stat) => sum + stat.completionPercentage, 0) / entityStats.length)
                          : 0}%
                      </p>
                    </div>
                    <div className="bg-white rounded-lg p-4 border border-blue-100">
                      <p className="text-sm text-gray-600">Entity Types</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {entityStats.length}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Entity Cards Grid */}
              {entityStats.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {entityStats.map((stat) => (
                    <EntityTranslationCard
                      key={stat.type}
                      icon={stat.icon}
                      name={stat.name}
                      type={stat.type}
                      totalItems={stat.totalItems}
                      translatedItems={stat.translatedItems}
                      completionPercentage={stat.completionPercentage}
                      missingLanguages={stat.missingLanguages}
                      onTranslate={handleOpenEntityTranslation}
                      loading={false}
                    />
                  ))}
                </div>
              ) : (
                <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-500">
                  <Globe className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">
                    No Content Found
                  </h3>
                  <p>
                    Start adding products, categories, or CMS content to see translation statistics.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Bulk Translate Dialog */}
      <BulkTranslateDialog
        open={showBulkTranslateDialog}
        onOpenChange={(open) => {
          setShowBulkTranslateDialog(open);
          if (!open) {
            // Reset selected entity when closing
            setSelectedEntityType(null);
            setSelectedEntityName(null);
            setSelectedEntityItemCount(0);
          }
        }}
        entityType={selectedEntityType || "UI labels"}
        entityName={selectedEntityName || "UI Labels"}
        itemCount={selectedEntityItemCount}
        userCredits={userCredits}
        onCreditsUpdate={loadUserCredits}
        onTranslate={selectedEntityType ? handleEntityTranslate : handleBulkTranslate}
        onComplete={() => {
          // Reload the appropriate data based on entity type
          if (!selectedEntityType || selectedEntityType === 'ui_labels') {
            loadLabels(selectedLanguage);
          } else if (selectedEntityType === 'product') {
            loadProducts();
          } else if (selectedEntityType === 'category') {
            loadCategories();
          } else if (selectedEntityType === 'attribute') {
            loadAttributes();
          } else if (selectedEntityType === 'cms_page') {
            loadCmsContent();
          } else if (selectedEntityType === 'cms_block') {
            loadCmsContent();
          } else if (selectedEntityType === 'product_tab') {
            loadProductTabs();
          } else if (selectedEntityType === 'product_label') {
            loadProductLabels();
          } else if (selectedEntityType === 'cookie_consent') {
            loadCookieConsent();
          } else if (selectedEntityType === 'custom_option') {
            loadCustomOptions();
          } else if (selectedEntityType === 'email_template') {
            loadEmailTemplates();
          } else if (selectedEntityType === 'pdf_template') {
            loadPdfTemplates();
          }
        }}
      />

      {/* Multi-Entity Translate Dialog */}
      <MultiEntityTranslateDialog
        open={showMultiEntityTranslateDialog}
        onOpenChange={setShowMultiEntityTranslateDialog}
        entityStats={entityStats}
        onTranslate={handleMultiEntityTranslate}
        availableLanguages={availableLanguages || []}
        userCredits={userCredits}
        onCreditsUpdate={loadUserCredits}
      />

      {/* Translation Wizard */}
      <TranslationWizard
        isOpen={showTranslationWizard}
        onClose={() => {
          console.log('🔄 TranslationWizard closing, reloading credits and stats');
          setShowTranslationWizard(false);
          // Reload data and credits after wizard completes
          loadEntityStats();
          loadUserCredits();
          // Also dispatch event for sidebar
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('creditsUpdated'));
          }, 200);
        }}
        storeId={getSelectedStoreId()}
        userCredits={userCredits}
        onCreditsUpdate={loadUserCredits}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Translation</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this translation? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-600">
              Translation key: <span className="font-mono font-semibold">{labelToDelete}</span>
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteModalOpen(false);
                setLabelToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteLabel}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
