import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Languages, CheckCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { useTranslation } from "@/contexts/TranslationContext.jsx";
import FlashMessage from "@/components/storefront/FlashMessage";
import api from "@/utils/api";

/**
 * Reusable Bulk Translate Dialog Component
 *
 * @param {boolean} open - Whether the dialog is open
 * @param {function} onOpenChange - Callback when dialog open state changes
 * @param {string} entityType - Type of entity (e.g., 'categories', 'products', 'attributes')
 * @param {string} entityName - Display name for the entity (e.g., 'Categories', 'Products')
 * @param {function} onTranslate - Callback function to handle translation (receives fromLang, toLang)
 * @param {function} onComplete - Callback after translation completes (for reloading data)
 */
export default function BulkTranslateDialog({
  open,
  onOpenChange,
  entityType = 'items',
  entityName = 'Items',
  onTranslate,
  onComplete,
  itemCount = 0,
  userCredits = null,
  onCreditsUpdate = null
}) {
  const { availableLanguages } = useTranslation();
  const [translateFromLang, setTranslateFromLang] = useState('en');
  const [translateToLangs, setTranslateToLangs] = useState([]);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationCost, setTranslationCost] = useState(0.1); // Default fallback
  const [showFlash, setShowFlash] = useState(false);
  const [flashMessage, setFlashMessage] = useState(null);
  const [localCredits, setLocalCredits] = useState(userCredits);
  const [translationProgress, setTranslationProgress] = useState({ current: 0, total: 0 });
  const [itemProgress, setItemProgress] = useState({ current: 0, total: 0 }); // For UI labels item-level progress
  const [showBackgroundMessage, setShowBackgroundMessage] = useState(false); // For UI Labels background processing message

  // Sync local credits with prop
  useEffect(() => {
    setLocalCredits(userCredits);
  }, [userCredits]);

  // Get flat-rate cost based on entity type
  const getEntityCost = (entityType) => {
    const entityCosts = {
      'CMS Content': 0.35,       // Average of pages (0.5) and blocks (0.2)
      'cms_page': 0.5,           // CMS pages: 0.5 credits
      'cms_block': 0.2,          // CMS blocks: 0.2 credits
      'cookie_consent': 0.1,     // Standard rate
      'product': 0.1,            // Standard rate
      'category': 0.1,           // Standard rate
      'attribute': 0.1,          // Standard rate
      'product_tab': 0.1,        // Standard rate
      'product_label': 0.1,      // Standard rate
      'UI labels': 0.1,          // Standard rate
      'custom_option': 0.1       // Standard rate
    };

    return entityCosts[entityType] || entityCosts[entityName] || 0.1; // Default to 0.1
  };

  // Load translation cost from API
  useEffect(() => {
    const loadTranslationCost = async () => {
      try {
        // Determine which service to use based on entity type
        let serviceKey = 'ai_translation'; // Default

        // Map entity types to service keys
        const entityTypeToServiceKey = {
          'cms_page': 'ai_translation_cms_page',
          'cms_block': 'ai_translation_cms_block',
          'email_template': 'ai_translation_email_template',
          'pdf_template': 'ai_translation_pdf_template',
          'product': 'ai_translation_product',
          'category': 'ai_translation_category',
          'attribute': 'ai_translation_attribute',
          'product_tab': 'ai_translation_product_tab',
          'product_label': 'ai_translation_product_label',
          'cookie_consent': 'ai_translation_cookie_consent',
          'custom_option': 'ai_translation_custom_option'
        };

        if (entityTypeToServiceKey[entityType]) {
          serviceKey = entityTypeToServiceKey[entityType];
        } else if (entityName === 'CMS Pages') {
          serviceKey = 'ai_translation_cms_page';
        } else if (entityName === 'CMS Blocks') {
          serviceKey = 'ai_translation_cms_block';
        } else if (entityName === 'Email Templates') {
          serviceKey = 'ai_translation_email_template';
        } else if (entityName === 'PDF Templates') {
          serviceKey = 'ai_translation_pdf_template';
        } else if (entityName === 'CMS Content') {
          // For mixed CMS content, use average
          const pageResponse = await api.get('service-credit-costs/key/ai_translation_cms_page');
          const blockResponse = await api.get('service-credit-costs/key/ai_translation_cms_block');
          if (pageResponse.success && blockResponse.success) {
            setTranslationCost((pageResponse.service.cost_per_unit + blockResponse.service.cost_per_unit) / 2);
            return;
          }
        }

        const response = await api.get(`service-credit-costs/key/${serviceKey}`);
        if (response.success && response.service) {
          setTranslationCost(response.service.cost_per_unit);
        } else {
          setTranslationCost(getEntityCost(entityType));
        }
      } catch (error) {
        console.error('Error loading translation cost:', error);
        setTranslationCost(getEntityCost(entityType));
      }
    };

    if (open) {
      loadTranslationCost();
      // Refresh credit balance when modal opens
      if (onCreditsUpdate) {
        onCreditsUpdate();
      }
    }
  }, [open, entityType, entityName]);

  const handleTranslate = async () => {
    if (!translateFromLang || translateToLangs.length === 0) {
      setFlashMessage({ type: 'error', message: "Please select source language and at least one target language" });
      return;
    }

    if (translateToLangs.includes(translateFromLang)) {
      setFlashMessage({ type: 'error', message: "Target languages cannot include the source language" });
      return;
    }

    setIsTranslating(true);
    setTranslationProgress({ current: 0, total: translateToLangs.length });
    setItemProgress({ current: 0, total: 0 });

    // Warn user if translating UI labels (can be slow)
    if (entityName === 'UI Labels' && itemCount > 50) {
      setFlashMessage({ type: 'info', message: `Translating ${itemCount} UI labels. This may take a few minutes...` });
    }

    try {
      // Call the provided onTranslate callback for each target language
      let totalTranslated = 0;
      let totalSkipped = 0;
      let totalFailed = 0;
      let totalCreditsDeducted = 0;
      const allErrors = [];
      const allResults = [];

      for (let i = 0; i < translateToLangs.length; i++) {
        const toLang = translateToLangs[i];
        setTranslationProgress({ current: i + 1, total: translateToLangs.length });

        // For UI Labels, pass progress callback to get item-level updates
        const progressCallback = (entityName === 'UI Labels') ? (progress) => {
          setItemProgress(progress);
        } : null;

        const result = await onTranslate(translateFromLang, toLang, progressCallback);
        allResults.push(result);

        if (result.success) {
          totalTranslated += result.data.translated || 0;
          totalSkipped += result.data.skipped || 0;
          totalFailed += result.data.failed || 0;
          const creditsFromResponse = result.creditsDeducted || result.data?.creditsDeducted || 0;
          totalCreditsDeducted += creditsFromResponse;
          if (result.data.errors && result.data.errors.length > 0) {
            allErrors.push(...result.data.errors.map(err => ({ ...err, toLang })));
          }
        } else {
          setFlashMessage({ type: 'error', message: `Failed to translate to ${toLang}: ${result.message}` });
        }
      }

      // Check if any result indicates background processing (for UI Labels)
      const hasBackgroundProcessing = allResults.some(result => result.data?.backgroundProcessing);

      if (hasBackgroundProcessing) {
        // Background processing mode - show message and close after 3 seconds

        // Show the background message in modal
        setShowBackgroundMessage(true);
        setIsTranslating(false); // Stop showing "translating" state

        // Show success message about background processing and email notification
        const message = 'Translation started in background. You will be notified by email when complete (approximately 10 minutes).';
        setFlashMessage({ type: 'success', message });

        // Update local credits for display
        if (totalCreditsDeducted > 0) {
          setLocalCredits(prev => Math.max(0, (prev || 0) - totalCreditsDeducted));
        }

        // Wait 5 seconds before closing to let user see the message
        await new Promise(resolve => setTimeout(resolve, 5000))
        // Reset states
        setShowBackgroundMessage(false);
        setTranslationProgress({ current: 0, total: 0 });
        setItemProgress({ current: 0, total: 0 });
        setTranslateToLangs([]);

        // Close dialog
        onOpenChange(false);

        // Reload data and credits
        if (onComplete) {
          setTimeout(() => onComplete(), 100);
        }

        // Reload credits in sidebar
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('creditsUpdated'));
        }, 150);

        return;
      }

      // Regular processing mode - show results and wait before closing
      // Update local credits for display in modal
      if (totalCreditsDeducted > 0) {
        setLocalCredits(prev => Math.max(0, (prev || 0) - totalCreditsDeducted));
      } else {
      }

      if (totalTranslated > 0) {
        const message = `Successfully translated ${totalTranslated} ${entityType} to ${translateToLangs.length} language(s)`;
        setFlashMessage({ type: 'success', message });
        setShowFlash(true);
        setTimeout(() => setShowFlash(false), 3000);
      }
      if (totalSkipped > 0 && totalTranslated === 0) {
        const message = `All ${totalSkipped} ${entityType} already have translations. ${totalCreditsDeducted > 0 ? `Charged ${totalCreditsDeducted.toFixed(2)} credits.` : ''}`;
        setFlashMessage({ type: 'info', message });
      }
      if (totalFailed > 0) {
        console.warn('Translation errors:', allErrors);
        setFlashMessage({ type: 'warning', message: `${totalFailed} translations failed. Check console for details.` });
      }

      // Wait 3 seconds before closing to let user see the message
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Reset states first
      setIsTranslating(false);
      setTranslationProgress({ current: 0, total: 0 });
      setItemProgress({ current: 0, total: 0 });
      setTranslateToLangs([]);

      // Wait for React to process state updates before closing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Then close dialog
      onOpenChange(false);

      // Reload data and credits after closing dialog
      if (onComplete) {
        setTimeout(() => onComplete(), 100);
      }

      // Reload credits in sidebar after modal closes
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('creditsUpdated'));
      }, 150);
    } catch (error) {
      setFlashMessage({ type: 'error', message: `Failed to translate ${entityType}` });
      // Reset states on error too
      setIsTranslating(false);
      setTranslationProgress({ current: 0, total: 0 });
      setItemProgress({ current: 0, total: 0 });
    }
  };

  return (
    <>
      {showFlash && (
        <FlashMessage
          message={flashMessage}
          onClose={() => setShowFlash(false)}
        />
      )}

      <Dialog open={open} onOpenChange={!isTranslating && !showBackgroundMessage ? onOpenChange : undefined}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-hidden flex flex-col" onInteractOutside={(e) => { if (isTranslating || showBackgroundMessage) e.preventDefault(); }}>
          <DialogHeader>
            <DialogTitle>Bulk AI Translate {entityName}</DialogTitle>
          </DialogHeader>
        <div className="space-y-4 py-4 overflow-y-auto">
          {!showBackgroundMessage && (
            <>
              <div className="space-y-2">
                <Label htmlFor="from-lang">From Language</Label>
                <Select value={translateFromLang} onValueChange={setTranslateFromLang} disabled={isTranslating}>
                  <SelectTrigger id="from-lang" disabled={isTranslating}>
                    <SelectValue placeholder="Select source language" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableLanguages.map((lang) => (
                      <SelectItem key={lang.code} value={lang.code}>
                        {lang.name} ({lang.native_name})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>To Languages (Select one or more)</Label>
                <div className="border rounded-lg p-3 space-y-2 max-h-60 overflow-y-auto">
                  {availableLanguages
                    .filter((lang) => lang.code !== translateFromLang)
                    .map((lang) => (
                      <div key={lang.code} className="flex items-center space-x-2">
                        <Checkbox
                          id={`lang-${lang.code}`}
                          checked={translateToLangs.includes(lang.code)}
                          disabled={isTranslating}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setTranslateToLangs([...translateToLangs, lang.code]);
                            } else {
                              setTranslateToLangs(translateToLangs.filter(code => code !== lang.code));
                            }
                          }}
                        />
                        <Label
                          htmlFor={`lang-${lang.code}`}
                          className={`text-sm font-normal ${isTranslating ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                        >
                          {lang.name} ({lang.native_name})
                        </Label>
                      </div>
                    ))}
                </div>
                {translateToLangs.length > 0 && (
                  <p className="text-xs text-gray-600 mt-1">
                    {translateToLangs.length} language(s) selected
                  </p>
                )}
              </div>
            </>
          )}

          {!showBackgroundMessage && (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  {translateToLangs.length > 0 ? (
                    <>
                      This will translate all {entityType} from {translateFromLang} to {translateToLangs.length} selected language(s).
                      <span className="block mt-2 text-xs font-medium">
                        ⚠️ Credits are charged for all items processed.
                      </span>
                    </>
                  ) : (
                    'Please select at least one target language.'
                  )}
                </p>
              </div>

              {/* Credit Cost Estimate */}
              {translateToLangs.length > 0 && itemCount > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-green-800 font-medium">
                      💰 Estimated Cost:
                    </span>
                    <span className="text-green-900 font-bold">
                      {(itemCount * translateToLangs.length * translationCost).toFixed(2)} credits
                    </span>
                  </div>
                  <p className="text-xs text-green-700">
                    {itemCount} {entityType} × {translateToLangs.length} lang(s) × {translationCost.toFixed(2)} credits per item
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {entityName === 'CMS Content' && 'Mixed CMS content (average of pages and blocks)'}
                    {entityName === 'CMS Pages' && `CMS pages: ${translationCost.toFixed(2)} credits each`}
                    {entityName === 'CMS Blocks' && `CMS blocks: ${translationCost.toFixed(2)} credits each`}
                    {entityName === 'Email Templates' && `Email templates: ${translationCost.toFixed(2)} credits each`}
                    {entityName === 'PDF Templates' && `PDF templates: ${translationCost.toFixed(2)} credits each`}
                    {!['CMS Content', 'CMS Pages', 'CMS Blocks', 'Email Templates', 'PDF Templates'].includes(entityName) && `Standard rate: ${translationCost.toFixed(2)} credits per item`}
                  </p>
                </div>
              )}

              {/* Credit Balance Warning */}
              {translateToLangs.length > 0 && itemCount > 0 && localCredits !== null && localCredits !== undefined && (
                <div className={`p-3 rounded-lg border ${
                  localCredits < (itemCount * translateToLangs.length * translationCost)
                    ? 'bg-red-50 border-red-200'
                    : 'bg-green-50 border-green-200'
                }`}>
                  <div className="flex items-center justify-between text-sm">
                    <span className={localCredits < (itemCount * translateToLangs.length * translationCost) ? 'text-red-800' : 'text-green-800'}>
                      Your balance: {Number(localCredits).toFixed(2)} credits
                    </span>
                    {localCredits < (itemCount * translateToLangs.length * translationCost) && (
                      <span className="text-red-600 font-medium text-xs">
                        ⚠️ Insufficient credits
                      </span>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Background Processing Message for UI Labels */}
          {showBackgroundMessage && (
            <div className="bg-green-50 border-2 border-green-500 rounded-lg p-6 animate-pulse">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-green-900">Started in Background</h3>
                  <p className="text-sm text-green-700">Closing in 5 seconds</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowBackgroundMessage(false);
                    setTranslationProgress({ current: 0, total: 0 });
                    setItemProgress({ current: 0, total: 0 });
                    setTranslateToLangs([]);
                    onOpenChange(false);
                  }}
                  className="text-green-700 border-green-700 hover:bg-green-100"
                >
                  Close Now
                </Button>
              </div>
              <div className="bg-white rounded-lg p-4 border border-green-200">
                <p className="text-sm text-gray-700">
                  📧 <strong>You will be notified by email when complete</strong> (approximately 10 minutes).
                </p>
              </div>
            </div>
          )}

          {/* Translation Progress */}
          {isTranslating && entityName !== 'UI Labels' && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-purple-900">
                  Translation in Progress
                </span>
                {translationProgress.total > 0 && (
                  <span className="text-sm font-bold text-purple-700">
                    {translationProgress.current} / {translationProgress.total}
                  </span>
                )}
              </div>
              {translationProgress.total > 0 ? (
                <>
                  <div className="w-full bg-purple-200 rounded-full h-2.5">
                    <div
                      className="bg-purple-600 h-2.5 rounded-full transition-all duration-300"
                      style={{ width: `${(translationProgress.current / translationProgress.total) * 100}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-purple-700 mt-2">
                    Processing language {translationProgress.current} of {translationProgress.total}
                  </p>
                </>
              ) : (
                <div className="space-y-2">
                  <div className="w-full bg-purple-200 rounded-full h-2.5 overflow-hidden">
                    <div className="bg-purple-600 h-2.5 rounded-full animate-pulse" style={{ width: '100%' }}></div>
                  </div>
                  <p className="text-xs text-purple-700">
                    Preparing translation...
                  </p>
                </div>
              )}
            </div>
          )}

          {!showBackgroundMessage && (
            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                  setTranslateToLangs([]);
                }}
                disabled={isTranslating}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleTranslate}
                disabled={isTranslating || !translateFromLang || translateToLangs.length === 0 || (localCredits !== null && localCredits < (itemCount * translateToLangs.length * translationCost))}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isTranslating ? (
                  <>
                    <span className="animate-spin mr-2">⏳</span>
                    {entityName === 'UI Labels' ? (
                      'Starting translation...'
                    ) : translationProgress.total > 0 ? (
                      `${Math.round((translationProgress.current / translationProgress.total) * 100)}% Complete (${translationProgress.current}/${translationProgress.total})`
                    ) : (
                      'Processing...'
                    )}
                  </>
                ) : (
                  <>
                    <Languages className="w-4 h-4 mr-2" />
                    Translate to {translateToLangs.length || 0} Language(s)
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
