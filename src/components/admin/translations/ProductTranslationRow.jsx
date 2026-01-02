import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Globe, Wand2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import SaveButton from '@/components/ui/save-button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/contexts/TranslationContext';
import FlashMessage from '@/components/storefront/FlashMessage';
import api from '@/utils/api';

/**
 * Accordion row for managing product translations
 * Follows the pattern from AttributeValueTranslations
 */
export default function ProductTranslationRow({ product, selectedLanguages, onUpdate, onFlashMessage, storeId }) {
  const { availableLanguages } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [translations, setTranslations] = useState(product.translations || {});
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [translating, setTranslating] = useState({});
  const [flashMessage, setFlashMessage] = useState(null);

  // Update translations when product prop changes
  useEffect(() => {
    console.log('ProductTranslationRow - Product changed:', {
      productId: product.id,
      productName: product.name,
      translations: product.translations,
      translationKeys: Object.keys(product.translations || {})
    });
    setTranslations(product.translations || {});
  }, [product]);

  // Filter languages by selected languages
  const filteredLanguages = availableLanguages.filter(lang =>
    selectedLanguages?.includes(lang.code)
  );

  // Get translation status
  const getTranslationStatus = () => {
    const translatedCount = filteredLanguages.filter(lang => {
      const translation = translations[lang.code];
      return translation && translation.name && translation.name.trim().length > 0;
    }).length;

    return {
      count: translatedCount,
      total: filteredLanguages.length,
      isComplete: translatedCount === filteredLanguages.length
    };
  };

  const status = getTranslationStatus();

  // Fields to translate
  const fields = [
    { key: 'name', label: 'Name', multiline: false },
    { key: 'short_description', label: 'Short Description', multiline: true },
    { key: 'description', label: 'Description', multiline: true }
  ];

  // Handle translation change
  const handleTranslationChange = (langCode, field, value) => {
    setTranslations(prev => ({
      ...prev,
      [langCode]: {
        ...(prev[langCode] || {}),
        [field]: value
      }
    }));
  };

  // Save translations
  const handleSave = async () => {
    try {
      setSaving(true);
      setSaveSuccess(false);
      await api.put(`/products/${product.id}`, {
        translations
      });
      setFlashMessage({ type: 'success', message: 'Product translations updated successfully' });
      if (onFlashMessage) onFlashMessage('Product translations updated successfully', 'success');
      if (onUpdate) onUpdate(product.id, translations);
      setSaving(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      console.error('Error saving translations:', error);
      setFlashMessage({ type: 'error', message: 'Failed to save translations' });
      setSaving(false);
    }
  };

  // AI translate field from one language to another
  const handleAITranslate = async (field, fromLang, toLang) => {
    const sourceText = translations[fromLang]?.[field];
    if (!sourceText || !sourceText.trim()) {
      setFlashMessage({ type: 'error', message: `No ${fromLang.toUpperCase()} text found for ${field}` });
      return;
    }

    const translatingKey = `${field}-${toLang}`;
    try {
      setTranslating(prev => ({ ...prev, [translatingKey]: true }));

      const response = await api.post('/translations/ai-translate', {
        text: sourceText,
        fromLang,
        toLang,
        storeId,
        entityType: 'product'
      });

      if (response && response.success && response.data) {
        handleTranslationChange(toLang, field, response.data.translated);
        setFlashMessage({ type: 'success', message: `${field} translated to ${toLang.toUpperCase()}` });
      }
    } catch (error) {
      console.error('AI translate error:', error);
      setFlashMessage({ type: 'error', message: `Failed to translate ${field}` });
    } finally {
      setTranslating(prev => ({ ...prev, [translatingKey]: false }));
    }
  };

  return (
    <>
      <FlashMessage message={flashMessage} onClose={() => setFlashMessage(null)} />
      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      {/* Collapsed Header */}
      <div className="flex items-center gap-2 px-4 py-3 hover:bg-gray-50 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <button
          type="button"
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
        >
          {isExpanded ? (
            <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
          )}

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {translations.en?.name || product.name || 'Unnamed Product'}
            </p>
            <p className="text-xs text-gray-500">
              SKU: {product.sku}
            </p>
          </div>
        </button>

        <div className="flex items-center gap-3">
          <Globe className="w-4 h-4 text-gray-400" />
          <span className={`flex items-center gap-1 text-xs font-medium ${
            status.isComplete ? 'text-green-600' : 'text-gray-500'
          }`}>
            {status.isComplete && <span className="w-2 h-2 rounded-full bg-green-500"></span>}
            {status.count}/{status.total}
          </span>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-gray-200 bg-gray-50">
          {fields.map((field) => (
            <div key={field.key} className="border-b border-gray-200 last:border-b-0 bg-white">
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-700">{field.label}</p>
              </div>
              <div className="p-4 space-y-3">
                {filteredLanguages.map((lang) => {
                  const isRTL = lang.is_rtl || false;
                  const value = translations[lang.code]?.[field.key] || '';
                  const translatingKey = `${field.key}-${lang.code}`;

                  return (
                    <div
                      key={lang.code}
                      className="flex items-start gap-3"
                    >
                      <label className="text-sm font-medium text-gray-700 w-12 flex-shrink-0 pt-2">
                        {lang.code === 'en' ? 'En' : lang.code === 'nl' ? 'NL' : lang.code.toUpperCase()}
                      </label>
                      <div className="flex-1">
                        {field.multiline ? (
                          <Textarea
                            value={value}
                            onChange={(e) => handleTranslationChange(lang.code, field.key, e.target.value)}
                            dir={isRTL ? 'rtl' : 'ltr'}
                            className={`w-full text-sm resize-none ${isRTL ? 'text-right' : 'text-left'}`}
                            rows={3}
                            placeholder={`${lang.native_name} ${field.label.toLowerCase()}`}
                          />
                        ) : (
                          <Input
                            type="text"
                            value={value}
                            onChange={(e) => handleTranslationChange(lang.code, field.key, e.target.value)}
                            dir={isRTL ? 'rtl' : 'ltr'}
                            className={`w-full text-sm ${isRTL ? 'text-right' : 'text-left'}`}
                            placeholder={`${lang.native_name} ${field.label.toLowerCase()}`}
                          />
                        )}
                      </div>
                      {lang.code !== 'en' && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleAITranslate(field.key, 'en', lang.code)}
                                disabled={translating[translatingKey] || !translations.en?.[field.key]}
                                className="flex-shrink-0"
                              >
                                <Wand2 className={`w-4 h-4 ${translating[translatingKey] ? 'animate-spin' : ''}`} />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Cost: 0.1 credits per translation</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Save Button */}
          <div className="px-4 py-3 bg-gray-50 flex justify-end">
            <SaveButton
              onClick={handleSave}
              loading={saving}
              success={saveSuccess}
              defaultText="Save Translations"
            />
          </div>
        </div>
      )}
    </div>
    </>
  );
}
