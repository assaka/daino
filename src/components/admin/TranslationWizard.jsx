import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Wand2, Languages, Globe, ArrowRight, ArrowLeft, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import api from '../../utils/api';
import FlashMessage from '@/components/storefront/FlashMessage';

/**
 * TranslationWizard - Interactive wizard for translating content
 *
 * Features:
 * - Step-by-step guided translation
 * - Quick questions to determine what to translate
 * - Preview before translating
 * - Progress tracking
 */
export default function TranslationWizard({ isOpen, onClose, storeId, userCredits = null, onCreditsUpdate = null }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingCosts, setLoadingCosts] = useState(true);
  const [languages, setLanguages] = useState([]);
  const [serviceCosts, setServiceCosts] = useState({});
  const [localCredits, setLocalCredits] = useState(userCredits);
  const [flashMessage, setFlashMessage] = useState(null);

  // Sync local credits with prop
  useEffect(() => {
    setLocalCredits(userCredits);
  }, [userCredits]);

  // Wizard state
  const [config, setConfig] = useState({
    whatToTranslate: null, // 'all', 'ui-labels', 'products', 'categories', 'cms', etc.
    fromLanguage: 'en',
    toLanguages: [],
    specificItems: [],
    singleField: null,
    preview: null
  });

  const [stats, setStats] = useState(null);
  const [translationResult, setTranslationResult] = useState(null);

  // Load languages and translation costs on mount
  useEffect(() => {
    if (isOpen) {
      loadLanguages();
      loadTranslationCosts();
      // Refresh credit balance when wizard opens
      if (onCreditsUpdate) {
        onCreditsUpdate();
      }
    }
  }, [isOpen]);

  const loadTranslationCosts = async () => {
    setLoadingCosts(true);
    try {
      // Load all translation service costs from database
      const serviceKeyMap = [
        { key: 'ai_translation', type: 'standard' },
        { key: 'ai_translation', type: 'ui-labels' },
        { key: 'ai_translation_product', type: 'product' },
        { key: 'ai_translation_category', type: 'category' },
        { key: 'ai_translation_attribute', type: 'attribute' },
        { key: 'ai_translation_cms_page', type: 'cms_page' },
        { key: 'ai_translation_cms_block', type: 'cms_block' },
        { key: 'ai_translation_product_tab', type: 'product_tab' },
        { key: 'ai_translation_product_label', type: 'product_label' },
        { key: 'ai_translation_cookie_consent', type: 'cookie_consent' },
        { key: 'ai_translation_attribute_value', type: 'attribute_value' },
        { key: 'ai_translation_email_template', type: 'email-template' },
        { key: 'ai_translation_pdf_template', type: 'pdf-template' },
        { key: 'ai_translation_custom_option', type: 'custom-option' },
        { key: 'ai_translation_stock_label', type: 'stock-label' }
      ];

      const costs = {};
      let loadedCount = 0;

      await Promise.all(
        serviceKeyMap.map(async ({ key, type }) => {
          try {
            const response = await api.get(`service-credit-costs/key/${key}`);
            if (response.success && response.service) {
              costs[type] = parseFloat(response.service.cost_per_unit);
              loadedCount++;
            }
          } catch (error) {
            console.warn(`Could not load cost for ${key} (${type})`);
          }
        })
      );

      console.log(`✅ Loaded ${loadedCount}/${serviceKeyMap.length} service costs from database`);
      setServiceCosts(costs);
    } catch (error) {
      console.error('Error loading translation costs:', error);
      setFlashMessage({ type: 'error', message: 'Failed to load service costs, using fallback values' });
    } finally {
      setLoadingCosts(false);
    }
  };

  // Helper to get cost for an entity type
  const getCostForEntityType = (entityType) => {
    // Try to get from loaded service costs
    if (serviceCosts[entityType]) {
      return serviceCosts[entityType];
    }

    // Try standard cost
    if (serviceCosts.standard) {
      return serviceCosts.standard;
    }

    // Last resort hardcoded fallbacks (only if database loading failed)
    const emergencyFallbacks = {
      'cms_page': 0.5,
      'cms_block': 0.2,
    };

    return emergencyFallbacks[entityType] || 0.1;
  };

  // Calculate total estimated cost based on stats
  const calculateEstimatedCost = () => {
    if (!stats || !stats.byEntityType) return 0;

    let totalCost = 0;
    Object.entries(stats.byEntityType).forEach(([entityType, data]) => {
      const cost = getCostForEntityType(entityType);
      totalCost += data.toTranslate * cost;
    });

    return totalCost;
  };

  const loadLanguages = async () => {
    try {
      const response = await api.get('languages');
      if (response.success && response.data && response.data.languages) {
        setLanguages(response.data.languages.filter(l => l.is_active));
      } else if (response.success && response.data) {
        setLanguages(response.data.filter(l => l.is_active));
      } else if (Array.isArray(response)) {
        setLanguages(response.filter(l => l.is_active));
      }
    } catch (error) {
      setFlashMessage({ type: 'error', message: 'Failed to load languages' });
    }
  };

  // Get preview of what will be translated
  const getPreview = async () => {
    setLoading(true);
    try {
      const response = await api.post('translations/preview', {
        store_id: storeId,
        what: config.whatToTranslate,
        fromLang: config.fromLanguage,
        toLanguages: config.toLanguages,
        specificItems: config.specificItems,
        singleField: config.singleField
      });
      const data = response.data || response;
      setStats(data.data || data);
      setStep(3);
    } catch (error) {
      setFlashMessage({ type: 'error', message: 'Failed to get translation preview' });
    } finally {
      setLoading(false);
    }
  };

  // Execute translation
  const executeTranslation = async () => {
    setLoading(true);
    try {
      const response = await api.post('translations/wizard-execute', {
        store_id: storeId,
        what: config.whatToTranslate,
        fromLang: config.fromLanguage,
        toLanguages: config.toLanguages,
        specificItems: config.specificItems,
        singleField: config.singleField
      });
      const data = response.data || response;
      setTranslationResult(data.data || data);
      setStep(4);
      setFlashMessage({ type: 'success', message: 'Translation completed!' });

      // Update credits if any were deducted (store for later when wizard closes)
      const creditsDeducted = response.creditsDeducted || data.creditsDeducted || 0;
      if (creditsDeducted > 0) {
        setLocalCredits(prev => Math.max(0, (prev || 0) - creditsDeducted));
      }
    } catch (error) {
      console.error('Error executing translation:', error);
      setFlashMessage({ type: 'error', message: 'Translation failed: ' + (error.message || 'Unknown error') });
    } finally {
      setLoading(false);
    }
  };

  const resetWizard = () => {
    setStep(1);
    setConfig({
      whatToTranslate: null,
      fromLanguage: 'en',
      toLanguages: [],
      specificItems: [],
      singleField: null,
      preview: null
    });
    setStats(null);
    setTranslationResult(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <FlashMessage message={flashMessage} onClose={() => setFlashMessage(null)} />
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Wand2 className="w-8 h-8" />
              <div>
                <h2 className="text-2xl font-bold">Translation Wizard</h2>
                <p className="text-blue-100 text-sm">Step {step} of 4</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Progress bar */}
          <div className="mt-4 bg-white/20 rounded-full h-2 overflow-hidden">
            <div
              className="bg-white h-full transition-all duration-300"
              style={{ width: `${(step / 4) * 100}%` }}
            />
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Step 1: What to translate */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold mb-2 flex items-center gap-2">
                  <Globe className="w-5 h-5 text-blue-600" />
                  What would you like to translate?
                </h3>
                <p className="text-gray-600 mb-6">Choose what content you want to translate</p>

                <div className="grid grid-cols-2 gap-4">
                  {/* Everything */}
                  <button
                    onClick={() => setConfig({ ...config, whatToTranslate: 'all' })}
                    className={`p-4 border-2 rounded-lg text-left transition-all ${
                      config.whatToTranslate === 'all'
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    <div className="text-3xl mb-2">🌍</div>
                    <div className="font-semibold">Everything</div>
                    <div className="text-sm text-gray-600">Translate all content types</div>
                  </button>

                  {/* UI Labels */}
                  <button
                    onClick={() => setConfig({ ...config, whatToTranslate: 'ui-labels' })}
                    className={`p-4 border-2 rounded-lg text-left transition-all ${
                      config.whatToTranslate === 'ui-labels'
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    <div className="text-3xl mb-2">🔤</div>
                    <div className="font-semibold">UI Labels</div>
                    <div className="text-sm text-gray-600">Buttons, menus, labels</div>
                  </button>

                  {/* Products */}
                  <button
                    onClick={() => setConfig({ ...config, whatToTranslate: 'product' })}
                    className={`p-4 border-2 rounded-lg text-left transition-all ${
                      config.whatToTranslate === 'product'
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    <div className="text-3xl mb-2">📦</div>
                    <div className="font-semibold">Products</div>
                    <div className="text-sm text-gray-600">Product names & descriptions</div>
                  </button>

                  {/* Categories */}
                  <button
                    onClick={() => setConfig({ ...config, whatToTranslate: 'category' })}
                    className={`p-4 border-2 rounded-lg text-left transition-all ${
                      config.whatToTranslate === 'category'
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    <div className="text-3xl mb-2">📁</div>
                    <div className="font-semibold">Categories</div>
                    <div className="text-sm text-gray-600">Category names & descriptions</div>
                  </button>

                  {/* CMS Content */}
                  <button
                    onClick={() => setConfig({ ...config, whatToTranslate: 'cms' })}
                    className={`p-4 border-2 rounded-lg text-left transition-all ${
                      config.whatToTranslate === 'cms'
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    <div className="text-3xl mb-2">📄</div>
                    <div className="font-semibold">CMS Content</div>
                    <div className="text-sm text-gray-600">Pages & blocks</div>
                  </button>

                  {/* Email Templates */}
                  <button
                    onClick={() => setConfig({ ...config, whatToTranslate: 'email-template' })}
                    className={`p-4 border-2 rounded-lg text-left transition-all ${
                      config.whatToTranslate === 'email-template'
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    <div className="text-3xl mb-2">📧</div>
                    <div className="font-semibold">Email Templates</div>
                    <div className="text-sm text-gray-600">Email content & subjects</div>
                  </button>

                  {/* PDF Templates */}
                  <button
                    onClick={() => setConfig({ ...config, whatToTranslate: 'pdf-template' })}
                    className={`p-4 border-2 rounded-lg text-left transition-all ${
                      config.whatToTranslate === 'pdf-template'
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    <div className="text-3xl mb-2">📑</div>
                    <div className="font-semibold">PDF Templates</div>
                    <div className="text-sm text-gray-600">PDF content & labels</div>
                  </button>

                  {/* Custom Options */}
                  <button
                    onClick={() => setConfig({ ...config, whatToTranslate: 'custom-option' })}
                    className={`p-4 border-2 rounded-lg text-left transition-all ${
                      config.whatToTranslate === 'custom-option'
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    <div className="text-3xl mb-2">⚙️</div>
                    <div className="font-semibold">Custom Options</div>
                    <div className="text-sm text-gray-600">Product custom options</div>
                  </button>

                  {/* Stock Labels */}
                  <button
                    onClick={() => setConfig({ ...config, whatToTranslate: 'stock-label' })}
                    className={`p-4 border-2 rounded-lg text-left transition-all ${
                      config.whatToTranslate === 'stock-label'
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    <div className="text-3xl mb-2">🏷️</div>
                    <div className="font-semibold">Stock Labels</div>
                    <div className="text-sm text-gray-600">Stock status labels</div>
                  </button>

                  {/* Single Field */}
                  <button
                    onClick={() => setConfig({ ...config, whatToTranslate: 'single-field' })}
                    className={`p-4 border-2 rounded-lg text-left transition-all ${
                      config.whatToTranslate === 'single-field'
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    <div className="text-3xl mb-2">🎯</div>
                    <div className="font-semibold">Single Field</div>
                    <div className="text-sm text-gray-600">Just one field type</div>
                  </button>
                </div>

                {/* Single field options */}
                {config.whatToTranslate === 'single-field' && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                    <label className="block text-sm font-medium mb-2">Which field?</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setConfig({ ...config, singleField: 'name' })}
                        className={`p-2 text-sm border rounded ${
                          config.singleField === 'name'
                            ? 'border-blue-600 bg-blue-50'
                            : 'border-gray-300'
                        }`}
                      >
                        Names only
                      </button>
                      <button
                        onClick={() => setConfig({ ...config, singleField: 'description' })}
                        className={`p-2 text-sm border rounded ${
                          config.singleField === 'description'
                            ? 'border-blue-600 bg-blue-50'
                            : 'border-gray-300'
                        }`}
                      >
                        Descriptions only
                      </button>
                      <button
                        onClick={() => setConfig({ ...config, singleField: 'short_description' })}
                        className={`p-2 text-sm border rounded ${
                          config.singleField === 'short_description'
                            ? 'border-blue-600 bg-blue-50'
                            : 'border-gray-300'
                        }`}
                      >
                        Short descriptions
                      </button>
                      <button
                        onClick={() => setConfig({ ...config, singleField: 'title' })}
                        className={`p-2 text-sm border rounded ${
                          config.singleField === 'title'
                            ? 'border-blue-600 bg-blue-50'
                            : 'border-gray-300'
                        }`}
                      >
                        Titles only
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={() => setStep(2)}
                  disabled={!config.whatToTranslate || (config.whatToTranslate === 'single-field' && !config.singleField)}
                  className="flex items-center gap-2"
                >
                  Next <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Language selection */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold mb-2 flex items-center gap-2">
                  <Languages className="w-5 h-5 text-blue-600" />
                  Choose languages
                </h3>
                <p className="text-gray-600 mb-6">Select source and target languages</p>

                {/* From language */}
                <div className="mb-6">
                  <label className="block text-sm font-medium mb-2">From language:</label>
                  <select
                    value={config.fromLanguage}
                    onChange={(e) => setConfig({ ...config, fromLanguage: e.target.value })}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {languages.map(lang => (
                      <option key={lang.code} value={lang.code}>
                        {lang.native_name} ({lang.code.toUpperCase()})
                      </option>
                    ))}
                  </select>
                </div>

                {/* To languages */}
                <div>
                  <label className="block text-sm font-medium mb-2">To languages (select multiple):</label>
                  <div className="grid grid-cols-2 gap-3 max-h-60 overflow-y-auto p-2 border border-gray-200 rounded-lg">
                    {languages
                      .filter(lang => lang.code !== config.fromLanguage)
                      .map(lang => (
                        <label
                          key={lang.code}
                          className={`flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-all ${
                            config.toLanguages.includes(lang.code)
                              ? 'bg-blue-50 border-2 border-blue-600'
                              : 'bg-gray-50 border-2 border-transparent hover:border-blue-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={config.toLanguages.includes(lang.code)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setConfig({ ...config, toLanguages: [...config.toLanguages, lang.code] });
                              } else {
                                setConfig({ ...config, toLanguages: config.toLanguages.filter(l => l !== lang.code) });
                              }
                            }}
                            className="w-4 h-4 text-blue-600 rounded"
                          />
                          <span className="text-sm font-medium">{lang.native_name}</span>
                          <span className="text-xs text-gray-500">({lang.code.toUpperCase()})</span>
                        </label>
                      ))}
                  </div>

                  {config.toLanguages.length > 0 && (
                    <div className="mt-3 text-sm text-gray-600">
                      Selected: {config.toLanguages.length} language{config.toLanguages.length !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-between">
                <Button
                  onClick={() => setStep(1)}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </Button>
                <Button
                  onClick={getPreview}
                  disabled={config.toLanguages.length === 0 || loading || loadingCosts}
                  className="flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading preview...
                    </>
                  ) : loadingCosts ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading costs...
                    </>
                  ) : (
                    <>
                      Preview <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Preview */}
          {step === 3 && stats && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold mb-2 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-blue-600" />
                  Review & Confirm
                </h3>
                <p className="text-gray-600 mb-6">Here's what will be translated</p>

                {/* Summary card */}
                <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg p-6 mb-6">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-3xl font-bold text-blue-600">{stats.totalItems || 0}</div>
                      <div className="text-sm text-gray-600">Total items</div>
                    </div>
                    <div>
                      <div className="text-3xl font-bold text-green-600">{stats.toTranslate || 0}</div>
                      <div className="text-sm text-gray-600">To translate</div>
                    </div>
                    <div>
                      <div className="text-3xl font-bold text-gray-600">{stats.alreadyTranslated || 0}</div>
                      <div className="text-sm text-gray-600">Already translated</div>
                    </div>
                  </div>
                </div>

                {/* Details by entity type */}
                {stats.byEntityType && (
                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm text-gray-700">Breakdown by type:</h4>
                    {Object.entries(stats.byEntityType).map(([type, data]) => (
                      <div key={type} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{data.icon}</span>
                          <div>
                            <div className="font-medium">{data.name}</div>
                            <div className="text-xs text-gray-500">
                              {data.toTranslate} items need translation
                              <span className="text-blue-600 ml-1">
                                ({getCostForEntityType(type).toFixed(2)} credits each)
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold">{data.totalItems} total</div>
                          <div className="text-xs text-gray-500">
                            {data.alreadyTranslated} already done
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Estimated time */}
                {stats.estimatedMinutes && (
                  <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-center gap-2 text-yellow-800">
                      <span>⏱️</span>
                      <span className="font-medium">
                        Estimated time: {stats.estimatedMinutes} minutes
                      </span>
                    </div>
                  </div>
                )}

                {/* Credit cost estimate */}
                {stats.toTranslate > 0 && (
                  <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-blue-800">
                          <span>💰</span>
                          <span className="font-medium">Estimated Cost:</span>
                        </div>
                        <div className="text-xl font-bold text-blue-900">
                          {calculateEstimatedCost().toFixed(2)} credits
                        </div>
                      </div>

                      {/* Breakdown by entity type */}
                      {stats.byEntityType && Object.keys(stats.byEntityType).length > 0 && (
                        <div className="space-y-2">
                          <div className="text-xs font-medium text-blue-700 uppercase">Cost Breakdown:</div>
                          <div className="space-y-1">
                            {Object.entries(stats.byEntityType)
                              .filter(([_, data]) => data.toTranslate > 0)
                              .map(([entityType, data]) => {
                                const cost = getCostForEntityType(entityType);
                                const totalCost = data.toTranslate * cost;
                                return (
                                  <div key={entityType} className="flex justify-between text-xs bg-white p-2 rounded">
                                    <div className="flex items-center gap-2">
                                      <span>{data.icon}</span>
                                      <span className="text-gray-700">{data.name}</span>
                                      <span className="text-gray-500">
                                        ({data.toTranslate} × {cost.toFixed(2)})
                                      </span>
                                    </div>
                                    <span className="font-semibold text-blue-900">
                                      {totalCost.toFixed(2)}
                                    </span>
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      )}

                      <div className="border-t border-blue-200 pt-2 space-y-1">
                        <div className="text-xs text-gray-600 italic">
                          Cost = items to translate × rate per item
                        </div>
                        {Object.keys(serviceCosts).length > 0 && (
                          <div className="text-xs text-green-600 flex items-center gap-1">
                            <span>✓</span>
                            <span>Rates loaded from database</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Important Notice */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                  ⚠️ <span className="font-medium">Important:</span> Credits are charged for all items processed, including those already translated (skipped).
                </div>

                {/* Credit Balance Warning */}
                {localCredits !== null && localCredits !== undefined && stats.toTranslate > 0 && (
                  <div className={`p-3 rounded-lg border ${
                    localCredits < calculateEstimatedCost()
                      ? 'bg-red-50 border-red-200'
                      : 'bg-green-50 border-green-200'
                  }`}>
                    <div className="flex items-center justify-between text-sm">
                      <span className={localCredits < calculateEstimatedCost() ? 'text-red-800' : 'text-green-800'}>
                        Your balance: {Number(localCredits).toFixed(2)} credits
                      </span>
                      {localCredits < calculateEstimatedCost() && (
                        <span className="text-red-600 font-medium text-xs">
                          ⚠️ Insufficient credits - <Link to="/admin/billing" className="text-blue-600 hover:underline">Add credits</Link>
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-between">
                <Button
                  onClick={() => setStep(2)}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </Button>
                <Button
                  onClick={executeTranslation}
                  disabled={loading || stats.toTranslate === 0 || (localCredits !== null && localCredits < calculateEstimatedCost())}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Translating...
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-4 h-4" />
                      Start Translation
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Results */}
          {step === 4 && translationResult && (
            <div className="space-y-6">
              <div className="text-center py-8">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-12 h-12 text-green-600" />
                </div>
                <h3 className="text-2xl font-bold mb-2">Translation Complete!</h3>
                <p className="text-gray-600">Your content has been successfully translated</p>
              </div>

              {/* Results summary */}
              <div className="bg-gray-50 rounded-lg p-6 space-y-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-green-600">
                      {translationResult.translated || 0}
                    </div>
                    <div className="text-sm text-gray-600">Translated</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-600">
                      {translationResult.skipped || 0}
                    </div>
                    <div className="text-sm text-gray-600">Skipped</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-red-600">
                      {translationResult.failed || 0}
                    </div>
                    <div className="text-sm text-gray-600">Failed</div>
                  </div>
                </div>

                {/* Credits used */}
                {translationResult.translated > 0 && (
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-blue-800 font-medium">💰 Credits Used:</span>
                      <span className="text-blue-900 font-bold">
                        {translationResult.creditsDeducted?.toFixed(2) || '0.00'} credits
                      </span>
                    </div>
                  </div>
                )}

                {/* Details by entity type */}
                {translationResult.byEntity && (
                  <div className="mt-4 space-y-2">
                    {Object.entries(translationResult.byEntity).map(([type, data]) => (
                      <div key={type} className="flex justify-between text-sm p-2 bg-white rounded">
                        <span className="font-medium">{data.name || type}</span>
                        <span className="text-gray-600">
                          {data.translated} / {data.total} translated
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Errors */}
              {translationResult.errors && translationResult.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h4 className="font-semibold text-red-800 mb-2">Errors:</h4>
                  <div className="space-y-1 text-sm text-red-700 max-h-40 overflow-y-auto">
                    {translationResult.errors.slice(0, 10).map((error, idx) => (
                      <div key={idx}>• {error.message || error.error}</div>
                    ))}
                    {translationResult.errors.length > 10 && (
                      <div className="text-xs text-red-600 mt-2">
                        ... and {translationResult.errors.length - 10} more errors
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-between">
                <Button
                  onClick={resetWizard}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  Translate More
                </Button>
                <Button
                  onClick={onClose}
                  className="flex items-center gap-2"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
