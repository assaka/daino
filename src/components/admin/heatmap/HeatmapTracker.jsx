import { useEffect, useRef, useState } from 'react';

class HeatmapTracker {
  constructor(config = {}) {
    // Build API endpoint consistently with the main API client
    const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
    const apiEndpoint = import.meta.env.DEV 
      ? '/api/heatmap'  // Use proxy in development
      : `${baseURL}/api/heatmap`;  // Use full URL in production

    this.config = {
      storeId: null,
      apiEndpoint: apiEndpoint,
      batchSize: 20,
      batchTimeout: 5000, // 5 seconds
      trackClicks: true,
      trackHovers: true,
      trackScrolls: true,
      trackMouseMovement: false, // Can be performance intensive
      trackTouches: true,
      trackFocus: true,
      trackKeyPresses: false, // Privacy consideration
      hoverThreshold: 1000, // 1 second minimum hover time
      scrollThreshold: 100, // 100ms throttle for scroll events
      mouseMoveThrottle: 100, // 100ms throttle for mouse movement
      excludeSelectors: ['.heatmap-exclude', '[data-heatmap-exclude]'],
      ...config
    };

    this.sessionId = this.generateSessionId();
    this.interactions = [];
    this.batchTimer = null;
    this.isTracking = false;
    this.viewport = { width: 0, height: 0 };
    this.hoverTimer = null;
    this.lastHoverElement = null;
    this.scrollTimer = null;
    this.mouseMoveTimer = null;

    // Initialize tracking if store ID is provided
    if (this.config.storeId) {
      this.init();
    }
  }

  // Initialize tracking
  init() {
    if (this.isTracking) return;

    this.updateViewport();
    this.setupEventListeners();
    this.isTracking = true;
  }

  // Stop tracking and flush remaining data
  destroy() {
    if (!this.isTracking) return;

    this.removeEventListeners();
    this.flushBatch();
    this.isTracking = false;
  }

  // Generate a unique session ID
  generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // Update viewport dimensions
  updateViewport() {
    this.viewport.width = window.innerWidth || document.documentElement.clientWidth;
    this.viewport.height = window.innerHeight || document.documentElement.clientHeight;
  }

  // Setup event listeners
  setupEventListeners() {
    // Click tracking
    if (this.config.trackClicks) {
      document.addEventListener('click', this.handleClick.bind(this), { passive: true });
    }

    // Hover tracking
    if (this.config.trackHovers) {
      document.addEventListener('mouseover', this.handleMouseOver.bind(this), { passive: true });
      document.addEventListener('mouseout', this.handleMouseOut.bind(this), { passive: true });
    }

    // Scroll tracking
    if (this.config.trackScrolls) {
      window.addEventListener('scroll', this.handleScroll.bind(this), { passive: true });
    }

    // Mouse movement tracking (optional)
    if (this.config.trackMouseMovement) {
      document.addEventListener('mousemove', this.handleMouseMove.bind(this), { passive: true });
    }

    // Touch tracking for mobile
    if (this.config.trackTouches) {
      document.addEventListener('touchstart', this.handleTouch.bind(this), { passive: true });
    }

    // Focus tracking
    if (this.config.trackFocus) {
      document.addEventListener('focusin', this.handleFocus.bind(this), { passive: true });
    }

    // Key press tracking (optional)
    if (this.config.trackKeyPresses) {
      document.addEventListener('keydown', this.handleKeyPress.bind(this), { passive: true });
    }

    // Resize tracking
    window.addEventListener('resize', this.handleResize.bind(this), { passive: true });

    // Page visibility changes
    document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));

    // Before page unload
    window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this));
  }

  // Remove event listeners
  removeEventListeners() {
    document.removeEventListener('click', this.handleClick);
    document.removeEventListener('mouseover', this.handleMouseOver);
    document.removeEventListener('mouseout', this.handleMouseOut);
    window.removeEventListener('scroll', this.handleScroll);
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('touchstart', this.handleTouch);
    document.removeEventListener('focusin', this.handleFocus);
    document.removeEventListener('keydown', this.handleKeyPress);
    window.removeEventListener('resize', this.handleResize);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('beforeunload', this.handleBeforeUnload);
  }

  // Handle click events
  handleClick(event) {
    if (this.shouldExcludeElement(event.target)) return;

    const elementInfo = this.getElementInfo(event.target);
    // Use pageX/pageY to get absolute page coordinates (includes scroll offset)
    // Fallback to clientX/Y + scroll offsets for compatibility
    const x = event.pageX ?? (event.clientX + window.pageXOffset);
    const y = event.pageY ?? (event.clientY + window.pageYOffset);

    this.trackInteraction({
      interaction_type: 'click',
      x_coordinate: x,
      y_coordinate: y,
      ...elementInfo
    });
  }

  // Handle mouse over events
  handleMouseOver(event) {
    if (this.shouldExcludeElement(event.target)) return;

    this.lastHoverElement = event.target;
    this.hoverStartTime = Date.now();

    // Set timer to track hover after threshold
    this.hoverTimer = setTimeout(() => {
      if (this.lastHoverElement === event.target) {
        const elementInfo = this.getElementInfo(event.target);
        // Use pageX/pageY to get absolute page coordinates (includes scroll offset)
        const x = event.pageX ?? (event.clientX + window.pageXOffset);
        const y = event.pageY ?? (event.clientY + window.pageYOffset);

        this.trackInteraction({
          interaction_type: 'hover',
          x_coordinate: x,
          y_coordinate: y,
          time_on_element: Date.now() - this.hoverStartTime,
          ...elementInfo
        });
      }
    }, this.config.hoverThreshold);
  }

  // Handle mouse out events
  handleMouseOut(event) {
    if (this.hoverTimer) {
      clearTimeout(this.hoverTimer);
      this.hoverTimer = null;
    }
    this.lastHoverElement = null;
  }

  // Handle scroll events (throttled)
  handleScroll() {
    if (this.scrollTimer) return;

    this.scrollTimer = setTimeout(() => {
      const scrollPosition = window.pageYOffset || document.documentElement.scrollTop;
      const documentHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollDepth = documentHeight > 0 ? (scrollPosition / documentHeight) * 100 : 0;
      // Clamp to 0-100 to handle edge cases (resize, dynamic content, browser quirks)
      const clampedScrollDepth = Math.min(100, Math.max(0, scrollDepth));

      this.trackInteraction({
        interaction_type: 'scroll',
        scroll_position: scrollPosition,
        scroll_depth_percent: Math.round(clampedScrollDepth * 100) / 100
      });

      this.scrollTimer = null;
    }, this.config.scrollThreshold);
  }

  // Handle mouse move events (throttled)
  handleMouseMove(event) {
    if (this.mouseMoveTimer) return;

    this.mouseMoveTimer = setTimeout(() => {
      // Use pageX/pageY to get absolute page coordinates (includes scroll offset)
      const x = event.pageX ?? (event.clientX + window.pageXOffset);
      const y = event.pageY ?? (event.clientY + window.pageYOffset);

      this.trackInteraction({
        interaction_type: 'mouse_move',
        x_coordinate: x,
        y_coordinate: y
      });

      this.mouseMoveTimer = null;
    }, this.config.mouseMoveThrottle);
  }

  // Handle touch events
  handleTouch(event) {
    if (this.shouldExcludeElement(event.target)) return;

    const touch = event.touches[0];
    if (touch) {
      const elementInfo = this.getElementInfo(event.target);
      // Use pageX/pageY to get absolute page coordinates (includes scroll offset)
      const x = touch.pageX ?? (touch.clientX + window.pageXOffset);
      const y = touch.pageY ?? (touch.clientY + window.pageYOffset);

      this.trackInteraction({
        interaction_type: 'touch',
        x_coordinate: x,
        y_coordinate: y,
        ...elementInfo
      });
    }
  }

  // Handle focus events
  handleFocus(event) {
    if (this.shouldExcludeElement(event.target)) return;

    const elementInfo = this.getElementInfo(event.target);
    this.trackInteraction({
      interaction_type: 'focus',
      ...elementInfo
    });
  }

  // Handle key press events
  handleKeyPress(event) {
    // Only track functional keys, not actual key values for privacy
    const functionalKeys = ['Enter', 'Tab', 'Escape', 'Backspace', 'Delete'];
    if (functionalKeys.includes(event.key)) {
      this.trackInteraction({
        interaction_type: 'key_press',
        metadata: {
          key: event.key,
          target_tag: event.target.tagName.toLowerCase()
        }
      });
    }
  }

  // Handle window resize
  handleResize() {
    this.updateViewport();
  }

  // Handle visibility change
  handleVisibilityChange() {
    if (document.hidden) {
      // Page became hidden, flush current batch
      this.flushBatch();
    }
  }

  // Handle before unload
  handleBeforeUnload() {
    // Flush remaining interactions before page unloads
    this.flushBatch();
  }

  // Check if element should be excluded from tracking
  shouldExcludeElement(element) {
    if (!element) return true;

    return this.config.excludeSelectors.some(selector => {
      try {
        return element.matches(selector) || element.closest(selector);
      } catch (e) {
        return false;
      }
    });
  }

  // Extract element information
  getElementInfo(element) {
    if (!element) return {};

    // Get className as string - handle SVGAnimatedString for SVG elements
    let className = element.className;
    if (className && typeof className === 'object' && className.baseVal !== undefined) {
      // SVG elements have className as SVGAnimatedString with baseVal property
      className = className.baseVal;
    }
    // Ensure it's a string and truncate to avoid validation errors
    const truncatedClassName = className && typeof className === 'string'
      ? className.substring(0, 500)
      : null;

    return {
      element_tag: element.tagName.toLowerCase(),
      element_id: element.id ? element.id.substring(0, 200) : null,
      element_class: truncatedClassName,
      element_text: this.getElementText(element),
      element_selector: this.getElementSelector(element)
    };
  }

  // Get clean element text (truncated)
  getElementText(element) {
    if (!element) return null;

    const text = element.textContent || element.innerText || '';
    return text.trim().substring(0, 200); // Limit to 200 characters
  }

  // Helper to get className as string (handles SVG elements)
  getClassNameString(element) {
    if (!element) return '';
    let className = element.className;
    if (className && typeof className === 'object' && className.baseVal !== undefined) {
      className = className.baseVal;
    }
    return typeof className === 'string' ? className : '';
  }

  // Generate CSS selector for element
  getElementSelector(element) {
    if (!element || element === document.documentElement) return null;

    try {
      let selector = element.tagName.toLowerCase();
      const className = this.getClassNameString(element);

      if (element.id) {
        selector += `#${element.id}`;
      } else if (className) {
        const classes = className.trim().split(/\s+/).slice(0, 3); // Limit to 3 classes
        if (classes.length > 0 && classes[0]) {
          selector += '.' + classes.join('.');
        }
      }

      // Add parent context if needed for uniqueness
      const parent = element.parentElement;
      if (parent && parent !== document.body) {
        const parentSelector = parent.tagName.toLowerCase();
        const parentClassName = this.getClassNameString(parent);
        if (parent.id) {
          selector = `${parentSelector}#${parent.id} > ${selector}`;
        } else if (parentClassName) {
          const parentClasses = parentClassName.trim().split(/\s+/).slice(0, 2);
          if (parentClasses.length > 0 && parentClasses[0]) {
            selector = `${parentSelector}.${parentClasses.join('.')} > ${selector}`;
          }
        }
      }

      return selector.substring(0, 500); // Limit selector length
    } catch (e) {
      return element.tagName.toLowerCase();
    }
  }

  // Track an interaction
  trackInteraction(interactionData) {
    if (!this.config.storeId || !this.isTracking) return;

    const interaction = {
      session_id: this.sessionId,
      store_id: this.config.storeId,
      page_url: window.location.href,
      page_title: document.title,
      viewport_width: this.viewport.width,
      viewport_height: this.viewport.height,
      ...interactionData,
      metadata: {
        timestamp: new Date().toISOString(),
        user_agent: navigator.userAgent,
        ...interactionData.metadata
      }
    };

    this.interactions.push(interaction);

    // Process batch if it reaches the batch size
    if (this.interactions.length >= this.config.batchSize) {
      this.flushBatch();
    } else {
      // Set timer to flush batch after timeout
      if (this.batchTimer) {
        clearTimeout(this.batchTimer);
      }
      this.batchTimer = setTimeout(() => {
        this.flushBatch();
      }, this.config.batchTimeout);
    }
  }

  // Flush current batch to server
  async flushBatch() {
    if (this.interactions.length === 0) return;

    const currentBatch = [...this.interactions];
    this.interactions = [];

    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    try {
      const response = await fetch(this.config.apiEndpoint + '/track-batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          interactions: currentBatch
        })
      });

      if (!response.ok) {
        console.warn('Failed to send heatmap batch:', response.status);
        // Could implement retry logic here
      }
    } catch (error) {
      console.warn('Error sending heatmap batch:', error);
      // Could implement retry logic here
    }
  }

  // Update configuration
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }
}

// React component for heatmap tracking
export default function HeatmapTrackerComponent({ 
  storeId, 
  config = {}, 
  children 
}) {
  const trackerRef = useRef(null);
  const [isTracking, setIsTracking] = useState(false);

  useEffect(() => {
    if (!storeId) return;

    // Initialize tracker
    trackerRef.current = new HeatmapTracker({
      storeId,
      ...config
    });

    setIsTracking(true);

    // Cleanup on unmount
    return () => {
      if (trackerRef.current) {
        trackerRef.current.destroy();
        trackerRef.current = null;
      }
      setIsTracking(false);
    };
  }, [storeId, config]);

  // Update config if it changes
  useEffect(() => {
    if (trackerRef.current && config) {
      trackerRef.current.updateConfig(config);
    }
  }, [config]);

  return (
    <>
      {children}
      {process.env.NODE_ENV === 'development' && isTracking && (
        <div 
          style={{
            position: 'fixed',
            bottom: '10px',
            right: '10px',
            background: 'rgba(0,0,0,0.8)',
            color: 'white',
            padding: '5px 10px',
            borderRadius: '5px',
            fontSize: '12px',
            zIndex: 10000,
            pointerEvents: 'none'
          }}
        >
          🔥 Heatmap Tracking Active
        </div>
      )}
    </>
  );
}

// Export the tracker class for direct use
export { HeatmapTracker };