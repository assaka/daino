// Central export file for all pages
// This file re-exports pages from their new organized locations

// Admin Pages
export { default as Dashboard } from './admin/Dashboard';
export { default as Products } from './admin/Products';
export { default as Categories } from './admin/Categories';
export { default as Attributes } from './admin/Attributes';
export { default as Orders } from './admin/Orders';
export { default as SalesSettings } from './admin/SalesSettings';
export { default as Customers } from './admin/Customers';
export { default as Blacklist } from './admin/Blacklist';
export { default as CustomerActivity } from './admin/CustomerActivity';
export { default as Coupons } from './admin/Coupons';
export { default as Tax } from './admin/Tax';
export { default as ShippingMethods } from './admin/ShippingMethods';
export { default as PaymentMethods } from './admin/PaymentMethods';
export { default as StripeOAuthCallback } from './admin/StripeOAuthCallback';
export { default as DeliverySettings } from './admin/DeliverySettings';
export { default as StockSettings } from './admin/StockSettings';
export { default as Cache } from './admin/Cache';
export { default as CmsBlocks } from './admin/CmsBlocks';
export { default as CmsPages } from './admin/CmsPages';
export { default as Emails } from './admin/Emails';
export { default as EmailSettings } from './admin/EmailSettings';
export { default as FileLibrary } from './admin/FileLibrary';
export { default as MediaStorage } from './admin/MediaStorage';
export { default as CustomDomains } from './admin/CustomDomains';
export { default as Stores } from './admin/Stores';
export { default as Settings } from './admin/Settings';
export { default as DatabaseIntegrations } from './admin/DatabaseIntegrations';
export { default as ShopifyIntegration } from './admin/ShopifyIntegration';
export { default as AkeneoIntegration } from './admin/AkeneoIntegration';
// Unified Plugin System
export { default as ProductTabs } from './admin/ProductTabs';
export { default as ProductLabels } from './admin/ProductLabels';
export { default as CustomOptionRules } from './admin/CustomOptionRules';
export { default as MarketplaceHub } from './admin/MarketplaceHub';
export { default as BackgroundJobs } from './admin/BackgroundJobs';
export { default as JobScheduler } from './admin/JobScheduler';
export { default as ImportExportJobs } from './admin/ImportExportJobs';
export { default as SeoSettings } from './admin/SeoSettings';
export { default as SeoTemplates } from './admin/SeoTemplates';
export { default as SeoRedirects } from './admin/SeoRedirects';
export { default as SeoCanonical } from './admin/SeoCanonical';
export { default as SeoHreflang } from './admin/SeoHreflang';
export { default as SeoRobots } from './admin/SeoRobots';
export { default as SeoSocial } from './admin/SeoSocial';
export { default as SeoReport } from './admin/SeoReport';
export { default as XmlSitemap } from './admin/XmlSitemap';
export { default as RobotsTxt } from './admin/RobotsTxt';
export { default as HtmlSitemap } from './admin/HtmlSitemap';
export { default as AnalyticsSettings } from './admin/AnalyticsSettings';
export { default as HeatmapAnalytics } from './admin/HeatmapAnalytics';
export { default as ABTesting } from './admin/ABTesting';
export { default as Billing } from './admin/Billing';
export { default as UptimeReport } from './admin/UptimeReport';
export { default as TeamPage } from './admin/TeamPage';
export { default as StoreOnboarding } from './admin/StoreOnboarding';
export { default as ThemeLayout } from './admin/ThemeLayout';
export { default as Storefronts } from './admin/Storefronts';
export { default as Translations } from './admin/Translations';
export { default as Plugins } from './admin/Plugins';
export { default as CookieConsent } from './admin/CookieConsent';
export { default as NavigationManager } from './admin/NavigationManager';

// Editor Pages
export { default as AIContextWindow } from './editor/EditorWrapper';
export { default as EditorWrapper } from './editor/EditorWrapper';
export { default as HeaderSlotsEditor } from './editor/HeaderSlotsEditor';
export { default as CartSlotsEditor } from './editor/CartSlotsEditor';
export { default as CategorySlotsEditor } from './editor/CategorySlotsEditor';
export { default as ProductSlotsEditor } from './editor/ProductSlotsEditor';

// AI Workspace (Unified Editor + AI)
export { default as AIWorkspace } from './ai-workspace/AIWorkspace';

// Storefront Pages
export { default as Homepage } from './storefront/Homepage';
export { default as Category } from './storefront/Category';
export { default as ProductDetail } from './storefront/ProductDetail';
export { default as Cart } from './storefront/Cart';
export { default as Checkout } from './storefront/Checkout';
export { default as OrderSuccess } from './storefront/OrderSuccess';
export { default as OrderCancel } from './storefront/OrderCancel';
export { default as CustomerAuth } from './storefront/CustomerAuth';
export { default as ResetPassword } from './storefront/ResetPassword';
export { default as EmailVerification } from './storefront/EmailVerification';
export { default as CustomerDashboard } from './storefront/CustomerDashboard';
export { default as Storefront } from './storefront/Storefront';
export { default as CmsPageViewer } from './storefront/CmsPageViewer';
export { default as RobotsPublic } from './storefront/RobotsPublic';
export { default as RobotsTxtHandler } from './RobotsTxtHandler';
export { default as SitemapPublic } from './storefront/SitemapPublic';
export { default as Landing } from './storefront/Landing';
export { default as NotFound } from './storefront/NotFound';

// Invitation Pages
export { default as AcceptInvitation } from './AcceptInvitation';