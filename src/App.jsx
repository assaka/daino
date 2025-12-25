import './App.css'
import { Toaster } from "@/components/ui/toaster"
import { StoreSelectionProvider } from "@/contexts/StoreSelectionContext"
import { AIProvider } from "@/contexts/AIContext"
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Layout from '@/pages/Layout'
import Auth from '@/pages/Auth'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { queryClient } from '@/config/queryClient'
import { isCustomDomain } from '@/utils/domainConfig'

// Import pages - using the exports from pages/index.jsx
import * as Pages from '@/pages'

// Import plugin components
import DynamicPluginAdminPage from '@/components/plugins/DynamicPluginAdminPage'
import { AdminLayoutWrapper } from '@/components/admin/AdminLayoutWrapper'
import StoreHealthGuard from '@/components/admin/StoreHealthGuard'

// Import new hook-based systems
import { useEffect, useState } from 'react'
import extensionSystem from '@/core/ExtensionSystem.js'
import hookSystem from '@/core/HookSystem.js'
import eventSystem from '@/core/EventSystem.js'

// Global flag to track if plugins are ready (survives race conditions)
window.__pluginsReady = false;

// Component to wrap pages with Layout
function PageWrapper({ Component, pageName }) {
  return (
    <AdminLayoutWrapper>
      <StoreHealthGuard pageName={pageName}>
        <Layout currentPageName={pageName}>
          <Component />
        </Layout>
      </StoreHealthGuard>
    </AdminLayoutWrapper>
  );
}

// Initialize database-driven plugins
async function initializeDatabasePlugins() {
  try {
    // Skip plugin loading if no store is selected (e.g., on auth page)
    const selectedStoreId = localStorage.getItem('selectedStoreId');
    if (!selectedStoreId) {
      console.log('⏭️ Skipping plugin initialization - no store selected yet');
      return;
    }

    // Only load plugins on storefront pages, not admin pages
    // Admin plugin management is handled separately in the Plugins page
    const isAdminPage = window.location.pathname.includes('/admin/');
    const isPluginsPage = window.location.pathname.includes('/plugins');

    if (isAdminPage && !isPluginsPage) {
      console.log('⏭️ Skipping plugin initialization - admin page (plugins load only on storefront)');
      return;
    }

    // Get store_id from localStorage (set by StoreSelection or storefront bootstrap)
    const storeId = localStorage.getItem('selectedStoreId') || localStorage.getItem('storeId');

    if (!storeId) {
      console.log('⏭️ No store_id available - skipping plugin initialization');
      return;
    }

    // Fetch active plugins from database (uses normalized tables structure)
    // Add timestamp to bust cache
    // Try new endpoint first, fallback to legacy if not deployed yet
    let response = await fetch(`/api/plugins/active?store_id=${storeId}&_t=${Date.now()}`);

    const result = await response.json();

    if (!result.success) {
      console.error('❌ Failed to load plugins from database:', result);
      return;
    }

    const activePlugins = result.data || [];

    // Only load hooks, events, and scripts on storefront (not on plugins management page)
    const isStorefrontContext = !window.location.pathname.includes('/plugins');

    // Helper to strip ES module syntax for eval compatibility
    const makeEvalSafe = (code) => {
      if (!code) return code;
      // Remove 'export default ' from the beginning
      return code.replace(/^\s*export\s+default\s+/, '');
    };

    // Process plugins - hooks and events are ALREADY in the response!
    // No need to fetch each plugin individually
    const loadPromise = Promise.all(
      activePlugins.map(async (plugin) => {
        // Use hooks and events from the response (no additional API call!)
        // Only register hooks on storefront pages
        if (plugin.hooks && Array.isArray(plugin.hooks) && isStorefrontContext) {
          plugin.hooks.forEach(hook => {
            try {
              if (hook.handler_code && hook.enabled !== false) {
                const safeCode = makeEvalSafe(hook.handler_code);
                const handlerFn = eval(`(${safeCode})`);
                hookSystem.register(hook.hook_name, handlerFn);
              }
            } catch (error) {
              console.error(`Error registering hook ${hook.hook_name}:`, error);
            }
          });
        }

        // Register events from response (no additional API call!)
        // Only register events on storefront pages
        if (plugin.events && Array.isArray(plugin.events) && isStorefrontContext) {
          plugin.events.forEach(event => {
            try {
              if (event.listener_code && event.enabled !== false) {
                const safeCode = makeEvalSafe(event.listener_code);
                const listenerFn = eval(`(${safeCode})`);
                eventSystem.on(event.event_name, listenerFn);
              }
            } catch (error) {
              console.error(`Error registering event ${event.event_name}:`, error);
            }
          });
        }

        // Load frontend scripts from response (no additional API call!)
        // Only load scripts on storefront pages (not on plugins management page)
        if (plugin.frontendScripts && Array.isArray(plugin.frontendScripts) && isStorefrontContext) {
          plugin.frontendScripts.forEach(script => {
            try {
              if (!script.content || script.content.trim().startsWith('<')) {
                console.error(`Script ${script.name} contains HTML, not JavaScript. Skipping.`);
                return;
              }

              // Skip Node.js backend scripts
              const scriptContent = script.content.trim();
              if (scriptContent.includes('require(') || scriptContent.includes('module.exports')) {
                console.warn(`Skipping backend script ${script.name}`);
                return;
              }

              // Create and inject script
              const scriptElement = document.createElement('script');
              scriptElement.type = 'module';
              scriptElement.textContent = script.content;
              scriptElement.setAttribute('data-plugin-id', plugin.id);
              scriptElement.setAttribute('data-script-name', script.name);
              document.head.appendChild(scriptElement);
            } catch (error) {
              console.error(`Error loading script ${script.name}:`, error);
            }
          });
        }
      })
    );

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Plugin loading timeout (10s)')), 10000)
    );

    await Promise.race([loadPromise, timeoutPromise]);

    // Set global flag to true so components can check it immediately
    window.__pluginsReady = true;

  } catch (error) {
    console.error('❌ Error initializing database plugins:', error);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Error name:', error.name);
    // Continue anyway - don't block the app
  }
}

// Load hooks and events for a specific plugin
async function loadPluginHooksAndEvents(pluginId) {
  try {
    // Get store_id from localStorage
    const storeId = localStorage.getItem('selectedStoreId') || localStorage.getItem('storeId');

    if (!storeId) {
      console.log('⏭️ No store_id available - skipping plugin load');
      return;
    }

    // Add timestamp to bust cache
    // Try new endpoint first, fallback to legacy if not deployed yet
    let response = await fetch(`/api/plugins/active/${pluginId}?store_id=${storeId}&_t=${Date.now()}`);

    const result = await response.json();

    if (result.success && result.data) {
      const plugin = result.data;

      // Register hooks from database
      if (plugin.hooks) {
        for (const hook of plugin.hooks) {
          if (hook.enabled) {
            try {
              const handlerFunction = createHandlerFromDatabaseCode(hook.handler_code);
              hookSystem.register(hook.hook_name, handlerFunction, hook.priority);
            } catch (error) {
              console.error(`❌ Failed to register hook ${hook.hook_name}:`, error.message);
              // Continue with other hooks
            }
          }
        }
      }

      // Register events from database
      if (plugin.events) {
        for (const event of plugin.events) {
          if (event.enabled) {
            try {
              const listenerFunction = createHandlerFromDatabaseCode(event.listener_code);
              eventSystem.on(event.event_name, listenerFunction);
            } catch (error) {
              console.error(`❌ Failed to register event ${event.event_name}:`, error.message);
              // Continue with other events
            }
          }
        }
      }
    } else {
      console.error(`❌ Failed to load plugin ${pluginId}:`, result);
    }
  } catch (error) {
    console.error(`❌ Error loading plugin ${pluginId}:`, error);
    console.error('Error stack:', error.stack);
    // Don't throw - continue with other plugins
  }
}

// Load frontend scripts for a specific plugin
async function loadPluginFrontendScripts(pluginId) {
  try {
    // Fetch scripts from normalized plugin_scripts table
    const response = await fetch(`/api/plugins/${pluginId}/scripts?scope=frontend&_t=${Date.now()}`);

    if (!response.ok) {
      console.warn(`  ⚠️ Failed to load scripts for ${pluginId}: ${response.status}`);
      return;
    }

    const result = await response.json();

    if (result.success && result.data && result.data.length > 0) {
      for (const script of result.data) {
        try {
          // Validate script content is actually JavaScript
          if (!script.content || script.content.trim().startsWith('<')) {
            console.error(`  ❌ Script ${script.name} contains HTML, not JavaScript. Skipping.`);
            continue;
          }

          // Skip Node.js backend scripts (they contain require/module.exports)
          const scriptContent = script.content.trim();
          if (scriptContent.includes('require(') ||
              scriptContent.includes('module.exports') ||
              scriptContent.includes('require.') ||
              scriptContent.match(/const\s+\{\s*\w+\s*\}\s*=\s*require\(/)) {
            console.warn(`  ⚠️ Skipping backend script ${script.name} (contains Node.js syntax)`);
            continue;
          }

          // Create a script tag and inject the code
          const scriptElement = document.createElement('script');
          scriptElement.type = 'module'; // Use module to support ES6 import/export
          scriptElement.textContent = script.content;
          scriptElement.setAttribute('data-plugin-id', pluginId);
          scriptElement.setAttribute('data-script-name', script.name);

          document.head.appendChild(scriptElement);

        } catch (error) {
          console.error(`  ❌ Error executing script ${script.name}:`, error);
        }
      }
    } else {
      console.warn(`  ⚠️ No frontend scripts found for ${pluginId}`);
    }
  } catch (error) {
    console.error(`❌ Error loading frontend scripts for ${pluginId}:`, error);
    // Don't throw - continue with other plugins
  }
}

// Create executable function from database-stored code
function createHandlerFromDatabaseCode(code) {
  try {
    // Remove 'export default' if present (database may have full function declarations)
    let cleanCode = code.trim();
    if (cleanCode.startsWith('export default')) {
      cleanCode = cleanCode.replace(/^export\s+default\s+/, '');
    }

    // Remove trailing semicolon if present
    cleanCode = cleanCode.replace(/;[\s]*$/, '');

    // If it's a function declaration (named or anonymous), convert to expression
    if (cleanCode.startsWith('async function') || cleanCode.startsWith('function')) {
      cleanCode = '(' + cleanCode + ')';
    }
    // If it's already wrapped (like arrow functions with parens), no need to wrap again
    else if (!cleanCode.startsWith('(')) {
      // For arrow functions like: eventData => {...} or (eventData) => {...}
      // Wrap them to ensure they're treated as expressions
      cleanCode = '(' + cleanCode + ')';
    }

    // Use Function constructor to evaluate the function string
    const handler = new Function('return ' + cleanCode)();
    return handler;
  } catch (error) {
    console.error('❌ Error creating handler from database code:', error);
    console.error('Failed code:', code);
    return () => {
      console.warn('⚠️ Fallback handler called - original code had syntax error');
    };
  }
}

function App() {
  // Initialize the new hook-based architecture
  useEffect(() => {
    const initializeExtensionSystem = async () => {
      try {
        // Load core extensions
        const extensionsToLoad = [
          // Disabled - file doesn't exist or has loading issues
          // {
          //   module: '/src/extensions/analytics-tracker.js',
          //   enabled: true,
          //   config: {
          //     customEventsEnabled: true,
          //     trackUserJourney: true,
          //     ecommerceTracking: true,
          //     debugMode: process.env.NODE_ENV === 'development'
          //   }
          // }
        ]

        // Initialize extensions (non-blocking)
        try {
          await extensionSystem.loadFromConfig(extensionsToLoad);
        } catch (extError) {
          // Extensions are optional - continue anyway
        }

        // Initialize database-driven plugins
        await initializeDatabasePlugins();

        // Emit system ready event
        eventSystem.emit('system.ready', {
          timestamp: Date.now(),
          extensionsLoaded: extensionSystem.getLoadedExtensions().length,
          hooksRegistered: Object.keys(hookSystem.getStats()).length,
          databasePluginsLoaded: true
        })

      } catch (error) {
        console.error('❌ Failed to initialize Extension System:', error);
        console.error('❌ Error stack:', error.stack);

        // Emit system error event
        eventSystem.emit('system.error', {
          error: error.message,
          timestamp: Date.now()
        })
      }
    }

    initializeExtensionSystem()
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <AIProvider>
        <Router>
          <StoreSelectionProvider>
            <Routes>
          {/* Admin routes */}
          <Route path="/admin" element={<PageWrapper Component={Pages.Dashboard} pageName="Dashboard" />} />
          <Route path="/admin/dashboard" element={<PageWrapper Component={Pages.Dashboard} pageName="Dashboard" />} />
          <Route path="/admin/categories" element={<PageWrapper Component={Pages.Categories} pageName="CATEGORIES" />} />
          <Route path="/admin/products" element={<PageWrapper Component={Pages.Products} pageName="PRODUCTS" />} />
          <Route path="/admin/attributes" element={<PageWrapper Component={Pages.Attributes} pageName="ATTRIBUTES" />} />
          <Route path="/admin/custom-option-rules" element={<PageWrapper Component={Pages.CustomOptionRules} pageName="CUSTOM_OPTION_RULES" />} />
          <Route path="/admin/product-tabs" element={<PageWrapper Component={Pages.ProductTabs} pageName="PRODUCT_TABS" />} />
          <Route path="/admin/product-labels" element={<PageWrapper Component={Pages.ProductLabels} pageName="PRODUCT_LABELS" />} />
          <Route path="/admin/storefronts" element={<PageWrapper Component={Pages.Storefronts} pageName="STOREFRONTS" />} />
          <Route path="/admin/stock-settings" element={<PageWrapper Component={Pages.StockSettings} pageName="STOCK_SETTINGS" />} />
          <Route path="/admin/cache" element={<PageWrapper Component={Pages.Cache} pageName="CACHE" />} />
          <Route path="/admin/orders" element={<PageWrapper Component={Pages.Orders} pageName="ORDERS" />} />
          <Route path="/admin/sales-settings" element={<PageWrapper Component={Pages.SalesSettings} pageName="SALES_SETTINGS" />} />
          <Route path="/admin/customers" element={<PageWrapper Component={Pages.Customers} pageName="CUSTOMERS" />} />
          <Route path="/admin/blacklist" element={<PageWrapper Component={Pages.Blacklist} pageName="BLACKLIST" />} />
          <Route path="/admin/tax" element={<PageWrapper Component={Pages.Tax} pageName="TAX" />} />
          <Route path="/admin/shipping-methods" element={<PageWrapper Component={Pages.ShippingMethods} pageName="SHIPPING_METHODS" />} />
          <Route path="/admin/payment-methods" element={<PageWrapper Component={Pages.PaymentMethods} pageName="PAYMENT_METHODS" />} />
          <Route path="/admin/payments/oauth-callback" element={<PageWrapper Component={Pages.StripeOAuthCallback} pageName="STRIPE_OAUTH_CALLBACK" />} />
          <Route path="/admin/coupons" element={<PageWrapper Component={Pages.Coupons} pageName="COUPONS" />} />
          <Route path="/admin/delivery-settings" element={<PageWrapper Component={Pages.DeliverySettings} pageName="DELIVERY_SETTINGS" />} />
          <Route path="/admin/cms-blocks" element={<PageWrapper Component={Pages.CmsBlocks} pageName="CMS_BLOCKS" />} />
          <Route path="/admin/cms-pages" element={<PageWrapper Component={Pages.CmsPages} pageName="CMS_PAGES" />} />
          <Route path="/admin/emails" element={<PageWrapper Component={Pages.Emails} pageName="EMAILS" />} />
          <Route path="/admin/email" element={<PageWrapper Component={Pages.EmailSettings} pageName="EMAIL_SETTINGS" />} />
          <Route path="/admin/file-library" element={<PageWrapper Component={Pages.FileLibrary} pageName="file-library" />} />
          <Route path="/admin/cookie-consent" element={<PageWrapper Component={Pages.CookieConsent} pageName="COOKIE_CONSENT" />} />
          <Route path="/admin/analytics" element={<PageWrapper Component={Pages.AnalyticsSettings} pageName="ANALYTICS" />} />
          <Route path="/admin/analytics-settings" element={<PageWrapper Component={Pages.AnalyticsSettings} pageName="ANALYTICS" />} />
          <Route path="/admin/heatmaps" element={<PageWrapper Component={Pages.HeatmapAnalytics} pageName="HEATMAPS" />} />
          <Route path="/admin/heatmap-analytics" element={<PageWrapper Component={Pages.HeatmapAnalytics} pageName="HEATMAPS" />} />
          <Route path="/admin/ab-testing" element={<PageWrapper Component={Pages.ABTesting} pageName="ABTESTING" />} />
          <Route path="/admin/customer-activity" element={<PageWrapper Component={Pages.CustomerActivity} pageName="CUSTOMER_ACTIVITY" />} />

          {/* Marketing Routes */}
          <Route path="/admin/marketing/segments" element={<PageWrapper Component={Pages.Segments} pageName="MARKETING_SEGMENTS" />} />
          <Route path="/admin/marketing/automations" element={<PageWrapper Component={Pages.Automations} pageName="MARKETING_AUTOMATIONS" />} />
          <Route path="/admin/marketing/campaigns" element={<PageWrapper Component={Pages.Campaigns} pageName="MARKETING_CAMPAIGNS" />} />
          <Route path="/admin/marketing/integrations" element={<PageWrapper Component={Pages.MarketingIntegrations} pageName="MARKETING_INTEGRATIONS" />} />
          <Route path="/admin/marketing/help" element={<PageWrapper Component={Pages.MarketingHelp} pageName="MARKETING_HELP" />} />

          {/* CRM Routes */}
          <Route path="/admin/crm" element={<PageWrapper Component={Pages.CrmDashboard} pageName="CRM_DASHBOARD" />} />
          <Route path="/admin/crm/deals" element={<PageWrapper Component={Pages.CrmDeals} pageName="CRM_DEALS" />} />
          <Route path="/admin/crm/leads" element={<PageWrapper Component={Pages.CrmLeads} pageName="CRM_LEADS" />} />
          <Route path="/admin/crm/pipelines" element={<PageWrapper Component={Pages.CrmPipelines} pageName="CRM_PIPELINES" />} />
          <Route path="/admin/crm/activities" element={<PageWrapper Component={Pages.CrmActivities} pageName="CRM_ACTIVITIES" />} />
          <Route path="/admin/seo-tools/settings" element={<PageWrapper Component={Pages.SeoSettings} pageName="seo-tools/settings" />} />
          <Route path="/admin/seo-tools/templates" element={<PageWrapper Component={Pages.SeoTemplates} pageName="seo-tools/templates" />} />
          <Route path="/admin/seo-tools/redirects" element={<PageWrapper Component={Pages.SeoRedirects} pageName="seo-tools/redirects" />} />
          <Route path="/admin/seo-tools/canonical" element={<PageWrapper Component={Pages.SeoCanonical} pageName="seo-tools/canonical" />} />
          <Route path="/admin/seo-tools/hreflang" element={<PageWrapper Component={Pages.SeoHreflang} pageName="seo-tools/hreflang" />} />
          <Route path="/admin/seo-tools/robots" element={<PageWrapper Component={Pages.SeoRobots} pageName="seo-tools/robots" />} />
          <Route path="/admin/seo-tools/social" element={<PageWrapper Component={Pages.SeoSocial} pageName="seo-tools/social" />} />
          <Route path="/admin/seo-tools/report" element={<PageWrapper Component={Pages.SeoReport} pageName="seo-tools/report" />} />
          <Route path="/admin/seo-tools/product-feeds" element={<PageWrapper Component={Pages.ProductFeeds} pageName="seo-tools/product-feeds" />} />
          <Route path="/admin/xml-sitemap" element={<PageWrapper Component={Pages.XmlSitemap} pageName="XmlSitemap" />} />
          <Route path="/admin/robots-txt" element={<PageWrapper Component={Pages.RobotsTxt} pageName="RobotsTxt" />} />
          <Route path="/admin/html-sitemap" element={<PageWrapper Component={Pages.HtmlSitemap} pageName="HtmlSitemap" />} />
          <Route path="/admin/akeneo-integration" element={<PageWrapper Component={Pages.AkeneoIntegration} pageName="akeneo-integration" />} />
          <Route path="/admin/marketplace-hub" element={<PageWrapper Component={Pages.MarketplaceHub} pageName="MARKETPLACE_HUB" />} />
          <Route path="/admin/background-jobs" element={<PageWrapper Component={Pages.BackgroundJobs} pageName="BACKGROUND_JOBS" />} />
          <Route path="/admin/job-scheduler" element={<PageWrapper Component={Pages.JobScheduler} pageName="JOB_SCHEDULER" />} />
          <Route path="/admin/import-export-jobs" element={<PageWrapper Component={Pages.ImportExportJobs} pageName="IMPORT_EXPORT_JOBS" />} />
          <Route path="/admin/embedding-backfill" element={<PageWrapper Component={Pages.EmbeddingBackfill} pageName="EMBEDDING_BACKFILL" />} />
          <Route path="/admin/shopify-integration" element={<PageWrapper Component={Pages.ShopifyIntegration} pageName="ShopifyIntegration" />} />
          <Route path="/admin/integrations/instagram-shopping" element={<PageWrapper Component={Pages.InstagramShopping} pageName="instagram-shopping" />} />
          <Route path="/admin/settings" element={<PageWrapper Component={Pages.Settings} pageName="SETTINGS" />} />
          <Route path="/admin/navigation-manager" element={<PageWrapper Component={Pages.NavigationManager} pageName="NAVIGATION_MANAGER" />} />
          <Route path="/admin/theme-layout" element={<PageWrapper Component={Pages.ThemeLayout} pageName="THEME_LAYOUT" />} />
          <Route path="/admin/media-storage" element={<PageWrapper Component={Pages.MediaStorage} pageName="media-storage" />} />
          <Route path="/admin/custom-domains" element={<PageWrapper Component={Pages.CustomDomains} pageName="custom-domains" />} />
          <Route path="/admin/database-integrations" element={<PageWrapper Component={Pages.DatabaseIntegrations} pageName="database-integrations" />} />
          <Route path="/admin/stores" element={<PageWrapper Component={Pages.Stores} pageName="STORES" />} />
          <Route path="/admin/billing" element={<PageWrapper Component={Pages.Billing} pageName="Billing" />} />
          <Route path="/admin/uptime-report" element={<PageWrapper Component={Pages.UptimeReport} pageName="UptimeReport" />} />
          <Route path="/admin/team" element={<PageWrapper Component={Pages.TeamPage} pageName="TeamPage" />} />
          <Route path="/admin/access-requests" element={<PageWrapper Component={Pages.AccessRequestsPage} pageName="AccessRequestsPage" />} />
          <Route path="/admin/onboarding" element={<PageWrapper Component={Pages.StoreOnboarding} pageName="StoreOnboarding" />} />
          <Route path="/admin/verify-email" element={<Pages.StoreOwnerEmailVerification />} />
          <Route path="/admin/ai-context-window" element={<PageWrapper Component={Pages.AIContextWindow} pageName="AIContextWindow" />} />
          <Route path="/admin/translations" element={<PageWrapper Component={Pages.Translations} pageName="Translations" />} />
          <Route path="/admin/auth" element={<PageWrapper Component={Auth} pageName="Auth" />} />
          <Route path="/admin/forgotpassword" element={<Pages.AdminForgotPassword />} />
          <Route path="/admin/reset-password" element={<Pages.AdminResetPassword />} />

          {/* Plugins Section */}
          <Route path="/plugins" element={<PageWrapper Component={Pages.Plugins} pageName="Plugins" />} />
          <Route path="/plugins/*" element={<PageWrapper Component={Pages.Plugins} pageName="Plugins" />} />
          <Route path="/admin/plugins" element={<PageWrapper Component={Pages.Plugins} pageName="Plugins" />} />

          {/* Dynamic Plugin Admin Pages - 100% database-driven from plugin_admin_pages */}
          <Route path="/admin/plugins/:pluginSlug/:pageKey" element={<PageWrapper Component={DynamicPluginAdminPage} pageName="Plugin Admin Page" />} />
          
          {/* Editor routes - redirect to AI Workspace */}
          <Route path="/editor" element={<Navigate to="/ai-workspace" replace />} />
          <Route path="/editor/*" element={<Navigate to="/ai-workspace" replace />} />

          {/* AI Workspace - Unified Editor + AI */}
          <Route path="/ai-workspace" element={<PageWrapper Component={Pages.AIWorkspace} pageName="AIWorkspace" />} />

          {/* Custom Domain Routes (when accessed via custom domain like www.myshop.com) */}
          {/* These routes match only on actual custom store domains (not platform, dev, or hosting domains) */}
          {isCustomDomain() && (
            <>
              <Route path="/category/*" element={<PageWrapper Component={Pages.Category} pageName="Category" />} />
              <Route path="/product/:productSlug" element={<PageWrapper Component={Pages.ProductDetail} pageName="ProductDetail" />} />
              <Route path="/cart" element={<PageWrapper Component={Pages.Cart} pageName="Cart" />} />
              <Route path="/checkout" element={<PageWrapper Component={Pages.Checkout} pageName="Checkout" />} />
              <Route path="/order-success" element={<PageWrapper Component={Pages.OrderSuccess} pageName="OrderSuccess" />} />
              <Route path="/order-cancel" element={<PageWrapper Component={Pages.OrderCancel} pageName="OrderCancel" />} />
              <Route path="/login" element={<PageWrapper Component={Pages.CustomerAuth} pageName="CustomerAuth" />} />
              <Route path="/register" element={<PageWrapper Component={Pages.CustomerAuth} pageName="CustomerAuth" />} />
              <Route path="/forgot-password" element={<PageWrapper Component={Pages.CustomerAuth} pageName="CustomerAuth" />} />
              <Route path="/reset-password" element={<PageWrapper Component={Pages.ResetPassword} pageName="ResetPassword" />} />
              <Route path="/verify-email" element={<PageWrapper Component={Pages.EmailVerification} pageName="EmailVerification" />} />
              <Route path="/account" element={<PageWrapper Component={Pages.CustomerDashboard} pageName="CustomerDashboard" />} />
              <Route path="/cms-page/:pageSlug" element={<PageWrapper Component={Pages.CmsPageViewer} pageName="CmsPageViewer" />} />
              <Route path="/sitemap" element={<PageWrapper Component={Pages.SitemapPublic} pageName="SitemapPublic" />} />
              <Route path="/robots.txt" element={<Pages.RobotsPublic />} />
            </>
          )}

          {/* Public/Storefront routes with store code and dynamic parameters */}
          <Route path="/public/:storeCode/robots.txt" element={<Pages.RobotsTxtHandler />} />
          <Route path="/public/:storeCode/category/*" element={<PageWrapper Component={Pages.Category} pageName="Category" />} />
          <Route path="/public/:storeCode/product/:productSlug" element={<PageWrapper Component={Pages.ProductDetail} pageName="ProductDetail" />} />
          <Route path="/public/:storeCode/cart" element={<PageWrapper Component={Pages.Cart} pageName="Cart" />} />
          <Route path="/public/:storeCode/checkout" element={<PageWrapper Component={Pages.Checkout} pageName="Checkout" />} />
          <Route path="/public/:storeCode/order-success" element={<PageWrapper Component={Pages.OrderSuccess} pageName="OrderSuccess" />} />
          <Route path="/public/:storeCode/order-cancel" element={<PageWrapper Component={Pages.OrderCancel} pageName="OrderCancel" />} />
          <Route path="/public/:storeCode/login" element={<PageWrapper Component={Pages.CustomerAuth} pageName="CustomerAuth" />} />
          <Route path="/public/:storeCode/register" element={<PageWrapper Component={Pages.CustomerAuth} pageName="CustomerAuth" />} />
          <Route path="/public/:storeCode/forgot-password" element={<PageWrapper Component={Pages.CustomerAuth} pageName="CustomerAuth" />} />
          <Route path="/public/:storeCode/reset-password" element={<PageWrapper Component={Pages.ResetPassword} pageName="ResetPassword" />} />
          <Route path="/public/:storeCode/customer-auth" element={<PageWrapper Component={Pages.CustomerAuth} pageName="CustomerAuth" />} />
          <Route path="/public/:storeCode/verify-email" element={<PageWrapper Component={Pages.EmailVerification} pageName="EmailVerification" />} />
          <Route path="/public/:storeCode/account" element={<PageWrapper Component={Pages.CustomerDashboard} pageName="CustomerDashboard" />} />
          <Route path="/public/:storeCode/customer-dashboard" element={<PageWrapper Component={Pages.CustomerDashboard} pageName="CustomerDashboard" />} />
          <Route path="/public/:storeCode/cms-page/:pageSlug" element={<PageWrapper Component={Pages.CmsPageViewer} pageName="CmsPageViewer" />} />
          <Route path="/public/:storeCode/sitemap" element={<PageWrapper Component={Pages.SitemapPublic} pageName="SitemapPublic" />} />
          <Route path="/public/:storeCode" element={<PageWrapper Component={Pages.Storefront} pageName="Storefront" />} />
          <Route path="/landing" element={<PageWrapper Component={Pages.Landing} pageName="Landing" />} />

          {/* Blog routes */}
          <Route path="/blog" element={<Pages.Blog />} />
          <Route path="/blog/:slug" element={<Pages.Blog />} />

          {/* Special routes */}
          <Route path="/robots.txt" element={<PageWrapper Component={Pages.RobotsPublic} pageName="RobotsPublic" />} />
          <Route path="/cookie-consent" element={<PageWrapper Component={Pages.CookieConsent} pageName="CookieConsent" />} />

          {/* Auth route - redirect to admin auth */}
          <Route path="/auth" element={<Navigate to="/admin/auth" replace />} />

          {/* Team Invitation */}
          <Route path="/accept-invitation/:token" element={<Pages.AcceptInvitation />} />

          {/* Homepage */}
          <Route path="/" element={<PageWrapper Component={Pages.Storefront} pageName="Storefront" />} />

          {/* Catch all - show 404 page */}
          <Route path="*" element={<PageWrapper Component={Pages.NotFound} pageName="NotFound" />} />
            </Routes>
            <Toaster />
          </StoreSelectionProvider>
        </Router>
      </AIProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}

export default App