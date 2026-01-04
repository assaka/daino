import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Upload, File as FileIcon, Image, FileText, Film, Music, Archive, Copy, Check, Trash2, Search, Grid, List, Download, Eye, X, AlertCircle, ExternalLink, Settings, Wand2, Package, FolderOpen, Filter, CheckSquare, ChevronDown, Loader2, Sparkles, Maximize, Eraser, FileImage, Undo2, LayoutGrid, ImagePlus } from 'lucide-react';
import { useStoreSelection } from '@/contexts/StoreSelectionContext';
import FlashMessage from '@/components/storefront/FlashMessage';
import apiClient from '@/api/client';
import SaveButton from '@/components/ui/save-button';
import { PageLoader } from '@/components/ui/page-loader';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import AIImageOptimizerGrid from '@/components/admin/AIImageOptimizerGrid';
import ImageOptimizerModal from '@/components/image-optimizer/ImageOptimizerModal';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// Provider display info
const PROVIDERS = {
  openai: { name: 'OpenAI', icon: '🤖', color: 'text-green-600' },
  gemini: { name: 'Gemini', icon: '✨', color: 'text-blue-600' },
  flux: { name: 'Flux', icon: '⚡', color: 'text-purple-600' },
  qwen: { name: 'Qwen', icon: '🎨', color: 'text-orange-600' }
};

// Operation display info
const OPERATIONS = {
  compress: { name: 'Compress', icon: FileImage, description: 'Optimize quality & size' },
  upscale: { name: 'Upscale', icon: Maximize, description: 'Enhance resolution' },
  remove_bg: { name: 'Remove Background', icon: Eraser, description: 'Remove or replace background' },
  stage: { name: 'Product Staging', icon: Package, description: 'Place in environment' },
  convert: { name: 'Convert Format', icon: FileImage, description: 'WebP, AVIF optimization' }
};

// Staging context presets
const STAGING_CONTEXTS = [
  { id: 'living_room', label: 'Modern Living Room', value: 'modern minimalist living room with natural light' },
  { id: 'bedroom', label: 'Cozy Bedroom', value: 'cozy bedroom with soft lighting' },
  { id: 'kitchen', label: 'Modern Kitchen', value: 'modern kitchen with marble countertops' },
  { id: 'office', label: 'Home Office', value: 'professional home office with natural light' },
  { id: 'outdoor', label: 'Outdoor Patio', value: 'outdoor patio with garden view' },
  { id: 'fashion_model', label: 'Fashion Model', value: 'fashion model in studio setting' },
  { id: 'flat_lay', label: 'Flat Lay', value: 'flat lay on marble surface with props' },
  { id: 'custom', label: 'Custom...', value: '' }
];

/**
 * FileLibraryOptimizerModal - Modal for AI image optimization with cost display
 */
const FileLibraryOptimizerModal = ({ isOpen, onClose, storeId, fileToOptimize, selectedFiles, onOptimized, setFlashMessage }) => {
  const [pricing, setPricing] = useState(null);
  const [pricingLoading, setPricingLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState('openai');
  const [selectedOperation, setSelectedOperation] = useState('remove_bg');
  const [showProviderDropdown, setShowProviderDropdown] = useState(false);
  const [showOperationDropdown, setShowOperationDropdown] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);
  const [applyToOriginal, setApplyToOriginal] = useState(false); // Checkbox: unchecked = save copy (default), checked = replace original
  const [isApplying, setIsApplying] = useState(false);

  // For single image mode: track current working image (starts as original, becomes result after optimization)
  const [currentImage, setCurrentImage] = useState(null);
  const [currentFormat, setCurrentFormat] = useState('png'); // Track current image format
  const [originalImage, setOriginalImage] = useState(null);
  const [imageHistory, setImageHistory] = useState([]); // History stack for undo
  const [formatHistory, setFormatHistory] = useState([]); // Format history for undo
  const [originalSize, setOriginalSize] = useState(null); // Original file size in bytes

  // Operation-specific params
  const [stagingContext, setStagingContext] = useState(STAGING_CONTEXTS[0].value);
  const [customContext, setCustomContext] = useState('');
  const [bgReplacement, setBgReplacement] = useState('transparent');
  const [upscaleScale, setUpscaleScale] = useState(2);

  const providerDropdownRef = useRef(null);
  const operationDropdownRef = useRef(null);

  // Determine single vs bulk mode
  const singleFile = fileToOptimize || (selectedFiles?.length === 1 ? selectedFiles[0] : null);
  const isBulkMode = !singleFile && selectedFiles?.length > 1;
  const imagesToProcess = singleFile ? [singleFile] : selectedFiles || [];

  // Initialize original/current image for single mode
  useEffect(() => {
    if (isOpen && singleFile) {
      setOriginalImage(singleFile);
      setCurrentImage(null); // Reset result when opening
      setCurrentFormat('png'); // Reset format
      setImageHistory([]); // Reset history
      setFormatHistory([]); // Reset format history
      setOriginalSize(singleFile.size || null); // Use file size if available

      // Fetch original size if not available
      if (!singleFile.size && singleFile.url) {
        fetch(singleFile.url, { method: 'HEAD' })
          .then(res => {
            const size = res.headers.get('content-length');
            if (size) setOriginalSize(parseInt(size, 10));
          })
          .catch(() => {});
      }
    }
  }, [isOpen, singleFile?.id]);

  // Fetch pricing on mount
  useEffect(() => {
    const fetchPricing = async () => {
      try {
        const response = await apiClient.get('/image-optimization/pricing');
        if (response.success) {
          setPricing(response);
          const availableProviders = response.providers || [];
          if (availableProviders.length > 0 && !availableProviders.includes(selectedProvider)) {
            setSelectedProvider(availableProviders[0]);
          }
        }
      } catch (err) {
        console.error('Failed to fetch pricing:', err);
      } finally {
        setPricingLoading(false);
      }
    };
    if (isOpen) {
      fetchPricing();
    }
  }, [isOpen]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (providerDropdownRef.current && !providerDropdownRef.current.contains(e.target)) {
        setShowProviderDropdown(false);
      }
      if (operationDropdownRef.current && !operationDropdownRef.current.contains(e.target)) {
        setShowOperationDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Get current credit cost per image
  const getCostPerImage = useCallback(() => {
    if (!pricing?.matrix) return null;
    return pricing.matrix[selectedProvider]?.[selectedOperation]?.credits;
  }, [pricing, selectedProvider, selectedOperation]);

  // Calculate total cost for bulk
  const getTotalCost = useCallback(() => {
    const costPerImage = getCostPerImage();
    if (costPerImage === null) return null;
    return costPerImage * imagesToProcess.length;
  }, [getCostPerImage, imagesToProcess.length]);

  // Format bytes to human readable
  const formatBytes = (bytes) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // Get size of base64 image in bytes
  const getBase64Size = (base64) => {
    if (!base64) return null;
    // Base64 string length * 0.75 gives approximate byte size
    return Math.round(base64.length * 0.75);
  };

  // Revert to previous state
  const handleRevert = () => {
    if (imageHistory.length === 0) return;
    const previousImage = imageHistory[imageHistory.length - 1];
    const previousFormat = formatHistory[formatHistory.length - 1] || 'png';
    console.log('[AI Optimizer] Reverting', {
      historyLength: imageHistory.length,
      previousImageLength: previousImage?.length,
      previousFormat
    });
    setImageHistory(prev => prev.slice(0, -1));
    setFormatHistory(prev => prev.slice(0, -1));
    setCurrentImage(previousImage);
    setCurrentFormat(previousFormat);
  };

  // Get base64 from current image result or fetch from URL
  const getImageBase64 = async (imageSource) => {
    // If it's already a base64 result from previous operation
    if (typeof imageSource === 'string' && !imageSource.startsWith('http')) {
      return `data:image/${currentFormat};base64,${imageSource}`;
    }
    // If it's a URL, fetch it
    const url = typeof imageSource === 'string' ? imageSource : imageSource.url;
    const imageResponse = await fetch(url);
    const imageBlob = await imageResponse.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(imageBlob);
    });
  };

  // Process images
  const handleOptimize = async () => {
    if (isBulkMode && imagesToProcess.length === 0) return;
    if (!isBulkMode && !singleFile) return;

    setIsProcessing(true);
    setError(null);
    setProcessedCount(0);
    if (isBulkMode) setResults([]);

    const newResults = [];
    const itemsToProcess = isBulkMode ? imagesToProcess : [singleFile];

    for (let i = 0; i < itemsToProcess.length; i++) {
      const image = itemsToProcess[i];
      setProcessedCount(i + 1);

      try {
        // Build params based on operation
        const params = {};
        if (selectedOperation === 'stage') {
          params.context = stagingContext === '' ? customContext : stagingContext;
          params.style = 'photorealistic';
          params.lighting = 'natural daylight';
        } else if (selectedOperation === 'remove_bg') {
          params.replacement = bgReplacement;
        } else if (selectedOperation === 'upscale') {
          params.scale = upscaleScale;
          params.enhanceDetails = true;
        }

        // For single mode: use current result if available, otherwise use original
        let base64;
        if (!isBulkMode && currentImage) {
          base64 = await getImageBase64(currentImage);
        } else {
          base64 = await getImageBase64(image.url);
        }

        const response = await apiClient.post('/image-optimization/optimize', {
          provider: selectedProvider,
          operation: selectedOperation,
          image: base64,
          params
        });

        if (response.success) {
          const resultData = {
            original: image,
            success: true,
            result: response.result,
            credits: response.creditsDeducted
          };
          newResults.push(resultData);

          // For single mode: save current to history and update current image
          if (!isBulkMode) {
            // Push current state to history (for undo) - null means "original"
            setImageHistory(prev => [...prev, currentImage]);
            setFormatHistory(prev => [...prev, currentFormat]);
            setCurrentImage(response.result.image);
            setCurrentFormat(response.result.format || 'png');
          }
        } else {
          newResults.push({
            original: image,
            success: false,
            error: response.message || 'Failed'
          });
        }
      } catch (err) {
        newResults.push({
          original: image,
          success: false,
          error: err.message || 'Processing failed'
        });
      }
    }

    if (isBulkMode) {
      setResults(newResults);
    }
    setIsProcessing(false);

    const successCount = newResults.filter(r => r.success).length;
    const totalCredits = newResults.reduce((sum, r) => sum + (r.credits || 0), 0);

    if (successCount > 0) {
      setFlashMessage({ type: 'success', message: `Optimized ${successCount}/${itemsToProcess.length} images (${totalCredits.toFixed(2)} credits used)` });
      if (onOptimized) {
        onOptimized({ results: newResults, creditsUsed: totalCredits });
      }
    } else {
      setFlashMessage({ type: 'error', message: 'All images failed to process' });
    }
  };

  // Apply changes (replace original or save copy)
  const handleApply = async () => {
    console.log('[AI Optimizer] handleApply called', {
      hasCurrentImage: !!currentImage,
      currentImageLength: currentImage?.length,
      currentFormat,
      applyToOriginal,
      singleFileName: singleFile?.name
    });

    if (!currentImage || !singleFile) {
      console.warn('[AI Optimizer] No image to save');
      return;
    }
    setIsApplying(true);

    try {
      const format = currentFormat || 'png';
      const base64Data = currentImage;
      const originalName = singleFile.name || 'image';

      // Convert base64 to blob
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: `image/${format}` });

      if (applyToOriginal) {
        // REPLACE: Use replace endpoint to preserve database references
        const fileFolder = singleFile.folder || singleFile.path?.split('/')[0] || 'library';
        const filePath = `${fileFolder}/${singleFile.name}`;
        const newName = originalName.replace(/\.[^.]+$/, `.${format}`);

        console.log('[AI Optimizer] Replacing file:', { oldUrl: singleFile.url, filePath });

        const file = new File([blob], newName, { type: `image/${format}` });
        const replaceResponse = await apiClient.uploadFile('storage/replace', file, {
          oldFileUrl: singleFile.url,
          oldFilePath: filePath,
          folder: fileFolder
        });

        if (replaceResponse.success) {
          const { mediaAssetUpdated, productFilesUpdated } = replaceResponse.data || {};
          let msg = `Replaced "${originalName}"`;
          if (productFilesUpdated > 0) {
            msg += ` (${productFilesUpdated} product reference${productFilesUpdated > 1 ? 's' : ''} updated)`;
          }
          setFlashMessage({ type: 'success', message: msg });
          if (onOptimized) onOptimized({ applied: true, refresh: true });
          onClose();
        } else {
          throw new Error(replaceResponse.error || 'Replace failed');
        }
      } else {
        // SAVE COPY: Upload as new file
        const newName = `optimized-${originalName.replace(/\.[^.]+$/, '')}.${format}`;
        const file = new File([blob], newName, { type: `image/${format}` });
        const uploadResponse = await apiClient.uploadFile('storage/upload', file, { folder: 'library' });

        if (uploadResponse.success) {
          setFlashMessage({ type: 'success', message: `Saved copy as "${newName}"` });
          if (onOptimized) onOptimized({ applied: true, refresh: true });
        } else {
          throw new Error('Upload failed');
        }
      }
    } catch (err) {
      console.error('Failed to apply:', err);
      setFlashMessage({ type: 'error', message: `Failed to save: ${err.message}` });
    } finally {
      setIsApplying(false);
    }
  };

  // Apply all for bulk mode
  const handleApplyAll = async () => {
    const successResults = results.filter(r => r.success);
    if (successResults.length === 0) return;
    setIsApplying(true);

    let savedCount = 0;
    for (const result of successResults) {
      try {
        const format = result.result?.format || 'png';
        const base64Data = result.result.image;
        const originalName = result.original.name || 'image';
        const newName = applyToOriginal
          ? originalName
          : `optimized-${originalName.replace(/\.[^.]+$/, '')}.${format}`;

        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: `image/${format}` });

        // Upload using apiClient
        const file = new File([blob], newName, { type: `image/${format}` });
        const uploadResponse = await apiClient.uploadFile('storage/upload', file, { folder: 'library' });

        if (uploadResponse.success) {
          result.applied = true;
          savedCount++;
        }
      } catch (err) {
        console.error('Failed to save:', err);
      }
    }

    setResults([...results]);
    setFlashMessage({ type: 'success', message: `${applyToOriginal ? 'Applied' : 'Saved'} ${savedCount} images` });
    if (onOptimized) onOptimized({ applied: true });
    setIsApplying(false);
  };

  if (!isOpen) return null;

  const costPerImage = getCostPerImage();
  const totalCost = getTotalCost();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
              <Wand2 className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">
                {isBulkMode
                  ? `AI Optimize ${imagesToProcess.length} Images`
                  : 'AI Image Optimizer'}
              </h2>
              <p className="text-sm text-gray-500">
                Select provider and operation below
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Provider & Operation Selection */}
        <div className="px-6 py-4 border-b bg-white">
          <div className="flex flex-wrap items-center gap-4">
            {/* Provider Dropdown */}
            <div className="relative" ref={providerDropdownRef}>
              <label className="block text-xs font-medium text-gray-500 mb-1">Provider</label>
              <button
                onClick={() => setShowProviderDropdown(!showProviderDropdown)}
                disabled={isProcessing || pricingLoading}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-all min-w-[140px]",
                  "border border-gray-200 bg-white",
                  "hover:bg-gray-50",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                <span className="text-lg">{PROVIDERS[selectedProvider]?.icon}</span>
                <span className="font-medium flex-1 text-left">{PROVIDERS[selectedProvider]?.name}</span>
                <ChevronDown className={cn("w-4 h-4 transition-transform", showProviderDropdown && "rotate-180")} />
              </button>

              {showProviderDropdown && (
                <div className="absolute left-0 top-full mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden">
                  <div className="p-2 border-b border-gray-100 bg-gray-50">
                    <p className="text-xs font-medium text-gray-500">Select AI Provider</p>
                  </div>
                  <div className="py-1 max-h-64 overflow-y-auto">
                    {(pricing?.providers || Object.keys(PROVIDERS)).map((providerId) => {
                      const provider = PROVIDERS[providerId];
                      if (!provider) return null;
                      const cost = pricing?.matrix?.[providerId]?.[selectedOperation]?.credits;

                      return (
                        <button
                          key={providerId}
                          onClick={() => {
                            setSelectedProvider(providerId);
                            setShowProviderDropdown(false);
                          }}
                          className={cn(
                            "w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors",
                            selectedProvider === providerId
                              ? "bg-purple-50"
                              : "hover:bg-gray-50"
                          )}
                        >
                          <span className="text-xl">{provider.icon}</span>
                          <div className="flex-1">
                            <span className={cn(
                              "text-sm font-medium",
                              selectedProvider === providerId ? "text-purple-600" : ""
                            )}>
                              {provider.name}
                            </span>
                          </div>
                          {cost !== undefined && (
                            <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
                              {cost} cr
                            </span>
                          )}
                          {selectedProvider === providerId && (
                            <Check className="w-4 h-4 text-purple-600" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Operation Dropdown */}
            <div className="relative" ref={operationDropdownRef}>
              <label className="block text-xs font-medium text-gray-500 mb-1">Operation</label>
              <button
                onClick={() => setShowOperationDropdown(!showOperationDropdown)}
                disabled={isProcessing}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-all min-w-[180px]",
                  "border border-gray-200 bg-white",
                  "hover:bg-gray-50",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                {React.createElement(OPERATIONS[selectedOperation]?.icon || Image, { className: "w-4 h-4 text-gray-600" })}
                <span className="font-medium flex-1 text-left">{OPERATIONS[selectedOperation]?.name}</span>
                <ChevronDown className={cn("w-4 h-4 transition-transform", showOperationDropdown && "rotate-180")} />
              </button>

              {showOperationDropdown && (
                <div className="absolute left-0 top-full mt-1 w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden">
                  <div className="p-2 border-b border-gray-100 bg-gray-50">
                    <p className="text-xs font-medium text-gray-500">Select Operation</p>
                  </div>
                  <div className="py-1">
                    {Object.entries(OPERATIONS).map(([opId, op]) => {
                      const cost = pricing?.matrix?.[selectedProvider]?.[opId]?.credits;
                      const OpIcon = op.icon;

                      return (
                        <button
                          key={opId}
                          onClick={() => {
                            setSelectedOperation(opId);
                            setShowOperationDropdown(false);
                          }}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors",
                            selectedOperation === opId
                              ? "bg-purple-50"
                              : "hover:bg-gray-50"
                          )}
                        >
                          <OpIcon className="w-5 h-5 text-gray-500" />
                          <div className="flex-1">
                            <span className={cn(
                              "text-sm font-medium block",
                              selectedOperation === opId ? "text-purple-600" : ""
                            )}>
                              {op.name}
                            </span>
                            <span className="text-xs text-gray-500">{op.description}</span>
                          </div>
                          {cost !== undefined && (
                            <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
                              {cost} cr
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Cost Display */}
            <div className="ml-auto text-right">
              {pricingLoading ? (
                <div className="flex items-center gap-2 text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Loading costs...</span>
                </div>
              ) : costPerImage !== null ? (
                <div>
                  <div className="text-xs text-gray-500">
                    {costPerImage} credits × {imagesToProcess.length} image{imagesToProcess.length !== 1 ? 's' : ''}
                  </div>
                  <div className="text-lg font-bold text-purple-600">
                    {totalCost?.toFixed(2)} credits total
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {/* Operation-specific options */}
          {selectedOperation === 'stage' && (
            <div className="mt-4 pt-4 border-t">
              <label className="text-xs font-medium text-gray-500 mb-2 block">Staging Context</label>
              <div className="flex flex-wrap gap-1.5">
                {STAGING_CONTEXTS.map((ctx) => (
                  <button
                    key={ctx.id}
                    onClick={() => {
                      setStagingContext(ctx.value);
                      if (ctx.id !== 'custom') setCustomContext('');
                    }}
                    disabled={isProcessing}
                    className={cn(
                      "px-2.5 py-1 text-xs rounded-full transition-colors",
                      stagingContext === ctx.value
                        ? "bg-purple-100 text-purple-700 border border-purple-300"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    )}
                  >
                    {ctx.label}
                  </button>
                ))}
              </div>
              {stagingContext === '' && (
                <input
                  type="text"
                  value={customContext}
                  onChange={(e) => setCustomContext(e.target.value)}
                  placeholder="Describe the environment (e.g., 'luxury penthouse with city view')"
                  className="mt-2 w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  disabled={isProcessing}
                />
              )}
            </div>
          )}

          {selectedOperation === 'remove_bg' && (
            <div className="mt-4 pt-4 border-t">
              <label className="text-xs font-medium text-gray-500 mb-2 block">Background Replacement</label>
              <div className="flex gap-2">
                {['transparent', 'white', 'black', 'gradient'].map((bg) => (
                  <button
                    key={bg}
                    onClick={() => setBgReplacement(bg)}
                    disabled={isProcessing}
                    className={cn(
                      "px-3 py-1.5 text-xs rounded-lg transition-colors capitalize",
                      bgReplacement === bg
                        ? "bg-purple-100 text-purple-700 border border-purple-300"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    )}
                  >
                    {bg}
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedOperation === 'upscale' && (
            <div className="mt-4 pt-4 border-t">
              <label className="text-xs font-medium text-gray-500 mb-2 block">Upscale Factor</label>
              <div className="flex gap-2">
                {[2, 3, 4].map((scale) => (
                  <button
                    key={scale}
                    onClick={() => setUpscaleScale(scale)}
                    disabled={isProcessing}
                    className={cn(
                      "px-4 py-1.5 text-xs rounded-lg transition-colors",
                      upscaleScale === scale
                        ? "bg-purple-100 text-purple-700 border border-purple-300"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    )}
                  >
                    {scale}x
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-auto p-6">
          {/* Processing indicator */}
          {isProcessing && (
            <div className="mb-4 p-3 bg-purple-50 rounded-lg">
              <div className="flex items-center gap-2 text-purple-700 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processing {processedCount} of {isBulkMode ? imagesToProcess.length : 1}...</span>
              </div>
              <div className="mt-2 bg-purple-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-purple-600 h-full transition-all"
                  style={{ width: `${(processedCount / (isBulkMode ? imagesToProcess.length : 1)) * 100}%` }}
                />
              </div>
            </div>
          )}

          {!isBulkMode ? (
            /* === SINGLE IMAGE MODE: Side-by-side comparison === */
            <div>
              <div className="grid grid-cols-2 gap-6">
                {/* Original Image */}
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-gray-700">Original</h3>
                  <div className="border rounded-lg overflow-hidden bg-gray-50">
                    <div className="h-72 flex items-center justify-center bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjZjBmMGYwIi8+PHJlY3QgeD0iMTAiIHk9IjEwIiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiNmMGYwZjAiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')]">
                      {singleFile && (
                        <img
                          src={singleFile.url}
                          alt="Original"
                          className="max-w-full max-h-full object-contain"
                        />
                      )}
                    </div>
                    <div className="p-2 text-xs border-t flex items-center justify-between">
                      <span className="text-gray-500 truncate">{singleFile?.name || 'Original image'}</span>
                      <span className="text-gray-400 flex-shrink-0 ml-2">{formatBytes(originalSize)}</span>
                    </div>
                  </div>
                </div>

                {/* Current/Result Image */}
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-gray-700">
                    {currentImage ? 'Result' : 'Preview'}
                  </h3>
                  <div className={cn(
                    "border rounded-lg overflow-hidden",
                    currentImage ? "border-green-300 bg-green-50" : "bg-gray-50"
                  )}>
                    <div className="h-72 flex items-center justify-center bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjZjBmMGYwIi8+PHJlY3QgeD0iMTAiIHk9IjEwIiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiNmMGYwZjAiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')]">
                      {currentImage ? (
                        <img
                          src={`data:image/${currentFormat};base64,${currentImage}`}
                          alt="Result"
                          className="max-w-full max-h-full object-contain"
                        />
                      ) : singleFile ? (
                        <img
                          src={singleFile.url}
                          alt="Preview"
                          className="max-w-full max-h-full object-contain opacity-50"
                        />
                      ) : (
                        <span className="text-gray-400 text-sm">No image</span>
                      )}
                    </div>
                    <div className="p-2 text-xs border-t flex items-center justify-between">
                      {currentImage ? (
                        <>
                          <div className="flex items-center gap-2">
                            <span className="text-green-600 flex items-center gap-1">
                              <Check className="w-3 h-3" />
                              Optimized
                            </span>
                            <span className="text-gray-400">{formatBytes(getBase64Size(currentImage))}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            {imageHistory.length > 0 && (
                              <button
                                onClick={handleRevert}
                                className="p-1 text-gray-500 hover:text-orange-600 hover:bg-orange-50 rounded"
                                title="Undo last operation"
                              >
                                <Undo2 className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => {
                                const link = document.createElement('a');
                                link.href = `data:image/${currentFormat};base64,${currentImage}`;
                                link.download = `optimized-${singleFile?.name?.replace(/\.[^.]+$/, '') || 'image'}.${currentFormat}`;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                              }}
                              className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                              title="Download"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          </div>
                        </>
                      ) : (
                        <span className="text-gray-400">Run an operation to see result</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* === BULK MODE: Status list without previews === */
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-700">
                {results.length > 0
                  ? `Results: ${results.filter(r => r.success).length}/${results.length} successful`
                  : `${imagesToProcess.length} images selected`
                }
              </h3>

              {results.length > 0 ? (
                /* Bulk results list */
                <div className="border rounded-lg divide-y max-h-80 overflow-y-auto">
                  {results.map((result, idx) => (
                    <div key={idx} className="flex items-center gap-3 px-3 py-2">
                      <div className="w-10 h-10 rounded bg-gray-100 overflow-hidden flex-shrink-0">
                        <img
                          src={result.success && result.result?.image
                            ? `data:image/${result.result.format || 'png'};base64,${result.result.image}`
                            : result.original.url
                          }
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm truncate">{result.original.name}</div>
                        {result.success ? (
                          <div className="text-xs text-green-600 flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            <span>Optimized ({result.credits?.toFixed(2)} cr)</span>
                          </div>
                        ) : (
                          <div className="text-xs text-red-600 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            <span className="truncate">{result.error}</span>
                          </div>
                        )}
                      </div>
                      {result.applied && (
                        <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">
                          Saved
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                /* Bulk image list before processing */
                <div className="border rounded-lg divide-y max-h-80 overflow-y-auto">
                  {imagesToProcess.map((file) => (
                    <div key={file.id} className="flex items-center gap-3 px-3 py-2">
                      <div className="w-10 h-10 rounded bg-gray-100 overflow-hidden flex-shrink-0">
                        <img
                          src={file.url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="text-sm truncate flex-1">{file.name}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50">
          <div className="flex items-center justify-between">
            {/* Left side: Replace checkbox + Save button */}
            <div className="flex items-center gap-3">
              {/* Apply checkbox - show when there's a result */}
              {((!isBulkMode && currentImage) || (isBulkMode && results.filter(r => r.success).length > 0)) && (
                <>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={applyToOriginal}
                      onChange={(e) => setApplyToOriginal(e.target.checked)}
                      className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                    />
                    <span className="text-gray-700">
                      Replace original{isBulkMode ? 's' : ''}
                    </span>
                  </label>

                  {/* Save/Apply button */}
                  <Button
                    onClick={isBulkMode ? handleApplyAll : handleApply}
                    disabled={isApplying}
                    className={applyToOriginal
                      ? "bg-orange-600 hover:bg-orange-700"
                      : "bg-green-600 hover:bg-green-700"
                    }
                  >
                    {isApplying ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        {isBulkMode
                          ? (applyToOriginal ? 'Replace All' : 'Save Copies') + ` (${results.filter(r => r.success && !r.applied).length})`
                          : (applyToOriginal ? 'Replace Original' : 'Save as Copy')
                        }
                      </>
                    )}
                  </Button>
                </>
              )}
            </div>

            {/* Right side: Optimize + Cancel */}
            <div className="flex gap-2">
              {/* Optimize button */}
              <Button
                onClick={handleOptimize}
                disabled={isProcessing || (!isBulkMode && !singleFile) || (isBulkMode && imagesToProcess.length === 0)}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4 mr-2" />
                    {currentImage || results.length > 0 ? 'Run Again' : 'Optimize'}
                  </>
                )}
              </Button>

              <Button variant="outline" onClick={onClose} disabled={isProcessing || isApplying}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Entity type filters
const ENTITY_TYPES = [
  { id: 'all', label: 'All Files', icon: FolderOpen },
  { id: 'library', label: 'Library', icon: Archive },
  { id: 'products', label: 'Products', icon: Package },
  { id: 'categories', label: 'Categories', icon: Filter }
];

const FileLibrary = () => {
  const { selectedStore } = useStoreSelection();
  const fileInputRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [copiedUrl, setCopiedUrl] = useState(null);
  const [storageProvider, setStorageProvider] = useState(null);
  const [storageConnected, setStorageConnected] = useState(true);
  const [storageError, setStorageError] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);

  // New state for entity filter and AI optimizer
  const [entityFilter, setEntityFilter] = useState('all');
  const [selectedFileIds, setSelectedFileIds] = useState([]);
  const [optimizerOpen, setOptimizerOpen] = useState(false);
  const [fileToOptimize, setFileToOptimize] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [flashMessage, setFlashMessage] = useState(null);

  // Delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState(null);
  const [isBulkDelete, setIsBulkDelete] = useState(false);

  // AI Image Optimizer Mode (shows all products, categories, and library images)
  const [aiOptimizerMode, setAiOptimizerMode] = useState(false);

  // AI Image Generator Modal
  const [generatorOpen, setGeneratorOpen] = useState(false);

  // Selection handlers
  const toggleFileSelection = (fileId) => {
    setSelectedFileIds(prev =>
      prev.includes(fileId) ? prev.filter(id => id !== fileId) : [...prev, fileId]
    );
  };

  const selectAllFiles = () => {
    const imageFiles = filteredFiles.filter(f => f.mimeType?.startsWith('image/'));
    if (selectedFileIds.length === imageFiles.length) {
      setSelectedFileIds([]);
    } else {
      setSelectedFileIds(imageFiles.map(f => f.id));
    }
  };

  const openOptimizer = (file = null) => {
    setFileToOptimize(file);
    setOptimizerOpen(true);
  };

  const handleOptimizedImage = (result) => {
    // Just reload files to update library - modal stays open for more operations
    loadFiles();
  };

  const closeOptimizer = () => {
    setOptimizerOpen(false);
    setFileToOptimize(null);
    setSelectedFileIds([]);
  };

  // AI Image Generator handlers
  const openGenerator = () => {
    setGeneratorOpen(true);
  };

  const closeGenerator = () => {
    setGeneratorOpen(false);
  };

  const handleGeneratedImage = () => {
    // Reload files to show newly generated image
    loadFiles();
  };

  // File type icons
  const getFileIcon = (mimeType) => {
    if (!mimeType) return <FileIcon className="w-8 h-8" />;
    
    if (mimeType.startsWith('image/')) return <Image className="w-8 h-8 text-blue-500" />;
    if (mimeType.startsWith('video/')) return <Film className="w-8 h-8 text-purple-500" />;
    if (mimeType.startsWith('audio/')) return <Music className="w-8 h-8 text-pink-500" />;
    if (mimeType.includes('pdf')) return <FileText className="w-8 h-8 text-red-500" />;
    if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('rar')) 
      return <Archive className="w-8 h-8 text-yellow-500" />;
    return <FileIcon className="w-8 h-8 text-gray-500" />;
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  // Check for storage provider and connection status
  const checkStorageProvider = async () => {
    try {
      // Use the same endpoint as FilePickerModal for consistency
      const response = await apiClient.get('/supabase/storage/stats');

      if (response.success) {
        // Since we're using Supabase storage, set it directly
        setStorageProvider('Supabase');
        setStorageConnected(true);
        setStorageError(null);

        return 'supabase';
      } else {
        setStorageConnected(false);
        setStorageError('Storage connection failed');
      }
    } catch (error) {
      console.error('Error checking storage provider:', error);
      setStorageConnected(false);
      setStorageError('Unable to check storage connection status');
    }
    return null;
  };

  // Load files from current storage provider
  const loadFiles = async () => {
    try {
      setLoading(true);

      // Use Supabase storage endpoint - backend determines bucket name for the store
      const response = await apiClient.get('/supabase/storage/list');
      
      // Check if we have valid storage data (same format as FilePickerModal)
      if (response.success && response.files) {
        // Set provider name for Supabase
        setStorageProvider('Supabase');

        // Transform response to FileLibrary format (same as FilePickerModal)
        const rawFiles = response.files || [];

        const transformedFiles = rawFiles.map(file => {
          const imageUrl = file.url || file.publicUrl || file.name;
          return {
            id: file.id || file.name,
            name: file.name,
            url: imageUrl,
            size: file.metadata?.size || file.size || 0,
            mimeType: file.metadata?.mimetype || file.mimeType || 'application/octet-stream',
            uploadedAt: file.created_at || file.updated_at || new Date().toISOString(),
            fullPath: file.fullPath || `library/${file.name}`,
            folder: file.folder || 'library'
          };
        });

        setFiles(transformedFiles);
      } else {
        setFiles([]);
        // If no files but successful response, still set provider
        if (response.success) {
          setStorageProvider('Supabase');
        }
      }
    } catch (error) {
      console.error('❌ FileLibrary: Error loading files:', error);
      console.error('❌ FileLibrary: Error status:', error.status);
      console.error('❌ FileLibrary: Error message:', error.message);
      
      // Fallback behavior for different error types
      if (error.message?.includes('404') || error.message?.includes('not found')) {
        setFiles([]);
      } else {
        setFlashMessage({ type: 'error', message: 'Failed to load files: ' + error.message });
        setFiles([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedStore?.id) {
      // First check for storage provider, then load files
      checkStorageProvider().then(() => {
        loadFiles();
      });
    }
  }, [selectedStore?.id]);

  // Handle file upload using provider-agnostic storage API
  const handleFileUpload = async (filesArray) => {
    if (!storageConnected || storageError) {
      setFlashMessage({ type: 'error', message: "Media storage is not connected. Please configure storage in Media Storage settings first." });
      return;
    }

    if (!storageProvider) {
      setFlashMessage({ type: 'error', message: "Please configure a storage provider in Media Storage settings first" });
      return;
    }

    if (filesArray.length === 0) {
      setFlashMessage({ type: 'error', message: "No files selected" });
      return;
    }

    setUploading(true);
    
    try {
      // Upload files using Supabase storage API (same as FilePickerModal)
      const uploadedFiles = [];

      for (const file of filesArray) {

        // Validate file before uploading
        if (!file || !file.name || file.size === 0) {
          throw new Error(`Invalid file: ${file?.name || 'Unknown'}`);
        }

        // Use same upload endpoint as FilePickerModal
        const additionalData = {
          folder: 'library',
          public: 'true',
          type: 'general'
        };

        const response = await apiClient.uploadFile('/supabase/storage/upload', file, additionalData);

        if (response.success) {

          uploadedFiles.push({
            id: response.id || `uploaded-${Date.now()}-${uploadedFiles.length}`,
            name: response.filename || file.name,
            url: response.url || response.publicUrl,
            mimeType: file.type,
            size: file.size,
            uploadedAt: new Date().toISOString()
          });
        } else {
          throw new Error(`Upload failed for ${file.name}: ${response.message || 'Unknown error'}`);
        }
      }

      if (uploadedFiles.length > 0) {
        setFlashMessage({ type: 'success', message: `Successfully uploaded ${uploadedFiles.length} file(s)!` });
      }

      // Reload files to show the new uploads
      await loadFiles();
    } catch (error) {
      console.error('❌ FileLibrary: Upload error:', error);

      // Parse upload error and provide helpful feedback (same as FilePickerModal)
      const errorMessage = error.message || 'Unknown upload error';
      let uploadErrorMessage = 'File upload failed.';

      if (errorMessage.includes('No file provided')) {
        uploadErrorMessage = 'File upload issue: The server didn\'t receive the file properly. Try a smaller file or check your connection.';
      } else if (errorMessage.includes('Storage operations require API keys')) {
        uploadErrorMessage = 'Storage not configured: Please configure Supabase integration in Admin → Integrations.';
      } else if (errorMessage.includes('Invalid service role key')) {
        uploadErrorMessage = 'Invalid service role key: Please check your Supabase integration settings.';
      } else if (errorMessage.includes('File size exceeds')) {
        uploadErrorMessage = 'File too large: Please use a smaller file (under 50MB).';
      } else {
        uploadErrorMessage = `Upload failed: ${errorMessage}`;
      }

      setFlashMessage({ type: 'error', message: uploadErrorMessage });
    } finally {
      setUploading(false);
    }
  };

  // Handle drag and drop
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Don't allow drag interaction if storage is not connected
    if (!storageConnected || storageError) {
      return;
    }
    
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    // Don't allow drop if storage is not connected
    if (!storageConnected || storageError) {
      setFlashMessage({ type: 'error', message: "Media storage is not connected. Please configure storage first." });
      return;
    }
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(Array.from(e.dataTransfer.files));
    }
  };

  // Copy URL to clipboard
  const copyToClipboard = async (url, fileId) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(fileId);
      setFlashMessage({ type: 'success', message: "File URL copied to clipboard" });
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch (error) {
      setFlashMessage({ type: 'error', message: "Failed to copy URL" });
    }
  };

  // Open delete confirmation dialog for single file
  const confirmDeleteFile = (fileId) => {
    setFileToDelete(fileId);
    setIsBulkDelete(false);
    setDeleteDialogOpen(true);
  };

  // Open delete confirmation dialog for bulk delete
  const confirmBulkDelete = () => {
    setIsBulkDelete(true);
    setDeleteDialogOpen(true);
  };

  // Handle confirmed delete action
  const handleConfirmedDelete = async () => {
    setDeleteDialogOpen(false);
    if (isBulkDelete) {
      await bulkDeleteFiles();
    } else if (fileToDelete) {
      await deleteFile(fileToDelete);
    }
    setFileToDelete(null);
    setIsBulkDelete(false);
  };

  // Delete file using Supabase storage API
  const deleteFile = async (fileId) => {
    try {
      // Find the file to get its path
      const file = files.find(f => f.id === fileId);
      if (!file) {
        setFlashMessage({ type: 'error', message: "File not found" });
        return;
      }

      // Use fullPath from the file object (e.g., "library/a/filename.jpg")
      const filePath = file.fullPath || `library/${file.name}`;

      // Get store ID from localStorage
      const selectedStoreId = localStorage.getItem('selectedStoreId');

      // Use Supabase storage delete endpoint (matches the list endpoint we use)
      const response = await fetch('/api/supabase/storage/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiClient.getToken()}`,
          'x-store-id': selectedStoreId || ''
        },
        body: JSON.stringify({
          path: filePath
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.error || 'Failed to delete file');
      }

      const result = await response.json();
      if (result.success) {
        setFlashMessage({ type: 'success', message: "File deleted successfully" });
        await loadFiles();
      } else {
        setFlashMessage({ type: 'error', message: result.message || result.error || "Failed to delete file" });
      }
    } catch (error) {
      console.error('Delete error:', error);
      if (error.message?.includes('404') || error.message?.includes('not found')) {
        setFlashMessage({ type: 'error', message: "Storage API not available. Cannot delete files." });
      } else {
        setFlashMessage({ type: 'error', message: error.message || "Failed to delete file" });
      }
    }
  };

  // Bulk delete selected files
  const bulkDeleteFiles = async () => {
    if (selectedFileIds.length === 0) return;

    setDeleting(true);
    const selectedStoreId = localStorage.getItem('selectedStoreId');
    let successCount = 0;
    let failCount = 0;

    for (const fileId of selectedFileIds) {
      try {
        const file = files.find(f => f.id === fileId);
        if (!file) continue;

        // Use fullPath from the file object
        const filePath = file.fullPath || `library/${file.name}`;

        const response = await fetch('/api/supabase/storage/delete', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiClient.getToken()}`,
            'x-store-id': selectedStoreId || ''
          },
          body: JSON.stringify({
            path: filePath
          })
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            successCount++;
          } else {
            failCount++;
          }
        } else {
          failCount++;
        }
      } catch (error) {
        console.error('Delete error for file:', fileId, error);
        failCount++;
      }
    }

    // Clear selection and reload
    setSelectedFileIds([]);
    await loadFiles();
    setDeleting(false);

    if (successCount > 0 && failCount === 0) {
      setFlashMessage({ type: 'success', message: `Successfully deleted ${successCount} file${successCount > 1 ? 's' : ''}` });
    } else if (successCount > 0 && failCount > 0) {
      setFlashMessage({ type: 'warning', message: `Deleted ${successCount} file${successCount > 1 ? 's' : ''}, ${failCount} failed` });
    } else {
      setFlashMessage({ type: 'error', message: `Failed to delete files` });
    }
  };

  // Filter files based on search and entity type
  const filteredFiles = files.filter(file => {
    // Search filter
    const matchesSearch = file.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      file.mimeType?.toLowerCase().includes(searchTerm.toLowerCase());

    // Entity filter
    let matchesEntity = true;
    if (entityFilter !== 'all') {
      const folder = (file.folder || file.path?.split('/')[0] || 'library').toLowerCase();

      if (entityFilter === 'library') {
        // Library: exclude product and category folders
        matchesEntity = !folder.includes('product') && !folder.includes('categor');
      } else if (entityFilter === 'products') {
        // Products: match 'product' or 'products' folder
        matchesEntity = folder.includes('product');
      } else if (entityFilter === 'categories') {
        // Categories: match 'category' or 'categories' folder
        matchesEntity = folder.includes('categor');
      }
    }

    return matchesSearch && matchesEntity;
  });

  // Count images for selection
  const imageFilesCount = filteredFiles.filter(f => f.mimeType?.startsWith('image/')).length;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <FlashMessage message={flashMessage} onClose={() => setFlashMessage(null)} />
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">File Library</h1>
          <p className="text-gray-600">
            Upload and manage files for your store. Copy URLs to use in CMS blocks, pages, or anywhere else.
          </p>
        </div>
      </div>
        
        {/* Storage Status */}
        {storageProvider && storageConnected && (
          <div className="mt-2 inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 text-green-800">
            ✓ Connected to {storageProvider}
          </div>
        )}
        
        {/* Storage Connection Warning */}
        {(!storageConnected || storageError) && (
          <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-amber-800 mb-1">
                  Media Storage Not Connected
                </h3>
                <p className="text-sm text-amber-700 mb-3">
                  {storageError || "Media storage is not properly configured. Files cannot be uploaded or managed until storage is connected."}
                </p>
                <div className="flex flex-wrap gap-2">
                  <a 
                    href="/admin/media-storage" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-600 text-white text-sm font-medium rounded-md hover:bg-amber-700 transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                    Configure Storage
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <button 
                    onClick={() => {
                      checkStorageProvider();
                      loadFiles();
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-amber-300 text-amber-700 text-sm font-medium rounded-md hover:bg-amber-50 transition-colors"
                  >
                    Retry Connection
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      {/* Upload & AI Generate Area */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Upload Area */}
        <div
          className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
            !storageConnected || storageError
              ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
              : dragActive
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <Upload className="w-10 h-10 mx-auto mb-3 text-gray-400" />
          <p className="text-gray-600 mb-1 font-medium">
            Upload Files
          </p>
          <p className="text-sm text-gray-500 mb-4">
            Drag & drop or click to browse
          </p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={(e) => handleFileUpload(Array.from(e.target.files))}
            className="hidden"
            id="file-upload"
            disabled={uploading || !storageConnected || storageError}
          />
          <SaveButton
            onClick={() => fileInputRef.current?.click()}
            loading={uploading}
            disabled={!storageConnected || storageError}
            defaultText="Select Files"
            loadingText="Uploading..."
          />
        </div>

        {/* AI Image Generator Card */}
        <div
          onClick={openGenerator}
          className="relative overflow-hidden rounded-xl bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-700 p-6 text-white cursor-pointer hover:shadow-xl hover:scale-[1.02] transition-all duration-300 group"
        >
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />

          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <Sparkles className="w-6 h-6" />
              </div>
              <span className="text-xs font-medium bg-white/20 px-2 py-1 rounded-full">AI Powered</span>
            </div>
            <h3 className="text-xl font-bold mb-2">Generate Images with AI</h3>
            <p className="text-white/80 text-sm mb-4">
              Create stunning product photos, lifestyle images, and custom visuals instantly using AI
            </p>
            <div className="flex items-center gap-2 text-sm font-medium group-hover:gap-3 transition-all">
              <ImagePlus className="w-5 h-5" />
              <span>Start Creating</span>
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </div>
          </div>
        </div>
      </div>

      {/* Entity Type Tabs */}
      <div className="mb-6 border-b">
        <div className="flex items-center gap-1">
          {ENTITY_TYPES.map((type) => {
            const Icon = type.icon;
            return (
              <button
                key={type.id}
                onClick={() => {
                  setEntityFilter(type.id);
                  setSelectedFileIds([]);
                }}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  entityFilter === type.id
                    ? 'border-purple-600 text-purple-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {type.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search files..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Select All (only for images) */}
          {imageFilesCount > 0 && (
            <label className="flex items-center gap-2 text-sm cursor-pointer text-gray-600 hover:text-gray-900">
              <input
                type="checkbox"
                checked={selectedFileIds.length === imageFilesCount && imageFilesCount > 0}
                onChange={selectAllFiles}
                className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              Select All Images ({imageFilesCount})
            </label>
          )}

          {/* Bulk Actions */}
          {selectedFileIds.length > 0 && (
            <>
              <button
                onClick={() => openOptimizer(null)}
                className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
              >
                <Wand2 className="w-4 h-4" />
                AI Optimize ({selectedFileIds.length})
              </button>
              <button
                onClick={confirmBulkDelete}
                disabled={deleting}
                className="flex items-center gap-2 px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                {deleting ? 'Deleting...' : `Delete (${selectedFileIds.length})`}
              </button>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* File count */}
          <span className="text-sm text-gray-500 mr-2">
            {filteredFiles.length} file{filteredFiles.length !== 1 ? 's' : ''}
          </span>

          {/* AI Optimizer Mode Toggle */}
          <Button
            onClick={() => setAiOptimizerMode(!aiOptimizerMode)}
            variant={aiOptimizerMode ? "default" : "outline"}
            size="sm"
            className={aiOptimizerMode
              ? "bg-purple-600 text-white hover:bg-purple-700"
              : "border-purple-600 text-purple-600 hover:bg-purple-50"
            }
          >
            <Wand2 className="w-4 h-4 mr-1" />
            AI Image Optimizer
          </Button>

          {/* View toggles */}
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded ${viewMode === 'grid' ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
            disabled={aiOptimizerMode}
          >
            <Grid className="w-5 h-5" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded ${viewMode === 'list' ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
            disabled={aiOptimizerMode}
          >
            <List className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Files Display */}
      {aiOptimizerMode ? (
        /* AI Image Optimizer Grid - Shows all products, categories, and library */
        <div className="bg-white rounded-lg border p-4">
          <AIImageOptimizerGrid
            filterType="all"
            onRefresh={loadFiles}
            showSearch={true}
          />
        </div>
      ) : loading ? (
        <PageLoader size="lg" fullScreen={false} className="py-12" text="Loading files..." />
      ) : filteredFiles.length === 0 ? (
        <div className="text-center py-12">
          <FileIcon className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">No files found</p>
          {!storageProvider && (
            <p className="text-sm text-gray-400 mt-2">
              <a 
                href="/admin/media-storage" 
                className="text-blue-500 hover:text-blue-600 underline"
              >
                Configure a storage provider in Media Storage settings
              </a> to start uploading files
            </p>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
          {filteredFiles.map((file) => {
            const isImage = file.mimeType?.startsWith('image/');
            const isSelected = selectedFileIds.includes(file.id);

            return (
            <div
              key={file.id}
              className={`border rounded-lg overflow-hidden transition-all ${
                isSelected
                  ? 'ring-2 ring-purple-500 border-purple-500'
                  : 'hover:shadow-lg'
              }`}
            >
              {/* Preview */}
              <div className="h-20 bg-gray-100 flex items-center justify-center relative group">
                {isImage ? (
                  <img
                    src={file.url}
                    alt={file.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  getFileIcon(file.mimeType)
                )}

                {/* Selection Checkbox - for images only */}
                {isImage && (
                  <div className="absolute top-1 left-1 z-10">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleFileSelection(file.id)}
                      className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500 bg-white shadow cursor-pointer"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                )}

                {/* Overlay Actions */}
                <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-1">
                  {/* AI Optimize - for images only */}
                  {isImage && (
                    <button
                      onClick={() => openOptimizer(file)}
                      className="p-1.5 bg-purple-500 rounded-full hover:bg-purple-600"
                      title="AI Optimize"
                    >
                      <Wand2 className="w-3.5 h-3.5 text-white" />
                    </button>
                  )}
                  {isImage && (
                    <button
                      onClick={() => setPreviewFile(file)}
                      className="p-1.5 bg-white rounded-full hover:bg-gray-100"
                      title="Preview"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => copyToClipboard(file.url, file.id)}
                    className="p-1.5 bg-white rounded-full hover:bg-gray-100"
                    title="Copy URL"
                  >
                    {copiedUrl === file.id ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  <a
                    href={file.url}
                    download={file.name}
                    className="p-1.5 bg-white rounded-full hover:bg-gray-100"
                    title="Download"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </a>
                  <button
                    onClick={() => confirmDeleteFile(file.id)}
                    className="p-1.5 bg-white rounded-full hover:bg-gray-100"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  </button>
                </div>
              </div>

              {/* File Info */}
              <div className="p-2">
                <p className="text-xs font-medium truncate" title={file.name}>
                  {file.name}
                </p>
                <p className="text-[10px] text-gray-500">
                  {formatFileSize(file.size)}
                </p>
              </div>
            </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  File
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Size
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Uploaded
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredFiles.map((file) => (
                <tr key={file.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-8 w-8">
                        {file.mimeType?.startsWith('image/') ? (
                          <img className="h-8 w-8 rounded object-cover" src={file.url} alt={file.name} />
                        ) : (
                          <div className="h-8 w-8 rounded bg-gray-100 flex items-center justify-center">
                            {React.cloneElement(getFileIcon(file.mimeType), { className: "w-4 h-4" })}
                          </div>
                        )}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900 truncate max-w-xs" title={file.name}>
                          {file.name}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-900">{file.mimeType || 'Unknown'}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-900">{formatFileSize(file.size)}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-900">
                      {new Date(file.uploadedAt).toLocaleDateString()}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      {file.mimeType?.startsWith('image/') && (
                        <button
                          onClick={() => setPreviewFile(file)}
                          className="text-gray-600 hover:text-gray-900"
                          title="Preview"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => copyToClipboard(file.url, file.id)}
                        className="text-gray-600 hover:text-gray-900"
                        title="Copy URL"
                      >
                        {copiedUrl === file.id ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      </button>
                      <a
                        href={file.url}
                        download={file.name}
                        className="text-gray-600 hover:text-gray-900"
                        title="Download"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                      <button
                        onClick={() => confirmDeleteFile(file.id)}
                        className="text-red-600 hover:text-red-900"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Image Preview Modal */}
      {previewFile && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setPreviewFile(null)}
        >
          <div className="relative max-w-4xl max-h-full">
            <img
              src={previewFile.url}
              alt={previewFile.name}
              className="max-w-full max-h-[80vh] object-contain"
            />
            <button
              onClick={() => setPreviewFile(null)}
              className="absolute top-4 right-4 p-2 bg-white rounded-full hover:bg-gray-100"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="absolute bottom-4 left-4 right-4 bg-white rounded-lg p-4">
              <p className="font-medium mb-2">{previewFile.name}</p>
              <div className="flex items-center space-x-4">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    copyToClipboard(previewFile.url, previewFile.id);
                  }}
                  className="flex items-center space-x-2 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  {copiedUrl === previewFile.id ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                  <span>{copiedUrl === previewFile.id ? 'Copied!' : 'Copy URL'}</span>
                </button>
                <code className="flex-1 px-3 py-1 bg-gray-100 rounded text-sm truncate">
                  {previewFile.url}
                </code>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Image Optimizer Modal */}
      {optimizerOpen && (
        <FileLibraryOptimizerModal
          isOpen={optimizerOpen}
          onClose={closeOptimizer}
          storeId={selectedStore?.id}
          fileToOptimize={fileToOptimize}
          selectedFiles={filteredFiles.filter(f => selectedFileIds.includes(f.id))}
          onOptimized={handleOptimizedImage}
          setFlashMessage={setFlashMessage}
        />
      )}

      {/* AI Image Generator Modal */}
      {generatorOpen && (
        <ImageOptimizerModal
          isOpen={generatorOpen}
          onClose={closeGenerator}
          storeId={selectedStore?.id}
          defaultOperation="generate"
          onApply={handleGeneratedImage}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <AlertDialogTitle>
                  {isBulkDelete
                    ? `Delete ${selectedFileIds.length} file${selectedFileIds.length > 1 ? 's' : ''}?`
                    : 'Delete file?'}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {isBulkDelete
                    ? `Are you sure you want to delete ${selectedFileIds.length} selected file${selectedFileIds.length > 1 ? 's' : ''}? This action cannot be undone.`
                    : 'Are you sure you want to delete this file? This action cannot be undone.'}
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmedDelete}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default FileLibrary;