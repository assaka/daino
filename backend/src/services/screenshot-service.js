const axios = require('axios');
const crypto = require('crypto');

/**
 * Screenshot Service
 * Captures screenshots of web pages for heatmap visualization
 * Uses the same PDF microservice (with Puppeteer)
 */

/**
 * Capture screenshot from URL using the render microservice
 */
const captureScreenshot = async (url, options = {}) => {
  const pdfServiceUrl = process.env.PDF_SERVICE_URL || 'http://localhost:3001';

  console.log(`📸 Calling screenshot microservice at: ${pdfServiceUrl}`);
  console.log(`📸 URL to capture: ${url}`);
  console.log(`📸 Options:`, options);

  try {
    const startTime = Date.now();
    const response = await axios.post(`${pdfServiceUrl}/capture-screenshot`, {
      url,
      options: {
        viewportWidth: options.viewportWidth || 1920,
        viewportHeight: options.viewportHeight || 1080,
        fullPage: options.fullPage !== false,
        format: options.format || 'png',
        waitTime: options.waitTime || 3000, // Wait 3 seconds after page load for rendering
        deviceScaleFactor: options.deviceScaleFactor || 1
      }
    }, {
      timeout: 120000 // 2 minute timeout to handle slow pages
    });

    const duration = Date.now() - startTime;
    console.log(`📸 Screenshot request took ${duration}ms`);

    if (!response.data.success) {
      console.error(`❌ Screenshot capture failed:`, response.data);
      throw new Error(response.data.error || 'Screenshot capture failed');
    }

    // Convert base64 back to Buffer
    const screenshotBuffer = Buffer.from(response.data.screenshot, 'base64');
    console.log(`✅ Screenshot received from microservice: ${screenshotBuffer.length} bytes`);

    return {
      buffer: screenshotBuffer,
      format: response.data.format,
      viewport: response.data.viewport,
      size: response.data.size
    };
  } catch (error) {
    console.error('❌ Screenshot microservice error:', error.message);
    throw new Error(`Screenshot capture failed: ${error.message}`);
  }
};

/**
 * Generate a cache key for a screenshot based on URL and viewport
 */
const generateCacheKey = (url, viewportWidth, viewportHeight) => {
  const hash = crypto
    .createHash('md5')
    .update(`${url}:${viewportWidth}:${viewportHeight}`)
    .digest('hex');
  return `screenshot_${hash}`;
};

/**
 * Check if URL is accessible and safe to screenshot
 */
const validateUrl = (url) => {
  try {
    const parsedUrl = new URL(url);

    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return {
        valid: false,
        error: 'Only HTTP and HTTPS URLs are supported'
      };
    }

    // Block localhost and private IP ranges in production
    if (process.env.NODE_ENV === 'production') {
      const hostname = parsedUrl.hostname.toLowerCase();

      // Block localhost
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return {
          valid: false,
          error: 'Cannot screenshot localhost URLs'
        };
      }

      // Block private IP ranges (basic check)
      if (
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('172.')
      ) {
        return {
          valid: false,
          error: 'Cannot screenshot private network URLs'
        };
      }
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: 'Invalid URL format'
    };
  }
};

class ScreenshotService {
  constructor() {
    this.cache = new Map(); // Simple in-memory cache
    this.cacheExpiry = 1000 * 60 * 60; // 1 hour cache
  }

  /**
   * Get or capture a screenshot for a given URL
   */
  async getScreenshot(url, options = {}) {
    // Validate URL
    const validation = validateUrl(url);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const cacheKey = generateCacheKey(
      url,
      options.viewportWidth || 1920,
      options.viewportHeight || 1080
    );

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      console.log(`✅ Screenshot cache hit for: ${url}`);
      return cached.data;
    }

    // Capture new screenshot
    console.log(`📸 Capturing new screenshot for: ${url}`);
    const screenshot = await captureScreenshot(url, options);

    // Store in cache
    this.cache.set(cacheKey, {
      data: screenshot,
      timestamp: Date.now()
    });

    // Clean up old cache entries
    this.cleanCache();

    return screenshot;
  }

  /**
   * Clean up expired cache entries
   */
  cleanCache() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.cacheExpiry) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cached screenshots
   */
  clearCache() {
    this.cache.clear();
    console.log('📸 Screenshot cache cleared');
  }

  /**
   * Get cache stats
   */
  getCacheStats() {
    const entries = Array.from(this.cache.values());
    const totalSize = entries.reduce((sum, entry) => sum + (entry.data.size || 0), 0);

    return {
      entries: this.cache.size,
      totalSize,
      totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2)
    };
  }
}

module.exports = new ScreenshotService();
