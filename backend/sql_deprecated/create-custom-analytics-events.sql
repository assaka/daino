-- ================================================================
-- Custom Analytics Events - Example INSERT Statements
-- For use with CustomEventLoader component
-- ================================================================
-- NOTE: Table should already exist. These are example INSERT statements.
-- Replace 'a8297c3e-6c49-4cd9-9881-ab0a4a349be5' with actual store UUID before running.

-- ================================================================
-- EXAMPLE 1: Product Card Click Tracking
-- Fires when user clicks on any product card (uses data attributes)
-- ================================================================
INSERT INTO custom_analytics_events (
  store_id,
  event_name,
  display_name,
  event_category,
  trigger_type,
  trigger_selector,
  trigger_condition,
  event_parameters,
  fire_once_per_session,
  send_to_backend,
  enabled,
  priority
) VALUES (
  'a8297c3e-6c49-4cd9-9881-ab0a4a349be5',  -- Replace with actual store UUID
  'product_card_click',
  'Product Card Click',
  'engagement',
  'click',
  '[data-product-id]',  -- Targets any element with data-product-id
  NULL,
  '{
    "product_id": "{{product_id}}",
    "product_name": "{{product_name}}",
    "price": "{{price}}",
    "category": "{{category}}",
    "page_url": "{{page_url}}",
    "timestamp": "{{timestamp}}"
  }',
  false,  -- Fire on every click
  true,   -- Send to backend for analytics
  true,
  100
);

-- ================================================================
-- EXAMPLE 2: Add to Cart Button Click (more specific)
-- Fires when Add to Cart button is clicked, captures product info
-- ================================================================
INSERT INTO custom_analytics_events (
  store_id,
  event_name,
  display_name,
  event_category,
  trigger_type,
  trigger_selector,
  trigger_condition,
  event_parameters,
  fire_once_per_session,
  send_to_backend,
  enabled,
  priority
) VALUES (
  'a8297c3e-6c49-4cd9-9881-ab0a4a349be5',
  'custom_add_to_cart_click',
  'Add to Cart Click',
  'ecommerce',
  'click',
  '.btn-add-to-cart, [data-action="add-to-cart"]',
  NULL,
  '{
    "product_id": "{{product_id}}",
    "product_name": "{{product_name}}",
    "price": "{{price}}",
    "page_type": "{{page_type}}",
    "session_id": "{{session_id}}"
  }',
  false,
  true,
  true,
  90
);

-- ================================================================
-- EXAMPLE 3: Checkout Page View
-- Fires when checkout page loads (page_load trigger)
-- ================================================================
INSERT INTO custom_analytics_events (
  store_id,
  event_name,
  display_name,
  event_category,
  trigger_type,
  trigger_selector,
  trigger_condition,
  event_parameters,
  fire_once_per_session,
  send_to_backend,
  enabled,
  priority
) VALUES (
  'a8297c3e-6c49-4cd9-9881-ab0a4a349be5',
  'checkout_page_view',
  'Checkout Page View',
  'ecommerce',
  'page_load',
  NULL,
  '{"url_pattern": "/checkout"}',
  '{
    "page_url": "{{page_url}}",
    "page_title": "{{page_title}}",
    "session_id": "{{session_id}}",
    "timestamp": "{{timestamp}}"
  }',
  true,   -- Only fire once per session
  true,
  true,
  80
);

-- ================================================================
-- EXAMPLE 4: Scroll Depth Tracking
-- Fires at 25%, 50%, 75%, 100% scroll depth
-- ================================================================
INSERT INTO custom_analytics_events (
  store_id,
  event_name,
  display_name,
  event_category,
  trigger_type,
  trigger_selector,
  trigger_condition,
  event_parameters,
  fire_once_per_session,
  send_to_backend,
  enabled,
  priority
) VALUES (
  'a8297c3e-6c49-4cd9-9881-ab0a4a349be5',
  'scroll_depth',
  'Scroll Depth Tracking',
  'engagement',
  'scroll',
  NULL,
  '{"scroll_depths": [25, 50, 75, 100]}',
  '{
    "scroll_percent": "{{scroll_percent}}",
    "page_url": "{{page_url}}",
    "page_title": "{{page_title}}"
  }',
  false,  -- Fire at each threshold
  false,  -- Don't send to backend (just GTM)
  true,
  50
);

-- ================================================================
-- EXAMPLE 5: Time on Page (30 seconds)
-- Fires after user spends 30 seconds on page
-- ================================================================
INSERT INTO custom_analytics_events (
  store_id,
  event_name,
  display_name,
  event_category,
  trigger_type,
  trigger_selector,
  trigger_condition,
  event_parameters,
  fire_once_per_session,
  send_to_backend,
  enabled,
  priority
) VALUES (
  'a8297c3e-6c49-4cd9-9881-ab0a4a349be5',
  'engaged_user',
  'Engaged User (30s)',
  'engagement',
  'timer',
  NULL,
  '{"delay_seconds": 30}',
  '{
    "page_url": "{{page_url}}",
    "page_title": "{{page_title}}",
    "session_id": "{{session_id}}"
  }',
  true,   -- Only fire once per session
  true,
  true,
  40
);

-- ================================================================
-- EXAMPLE 6: Newsletter Form Submit
-- Fires when newsletter form is submitted
-- ================================================================
INSERT INTO custom_analytics_events (
  store_id,
  event_name,
  display_name,
  event_category,
  trigger_type,
  trigger_selector,
  trigger_condition,
  event_parameters,
  fire_once_per_session,
  send_to_backend,
  enabled,
  priority
) VALUES (
  'a8297c3e-6c49-4cd9-9881-ab0a4a349be5',
  'newsletter_signup',
  'Newsletter Signup',
  'conversion',
  'form_submit',
  '#newsletter-form, .newsletter-form, [data-form="newsletter"]',
  NULL,
  '{
    "form_id": "{{form_id}}",
    "page_url": "{{page_url}}",
    "timestamp": "{{timestamp}}"
  }',
  true,
  true,
  true,
  70
);

-- ================================================================
-- EXAMPLE 7: Custom Delivery Date Selected
-- For programmatic triggering via window.fireCustomEvent()
-- ================================================================
INSERT INTO custom_analytics_events (
  store_id,
  event_name,
  display_name,
  event_category,
  trigger_type,
  trigger_selector,
  trigger_condition,
  event_parameters,
  fire_once_per_session,
  send_to_backend,
  enabled,
  priority
) VALUES (
  'a8297c3e-6c49-4cd9-9881-ab0a4a349be5',
  'delivery_date_custom',
  'Delivery Date Selected',
  'ecommerce',
  'custom',  -- Triggered programmatically
  NULL,
  NULL,
  '{
    "delivery_date": "{{delivery_date}}",
    "delivery_type": "{{delivery_type}}",
    "page_url": "{{page_url}}"
  }',
  false,
  true,
  true,
  60
);

-- ================================================================
-- DYNAMIC PARAMETERS REFERENCE
-- ================================================================
-- These variables are automatically resolved by CustomEventLoader:
--
-- FROM DATA ATTRIBUTES (via element.closest()):
--   {{product_id}}     - data-product-id attribute
--   {{product_name}}   - data-product-name attribute
--   {{price}}          - data-price attribute
--   {{category}}       - data-category attribute
--
-- FROM PAGE CONTEXT:
--   {{page_url}}       - window.location.href
--   {{page_title}}     - document.title
--   {{page_type}}      - body[data-page-type] or 'unknown'
--
-- FROM ELEMENT:
--   {{href}}           - element.href or closest anchor href
--   {{text}}           - element.textContent (truncated to 100 chars)
--   {{form_id}}        - element.id or closest form id
--
-- FROM EVENT CONTEXT:
--   {{scroll_percent}} - scroll depth percentage (for scroll events)
--
-- FROM SESSION:
--   {{session_id}}     - sessionStorage session_id or 'unknown'
--   {{timestamp}}      - ISO timestamp
-- ================================================================
