/**
 * Gemini Image Provider
 *
 * Uses Gemini 2.0 Flash and Imagen 3 for image operations
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiImageProvider {
  constructor(apiKey) {
    if (!apiKey) {
      throw new Error('Google AI API key is required');
    }
    this.client = new GoogleGenerativeAI(apiKey);
    this.apiKey = apiKey;
    this.name = 'gemini';
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
   * Get Gemini model for image tasks
   */
  getModel() {
    return this.client.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        responseModalities: ['Text', 'Image']
      }
    });
  }

  /**
   * Compress image while maintaining quality
   */
  async compress(image, params = {}) {
    const { quality = 'high' } = params;

    const model = this.getModel();
    const imageData = await this.prepareImage(image);

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: imageData.mimeType,
          data: imageData.data
        }
      },
      `Optimize this image for web use while maintaining visual quality. Quality level: ${quality}. Output the optimized image.`
    ]);

    const response = result.response;
    const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);

    if (!imagePart) {
      throw new Error('No image returned from Gemini');
    }

    return {
      image: imagePart.inlineData.data,
      format: imagePart.inlineData.mimeType.split('/')[1] || 'png',
      optimized: true
    };
  }

  /**
   * Upscale and enhance image
   */
  async upscale(image, params = {}) {
    const { scale = 2, enhanceDetails = true } = params;

    const model = this.getModel();
    const imageData = await this.prepareImage(image);

    const prompt = `Upscale this image by ${scale}x. ${enhanceDetails ? 'Enhance fine details and sharpness.' : 'Maintain original appearance.'} Output the enhanced image.`;

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: imageData.mimeType,
          data: imageData.data
        }
      },
      prompt
    ]);

    const response = result.response;
    const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);

    if (!imagePart) {
      throw new Error('No image returned from Gemini');
    }

    return {
      image: imagePart.inlineData.data,
      format: imagePart.inlineData.mimeType.split('/')[1] || 'png',
      scale
    };
  }

  /**
   * Remove background from image
   */
  async removeBackground(image, params = {}) {
    const { replacement = 'transparent' } = params;

    const model = this.getModel();
    const imageData = await this.prepareImage(image);

    let prompt = 'Remove the background from this image. Keep only the main subject with clean edges.';
    if (replacement !== 'transparent') {
      prompt = `Remove the background and replace it with ${replacement}. Keep the subject with clean edges.`;
    }
    prompt += ' Output the result as an image.';

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: imageData.mimeType,
          data: imageData.data
        }
      },
      prompt
    ]);

    const response = result.response;
    const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);

    if (!imagePart) {
      throw new Error('No image returned from Gemini');
    }

    return {
      image: imagePart.inlineData.data,
      format: imagePart.inlineData.mimeType.split('/')[1] || 'png',
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

    const model = this.getModel();
    const imageData = await this.prepareImage(image);

    const prompt = `Place this product naturally in a ${context}. Style: ${style}. Lighting: ${lighting}. Create realistic shadows and reflections. Maintain the product's original appearance. Output as an image.`;

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: imageData.mimeType,
          data: imageData.data
        }
      },
      prompt
    ]);

    const response = result.response;
    const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);

    if (!imagePart) {
      throw new Error('No image returned from Gemini');
    }

    return {
      image: imagePart.inlineData.data,
      format: imagePart.inlineData.mimeType.split('/')[1] || 'png',
      context,
      style
    };
  }

  /**
   * Convert image format
   */
  async convert(image, params = {}) {
    const { targetFormat = 'webp', quality = 85 } = params;

    const model = this.getModel();
    const imageData = await this.prepareImage(image);

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: imageData.mimeType,
          data: imageData.data
        }
      },
      'Reproduce this image exactly. Output as an image.'
    ]);

    const response = result.response;
    const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);

    if (!imagePart) {
      throw new Error('No image returned from Gemini');
    }

    return {
      image: imagePart.inlineData.data,
      format: imagePart.inlineData.mimeType.split('/')[1] || 'png',
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
