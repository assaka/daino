import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import {
  Image,
  Upload,
  Download,
  Loader2,
  ChevronDown,
  X,
  Sparkles,
  Wand2,
  Maximize,
  Eraser,
  FileImage,
  Package,
  Check,
  AlertCircle
} from 'lucide-react';
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
  { id: 'flat_lay', label: 'Flat Lay', value: 'flat lay on marble surface with props' },
  { id: 'custom', label: 'Custom...', value: '' }
];

/**
 * ImageOptimizer Component
 *
 * AI-powered image optimization with provider selection dropdown
 * Similar UI pattern to WorkspaceAIPanel chat model selector
 */
const ImageOptimizer = ({ storeId, onImageOptimized, className }) => {
  // State
  const [pricing, setPricing] = useState(null);
  const [pricingLoading, setPricingLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState('openai');
  const [selectedOperation, setSelectedOperation] = useState('stage');
  const [showProviderDropdown, setShowProviderDropdown] = useState(false);
  const [showOperationDropdown, setShowOperationDropdown] = useState(false);

  // Image state
  const [uploadedImage, setUploadedImage] = useState(null); // { file, preview, base64 }
  const [resultImage, setResultImage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);

  // Operation-specific params
  const [stagingContext, setStagingContext] = useState(STAGING_CONTEXTS[0].value);
  const [customContext, setCustomContext] = useState('');
  const [bgReplacement, setBgReplacement] = useState('transparent');
  const [upscaleScale, setUpscaleScale] = useState(2);

  // Refs
  const fileInputRef = useRef(null);
  const providerDropdownRef = useRef(null);
  const operationDropdownRef = useRef(null);

  // Fetch pricing on mount
  useEffect(() => {
    const fetchPricing = async () => {
      try {
        const response = await apiClient.get('/image-optimization/pricing');
        if (response.success) {
          setPricing(response);
          // Set default provider based on availability
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
    fetchPricing();
  }, []);

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

  // Get current credit cost
  const getCurrentCost = useCallback(() => {
    if (!pricing?.matrix) return null;
    return pricing.matrix[selectedProvider]?.[selectedOperation]?.credits;
  }, [pricing, selectedProvider, selectedOperation]);

  // Handle file upload
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Create preview and base64
    const preview = URL.createObjectURL(file);
    const base64 = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(file);
    });

    setUploadedImage({ file, preview, base64 });
    setResultImage(null);
    setError(null);
  };

  // Handle optimization
  const handleOptimize = async () => {
    if (!uploadedImage) {
      setError('Please upload an image first');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setResultImage(null);

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

      const response = await apiClient.post('/image-optimization/optimize', {
        provider: selectedProvider,
        operation: selectedOperation,
        image: uploadedImage.base64,
        params
      });

      if (response.success) {
        // Handle different response formats
        let imageData = response.result?.image || response.result?.imageUrl;

        if (imageData) {
          // If it's a URL, use directly; if base64, prefix with data URI
          const isUrl = imageData.startsWith('http');
          setResultImage({
            url: isUrl ? imageData : `data:image/png;base64,${imageData}`,
            credits: response.creditsDeducted,
            provider: selectedProvider,
            operation: selectedOperation
          });

          if (onImageOptimized) {
            onImageOptimized({
              original: uploadedImage,
              result: imageData,
              provider: selectedProvider,
              operation: selectedOperation,
              credits: response.creditsDeducted
            });
          }
        } else {
          throw new Error('No image returned from optimization');
        }
      } else {
        throw new Error(response.message || 'Optimization failed');
      }
    } catch (err) {
      console.error('Optimization error:', err);
      setError(err.response?.data?.message || err.message || 'Failed to optimize image');
    } finally {
      setIsProcessing(false);
    }
  };

  // Download result
  const handleDownload = () => {
    if (!resultImage?.url) return;

    const link = document.createElement('a');
    link.href = resultImage.url;
    link.download = `optimized-${selectedOperation}-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Clear all
  const handleClear = () => {
    if (uploadedImage?.preview) {
      URL.revokeObjectURL(uploadedImage.preview);
    }
    setUploadedImage(null);
    setResultImage(null);
    setError(null);
  };

  const currentCost = getCurrentCost();

  return (
    <div className={cn("flex flex-col h-full bg-white dark:bg-gray-900 rounded-lg border", className)}>
      {/* Header */}
      <div className="px-4 py-3 border-b bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wand2 className="h-4 w-4 text-purple-500" />
          <span className="font-medium text-sm">AI Image Optimizer</span>
        </div>

        {/* Provider & Operation Selectors */}
        <div className="flex items-center gap-2">
          {/* Provider Dropdown */}
          <div className="relative" ref={providerDropdownRef}>
            <button
              onClick={() => setShowProviderDropdown(!showProviderDropdown)}
              disabled={isProcessing || pricingLoading}
              className={cn(
                "flex items-center gap-1.5 px-2 py-1 text-xs rounded-md transition-all",
                "border border-gray-200 dark:border-gray-600",
                "hover:bg-gray-100 dark:hover:bg-gray-700",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              <span>{PROVIDERS[selectedProvider]?.icon}</span>
              <span className="font-medium">{PROVIDERS[selectedProvider]?.name}</span>
              <ChevronDown className={cn("w-3 h-3 transition-transform", showProviderDropdown && "rotate-180")} />
            </button>

            {showProviderDropdown && (
              <div className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-50 overflow-hidden">
                <div className="p-2 border-b border-gray-100 dark:border-gray-700">
                  <p className="text-[10px] font-medium text-gray-500">Select AI Provider</p>
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
                          "w-full flex items-center gap-2 px-3 py-2 text-left transition-colors",
                          selectedProvider === providerId
                            ? "bg-purple-50 dark:bg-purple-900/30"
                            : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
                        )}
                      >
                        <span className="text-lg">{provider.icon}</span>
                        <div className="flex-1">
                          <span className={cn(
                            "text-sm font-medium",
                            selectedProvider === providerId ? "text-purple-600 dark:text-purple-400" : ""
                          )}>
                            {provider.name}
                          </span>
                        </div>
                        {cost !== undefined && (
                          <span className="text-xs font-medium text-gray-500">
                            {cost} cr
                          </span>
                        )}
                        {selectedProvider === providerId && (
                          <Check className="w-3.5 h-3.5 text-purple-600" />
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
            <button
              onClick={() => setShowOperationDropdown(!showOperationDropdown)}
              disabled={isProcessing}
              className={cn(
                "flex items-center gap-1.5 px-2 py-1 text-xs rounded-md transition-all",
                "border border-gray-200 dark:border-gray-600",
                "hover:bg-gray-100 dark:hover:bg-gray-700",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {React.createElement(OPERATIONS[selectedOperation]?.icon || Image, { className: "w-3.5 h-3.5" })}
              <span className="font-medium">{OPERATIONS[selectedOperation]?.name}</span>
              <ChevronDown className={cn("w-3 h-3 transition-transform", showOperationDropdown && "rotate-180")} />
            </button>

            {showOperationDropdown && (
              <div className="absolute right-0 top-full mt-1 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-50 overflow-hidden">
                <div className="p-2 border-b border-gray-100 dark:border-gray-700">
                  <p className="text-[10px] font-medium text-gray-500">Select Operation</p>
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
                          "w-full flex items-center gap-2 px-3 py-2 text-left transition-colors",
                          selectedOperation === opId
                            ? "bg-purple-50 dark:bg-purple-900/30"
                            : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
                        )}
                      >
                        <OpIcon className="w-4 h-4 text-gray-500" />
                        <div className="flex-1">
                          <span className={cn(
                            "text-sm font-medium block",
                            selectedOperation === opId ? "text-purple-600 dark:text-purple-400" : ""
                          )}>
                            {op.name}
                          </span>
                          <span className="text-[10px] text-gray-500">{op.description}</span>
                        </div>
                        {cost !== undefined && (
                          <span className="text-xs font-medium text-gray-500">
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
        </div>
      </div>

      {/* Main Content */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {/* Upload Area */}
          {!uploadedImage ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
                "border-gray-300 dark:border-gray-600",
                "hover:border-purple-400 dark:hover:border-purple-500",
                "hover:bg-purple-50/50 dark:hover:bg-purple-900/10"
              )}
            >
              <Upload className="w-10 h-10 mx-auto text-gray-400 mb-3" />
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Click to upload image
              </p>
              <p className="text-xs text-gray-500 mt-1">
                PNG, JPG, WebP up to 10MB
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Image Preview */}
              <div className="grid grid-cols-2 gap-4">
                {/* Original */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-500">Original</span>
                    <button
                      onClick={handleClear}
                      className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <X className="w-3.5 h-3.5 text-gray-400" />
                    </button>
                  </div>
                  <div className="relative aspect-square rounded-lg overflow-hidden border bg-gray-100 dark:bg-gray-800">
                    <img
                      src={uploadedImage.preview}
                      alt="Original"
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>

                {/* Result */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-500">Result</span>
                    {resultImage && (
                      <button
                        onClick={handleDownload}
                        className="flex items-center gap-1 px-2 py-0.5 text-xs rounded bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 hover:bg-purple-200"
                      >
                        <Download className="w-3 h-3" />
                        Download
                      </button>
                    )}
                  </div>
                  <div className="relative aspect-square rounded-lg overflow-hidden border bg-gray-100 dark:bg-gray-800">
                    {isProcessing ? (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                          <Loader2 className="w-8 h-8 animate-spin text-purple-500 mx-auto mb-2" />
                          <p className="text-xs text-gray-500">Processing...</p>
                        </div>
                      </div>
                    ) : resultImage ? (
                      <img
                        src={resultImage.url}
                        alt="Result"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center text-gray-400">
                          <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p className="text-xs">Click "Optimize" to process</p>
                        </div>
                      </div>
                    )}
                  </div>
                  {resultImage?.credits && (
                    <p className="text-xs text-gray-500 text-center">
                      {resultImage.credits} credits used
                    </p>
                  )}
                </div>
              </div>

              {/* Operation-specific options */}
              {selectedOperation === 'stage' && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Staging Context
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {STAGING_CONTEXTS.map((ctx) => (
                      <button
                        key={ctx.id}
                        onClick={() => {
                          setStagingContext(ctx.value);
                          if (ctx.id !== 'custom') {
                            setCustomContext('');
                          }
                        }}
                        className={cn(
                          "px-2 py-1 text-xs rounded-full transition-colors",
                          stagingContext === ctx.value
                            ? "bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 border border-purple-300"
                            : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200"
                        )}
                      >
                        {ctx.label}
                      </button>
                    ))}
                  </div>
                  {stagingContext === '' && (
                    <Textarea
                      value={customContext}
                      onChange={(e) => setCustomContext(e.target.value)}
                      placeholder="Describe the environment (e.g., 'luxury penthouse with city view')"
                      className="text-sm h-16 resize-none"
                    />
                  )}
                </div>
              )}

              {selectedOperation === 'remove_bg' && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Background Replacement
                  </label>
                  <div className="flex gap-2">
                    {['transparent', 'white', 'black', 'gradient'].map((bg) => (
                      <button
                        key={bg}
                        onClick={() => setBgReplacement(bg)}
                        className={cn(
                          "px-3 py-1.5 text-xs rounded transition-colors capitalize",
                          bgReplacement === bg
                            ? "bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 border border-purple-300"
                            : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200"
                        )}
                      >
                        {bg}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {selectedOperation === 'upscale' && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Upscale Factor
                  </label>
                  <div className="flex gap-2">
                    {[2, 3, 4].map((scale) => (
                      <button
                        key={scale}
                        onClick={() => setUpscaleScale(scale)}
                        className={cn(
                          "px-4 py-1.5 text-xs rounded transition-colors",
                          upscaleScale === scale
                            ? "bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 border border-purple-300"
                            : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200"
                        )}
                      >
                        {scale}x
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t bg-gray-50 dark:bg-gray-800/50">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={handleFileSelect}
        />

        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-500">
            {currentCost !== null && (
              <span>
                Cost: <span className="font-medium text-purple-600">{currentCost} credits</span> per image
              </span>
            )}
          </div>

          <div className="flex gap-2">
            {uploadedImage && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
              >
                <Upload className="w-3.5 h-3.5 mr-1.5" />
                New Image
              </Button>
            )}

            <Button
              size="sm"
              onClick={handleOptimize}
              disabled={!uploadedImage || isProcessing}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Wand2 className="w-3.5 h-3.5 mr-1.5" />
                  Optimize
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageOptimizer;
