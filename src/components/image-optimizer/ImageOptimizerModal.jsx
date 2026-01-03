import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Wand2, X, ChevronDown, Loader2, Check, AlertCircle, Download, FileImage, Maximize, Eraser, Package, Image, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import apiClient from '@/api/client';

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
  { id: 'flat_lay', label: 'Flat Lay', value: 'flat lay on marble surface with props' }
];

// Generate smart staging presets based on product context
const generateSmartPresets = (productContext) => {
  if (!productContext?.name) return [];

  const name = productContext.name.toLowerCase();
  const category = (productContext.category || '').toLowerCase();
  const presets = [];

  // Sports & Outdoor equipment
  if (name.includes('snowboard') || name.includes('ski') || name.includes('snow')) {
    presets.push({ id: 'snow_mountain', label: '🏔️ Snowy Mountain', value: `${productContext.name} on a pristine snowy mountain slope with dramatic alpine peaks in background, professional sports photography` });
    presets.push({ id: 'ski_resort', label: '🎿 Ski Resort', value: `${productContext.name} at a luxury ski resort with snow-covered trees and blue sky` });
  }
  if (name.includes('surf') || name.includes('beach') || name.includes('swim')) {
    presets.push({ id: 'beach', label: '🏖️ Beach', value: `${productContext.name} on a tropical beach with turquoise water and palm trees` });
    presets.push({ id: 'ocean', label: '🌊 Ocean Waves', value: `${productContext.name} with dramatic ocean waves in golden sunset light` });
  }
  if (name.includes('bike') || name.includes('bicycle') || name.includes('cycling')) {
    presets.push({ id: 'mountain_trail', label: '🚵 Mountain Trail', value: `${productContext.name} on a scenic mountain bike trail with forest backdrop` });
    presets.push({ id: 'urban_street', label: '🏙️ Urban Street', value: `${productContext.name} on a clean urban street with modern architecture` });
  }

  // Kitchen & Home appliances
  if (name.includes('washer') || name.includes('washing') || name.includes('dryer') || name.includes('laundry')) {
    presets.push({ id: 'laundry_room', label: '🧺 Modern Laundry', value: `${productContext.name} in a bright modern laundry room with plants and natural light` });
    presets.push({ id: 'utility_room', label: '🏠 Utility Room', value: `${productContext.name} in a clean organized utility room with white cabinets` });
  }
  if (name.includes('fridge') || name.includes('refrigerator') || name.includes('freezer')) {
    presets.push({ id: 'modern_kitchen', label: '👨‍🍳 Modern Kitchen', value: `${productContext.name} in a sleek modern kitchen with marble countertops and pendant lights` });
    presets.push({ id: 'family_kitchen', label: '👨‍👩‍👧 Family Kitchen', value: `${productContext.name} in a warm family kitchen with wooden accents` });
  }
  if (name.includes('oven') || name.includes('stove') || name.includes('cooktop') || name.includes('range')) {
    presets.push({ id: 'chef_kitchen', label: '👨‍🍳 Chef Kitchen', value: `${productContext.name} in a professional chef's kitchen with stainless steel and tile backsplash` });
  }
  if (name.includes('coffee') || name.includes('espresso')) {
    presets.push({ id: 'coffee_bar', label: '☕ Coffee Bar', value: `${productContext.name} on a stylish coffee bar with exposed brick and warm lighting` });
    presets.push({ id: 'cafe', label: '🥐 Café Style', value: `${productContext.name} in a cozy European café setting` });
  }

  // Furniture
  if (name.includes('sofa') || name.includes('couch') || name.includes('chair') || name.includes('armchair')) {
    presets.push({ id: 'living_space', label: '🛋️ Living Space', value: `${productContext.name} in a bright Scandinavian living room with plants and natural light` });
    presets.push({ id: 'luxury_lounge', label: '✨ Luxury Lounge', value: `${productContext.name} in an elegant luxury lounge with art deco elements` });
  }
  if (name.includes('bed') || name.includes('mattress')) {
    presets.push({ id: 'master_bedroom', label: '🛏️ Master Bedroom', value: `${productContext.name} in a serene master bedroom with soft linens and morning light` });
    presets.push({ id: 'hotel_suite', label: '🏨 Hotel Suite', value: `${productContext.name} in a five-star hotel suite with city view` });
  }
  if (name.includes('desk') || name.includes('office')) {
    presets.push({ id: 'home_office', label: '💻 Home Office', value: `${productContext.name} in a productive home office with plants and motivational decor` });
    presets.push({ id: 'executive_office', label: '🏢 Executive Office', value: `${productContext.name} in a prestigious executive office with city skyline view` });
  }
  if (name.includes('table') || name.includes('dining')) {
    presets.push({ id: 'dining_room', label: '🍽️ Dining Room', value: `${productContext.name} in an elegant dining room with chandelier and table setting` });
  }

  // Electronics
  if (name.includes('tv') || name.includes('television') || name.includes('monitor') || name.includes('screen')) {
    presets.push({ id: 'entertainment', label: '📺 Entertainment Room', value: `${productContext.name} in a modern entertainment room with ambient lighting` });
    presets.push({ id: 'gaming_setup', label: '🎮 Gaming Setup', value: `${productContext.name} in an immersive gaming setup with RGB lighting` });
  }
  if (name.includes('phone') || name.includes('tablet') || name.includes('laptop') || name.includes('computer')) {
    presets.push({ id: 'workspace', label: '💼 Workspace', value: `${productContext.name} on a clean minimalist desk workspace` });
    presets.push({ id: 'lifestyle', label: '☕ Lifestyle', value: `${productContext.name} in a lifestyle setting with coffee and notebook` });
  }
  if (name.includes('speaker') || name.includes('audio') || name.includes('headphone')) {
    presets.push({ id: 'music_studio', label: '🎵 Music Studio', value: `${productContext.name} in a professional music studio environment` });
    presets.push({ id: 'living_audio', label: '🔊 Living Room', value: `${productContext.name} in a stylish living room with vinyl records` });
  }

  // Fashion & Clothing
  if (name.includes('shoe') || name.includes('sneaker') || name.includes('boot') || name.includes('sandal')) {
    presets.push({ id: 'street_style', label: '👟 Street Style', value: `${productContext.name} in an urban street style photoshoot setting` });
    presets.push({ id: 'shoe_display', label: '🏪 Boutique Display', value: `${productContext.name} on a luxury boutique shelf display` });
  }
  if (name.includes('watch') || name.includes('jewelry') || name.includes('ring') || name.includes('necklace')) {
    presets.push({ id: 'luxury_display', label: '💎 Luxury Display', value: `${productContext.name} on black velvet with dramatic spotlight lighting` });
    presets.push({ id: 'lifestyle_jewelry', label: '✨ Lifestyle', value: `${productContext.name} in an elegant lifestyle setting with soft focus background` });
  }
  if (name.includes('bag') || name.includes('purse') || name.includes('handbag') || name.includes('backpack')) {
    presets.push({ id: 'fashion_shoot', label: '👜 Fashion Shoot', value: `${productContext.name} in a high-fashion photoshoot setting` });
    presets.push({ id: 'travel', label: '✈️ Travel', value: `${productContext.name} in an airport or travel lifestyle setting` });
  }

  // Category-based fallbacks
  if (presets.length === 0 && category) {
    if (category.includes('kitchen') || category.includes('appliance')) {
      presets.push({ id: 'smart_kitchen', label: '🏠 Smart Kitchen', value: `${productContext.name} in a modern smart kitchen with clean lines` });
    }
    if (category.includes('outdoor') || category.includes('garden')) {
      presets.push({ id: 'garden', label: '🌿 Garden', value: `${productContext.name} in a beautiful garden setting with greenery` });
    }
    if (category.includes('sport') || category.includes('fitness')) {
      presets.push({ id: 'gym', label: '💪 Gym', value: `${productContext.name} in a modern fitness gym environment` });
    }
  }

  // Always add a generic product-specific preset if we have a product name
  if (productContext.name) {
    presets.push({ id: 'product_hero', label: '⭐ Hero Shot', value: `Professional product photography of ${productContext.name} with dramatic studio lighting and clean background` });
  }

  return presets;
};

/**
 * ImageOptimizerModal - Modal for AI image optimization with cost display
 *
 * Props:
 * - isOpen: boolean - Whether the modal is open
 * - onClose: function - Called when modal should close
 * - storeId: string - Current store ID
 * - fileToOptimize: object - Single file to optimize { url, name, folder, id?, size? }
 * - selectedFiles: array - Multiple files for bulk mode (optional)
 * - productContext: object - Product info for smart presets { name, category }
 * - onOptimized: function - Called when optimization is applied { applied, refresh }
 * - setFlashMessage: function - To show success/error messages
 */
const ImageOptimizerModal = ({ isOpen, onClose, storeId, fileToOptimize, selectedFiles, productContext, onOptimized, setFlashMessage }) => {
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
  const [applyToOriginal, setApplyToOriginal] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  // For single image mode
  const [currentImage, setCurrentImage] = useState(null);
  const [currentFormat, setCurrentFormat] = useState('png');
  const [originalImage, setOriginalImage] = useState(null);
  const [imageHistory, setImageHistory] = useState([]);
  const [formatHistory, setFormatHistory] = useState([]);
  const [originalSize, setOriginalSize] = useState(null);

  // Operation-specific params
  const [stagingContext, setStagingContext] = useState(STAGING_CONTEXTS[0].value);
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
      setCurrentImage(null);
      setCurrentFormat('png');
      setImageHistory([]);
      setFormatHistory([]);
      setOriginalSize(singleFile.size || null);

      if (!singleFile.size && singleFile.url) {
        fetch(singleFile.url, { method: 'HEAD' })
          .then(res => {
            const size = res.headers.get('content-length');
            if (size) setOriginalSize(parseInt(size, 10));
          })
          .catch(() => {});
      }
    }
  }, [isOpen, singleFile?.id, singleFile?.url]);

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

  const getCostPerImage = useCallback(() => {
    if (!pricing?.matrix) return null;
    return pricing.matrix[selectedProvider]?.[selectedOperation]?.credits;
  }, [pricing, selectedProvider, selectedOperation]);

  const getTotalCost = useCallback(() => {
    const costPerImage = getCostPerImage();
    if (costPerImage === null) return null;
    return costPerImage * imagesToProcess.length;
  }, [getCostPerImage, imagesToProcess.length]);

  const formatBytes = (bytes) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getBase64Size = (base64) => {
    if (!base64) return null;
    return Math.round(base64.length * 0.75);
  };

  const handleRevert = () => {
    if (imageHistory.length === 0) return;
    const previousImage = imageHistory[imageHistory.length - 1];
    const previousFormat = formatHistory[formatHistory.length - 1] || 'png';
    setImageHistory(prev => prev.slice(0, -1));
    setFormatHistory(prev => prev.slice(0, -1));
    setCurrentImage(previousImage);
    setCurrentFormat(previousFormat);
  };

  const getImageBase64 = async (imageSource) => {
    if (typeof imageSource === 'string' && !imageSource.startsWith('http')) {
      return `data:image/${currentFormat};base64,${imageSource}`;
    }
    const url = typeof imageSource === 'string' ? imageSource : imageSource.url;
    const imageResponse = await fetch(url);
    const imageBlob = await imageResponse.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(imageBlob);
    });
  };

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
        const params = {};
        if (selectedOperation === 'stage') {
          params.context = stagingContext;
          params.style = 'photorealistic';
          params.lighting = 'natural daylight';
        } else if (selectedOperation === 'remove_bg') {
          params.replacement = bgReplacement;
        } else if (selectedOperation === 'upscale') {
          params.scale = upscaleScale;
          params.enhanceDetails = true;
        }

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

          if (!isBulkMode) {
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
      // Dispatch event to refresh credits in sidebar
      window.dispatchEvent(new CustomEvent('creditsUpdated'));
      if (onOptimized) {
        onOptimized({ results: newResults, creditsUsed: totalCredits });
      }
    } else {
      setFlashMessage({ type: 'error', message: 'All images failed to process' });
    }
  };

  const handleApply = async () => {
    if (!currentImage || !singleFile) return;
    setIsApplying(true);

    try {
      const format = currentFormat || 'png';
      const base64Data = currentImage;
      const originalName = singleFile.name || 'image';

      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: `image/${format}` });

      if (applyToOriginal) {
        const fileFolder = singleFile.folder || singleFile.path?.split('/')[0] || 'library';
        const filePath = `${fileFolder}/${singleFile.name}`;
        const newName = originalName.replace(/\.[^.]+$/, `.${format}`);

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
          // Don't close modal - user can close manually with Cancel/X
        } else {
          throw new Error(replaceResponse.error || 'Replace failed');
        }
      } else {
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

  // Use portal to render at document body level (escape parent modal z-index)
  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
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
          {selectedOperation === 'stage' && (() => {
            const smartPresets = generateSmartPresets(productContext);
            return (
              <div className="mt-4 pt-4 border-t">
                <label className="text-xs font-medium text-gray-500 mb-2 block">Staging Context</label>
                <input
                  type="text"
                  value={stagingContext}
                  onChange={(e) => setStagingContext(e.target.value)}
                  placeholder="Describe the environment (e.g., 'luxury penthouse with city view')"
                  className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 mb-3"
                  disabled={isProcessing}
                />

                {/* Smart presets based on product */}
                {smartPresets.length > 0 && (
                  <div className="mb-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-medium text-purple-600">✨ Suggested for {productContext?.name}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {smartPresets.map((ctx) => (
                        <button
                          key={ctx.id}
                          onClick={() => setStagingContext(ctx.value)}
                          disabled={isProcessing}
                          className={cn(
                            "px-2.5 py-1.5 text-xs rounded-full transition-colors border",
                            stagingContext === ctx.value
                              ? "bg-purple-100 text-purple-700 border-purple-300"
                              : "bg-purple-50 text-purple-600 border-purple-200 hover:bg-purple-100"
                          )}
                        >
                          {ctx.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Generic presets */}
                <div className="flex flex-wrap gap-1.5">
                  {STAGING_CONTEXTS.map((ctx) => (
                    <button
                      key={ctx.id}
                      onClick={() => setStagingContext(ctx.value)}
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
              </div>
            );
          })()}

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
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-700">
                {results.length > 0
                  ? `Results: ${results.filter(r => r.success).length}/${results.length} successful`
                  : `${imagesToProcess.length} images selected`
                }
              </h3>

              {results.length > 0 ? (
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
            <div className="flex items-center gap-3">
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

            <div className="flex gap-2">
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
    </div>,
    document.body
  );
};

export default ImageOptimizerModal;
