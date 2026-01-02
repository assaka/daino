/**
 * File utility functions for handling files, images, and storage paths
 *
 * Backend equivalent: backend/src/services/storage-interface.js generateOrganizedPath()
 */

/**
 * Placeholder image URL - single source of truth for missing product images
 */
export const PLACEHOLDER_IMAGE = '/placeholder-product.jpg';

/**
 * Generate organized directory path from filename
 * Uses first two characters for directory structure
 *
 * CANONICAL PATH FORMAT (used across entire application):
 * - Pattern: firstChar/secondChar/filename
 * - Example: "logo_red.png" -> "l/o/logo_red.png"
 *
 * Full paths when combined with folder:
 * - Products: product/images/l/o/logo_red.png
 * - Categories: category/images/c/a/category.png
 * - Library: library/l/o/logo.png
 *
 * @param {string} filename - Original filename (e.g., "logo_red.png")
 * @returns {string} Organized path (e.g., "l/o/logo_red.png")
 */
export const generateOrganizedPath = (filename) => {
  const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.')) || filename;
  const cleanName = nameWithoutExt.toLowerCase().replace(/[^a-z0-9]/g, '');

  if (cleanName.length >= 2) {
    return `${cleanName[0]}/${cleanName[1]}/${filename}`;
  } else if (cleanName.length === 1) {
    return `${cleanName[0]}/${cleanName[0]}/${filename}`;
  } else {
    return `misc/${filename}`;
  }
};

/**
 * Get the primary image URL from a product's images array
 * Images are stored as objects with url property and optional isPrimary flag
 * Returns PLACEHOLDER_IMAGE if no valid image found
 *
 * @param {Array} images - Array of image objects with url property
 * @param {boolean} usePlaceholder - Whether to return placeholder when no image (default: true)
 * @returns {string} - Primary image URL or placeholder
 */
export const getPrimaryImageUrl = (images, usePlaceholder = true) => {
  if (!images || !Array.isArray(images) || images.length === 0) {
    return usePlaceholder ? PLACEHOLDER_IMAGE : null;
  }

  // First try to find the primary image
  const primaryImage = images.find(img => img?.isPrimary);
  if (primaryImage?.url) {
    return primaryImage.url;
  }

  // Fall back to first image with URL
  const firstImageWithUrl = images.find(img => img?.url);
  return firstImageWithUrl?.url || (usePlaceholder ? PLACEHOLDER_IMAGE : null);
};

/**
 * Get image URL by index from images array
 * Returns PLACEHOLDER_IMAGE if index is out of bounds or no URL
 *
 * @param {Array} images - Array of image objects
 * @param {number} index - Index of the image to get
 * @param {boolean} usePlaceholder - Whether to return placeholder when no image (default: true)
 * @returns {string} - Image URL or placeholder
 */
export const getImageUrlByIndex = (images, index, usePlaceholder = true) => {
  if (!images || !Array.isArray(images) || images.length === 0 || index < 0 || index >= images.length) {
    return usePlaceholder ? PLACEHOLDER_IMAGE : null;
  }

  const image = images[index];
  return image?.url || (usePlaceholder ? PLACEHOLDER_IMAGE : null);
};

/**
 * Get all image URLs from an images array
 * @param {Array} images - Array of image objects
 * @returns {Array<string>} - Array of image URLs
 */
export const getAllImageUrls = (images) => {
  if (!images || !Array.isArray(images)) {
    return [];
  }

  return images
    .map(image => image?.url)
    .filter(Boolean);
};

/**
 * Get image alt text, with fallback to product name and index
 * @param {Object} image - Image object with optional alt property
 * @param {string} productName - Product name for fallback
 * @param {number} index - Image index for fallback
 * @returns {string} - Alt text for the image
 */
export const getImageAltText = (image, productName = 'Product', index = 0) => {
  // Use alt text if available
  if (image?.alt) {
    return image.alt;
  }

  // Fall back to product name and index
  return index === 0 ? productName : `${productName} ${index + 1}`;
};

/**
 * Check if product has any images
 * @param {Array} images - Array of image objects
 * @returns {boolean} - True if product has images
 */
export const hasImages = (images) => {
  return images && Array.isArray(images) && images.length > 0 && images[0]?.url;
};