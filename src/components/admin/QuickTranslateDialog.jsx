import React, { useState, useEffect } from 'react';
import { Languages, Globe, CheckCircle, Loader2, X, ArrowRight } from 'lucide-react';
import { Button } from '../ui/button';
import api from '../../utils/api';
import FlashMessage from '@/components/storefront/FlashMessage';

/**
 * QuickTranslateDialog - Quick translation for specific UI elements
 *
 * Shows targeted questions:
 * 1. What UI element to translate? (with common presets)
 * 2. To which languages? (multi-select)
 * 3. Preview & Execute
 */
export default function QuickTranslateDialog({ isOpen, onClose, onSuccess }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [languages, setLanguages] = useState([]);
  const [flashMessage, setFlashMessage] = useState(null);

  // Quick translate presets for common UI elements
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [customText, setCustomText] = useState('');
  const [customKey, setCustomKey] = useState('');
  const [selectedLanguages, setSelectedLanguages] = useState([]);
  const [results, setResults] = useState(null);

  // Common UI element presets
  const presets = [
    {
      id: 'add_to_cart',
      label: 'Add to Cart Button',
      key: 'product.add_to_cart',
      text: 'Add to Cart',
      category: 'product',
      icon: '🛒',
      description: 'Button on product/category pages'
    },
    {
      id: 'buy_now',
      label: 'Buy Now Button',
      key: 'product.buy_now',
      text: 'Buy Now',
      category: 'product',
      icon: '⚡',
      description: 'Quick checkout button'
    },
    {
      id: 'cart_title',
      label: 'Shopping Cart Title',
      key: 'cart.title',
      text: 'Shopping Cart',
      category: 'cart',
      icon: '🛍️',
      description: 'Cart page heading'
    },
    {
      id: 'checkout_title',
      label: 'Checkout Title',
      key: 'checkout.title',
      text: 'Checkout',
      category: 'checkout',
      icon: '💳',
      description: 'Checkout page heading'
    },
    {
      id: 'place_order',
      label: 'Place Order Button',
      key: 'checkout.place_order',
      text: 'Place Order',
      category: 'checkout',
      icon: '✅',
      description: 'Final checkout button'
    },
    {
      id: 'out_of_stock',
      label: 'Out of Stock Label',
      key: 'product.out_of_stock',
      text: 'Out of Stock',
      category: 'product',
      icon: '❌',
      description: 'Stock status badge'
    },
    {
      id: 'in_stock',
      label: 'In Stock Label',
      key: 'product.in_stock',
      text: 'In Stock',
      category: 'product',
      icon: '✓',
      description: 'Stock status badge'
    },
    {
      id: 'search',
      label: 'Search Placeholder',
      key: 'common.search',
      text: 'Search...',
      category: 'common',
      icon: '🔍',
      description: 'Search input placeholder'
    },
    {
      id: 'continue_shopping',
      label: 'Continue Shopping',
      key: 'cart.continue_shopping',
      text: 'Continue Shopping',
      category: 'cart',
      icon: '◀️',
      description: 'Return to shop link'
    },
    {
      id: 'proceed_checkout',
      label: 'Proceed to Checkout',
      key: 'cart.proceed_to_checkout',
      text: 'Proceed to Checkout',
      category: 'cart',
      icon: '➡️',
      description: 'Go to checkout button'
    },
    {
      id: 'custom',
      label: 'Custom Text',
      key: '',
      text: '',
      category: 'custom',
      icon: '✏️',
      description: 'Enter your own text'
    }
  ];

  // Load languages on mount
  useEffect(() => {
    if (isOpen) {
      loadLanguages();
    }
  }, [isOpen]);

  const loadLanguages = async () => {
    try {
      const response = await api.get('/api/languages');
      const activeLanguages = response.data.data.filter(l => l.is_active);
      setLanguages(activeLanguages);

      // Auto-select common target languages (except English)
      const commonLangs = activeLanguages
        .filter(l => ['nl', 'fr', 'de', 'es'].includes(l.code))
        .map(l => l.code);
      setSelectedLanguages(commonLangs);
    } catch (error) {
      console.error('Error loading languages:', error);
      setFlashMessage({ type: 'error', message: 'Failed to load languages' });
    }
  };

  const handlePresetSelect = (preset) => {
    setSelectedPreset(preset);
    if (preset.id === 'custom') {
      setCustomText('');
      setCustomKey('');
    }
  };

  const toggleLanguage = (langCode) => {
    if (selectedLanguages.includes(langCode)) {
      setSelectedLanguages(selectedLanguages.filter(l => l !== langCode));
    } else {
      setSelectedLanguages([...selectedLanguages, langCode]);
    }
  };

  const handleTranslate = async () => {
    setLoading(true);

    const textToTranslate = selectedPreset.id === 'custom' ? customText : selectedPreset.text;
    const translationKey = selectedPreset.id === 'custom' ? customKey : selectedPreset.key;
    const category = selectedPreset.id === 'custom' ? 'custom' : selectedPreset.category;

    try {
      // Use the auto-translate endpoint to translate to all selected languages at once
      const response = await api.post('/api/translations/auto-translate-ui-label', {
        key: translationKey,
        value: textToTranslate,
        category: category,
        fromLang: 'en'
      });

      // Filter results to only include selected languages
      const filteredResults = response.data.data.translations.filter(
        t => selectedLanguages.includes(t.language_code) || t.language_code === 'en'
      );

      setResults({
        key: translationKey,
        translations: filteredResults,
        errors: response.data.data.errors || []
      });

      setStep(3);

      if (response.data.data.errors && response.data.data.errors.length > 0) {
        setFlashMessage({ type: 'warning', message: `Translated with ${response.data.data.errors.length} error(s)` });
      } else {
        setFlashMessage({ type: 'success', message: 'Translation completed successfully!' });
      }

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Translation error:', error);
      setFlashMessage({ type: 'error', message: 'Translation failed: ' + (error.response?.data?.message || error.message) });
    } finally {
      setLoading(false);
    }
  };

  const resetDialog = () => {
    setStep(1);
    setSelectedPreset(null);
    setCustomText('');
    setCustomKey('');
    setResults(null);
  };

  const handleClose = () => {
    resetDialog();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <FlashMessage message={flashMessage} onClose={() => setFlashMessage(null)} />
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Languages className="w-8 h-8" />
              <div>
                <h2 className="text-2xl font-bold">Quick Translate</h2>
                <p className="text-purple-100 text-sm">Translate UI elements instantly</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="text-white/80 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Step indicator */}
          <div className="mt-4 flex items-center gap-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`flex-1 h-1 rounded-full transition-all ${
                  s <= step ? 'bg-white' : 'bg-white/30'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Step 1: Select what to translate */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold mb-2 flex items-center gap-2">
                  <Globe className="w-5 h-5 text-purple-600" />
                  What would you like to translate?
                </h3>
                <p className="text-gray-600 mb-6">Choose a common UI element or enter custom text</p>

                <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2">
                  {presets.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => handlePresetSelect(preset)}
                      className={`p-4 border-2 rounded-lg text-left transition-all hover:shadow-md ${
                        selectedPreset?.id === preset.id
                          ? 'border-purple-600 bg-purple-50 shadow-md'
                          : 'border-gray-200 hover:border-purple-300'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-3xl">{preset.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-gray-900 truncate">
                            {preset.label}
                          </div>
                          <div className="text-sm text-gray-600 mt-1">
                            {preset.description}
                          </div>
                          {preset.text && (
                            <div className="text-xs text-purple-600 mt-2 font-mono bg-purple-50 px-2 py-1 rounded">
                              "{preset.text}"
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Custom text input */}
                {selectedPreset?.id === 'custom' && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-3">
                    <div>
                      <label className="block text-sm font-medium mb-2">Translation Key:</label>
                      <input
                        type="text"
                        placeholder="e.g., common.welcome or product.featured"
                        value={customKey}
                        onChange={(e) => setCustomKey(e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Use dot notation: category.key (e.g., checkout.complete)
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">English Text:</label>
                      <input
                        type="text"
                        placeholder="Enter the text to translate..."
                        value={customText}
                        onChange={(e) => setCustomText(e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={() => setStep(2)}
                  disabled={
                    !selectedPreset ||
                    (selectedPreset.id === 'custom' && (!customText || !customKey))
                  }
                  className="flex items-center gap-2"
                >
                  Next <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Select languages */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold mb-2 flex items-center gap-2">
                  <Languages className="w-5 h-5 text-purple-600" />
                  Which languages?
                </h3>
                <p className="text-gray-600 mb-4">Select all languages you want to translate to</p>

                {/* What's being translated */}
                <div className="mb-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{selectedPreset.icon}</span>
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">{selectedPreset.label}</div>
                      <div className="text-sm text-purple-700 font-mono mt-1">
                        "{selectedPreset.id === 'custom' ? customText : selectedPreset.text}"
                      </div>
                    </div>
                  </div>
                </div>

                {/* Language selection */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium">
                      Target languages (select multiple):
                    </label>
                    <div className="text-sm text-gray-500">
                      {selectedLanguages.length} selected
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 max-h-80 overflow-y-auto p-2 border border-gray-200 rounded-lg">
                    {languages
                      .filter(lang => lang.code !== 'en')
                      .map(lang => (
                        <label
                          key={lang.code}
                          className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                            selectedLanguages.includes(lang.code)
                              ? 'bg-purple-50 border-2 border-purple-600'
                              : 'bg-gray-50 border-2 border-transparent hover:border-purple-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedLanguages.includes(lang.code)}
                            onChange={() => toggleLanguage(lang.code)}
                            className="w-5 h-5 text-purple-600 rounded"
                          />
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{lang.native_name}</div>
                            <div className="text-xs text-gray-500">{lang.name} ({lang.code.toUpperCase()})</div>
                          </div>
                        </label>
                      ))}
                  </div>

                  {/* Quick select buttons */}
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => {
                        const commonLangs = languages
                          .filter(l => ['nl', 'fr', 'de', 'es'].includes(l.code))
                          .map(l => l.code);
                        setSelectedLanguages(commonLangs);
                      }}
                      className="text-xs px-3 py-1 bg-purple-100 text-purple-700 rounded-full hover:bg-purple-200"
                    >
                      Common European
                    </button>
                    <button
                      onClick={() => {
                        const allLangs = languages
                          .filter(l => l.code !== 'en')
                          .map(l => l.code);
                        setSelectedLanguages(allLangs);
                      }}
                      className="text-xs px-3 py-1 bg-purple-100 text-purple-700 rounded-full hover:bg-purple-200"
                    >
                      Select All
                    </button>
                    <button
                      onClick={() => setSelectedLanguages([])}
                      className="text-xs px-3 py-1 bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200"
                    >
                      Clear All
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-between">
                <Button
                  onClick={() => setStep(1)}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  Back
                </Button>
                <Button
                  onClick={handleTranslate}
                  disabled={selectedLanguages.length === 0 || loading}
                  className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Translating...
                    </>
                  ) : (
                    <>
                      <Languages className="w-4 h-4" />
                      Translate Now
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Results */}
          {step === 3 && results && (
            <div className="space-y-6">
              <div className="text-center py-6">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-12 h-12 text-green-600" />
                </div>
                <h3 className="text-2xl font-bold mb-2">Translation Complete!</h3>
                <p className="text-gray-600">Your UI element has been translated</p>
              </div>

              {/* Translations table */}
              <div className="bg-gray-50 rounded-lg p-6">
                <h4 className="font-semibold mb-4 flex items-center gap-2">
                  <span className="text-2xl">{selectedPreset.icon}</span>
                  <span>{selectedPreset.label}</span>
                </h4>

                <div className="space-y-3">
                  {/* Original English */}
                  <div className="bg-white p-4 rounded-lg border-2 border-blue-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">🇬🇧</span>
                        <div>
                          <div className="text-sm font-medium text-gray-500">English (Original)</div>
                          <div className="text-lg font-semibold text-gray-900">
                            {selectedPreset.id === 'custom' ? customText : selectedPreset.text}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                        Source
                      </div>
                    </div>
                  </div>

                  {/* Translations */}
                  {results.translations
                    .filter(t => t.language_code !== 'en')
                    .map(translation => {
                      const lang = languages.find(l => l.code === translation.language_code);
                      const flagEmoji = {
                        'nl': '🇳🇱',
                        'fr': '🇫🇷',
                        'de': '🇩🇪',
                        'es': '🇪🇸',
                        'it': '🇮🇹',
                        'pt': '🇵🇹'
                      }[translation.language_code] || '🌍';

                      return (
                        <div
                          key={translation.language_code}
                          className="bg-white p-4 rounded-lg border-2 border-green-200"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1">
                              <span className="text-2xl">{flagEmoji}</span>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-gray-500">
                                  {lang?.native_name || translation.language_name}
                                </div>
                                <div className="text-lg font-semibold text-gray-900 truncate">
                                  {translation.value}
                                </div>
                              </div>
                            </div>
                            {translation.status === 'translated' && (
                              <div className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" />
                                Translated
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>

                {/* Translation key info */}
                <div className="mt-4 p-3 bg-white rounded border border-gray-200">
                  <div className="text-xs text-gray-500">Translation Key:</div>
                  <div className="text-sm font-mono text-purple-600">{results.key}</div>
                </div>
              </div>

              {/* Errors */}
              {results.errors && results.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h4 className="font-semibold text-red-800 mb-2">Translation Errors:</h4>
                  <div className="space-y-1 text-sm text-red-700">
                    {results.errors.map((error, idx) => (
                      <div key={idx}>
                        • {error.language_name || error.language_code}: {error.error}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-between">
                <Button
                  onClick={resetDialog}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  Translate Another
                </Button>
                <Button
                  onClick={handleClose}
                  className="flex items-center gap-2"
                >
                  Done
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
