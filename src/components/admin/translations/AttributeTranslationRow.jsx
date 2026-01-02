import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Globe, Wand2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import SaveButton from '@/components/ui/save-button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/contexts/TranslationContext';
import FlashMessage from '@/components/storefront/FlashMessage';
import api from '@/utils/api';
import AttributeValueTranslations from '../attributes/AttributeValueTranslations';

/**
 * Accordion row for managing attribute translations (name + options)
 */
export default function AttributeTranslationRow({ attribute, selectedLanguages, onUpdate, onFlashMessage, storeId }) {
  const { availableLanguages } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [translations, setTranslations] = useState(attribute.translations || {});
  const [attributeValues, setAttributeValues] = useState(attribute.values || []);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [translating, setTranslating] = useState({});
  const [flashMessage, setFlashMessage] = useState(null);

  // Filter languages by selected languages
  const filteredLanguages = availableLanguages.filter(lang =>
    selectedLanguages?.includes(lang.code)
  );

  // Get translation status for attribute name
  const getAttributeTranslationStatus = () => {
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

  // Get translation status for attribute values
  const getValuesTranslationStatus = () => {
    if (!attributeValues || attributeValues.length === 0) return { count: 0, total: 0, isComplete: true };

    let totalFields = attributeValues.length * filteredLanguages.length;
    let translatedFields = 0;

    attributeValues.forEach(value => {
      filteredLanguages.forEach(lang => {
        const translation = value.translations?.[lang.code];
        if (translation && translation.label && translation.label.trim().length > 0) {
          translatedFields++;
        }
      });
    });

    return {
      count: translatedFields,
      total: totalFields,
      isComplete: translatedFields === totalFields
    };
  };

  const attributeStatus = getAttributeTranslationStatus();
  const valuesStatus = getValuesTranslationStatus();
  const overallComplete = attributeStatus.isComplete && valuesStatus.isComplete;

  // Handle attribute name translation change
  const handleAttributeTranslationChange = (langCode, value) => {
    setTranslations(prev => ({
      ...prev,
      [langCode]: {
        ...(prev[langCode] || {}),
        name: value
      }
    }));
  };

  // Handle attribute value translation change
  const handleValueTranslationChange = (valueId, updatedTranslations) => {
    setAttributeValues(prev => prev.map(v =>
      (v.id || v.tempId) === valueId ? { ...v, translations: updatedTranslations } : v
    ));
  };

  // Save all translations (attribute name + all values)
  const handleSave = async () => {
    try {
      setSaving(true);
      setSaveSuccess(false);

      // Save attribute name translations
      await api.put(`/attributes/${attribute.id}`, {
        translations
      });

      // Save each attribute value translation
      for (const value of attributeValues) {
        if (value.id) {
          await api.put(`/attributes/${attribute.id}/values/${value.id}`, {
            translations: value.translations
          });
        }
      }

      setFlashMessage({ type: 'success', message: 'Attribute translations updated successfully' });
      if (onFlashMessage) onFlashMessage('Attribute translations updated successfully', 'success');
      if (onUpdate) onUpdate(attribute.id, translations, attributeValues);
      setSaving(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      console.error('Error saving translations:', error);
      setFlashMessage({ type: 'error', message: 'Failed to save translations' });
      setSaving(false);
    }
  };

  // AI translate attribute name from one language to another
  const handleAITranslateAttribute = async (fromLang, toLang) => {
    const sourceText = translations[fromLang]?.name;
    if (!sourceText || !sourceText.trim()) {
      setFlashMessage({ type: 'error', message: `No ${fromLang.toUpperCase()} name found for attribute` });
      return;
    }

    const translatingKey = `attribute-name-${toLang}`;
    try {
      setTranslating(prev => ({ ...prev, [translatingKey]: true }));

      const response = await api.post('/translations/ai-translate', {
        text: sourceText,
        fromLang,
        toLang,
        storeId,
        entityType: 'attribute'
      });

      if (response && response.success && response.data) {
        handleAttributeTranslationChange(toLang, response.data.translated);
        setFlashMessage({ type: 'success', message: `Attribute name translated to ${toLang.toUpperCase()}` });
      }
    } catch (error) {
      console.error('AI translate error:', error);
      setFlashMessage({ type: 'error', message: 'Failed to translate attribute name' });
    } finally {
      setTranslating(prev => ({ ...prev, [translatingKey]: false }));
    }
  };

  const hasValues = attribute.type === 'select' || attribute.type === 'multiselect';

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
              {translations.en?.name || attribute.name || 'Unnamed Attribute'}
            </p>
            <p className="text-xs text-gray-500">
              {attribute.code} • {attribute.type}
              {hasValues && ` • ${attributeValues.length} options`}
            </p>
          </div>
        </button>

        <div className="flex items-center gap-3">
          <Globe className="w-4 h-4 text-gray-400" />
          <span className={`flex items-center gap-1 text-xs font-medium ${
            overallComplete ? 'text-green-600' : 'text-gray-500'
          }`}>
            {overallComplete && <span className="w-2 h-2 rounded-full bg-green-500"></span>}
            {hasValues ? `${valuesStatus.count + attributeStatus.count}/${valuesStatus.total + attributeStatus.total}` : `${attributeStatus.count}/${attributeStatus.total}`}
          </span>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-gray-200 bg-gray-50">
          {/* Attribute Name Translations */}
          <div className="border-b border-gray-200 bg-white">
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
              <p className="text-sm font-medium text-gray-700">Attribute Name</p>
            </div>
            <div className="p-4 space-y-3">
              {filteredLanguages.map((lang) => {
                const isRTL = lang.is_rtl || false;
                const value = translations[lang.code]?.name || '';
                const translatingKey = `attribute-name-${lang.code}`;

                return (
                  <div
                    key={lang.code}
                    className="flex items-center gap-3"
                  >
                    <label className="text-sm font-medium text-gray-700 w-12 flex-shrink-0">
                      {lang.code === 'en' ? 'En' : lang.code === 'nl' ? 'NL' : lang.code.toUpperCase()}
                    </label>
                    <div className="flex-1">
                      <Input
                        type="text"
                        value={value}
                        onChange={(e) => handleAttributeTranslationChange(lang.code, e.target.value)}
                        dir={isRTL ? 'rtl' : 'ltr'}
                        className={`w-full text-sm ${isRTL ? 'text-right' : 'text-left'}`}
                        placeholder={`${lang.native_name} attribute name`}
                      />
                    </div>
                    {lang.code !== 'en' && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleAITranslateAttribute('en', lang.code)}
                              disabled={translating[translatingKey] || !translations.en?.name}
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

          {/* Attribute Values (Options) */}
          {hasValues && attributeValues.length > 0 && (
            <div className="border-b border-gray-200 bg-white">
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-700">Attribute Options</p>
              </div>
              <div className="p-4 space-y-2">
                {attributeValues.map((value) => (
                  <AttributeValueTranslations
                    key={value.id || value.tempId}
                    attributeValue={{
                      ...value,
                      label: value.translations?.en?.label || value.code
                    }}
                    selectedLanguages={selectedLanguages}
                    onTranslationChange={handleValueTranslationChange}
                    onDelete={() => {}} // No delete in translation view
                  />
                ))}
              </div>
            </div>
          )}

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
