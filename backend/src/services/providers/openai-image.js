/**
 * OpenAI Image Provider
 *
 * Uses GPT-Image-1 (gpt-4o) and DALL-E 3 for image operations
 * - Edit/Inpainting: GPT-Image-1
 * - Generation: DALL-E 3
 */

const OpenAI = require('openai');
const { toFile } = require('openai');

class OpenAIImageProvider {
  constructor(apiKey) {
    if (!apiKey) {
      throw new Error('OpenAI API key is required');
    }
    this.client = new OpenAI({ apiKey });
    this.name = 'openai';
  }

  getDisplayName() {
    return 'OpenAI';
  }

  getIcon() {
    return '🤖';
  }

  getCapabilities() {
    return ['compress', 'upscale', 'remove_bg', 'stage', 'convert'];
  }

  /**
   * Compress image while maintaining quality
   */
  async compress(image, params = {}) {
    const { quality = 'high' } = params;

    // Use GPT-4o vision to analyze and regenerate at optimal quality
    const response = await this.client.images.edit({
      model: 'gpt-image-1',
      image: await this.prepareImage(image),
      prompt: `Optimize this image for web use. Maintain visual quality while reducing file size. Quality level: ${quality}`,
      size: params.size || '1024x1024'
    });

    // gpt-image-1 returns URL by default, need to fetch and convert to base64
    const imageUrl = response.data[0].url;
    const imageData = await this.urlToBase64(imageUrl);

    return {
      image: imageData,
      format: 'png',
      optimized: true
    };
  }

  /**
   * Upscale and enhance image
   */
  async upscale(image, params = {}) {
    const { scale = 2, enhanceDetails = true } = params;

    // Calculate target size
    const sizes = {
      1: '1024x1024',
      2: '1792x1024',
      4: '1792x1024' // Max supported
    };

    const response = await this.client.images.edit({
      model: 'gpt-image-1',
      image: await this.prepareImage(image),
      prompt: `Upscale this image to higher resolution. ${enhanceDetails ? 'Enhance fine details, textures, and sharpness.' : 'Maintain original appearance.'} Remove any artifacts or noise.`,
      size: sizes[scale] || '1792x1024'
    });

    const imageUrl = response.data[0].url;
    const imageData = await this.urlToBase64(imageUrl);

    return {
      image: imageData,
      format: 'png',
      scale
    };
  }

  /**
   * Remove background from image
   */
  async removeBackground(image, params = {}) {
    const { replacement = 'transparent' } = params;

    let prompt = 'Remove the background from this image completely. Keep only the main subject with crisp, clean edges.';

    if (replacement !== 'transparent') {
      prompt = `Remove the background from this image and replace it with ${replacement}. Keep the main subject with clean edges.`;
    }

    const response = await this.client.images.edit({
      model: 'gpt-image-1',
      image: await this.prepareImage(image),
      prompt,
      size: params.size || '1024x1024'
    });

    const imageUrl = response.data[0].url;
    const imageData = await this.urlToBase64(imageUrl);

    return {
      image: imageData,
      format: 'png',
      backgroundRemoved: true,
      replacement
    };
  }

  /**
   * Stage product in context (room, model, environment)
   */
  async stage(image, params = {}) {
    const {
      context = 'modern living room',
      style = 'photorealistic',
      lighting = 'natural daylight'
    } = params;

    const prompt = `Place this product naturally in a ${context}. Style: ${style}. Lighting: ${lighting}. The product should look like it belongs in the scene, with realistic shadows and reflections. Maintain the product's original appearance and details.`;

    const response = await this.client.images.edit({
      model: 'gpt-image-1',
      image: await this.prepareImage(image),
      prompt,
      size: params.size || '1792x1024'
    });

    const imageUrl = response.data[0].url;
    const imageData = await this.urlToBase64(imageUrl);

    return {
      image: imageData,
      format: 'png',
      context,
      style
    };
  }

  /**
   * Convert image format
   */
  async convert(image, params = {}) {
    const { targetFormat = 'webp', quality = 85 } = params;

    // For format conversion, we regenerate the image
    const response = await this.client.images.edit({
      model: 'gpt-image-1',
      image: await this.prepareImage(image),
      prompt: 'Reproduce this image exactly as it is, maintaining all details, colors, and composition.',
      size: params.size || '1024x1024'
    });

    const imageUrl = response.data[0].url;
    const imageData = await this.urlToBase64(imageUrl);

    // Note: OpenAI returns PNG, conversion to target format should be done server-side
    return {
      image: imageData,
      format: 'png', // Will need server-side conversion to targetFormat
      requestedFormat: targetFormat,
      quality
    };
  }

  /**
   * Prepare image for API (convert URL/base64 to proper format)
   */
  async prepareImage(image) {
    let buffer;
    let mimeType = 'image/png';

    if (typeof image === 'string') {
      if (image.startsWith('data:')) {
        // Base64 data URL - extract the base64 part and mime type
        const matches = image.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
          mimeType = matches[1];
          buffer = Buffer.from(matches[2], 'base64');
        } else {
          const base64Data = image.split(',')[1];
          buffer = Buffer.from(base64Data, 'base64');
        }
      } else if (image.startsWith('http')) {
        // URL - fetch and convert to buffer
        const response = await fetch(image);
        const contentType = response.headers.get('content-type');
        if (contentType) mimeType = contentType;
        const arrayBuffer = await response.arrayBuffer();
        buffer = Buffer.from(arrayBuffer);
      } else {
        buffer = image;
      }
    } else {
      buffer = image; // Already a buffer
    }

    // Use OpenAI's toFile helper to properly format the image
    const ext = mimeType.includes('png') ? 'png' : mimeType.includes('jpeg') || mimeType.includes('jpg') ? 'jpg' : 'png';
    return await toFile(buffer, `image.${ext}`, { type: mimeType });
  }

  /**
   * Convert image URL to base64
   */
  async urlToBase64(url) {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return buffer.toString('base64');
  }
}

module.exports = OpenAIImageProvider;
