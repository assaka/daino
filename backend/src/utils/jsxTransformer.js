/**
 * JSX Transformer Utility
 *
 * Transforms JSX code to React.createElement() calls at save time.
 * This allows plugin developers to write JSX while the frontend
 * can execute the transformed code without runtime Babel.
 */

const babel = require('@babel/core');

/**
 * Check if code contains JSX syntax
 * @param {string} code - The code to check
 * @returns {boolean} - True if code contains JSX
 */
function hasJSX(code) {
  if (!code || typeof code !== 'string') return false;
  // Check for JSX tags: < followed by letter or /
  return /<[A-Za-z\/]/.test(code);
}

/**
 * Transform JSX code to React.createElement() calls
 * @param {string} code - The JSX code to transform
 * @param {string} [filename='component.jsx'] - Filename for error messages
 * @returns {Promise<{success: boolean, code?: string, error?: string}>}
 */
async function transformJSX(code, filename = 'component.jsx') {
  if (!code || typeof code !== 'string') {
    return { success: true, code: code || '' };
  }

  // If no JSX, return as-is
  if (!hasJSX(code)) {
    return { success: true, code };
  }

  try {
    const result = await babel.transformAsync(code, {
      presets: ['@babel/preset-react'],
      filename,
      // Don't generate source maps for production
      sourceMaps: false,
      // Compact output
      compact: true,
      // Comments are not needed in compiled code
      comments: false
    });

    return {
      success: true,
      code: result.code
    };
  } catch (error) {
    console.error(`JSX transformation failed for ${filename}:`, error.message);
    return {
      success: false,
      error: `JSX transformation failed: ${error.message}`,
      originalCode: code
    };
  }
}

/**
 * Transform component code, handling import statements
 * Removes imports and transforms JSX
 * @param {string} code - The component code
 * @param {string} [filename='component.jsx'] - Filename for error messages
 * @returns {Promise<{success: boolean, code?: string, error?: string}>}
 */
async function transformComponentCode(code, filename = 'component.jsx') {
  if (!code || typeof code !== 'string') {
    return { success: true, code: code || '' };
  }

  try {
    // Remove import statements (dependencies are injected at runtime)
    let cleanCode = code.replace(/import\s+.*?from\s+['"].*?['"];?\s*/g, '');

    // Remove 'export default' from the code
    cleanCode = cleanCode.replace(/export\s+default\s+/, '');

    // If no JSX after cleaning, return as-is
    if (!hasJSX(cleanCode)) {
      return { success: true, code: cleanCode };
    }

    // Transform JSX
    const result = await babel.transformAsync(cleanCode, {
      presets: ['@babel/preset-react'],
      filename,
      sourceMaps: false,
      compact: false, // Keep readable for debugging
      comments: false
    });

    return {
      success: true,
      code: result.code
    };
  } catch (error) {
    console.error(`Component transformation failed for ${filename}:`, error.message);
    return {
      success: false,
      error: `Transformation failed: ${error.message}`,
      originalCode: code
    };
  }
}

/**
 * Transform multiple admin pages
 * @param {Array<{componentCode: string, pageKey: string}>} adminPages
 * @returns {Promise<Array<{componentCode: string, pageKey: string, transformError?: string}>>}
 */
async function transformAdminPages(adminPages) {
  if (!adminPages || !Array.isArray(adminPages)) {
    return adminPages || [];
  }

  const transformed = await Promise.all(
    adminPages.map(async (page) => {
      if (!page.componentCode) return page;

      const result = await transformComponentCode(
        page.componentCode,
        `${page.pageKey || 'admin-page'}.jsx`
      );

      if (result.success) {
        return { ...page, componentCode: result.code };
      } else {
        console.error(`Failed to transform admin page ${page.pageKey}:`, result.error);
        return { ...page, transformError: result.error };
      }
    })
  );

  return transformed;
}

/**
 * Transform multiple widgets
 * @param {Array<{componentCode: string, widgetId: string}>} widgets
 * @returns {Promise<Array<{componentCode: string, widgetId: string, transformError?: string}>>}
 */
async function transformWidgets(widgets) {
  if (!widgets || !Array.isArray(widgets)) {
    return widgets || [];
  }

  const transformed = await Promise.all(
    widgets.map(async (widget) => {
      if (!widget.componentCode) return widget;

      const result = await transformComponentCode(
        widget.componentCode,
        `${widget.widgetId || 'widget'}.jsx`
      );

      if (result.success) {
        return { ...widget, componentCode: result.code };
      } else {
        console.error(`Failed to transform widget ${widget.widgetId}:`, result.error);
        return { ...widget, transformError: result.error };
      }
    })
  );

  return transformed;
}

module.exports = {
  hasJSX,
  transformJSX,
  transformComponentCode,
  transformAdminPages,
  transformWidgets
};
