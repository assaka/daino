import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Wand2, X, ChevronDown, Loader2, Check, AlertCircle, Download, FileImage, Maximize, Eraser, Package, Image, Undo2, Sparkles, ImagePlus, ImageIcon, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import apiClient from '@/api/client';
import FilePickerModal from '@/components/ui/FilePickerModal';

// Provider display info
const PROVIDERS = {
  openai: { name: 'OpenAI', icon: '🤖', color: 'text-green-600' },
  gemini: { name: 'Gemini', icon: '✨', color: 'text-blue-600' },
  flux: { name: 'Flux', icon: '⚡', color: 'text-purple-600' },
  qwen: { name: 'Qwen', icon: '🎨', color: 'text-orange-600', disabled: true }
};

// Provider capabilities (must match backend)
const PROVIDER_CAPABILITIES = {
  openai: ['compress', 'upscale', 'remove_bg', 'stage', 'convert', 'custom', 'generate'],
  gemini: ['compress', 'upscale', 'remove_bg', 'stage', 'convert', 'custom'],
  flux: ['upscale', 'remove_bg', 'stage', 'convert', 'custom', 'generate'],
  qwen: ['compress', 'upscale', 'remove_bg', 'stage', 'convert', 'custom']
};

// Operation display info
const OPERATIONS = {
  generate: { name: 'Generate', icon: ImagePlus, description: 'Create new images from text' },
  compress: { name: 'Compress', icon: FileImage, description: 'Optimize quality & size' },
  upscale: { name: 'Upscale', icon: Maximize, description: 'Enhance resolution' },
  remove_bg: { name: 'Remove Background', icon: Eraser, description: 'Remove or replace background' },
  stage: { name: 'Product Staging', icon: Package, description: 'Place in environment' },
  convert: { name: 'Convert Format', icon: FileImage, description: 'WebP, AVIF optimization' },
  custom: { name: 'Custom', icon: Sparkles, description: 'Custom AI instruction' }
};

// Style presets for image generation
const GENERATION_STYLES = [
  { id: 'photorealistic', label: 'Photorealistic', icon: '📷' },
  { id: 'product-photo', label: 'Product Photo', icon: '🛍️' },
  { id: 'lifestyle', label: 'Lifestyle', icon: '🏠' },
  { id: 'minimalist', label: 'Minimalist', icon: '⬜' },
  { id: 'cinematic', label: 'Cinematic', icon: '🎬' },
  { id: 'artistic', label: 'Artistic', icon: '🎨' },
  { id: 'illustration', label: 'Illustration', icon: '✏️' }
];


// Flux model options with credit costs
const FLUX_MODELS = [
  { id: 'flux-dev', label: 'Flux Dev', description: 'Fast & affordable', icon: '⚡', credits: 2 },
  { id: 'flux-pro', label: 'Flux Pro', description: 'Better quality', icon: '✨', credits: 4 },
  { id: 'flux-pro-1.1', label: 'Flux Pro 1.1', description: 'Best quality', icon: '🌟', credits: 5 }
];

// Aspect ratio options
const ASPECT_RATIOS = [
  { id: '1:1', label: 'Square', width: 1024, height: 1024 },
  { id: '16:9', label: 'Landscape', width: 1344, height: 768 },
  { id: '9:16', label: 'Portrait', width: 768, height: 1344 },
  { id: '4:3', label: 'Standard', width: 1152, height: 896 },
  { id: '3:2', label: 'Photo', width: 1216, height: 832 }
];

// Generate short filename from prompt
const generateFilenameFromPrompt = (prompt) => {
  if (!prompt) return `image-${Date.now()}`;

  // Common stop words to filter out
  const stopWords = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need',
    'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
    'create', 'make', 'generate', 'show', 'display', 'image', 'photo', 'picture'
  ]);

  // Extract meaningful words
  const words = prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // Remove special chars
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word))
    .slice(0, 4); // Take first 4 meaningful words

  if (words.length === 0) return `image-${Date.now()}`;

  // Create kebab-case filename with short timestamp
  const timestamp = Date.now().toString().slice(-6); // Last 6 digits for uniqueness
  return `${words.join('-')}-${timestamp}`;
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

// Smart staging preset generation - analyzes product to generate contextual scenes
const generateSmartPresets = (productContext) => {
  if (!productContext?.name) return [];

  const productName = productContext.name;
  const fullText = `${productName} ${productContext.category || ''}`.toLowerCase();

  // Detect product characteristics
  const isWearable = /wear|shirt|pants|dress|jacket|coat|hoodie|sweater|jeans|skirt|blouse|top|cloth|apparel|fashion|outfit/i.test(fullText);
  const isOnHead = /headphone|headset|earphone|earbud|hat|cap|helmet|glasses|sunglasses|eyewear|vr|headband/i.test(fullText);
  const isOnWrist = /watch|bracelet|wristband|fitbit|smartwatch/i.test(fullText);
  const isOnFeet = /shoe|sneaker|boot|sandal|heel|loafer|slipper|footwear/i.test(fullText);
  const isOnNeck = /necklace|pendant|chain|scarf|tie|collar/i.test(fullText);
  const isOnFinger = /ring/i.test(fullText);
  const isCarried = /bag|backpack|purse|handbag|luggage|suitcase|tote|briefcase|wallet|clutch/i.test(fullText);
  const isSitOn = /chair|sofa|couch|bench|stool|seat|armchair|recliner/i.test(fullText);
  const isLieOn = /bed|mattress|pillow|blanket|duvet/i.test(fullText);
  const isJewelry = /jewelry|earring|ring|necklace|bracelet|gem|diamond|gold|silver/i.test(fullText);
  const isBeauty = /makeup|cosmetic|lipstick|perfume|skincare|cream|serum|beauty/i.test(fullText);
  const isElectronic = /phone|laptop|tablet|computer|tv|monitor|camera|speaker|device|tech/i.test(fullText);
  const isKitchen = /kitchen|cook|appliance|fridge|oven|blender|coffee|espresso/i.test(fullText);
  const isFurniture = /table|desk|shelf|cabinet|lamp|furniture|decor/i.test(fullText);
  const isOutdoor = /outdoor|camping|hiking|garden|patio|bike|bicycle|sport|fitness/i.test(fullText);
  const isKids = /baby|kid|child|toy|nursery/i.test(fullText);
  const isPet = /pet|dog|cat|animal/i.test(fullText);
  const isFood = /food|drink|beverage|snack|chocolate|wine|coffee|tea/i.test(fullText);
  const isVehicle = /car|bike|bicycle|scooter|motorcycle/i.test(fullText);

  const presets = [];

  // Generate contextual presets based on what the product is
  if (isWearable || isOnHead || isOnWrist || isOnFeet || isOnNeck || isCarried) {
    // Wearable/carryable items - show with model
    presets.push({
      id: 'model_using',
      label: '👤 Model Using',
      value: `Professional model ${isOnHead ? 'wearing' : isCarried ? 'carrying' : isOnWrist ? 'wearing on wrist' : isOnFeet ? 'wearing' : 'using'} ${productName}, lifestyle fashion photography with natural lighting`
    });
    presets.push({
      id: 'urban_lifestyle',
      label: '🌆 Urban Lifestyle',
      value: `Stylish person ${isCarried ? 'carrying' : 'wearing'} ${productName} walking in modern city street, editorial fashion photography`
    });
    presets.push({
      id: 'studio_model',
      label: '📸 Studio Portrait',
      value: `Fashion model ${isCarried ? 'holding' : 'wearing'} ${productName} in professional studio with clean background`
    });
  }

  if (isOnHead) {
    presets.push({
      id: 'close_portrait',
      label: '🎧 Close-up Portrait',
      value: `Close-up portrait of person wearing ${productName}, professional headshot with soft lighting`
    });
  }

  if (isOnWrist) {
    presets.push({
      id: 'wrist_closeup',
      label: '⌚ Wrist Close-up',
      value: `Elegant close-up of ${productName} on wrist, lifestyle photography with blurred background`
    });
  }

  if (isOnFeet) {
    presets.push({
      id: 'walking_motion',
      label: '🚶 Walking Shot',
      value: `Person walking wearing ${productName}, dynamic street photography with motion`
    });
  }

  if (isSitOn) {
    presets.push({
      id: 'person_sitting',
      label: '🧘 Person Relaxing',
      value: `Person comfortably sitting on ${productName} in stylish living room, lifestyle photography`
    });
    presets.push({
      id: 'person_reading',
      label: '📖 Person Reading',
      value: `Person reading a book while sitting on ${productName}, cozy home atmosphere with natural light`
    });
  }

  if (isLieOn) {
    presets.push({
      id: 'person_sleeping',
      label: '😴 Person Sleeping',
      value: `Person peacefully sleeping on ${productName} in serene bedroom with soft morning light`
    });
  }

  if (isJewelry || isBeauty) {
    presets.push({
      id: 'luxury_closeup',
      label: '💎 Luxury Close-up',
      value: `${productName} in luxury product photography, dramatic lighting on dark velvet background`
    });
    if (!isOnWrist && !isOnFinger) {
      presets.push({
        id: 'model_glamour',
        label: '✨ Glamour Shot',
        value: `Elegant model wearing ${productName}, glamour portrait with professional lighting`
      });
    }
  }

  if (isElectronic) {
    presets.push({
      id: 'tech_lifestyle',
      label: '💻 Tech Lifestyle',
      value: `Person using ${productName} in modern minimalist workspace, lifestyle technology photography`
    });
    presets.push({
      id: 'clean_tech',
      label: '🔲 Clean Tech',
      value: `${productName} on clean desk with minimal props, modern tech product photography`
    });
  }

  if (isKitchen) {
    presets.push({
      id: 'kitchen_use',
      label: '👨‍🍳 In Use',
      value: `Person using ${productName} in modern kitchen, lifestyle cooking photography`
    });
    presets.push({
      id: 'modern_kitchen',
      label: '🏠 Modern Kitchen',
      value: `${productName} in sleek modern kitchen with marble countertops and natural light`
    });
  }

  if (isFurniture) {
    presets.push({
      id: 'styled_room',
      label: '🏠 Styled Room',
      value: `${productName} in beautifully styled modern interior with complementary decor`
    });
    presets.push({
      id: 'scandinavian',
      label: '🤍 Scandinavian',
      value: `${productName} in bright Scandinavian-style room with plants and natural light`
    });
  }

  if (isOutdoor) {
    presets.push({
      id: 'outdoor_action',
      label: '🏔️ Outdoor Action',
      value: `Person using ${productName} in scenic outdoor setting, adventure lifestyle photography`
    });
    presets.push({
      id: 'nature_setting',
      label: '🌿 Nature Setting',
      value: `${productName} in beautiful natural environment with mountains or forest backdrop`
    });
  }

  if (isVehicle) {
    presets.push({
      id: 'rider',
      label: '🚴 With Rider',
      value: `Person riding ${productName} on scenic road, dynamic action photography`
    });
  }

  if (isKids) {
    presets.push({
      id: 'child_playing',
      label: '👶 Child Playing',
      value: `Happy child using ${productName} in bright playful setting`
    });
  }

  if (isPet) {
    presets.push({
      id: 'pet_using',
      label: '🐕 Pet Using',
      value: `Cute pet with ${productName} in cozy home setting, pet lifestyle photography`
    });
  }

  if (isFood) {
    presets.push({
      id: 'food_styled',
      label: '🍽️ Food Styling',
      value: `${productName} in professional food photography setting with complementary props`
    });
  }

  // Always add universal presets
  presets.push({
    id: 'hero_shot',
    label: '⭐ Hero Shot',
    value: `Professional product photography of ${productName} with dramatic studio lighting and clean background`
  });

  // If no specific matches, add generic lifestyle presets
  if (presets.length <= 1) {
    presets.unshift({
      id: 'lifestyle',
      label: '🏠 Lifestyle',
      value: `${productName} in stylish modern setting, professional lifestyle product photography`
    });
    presets.unshift({
      id: 'minimalist',
      label: '🤍 Minimalist',
      value: `${productName} on clean white background with soft shadows, professional product photography`
    });
    presets.unshift({
      id: 'natural',
      label: '🌿 Natural',
      value: `${productName} with natural elements like plants, wood and soft natural lighting`
    });
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
const ImageOptimizerModal = ({ isOpen, onClose, storeId, fileToOptimize, selectedFiles, productContext, defaultOperation, onOptimized, setFlashMessage }) => {
  const [pricing, setPricing] = useState(null);
  const [pricingLoading, setPricingLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState('openai');
  const [selectedOperation, setSelectedOperation] = useState(defaultOperation || 'remove_bg');

  // Set default operation when modal opens
  useEffect(() => {
    if (isOpen && defaultOperation) {
      setSelectedOperation(defaultOperation);
      // Use Flux as default for generation (best quality)
      if (defaultOperation === 'generate') {
        setSelectedProvider('flux');
      }
    }
  }, [isOpen, defaultOperation]);

  // Generation-specific state
  const [generatePrompt, setGeneratePrompt] = useState('');
  const [generateStyle, setGenerateStyle] = useState('photorealistic');
  const [generateAspectRatio, setGenerateAspectRatio] = useState('1:1');
  const [fluxModel, setFluxModel] = useState('flux-dev');
  const [generationHistory, setGenerationHistory] = useState([]);
  const [showProviderDropdown, setShowProviderDropdown] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [showOperationDropdown, setShowOperationDropdown] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);
  const [applyToOriginal, setApplyToOriginal] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [referenceImage, setReferenceImage] = useState(null); // For product reference in generation
  const [showFilePicker, setShowFilePicker] = useState(false);

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
  const [bgCustomColor, setBgCustomColor] = useState('#ffffff');
  const [upscaleScale, setUpscaleScale] = useState(2);
  const [compressQuality, setCompressQuality] = useState(80);
  const [convertFormat, setConvertFormat] = useState('webp');

  const providerDropdownRef = useRef(null);
  const modelDropdownRef = useRef(null);
  const operationDropdownRef = useRef(null);

  // Determine single vs bulk mode
  const singleFile = fileToOptimize || (selectedFiles?.length === 1 ? selectedFiles[0] : null);
  const isBulkMode = !singleFile && selectedFiles?.length > 1;
  const imagesToProcess = singleFile ? [singleFile] : selectedFiles || [];

  // Check if we're in generate mode (no source image needed)
  const isGenerateMode = selectedOperation === 'generate';

  // Initialize original/current image for single mode
  // Reset state whenever the modal opens or the file changes
  useEffect(() => {
    if (isOpen && singleFile) {
      // Always reset to ensure fresh state for new image
      setOriginalImage(singleFile);
      setCurrentImage(null);
      setCurrentFormat('png');
      setImageHistory([]);
      setFormatHistory([]);
      setResults([]);
      setError(null);
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
    // Use URL as primary identifier since id might be undefined for some items
  }, [isOpen, singleFile?.url]);

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
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(e.target)) {
        setShowModelDropdown(false);
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
    // For generate mode, always 1 image at a time
    if (isGenerateMode) return costPerImage;
    return costPerImage * imagesToProcess.length;
  }, [getCostPerImage, imagesToProcess.length, isGenerateMode]);

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

  // Handle image generation
  const handleGenerate = async () => {
    if (!generatePrompt.trim()) {
      setError('Please enter a prompt to generate an image');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const requestBody = {
        provider: selectedProvider,
        prompt: generatePrompt,
        style: generateStyle,
        aspectRatio: generateAspectRatio,
        model: selectedProvider === 'flux' ? fluxModel : undefined
      };

      // Include reference image if selected
      if (referenceImage?.url) {
        requestBody.referenceImageUrl = referenceImage.url;
      }

      const response = await apiClient.post('/image-optimization/generate', requestBody);

      if (response.success) {
        const generatedImage = {
          id: Date.now(),
          prompt: generatePrompt,
          style: generateStyle,
          aspectRatio: generateAspectRatio,
          image: response.result.image,
          format: response.result.format || 'png',
          credits: response.creditsDeducted,
          timestamp: new Date()
        };

        setGenerationHistory(prev => [generatedImage, ...prev]);
        setCurrentImage(response.result.image);
        setCurrentFormat(response.result.format || 'png');

        setFlashMessage({
          type: 'success',
          message: `Image generated (${response.creditsDeducted?.toFixed(2)} credits used)`
        });
        window.dispatchEvent(new CustomEvent('creditsUpdated'));

        if (onOptimized) {
          onOptimized({ generated: true, result: generatedImage });
        }
      } else {
        const errorMessage = response.suggestion
          ? `${response.message} ${response.suggestion}`
          : response.message || 'Generation failed';
        setError(errorMessage);
      }
    } catch (err) {
      const errorData = err.response?.data || err;
      const errorMessage = errorData.suggestion
        ? `${errorData.message} ${errorData.suggestion}`
        : errorData.message || err.message || 'Generation failed';
      setError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOptimize = async () => {
    // Handle generate mode separately
    if (isGenerateMode) {
      return handleGenerate();
    }

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
          if (bgReplacement === 'custom') {
            params.customColor = bgCustomColor;
          }
        } else if (selectedOperation === 'upscale') {
          params.scale = upscaleScale;
          params.enhanceDetails = true;
        } else if (selectedOperation === 'compress') {
          params.quality = compressQuality;
        } else if (selectedOperation === 'convert') {
          params.format = convertFormat;
          params.quality = compressQuality;
        } else if (selectedOperation === 'custom') {
          params.instruction = stagingContext;
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
          // Use structured error message from API
          const errorMessage = response.suggestion
            ? `${response.message} ${response.suggestion}`
            : response.message || 'Failed';
          newResults.push({
            original: image,
            success: false,
            error: errorMessage,
            code: response.code
          });
        }
      } catch (err) {
        // Handle API errors with structured response
        const errorData = err.response?.data || err;
        const errorMessage = errorData.suggestion
          ? `${errorData.message} ${errorData.suggestion}`
          : errorData.message || err.message || 'Processing failed';
        newResults.push({
          original: image,
          success: false,
          error: errorMessage,
          code: errorData.code
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
      // Show the first error message for better feedback
      const firstError = newResults.find(r => !r.success)?.error || 'All images failed to process';
      setFlashMessage({ type: 'error', message: firstError });
    }
  };

  const handleApply = async () => {
    if (!currentImage) return;

    // For generate mode, we don't need a singleFile
    if (!isGenerateMode && !singleFile) return;

    setIsApplying(true);

    try {
      const format = currentFormat || 'png';
      const base64Data = currentImage;

      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: `image/${format}` });

      if (isGenerateMode) {
        // For generated images, always save as new file to library
        // Uses unified storage manager - works with Supabase, S3, GCS, or local storage
        const newName = `${generateFilenameFromPrompt(generatePrompt)}.${format}`;
        const file = new File([blob], newName, { type: `image/${format}` });
        const uploadResponse = await apiClient.uploadFile('/storage/upload', file, { folder: 'library', public: 'true' });

        if (uploadResponse.success) {
          setFlashMessage({ type: 'success', message: `Saved "${newName}" to library` });
          setJustSaved(true);
          setTimeout(() => setJustSaved(false), 2000);
          if (onOptimized) onOptimized({ applied: true, refresh: true });
        } else {
          throw new Error('Upload failed');
        }
      } else if (applyToOriginal) {
        const originalName = singleFile.name || 'image';
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
        const originalName = singleFile.name || 'image';
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
        <div className="px-6 py-2 lg:py-4 border-b flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center",
              isGenerateMode ? "bg-indigo-100" : "bg-purple-100"
            )}>
              {isGenerateMode ? (
                <ImagePlus className="w-5 h-5 text-indigo-600" />
              ) : (
                <Wand2 className="w-5 h-5 text-purple-600" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-semibold">
                {isGenerateMode
                  ? 'AI Image Generator'
                  : isBulkMode
                    ? `AI Optimize ${imagesToProcess.length} Images`
                    : 'AI Image Optimizer'}
              </h2>
              <p className="text-sm text-gray-500">
                {isGenerateMode
                  ? 'Create new images from text descriptions'
                  : 'Select provider and operation below'}
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
        <div className="px-6 py-1 lg:py-4 border-b bg-white">
          <div className="flex flex-wrap items-center gap-4">
            {/* Provider Dropdown */}
            <div className="relative" ref={providerDropdownRef}>
              <label className="block text-xs font-medium text-gray-500 mb-1">Provider</label>
              <button
                onClick={() => setShowProviderDropdown(!showProviderDropdown)}
                disabled={isProcessing || pricingLoading}
                className={cn(
                  "flex items-center gap-2 px-3 py-1 lg:py-2 text-sm rounded-lg transition-all min-w-[140px]",
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
                    {(pricing?.providers || Object.keys(PROVIDERS))
                      .filter((providerId) => {
                        // Only show providers that support the selected operation and are not disabled
                        const provider = PROVIDERS[providerId];
                        if (provider?.disabled) return false;
                        // Check if provider supports this operation
                        const capabilities = PROVIDER_CAPABILITIES[providerId] || [];
                        if (!capabilities.includes(selectedOperation)) return false;
                        return true;
                      })
                      .map((providerId) => {
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
                            <div className="text-right">
                              <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
                                {cost} cr
                              </span>
                              <div className="text-[10px] text-gray-400 mt-0.5">${(cost * 0.10).toFixed(2)}</div>
                            </div>
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

            {/* Model Dropdown - only show for Flux in generate mode */}
            {isGenerateMode && selectedProvider === 'flux' && (
            <div className="relative" ref={modelDropdownRef}>
              <label className="block text-xs font-medium text-gray-500 mb-1">Model</label>
              <button
                onClick={() => setShowModelDropdown(!showModelDropdown)}
                disabled={isProcessing}
                className={cn(
                  "flex items-center gap-2 px-3 py-1 lg:py-2 text-sm rounded-lg transition-all min-w-[160px]",
                  "border border-gray-200 bg-white",
                  "hover:bg-gray-50",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                <span className="text-lg">{FLUX_MODELS.find(m => m.id === fluxModel)?.icon}</span>
                <span className="font-medium flex-1 text-left">{FLUX_MODELS.find(m => m.id === fluxModel)?.label}</span>
                <ChevronDown className={cn("w-4 h-4 transition-transform", showModelDropdown && "rotate-180")} />
              </button>

              {showModelDropdown && (
                <div className="absolute left-0 top-full mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden">
                  <div className="p-2 border-b border-gray-100 bg-gray-50">
                    <p className="text-xs font-medium text-gray-500">Select Model</p>
                  </div>
                  <div className="py-1">
                    {FLUX_MODELS.map((model) => (
                      <button
                        key={model.id}
                        onClick={() => {
                          setFluxModel(model.id);
                          setShowModelDropdown(false);
                        }}
                        className={cn(
                          "w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors",
                          fluxModel === model.id
                            ? "bg-purple-50"
                            : "hover:bg-gray-50"
                        )}
                      >
                        <span className="text-xl">{model.icon}</span>
                        <div className="flex-1">
                          <span className={cn(
                            "text-sm font-medium",
                            fluxModel === model.id ? "text-purple-600" : ""
                          )}>
                            {model.label}
                          </span>
                          <span className="text-xs text-gray-500 block">{model.description}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
                            {model.credits} cr
                          </span>
                        </div>
                        {fluxModel === model.id && (
                          <Check className="w-4 h-4 text-purple-600" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            )}

            {/* Operation Dropdown - hidden in generate mode until image is generated */}
            {!isGenerateMode && (
            <div className="relative" ref={operationDropdownRef}>
              <label className="block text-xs font-medium text-gray-500 mb-1">Operation</label>
              <button
                onClick={() => setShowOperationDropdown(!showOperationDropdown)}
                disabled={isProcessing}
                className={cn(
                  "flex items-center gap-2 px-3 lg:py-2 text-sm rounded-lg transition-all min-w-[180px]",
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
                            // Check if current provider supports this operation
                            const currentProviderSupports = pricing?.matrix?.[selectedProvider]?.[opId]?.credits !== undefined;
                            if (!currentProviderSupports) {
                              // Find a provider that supports this operation
                              const supportingProvider = (pricing?.providers || []).find(
                                pid => pricing?.matrix?.[pid]?.[opId]?.credits !== undefined
                              );
                              if (supportingProvider) {
                                setSelectedProvider(supportingProvider);
                              }
                            }
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
                            <div className="text-right">
                              <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
                                {cost} cr
                              </span>
                              <div className="text-[10px] text-gray-400 mt-0.5">${(cost * 0.10).toFixed(2)}</div>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            )}

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
                    {isGenerateMode
                      ? `${costPerImage} credits per generation`
                      : `${costPerImage} credits × ${imagesToProcess.length} image${imagesToProcess.length !== 1 ? 's' : ''}`
                    }
                  </div>
                  <div className="text-lg font-bold text-purple-600">
                    {totalCost?.toFixed(2)} credits
                  </div>
                  <div className="text-xs text-gray-400">
                    ${(totalCost * 0.10).toFixed(2)} USD
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {/* Operation-specific options */}
          {selectedOperation === 'stage' && (() => {
            const smartPresets = generateSmartPresets(productContext);
            return (
              <div className="mt-2 lg:mt-4 py-2 lg:pt-4 border-t">
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

                {/* Generic presets - only show if no smart presets */}
                {smartPresets.length === 0 && (
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
                )}
              </div>
            );
          })()}

          {selectedOperation === 'remove_bg' && (
            <div className="mt-2 lg:mt-4 py-2 lg:pt-4 border-t">
              <label className="text-xs font-medium text-gray-500 mb-2 block">Background Replacement</label>
              <div className="flex flex-wrap gap-2">
                {['transparent', 'white', 'black', 'gradient', 'custom'].map((bg) => (
                  <button
                    key={bg}
                    onClick={() => setBgReplacement(bg)}
                    disabled={isProcessing}
                    className={cn(
                      "px-3 py-1.5 text-xs rounded-lg transition-colors capitalize flex items-center gap-1.5",
                      bgReplacement === bg
                        ? "bg-purple-100 text-purple-700 border border-purple-300"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    )}
                  >
                    {bg === 'custom' && (
                      <span
                        className="w-3 h-3 rounded-full border border-gray-300"
                        style={{ backgroundColor: bgCustomColor }}
                      />
                    )}
                    {bg}
                  </button>
                ))}
              </div>
              {bgReplacement === 'custom' && (
                <div className="mt-3 flex items-center gap-3">
                  <label className="text-xs text-gray-500">Pick Color:</label>
                  <input
                    type="color"
                    value={bgCustomColor}
                    onChange={(e) => setBgCustomColor(e.target.value)}
                    disabled={isProcessing}
                    className="w-8 h-8 rounded cursor-pointer border border-gray-300"
                  />
                  <input
                    type="text"
                    value={bgCustomColor}
                    onChange={(e) => setBgCustomColor(e.target.value)}
                    disabled={isProcessing}
                    placeholder="#ffffff"
                    className="w-24 px-2 py-1 text-xs border rounded"
                  />
                </div>
              )}
            </div>
          )}

          {selectedOperation === 'upscale' && (
            <div className="mt-2 lg:mt-4 py-2 lg:pt-4 border-t">
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

          {selectedOperation === 'compress' && (
            <div className="mt-2 lg:mt-4 py-2 lg:pt-4 border-t">
              <label className="text-xs font-medium text-gray-500 mb-2 block">
                Quality: {compressQuality}%
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="10"
                  max="100"
                  step="5"
                  value={compressQuality}
                  onChange={(e) => setCompressQuality(parseInt(e.target.value))}
                  disabled={isProcessing}
                  className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                />
                <div className="flex gap-1">
                  {[50, 70, 80, 90].map((q) => (
                    <button
                      key={q}
                      onClick={() => setCompressQuality(q)}
                      disabled={isProcessing}
                      className={cn(
                        "px-2 py-1 text-xs rounded transition-colors",
                        compressQuality === q
                          ? "bg-purple-100 text-purple-700"
                          : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      )}
                    >
                      {q}%
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Lower quality = smaller file size. 80% is recommended for most images.
              </p>
            </div>
          )}

          {selectedOperation === 'convert' && (
            <div className="mt-2 lg:mt-4 py-2 lg:pt-4 border-t">
              <div className="flex gap-6">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-2 block">Output Format</label>
                  <div className="flex gap-2">
                    {[
                      { id: 'webp', label: 'WebP', desc: 'Best compression' },
                      { id: 'avif', label: 'AVIF', desc: 'Smallest size' },
                      { id: 'png', label: 'PNG', desc: 'Lossless' },
                      { id: 'jpeg', label: 'JPEG', desc: 'Universal' }
                    ].map((fmt) => (
                      <button
                        key={fmt.id}
                        onClick={() => setConvertFormat(fmt.id)}
                        disabled={isProcessing}
                        className={cn(
                          "px-3 py-2 text-xs rounded-lg transition-colors flex flex-col items-center min-w-[70px]",
                          convertFormat === fmt.id
                            ? "bg-purple-100 text-purple-700 border border-purple-300"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        )}
                      >
                        <span className="font-medium">{fmt.label}</span>
                        <span className="text-[10px] opacity-70">{fmt.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
                {(convertFormat === 'webp' || convertFormat === 'jpeg' || convertFormat === 'avif') && (
                  <div className="flex-1">
                    <label className="text-xs font-medium text-gray-500 mb-2 block">
                      Quality: {compressQuality}%
                    </label>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      step="5"
                      value={compressQuality}
                      onChange={(e) => setCompressQuality(parseInt(e.target.value))}
                      disabled={isProcessing}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {selectedOperation === 'custom' && (
            <div className="mt-2 lg:mt-4 py-2 lg:pt-4 border-t">
              <label className="text-xs font-medium text-gray-500 mb-2 block">Custom Instruction</label>
              <textarea
                value={stagingContext}
                onChange={(e) => setStagingContext(e.target.value)}
                placeholder="Describe what you want to do with this image (e.g., 'make the colors more vibrant', 'add a soft blur to the background', 'adjust lighting to look like sunset')"
                className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 min-h-[80px] resize-y"
                disabled={isProcessing}
              />
              <p className="text-xs text-gray-400 mt-2">
                Enter any image modification instruction. AI will interpret and apply your request.
              </p>
            </div>
          )}
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-auto py-2 px-6 lg:p-6">
          {isProcessing && !isGenerateMode && (
            <div className="mb-2 lg:mb-4 px-3 py-1 lg:p-3 bg-purple-50 rounded-lg">
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

          {/* Generate Mode - Chat on left, Preview on right */}
          {isGenerateMode ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
              {/* Left: Chat-style prompt area */}
              <div className="flex flex-col space-y-4">
                {/* Reference Product Image */}
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-2 block">Reference Product (Optional)</label>
                  {referenceImage ? (
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border">
                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-white border flex-shrink-0">
                        <img
                          src={referenceImage.url}
                          alt={referenceImage.name}
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-700 truncate">{referenceImage.name}</p>
                        <p className="text-xs text-gray-500">Selected as reference</p>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setShowFilePicker(true)}
                          className="p-1.5 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                          title="Change image"
                        >
                          <ImageIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setReferenceImage(null)}
                          className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Remove reference"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowFilePicker(true)}
                      className="w-full p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-purple-400 hover:bg-purple-50 transition-colors group"
                    >
                      <div className="flex flex-col items-center gap-2 text-gray-500 group-hover:text-purple-600">
                        <ImageIcon className="w-8 h-8" />
                        <span className="text-sm font-medium">Add product image</span>
                        <span className="text-xs text-gray-400">AI will incorporate your product into the generated image</span>
                      </div>
                    </button>
                  )}
                </div>

                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <ImagePlus className="w-4 h-4" />
                  Describe your image
                </h3>

                {/* Prompt Input */}
                <div className="flex-1 flex flex-col">
                  <textarea
                    value={generatePrompt}
                    onChange={(e) => setGeneratePrompt(e.target.value)}
                    placeholder="Describe the image you want to create...&#10;&#10;Example: A professional product photo of a sleek smartwatch on a white marble surface with soft shadows and elegant lighting"
                    className="w-full flex-1 min-h-[120px] px-4 py-3 text-sm border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
                    disabled={isProcessing}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.ctrlKey && !isProcessing) {
                        handleGenerate();
                      }
                    }}
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Press Ctrl+Enter to generate
                  </p>
                </div>

                {/* Style Selection */}
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-2 block">Style</label>
                  <div className="flex flex-wrap gap-2">
                    {GENERATION_STYLES.map((style) => (
                      <button
                        key={style.id}
                        onClick={() => setGenerateStyle(style.id)}
                        disabled={isProcessing}
                        className={cn(
                          "px-3 py-1.5 text-xs rounded-full transition-colors flex items-center gap-1.5",
                          generateStyle === style.id
                            ? "bg-purple-100 text-purple-700 border border-purple-300"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        )}
                      >
                        <span>{style.icon}</span>
                        {style.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Aspect Ratio Selection */}
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-2 block">Aspect Ratio</label>
                  <div className="flex flex-wrap gap-2">
                    {ASPECT_RATIOS.map((ar) => (
                      <button
                        key={ar.id}
                        onClick={() => setGenerateAspectRatio(ar.id)}
                        disabled={isProcessing}
                        className={cn(
                          "px-3 py-1.5 text-xs rounded-lg transition-colors flex items-center gap-2",
                          generateAspectRatio === ar.id
                            ? "bg-purple-100 text-purple-700 border border-purple-300"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        )}
                      >
                        <span className="font-medium">{ar.id}</span>
                        <span className="text-gray-400">({ar.label})</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Generation History */}
                {generationHistory.length > 0 && (
                  <div className="mt-4">
                    <label className="text-xs font-medium text-gray-500 mb-2 block">History</label>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {generationHistory.slice(0, 5).map((item) => (
                        <button
                          key={item.id}
                          onClick={() => {
                            setCurrentImage(item.image);
                            setCurrentFormat(item.format);
                          }}
                          className="w-full flex items-center gap-2 p-2 text-left bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <img
                            src={`data:image/${item.format};base64,${item.image}`}
                            alt=""
                            className="w-10 h-10 object-cover rounded"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-700 truncate">{item.prompt}</p>
                            <p className="text-[10px] text-gray-400">{item.style} - {item.aspectRatio}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Right: Preview area */}
              <div className="flex flex-col space-y-2">
                <h3 className="text-sm font-semibold text-gray-700">
                  {currentImage ? 'Generated Image' : 'Preview'}
                </h3>
                <div className={cn(
                  "flex-1 border rounded-lg overflow-hidden flex flex-col",
                  currentImage ? "border-green-300 bg-green-50" : "bg-gray-50"
                )}>
                  <div className="flex-1 min-h-[280px] flex items-center justify-center bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjZjBmMGYwIi8+PHJlY3QgeD0iMTAiIHk9IjEwIiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiNmMGYwZjAiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')]">
                    {isProcessing ? (
                      <div className="text-center">
                        <Loader2 className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-2" />
                        <p className="text-sm text-gray-600">Generating your image...</p>
                        <p className="text-xs text-gray-400 mt-1">This may take a few seconds</p>
                      </div>
                    ) : currentImage ? (
                      <img
                        src={`data:image/${currentFormat};base64,${currentImage}`}
                        alt="Generated"
                        className="max-w-full max-h-full object-contain"
                      />
                    ) : (
                      <div className="text-center text-gray-400">
                        <ImagePlus className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Your generated image will appear here</p>
                        <p className="text-xs mt-1">Enter a prompt and click Generate</p>
                      </div>
                    )}
                  </div>
                  {currentImage && (
                    <div className="p-2 text-xs border-t flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-green-600 flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          Generated
                        </span>
                        <span className="text-gray-400">{formatBytes(getBase64Size(currentImage))}</span>
                      </div>
                      <button
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = `data:image/${currentFormat};base64,${currentImage}`;
                          link.download = `generated-${Date.now()}.${currentFormat}`;
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
                  )}
                </div>
              </div>
            </div>
          ) : !isBulkMode ? (
            <div>
              <div className="grid grid-cols-2 gap-6">
                {/* Original Image */}
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-gray-700">Original</h3>
                  <div className="border rounded-lg overflow-hidden bg-gray-50">
                    <div className="h-64 md:h-72 flex items-center justify-center bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjZjBmMGYwIi8+PHJlY3QgeD0iMTAiIHk9IjEwIiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiNmMGYwZjAiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')]">
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
                    <div className="h-64 md:h-72 flex items-center justify-center bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjZjBmMGYwIi8+PHJlY3QgeD0iMTAiIHk9IjEwIiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiNmMGYwZjAiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')]">
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
              {/* Show save options for generated or optimized images */}
              {currentImage && !isGenerateMode && !isBulkMode && (
                <>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={applyToOriginal}
                      onChange={(e) => setApplyToOriginal(e.target.checked)}
                      className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                    />
                    <span className="text-gray-700">Replace original</span>
                  </label>

                  <Button
                    onClick={handleApply}
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
                        {applyToOriginal ? 'Replace Original' : 'Save as Copy'}
                      </>
                    )}
                  </Button>
                </>
              )}

              {/* Bulk mode save options */}
              {isBulkMode && results.filter(r => r.success).length > 0 && (
                <>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={applyToOriginal}
                      onChange={(e) => setApplyToOriginal(e.target.checked)}
                      className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                    />
                    <span className="text-gray-700">Replace originals</span>
                  </label>

                  <Button
                    onClick={handleApplyAll}
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
                        {(applyToOriginal ? 'Replace All' : 'Save Copies') + ` (${results.filter(r => r.success && !r.applied).length})`}
                      </>
                    )}
                  </Button>
                </>
              )}

              {/* Generate mode - Save to library button */}
              {isGenerateMode && currentImage && (
                <Button
                  onClick={handleApply}
                  disabled={isApplying || justSaved}
                  className={justSaved ? "bg-green-500" : "bg-green-600 hover:bg-green-700"}
                >
                  {isApplying ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : justSaved ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Saved!
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Save to Library
                    </>
                  )}
                </Button>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleOptimize}
                disabled={isProcessing || (!isGenerateMode && !isBulkMode && !singleFile) || (!isGenerateMode && isBulkMode && imagesToProcess.length === 0) || (isGenerateMode && !generatePrompt.trim())}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {isGenerateMode ? 'Generating...' : 'Processing...'}
                  </>
                ) : (
                  <>
                    {isGenerateMode ? (
                      <>
                        <ImagePlus className="w-4 h-4 mr-2" />
                        {currentImage ? 'Generate Again' : 'Generate'}
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-4 h-4 mr-2" />
                        {currentImage || results.length > 0 ? 'Run Again' : 'Optimize'}
                      </>
                    )}
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

      {/* File Picker Modal for selecting reference product image */}
      <FilePickerModal
        isOpen={showFilePicker}
        onClose={() => setShowFilePicker(false)}
        onSelect={(file) => {
          setReferenceImage(file);
          setShowFilePicker(false);
        }}
        fileType="image"
      />
    </div>,
    document.body
  );
};

export default ImageOptimizerModal;
