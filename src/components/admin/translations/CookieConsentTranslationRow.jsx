import React, { useState } from 'react';
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
 * Accordion row for managing cookie consent translations
 */
export default function CookieConsentTranslationRow({ settings, onUpdate, selectedLanguages, onFlashMessage, storeId }) {
  const { availableLanguages } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [translations, setTranslations] = useState(settings.translations || {});
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [translating, setTranslating] = useState({});
  const [flashMessage, setFlashMessage] = useState(null);

  const filteredLanguages = availableLanguages.filter(lang => selectedLanguages?.includes(lang.code));

  // Banner Content fields to translate
  const bannerFields = [
    { key: 'banner_text', label: 'Banner Message', multiline: true },
    { key: 'accept_button_text', label: 'Accept Button Text', multiline: false },
    { key: 'reject_button_text', label: 'Reject Button Text', multiline: false },
    { key: 'settings_button_text', label: 'Settings Button Text', multiline: false },
    { key: 'privacy_policy_text', label: 'Privacy Policy Link Text', multiline: false }
  ];

  // Get cookie categories from settings
  const categories = settings.categories || [
    { id: "necessary", name: "Necessary Cookies", description: "These cookies are necessary for the website to function and cannot be switched off." },
    { id: "analytics", name: "Analytics Cookies", description: "These cookies help us understand how visitors interact with our website." },
    { id: "marketing", name: "Marketing Cookies", description: "These cookies are used to deliver personalized advertisements." },
    { id: "functional", name: "Functional Cookies", description: "These cookies enable enhanced functionality and personalization." }
  ];

  // Get translation status - checks if all banner fields and category fields are translated
  const getTranslationStatus = () => {
    // Get all required translation fields
    const bannerFieldKeys = ['banner_text', 'accept_button_text', 'reject_button_text', 'settings_button_text', 'privacy_policy_text'];
    const categoryFieldKeys = categories.flatMap(cat => [`${cat.id}_name`, `${cat.id}_description`]);
    const allRequiredFields = [...bannerFieldKeys, ...categoryFieldKeys];

    const translatedCount = filteredLanguages.filter(lang => {
      const translation = translations[lang.code];
      if (!translation) return false;

      // Check if all required fields have translations
      return allRequiredFields.every(fieldKey => {
        const value = translation[fieldKey];
        return value && value.trim().length > 0;
      });
    }).length;

    return {
      count: translatedCount,
      total: filteredLanguages.length,
      isComplete: translatedCount === filteredLanguages.length
    };
  };

  const status = getTranslationStatus();

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
    if (!settings || !settings.id) {
      setFlashMessage({ type: 'error', message: 'No cookie consent settings found' });
      return;
    }

    try {
      setSaving(true);
      setSaveSuccess(false);
      console.log('Saving cookie consent translations:', {
        settingsId: settings.id,
        translations: translations
      });

      const response = await api.put(`/cookie-consent-settings/${settings.id}`, {
        translations
      });

      console.log('Cookie consent save response:', response);
      setFlashMessage({ type: 'success', message: 'Cookie consent translations updated successfully' });
      if (onFlashMessage) onFlashMessage('Cookie Consent translations updated successfully', 'success');
      if (onUpdate) onUpdate(settings.id, translations);
      setSaving(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      console.error('Error saving cookie consent translations:', error);
      console.error('Error response:', error.response?.data);
      setFlashMessage({ type: 'error', message: error.response?.data?.message || 'Failed to save translations' });
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
        entityType: 'cookie_consent'
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
              Cookie Consent Settings
            </p>
            <p className="text-xs text-gray-500">
              {settings.position} position • {settings.theme} theme
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
          {/* Banner Content Section */}
          <div className="bg-white border-b-4 border-blue-100">
            <div className="px-4 py-3 bg-blue-50 border-b border-blue-200">
              <h4 className="text-sm font-bold text-blue-900">Banner Content</h4>
            </div>
            {bannerFields.map((field) => (
              <div key={field.key} className="border-b border-gray-200 last:border-b-0">
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
          </div>

          {/* Cookie Categories Section */}
          <div className="bg-white border-b-4 border-green-100">
            <div className="px-4 py-3 bg-green-50 border-b border-green-200">
              <h4 className="text-sm font-bold text-green-900">Cookie Categories</h4>
            </div>
            {categories.map((category) => (
              <div key={category.id} className="border-b border-gray-200 last:border-b-0">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                  <p className="text-sm font-semibold text-gray-800">{category.name} ({category.id})</p>
                  <p className="text-xs text-gray-500 mt-1">{category.description}</p>
                </div>

                {/* Category Name Translations */}
                <div className="p-4 border-b border-gray-100">
                  <p className="text-xs font-medium text-gray-600 mb-2">Category Name</p>
                  <div className="space-y-3">
                    {filteredLanguages.map((lang) => {
                      const isRTL = lang.is_rtl || false;
                      const fieldKey = `${category.id}_name`;
                      const value = translations[lang.code]?.[fieldKey] || '';
                      const translatingKey = `${fieldKey}-${lang.code}`;

                      return (
                        <div key={lang.code} className="flex items-center gap-3">
                          <label className="text-sm font-medium text-gray-700 w-12 flex-shrink-0">
                            {lang.code === 'en' ? 'En' : lang.code === 'nl' ? 'NL' : lang.code.toUpperCase()}
                          </label>
                          <div className="flex-1">
                            <Input
                              type="text"
                              value={value}
                              onChange={(e) => handleTranslationChange(lang.code, fieldKey, e.target.value)}
                              dir={isRTL ? 'rtl' : 'ltr'}
                              className={`w-full text-sm ${isRTL ? 'text-right' : 'text-left'}`}
                              placeholder={`${lang.native_name} category name`}
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
                                    onClick={() => handleAITranslate(fieldKey, 'en', lang.code)}
                                    disabled={translating[translatingKey] || !translations.en?.[fieldKey]}
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

                {/* Category Description Translations */}
                <div className="p-4">
                  <p className="text-xs font-medium text-gray-600 mb-2">Category Description</p>
                  <div className="space-y-3">
                    {filteredLanguages.map((lang) => {
                      const isRTL = lang.is_rtl || false;
                      const fieldKey = `${category.id}_description`;
                      const value = translations[lang.code]?.[fieldKey] || '';
                      const translatingKey = `${fieldKey}-${lang.code}`;

                      return (
                        <div key={lang.code} className="flex items-start gap-3">
                          <label className="text-sm font-medium text-gray-700 w-12 flex-shrink-0 pt-2">
                            {lang.code === 'en' ? 'En' : lang.code === 'nl' ? 'NL' : lang.code.toUpperCase()}
                          </label>
                          <div className="flex-1">
                            <Textarea
                              value={value}
                              onChange={(e) => handleTranslationChange(lang.code, fieldKey, e.target.value)}
                              dir={isRTL ? 'rtl' : 'ltr'}
                              className={`w-full text-sm resize-none ${isRTL ? 'text-right' : 'text-left'}`}
                              rows={2}
                              placeholder={`${lang.native_name} category description`}
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
                                    onClick={() => handleAITranslate(fieldKey, 'en', lang.code)}
                                    disabled={translating[translatingKey] || !translations.en?.[fieldKey]}
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
              </div>
            ))}
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
