import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { X, Languages, Loader2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import FlashMessage from '@/components/storefront/FlashMessage';
import api from '@/utils/api';

/**
 * Multi-Entity Translate Dialog Component
 * Allows translating multiple entity types at once
 */
export default function MultiEntityTranslateDialog({
  open,
  onOpenChange,
  entityStats = [],
  onTranslate,
  availableLanguages = [],
  userCredits = null,
  onCreditsUpdate = null
}) {
  const [selectedEntities, setSelectedEntities] = useState([]);
  const [translateFromLang, setTranslateFromLang] = useState('en');
  const [translateToLangs, setTranslateToLangs] = useState([]);
  const [translating, setTranslating] = useState(false);
  const [results, setResults] = useState(null);
  const [serviceCosts, setServiceCosts] = useState({});
  const [localCredits, setLocalCredits] = useState(userCredits);
  const [flashMessage, setFlashMessage] = useState(null);

  // Sync local credits with prop
  useEffect(() => {
    setLocalCredits(userCredits);
  }, [userCredits]);

  // Get cost based on entity type
  const getEntityCost = (entityType) => {
    return serviceCosts[entityType] || 0.1;
  };

  // Load translation costs from API
  useEffect(() => {
    const loadTranslationCosts = async () => {
      try {
        const response = await api.get('service-credit-costs?category=ai_services&active_only=true');

        if (response && response.success && response.services) {
          // Create a map of entity types to costs
          const costsMap = {};
          response.services.forEach(service => {
            // Map service keys to entity types
            const keyToEntityMap = {
              'ai_translation': 'standard',
              'ai_translation_product': 'product',
              'ai_translation_category': 'category',
              'ai_translation_attribute': 'attribute',
              'ai_translation_cms_page': 'cms_page',
              'ai_translation_cms_block': 'cms_block',
              'ai_translation_product_tab': 'product_tab',
              'ai_translation_product_label': 'product_label',
              'ai_translation_cookie_consent': 'cookie_consent',
              'ai_translation_attribute_value': 'attribute_value',
              'ai_translation_email_template': 'email-template',
              'ai_translation_pdf_template': 'pdf-template',
              'ai_translation_custom_option': 'custom_option',
              'ai_translation_stock_label': 'stock_labels'
            };

            const entityType = keyToEntityMap[service.service_key];
            if (entityType) {
              costsMap[entityType] = service.cost_per_unit;
            }
          });

          setServiceCosts(costsMap);
        }
      } catch (error) {
        console.error('Error loading translation costs:', error);
        // Use fallback values
        setServiceCosts({
          standard: 0.1,
          cms_page: 0.5,
          cms_block: 0.2
        });
      }
    };

    if (open) {
      loadTranslationCosts();
      // Refresh credit balance when modal opens
      if (onCreditsUpdate) {
        onCreditsUpdate();
      }
    }
  }, [open]);

  if (!open) return null;

  const handleClose = () => {
    // If translation happened, reload credits in sidebar
    if (results && results.creditsDeducted > 0) {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('creditsUpdated'));
      }, 200);
    }

    setSelectedEntities([]);
    setTranslateFromLang('en');
    setTranslateToLangs([]);
    setTranslating(false);
    setResults(null);
    onOpenChange(false);
  };

  const toggleEntitySelection = (entityType) => {
    setSelectedEntities(prev =>
      prev.includes(entityType)
        ? prev.filter(t => t !== entityType)
        : [...prev, entityType]
    );
    // Reset results to show Translate button again
    setResults(null);
    // Refresh credit balance when checkbox is toggled
    if (onCreditsUpdate) {
      onCreditsUpdate();
    }
  };

  const toggleLanguageSelection = (langCode) => {
    setTranslateToLangs(prev =>
      prev.includes(langCode)
        ? prev.filter(code => code !== langCode)
        : [...prev, langCode]
    );
    // Reset results to show Translate button again
    setResults(null);
  };

  const handleTranslate = async () => {
    if (selectedEntities.length === 0) {
      setFlashMessage({ type: 'error', message: 'Please select at least one entity type' });
      return;
    }

    if (translateToLangs.length === 0) {
      setFlashMessage({ type: 'error', message: 'Please select at least one target language' });
      return;
    }

    if (translateFromLang === translateToLangs[0] && translateToLangs.length === 1) {
      setFlashMessage({ type: 'error', message: 'Source and target languages cannot be the same' });
      return;
    }

    setTranslating(true);
    setResults(null);

    try {
      // Translate to each target language sequentially
      const allResults = {
        total: 0,
        translated: 0,
        skipped: 0,
        failed: 0,
        creditsDeducted: 0,
        byLanguage: {}
      };

      for (const toLang of translateToLangs) {
        if (toLang === translateFromLang) {
          allResults.byLanguage[toLang] = {
            skipped: true,
            message: 'Skipped (same as source language)'
          };
          continue;
        }

        try {
          const response = await onTranslate(selectedEntities, translateFromLang, toLang);

          if (response && response.success) {
            allResults.total += response.data.total || 0;
            allResults.translated += response.data.translated || 0;
            allResults.skipped += response.data.skipped || 0;
            allResults.failed += response.data.failed || 0;
            allResults.creditsDeducted += response.creditsDeducted || 0;
            allResults.byLanguage[toLang] = response.data;
          } else {
            allResults.failed++;
            allResults.byLanguage[toLang] = {
              error: response?.message || 'Translation failed'
            };
          }
        } catch (error) {
          allResults.failed++;
          allResults.byLanguage[toLang] = {
            error: error.message || 'Translation failed'
          };
        }
      }

      setResults(allResults);

      // Show appropriate flash message based on results
      if (allResults.translated > 0 && allResults.failed === 0) {
        setFlashMessage({ type: 'success', message: `Successfully translated ${allResults.translated} items (${allResults.skipped} skipped)` });
      } else if (allResults.translated > 0 && allResults.failed > 0) {
        setFlashMessage({ type: 'warning', message: `Translated ${allResults.translated} items (${allResults.skipped} skipped, ${allResults.failed} failed)` });
      } else if (allResults.skipped > 0 && allResults.translated === 0) {
        setFlashMessage({ type: 'info', message: `All ${allResults.skipped} items were skipped (already translated)` });
      } else if (allResults.failed > 0) {
        setFlashMessage({ type: 'error', message: `Translation failed: ${allResults.failed} items failed` });
      }

      // Update local credits for display in modal
      if (allResults.creditsDeducted > 0) {
        setLocalCredits(prev => Math.max(0, (prev || 0) - allResults.creditsDeducted));
      }
    } catch (error) {
      console.error('Translation error:', error);
      setFlashMessage({ type: 'error', message: error.message || 'Translation failed' });
    } finally {
      setTranslating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <FlashMessage message={flashMessage} onClose={() => setFlashMessage(null)} />
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Languages className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Bulk AI Translate Multiple Entities</h2>
              <p className="text-sm text-gray-600">Select entity types and languages to translate</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={translating}
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Entity Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Select Entity Types ({selectedEntities.length} selected)
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {entityStats.map((stat) => (
                <label
                  key={stat.type}
                  className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    selectedEntities.includes(stat.type)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedEntities.includes(stat.type)}
                    onChange={() => toggleEntitySelection(stat.type)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{stat.icon}</span>
                      <span className="font-medium text-gray-900">{stat.name}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {stat.totalItems} items • {stat.completionPercentage}% translated
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Language Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Source Language */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Source Language
              </label>
              <select
                value={translateFromLang}
                onChange={(e) => setTranslateFromLang(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={translating}
              >
                {availableLanguages.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.native_name || lang.name} ({lang.code.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>

            {/* Target Languages */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Target Languages ({translateToLangs.length} selected)
              </label>
              <div className="border border-gray-300 rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
                {availableLanguages
                  .filter(lang => lang.code !== translateFromLang)
                  .map((lang) => (
                    <label key={lang.code} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={translateToLangs.includes(lang.code)}
                        onChange={() => toggleLanguageSelection(lang.code)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        disabled={translating}
                      />
                      <span className="text-sm text-gray-700">
                        {lang.native_name || lang.name} ({lang.code.toUpperCase()})
                      </span>
                    </label>
                  ))}
              </div>
            </div>
          </div>

          {/* Results */}
          {results && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                Translation Results
              </h3>
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-white p-3 rounded border border-gray-200">
                  <p className="text-2xl font-bold text-gray-900">{results.total}</p>
                  <p className="text-xs text-gray-600">Total Items</p>
                </div>
                <div className="bg-white p-3 rounded border border-green-200">
                  <p className="text-2xl font-bold text-green-600">{results.translated}</p>
                  <p className="text-xs text-gray-600">Translated</p>
                </div>
                <div className="bg-white p-3 rounded border border-yellow-200">
                  <p className="text-2xl font-bold text-yellow-600">{results.skipped}</p>
                  <p className="text-xs text-gray-600">Skipped</p>
                </div>
                <div className="bg-white p-3 rounded border border-red-200">
                  <p className="text-2xl font-bold text-red-600">{results.failed}</p>
                  <p className="text-xs text-gray-600">Failed</p>
                </div>
              </div>

              {/* Credits Used */}
              {results.creditsDeducted > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-green-800 font-medium">💰 Credits Used:</span>
                    <span className="text-green-900 font-bold">
                      {results.creditsDeducted.toFixed(2)} credits
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-green-700">New Balance:</span>
                    <span className="text-green-800 font-medium">
                      {Number(localCredits).toFixed(2)} credits
                    </span>
                  </div>
                  {results.skipped > 0 && (
                    <div className="text-xs text-green-700 mt-2 pt-2 border-t border-green-200">
                      ℹ️ Charged for {results.total} items (including {results.skipped} already translated)
                    </div>
                  )}
                </div>
              )}

              {/* Per-language results */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">By Language:</p>
                {Object.entries(results.byLanguage).map(([langCode, langResult]) => (
                  <div key={langCode} className="flex items-center justify-between bg-white p-2 rounded border border-gray-200">
                    <span className="text-sm font-medium text-gray-700">{langCode.toUpperCase()}</span>
                    <div className="flex items-center gap-4 text-xs">
                      {langResult.error ? (
                        <span className="text-red-600 flex items-center gap-1">
                          <XCircle className="w-3 h-3" />
                          Error: {langResult.error}
                        </span>
                      ) : langResult.skipped ? (
                        <span className="text-gray-500">{langResult.message}</span>
                      ) : (
                        <>
                          <span className="text-green-600">{langResult.translated} translated</span>
                          <span className="text-yellow-600">{langResult.skipped} skipped</span>
                          {langResult.failed > 0 && (
                            <span className="text-red-600">{langResult.failed} failed</span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
          <div className="text-sm space-y-1">
            {selectedEntities.length > 0 && translateToLangs.length > 0 && (
              <>
                <div className="text-gray-600">
                  Ready to translate <span className="font-semibold">{selectedEntities.length}</span> entity type(s)
                  to <span className="font-semibold">{translateToLangs.length}</span> language(s)
                </div>
                {(() => {
                  const selectedStats = entityStats.filter(stat => selectedEntities.includes(stat.type));
                  const totalItems = selectedStats.reduce((sum, stat) => sum + (stat.totalItems || 0), 0);

                  // Calculate cost based on entity types with flat rates
                  let totalEstimatedCost = 0;

                  selectedStats.forEach(stat => {
                    const itemCost = getEntityCost(stat.type);
                    totalEstimatedCost += stat.totalItems * translateToLangs.length * itemCost;
                  });

                  return totalItems > 0 ? (
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 text-green-700 font-medium">
                        <span>💰</span>
                        <span>Estimated: {totalEstimatedCost.toFixed(2)} credits</span>
                      </div>
                      <span className="text-xs text-gray-600">
                        {totalItems} items × {translateToLangs.length} lang(s)
                      </span>
                      <span className="text-xs text-green-600">
                        Rates: CMS pages {serviceCosts['cms_page'] || 0.5} • CMS blocks {serviceCosts['cms_block'] || 0.2} • Others {serviceCosts['standard'] || 0.1} credits
                      </span>
                      <span className="text-xs text-blue-700 font-medium mt-1 block">
                        ⚠️ Credits charged for all items, including those already translated
                      </span>
                      {/* Credit Balance Warning */}
                      {localCredits !== null && localCredits !== undefined && totalEstimatedCost > 0 && (
                        <div className={`mt-2 p-3 rounded-lg border ${
                          localCredits < totalEstimatedCost
                            ? 'bg-red-50 border-red-200'
                            : 'bg-green-50 border-green-200'
                        }`}>
                          <div className="flex items-center justify-between text-sm">
                            <span className={localCredits < totalEstimatedCost ? 'text-red-800' : 'text-green-800'}>
                              Your balance: {Number(localCredits).toFixed(2)} credits
                            </span>
                            {localCredits < totalEstimatedCost && (
                              <span className="text-red-600 font-medium text-xs">
                                ⚠️ Insufficient credits - <Link to="/admin/billing" className="text-blue-600 hover:underline">Add credits</Link>
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : null;
                })()}
              </>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              disabled={translating}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              {results ? 'Close' : 'Cancel'}
            </button>
            {!results && (
              <button
                onClick={handleTranslate}
                disabled={translating || selectedEntities.length === 0 || translateToLangs.length === 0 || (localCredits !== null && (() => {
                  const selectedStats = entityStats.filter(stat => selectedEntities.includes(stat.type));
                  let totalEstimatedCost = 0;
                  selectedStats.forEach(stat => {
                    const itemCost = getEntityCost(stat.type);
                    totalEstimatedCost += stat.totalItems * translateToLangs.length * itemCost;
                  });
                  return localCredits < totalEstimatedCost;
                })())}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {translating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Translating...
                  </>
                ) : (
                  <>
                    <Languages className="w-4 h-4" />
                    Start Translation
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
