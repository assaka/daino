/**
 * Flux Image Provider
 *
 * Uses Flux models via:
 * 1. Direct BFL API (api.bfl.ml) - Recommended, direct from Black Forest Labs
 * 2. Replicate
 * 3. fal.ai
 */

class FluxImageProvider {
  constructor(options = {}) {
    this.bflApiKey = options.bflApiKey;
    this.replicateToken = options.replicateToken;
    this.falApiKey = options.falApiKey;

    if (!this.bflApiKey && !this.replicateToken && !this.falApiKey) {
      throw new Error('BFL API key, Replicate token, or fal.ai API key is required');
    }

    this.name = 'flux';
    // Priority: BFL direct > Replicate > fal.ai
    this.useBFL = !!this.bflApiKey;
    this.useReplicate = !this.useBFL && !!this.replicateToken;
  }

  getDisplayName() {
    return 'Flux';
  }

  getIcon() {
    return '⚡';
  }

  getCapabilities() {
    return ['upscale', 'remove_bg', 'stage', 'convert', 'custom', 'generate'];
  }

  /**
   * Make request to Replicate API
   */
  async replicateRequest(model, input) {
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${this.replicateToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        version: model,
        input
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Replicate API error');
    }

    let prediction = await response.json();

    // Poll for completion
    while (prediction.status !== 'succeeded' && prediction.status !== 'failed') {
      await new Promise(resolve => setTimeout(resolve, 1000));

      const pollResponse = await fetch(prediction.urls.get, {
        headers: { 'Authorization': `Token ${this.replicateToken}` }
      });
      prediction = await pollResponse.json();
    }

    if (prediction.status === 'failed') {
      throw new Error(prediction.error || 'Prediction failed');
    }

    return prediction.output;
  }

  /**
   * Make request to fal.ai API
   */
  async falRequest(model, input) {
    const response = await fetch(`https://fal.run/${model}`, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${this.falApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(input)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'fal.ai API error');
    }

    return response.json();
  }

  /**
   * Make request to BFL API (api.bfl.ml)
   */
  async bflRequest(endpoint, input) {
    const response = await fetch(`https://api.bfl.ml/v1/${endpoint}`, {
      method: 'POST',
      headers: {
        'X-Key': this.bflApiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(input)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || error.message || 'BFL API error');
    }

    const result = await response.json();

    // BFL returns a task ID, poll for completion
    if (result.id) {
      return this.bflPollResult(result.id);
    }

    return result;
  }

  /**
   * Poll BFL API for task result
   */
  async bflPollResult(taskId) {
    const maxAttempts = 60; // 60 seconds max
    let attempts = 0;

    while (attempts < maxAttempts) {
      const response = await fetch(`https://api.bfl.ml/v1/get_result?id=${taskId}`, {
        headers: { 'X-Key': this.bflApiKey }
      });

      if (!response.ok) {
        throw new Error('Failed to get BFL result');
      }

      const result = await response.json();

      if (result.status === 'Ready') {
        return result.result;
      } else if (result.status === 'Error') {
        throw new Error(result.error || 'BFL task failed');
      }

      // Wait 1 second before polling again
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }

    throw new Error('BFL task timed out');
  }

  /**
   * Upscale and enhance image
   */
  async upscale(image, params = {}) {
    const { scale = 2 } = params;
    const imageUrl = await this.ensureUrl(image);

    if (this.useReplicate) {
      // Use Real-ESRGAN for upscaling
      const output = await this.replicateRequest(
        'nightmareai/real-esrgan:f121d640bd286e1fdc67f9799164c1d5be36ff74576ee11c803ae5b665dd46aa',
        {
          image: imageUrl,
          scale,
          face_enhance: false
        }
      );

      return {
        imageUrl: output,
        format: 'png',
        scale
      };
    } else {
      // Use fal.ai
      const result = await this.falRequest('fal-ai/creative-upscaler', {
        image_url: imageUrl,
        scale
      });

      return {
        imageUrl: result.image?.url,
        format: 'png',
        scale
      };
    }
  }

  /**
   * Remove background from image
   */
  async removeBackground(image, params = {}) {
    const imageUrl = await this.ensureUrl(image);

    if (this.useReplicate) {
      // Use rembg for background removal
      const output = await this.replicateRequest(
        'cjwbw/rembg:fb8af171cfa1616ddcf1242c093f9c46bcada5ad4cf6f2fbe8b81b330ec5c003',
        { image: imageUrl }
      );

      return {
        imageUrl: output,
        format: 'png',
        backgroundRemoved: true
      };
    } else {
      const result = await this.falRequest('fal-ai/birefnet', {
        image_url: imageUrl
      });

      return {
        imageUrl: result.image?.url,
        format: 'png',
        backgroundRemoved: true
      };
    }
  }

  /**
   * Stage product in context using Flux
   */
  async stage(image, params = {}) {
    const {
      context = 'modern living room',
      style = 'photorealistic',
      lighting = 'natural daylight'
    } = params;

    const imageUrl = await this.ensureUrl(image);

    const prompt = `A ${style} photo of this product placed naturally in a ${context}. ${lighting} lighting. The product should have realistic shadows and reflections, looking like it belongs in the scene.`;

    if (this.useReplicate) {
      // Use Flux Canny for image-guided generation
      const output = await this.replicateRequest(
        'xlabs-ai/flux-dev-controlnet:4312e0fe97b5ed7d54bd2e0dcafe76c7eb8057bc6b6f0d8bd22644fe40a76c1d',
        {
          image: imageUrl,
          prompt,
          num_inference_steps: 28,
          guidance_scale: 3.5,
          controlnet_conditioning_scale: 0.6
        }
      );

      return {
        imageUrl: Array.isArray(output) ? output[0] : output,
        format: 'png',
        context,
        style
      };
    } else {
      const result = await this.falRequest('fal-ai/flux-pro/v1.1', {
        image_url: imageUrl,
        prompt,
        num_inference_steps: 28,
        guidance_scale: 3.5
      });

      return {
        imageUrl: result.images?.[0]?.url,
        format: 'png',
        context,
        style
      };
    }
  }

  /**
   * Convert image format (via re-encoding)
   */
  async convert(image, params = {}) {
    const { targetFormat = 'webp' } = params;

    // For Flux, we'll just return the image URL
    // Actual format conversion should be done server-side
    const imageUrl = await this.ensureUrl(image);

    return {
      imageUrl,
      format: 'png',
      requestedFormat: targetFormat
    };
  }

  /**
   * Custom image modification based on user instruction
   */
  async custom(image, params = {}) {
    const { instruction = 'Enhance this image' } = params;
    const imageUrl = await this.ensureUrl(image);

    if (this.useReplicate) {
      // Use Flux ControlNet for image-guided generation with custom prompt
      const output = await this.replicateRequest(
        'xlabs-ai/flux-dev-controlnet:4312e0fe97b5ed7d54bd2e0dcafe76c7eb8057bc6b6f0d8bd22644fe40a76c1d',
        {
          image: imageUrl,
          prompt: instruction,
          num_inference_steps: 28,
          guidance_scale: 3.5,
          controlnet_conditioning_scale: 0.6
        }
      );

      return {
        imageUrl: Array.isArray(output) ? output[0] : output,
        format: 'png',
        instruction
      };
    } else {
      const result = await this.falRequest('fal-ai/flux-pro/v1.1', {
        image_url: imageUrl,
        prompt: instruction,
        num_inference_steps: 28,
        guidance_scale: 3.5
      });

      return {
        imageUrl: result.images?.[0]?.url,
        format: 'png',
        instruction
      };
    }
  }

  /**
   * Generate new image from text prompt
   * Supports optional reference image for product-based generation
   */
  async generate(params = {}) {
    const {
      prompt = 'A beautiful product photo',
      style = 'photorealistic',
      aspectRatio = '1:1',
      numImages = 1,
      referenceImageUrl = null
    } = params;

    // Map aspect ratios to dimensions
    const aspectRatioMap = {
      '1:1': { width: 1024, height: 1024 },
      '16:9': { width: 1344, height: 768 },
      '9:16': { width: 768, height: 1344 },
      '4:3': { width: 1152, height: 896 },
      '3:4': { width: 896, height: 1152 },
      '3:2': { width: 1216, height: 832 },
      '2:3': { width: 832, height: 1216 }
    };

    const dimensions = aspectRatioMap[aspectRatio] || aspectRatioMap['1:1'];

    // Build enhanced prompt with style
    const stylePrompts = {
      photorealistic: 'highly detailed professional photograph, realistic lighting, sharp focus, 8k resolution',
      artistic: 'artistic style, creative composition, vibrant colors, expressive brushstrokes',
      illustration: 'digital illustration, clean lines, detailed artwork, professional quality',
      'product-photo': 'professional product photography, clean white background, studio lighting, commercial quality',
      'lifestyle': 'lifestyle photography, natural setting, warm lighting, authentic feel',
      'minimalist': 'minimalist style, clean design, simple composition, elegant',
      'cinematic': 'cinematic lighting, dramatic atmosphere, movie still quality, professional cinematography'
    };

    // When reference image is provided, enhance prompt to incorporate the product
    let enhancedPrompt = prompt;
    if (referenceImageUrl) {
      // For product placement, be very specific about maintaining the exact product
      enhancedPrompt = `${prompt}. The exact product from the reference image must be clearly visible and prominently featured. ${stylePrompts[style] || stylePrompts.photorealistic}`;
    } else {
      enhancedPrompt = `${prompt}. ${stylePrompts[style] || stylePrompts.photorealistic}`;
    }

    // Use BFL direct API (recommended)
    if (this.useBFL) {
      const bflParams = {
        prompt: enhancedPrompt,
        width: dimensions.width,
        height: dimensions.height
      };

      // Use flux-pro-1.1 for best quality, or flux-dev for cost savings
      const endpoint = referenceImageUrl ? 'flux-pro-1.1' : 'flux-pro-1.1';

      if (referenceImageUrl) {
        bflParams.image_url = referenceImageUrl;
        bflParams.strength = 0.7; // Balance between prompt and reference
      }

      const result = await this.bflRequest(endpoint, bflParams);

      // BFL returns { sample: "url" }
      const imageUrl = result.sample;
      const base64 = await this.urlToBase64(imageUrl);

      return {
        image: base64,
        imageUrl,
        format: 'png',
        prompt: enhancedPrompt,
        style,
        aspectRatio,
        dimensions,
        usedReference: !!referenceImageUrl
      };
    }

    if (this.useReplicate) {
      let output;

      if (referenceImageUrl) {
        // Try Flux Fill (inpainting) for better product placement
        // This model better preserves the reference image content
        try {
          output = await this.replicateRequest(
            'black-forest-labs/flux-fill-dev',
            {
              prompt: enhancedPrompt,
              image: referenceImageUrl,
              num_outputs: numImages,
              output_format: 'png',
              output_quality: 100,
              guidance: 3.5 // Lower guidance keeps more of original image
            }
          );
        } catch (fillError) {
          console.log('[FluxProvider] Fill failed, trying Flux Dev img2img:', fillError.message);

          // Try Flux Dev with image-to-image
          try {
            output = await this.replicateRequest(
              'black-forest-labs/flux-dev',
              {
                prompt: enhancedPrompt,
                image: referenceImageUrl,
                num_outputs: numImages,
                aspect_ratio: aspectRatio,
                output_format: 'png',
                output_quality: 100,
                prompt_strength: 0.6, // Lower = more of original image preserved
                num_inference_steps: 28
              }
            );
          } catch (devError) {
            console.log('[FluxProvider] Dev img2img failed, using Schnell:', devError.message);
            // Final fallback to standard generation
            output = await this.replicateRequest(
              'black-forest-labs/flux-schnell',
              {
                prompt: enhancedPrompt,
                num_outputs: numImages,
                aspect_ratio: aspectRatio,
                output_format: 'png',
                output_quality: 100
              }
            );
          }
        }
      } else {
        // Standard text-to-image generation
        output = await this.replicateRequest(
          'black-forest-labs/flux-schnell',
          {
            prompt: enhancedPrompt,
            num_outputs: numImages,
            aspect_ratio: aspectRatio,
            output_format: 'png',
            output_quality: 100
          }
        );
      }

      // Convert URL to base64
      const imageUrl = Array.isArray(output) ? output[0] : output;
      const base64 = await this.urlToBase64(imageUrl);

      return {
        image: base64,
        imageUrl,
        format: 'png',
        prompt: enhancedPrompt,
        style,
        aspectRatio,
        dimensions,
        usedReference: !!referenceImageUrl
      };
    } else {
      // Use fal.ai Flux
      const requestParams = {
        prompt: enhancedPrompt,
        image_size: dimensions,
        num_images: numImages,
        enable_safety_checker: true
      };

      // Add reference image for fal.ai if provided
      if (referenceImageUrl) {
        requestParams.image_url = referenceImageUrl;
        requestParams.strength = 0.8; // Balance between prompt and reference
      }

      const result = await this.falRequest(
        referenceImageUrl ? 'fal-ai/flux/dev/image-to-image' : 'fal-ai/flux/schnell',
        requestParams
      );

      const imageUrl = result.images?.[0]?.url;
      const base64 = await this.urlToBase64(imageUrl);

      return {
        image: base64,
        imageUrl,
        format: 'png',
        prompt: enhancedPrompt,
        style,
        aspectRatio,
        dimensions,
        usedReference: !!referenceImageUrl
      };
    }
  }

  /**
   * Convert URL to base64
   */
  async urlToBase64(url) {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return buffer.toString('base64');
  }

  /**
   * Ensure image is a URL (upload if needed)
   */
  async ensureUrl(image) {
    if (typeof image === 'string' && image.startsWith('http')) {
      return image;
    }

    // For base64 or buffer, we need to upload to a temporary host
    // Using tmpfiles.org for temporary storage
    let base64Data;

    if (typeof image === 'string' && image.startsWith('data:')) {
      base64Data = image.split(',')[1];
    } else if (Buffer.isBuffer(image)) {
      base64Data = image.toString('base64');
    } else {
      base64Data = image;
    }

    // Upload to temporary file host
    const formData = new FormData();
    const blob = new Blob([Buffer.from(base64Data, 'base64')], { type: 'image/png' });
    formData.append('file', blob, 'image.png');

    const response = await fetch('https://tmpfiles.org/api/v1/upload', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error('Failed to upload temporary image');
    }

    const result = await response.json();
    // Convert tmpfiles.org URL to direct link
    return result.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
  }
}

module.exports = FluxImageProvider;
