/**
 * Unified Storage Path Utility
 * Provides consistent file path generation across all storage operations
 * Implements hierarchical directory structure: /product/images/[first]/[second]/filename.ext
 */
class StoragePathUtility {
  /**
   * Generate storage path for a file using organized directory structure
   * @param {string} filename - Original filename (without any prefixes)
   * @param {string} type - Type of file ('product', 'category', 'library')
   * @param {Object} options - Additional options
   * @returns {Object} Path information
   */
  static generatePath(filename, type = 'product', options = {}) {
    // Clean the filename first (remove any prefixes like 'akeneo_')
    const cleanFilename = this.cleanFilename(filename);
    
    // Generate the path based on type
    let path;
    switch (type) {
      case 'product':
        path = this.generateProductPath(cleanFilename, options);
        break;
      case 'category':
        path = this.generateCategoryPath(cleanFilename, options);
        break;
      case 'library':
        path = this.generateLibraryPath(cleanFilename, options);
        break;
      default:
        path = this.generateDefaultPath(cleanFilename, options);
    }
    
    return {
      fullPath: path,
      filename: cleanFilename,
      directory: path.substring(0, path.lastIndexOf('/')),
      type: type
    };
  }
  
  /**
   * Clean filename by removing prefixes and ensuring valid characters
   * @param {string} filename - Original filename
   * @returns {string} Cleaned filename
   */
  static cleanFilename(filename) {
    if (!filename) return '';
    
    // Remove akeneo_ prefix if present
    let cleaned = filename.replace(/^akeneo_/i, '');
    
    // Remove any other common prefixes
    cleaned = cleaned.replace(/^import_/i, '');
    cleaned = cleaned.replace(/^temp_/i, '');
    
    // Ensure filename is safe (remove special characters except for dots and hyphens)
    cleaned = cleaned.replace(/[^a-zA-Z0-9._-]/g, '_');
    
    // Remove multiple underscores
    cleaned = cleaned.replace(/_+/g, '_');
    
    // Remove leading/trailing underscores
    cleaned = cleaned.replace(/^_+|_+$/g, '');
    
    // Ensure we have a filename
    if (!cleaned) {
      cleaned = 'file_' + Date.now();
    }
    
    return cleaned.toLowerCase();
  }
  
  /**
   * Generate product image path using unified directory structure
   * /product/images/[first]/[second]/filename.ext
   * @param {string} filename - Cleaned filename
   * @param {Object} options - Additional options
   * @returns {string} Full path
   */
  static generateProductPath(filename, options = {}) {
    // Get first two characters for directory structure
    const firstChar = this.getFirstChar(filename);
    const secondChar = this.getSecondChar(filename);
    
    // Build the path: /product/images/[first]/[second]/filename
    const basePath = 'product';
    const subPath = `${firstChar}/${secondChar}`;
    
    // Handle different product file types
    if (options.fileType === 'document' || options.fileType === 'file') {
      return `${basePath}/files/${subPath}/${filename}`;
    }
    
    // Default to images - matches manual upload structure
    return `${basePath}/images/${subPath}/${filename}`;
  }
  
  /**
   * Generate category image path using unified directory structure
   * /category/images/[first]/[second]/filename.ext
   * @param {string} filename - Cleaned filename
   * @param {Object} options - Additional options
   * @returns {string} Full path
   */
  static generateCategoryPath(filename, options = {}) {
    // Get first two characters for directory structure
    const firstChar = this.getFirstChar(filename);
    const secondChar = this.getSecondChar(filename);
    
    // Build the path: /category/images/[first]/[second]/filename
    return `category/images/${firstChar}/${secondChar}/${filename}`;
  }
  
  /**
   * Generate library file path
   * /media/library/[year]/[month]/filename.ext
   * @param {string} filename - Cleaned filename
   * @param {Object} options - Additional options
   * @returns {string} Full path
   */
  static generateLibraryPath(filename, options = {}) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    
    // Build the path: /media/library/[year]/[month]/filename
    return `media/library/${year}/${month}/${filename}`;
  }
  
  /**
   * Generate default path for unknown types
   * @param {string} filename - Cleaned filename
   * @param {Object} options - Additional options
   * @returns {string} Full path
   */
  static generateDefaultPath(filename, options = {}) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    
    return `media/files/${year}/${month}/${filename}`;
  }
  
  /**
   * Get first character for directory structure
   * @param {string} filename - Filename
   * @returns {string} First character or '_'
   */
  static getFirstChar(filename) {
    if (!filename || filename.length === 0) return '_';

    const char = filename[0].toLowerCase();
    // Use alphanumeric characters, underscore for special characters
    return /[a-z0-9]/.test(char) ? char : '_';
  }

  /**
   * Get second character for directory structure
   * @param {string} filename - Filename
   * @returns {string} Second character or '_'
   */
  static getSecondChar(filename) {
    if (!filename || filename.length < 2) return '_';

    const char = filename[1].toLowerCase();
    // Use alphanumeric characters, underscore for special characters
    return /[a-z0-9]/.test(char) ? char : '_';
  }
  
  /**
   * Extract relative path from a full URL or absolute path
   * @param {string} fullPath - Full URL or absolute path
   * @returns {string} Relative path
   */
  static extractRelativePath(fullPath) {
    if (!fullPath) return '';
    
    // Remove protocol and domain if it's a URL
    let path = fullPath;
    if (path.includes('://')) {
      const url = new URL(fullPath);
      path = url.pathname;
    }
    
    // Remove leading slash
    path = path.replace(/^\//, '');
    
    // Remove storage bucket prefixes if present
    const bucketPrefixes = [
      'storage/v1/object/public/',
      'suprshop-assets/',
      'suprshop-images/',
      'suprshop-catalog/',
      'product-images/',
      'uploads/'
    ];
    
    for (const prefix of bucketPrefixes) {
      if (path.includes(prefix)) {
        const index = path.indexOf(prefix);
        path = path.substring(index + prefix.length);
      }
    }
    
    return path;
  }
}

module.exports = StoragePathUtility;