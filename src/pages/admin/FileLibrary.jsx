import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Upload, File, Image, FileText, Film, Music, Archive, Copy, Check, Trash2, Search, Grid, List, Download, Eye, X, AlertCircle, ExternalLink, Settings, Wand2, Package, FolderOpen, Filter, CheckSquare, ChevronDown, Loader2, Sparkles, Maximize, Eraser, FileImage } from 'lucide-react';
import { useStoreSelection } from '@/contexts/StoreSelectionContext';
import { toast } from 'sonner';
import apiClient from '@/api/client';
import SaveButton from '@/components/ui/save-button';
import { PageLoader } from '@/components/ui/page-loader';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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
const FileLibraryOptimizerModal = ({ isOpen, onClose, storeId, fileToOptimize, selectedFiles, onOptimized }) => {
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

  // Operation-specific params
  const [stagingContext, setStagingContext] = useState(STAGING_CONTEXTS[0].value);
  const [customContext, setCustomContext] = useState('');
  const [bgReplacement, setBgReplacement] = useState('transparent');
  const [upscaleScale, setUpscaleScale] = useState(2);

  const providerDropdownRef = useRef(null);
  const operationDropdownRef = useRef(null);

  const isBulkMode = !fileToOptimize && selectedFiles?.length > 0;
  const imagesToProcess = fileToOptimize ? [fileToOptimize] : selectedFiles || [];

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

  // Process images
  const handleOptimize = async () => {
    if (imagesToProcess.length === 0) return;

    setIsProcessing(true);
    setError(null);
    setProcessedCount(0);
    setResults([]);

    const newResults = [];

    for (let i = 0; i < imagesToProcess.length; i++) {
      const image = imagesToProcess[i];
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

        // Fetch image as base64
        const imageResponse = await fetch(image.url);
        const imageBlob = await imageResponse.blob();
        const base64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(imageBlob);
        });

        const response = await apiClient.post('/image-optimization/optimize', {
          provider: selectedProvider,
          operation: selectedOperation,
          image: base64,
          params
        });

        if (response.success) {
          newResults.push({
            original: image,
            success: true,
            result: response.result,
            credits: response.creditsDeducted
          });
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

    setResults(newResults);
    setIsProcessing(false);

    const successCount = newResults.filter(r => r.success).length;
    const totalCredits = newResults.reduce((sum, r) => sum + (r.credits || 0), 0);

    if (successCount > 0) {
      toast.success(`Optimized ${successCount}/${imagesToProcess.length} images (${totalCredits.toFixed(2)} credits used)`);
      if (onOptimized) {
        onOptimized({ results: newResults, creditsUsed: totalCredits });
      }
    } else {
      toast.error('All images failed to process');
    }
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

        {/* Modal Content - Images Preview */}
        <div className="flex-1 overflow-auto p-6">
          {results.length > 0 ? (
            // Results view
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-700">
                Results: {results.filter(r => r.success).length}/{results.length} successful
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {results.map((result, idx) => (
                  <div key={idx} className={cn(
                    "border rounded-lg overflow-hidden",
                    result.success ? "border-green-300" : "border-red-300"
                  )}>
                    <div className="h-24 bg-gray-100 flex items-center justify-center">
                      <img
                        src={result.success && result.result?.imageUrl ? result.result.imageUrl : result.original.url}
                        alt=""
                        className="max-w-full max-h-full object-contain"
                      />
                    </div>
                    <div className="p-2 text-xs">
                      {result.success ? (
                        <div className="flex items-center gap-1 text-green-600">
                          <Check className="w-3 h-3" />
                          <span>{result.credits?.toFixed(2)} credits</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-red-600">
                          <AlertCircle className="w-3 h-3" />
                          <span className="truncate">{result.error}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            // Preview view
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                {isBulkMode ? `Selected Images (${imagesToProcess.length})` : 'Image to Optimize'}
              </h3>
              {isProcessing && (
                <div className="mb-4 p-3 bg-purple-50 rounded-lg">
                  <div className="flex items-center gap-2 text-purple-700 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing {processedCount} of {imagesToProcess.length}...</span>
                  </div>
                  <div className="mt-2 bg-purple-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-purple-600 h-full transition-all"
                      style={{ width: `${(processedCount / imagesToProcess.length) * 100}%` }}
                    />
                  </div>
                </div>
              )}
              <div className={cn(
                "grid gap-3",
                isBulkMode ? "grid-cols-3 md:grid-cols-4 lg:grid-cols-6" : "grid-cols-1 max-w-md mx-auto"
              )}>
                {imagesToProcess.map((file) => (
                  <div
                    key={file.id}
                    className="border rounded-lg overflow-hidden bg-gray-50"
                  >
                    <div className={cn(
                      "flex items-center justify-center bg-gray-100",
                      isBulkMode ? "h-20" : "h-64"
                    )}>
                      <img
                        src={file.url}
                        alt={file.name}
                        className="max-w-full max-h-full object-contain"
                      />
                    </div>
                    {!isBulkMode && (
                      <div className="p-2 text-xs text-gray-500 truncate">
                        {file.name}
                      </div>
                    )}
                  </div>
                ))}
              </div>
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
        <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {results.length > 0 ? (
              <span>
                Total credits used: <span className="font-semibold text-purple-600">
                  {results.reduce((sum, r) => sum + (r.credits || 0), 0).toFixed(2)}
                </span>
              </span>
            ) : totalCost !== null ? (
              <span>
                Estimated cost: <span className="font-semibold text-purple-600">{totalCost.toFixed(2)} credits</span>
                <span className="text-gray-400 ml-1">
                  (${(totalCost * 0.10).toFixed(2)})
                </span>
              </span>
            ) : null}
          </div>
          <div className="flex gap-2">
            {results.length > 0 ? (
              <>
                <Button variant="outline" onClick={() => setResults([])}>
                  Optimize More
                </Button>
                <Button onClick={onClose}>
                  Done
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={onClose} disabled={isProcessing}>
                  Cancel
                </Button>
                <Button
                  onClick={handleOptimize}
                  disabled={isProcessing || imagesToProcess.length === 0}
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
                      Optimize {imagesToProcess.length} Image{imagesToProcess.length !== 1 ? 's' : ''}
                    </>
                  )}
                </Button>
              </>
            )}
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
    if (result.result) {
      toast.success(`Image optimized with ${result.provider}`);
      loadFiles(); // Reload files to show updated version
    }
    setOptimizerOpen(false);
    setFileToOptimize(null);
  };

  // File type icons
  const getFileIcon = (mimeType) => {
    if (!mimeType) return <File className="w-8 h-8" />;
    
    if (mimeType.startsWith('image/')) return <Image className="w-8 h-8 text-blue-500" />;
    if (mimeType.startsWith('video/')) return <Film className="w-8 h-8 text-purple-500" />;
    if (mimeType.startsWith('audio/')) return <Music className="w-8 h-8 text-pink-500" />;
    if (mimeType.includes('pdf')) return <FileText className="w-8 h-8 text-red-500" />;
    if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('rar')) 
      return <Archive className="w-8 h-8 text-yellow-500" />;
    return <File className="w-8 h-8 text-gray-500" />;
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
            uploadedAt: file.created_at || file.updated_at || new Date().toISOString()
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
        toast.error('Failed to load files: ' + error.message);
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
      toast.error("Media storage is not connected. Please configure storage in Media Storage settings first.", {
        action: {
          label: "Go to Settings",
          onClick: () => window.open('/admin/media-storage', '_blank')
        }
      });
      return;
    }

    if (!storageProvider) {
      toast.error("Please configure a storage provider in Media Storage settings first");
      return;
    }

    if (filesArray.length === 0) {
      toast.error("No files selected");
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
        toast.success(`Successfully uploaded ${uploadedFiles.length} file(s)!`);
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

      toast.error(uploadErrorMessage);
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
      toast.error("Media storage is not connected. Please configure storage first.");
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
      toast.success("File URL copied to clipboard");
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch (error) {
      toast.error("Failed to copy URL");
    }
  };

  // Delete file using provider-agnostic storage API
  const deleteFile = async (fileId) => {
    if (!window.confirm('Are you sure you want to delete this file?')) return;

    try {
      // Find the file to get its path
      const file = files.find(f => f.id === fileId);
      if (!file) {
        toast.error("File not found");
        return;
      }

      // Extract file path from the file name/URL
      const filePath = `library/${file.name}`;

      // Use fetch directly for DELETE request with body (apiClient doesn't support body in DELETE)
      const response = await fetch('/api/storage/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiClient.getToken()}`
        },
        body: JSON.stringify({
          imagePath: filePath
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete file');
      }

      const result = await response.json();
      if (result.success) {
        toast.success("File deleted successfully");
        await loadFiles();
      } else {
        toast.error(result.error || "Failed to delete file");
      }
    } catch (error) {
      console.error('Delete error:', error);
      if (error.message?.includes('404') || error.message?.includes('not found')) {
        toast.error("Storage API not available. Cannot delete files.");
      } else {
        toast.error(error.message || "Failed to delete file");
      }
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
      const folder = file.folder || file.path?.split('/')[0] || 'library';
      matchesEntity = folder.toLowerCase().includes(entityFilter.toLowerCase()) ||
        (entityFilter === 'library' && !folder.includes('product') && !folder.includes('categor'));
    }

    return matchesSearch && matchesEntity;
  });

  // Count images for selection
  const imageFilesCount = filteredFiles.filter(f => f.mimeType?.startsWith('image/')).length;

  return (
    <div className="p-6 max-w-7xl mx-auto">
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

      {/* Upload Area */}
      <div 
        className={`mb-6 border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
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
        <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
        <p className="text-gray-600 mb-2">
          Drag and drop files here, or click to browse
        </p>
        <p className="text-sm text-gray-500 mb-4">
          Supports images, PDFs, documents, videos, and more
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

          {/* Bulk AI Optimize */}
          {selectedFileIds.length > 0 && (
            <button
              onClick={() => openOptimizer(null)}
              className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Wand2 className="w-4 h-4" />
              AI Optimize ({selectedFileIds.length})
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* File count */}
          <span className="text-sm text-gray-500 mr-2">
            {filteredFiles.length} file{filteredFiles.length !== 1 ? 's' : ''}
          </span>

          {/* View toggles */}
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded ${viewMode === 'grid' ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
          >
            <Grid className="w-5 h-5" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded ${viewMode === 'list' ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
          >
            <List className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Files Display */}
      {loading ? (
        <PageLoader size="lg" fullScreen={false} className="py-12" text="Loading files..." />
      ) : filteredFiles.length === 0 ? (
        <div className="text-center py-12">
          <File className="w-16 h-16 mx-auto text-gray-300 mb-4" />
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
                    onClick={() => deleteFile(file.id)}
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
                        onClick={() => deleteFile(file.id)}
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
          onClose={() => {
            setOptimizerOpen(false);
            setFileToOptimize(null);
          }}
          storeId={selectedStore?.id}
          fileToOptimize={fileToOptimize}
          selectedFiles={filteredFiles.filter(f => selectedFileIds.includes(f.id))}
          onOptimized={handleOptimizedImage}
        />
      )}
    </div>
  );
};

export default FileLibrary;