import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Globe, Wand2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import SaveButton from '@/components/ui/save-button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/contexts/TranslationContext';
import FlashMessage from '@/components/storefront/FlashMessage';
import api from '@/utils/api';

/**
 * Accordion row for managing product label translations
 */
export default function ProductLabelTranslationRow({ label, onUpdate, selectedLanguages, onFlashMessage, storeId }) {
  const { availableLanguages } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [translations, setTranslations] = useState(label.translations || {});
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [translating, setTranslating] = useState({});
  const [flashMessage, setFlashMessage] = useState(null);

  const filteredLanguages = availableLanguages.filter(lang => selectedLanguages?.includes(lang.code));

  // Get translation status
  const getTranslationStatus = () => {
    const translatedCount = filteredLanguages.filter(lang => {
      const translation = translations[lang.code];
      return translation && translation.text && translation.text.trim().length > 0;
    }).length;

    return {
      count: translatedCount,
      total: filteredLanguages.length,
      isComplete: translatedCount === filteredLanguages.length
    };
  };

  const status = getTranslationStatus();

  // Handle translation change
  const handleTranslationChange = (langCode, value) => {
    setTranslations(prev => ({
      ...prev,
      [langCode]: {
        ...(prev[langCode] || {}),
        text: value
      }
    }));
  };

  // Save translations
  const handleSave = async () => {
    try {
      setSaving(true);
      setSaveSuccess(false);
      await api.put(`/product-labels/${label.id}`, {
        translations
      });
      setFlashMessage({ type: 'success', message: 'Product label translations updated successfully' });
      if (onFlashMessage) onFlashMessage('Product Label translations updated successfully', 'success');
      if (onUpdate) onUpdate(label.id, translations);
      setSaving(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      console.error('Error saving translations:', error);
      setFlashMessage({ type: 'error', message: 'Failed to save translations' });
      setSaving(false);
    }
  };

  // AI translate from one language to another
  const handleAITranslate = async (fromLang, toLang) => {
    const sourceText = translations[fromLang]?.text;
    if (!sourceText || !sourceText.trim()) {
      setFlashMessage({ type: 'error', message: `No ${fromLang.toUpperCase()} text found` });
      return;
    }

    const translatingKey = `text-${toLang}`;
    try {
      setTranslating(prev => ({ ...prev, [translatingKey]: true }));

      const response = await api.post('/translations/ai-translate', {
        text: sourceText,
        fromLang,
        toLang,
        storeId,
        entityType: 'product_label'
      });

      if (response && response.success && response.data) {
        handleTranslationChange(toLang, response.data.translated);
        setFlashMessage({ type: 'success', message: `Label translated to ${toLang.toUpperCase()}` });
      }
    } catch (error) {
      console.error('AI translate error:', error);
      setFlashMessage({ type: 'error', message: 'Failed to translate label' });
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

          <div className="flex-1 min-w-0 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {translations.en?.text || label.text || 'Unnamed Label'}
              </p>
              <p className="text-xs text-gray-500">
                {label.type} • Color: {label.color}
              </p>
            </div>
            {label.color && (
              <div
                className="w-6 h-6 rounded border border-gray-300 flex-shrink-0"
                style={{ backgroundColor: label.color }}
              />
            )}
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
          <div className="bg-white">
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
              <p className="text-sm font-medium text-gray-700">Label Text</p>
            </div>
            <div className="p-4 space-y-3">
              {filteredLanguages.map((lang) => {
                const isRTL = lang.is_rtl || false;
                const value = translations[lang.code]?.text || '';
                const translatingKey = `text-${lang.code}`;

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
                        onChange={(e) => handleTranslationChange(lang.code, e.target.value)}
                        dir={isRTL ? 'rtl' : 'ltr'}
                        className={`w-full text-sm ${isRTL ? 'text-right' : 'text-left'}`}
                        placeholder={`${lang.native_name} label text`}
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
                              onClick={() => handleAITranslate('en', lang.code)}
                              disabled={translating[translatingKey] || !translations.en?.text}
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
