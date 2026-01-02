import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Globe, Wand2, FileText } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import SaveButton from '@/components/ui/save-button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/contexts/TranslationContext';
import FlashMessage from '@/components/storefront/FlashMessage';
import api from '@/utils/api';

/**
 * Accordion row for managing PDF template translations
 */
export default function PdfTemplateTranslationRow({ template, onUpdate, selectedLanguages, onFlashMessage, storeId, userCredits, translationCost, onCreditsDeducted }) {
  const { availableLanguages } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [translations, setTranslations] = useState(template.translations || {});
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [translating, setTranslating] = useState({});
  const [flashMessage, setFlashMessage] = useState(null);

  const filteredLanguages = availableLanguages.filter(lang => selectedLanguages?.includes(lang.code));

  // Get translation status
  const getTranslationStatus = () => {
    const translatedCount = filteredLanguages.filter(lang => {
      const translation = translations[lang.code];
      return translation && translation.html_template && translation.html_template.trim().length > 0;
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
    { key: 'html_template', label: 'HTML Template', multiline: true }
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
      await api.put(`/pdf-templates/${template.id}`, {
        translations
      });
      setFlashMessage({ type: 'success', message: 'PDF template translations updated successfully' });
      if (onFlashMessage) onFlashMessage('PDF template translations updated successfully', 'success');
      if (onUpdate) onUpdate(template.id, translations);
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
        entityType: 'pdf-template'
      });

      if (response && response.success && response.data) {
        handleTranslationChange(toLang, field, response.data.translated);
        setFlashMessage({ type: 'success', message: `${field} translated to ${toLang.toUpperCase()}` });

        // Update credits in sidebar and local state
        if (response.creditsDeducted && onCreditsDeducted) {
          onCreditsDeducted(response.creditsDeducted);
        }
        window.dispatchEvent(new CustomEvent('creditsUpdated'));
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

          <FileText className="w-4 h-4 text-purple-500 flex-shrink-0" />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-gray-900">
                {template.name}
              </p>
              {template.is_system && (
                <Badge variant="outline" className="text-xs">System</Badge>
              )}
              <Badge variant="secondary" className="text-xs">{template.template_type}</Badge>
            </div>
            <p className="text-xs text-gray-500">
              {template.identifier}
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
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                <h4 className="text-sm font-medium text-gray-700">{field.label}</h4>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-1 gap-4">
                  {filteredLanguages.map((lang) => (
                    <div key={lang.code} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-gray-700">
                          {lang.name} ({lang.code})
                        </label>
                        {lang.code !== 'en' && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-block">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleAITranslate(field.key, 'en', lang.code)}
                                    disabled={translating[`${field.key}-${lang.code}`] || (userCredits !== null && userCredits < translationCost)}
                                    className="h-6 px-2 text-xs"
                                  >
                                    <Wand2 className={`w-3 h-3 mr-1 ${translating[`${field.key}-${lang.code}`] ? 'animate-spin' : ''}`} />
                                    AI Translate
                                  </Button>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                {userCredits !== null && userCredits < translationCost ? (
                                  <p>Insufficient credits ({userCredits} available, {translationCost} required)</p>
                                ) : (
                                  <p>Cost: {translationCost} credit{translationCost !== 1 ? 's' : ''} per translation</p>
                                )}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                      <Textarea
                        value={translations[lang.code]?.[field.key] || ''}
                        onChange={(e) => handleTranslationChange(lang.code, field.key, e.target.value)}
                        placeholder={`Enter ${field.label.toLowerCase()} in ${lang.name}...`}
                        rows={12}
                        className="text-sm font-mono"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}

          {/* Save Button */}
          <div className="px-4 py-3 bg-gray-50 flex justify-end">
            <SaveButton
              onClick={handleSave}
              loading={saving}
              success={saveSuccess}
            >
              Save Translations
            </SaveButton>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
