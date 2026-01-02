import React, { useState, useEffect } from 'react';
import { useTranslation } from '@/contexts/TranslationContext';
import { Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import FlashMessage from '@/components/storefront/FlashMessage';
import api from '@/utils/api';

/**
 * TranslationFields Component
 *
 * A reusable component for managing multilingual content in admin forms.
 * Displays tabs for each active language and allows editing translations.
 *
 * @param {Object} translations - Current translations object { en: {...}, es: {...} }
 * @param {Function} onChange - Callback when translations change
 * @param {Array} fields - Field definitions [{ name: 'name', label: 'Name', type: 'text', required: true }]
 * @param {String} defaultLanguage - Default language to show (default: 'en')
 *
 * @param className
 * @param storeId
 * @param entityType
 * @example
 * <TranslationFields
 *   translations={formData.translations}
 *   onChange={(newTranslations) => setFormData({ ...formData, translations: newTranslations })}
 *   fields={[
 *     { name: 'name', label: 'Product Name', type: 'text', required: true },
 *     { name: 'description', label: 'Description', type: 'textarea', rows: 4 },
 *     { name: 'short_description', label: 'Short Description', type: 'textarea', rows: 2 }
 *   ]}
 * />
 */
export default function TranslationFields({
  translations = {},
  onChange,
  fields = [],
  defaultLanguage = 'en',
  className = '',
  storeId = null,
  entityType = 'product'
}) {
  const { availableLanguages } = useTranslation();
  const [activeLanguage, setActiveLanguage] = useState(defaultLanguage);
  const [localTranslations, setLocalTranslations] = useState(translations);
  const [translating, setTranslating] = useState({}); // { fieldName-langCode: boolean }
  const [flashMessage, setFlashMessage] = useState(null);

  // Update local state when translations prop changes
  useEffect(() => {
    setLocalTranslations(translations);
  }, [translations]);

  // Ensure all active languages have an entry
  useEffect(() => {
    const updated = { ...localTranslations };
    let hasChanges = false;

    availableLanguages.forEach(lang => {
      if (!updated[lang.code]) {
        updated[lang.code] = {};
        fields.forEach(field => {
          updated[lang.code][field.name] = '';
        });
        hasChanges = true;
      }
    });

    if (hasChanges) {
      setLocalTranslations(updated);
    }
  }, [availableLanguages, fields]);

  const handleFieldChange = (languageCode, fieldName, value) => {
    const updated = {
      ...localTranslations,
      [languageCode]: {
        ...(localTranslations[languageCode] || {}),
        [fieldName]: value
      }
    };
    setLocalTranslations(updated);
    onChange(updated);
  };

  const getFieldValue = (languageCode, fieldName) => {
    return localTranslations[languageCode]?.[fieldName] || '';
  };

  const isLanguageComplete = (languageCode) => {
    const langData = localTranslations[languageCode];
    if (!langData) return false;

    const requiredFields = fields.filter(f => f.required);
    return requiredFields.every(field => {
      const value = langData[field.name];
      return value && value.trim() !== '';
    });
  };

  const getLanguageName = (code) => {
    const lang = availableLanguages.find(l => l.code === code);
    return lang ? lang.native_name || lang.name : code.toUpperCase();
  };

  // AI translate field from English to target language
  const handleAITranslate = async (fieldName, toLang) => {
    const sourceText = localTranslations[defaultLanguage]?.[fieldName];

    if (!sourceText || !sourceText.trim()) {
      setFlashMessage({ type: 'error', message: `No ${defaultLanguage.toUpperCase()} text found for ${fieldName}` });
      return;
    }

    const translatingKey = `${fieldName}-${toLang}`;
    try {
      setTranslating(prev => ({ ...prev, [translatingKey]: true }));

      const response = await api.post('/translations/ai-translate', {
        text: sourceText,
        fromLang: defaultLanguage,
        toLang,
        storeId,
        entityType
      });

      if (response && response.success && response.data) {
        // Update the translation
        handleFieldChange(toLang, fieldName, response.data.translated);
        setFlashMessage({ type: 'success', message: `${fieldName} translated to ${toLang.toUpperCase()} (0.1 credits charged)` });
      }
    } catch (error) {
      console.error('AI translate error:', error);
      if (error.response?.status === 402) {
        setFlashMessage({ type: 'error', message: 'Insufficient credits for translation' });
      } else {
        setFlashMessage({ type: 'error', message: `Failed to translate ${fieldName}` });
      }
    } finally {
      setTranslating(prev => ({ ...prev, [translatingKey]: false }));
    }
  };

  if (availableLanguages.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-yellow-800">
          No languages configured. Please add languages in the Languages settings.
        </p>
      </div>
    );
  }

  return (
    <div className={`translation-fields ${className}`}>
      <FlashMessage message={flashMessage} onClose={() => setFlashMessage(null)} />
      {/* Language Tabs */}
      <div className="border-b border-gray-200 mb-4">
        <div className="flex flex-wrap gap-2">
          {availableLanguages.map(lang => {
            const isComplete = isLanguageComplete(lang.code);
            const isActive = activeLanguage === lang.code;
            const isDefault = lang.code === defaultLanguage;

            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => setActiveLanguage(lang.code)}
                className={`
                  px-4 py-2 font-medium text-sm rounded-t-lg border-b-2 transition-colors
                  ${isActive
                    ? 'border-blue-500 text-blue-600 bg-blue-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                  ${isDefault ? 'font-bold' : ''}
                `}
              >
                <span className="flex items-center gap-2">
                  {lang.native_name || lang.name}
                  {isDefault && (
                    <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">
                      Default
                    </span>
                  )}
                  {!isDefault && isComplete && (
                    <span className="text-green-500 text-xs">✓</span>
                  )}
                  {!isDefault && !isComplete && (
                    <span className="text-amber-500 text-xs">⚠</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Translation Fields for Active Language */}
      <div className="translation-content space-y-4">
        {fields.map(field => {
          const value = getFieldValue(activeLanguage, field.name);
          const isRequired = field.required && activeLanguage === defaultLanguage;
          const translatingKey = `${field.name}-${activeLanguage}`;
          const showWand = activeLanguage !== defaultLanguage && storeId;

          return (
            <div key={field.name} className="form-group">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">
                  {field.label}
                  {isRequired && <span className="text-red-500 ml-1">*</span>}
                  {field.hint && (
                    <span className="text-gray-500 text-xs ml-2">({field.hint})</span>
                  )}
                </label>
                {showWand && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleAITranslate(field.name, activeLanguage)}
                          disabled={translating[translatingKey] || !localTranslations[defaultLanguage]?.[field.name]}
                          className="h-8 w-8 p-0"
                        >
                          <Wand2 className={`w-4 h-4 ${translating[translatingKey] ? 'animate-spin' : ''}`} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>AI Translate from {defaultLanguage.toUpperCase()} (0.1 credits)</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>

              {field.type === 'textarea' ? (
                <textarea
                  value={value}
                  onChange={(e) => handleFieldChange(activeLanguage, field.name, e.target.value)}
                  rows={field.rows || 4}
                  placeholder={field.placeholder || `Enter ${field.label.toLowerCase()} in ${getLanguageName(activeLanguage)}`}
                  required={isRequired}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : field.type === 'richtext' ? (
                <div className="relative">
                  <textarea
                    value={value}
                    onChange={(e) => handleFieldChange(activeLanguage, field.name, e.target.value)}
                    rows={field.rows || 6}
                    placeholder={field.placeholder || `Enter ${field.label.toLowerCase()} in ${getLanguageName(activeLanguage)}`}
                    required={isRequired}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  />
                  <div className="mt-1 text-xs text-gray-500">
                    HTML supported. Preview will be available in a future update.
                  </div>
                </div>
              ) : (
                <input
                  type={field.type || 'text'}
                  value={value}
                  onChange={(e) => handleFieldChange(activeLanguage, field.name, e.target.value)}
                  placeholder={field.placeholder || `Enter ${field.label.toLowerCase()} in ${getLanguageName(activeLanguage)}`}
                  required={isRequired}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}

              {field.helper && (
                <p className="mt-1 text-xs text-gray-500">{field.helper}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Translation Status Summary */}
      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
        <div className="text-sm text-gray-600">
          <strong>Translation Status:</strong>
          <div className="mt-2 flex flex-wrap gap-2">
            {availableLanguages.map(lang => {
              const isComplete = isLanguageComplete(lang.code);
              return (
                <span
                  key={lang.code}
                  className={`px-2 py-1 rounded text-xs ${
                    isComplete
                      ? 'bg-green-100 text-green-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {lang.code.toUpperCase()}: {isComplete ? 'Complete' : 'Incomplete'}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * TranslationIndicator Component
 *
 * Shows a badge indicating translation status in grid rows.
 *
 * @param {Object} translations - Translations object
 * @param {Array} requiredLanguages - Languages that must have translations
 *
 * @example
 * <TranslationIndicator
 *   translations={product.translations}
 *   requiredLanguages={['en', 'es', 'fr']}
 * />
 */
export function TranslationIndicator({ translations = {}, requiredLanguages = ['en'] }) {
  const translatedCount = Object.keys(translations).filter(
    code => requiredLanguages.includes(code) && translations[code] && Object.keys(translations[code]).length > 0
  ).length;

  const totalRequired = requiredLanguages.length;
  const isComplete = translatedCount === totalRequired;

  if (translatedCount === 0) {
    return (
      <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-red-100 text-red-700">
        <span className="mr-1">⚠</span> No translations
      </span>
    );
  }

  if (isComplete) {
    return (
      <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-green-100 text-green-700">
        <span className="mr-1">✓</span> {translatedCount}/{totalRequired}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-amber-100 text-amber-700">
      <span className="mr-1">◐</span> {translatedCount}/{totalRequired}
    </span>
  );
}

/**
 * TranslationHelper Component
 *
 * Shows helper text and tips for managing translations.
 */
export function TranslationHelper() {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
      <h4 className="font-semibold mb-2">Translation Tips:</h4>
      <ul className="list-disc list-inside space-y-1">
        <li>Fill in the <strong>Default language (EN)</strong> first - it's required</li>
        <li>Other languages are optional but recommended for multilingual stores</li>
        <li>Use the <strong>✓</strong> indicator to see which languages are complete</li>
        <li>You can use the AI Translation feature to auto-translate after saving</li>
      </ul>
    </div>
  );
}
