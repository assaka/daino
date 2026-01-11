/**
 * CustomEventLoader Component
 *
 * Loads custom analytics events from the API and attaches event listeners
 * to CSS selectors to fire dataLayer events when triggers occur.
 *
 * Supported trigger types:
 * - click: Fires when element matching selector is clicked
 * - form_submit: Fires when form matching selector is submitted
 * - page_load: Fires when page loads (with optional URL condition)
 * - scroll: Fires when user scrolls to specified depth
 * - timer: Fires after specified time on page
 * - custom: Must be triggered programmatically via window.fireCustomEvent()
 */

import { useEffect, useRef, useCallback } from 'react';
import { useStore } from './StoreProvider';
import { pushToDataLayer, trackActivity } from './DataLayerManager';

// Session storage key for tracking fired events
const FIRED_EVENTS_KEY = 'daino_fired_events';

// Get fired events from session storage
const getFiredEvents = () => {
  try {
    const fired = sessionStorage.getItem(FIRED_EVENTS_KEY);
    return fired ? JSON.parse(fired) : {};
  } catch {
    return {};
  }
};

// Mark event as fired in session storage
const markEventFired = (eventName) => {
  try {
    const fired = getFiredEvents();
    fired[eventName] = Date.now();
    sessionStorage.setItem(FIRED_EVENTS_KEY, JSON.stringify(fired));
  } catch {
    // Ignore storage errors
  }
};

// Check if event was already fired this session
const wasEventFired = (eventName) => {
  const fired = getFiredEvents();
  return !!fired[eventName];
};

// Parse dynamic parameters from element and page context
const parseEventParameters = (parameters, element, event) => {
  if (!parameters || typeof parameters !== 'object') return {};

  const parsed = {};
  const context = {
    // Element context
    product_id: element?.dataset?.productId || element?.closest('[data-product-id]')?.dataset?.productId,
    product_name: element?.dataset?.productName || element?.closest('[data-product-name]')?.dataset?.productName,
    product_price: element?.dataset?.price || element?.closest('[data-price]')?.dataset?.price,
    category_name: element?.dataset?.category || element?.closest('[data-category]')?.dataset?.category,
    // Page context
    page_url: window.location.href,
    page_title: document.title,
    page_type: document.body.dataset?.pageType || 'unknown',
    // Element attributes
    href: element?.href || element?.closest('a')?.href,
    text: element?.textContent?.trim()?.substring(0, 100),
    // Form data (if applicable)
    form_id: element?.id || element?.closest('form')?.id,
    // Scroll context
    scroll_percent: event?.scrollPercent,
    // Session
    session_id: sessionStorage.getItem('session_id') || 'unknown',
    timestamp: new Date().toISOString()
  };

  Object.entries(parameters).forEach(([key, value]) => {
    if (typeof value === 'string' && value.startsWith('{{') && value.endsWith('}}')) {
      // Dynamic parameter - extract variable name
      const varName = value.slice(2, -2).trim();
      parsed[key] = context[varName] || element?.dataset?.[varName] || value;
    } else {
      // Static parameter
      parsed[key] = value;
    }
  });

  return parsed;
};

// Fire a custom event
const fireEvent = (eventConfig, element = null, triggerEvent = null) => {
  const {
    event_name,
    event_parameters,
    fire_once_per_session,
    send_to_backend,
    event_category
  } = eventConfig;

  // Check if should only fire once per session
  if (fire_once_per_session && wasEventFired(event_name)) {
    return;
  }

  // Parse parameters with element context
  const params = parseEventParameters(event_parameters, element, triggerEvent);

  // Push to dataLayer
  pushToDataLayer({
    event: event_name,
    event_category: event_category || 'custom',
    ...params
  });

  // Track to backend if enabled
  if (send_to_backend) {
    trackActivity(event_name, {
      metadata: params
    });
  }

  // Mark as fired if once per session
  if (fire_once_per_session) {
    markEventFired(event_name);
  }

  // Dispatch custom event for debugging
  window.dispatchEvent(new CustomEvent('customEventFired', {
    detail: { event_name, params }
  }));
};

export default function CustomEventLoader() {
  const { store } = useStore();
  const listenersRef = useRef([]);
  const scrollObserverRef = useRef(null);
  const timersRef = useRef([]);
  const eventsLoadedRef = useRef(false);

  // Cleanup function
  const cleanup = useCallback(() => {
    // Remove click/form listeners
    listenersRef.current.forEach(({ element, type, handler }) => {
      element.removeEventListener(type, handler);
    });
    listenersRef.current = [];

    // Clear scroll observer
    if (scrollObserverRef.current) {
      scrollObserverRef.current.disconnect();
      scrollObserverRef.current = null;
    }

    // Clear timers
    timersRef.current.forEach(timerId => clearTimeout(timerId));
    timersRef.current = [];
  }, []);

  // Attach click listener
  const attachClickListener = useCallback((eventConfig) => {
    const { trigger_selector } = eventConfig;
    if (!trigger_selector) return;

    const handler = (e) => {
      const target = e.target.closest(trigger_selector);
      if (target) {
        fireEvent(eventConfig, target, e);
      }
    };

    // Use event delegation on document
    document.addEventListener('click', handler);
    listenersRef.current.push({ element: document, type: 'click', handler });
  }, []);

  // Attach form submit listener
  const attachFormListener = useCallback((eventConfig) => {
    const { trigger_selector } = eventConfig;
    if (!trigger_selector) return;

    const handler = (e) => {
      const form = e.target.closest(trigger_selector);
      if (form) {
        fireEvent(eventConfig, form, e);
      }
    };

    document.addEventListener('submit', handler);
    listenersRef.current.push({ element: document, type: 'submit', handler });
  }, []);

  // Handle page load trigger
  const handlePageLoadTrigger = useCallback((eventConfig) => {
    const { trigger_condition } = eventConfig;

    // Check URL condition if specified
    if (trigger_condition?.url_pattern) {
      const pattern = new RegExp(trigger_condition.url_pattern);
      if (!pattern.test(window.location.href)) {
        return;
      }
    }

    // Check page type condition
    if (trigger_condition?.page_type) {
      const pageType = document.body.dataset?.pageType;
      if (pageType !== trigger_condition.page_type) {
        return;
      }
    }

    // Fire immediately
    fireEvent(eventConfig, document.body);
  }, []);

  // Attach scroll listener
  const attachScrollListener = useCallback((eventConfig) => {
    const { trigger_condition } = eventConfig;
    const depths = trigger_condition?.scroll_depths || [25, 50, 75, 100];
    const firedDepths = new Set();

    const handler = () => {
      const scrollPercent = Math.round(
        (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100
      );

      depths.forEach(depth => {
        if (scrollPercent >= depth && !firedDepths.has(depth)) {
          firedDepths.add(depth);
          fireEvent(eventConfig, null, { scrollPercent: depth });
        }
      });
    };

    window.addEventListener('scroll', handler, { passive: true });
    listenersRef.current.push({ element: window, type: 'scroll', handler });
  }, []);

  // Attach timer trigger
  const attachTimerTrigger = useCallback((eventConfig) => {
    const { trigger_condition } = eventConfig;
    const delay = (trigger_condition?.delay_seconds || 30) * 1000;

    const timerId = setTimeout(() => {
      fireEvent(eventConfig, document.body);
    }, delay);

    timersRef.current.push(timerId);
  }, []);

  // Load and attach custom events
  useEffect(() => {
    if (!store?.id || eventsLoadedRef.current) return;

    const loadCustomEvents = async () => {
      try {
        const response = await fetch(`/api/custom-analytics-events/${store.id}?enabled_only=true`);
        const result = await response.json();

        if (!result.success || !result.data?.length) {
          return;
        }

        // Sort by priority (higher first)
        const events = result.data.sort((a, b) => (b.priority || 0) - (a.priority || 0));

        // Attach listeners based on trigger type
        events.forEach(eventConfig => {
          switch (eventConfig.trigger_type) {
            case 'click':
              attachClickListener(eventConfig);
              break;
            case 'form_submit':
              attachFormListener(eventConfig);
              break;
            case 'page_load':
              handlePageLoadTrigger(eventConfig);
              break;
            case 'scroll':
              attachScrollListener(eventConfig);
              break;
            case 'timer':
              attachTimerTrigger(eventConfig);
              break;
            case 'custom':
              // Custom events are triggered programmatically
              // Register them so they can be fired via window.fireCustomEvent()
              break;
            default:
              console.warn(`[CustomEventLoader] Unknown trigger type: ${eventConfig.trigger_type}`);
          }
        });

        // Expose function to fire custom events programmatically
        window.fireCustomEvent = (eventName, element = null, extraParams = {}) => {
          const eventConfig = events.find(e => e.event_name === eventName);
          if (eventConfig) {
            fireEvent({
              ...eventConfig,
              event_parameters: {
                ...eventConfig.event_parameters,
                ...extraParams
              }
            }, element);
          } else {
            // Fire as ad-hoc event
            pushToDataLayer({
              event: eventName,
              ...extraParams
            });
          }
        };

        eventsLoadedRef.current = true;

      } catch (error) {
        console.error('[CustomEventLoader] Failed to load custom events:', error);
      }
    };

    loadCustomEvents();

    return cleanup;
  }, [store?.id, attachClickListener, attachFormListener, handlePageLoadTrigger,
      attachScrollListener, attachTimerTrigger, cleanup]);

  // Re-attach listeners on route change (SPA navigation)
  useEffect(() => {
    const handleRouteChange = () => {
      // Re-check page_load triggers on navigation
      // The listeners remain attached via event delegation
    };

    window.addEventListener('popstate', handleRouteChange);
    return () => window.removeEventListener('popstate', handleRouteChange);
  }, []);

  return null;
}
