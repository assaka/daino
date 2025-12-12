import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Maximize2,
  X,
  ChevronDown,
  ChevronRight,
  Shield,
  AlertTriangle,
  Globe
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { styleManager } from './SimpleStyleManager';
import { saveManager, CHANGE_TYPES } from './SaveManager';
import { parseEditorHtml, validateEditorHtml, SECURITY_LEVELS } from '@/utils/secureHtmlParser';
import GridLayoutControl from './GridLayoutControl';
// Slot configurations come from database - no static config import needed
import api from '@/utils/api';
import { useTranslation } from '@/contexts/TranslationContext';

// Dynamic sidebar imports map
// To add a new specialized sidebar:
// 1. Create the sidebar component in ./sidebars/YourSidebar.jsx
// 2. Add it to this map: SidebarName: () => import('./sidebars/SidebarName')
// 3. Set metadata.editorSidebar: 'SidebarName' in the slot config
const SIDEBAR_COMPONENTS = {
  LayeredNavigationSidebar: () => import('./sidebars/LayeredNavigationSidebar'),
  HeaderEditorSidebar: () => import('./sidebars/HeaderEditorSidebar'),
  // Add more specialized sidebars here as needed
  // ProductGridSidebar: () => import('./sidebars/ProductGridSidebar'),
};

/**
 * Check if a class string contains bold styling
 */
function isBold(className) {
  return className.includes('font-bold') || className.includes('font-semibold');
}

/**
 * Check if a class string contains italic styling
 */
function isItalic(className) {
  return className.includes('italic');
}

/**
 * Get current alignment from class string
 */
function getCurrentAlign(className, isWrapperSlot = false) {
  if (className.includes('text-center')) return 'center';
  if (className.includes('text-right')) return 'right';
  return 'left';
}

/**
 * Get current font size from class string
 */
function getCurrentFontSize(className) {
  const sizes = ['text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl', 'text-3xl', 'text-4xl'];
  const found = sizes.find(size => className.includes(size));
  return found ? found.replace('text-', '') : 'base';
}

const EditorSidebar = ({
  selectedElement,
  onClearSelection,
  onClassChange,  // New prop for class changes
  onInlineClassChange, // Prop for inline class changes (alignment, etc.)
  onTextChange,   // New prop for text content changes
  slotId,        // Current slot ID
  slotConfig,    // Current slot configuration from database
  allSlots = {}, // All slots configuration to check for product_items
  storeId,       // Store ID for API calls
  isVisible = true
}) => {
  // Set up database save callback for SimpleStyleManager
  useEffect(() => {
    // CRITICAL: Disable SimpleStyleManager database callback to prevent race conditions
    // EditorSidebar handles all database saves directly, SimpleStyleManager should only handle DOM
    styleManager.setDatabaseSaveCallback(null);
  }, [onClassChange]);
  const [expandedSections, setExpandedSections] = useState({
    content: true,
    grid: true,
    text: true,
    layout: true,
    appearance: true,
    advanced: false,
    size: true
  });

  const [elementProperties, setElementProperties] = useState({
    width: '',
    height: '',
    className: '',
    styles: {}
  });

  // State for persistent button selection
  const [lastSelectedButton, setLastSelectedButton] = useState(null);
  
  // Refs for uncontrolled textareas to avoid React re-render lag
  const textContentRef = useRef(null);
  const htmlContentRef = useRef(null);

  // Keep local state only for initialization and blur handling
  const [localTextContent, setLocalTextContent] = useState('');
  const [localHtmlContent, setLocalHtmlContent] = useState('');

  // HTML validation and security state
  const [htmlValidation, setHtmlValidation] = useState({
    error: null,
    isValid: true,
    isSafe: true,
    wasModified: false,
    warnings: []
  });

  // Flag to prevent change recording during initialization
  const [isInitializing, setIsInitializing] = useState(false);

  // Translation state
  const { t, currentLanguage, availableLanguages } = useTranslation();
  const [translationKey, setTranslationKey] = useState('');
  const [translatedValue, setTranslatedValue] = useState('');
  const [isTranslatable, setIsTranslatable] = useState(false);
  const [isAutoTranslating, setIsAutoTranslating] = useState(false);
  
  // State to trigger alignment updates
  const [alignmentUpdate, setAlignmentUpdate] = useState(0);
  
  // Get current alignment from parent element
  const currentAlignment = useMemo(() => {
    if (!selectedElement) return 'left';

    // First check if we have slotConfig with parentClassName
    if (slotConfig && slotConfig.parentClassName) {
      const alignment = getCurrentAlign(slotConfig.parentClassName, true);
      if (alignment !== 'left') { // Only use config if it has explicit alignment
        return alignment;
      }
    }

    // Fallback to DOM detection for newly created elements
    const elementSlotId = selectedElement.getAttribute('data-slot-id');
    let targetElement;

    if (elementSlotId?.includes('.button')) {
      // For button slots, check the outer grid container
      targetElement = selectedElement.closest('.button-slot-container');
    } else {
      // For text slots, traverse up to find grid cell with col-span
      // Structure: text -> wrapper div -> grid cell (cleaner without ResizeWrapper)
      targetElement = selectedElement.parentElement;
      while (targetElement && !targetElement.className.includes('col-span')) {
        targetElement = targetElement.parentElement;
        // Safety check to avoid infinite loop
        if (targetElement === document.body) {
          targetElement = null;
          break;
        }
      }
    }

    if (!targetElement) return 'left';

    const parentClassName = targetElement.className || '';
    const alignment = getCurrentAlign(parentClassName, true);
    console.log('🎯 Using alignment from DOM:', alignment, parentClassName);
    return alignment;
  }, [selectedElement, alignmentUpdate, slotConfig]);
  
  // Note: Save manager callback is handled by the parent CartSlotsEditor
  // EditorSidebar just records changes, parent handles the actual saving

  // Check if selected element is a slot element
  const isSlotElement = selectedElement && (
    selectedElement.hasAttribute('data-slot-id') ||
    selectedElement.hasAttribute('data-editable') ||
    selectedElement.closest('[data-slot-id]') ||
    selectedElement.closest('[data-editable]')
  );

  // Check if selected element supports HTML content editing
  const isHtmlElement = useMemo(() => {
    if (!selectedElement) return false;

    // Don't show HTML editor for button type slots - they have dedicated style controls
    if (slotConfig?.type === 'button') return false;

    // Don't show HTML editor for elements marked as textOnly
    if (slotConfig?.metadata?.textOnly === true) return false;

    const tagName = selectedElement.tagName?.toLowerCase();
    // Exclude 'button' - buttons use style controls, not HTML editing
    const htmlSupportedTags = ['div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'section', 'article'];
    return htmlSupportedTags.includes(tagName);
  }, [selectedElement, slotConfig?.type, slotConfig?.metadata?.textOnly]);

  // Generate clean HTML from database content and classes
  const getCleanHtmlFromDatabase = useCallback((slotConfig) => {
    if (!slotConfig) return '';

    const content = slotConfig.content || '';
    const className = slotConfig.className || '';
    const parentClassName = slotConfig.parentClassName || '';
    const styles = slotConfig.styles || {};
    const type = slotConfig.type || 'div';
    const metadata = slotConfig.metadata || {};

    // Determine the HTML tag to use
    let tagName = 'div';
    if (metadata.htmlTag) {
      tagName = metadata.htmlTag;
    } else if (type === 'button') {
      tagName = 'button';
    } else if (type === 'link') {
      tagName = 'a';
    }

    // Create the element
    const element = document.createElement(tagName);

    // Apply classes from database (excluding editor-specific classes)
    const cleanClasses = className
      .split(' ')
      .filter(cls =>
        cls &&
        !cls.includes('cursor-') &&
        !cls.includes('hover:') &&
        !cls.includes('border-') &&
        !cls.includes('shadow-') &&
        !cls.includes('ring-') &&
        !cls.includes('focus:') &&
        cls !== 'transition-all' &&
        cls !== 'duration-200' &&
        cls !== 'group' &&
        cls !== 'relative'
      )
      .join(' ');

    if (cleanClasses) {
      element.className = cleanClasses;
    }

    // Apply styles from database (excluding editor-specific styles)
    Object.entries(styles).forEach(([property, value]) => {
      if (
        property !== 'cursor' &&
        property !== 'userSelect' &&
        property !== 'outline' &&
        property !== 'border' &&
        property !== 'boxShadow' &&
        value
      ) {
        try {
          element.style[property] = value;
        } catch (e) {
          console.warn(`Could not apply style ${property}: ${value}`);
        }
      }
    });

    // Apply HTML attributes from metadata
    if (metadata.htmlAttributes) {
      Object.entries(metadata.htmlAttributes).forEach(([attr, value]) => {
        if (attr !== 'class') { // Skip 'class' as it's handled via className
          element.setAttribute(attr, value);
        }
      });
    }

    // Set content (for buttons and links, extract text only to avoid nested divs)
    if (type === 'button' || type === 'link') {
      if (content.includes('<')) {
        // If content contains HTML, extract just the text
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = content;
        element.textContent = tempDiv.textContent || tempDiv.innerText || content;
      } else {
        element.textContent = content;
      }

      // Add attributes for links (always include defaults)
      if (type === 'link') {
        element.href = slotConfig.href || '#';
        element.target = slotConfig.target || '_self';
        element.rel = 'noopener noreferrer';
      }
    } else {
      element.innerHTML = content;
    }

    // If there's a parentClassName (alignment), wrap in a div
    if (parentClassName) {
      const wrapper = document.createElement('div');
      wrapper.className = parentClassName;
      wrapper.appendChild(element);
      return wrapper.outerHTML;
    }

    return element.outerHTML;
  }, []);

  // Generate clean HTML without editor-specific classes and attributes
  const getCleanHtml = useCallback((element) => {
    if (!element) return '';

    // Clone the element to avoid modifying the original
    const clonedElement = element.cloneNode(true);

    // Remove editor-specific attributes
    const editorAttributes = ['data-editable', 'data-slot-id'];
    editorAttributes.forEach(attr => {
      clonedElement.removeAttribute(attr);
    });

    // Remove editor-specific classes
    const cleanClasses = clonedElement.className
      .split(' ')
      .filter(cls =>
        cls &&
        !cls.includes('cursor-') &&
        !cls.includes('hover:') &&
        !cls.includes('border-') &&
        !cls.includes('shadow-') &&
        !cls.includes('ring-') &&
        !cls.includes('focus:') &&
        cls !== 'transition-all' &&
        cls !== 'duration-200' &&
        cls !== 'group' &&
        cls !== 'relative'
      )
      .join(' ');

    clonedElement.className = cleanClasses;

    return clonedElement.outerHTML;
  }, []);

  // Update properties when selected element changes
  useEffect(() => {
    if (selectedElement && isSlotElement && slotConfig) {
      // Set initialization flag to prevent change recording
      setIsInitializing(true);
      
      // Check if this is a button element for persistent selection
      const isButton = selectedElement.tagName?.toLowerCase() === 'button' || 
                      selectedElement.className?.includes('btn') ||
                      selectedElement.getAttribute('role') === 'button';
      
      if (isButton) {
        setLastSelectedButton({
          element: selectedElement,
          slotId: slotId,
          timestamp: Date.now()
        });
      }
      
      // Get stored configuration values, fallback to current element values
      const storedClassName = slotConfig.className || '';
      const storedStyles = slotConfig.styles || {};
      
      // Initialize local text content with slot content
      // Content should always be set in slotConfig for buttons and editable elements
      const textContent = slotConfig.content || '';
      setLocalTextContent(textContent);

      // Check if content is a translation key (async detection for reverse lookup)
      detectTranslationKey(textContent).then(detectedKey => {
        console.log('🔍 Translation detection:', { textContent, detectedKey, slotId });

        if (detectedKey) {
          setIsTranslatable(true);
          setTranslationKey(detectedKey);

          // Fetch and display translated value
          getTranslatedValue(detectedKey).then(value => {
            console.log('📝 Fetched translation value:', { detectedKey, value });
            if (value) {
              setTranslatedValue(value);
            }
          });
        } else {
          setIsTranslatable(false);
          setTranslationKey('');
          setTranslatedValue('');
        }
      }).catch(error => {
        console.error('Error detecting translation key:', error);
        setIsTranslatable(false);
        setTranslationKey('');
        setTranslatedValue('');
      });

      // Update textarea ref value
      if (textContentRef.current) {
        textContentRef.current.value = textContent;
      }
      
      // Initialize local HTML content with clean HTML from database
      if (isHtmlElement && slotConfig) {
        // Prefer database content over DOM element content
        const htmlContent = getCleanHtmlFromDatabase(slotConfig) || getCleanHtml(selectedElement) || '';

        setLocalHtmlContent(htmlContent);

        // Update HTML textarea ref value (but not if user is actively editing)
        if (htmlContentRef.current) {
          const currentValue = htmlContentRef.current.value;
          const shouldUpdate = currentValue === localHtmlContent || !currentValue;

          if (shouldUpdate) {
            htmlContentRef.current.value = htmlContent;
          } else {
            console.log('⏭️ Skipping textarea reset - user may be editing');
          }
        }

      }
      
      // Clear initialization flag after a short delay
      setTimeout(() => setIsInitializing(false), 100);

      // CRITICAL: Find the actual content element that has the styling classes
      // Structure: GridColumn wrapper (selectedElement) → UnifiedSlotRenderer wrapper → inner content
      // The styling classes are on the UnifiedSlotRenderer wrapper, not the GridColumn wrapper
      const findContentElement = (element) => {
        // If element has data-slot-id, it's the GridColumn wrapper, look inside for content
        if (element.hasAttribute('data-slot-id')) {
          // Look for the element that has the STORED styling classes, not just any text-* class
          if (storedClassName) {
            const storedClasses = storedClassName.split(' ').filter(Boolean);
            for (const child of element.children) {
              if (child.className) {
                const childClasses = child.className.split(' ').filter(Boolean);
                // Check if child has any of the stored classes (like text-4xl, font-bold, italic)
                const hasStoredClasses = storedClasses.some(cls => childClasses.includes(cls));
                if (hasStoredClasses) {
                  return child;
                }
              }
            }
          }

          // Fallback: Look for element with inline styles (color, etc.)
          for (const child of element.children) {
            if (child.style && child.style.length > 0) {
              return child;
            }
          }

          // Last resort: return first child
          return element.children[0] || element;
        }
        return element;
      };

      const styledElement = findContentElement(selectedElement);

      // CRITICAL: For text slots with HTML content, the styling classes are on the INNER element (h1, p, etc.),
      // not on the outer wrapper. We need to read from the actual styledElement's className.
      // But we must filter out wrapper/editor classes first.
      const actualElementClassName = styledElement?.className || '';
      const cleanActualClasses = actualElementClassName
        .split(' ')
        .filter(cls =>
          cls &&
          !isWrapperOrEditorClass(cls) &&
          // Also filter out grid/layout classes that might be on wrapper
          !cls.startsWith('col-span-') &&
          !cls.startsWith('row-span-') &&
          !cls.includes('responsive-slot')
        )
        .join(' ');

      // Use actual element classes if they exist, otherwise fall back to stored
      const effectiveClassName = cleanActualClasses || storedClassName || '';

      // Function to detect Tailwind color classes (only explicit mappings for key colors)
      const getTailwindColorHex = (className) => {
        const explicitColors = {
          'text-white': '#ffffff',
          'text-black': '#000000',
          'text-red-200': '#fecaca' // Example with number for testing
        };

        const classes = className.split(' ');

        for (const cls of classes) {
          if (explicitColors[cls]) {
            return explicitColors[cls];
          }
        }
        return null; // Let computed styles handle non-explicit colors
      };

      setElementProperties({
        width: selectedElement.offsetWidth || '',
        height: selectedElement.offsetHeight || '',
        className: effectiveClassName, // Use actual element classes, not just stored className
        styles: (() => {
          try {
            // Safely merge stored styles with element styles
            const elementStyles = {};

            // Get computed styles for color properties from styledElement (content with classes)
            const computedStyle = window.getComputedStyle(styledElement);
            const colorProperties = ['color', 'backgroundColor', 'borderColor'];

            colorProperties.forEach(prop => {
              const computedValue = computedStyle[prop];

              // For color property, prioritize inline styles over Tailwind classes
              if (prop === 'color') {
                // Check if element has inline color style (from database saves)
                const hasInlineColor = storedStyles?.color || styledElement.style.color;

                // If we have inline color OR computed color is different from Tailwind white,
                // use the computed/inline value instead of Tailwind
                if (hasInlineColor || (computedValue && computedValue !== 'rgb(255, 255, 255)' && computedValue !== '#ffffff')) {
                  // Use computed styles (includes inline styles)
                  if (computedValue && computedValue !== 'rgba(0, 0, 0, 0)' && computedValue !== 'transparent') {
                    // Convert rgb/rgba to hex for color picker
                    if (computedValue.startsWith('rgb')) {
                      const rgbMatch = computedValue.match(/\d+/g);
                      if (rgbMatch && rgbMatch.length >= 3) {
                        const hex = '#' + rgbMatch.slice(0, 3)
                          .map(x => parseInt(x).toString(16).padStart(2, '0'))
                          .join('');
                        elementStyles[prop] = hex;
                      }
                    } else if (computedValue.startsWith('#')) {
                      elementStyles[prop] = computedValue;
                    }
                  }
                } else {
                  // No inline color - check for Tailwind classes
                  if (storedClassName) {
                    const tailwindColorHex = getTailwindColorHex(storedClassName);
                    if (tailwindColorHex) {
                      elementStyles[prop] = tailwindColorHex;
                      return;
                    }
                  }

                  // Fallback to black if no color found
                  if (!elementStyles[prop]) {
                    elementStyles[prop] = '#000000';
                  }
                }
              } else {
                // For backgroundColor and borderColor, convert rgb to hex for color picker

                if (computedValue && computedValue !== 'rgba(0, 0, 0, 0)' && computedValue !== 'transparent') {
                  // Convert rgb/rgba to hex for color picker compatibility
                  if (computedValue.startsWith('rgb')) {
                    const rgbMatch = computedValue.match(/\d+/g);
                    if (rgbMatch && rgbMatch.length >= 3) {
                      const hex = '#' + rgbMatch.slice(0, 3)
                        .map(x => parseInt(x).toString(16).padStart(2, '0'))
                        .join('');
                      elementStyles[prop] = hex;
                    }
                  } else if (computedValue.startsWith('#')) {
                    elementStyles[prop] = computedValue;
                  }
                } else {
                  console.warn(`[EditorSidebar] ${prop} skipped (transparent or invalid)`);
                }
              }
            });

            // Copy element inline styles safely from styledElement (content with classes)
            // BUT: Don't overwrite color properties that we already converted to hex
            const colorProps = ['color', 'backgroundColor', 'borderColor'];
            if (styledElement.style) {
              for (const property in styledElement.style) {
                if (styledElement.style.hasOwnProperty(property)) {
                  const value = styledElement.style[property];
                  if (value && !property.startsWith('webkit') && !property.startsWith('moz')) {
                    try {
                      // Skip color properties if we already have a hex value
                      if (colorProps.includes(property) && elementStyles[property]) {
                        continue; // Already converted to hex, don't overwrite
                      }
                      elementStyles[property] = value;
                    } catch (e) {
                      // Skip read-only properties
                      console.debug(`Skipping read-only style property: ${property}`);
                    }
                  }
                }
              }
            }

            // CRITICAL FIX: Also read border properties from stored styles if not in element styles
            // This ensures borderWidth and borderColor persist across re-renders
            const borderProps = ['borderWidth', 'borderStyle', 'borderRadius'];
            borderProps.forEach(prop => {
              if (!elementStyles[prop] && storedStyles?.[prop]) {
                elementStyles[prop] = storedStyles[prop];
              }
            });

            // Special handling for borderColor to ensure it's a valid hex color
            if (!elementStyles.borderColor && storedStyles?.borderColor) {
              const storedBorderColor = storedStyles.borderColor;
              // Convert to hex if needed
              if (storedBorderColor.startsWith('#')) {
                elementStyles.borderColor = storedBorderColor;
              } else if (storedBorderColor.startsWith('rgb')) {
                const rgbMatch = storedBorderColor.match(/\d+/g);
                if (rgbMatch && rgbMatch.length >= 3) {
                  const hex = '#' + rgbMatch.slice(0, 3)
                    .map(x => parseInt(x).toString(16).padStart(2, '0'))
                    .join('');
                  elementStyles.borderColor = hex;
                }
              } else {
                elementStyles.borderColor = storedBorderColor;
              }
            }

            // Extract color from Tailwind classes if no inline color is set
            // Primary source: content element (styledElement) which has actual styling classes
            const contentClassName = styledElement.className || '';
            const storedClassNames = storedClassName || '';

            // For color detection, prioritize content element over stored classes
            let colorSource = contentClassName || storedClassNames;

            if (!elementStyles.color && !storedStyles?.color) {
              const tailwindColor = getTailwindColorHex(colorSource);
              if (tailwindColor) {
                elementStyles.color = tailwindColor;
              }
            }

            // Also check for actual computed color from content element and inline styles
            if (!elementStyles.color) {
              // First check inline styles directly
              const inlineColor = styledElement.style.color;
              if (inlineColor) {
                if (inlineColor.startsWith('rgb')) {
                  try {
                    const rgbMatch = inlineColor.match(/\d+/g);
                    if (rgbMatch && rgbMatch.length >= 3) {
                      const hex = '#' + rgbMatch.slice(0, 3)
                        .map(x => parseInt(x).toString(16).padStart(2, '0'))
                        .join('');
                      elementStyles.color = hex;
                    }
                  } catch (e) {
                    elementStyles.color = inlineColor;
                  }
                } else if (inlineColor.startsWith('#')) {
                  elementStyles.color = inlineColor;
                } else {
                  elementStyles.color = inlineColor;
                }
              } else {
                // Fallback to computed styles
                const contentComputedStyle = window.getComputedStyle(styledElement);
                const contentColor = contentComputedStyle.color;
                if (contentColor && contentColor !== 'rgba(0, 0, 0, 0)' && contentColor !== 'transparent') {
                  if (contentColor.startsWith('rgb')) {
                    try {
                      const rgbMatch = contentColor.match(/\d+/g);
                      if (rgbMatch && rgbMatch.length >= 3) {
                        const hex = '#' + rgbMatch.slice(0, 3)
                          .map(x => parseInt(x).toString(16).padStart(2, '0'))
                          .join('');
                        elementStyles.color = hex;
                      }
                    } catch (e) {
                      elementStyles.color = contentColor;
                    }
                  } else if (contentColor.startsWith('#')) {
                    elementStyles.color = contentColor;
                  }
                }
              }
            }

            // Filter out template variables from stored styles before merging
            const cleanStoredStyles = {};
            Object.entries(storedStyles).forEach(([key, value]) => {
              if (typeof value === 'string' && value.includes('{{')) {
                // Skip template variables - use computed style instead
                return;
              }
              cleanStoredStyles[key] = value;
            });

            const finalStyles = { ...cleanStoredStyles, ...elementStyles };

            return finalStyles;
          } catch (error) {
            console.warn('Error merging styles:', error);
            return { ...storedStyles };
          }
        })()
      });
    }
  }, [selectedElement, isSlotElement, slotConfig, slotId]);

  const toggleSection = useCallback((section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  }, []);

  // Cache for reverse translation lookup (value -> key)
  const [translationCache, setTranslationCache] = useState(null);

  // Helper to recursively search for a value in nested translation object
  const findKeyByValue = useCallback((obj, value, prefix = '') => {
    for (const [key, val] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (typeof val === 'string') {
        // Direct string match
        if (val === value) {
          return fullKey;
        }
      } else if (typeof val === 'object' && val !== null) {
        // Recursively search nested objects
        const found = findKeyByValue(val, value, fullKey);
        if (found) {
          return found;
        }
      }
    }
    return null;
  }, []);

  // Helper to detect if text content is a translation key or matches a translation value
  const detectTranslationKey = useCallback(async (content) => {
    if (!content) return null;

    // Check for translation key patterns: {t("key")} or t("key") or just the key
    const tPattern = /\{?t\(["']([^"']+)["']\)\}?/;
    const match = content.match(tPattern);

    if (match) {
      return match[1]; // Return the key
    }

    // Check if it's just a translation key (common.button.add_to_cart)
    if (content.match(/^[a-z_]+\.[a-z_]+(\.[a-z_]+)*$/)) {
      return content;
    }

    // Check if content matches a translation value (reverse lookup)
    // This allows detecting translation keys from rendered text
    try {
      // Fetch translation cache if not already loaded
      let cache = translationCache;
      if (!cache) {
        const response = await api.get(`/translations/ui-labels?lang=${currentLanguage}&store_id=${storeId}`);
        if (response && response.success && response.data && response.data.labels) {
          cache = response.data.labels;
          setTranslationCache(cache);
        }
      }

      // Search for matching value in translation cache
      if (cache) {
        const foundKey = findKeyByValue(cache, content);
        if (foundKey) {
          return foundKey;
        }
      }
    } catch (error) {
      console.error('Error during reverse translation lookup:', error);
    }

    return null;
  }, [currentLanguage, translationCache, findKeyByValue]);

  // Helper to get translated value for a key
  const getTranslatedValue = useCallback(async (key) => {
    try {
      const response = await api.get(`/translations/ui-labels?lang=${currentLanguage}`);
      if (response && response.success && response.data && response.data.labels) {
        // Navigate through nested object using key path
        const keys = key.split('.');
        let value = response.data.labels;
        for (const k of keys) {
          if (value && typeof value === 'object') {
            value = value[k];
          } else {
            return null;
          }
        }
        return typeof value === 'string' ? value : null;
      }
    } catch (error) {
      console.error('Error fetching translation:', error);
    }
    return null;
  }, [currentLanguage]);

  // Ultra-fast text change handler - no React state updates during typing
  const handleTextContentChange = useCallback((e) => {
    // Do absolutely nothing - let the textarea be uncontrolled during typing
    // This eliminates React re-render lag completely
  }, []);

  // HTML content change handler for real-time editing
  const handleHtmlContentInput = useCallback((e) => {
    // DON'T update validation state during typing to prevent re-renders
    // Only validate on blur to avoid resetting textarea value
  }, []);


  // Helper to auto-translate text to all active languages
  const autoTranslateText = useCallback(async (text, sourceLanguage = 'en') => {
    if (!text || !text.trim()) return;

    setIsAutoTranslating(true);
    try {
      const response = await api.post('/translations/auto-translate-ui-label', {
        key: translationKey || `editor.${slotId}.${Date.now()}`,
        value: text,
        category: 'editor',
        fromLang: sourceLanguage
      });

      if (response && response.success) {
        console.log('Auto-translation completed:', response.data);
      }
    } catch (error) {
      console.error('Auto-translation failed:', error);
    } finally {
      setIsAutoTranslating(false);
    }
  }, [slotId, translationKey]);

  // Save text content when user stops typing (onBlur)
  const handleTextContentSave = useCallback(() => {
    if (slotId && onTextChange && !isInitializing && textContentRef.current) {
      const currentValue = textContentRef.current.value;
      onTextChange(slotId, currentValue);
      setLocalTextContent(currentValue); // Update state for consistency

      // If text changed and is translatable, auto-translate
      if (isTranslatable && currentValue !== localTextContent) {
        autoTranslateText(currentValue, currentLanguage);
      }
    }
  }, [slotId, onTextChange, isInitializing, isTranslatable, localTextContent, currentLanguage, autoTranslateText]);

  // Save HTML content when user stops typing (onBlur) with XSS prevention
  const handleHtmlContentSave = useCallback(() => {

    if (slotId && !isInitializing && htmlContentRef.current) {
      const currentHtml = htmlContentRef.current.value;

      // If HTML is empty, clear content
      if (!currentHtml || currentHtml.trim() === '') {
        if (onTextChange) {
          onTextChange(slotId, '');
        }
        setLocalHtmlContent('');
        setHtmlValidation({
          error: null,
          isValid: true,
          isSafe: true,
          wasModified: false,
          warnings: []
        });
        return;
      }

      // Parse and sanitize HTML securely
      const parsed = parseEditorHtml(currentHtml);

      if (parsed.sanitizedHtml) {
        try {
          // Parse the sanitized HTML to extract element structure
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = parsed.sanitizedHtml;
          let element = tempDiv.firstElementChild;
          let parentClassName = '';

          // Check if there's a wrapper div (for alignment)
          if (element && element.tagName === 'DIV' && element.children.length === 1) {
            // This might be a parent wrapper, check if it has alignment classes
            const possibleParentClasses = element.className || '';
            const alignmentClasses = ['text-left', 'text-center', 'text-right'];
            const hasAlignment = alignmentClasses.some(cls => possibleParentClasses.includes(cls));

            if (hasAlignment) {
              parentClassName = possibleParentClasses;
              element = element.firstElementChild; // Use the inner element
            }
          }

          if (element) {
            // Extract text content for the text field
            const textContent = element.textContent || element.innerText || '';

            // Extract classes and styles for onClassChange
            const elementClasses = element.className || '';
            const elementStyles = {};

            // Get inline styles
            if (element.style) {
              for (let i = 0; i < element.style.length; i++) {
                const property = element.style[i];
                elementStyles[property] = element.style.getPropertyValue(property);
              }
            }

            // Extract tag name for metadata update
            const tagName = element.tagName.toLowerCase();

            // Extract attributes for metadata
            const htmlAttributes = {};
            for (let i = 0; i < element.attributes.length; i++) {
              const attr = element.attributes[i];
              if (attr.name !== 'class' && attr.name !== 'style') {
                htmlAttributes[attr.name] = attr.value;
              }
            }

            // Prepare metadata update with htmlTag and htmlAttributes
            const metadataUpdate = {
              htmlTag: tagName,
              htmlAttributes: htmlAttributes
            };

            // Save text content separately
            if (onTextChange) {
              onTextChange(slotId, textContent);
            }

            // Save classes, styles, and metadata
            if (onClassChange) {
              // Combine element classes with parent classes if there's alignment
              const finalClasses = parentClassName ? `${elementClasses} ${parentClassName}`.trim() : elementClasses;
              const isAlignmentChange = !!parentClassName;

              onClassChange(slotId, finalClasses, elementStyles, metadataUpdate, isAlignmentChange);
            }

            // Update local HTML content display
            setLocalHtmlContent(parsed.sanitizedHtml);
          } else {
            // No element found, treat as plain text
            if (onTextChange) {
              onTextChange(slotId, parsed.textContent);
            }
            setLocalHtmlContent(parsed.textContent);
          }

          // Update validation state
          setHtmlValidation({
            error: parsed.error,
            isValid: parsed.isValid,
            isSafe: true,
            wasModified: parsed.wasModified,
            warnings: parsed.wasModified ? ['HTML was sanitized for security'] : []
          });

          // Update the textarea with sanitized content if it was modified
          if (parsed.wasModified && htmlContentRef.current) {
            htmlContentRef.current.value = parsed.sanitizedHtml;
          }

        } catch (parseError) {
          console.error('Failed to parse HTML element:', parseError);
          // Fallback to plain text
          if (onTextChange) {
            onTextChange(slotId, parsed.textContent);
          }
          setLocalHtmlContent(parsed.textContent);

          setHtmlValidation({
            error: 'HTML structure parsing failed, saved as text',
            isValid: false,
            isSafe: true,
            wasModified: true,
            warnings: ['Content saved as plain text due to parsing errors']
          });
        }
      } else {
        // Parsing completely failed, save original but show error
        if (onTextChange) {
          onTextChange(slotId, currentHtml);
        }
        setLocalHtmlContent(currentHtml);

        setHtmlValidation({
          error: parsed.error || 'Invalid HTML content',
          isValid: false,
          isSafe: false,
          wasModified: false,
          warnings: ['HTML may contain errors but was saved as-is']
        });
      }
    }
  }, [slotId, onTextChange, onClassChange, isInitializing]);

  // Function to detect wrapper/editor classes that should not be saved
  // MUST be defined before handleAlignmentChange and handlePropertyChange use it
  const isWrapperOrEditorClass = useCallback((cls) => {
    // Editor selection indicators
    if (['border-2', 'border-blue-500', 'border-dashed', 'shadow-md', 'shadow-blue-200/40'].includes(cls)) return true;

    // GridColumn wrapper classes that should not be on content
    if (['border', 'rounded-lg', 'overflow-hidden', 'responsive-slot', 'relative'].includes(cls)) return true;
    if (['cursor-grab', 'cursor-grabbing', 'transition-all', 'duration-200'].includes(cls)) return true;

    // Padding classes from wrapper
    if (cls.match(/^p-\d+$/)) return true;

    // Grid layout classes
    if (cls.match(/^col-span-\d+$/)) return true;

    // Any other wrapper-specific classes
    if (['hover:border-blue-400', 'hover:border-2', 'hover:border-dashed', 'hover:bg-blue-50/10'].includes(cls)) return true;

    return false;
  }, []);

  // Simple function to replace ONE specific class type only
  const replaceSpecificClass = useCallback((classString, newClass, removePattern) => {
    if (!classString) return newClass || '';

    const classes = classString.split(' ').filter(Boolean);

    // Find classes that match the pattern (will be removed)
    const matchingClasses = classes.filter(cls => removePattern.test(cls));

    // Remove only classes matching the specific pattern
    const filteredClasses = classes.filter(cls => !removePattern.test(cls));

    // Add the new class if provided
    if (newClass && newClass.trim()) {
      filteredClasses.push(newClass);
    }

    const result = filteredClasses.join(' ');

    return result;
  }, []);

  // Simple alignment change handler - direct DOM updates
  const handleAlignmentChange = useCallback((property, value) => {
    if (!selectedElement || property !== 'textAlign') {
      return;
    }

    const elementSlotId = selectedElement.getAttribute('data-slot-id');
    if (!elementSlotId) {
      return;
    }

    // Find the content element that has the styling classes (same logic as initialization)
    const findContentElement = (element) => {
      if (element.hasAttribute('data-slot-id')) {
        // Look for element with stored classes first
        const elementSlotConfig = elementSlotId === slotId ? slotConfig : allSlots[elementSlotId];
        const storedClassName = elementSlotConfig?.className || '';

        if (storedClassName) {
          const storedClasses = storedClassName.split(' ').filter(Boolean);
          for (const child of element.children) {
            if (child.className) {
              const childClasses = child.className.split(' ').filter(Boolean);
              const hasStoredClasses = storedClasses.some(cls => childClasses.includes(cls));
              if (hasStoredClasses) {
                return child;
              }
            }
          }
        }

        // Fallback: Look for element with inline styles
        for (const child of element.children) {
          if (child.style && child.style.length > 0) {
            return child;
          }
        }

        return element.children[0] || element;
      }
      return element;
    };

    const styledElement = findContentElement(selectedElement);

    // Preserve existing inline styles and Tailwind color classes on the styled element before alignment change
    const currentInlineStyles = {};
    const currentColorClasses = [];

    // Preserve inline styles
    if (styledElement.style) {
      for (let i = 0; i < styledElement.style.length; i++) {
        const styleProp = styledElement.style[i];
        const styleValue = styledElement.style.getPropertyValue(styleProp);
        if (styleValue && styleValue.trim() !== '') {
          currentInlineStyles[styleProp] = styleValue;
        }
      }
    }

    // CRITICAL: Preserve color classes from DATABASE, NOT from contaminated DOM element!
    const elementSlotConfig = elementSlotId === slotId ? slotConfig : allSlots[elementSlotId];
    const databaseClassName = elementSlotConfig?.className || '';

    const currentClasses = databaseClassName.split(' ').filter(Boolean);
    currentClasses.forEach(cls => {
      if (cls.startsWith('text-') && (cls.includes('-') || cls === 'text-white' || cls === 'text-black')) {
        // Check if it's a color class (has a dash for variants like text-blue-200, or is text-white/text-black)
        // Use pattern-based detection: text-white, text-black, or text-{anything}-{number}
        const isColorClass = cls.match(/^text-\w+-\d+$/) || cls === 'text-white' || cls === 'text-black';
        if (isColorClass) {
          currentColorClasses.push(cls);
        }
      }
    });
    
    // Find the correct target element for alignment classes
    let targetElement;
    if (elementSlotId.includes('.button')) {
      // Find the button-slot-container (the outer div with col-span-12)
      targetElement = selectedElement.closest('.button-slot-container');
    } else {
      // For text slots, traverse up to find grid cell with gridColumn style or data-slot-id
      targetElement = selectedElement.parentElement;
      while (targetElement &&
             !targetElement.className.includes('col-span') &&
             !targetElement.style.gridColumn &&
             !targetElement.getAttribute('data-slot-id')) {
        targetElement = targetElement.parentElement;
        if (targetElement === document.body) {
          targetElement = null;
          break;
        }
      }
    }

    // Use surgical replacement for alignment - only remove/add alignment classes
    const finalClassName = replaceSpecificClass(databaseClassName, `text-${value}`, /^text-(left|center|right|justify)$/);
    styledElement.className = finalClassName;

    // Restore preserved inline styles on the styled element
    Object.entries(currentInlineStyles).forEach(([styleProp, styleValue]) => {
      styledElement.style.setProperty(styleProp, styleValue);
    });

    // Update local state with preserved styles
    setElementProperties(prev => ({
      ...prev,
      className: styledElement.className,
      styles: {
        ...prev.styles,
        ...currentInlineStyles
      }
    }));

    // CRITICAL: Filter out wrapper classes from alignment save too!
    const alignmentClassNameForSave = styledElement.className
      .split(' ')
      .filter(cls => cls && !isWrapperOrEditorClass(cls))
      .join(' ');

    // Save the styled element classes directly (alignment is now included)
    if (onInlineClassChange) {
      onInlineClassChange(elementSlotId, alignmentClassNameForSave, currentInlineStyles, true);
    }

    // Trigger alignment update for button state - do this after a delay to avoid interrupting the callback
    setTimeout(() => {
      setAlignmentUpdate(prev => prev + 1);
    }, 0);
  }, [selectedElement, onInlineClassChange, isWrapperOrEditorClass, slotId, slotConfig, allSlots]);

  // Simple property change handler - direct DOM updates and immediate saves
  const handlePropertyChange = useCallback((property, value) => {
    if (!selectedElement) return;

    const elementSlotId = selectedElement.getAttribute('data-slot-id');
    if (!elementSlotId) return;

    // Handle textAlign specially - always apply to parent
    if (property === 'textAlign') {
      handleAlignmentChange(property, value);
      return;
    }

    // Find the actual content element (button, text, etc.) - not wrappers
    // CRITICAL: Must find the actual semantic element, not ResizeWrapper or other wrappers
    const findContentElement = (element) => {
      // CRITICAL: For container slots, return the immediate child div (the container itself),
      // NOT a child element inside it. Containers don't have data-editable attribute.
      const elementSlotConfig = elementSlotId === slotId ? slotConfig : allSlots[elementSlotId];
      const slotType = elementSlotConfig?.type;

      if (slotType === 'container' || slotType === 'grid' || slotType === 'flex') {
        // For containers, return the first child div (the container wrapper with styles)
        for (const child of element.children) {
          if (child.tagName?.toLowerCase() === 'div') {
            return child;
          }
        }
        // Fallback to element itself if no child div found
        return element;
      }

      // If element has data-slot-id AND data-editable, it's the actual content element
      if (element.hasAttribute('data-slot-id') && element.hasAttribute('data-editable')) {
        return element;
      }

      // If element is a button, it's the actual content element
      if (element.tagName?.toLowerCase() === 'button') {
        return element;
      }

      // Look for child with data-slot-id AND data-editable (the actual content)
      const contentChild = element.querySelector('[data-slot-id][data-editable]');
      if (contentChild) {
        return contentChild;
      }

      // Look for button child (for button slots wrapped in ResizeWrapper)
      const buttonChild = element.querySelector('button');
      if (buttonChild) {
        return buttonChild;
      }

      // Look for text element children (h1-h6, p, span) with data-slot-id
      const textElement = element.querySelector('h1[data-slot-id], h2[data-slot-id], h3[data-slot-id], h4[data-slot-id], h5[data-slot-id], h6[data-slot-id], p[data-slot-id], span[data-slot-id]');
      if (textElement) {
        return textElement;
      }

      // Fallback to the element itself if it has data-slot-id
      if (element.hasAttribute('data-slot-id')) {
        return element;
      }

      return element;
    };

    const styledElement = findContentElement(selectedElement);

    const classBasedProperties = ['fontSize', 'fontWeight', 'fontStyle'];
    
    if (classBasedProperties.includes(property)) {
      // Preserve existing inline styles and Tailwind color classes before class changes
      const currentInlineStyles = {};
      const currentColorClasses = [];
      
      // Preserve inline styles
      if (styledElement.style) {
        for (let i = 0; i < styledElement.style.length; i++) {
          const styleProp = styledElement.style[i];
          const styleValue = styledElement.style.getPropertyValue(styleProp);
          if (styleValue && styleValue.trim() !== '') {
            currentInlineStyles[styleProp] = styleValue;
          }
        }
      }

      // CRITICAL: Use DATABASE className and surgically replace only the specific class type
      const elementSlotConfig = elementSlotId === slotId ? slotConfig : allSlots[elementSlotId];
      const databaseClassName = elementSlotConfig?.className || '';

      // Handle class-based properties (Tailwind) - apply immediately
      const success = styleManager.applyStyle(selectedElement, `class_${property}`, value);
      if (success) {
        // Restore preserved inline styles after class change on styled element
        Object.entries(currentInlineStyles).forEach(([styleProp, styleValue]) => {
          styledElement.style.setProperty(styleProp, styleValue);
        });

        // Get the new class based on the value parameter instead of searching contaminated DOM
        let newClassFromStyleManager;
        if (property === 'fontSize') {
          newClassFromStyleManager = `text-${value}`;
        } else if (property === 'fontWeight') {
          newClassFromStyleManager = `font-${value}`;
        } else if (property === 'fontStyle') {
          newClassFromStyleManager = value === 'italic' ? 'italic' : null;
        }

        // Use surgical replacement: only remove/add the specific property type
        let removePattern;
        if (property === 'fontSize') {
          removePattern = /^text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)$/;
        } else if (property === 'fontWeight') {
          removePattern = /^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/;
        } else if (property === 'fontStyle') {
          removePattern = /^italic$/;
        }

        const finalClassName = replaceSpecificClass(databaseClassName, newClassFromStyleManager, removePattern);

        styledElement.className = finalClassName;

        // Re-capture ALL inline styles after the class change to ensure nothing is lost
        const finalInlineStyles = {};
        if (styledElement.style) {
          for (let i = 0; i < styledElement.style.length; i++) {
            const styleProp = styledElement.style[i];
            const styleValue = styledElement.style.getPropertyValue(styleProp);
            if (styleValue && styleValue.trim() !== '') {
              finalInlineStyles[styleProp] = styleValue;
            }
          }
        }

        // Update local state for UI responsiveness with preserved styles
        setTimeout(() => {
          // Re-read current color to prevent yellow color picker issue
          const currentComputedStyle = window.getComputedStyle(styledElement);
          let currentColor = finalInlineStyles.color || elementProperties.styles.color; // Keep existing color by default

          // Only update color if we can detect a valid one
          if (currentComputedStyle.color && currentComputedStyle.color !== 'rgba(0, 0, 0, 0)' && currentComputedStyle.color !== 'transparent') {
            if (currentComputedStyle.color.startsWith('rgb')) {
              const rgbMatch = currentComputedStyle.color.match(/\d+/g);
              if (rgbMatch && rgbMatch.length >= 3) {
                const hex = '#' + rgbMatch.slice(0, 3)
                  .map(x => parseInt(x).toString(16).padStart(2, '0'))
                  .join('');
                currentColor = hex;
              }
            } else if (currentComputedStyle.color.startsWith('#')) {
              currentColor = currentComputedStyle.color;
            }
          }

          setElementProperties(prev => ({
            ...prev,
            className: finalClassName, // Use clean finalClassName, not contaminated DOM className
            styles: {
              ...prev.styles,
              ...finalInlineStyles,
              color: currentColor // Use re-detected color
            }
          }));
        }, 10);

        // CRITICAL: Use clean finalClassName for save, not contaminated DOM className!
        const classBasedClassNameForSave = finalClassName
          .split(' ')
          .filter(cls => cls && !isWrapperOrEditorClass(cls))
          .join(' ');

        // Save immediately using parent callback with ALL inline styles (re-captured after class change)
        if (onInlineClassChange) {
          onInlineClassChange(elementSlotId, classBasedClassNameForSave, finalInlineStyles);
        }
      }
    } else {
      // Handle inline style properties - apply immediately
      // PRESERVE TAILWIND CLASSES (bold, italic, font-size, etc.) when changing inline styles

      // CRITICAL: For text slots in UnifiedSlotRenderer (line 96), BOTH className AND style
      // are on the content wrapper, NOT the GridColumn wrapper with data-slot-id.
      // So we should read/write EVERYTHING to styledElement (the content wrapper).
      const targetElement = styledElement;

      const currentInlineStyles = {};
      const currentTailwindClasses = [];

      // Preserve all inline styles from targetElement (content wrapper with classes/styles)
      if (targetElement.style) {
        for (let i = 0; i < targetElement.style.length; i++) {
          const styleProp = targetElement.style[i];
          const styleValue = targetElement.style.getPropertyValue(styleProp);
          if (styleValue && styleValue.trim() !== '') {
            currentInlineStyles[styleProp] = styleValue;
          }
        }
      }

      // CRITICAL: Preserve ALL classes from DATABASE (storedClassName), NOT from contaminated DOM element!
      // The DOM element might have wrapper classes, but storedClassName is the clean source of truth
      const elementSlotConfig = elementSlotId === slotId ? slotConfig : allSlots[elementSlotId];
      let databaseClassName = elementSlotConfig?.className || '';

      // If database className is empty, check allSlots for a base template
      if (!databaseClassName) {
        // Extract base template ID (remove _0, _1, etc. suffix for template slots)
        const baseTemplateId = elementSlotId.replace(/_\d+$/, '');
        const templateSlot = allSlots?.[baseTemplateId];
        if (templateSlot?.className) {
          databaseClassName = templateSlot.className;
        }
      }

      // Preserve ALL classes from database (except wrapper/editor classes)
      const currentClasses = databaseClassName.split(' ').filter(Boolean);
      currentClasses.forEach(cls => {
        // Skip wrapper/editor classes, but keep everything else
        if (!isWrapperOrEditorClass(cls)) {
          currentTailwindClasses.push(cls);
        }
      });

      const formattedValue = typeof value === 'number' || /^\d+$/.test(value) ? value + 'px' : value;

      targetElement.style[property] = formattedValue;

      // Special handling for border properties to ensure visibility
      if (property === 'borderWidth' && parseInt(formattedValue) > 0) {
        // Automatically set border style to solid if not already set
        if (!targetElement.style.borderStyle || targetElement.style.borderStyle === 'none') {
          targetElement.style.borderStyle = 'solid';
        }
        // Set default border color if not already set
        if (!targetElement.style.borderColor) {
          targetElement.style.borderColor = '#e5e7eb'; // Default gray color
        }
      }

      // Restore ALL preserved inline styles to targetElement
      Object.entries(currentInlineStyles).forEach(([styleProp, styleValue]) => {
        if (styleProp !== property) { // Don't overwrite the property we just changed
          targetElement.style.setProperty(styleProp, styleValue);
        }
      });

      // Build final className from preserved DATABASE classes + new property
      // Don't read from DOM - it might be contaminated!
      const finalClassName = currentTailwindClasses.join(' ');
      targetElement.className = finalClassName;

      // CRITICAL: Save the className we actually used (including static config fallback)
      // This ensures classes are persisted to database even if they came from static config
      const classNameForSave = finalClassName
        .split(' ')
        .filter(cls => cls && !isWrapperOrEditorClass(cls))
        .join(' ');

      // Update local state for UI responsiveness
      // SAFETY: Ensure className is a clean string
      const safeClassName = (typeof targetElement.className === 'string' && !targetElement.className.includes('<'))
        ? targetElement.className
        : (targetElement.getAttribute('class') || '');

      setElementProperties(prev => ({
        ...prev,
        className: safeClassName,
        styles: {
          ...prev.styles,
          ...currentInlineStyles,
          [property]: formattedValue,
          // Include auto-set border properties in state
          ...(property === 'borderWidth' && parseInt(formattedValue) > 0 ? {
            borderStyle: targetElement.style.borderStyle,
            borderColor: targetElement.style.borderColor
          } : {})
        }
      }));

      // Save immediately using parent callback (for inline styles, we update classes to persist)
      console.log(`💾 STYLE CHANGE - Saving to database:`, {
        elementSlotId,
        property,
        formattedValue,
        hasCallback: !!onInlineClassChange,
        className: targetElement.className,
        styles: { ...currentInlineStyles, [property]: formattedValue },
        isButtonBackgroundColor: elementSlotId === 'add_to_cart_button' && property === 'backgroundColor'
      });

      if (onInlineClassChange) {
        // Include auto-set border properties in save data
        // CRITICAL: Also filter out grid wrapper inline styles before saving!
        // These styles should NEVER be on content elements - only on GridColumn wrappers
        const isWrapperStyle = (styleProp) => {
          // Grid layout styles
          if (['z-index', 'zIndex', 'grid-column', 'gridColumn'].includes(styleProp)) return true;

          // Cursor styles from wrapper
          if (['cursor'].includes(styleProp)) return true;

          // Transition styles from wrapper
          if (styleProp.startsWith('transition')) return true;

          // REMOVED: Border styles are USER-SET, not wrapper styles!
          // Don't filter out borderWidth, borderStyle, borderColor, borderRadius
          // These are legitimate user styling that should be saved

          // Positioning from wrapper (but allow display:flex which users might set)
          if (['position', 'boxSizing', 'box-sizing'].includes(styleProp)) return true;

          return false;
        };

        const saveStyles = { ...currentInlineStyles, [property]: formattedValue };

        // Remove all wrapper styles and kebab-case duplicates
        Object.keys(saveStyles).forEach(styleProp => {
          if (isWrapperStyle(styleProp)) {
            delete saveStyles[styleProp];
          }
          // Remove kebab-case properties (background-color, border-radius, etc.)
          // Keep camelCase versions only (backgroundColor, borderRadius, etc.)
          if (styleProp.includes('-')) {
            delete saveStyles[styleProp];
          }
        });

        // Include auto-set border properties in save data (these were explicitly removed earlier)
        if (property === 'borderWidth' && parseInt(formattedValue) > 0) {
          // Re-add these specific border properties since they're user-set
          if (!saveStyles.borderStyle) saveStyles.borderStyle = targetElement.style.borderStyle;
          if (!saveStyles.borderColor) saveStyles.borderColor = targetElement.style.borderColor;
        }

        // MIRROR: If this is a product template instance (has _N suffix), save to base template FIRST
        // This ensures the template has the latest styles before the instance
        let baseTemplateId = elementSlotId.replace(/_\d+$/, '');

        // Special case: product_card_N should map to product_card_template
        if (baseTemplateId === 'product_card') {
          baseTemplateId = 'product_card_template';
        }

        if (baseTemplateId !== elementSlotId) {
          console.log(`🔄 Mirroring style change to template ${baseTemplateId}`, {
            instanceId: elementSlotId,
            templateId: baseTemplateId,
            className: classNameForSave,
            styles: saveStyles
          });
          onInlineClassChange(baseTemplateId, classNameForSave, saveStyles);
        }

        // Save to current slot AFTER mirroring to template
        // This ensures both are saved in the correct order
        onInlineClassChange(elementSlotId, classNameForSave, saveStyles);
      } else {
        console.error(`❌ STYLE CHANGE - No onInlineClassChange callback!`);
      }
    }
  }, [selectedElement, handleAlignmentChange, onInlineClassChange, isWrapperOrEditorClass, slotId, slotConfig, allSlots]);

  const SectionHeader = ({ title, section, children }) => (
    <div className="border-b border-gray-200">
      <button
        onClick={(e) => {
          e.stopPropagation();
          toggleSection(section);
        }}
        className="w-full flex items-center justify-between p-3 text-left text-sm font-medium text-gray-900 hover:bg-gray-50"
      >
        <span>{title}</span>
        {expandedSections[section] ? 
          <ChevronDown className="w-4 h-4" /> : 
          <ChevronRight className="w-4 h-4" />
        }
      </button>
      {expandedSections[section] && (
        <div className="p-3 bg-gray-50">
          {children}
        </div>
      )}
    </div>
  );

  // Check if slot or any parent has a specialized sidebar configured
  // This allows child slots (like filter_option_styles) to use parent's sidebar (LayeredNavigationSidebar)
  const findSpecializedSidebar = useCallback(() => {
    console.log('🔍 [EditorSidebar] Finding specialized sidebar for:', {
      slotId,
      slotConfig,
      hasMetadata: !!slotConfig?.metadata,
      editorSidebar: slotConfig?.metadata?.editorSidebar,
      parentId: slotConfig?.parentId,
      allSlotsKeys: Object.keys(allSlots || {})
    });

    // First check the current slot
    if (slotConfig?.metadata?.editorSidebar) {
      console.log('✅ [EditorSidebar] Found editorSidebar on current slot:', slotConfig.metadata.editorSidebar);
      return {
        sidebarName: slotConfig.metadata.editorSidebar,
        parentSlotId: slotId
      };
    }

    // Then traverse up the parent chain
    let currentParentId = slotConfig?.parentId;
    let depth = 0;
    while (currentParentId && allSlots[currentParentId] && depth < 10) {
      const parentSlot = allSlots[currentParentId];
      console.log(`🔍 [EditorSidebar] Checking parent (depth ${depth}):`, {
        parentId: currentParentId,
        parentSlot,
        hasEditorSidebar: !!parentSlot?.metadata?.editorSidebar
      });

      if (parentSlot?.metadata?.editorSidebar) {
        console.log('✅ [EditorSidebar] Found editorSidebar on parent:', parentSlot.metadata.editorSidebar);
        return {
          sidebarName: parentSlot.metadata.editorSidebar,
          parentSlotId: currentParentId
        };
      }
      currentParentId = parentSlot?.parentId;
      depth++;
    }

    console.log('❌ [EditorSidebar] No specialized sidebar found');
    return { sidebarName: null, parentSlotId: null };
  }, [slotConfig, slotId, allSlots]);

  const { sidebarName: specializedSidebarName, parentSlotId: sidebarParentSlotId } = findSpecializedSidebar();
  const [SpecializedSidebar, setSpecializedSidebar] = useState(null);

  // Dynamically load the specialized sidebar component
  useEffect(() => {
    if (specializedSidebarName && SIDEBAR_COMPONENTS[specializedSidebarName]) {
      const loadSidebar = async () => {
        try {
          const module = await SIDEBAR_COMPONENTS[specializedSidebarName]();
          setSpecializedSidebar(() => module.default);
        } catch (error) {
          console.error(`Failed to load sidebar: ${specializedSidebarName}`, error);
        }
      };

      loadSidebar();
    } else {
      setSpecializedSidebar(null);
    }
  }, [specializedSidebarName]);

  // Only show sidebar when a slot element is selected
  if (!isVisible || !isSlotElement) return null;

  // Render specialized sidebar if configured and loaded
  if (specializedSidebarName && SIDEBAR_COMPONENTS[specializedSidebarName]) {
    // Show loading state while sidebar is loading
    if (!SpecializedSidebar) {
      return (
        <div className="fixed top-0 right-0 h-screen w-80 bg-white border-l border-gray-200 shadow-lg flex items-center justify-center editor-sidebar" style={{ zIndex: 1000 }}>
          <div className="text-gray-500">Loading sidebar...</div>
        </div>
      );
    }

    // Render the loaded specialized sidebar
    // Use parent slot config if the sidebar was found via parent traversal
    const sidebarSlotId = sidebarParentSlotId || slotId;
    const sidebarSlotConfig = sidebarParentSlotId ? allSlots[sidebarParentSlotId] : slotConfig;

    return (
      <SpecializedSidebar
        slotId={sidebarSlotId}
        slotConfig={sidebarSlotConfig}
        allSlots={allSlots}
        onClassChange={onClassChange}
        onTextChange={onTextChange}
        onClearSelection={onClearSelection}
      />
    );
  }

  // Default general sidebar
  return (
    <div className="fixed top-0 right-0 h-screen w-80 bg-white border-l border-gray-200 shadow-lg flex flex-col editor-sidebar" style={{ zIndex: 1000 }}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">
          Element Properties
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearSelection}
          className="h-6 w-6 p-0"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Element Info */}
        <div className="p-4 bg-blue-50 border-b border-gray-200">
          <p className="text-sm text-blue-800 font-medium">
            {selectedElement.tagName?.toLowerCase() || 'element'}
            {lastSelectedButton && lastSelectedButton.slotId === slotId && (
              <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                Button Selected
              </span>
            )}
            {isHtmlElement && (
              <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs bg-orange-100 text-orange-800">
                HTML Editable
              </span>
            )}
          </p>
          <p className="text-xs text-blue-600">
            {selectedElement.className || 'No classes'}
          </p>
          {lastSelectedButton && lastSelectedButton.slotId === slotId && (
            <p className="text-xs text-green-600 mt-1">
              ✓ Button styling will persist until new selection
            </p>
          )}
          {isHtmlElement && (
            <p className="text-xs text-orange-600 mt-1">
              ✓ HTML content can be edited directly
            </p>
          )}
        </div>

        {/* Content Section - hide for styleOnly/readOnly slots (product cards) */}
        {!slotConfig?.metadata?.styleOnly && !slotConfig?.metadata?.readOnly && (
          <SectionHeader title="Content" section="content">
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label htmlFor="textContent" className="text-xs font-medium">Text Content</Label>
                  {isTranslatable && (
                    <div className="flex items-center gap-1 text-green-600">
                      <Globe className="w-3 h-3" />
                      <span className="text-xs">Translatable</span>
                    </div>
                  )}
                </div>
                <textarea
                  ref={textContentRef}
                  id="textContent"
                  defaultValue={localTextContent}
                  onChange={handleTextContentChange}
                  onBlur={handleTextContentSave}
                  className={`w-full mt-1 text-xs border rounded-md p-2 h-20 resize-none ${
                    isTranslatable ? 'border-green-300 bg-green-50' : 'border-gray-300'
                  }`}
                  placeholder="Enter text content..."
                />

                {/* Make Translatable Button - show when content is not translatable */}
                {!isTranslatable && localTextContent && (
                  <div className="mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        const text = textContentRef.current?.value || localTextContent;
                        if (!text || !text.trim()) return;

                        // Generate a translation key from the text
                        const key = `editor.${slotId}.${Date.now()}`;

                        // Save this text as a new translation and auto-translate
                        setIsAutoTranslating(true);
                        try {
                          await api.post('/translations/auto-translate-ui-label', {
                            key: key,
                            value: text,
                            category: 'editor',
                            fromLang: currentLanguage
                          });

                          // Update state to show as translatable
                          setIsTranslatable(true);
                          setTranslationKey(key);
                          setTranslatedValue(text);

                          // Save the key instead of plain text
                          if (onTextChange) {
                            onTextChange(slotId, key);
                          }
                        } catch (error) {
                          console.error('Failed to make text translatable:', error);
                        } finally {
                          setIsAutoTranslating(false);
                        }
                      }}
                      className="h-7 px-2 text-xs w-full"
                    >
                      <Globe className="w-3 h-3 mr-1" />
                      Make Translatable
                    </Button>
                  </div>
                )}

                {/* Translation Info Panel */}
                {isTranslatable && translationKey && (
                  <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-xs">
                    <p className="font-medium text-green-900">Translation Key: {translationKey}</p>
                    {translatedValue && (
                      <p className="text-green-700 mt-1">
                        {currentLanguage} value: {translatedValue}
                      </p>
                    )}
                    {isAutoTranslating && (
                      <p className="text-green-600 mt-1 flex items-center gap-1">
                        <Globe className="w-3 h-3 animate-spin" />
                        Auto-translating to all active languages...
                      </p>
                    )}
                  </div>
                )}
              </div>
            
            {/* HTML Content Editor - only show for HTML elements */}
            {isHtmlElement && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label htmlFor="htmlContent" className="text-xs font-medium">HTML Content</Label>
                  <div className="flex items-center gap-1">
                    <Shield className="w-3 h-3 text-green-600" />
                    <span className="text-xs text-green-600 font-medium">XSS Protected</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1 mb-2">Edit HTML content - automatically sanitized for security</p>
                <textarea
                  ref={htmlContentRef}
                  id="htmlContent"
                  defaultValue={localHtmlContent}
                  onInput={handleHtmlContentInput}
                  onBlur={handleHtmlContentSave}
                  className={`w-full mt-1 text-xs font-mono border rounded-md p-2 h-32 resize-none ${
                    htmlValidation.error 
                      ? 'border-red-300 bg-red-50' 
                      : htmlValidation.wasModified 
                        ? 'border-yellow-300 bg-yellow-50'
                        : 'border-gray-300'
                  }`}
                  placeholder="<button class='btn btn-primary'>Click me</button>"
                />
                
                {/* Validation Feedback */}
                {htmlValidation.error && (
                  <div className="flex items-start gap-1 mt-2 p-2 bg-red-50 border border-red-200 rounded">
                    <AlertTriangle className="w-3 h-3 text-red-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-red-700 font-medium">Security Error</p>
                      <p className="text-xs text-red-600">{htmlValidation.error}</p>
                    </div>
                  </div>
                )}

                {htmlValidation.warnings.length > 0 && (
                  <div className="mt-2">
                    {htmlValidation.warnings.map((warning, index) => (
                      <p key={index} className="text-xs text-yellow-600">⚠️ {warning}</p>
                    ))}
                  </div>
                )}
                
                <div className="flex items-center gap-2 mt-2 p-2 bg-blue-50 border border-blue-200 rounded">
                  <Shield className="w-3 h-3 text-blue-600" />
                  <div className="text-xs text-blue-700">
                    <p className="font-medium">Security Level: Editor</p>
                    <p>Allows common HTML elements while preventing XSS attacks</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </SectionHeader>
        )}


            {/* Size Section - hide for styleOnly/readOnly slots */}
            {!slotConfig?.metadata?.styleOnly && !slotConfig?.metadata?.readOnly && (
            <SectionHeader title="Size" section="size">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="width" className="text-xs font-medium">Width</Label>
                    <div className="flex items-center mt-1">
                      {elementProperties.styles?.width === 'fit-content' || !elementProperties.styles?.width ? (
                        <div className="text-xs h-7 px-3 py-1 border rounded-md bg-gray-50 text-gray-600 flex items-center w-full">
                          fit-content
                        </div>
                      ) : (
                        <>
                          <Input
                            id="width"
                            type="number"
                            value={parseInt(elementProperties.styles?.width) || 100}
                            onChange={(e) => handlePropertyChange('width', `${e.target.value}%`)}
                            className="text-xs h-7"
                            placeholder="100"
                            min="5"
                            max="500"
                            step="5"
                          />
                          <span className="ml-1 text-xs text-gray-500">%</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="height" className="text-xs font-medium">Height</Label>
                    <div className="flex items-center mt-1">
                      <Input
                        id="height"
                        type="number"
                        value={parseInt(elementProperties.styles?.minHeight) || 40}
                        onChange={(e) => handlePropertyChange('minHeight', `${e.target.value}px`)}
                        className="text-xs h-7"
                        placeholder="Auto"
                        min="20"
                        max="500"
                        step="10"
                      />
                      <span className="ml-1 text-xs text-gray-500">px</span>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Quick Width</Label>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePropertyChange('width', 'fit-content')}
                      className="h-7 px-2 text-xs"
                    >
                      Fit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePropertyChange('width', '50%')}
                      className="h-7 px-2 text-xs"
                    >
                      50%
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePropertyChange('width', '75%')}
                      className="h-7 px-2 text-xs"
                    >
                      75%
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePropertyChange('width', '100%')}
                      className="h-7 px-2 text-xs"
                    >
                      100%
                    </Button>
                  </div>
                  <div className="flex items-center gap-1 mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePropertyChange('width', '150%')}
                      className="h-7 px-2 text-xs"
                    >
                      150%
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePropertyChange('width', '200%')}
                      className="h-7 px-2 text-xs"
                    >
                      200%
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePropertyChange('width', '250%')}
                      className="h-7 px-2 text-xs"
                    >
                      250%
                    </Button>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      handlePropertyChange('width', 'auto');
                      handlePropertyChange('height', 'auto');
                    }}
                    className="h-7 px-2 text-xs"
                  >
                    Auto Size
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      handlePropertyChange('width', '100%');
                      handlePropertyChange('maxWidth', '100%');
                    }}
                    className="h-7 px-2 text-xs"
                  >
                    <Maximize2 className="w-3 h-3 mr-1" />
                    Fill
                  </Button>
                </div>
              </div>
            </SectionHeader>
            )}

            {/* Text Section */}
            <SectionHeader title="Typography" section="text">
              <div className="space-y-3">
                <div>
                  <Label htmlFor="fontSize" className="text-xs font-medium">Font Size</Label>
                  <select
                    id="fontSize"
                    value={getCurrentFontSize(elementProperties.className)}
                    onChange={(e) => handlePropertyChange('fontSize', e.target.value)}
                    className="w-full mt-1 h-7 text-xs border border-gray-300 rounded-md"
                  >
                    <option value="xs">XS</option>
                    <option value="sm">SM</option>
                    <option value="base">Base</option>
                    <option value="lg">LG</option>
                    <option value="xl">XL</option>
                    <option value="2xl">2XL</option>
                    <option value="3xl">3XL</option>
                    <option value="4xl">4XL</option>
                  </select>
                </div>

                <div className="flex gap-1">
                  <Button
                    variant={isBold(elementProperties.className) ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      const currentlyBold = isBold(elementProperties.className);
                      handlePropertyChange('fontWeight', currentlyBold ? 'normal' : 'bold');
                    }}
                    className="h-7 px-2"
                  >
                    <Bold className="w-3 h-3" />
                  </Button>
                  <Button
                    variant={isItalic(elementProperties.className) ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      const currentlyItalic = isItalic(elementProperties.className);
                      handlePropertyChange('fontStyle', currentlyItalic ? 'normal' : 'italic');
                    }}
                    className="h-7 px-2"
                  >
                    <Italic className="w-3 h-3" />
                  </Button>
                </div>

                <div className="flex gap-1">
                  <Button
                    variant={currentAlignment === 'left' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      handlePropertyChange('textAlign', 'left');
                    }}
                    className="h-7 px-2"
                  >
                    <AlignLeft className="w-3 h-3" />
                  </Button>
                  <Button
                    variant={currentAlignment === 'center' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      handlePropertyChange('textAlign', 'center');
                    }}
                    className="h-7 px-2"
                  >
                    <AlignCenter className="w-3 h-3" />
                  </Button>
                  <Button
                    variant={currentAlignment === 'right' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      handlePropertyChange('textAlign', 'right');
                    }}
                    className="h-7 px-2"
                  >
                    <AlignRight className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </SectionHeader>

            {/* Appearance Section */}
            <SectionHeader title="Appearance" section="appearance">
              <div className="space-y-3">
                <div>
                  <Label htmlFor="textColor" className="text-xs font-medium">Text Color</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      id="textColor"
                      type="color"
                      value={elementProperties.styles.color && elementProperties.styles.color.startsWith('#') ? elementProperties.styles.color : '#000000'}
                      onChange={(e) => handlePropertyChange('color', e.target.value)}
                      className="w-8 h-7 rounded border border-gray-300"
                    />
                    <Input
                      value={elementProperties.styles.color || ''}
                      onChange={(e) => handlePropertyChange('color', e.target.value)}
                      className="text-xs h-7"
                      placeholder={elementProperties.styles.color || 'No color set'}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="bgColor" className="text-xs font-medium">Background</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      id="bgColor"
                      type="color"
                      value={(() => {
                        const bgColor = elementProperties.styles.backgroundColor;
                        // Skip template variables, use computed color if possible
                        if (bgColor && bgColor.includes('{{')) return '#ffffff';
                        return bgColor && bgColor.startsWith('#') ? bgColor : '#ffffff';
                      })()}
                      onChange={(e) => handlePropertyChange('backgroundColor', e.target.value)}
                      className="w-8 h-7 rounded border border-gray-300"
                    />
                    <Input
                      value={(() => {
                        const bgColor = elementProperties.styles.backgroundColor || '';
                        // Show hex color, not template variables
                        if (bgColor.includes('{{')) return '';
                        return bgColor;
                      })()}
                      onChange={(e) => handlePropertyChange('backgroundColor', e.target.value)}
                      className="text-xs h-7"
                      placeholder="Enter hex color"
                    />
                  </div>
                </div>
              </div>
            </SectionHeader>

            {/* Border Section */}
            <SectionHeader title="Border" section="border">
              <div className="space-y-3">
                {/* Border Controls */}
                <div>
                  <Label className="text-xs font-medium mb-2 block">Border</Label>
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <div>
                      <Label htmlFor="borderWidth" className="text-xs">Width</Label>
                      <Input
                        id="borderWidth"
                        type="number"
                        value={parseInt(elementProperties.styles.borderWidth) || 0}
                        onChange={(e) => handlePropertyChange('borderWidth', e.target.value)}
                        className="text-xs h-6"
                        placeholder="0"
                        min="0"
                        max="10"
                      />
                    </div>
                    <div>
                      <Label htmlFor="borderStyle" className="text-xs">Style</Label>
                      <select
                        id="borderStyle"
                        value={elementProperties.styles.borderStyle || 'solid'}
                        onChange={(e) => handlePropertyChange('borderStyle', e.target.value)}
                        className="w-full mt-1 h-6 text-xs border border-gray-300 rounded-md"
                      >
                        <option value="none">None</option>
                        <option value="solid">Solid</option>
                        <option value="dashed">Dashed</option>
                        <option value="dotted">Dotted</option>
                        <option value="double">Double</option>
                        <option value="groove">Groove</option>
                        <option value="ridge">Ridge</option>
                        <option value="inset">Inset</option>
                        <option value="outset">Outset</option>
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="borderRadius" className="text-xs">Radius</Label>
                      <Input
                        id="borderRadius"
                        type="number"
                        value={parseInt(elementProperties.styles.borderRadius) || 0}
                        onChange={(e) => handlePropertyChange('borderRadius', e.target.value)}
                        className="text-xs h-6"
                        placeholder="0"
                        min="0"
                        max="50"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="borderColor" className="text-xs">Color</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        id="borderColor"
                        type="color"
                        value={elementProperties.styles.borderColor && elementProperties.styles.borderColor.startsWith('#') ? elementProperties.styles.borderColor : '#e5e7eb'}
                        onChange={(e) => handlePropertyChange('borderColor', e.target.value)}
                        className="w-8 h-6 rounded border border-gray-300"
                      />
                      <Input
                        value={elementProperties.styles.borderColor || ''}
                        onChange={(e) => handlePropertyChange('borderColor', e.target.value)}
                        className="text-xs h-6"
                        placeholder={elementProperties.styles.borderColor || 'No border color set'}
                      />
                    </div>
                  </div>
                </div>

                {/* Shadow & Effects */}
                <div>
                  <Label className="text-xs font-medium mb-2 block">Effects</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="opacity" className="text-xs">Opacity</Label>
                      <Input
                        id="opacity"
                        type="number"
                        value={elementProperties.styles.opacity || 1}
                        onChange={(e) => handlePropertyChange('opacity', e.target.value)}
                        className="text-xs h-6"
                        placeholder="1"
                        min="0"
                        max="1"
                        step="0.1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="zIndex" className="text-xs">Z-Index</Label>
                      <Input
                        id="zIndex"
                        type="number"
                        value={elementProperties.styles.zIndex || 0}
                        onChange={(e) => handlePropertyChange('zIndex', e.target.value)}
                        className="text-xs h-6"
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div className="mt-2">
                    <Label htmlFor="boxShadow" className="text-xs">Shadow</Label>
                    <select
                      id="boxShadow"
                      value={elementProperties.styles.boxShadow || 'none'}
                      onChange={(e) => handlePropertyChange('boxShadow', e.target.value)}
                      className="w-full mt-1 h-6 text-xs border border-gray-300 rounded-md"
                    >
                      <option value="none">None</option>
                      <option value="0 1px 3px rgba(0,0,0,0.12)">Small</option>
                      <option value="0 4px 6px rgba(0,0,0,0.1)">Medium</option>
                      <option value="0 10px 25px rgba(0,0,0,0.15)">Large</option>
                      <option value="0 20px 40px rgba(0,0,0,0.1)">X-Large</option>
                    </select>
                  </div>
                </div>

                {/* Layout & Position */}
                <div>
                  <Label className="text-xs font-medium mb-2 block">Layout</Label>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>
                      <Label htmlFor="display" className="text-xs">Display</Label>
                      <select
                        id="display"
                        value={elementProperties.styles.display || 'block'}
                        onChange={(e) => handlePropertyChange('display', e.target.value)}
                        className="w-full mt-1 h-6 text-xs border border-gray-300 rounded-md"
                      >
                        <option value="block">Block</option>
                        <option value="inline">Inline</option>
                        <option value="inline-block">Inline Block</option>
                        <option value="flex">Flex</option>
                        <option value="grid">Grid</option>
                        <option value="none">None</option>
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="position" className="text-xs">Position</Label>
                      <select
                        id="position"
                        value={elementProperties.styles.position || 'static'}
                        onChange={(e) => handlePropertyChange('position', e.target.value)}
                        className="w-full mt-1 h-6 text-xs border border-gray-300 rounded-md"
                      >
                        <option value="static">Static</option>
                        <option value="relative">Relative</option>
                        <option value="absolute">Absolute</option>
                        <option value="fixed">Fixed</option>
                        <option value="sticky">Sticky</option>
                      </select>
                    </div>
                  </div>

                  {/* Flex Controls - only show when display is flex */}
                  {elementProperties.styles.display === 'flex' && (
                    <div className="mt-2 p-2 bg-blue-50 rounded">
                      <Label className="text-xs font-medium mb-1 block">Flex Properties</Label>
                      <div className="grid grid-cols-1 gap-2">
                        <div>
                          <Label htmlFor="flexDirection" className="text-xs">Direction</Label>
                          <select
                            id="flexDirection"
                            value={elementProperties.styles.flexDirection || 'row'}
                            onChange={(e) => handlePropertyChange('flexDirection', e.target.value)}
                            className="w-full mt-1 h-6 text-xs border border-gray-300 rounded-md"
                          >
                            <option value="row">Row</option>
                            <option value="column">Column</option>
                            <option value="row-reverse">Row Reverse</option>
                            <option value="column-reverse">Column Reverse</option>
                          </select>
                        </div>
                        <div>
                          <Label htmlFor="justifyContent" className="text-xs">Justify</Label>
                          <select
                            id="justifyContent"
                            value={elementProperties.styles.justifyContent || 'flex-start'}
                            onChange={(e) => handlePropertyChange('justifyContent', e.target.value)}
                            className="w-full mt-1 h-6 text-xs border border-gray-300 rounded-md"
                          >
                            <option value="flex-start">Start</option>
                            <option value="center">Center</option>
                            <option value="flex-end">End</option>
                            <option value="space-between">Space Between</option>
                            <option value="space-around">Space Around</option>
                            <option value="space-evenly">Space Evenly</option>
                          </select>
                        </div>
                        <div>
                          <Label htmlFor="alignItems" className="text-xs">Align</Label>
                          <select
                            id="alignItems"
                            value={elementProperties.styles.alignItems || 'stretch'}
                            onChange={(e) => handlePropertyChange('alignItems', e.target.value)}
                            className="w-full mt-1 h-6 text-xs border border-gray-300 rounded-md"
                          >
                            <option value="stretch">Stretch</option>
                            <option value="flex-start">Start</option>
                            <option value="center">Center</option>
                            <option value="flex-end">End</option>
                            <option value="baseline">Baseline</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </SectionHeader>

            {/* Layout Section */}
            <SectionHeader title="Spacing" section="layout">
              <div className="space-y-4">
                {/* Padding Controls */}
                <div>
                  <Label className="text-xs font-medium mb-2 block">Padding</Label>
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <div></div>
                    <div>
                      <Input
                        type="number"
                        value={parseInt(elementProperties.styles.paddingTop) || 0}
                        onChange={(e) => handlePropertyChange('paddingTop', e.target.value)}
                        className="text-xs h-6 text-center"
                        placeholder="0"
                        min="0"
                      />
                    </div>
                    <div></div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <div>
                      <Input
                        type="number"
                        value={parseInt(elementProperties.styles.paddingLeft) || 0}
                        onChange={(e) => handlePropertyChange('paddingLeft', e.target.value)}
                        className="text-xs h-6 text-center"
                        placeholder="0"
                        min="0"
                      />
                    </div>
                    <div>
                      <Input
                        type="number"
                        value={parseInt(elementProperties.styles.padding) || 0}
                        onChange={(e) => handlePropertyChange('padding', e.target.value)}
                        className="text-xs h-6 text-center"
                        placeholder="All"
                        min="0"
                      />
                    </div>
                    <div>
                      <Input
                        type="number"
                        value={parseInt(elementProperties.styles.paddingRight) || 0}
                        onChange={(e) => handlePropertyChange('paddingRight', e.target.value)}
                        className="text-xs h-6 text-center"
                        placeholder="0"
                        min="0"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div></div>
                    <div>
                      <Input
                        type="number"
                        value={parseInt(elementProperties.styles.paddingBottom) || 0}
                        onChange={(e) => handlePropertyChange('paddingBottom', e.target.value)}
                        className="text-xs h-6 text-center"
                        placeholder="0"
                        min="0"
                      />
                    </div>
                    <div></div>
                  </div>
                </div>

                {/* Margin Controls */}
                <div>
                  <Label className="text-xs font-medium mb-2 block">Margin</Label>
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <div></div>
                    <div>
                      <Input
                        type="number"
                        value={parseInt(elementProperties.styles.marginTop) || 0}
                        onChange={(e) => handlePropertyChange('marginTop', e.target.value)}
                        className="text-xs h-6 text-center"
                        placeholder="0"
                      />
                    </div>
                    <div></div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <div>
                      <Input
                        type="number"
                        value={parseInt(elementProperties.styles.marginLeft) || 0}
                        onChange={(e) => handlePropertyChange('marginLeft', e.target.value)}
                        className="text-xs h-6 text-center"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <Input
                        type="number"
                        value={parseInt(elementProperties.styles.margin) || 0}
                        onChange={(e) => handlePropertyChange('margin', e.target.value)}
                        className="text-xs h-6 text-center"
                        placeholder="All"
                      />
                    </div>
                    <div>
                      <Input
                        type="number"
                        value={parseInt(elementProperties.styles.marginRight) || 0}
                        onChange={(e) => handlePropertyChange('marginRight', e.target.value)}
                        className="text-xs h-6 text-center"
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div></div>
                    <div>
                      <Input
                        type="number"
                        value={parseInt(elementProperties.styles.marginBottom) || 0}
                        onChange={(e) => handlePropertyChange('marginBottom', e.target.value)}
                        className="text-xs h-6 text-center"
                        placeholder="0"
                      />
                    </div>
                    <div></div>
                  </div>
                </div>
              </div>
            </SectionHeader>
      </div>
    </div>
  );
};

export default EditorSidebar;