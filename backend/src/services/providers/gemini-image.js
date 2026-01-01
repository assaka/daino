/**
 * Gemini Image Provider
 *
 * Uses Gemini 2.0 Flash for image operations via REST API
 * Native image generation with responseModalities
 */

class GeminiImageProvider {
  constructor(apiKey) {
    if (!apiKey) {
      throw new Error('Google AI API key is required');
    }
    this.apiKey = apiKey;
    this.name = 'gemini';
    // Model that supports image generation
    this.modelName = 'gemini-2.0-flash-exp';
  }

  getDisplayName() {
    return 'Gemini';
  }

  getIcon() {
    return '✨';
  }

  getCapabilities() {
    return ['compress', 'upscale', 'remove_bg', 'stage', 'convert'];
  }

  /**
   * Make API request to Gemini with image output
   */
  async generateWithImage(imageData, prompt) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${this.apiKey}`;

    const requestBody = {
      contents: [{
        parts: [
          {
            inline_data: {
              mime_type: imageData.mimeType,
              data: imageData.data
            }
          },
          {
            text: prompt
          }
        ]
      }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE']
      }
    };

    console.log('[Gemini] Making request to:', this.modelName);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Gemini] API Error:', response.status, errorText);
      throw new Error(`Gemini API error: ${response.status} - ${errorText.slice(0, 200)}`);
    }

    const result = await response.json();
    return this.extractImage(result);
  }

  /**
   * Extract image from response
   */
  extractImage(response) {
    // Check various possible response structures
    const candidates = response.candidates || [];

    for (const candidate of candidates) {
      const parts = candidate.content?.parts || [];
      for (const part of parts) {
        // Check for inlineData (base64 image)
        if (part.inlineData?.data) {
          console.log('[Gemini] Found inlineData image');
          return {
            data: part.inlineData.data,
            mimeType: part.inlineData.mimeType || 'image/png'
          };
        }
        // Check for inline_data (alternative format)
        if (part.inline_data?.data) {
          console.log('[Gemini] Found inline_data image');
          return {
            data: part.inline_data.data,
            mimeType: part.inline_data.mime_type || 'image/png'
          };
        }
      }
    }

    // Log response for debugging
    console.error('[Gemini] No image in response. Structure:', JSON.stringify(response, null, 2).slice(0, 2000));

    // Check if there's text response explaining why no image
    const textPart = candidates[0]?.content?.parts?.find(p => p.text);
    if (textPart) {
      console.error('[Gemini] Text response:', textPart.text);
      throw new Error(`Gemini returned text instead of image: ${textPart.text.slice(0, 100)}`);
    }

    return null;
  }

  /**
   * Compress image while maintaining quality
   */
  async compress(image, params = {}) {
    const { quality = 'high' } = params;
    const imageData = await this.prepareImage(image);
    const prompt = `Optimize this image for web use while maintaining visual quality. Quality level: ${quality}. Generate the optimized version of this image.`;

    const imageResult = await this.generateWithImage(imageData, prompt);
    if (!imageResult) {
      throw new Error('No image returned from Gemini');
    }

    return {
      image: imageResult.data,
      format: imageResult.mimeType.split('/')[1] || 'png',
      optimized: true
    };
  }

  /**
   * Upscale and enhance image
   */
  async upscale(image, params = {}) {
    const { scale = 2, enhanceDetails = true } = params;
    const imageData = await this.prepareImage(image);
    const prompt = `Upscale this image by ${scale}x. ${enhanceDetails ? 'Enhance fine details and sharpness.' : 'Maintain original appearance.'} Generate the enhanced version of this image.`;

    const imageResult = await this.generateWithImage(imageData, prompt);
    if (!imageResult) {
      throw new Error('No image returned from Gemini');
    }

    return {
      image: imageResult.data,
      format: imageResult.mimeType.split('/')[1] || 'png',
      scale
    };
  }

  /**
   * Remove background from image
   */
  async removeBackground(image, params = {}) {
    const { replacement = 'transparent' } = params;
    const imageData = await this.prepareImage(image);

    let prompt = 'Remove the background from this image completely. Keep only the main subject with clean, crisp edges. Generate the image with background removed.';
    if (replacement !== 'transparent') {
      prompt = `Remove the background from this image and replace it with a ${replacement} background. Keep the main subject with clean edges. Generate the result.`;
    }

    const imageResult = await this.generateWithImage(imageData, prompt);
    if (!imageResult) {
      throw new Error('No image returned from Gemini');
    }

    return {
      image: imageResult.data,
      format: imageResult.mimeType.split('/')[1] || 'png',
      backgroundRemoved: true,
      replacement
    };
  }

  /**
   * Stage product in context
   */
  async stage(image, params = {}) {
    const {
      context = 'modern living room',
      style = 'photorealistic',
      lighting = 'natural daylight'
    } = params;

    const imageData = await this.prepareImage(image);
    const prompt = `Place this product naturally in a ${context}. Style: ${style}. Lighting: ${lighting}. Create realistic shadows and reflections. Maintain the product's original appearance. Generate the staged product image.`;

    const imageResult = await this.generateWithImage(imageData, prompt);
    if (!imageResult) {
      throw new Error('No image returned from Gemini');
    }

    return {
      image: imageResult.data,
      format: imageResult.mimeType.split('/')[1] || 'png',
      context,
      style
    };
  }

  /**
   * Convert image format
   */
  async convert(image, params = {}) {
    const { targetFormat = 'webp', quality = 85 } = params;
    const imageData = await this.prepareImage(image);
    const prompt = 'Reproduce this image exactly as it appears. Generate an identical copy of this image.';

    const imageResult = await this.generateWithImage(imageData, prompt);
    if (!imageResult) {
      throw new Error('No image returned from Gemini');
    }

    return {
      image: imageResult.data,
      format: imageResult.mimeType.split('/')[1] || 'png',
      requestedFormat: targetFormat,
      quality
    };
  }

  /**
   * Prepare image for API
   */
  async prepareImage(image) {
    let data, mimeType = 'image/png';

    if (typeof image === 'string') {
      if (image.startsWith('data:')) {
        // Extract mime type and base64 data
        const matches = image.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
          mimeType = matches[1];
          data = matches[2];
        } else {
          data = image.split(',')[1];
        }
      } else if (image.startsWith('http')) {
        // Fetch URL
        const response = await fetch(image);
        const contentType = response.headers.get('content-type');
        if (contentType) mimeType = contentType;
        const arrayBuffer = await response.arrayBuffer();
        data = Buffer.from(arrayBuffer).toString('base64');
      } else {
        // Assume it's already base64
        data = image;
      }
    } else if (Buffer.isBuffer(image)) {
      data = image.toString('base64');
    }

    return { data, mimeType };
  }
}

module.exports = GeminiImageProvider;
