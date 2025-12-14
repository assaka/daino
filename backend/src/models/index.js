const User = require('./User');
const Store = require('./Store');
const Product = require('./Product');
const ProductTranslation = require('./ProductTranslation');
const ProductVariant = require('./ProductVariant');
const Category = require('./Category');
const Attribute = require('./Attribute');
const AttributeValue = require('./AttributeValue');
const ProductAttributeValue = require('./ProductAttributeValue');
const AttributeSet = require('./AttributeSet');
const Order = require('./Order');
const OrderItem = require('./OrderItem');
const Coupon = require('./Coupon');
const CmsPage = require('./CmsPage');
const CmsBlock = require('./CmsBlock');
const Tax = require('./Tax');
const ShippingMethod = require('./ShippingMethod');
const DeliverySettings = require('./DeliverySettings');
const LoginAttempt = require('./LoginAttempt');
const Customer = require('./Customer');
const Cart = require('./Cart');
const Wishlist = require('./Wishlist');
const Language = require('./Language');
const Translation = require('./Translation');
const CustomerActivity = require('./CustomerActivity');
const ABTest = require('./ABTest');
const ABTestAssignment = require('./ABTestAssignment');
const CustomAnalyticsEvent = require('./CustomAnalyticsEvent');
const SeoSettings = require('./SeoSettings');
const SeoTemplate = require('./SeoTemplate');
const Redirect = require('./Redirect');
const CanonicalUrl = require('./CanonicalUrl');
const ProductLabel = require('./ProductLabel');
const PaymentMethod = require('./PaymentMethod');
const CookieConsentSettings = require('./CookieConsentSettings');
const ConsentLog = require('./ConsentLog');
const Address = require('./Address');
const ProductTab = require('./ProductTab');
const StoreTeam = require('./StoreTeam');
const StoreInvitation = require('./StoreInvitation');
const IntegrationConfig = require('./IntegrationConfig');
const ImportStatistic = require('./ImportStatistic');
const Plugin = require('./Plugin');
const PluginConfiguration = require('./PluginConfiguration');
// Note: SupabaseOAuthToken and ShopifyOAuthToken are OBSOLETE
// Use supabase-integration.js and shopify-integration.js services instead
// These services read/write to the integration_configs table
const MediaAsset = require('./MediaAsset');
// Master database models (business management)
const Subscription = require('./Subscription');
const UsageMetric = require('./UsageMetric');
const CustomDomain = require('./CustomDomain');
const AkeneoCustomMapping = require('./AkeneoCustomMapping');
const AkeneoSchedule = require('./AkeneoSchedule');
const Credit = require('./Credit');
const CreditTransaction = require('./CreditTransaction');
const CreditUsage = require('./CreditUsage');
const ServiceCreditCost = require('./ServiceCreditCost');
const CronJob = require('./CronJob');
const CronJobExecution = require('./CronJobExecution');
const SlotConfiguration = require('./SlotConfiguration');
// Email system models
const EmailTemplate = require('./EmailTemplate');
const EmailTemplateTranslation = require('./EmailTemplateTranslation');
const PdfTemplate = require('./PdfTemplate');
const PdfTemplateTranslation = require('./PdfTemplateTranslation');
// Note: BrevoConfiguration is OBSOLETE - use brevo-service.js which reads from integration_configs
const EmailSendLog = require('./EmailSendLog');
// Blacklist models
const BlacklistIP = require('./BlacklistIP');
const BlacklistCountry = require('./BlacklistCountry');
const BlacklistEmail = require('./BlacklistEmail');
const BlacklistSettings = require('./BlacklistSettings');

// Define associations
const defineAssociations = () => {
  // User associations
  User.hasMany(Store, { foreignKey: 'user_id', as: 'ownedStores' });

  // Store associations
  Store.belongsTo(User, { foreignKey: 'user_id', as: 'owner' });
  Store.hasMany(Product, { foreignKey: 'store_id' });
  Store.hasMany(Category, { foreignKey: 'store_id' });
  Store.hasMany(Attribute, { foreignKey: 'store_id' });
  Store.hasMany(AttributeSet, { foreignKey: 'store_id' });
  Store.hasMany(Order, { foreignKey: 'store_id' });
  Store.hasMany(Coupon, { foreignKey: 'store_id' });
  Store.hasMany(CmsPage, { foreignKey: 'store_id' });
  Store.hasMany(CmsBlock, { foreignKey: 'store_id' });
  Store.hasMany(Tax, { foreignKey: 'store_id' });
  Store.hasMany(ShippingMethod, { foreignKey: 'store_id' });
  Store.hasOne(DeliverySettings, { foreignKey: 'store_id' });

  // Product associations
  Product.belongsTo(Store, { foreignKey: 'store_id' });
  Product.belongsTo(AttributeSet, { foreignKey: 'attribute_set_id' });
  Product.hasMany(OrderItem, { foreignKey: 'product_id' });
  Product.hasMany(ProductTranslation, { as: 'translations', foreignKey: 'product_id' });

  // ProductTranslation associations
  ProductTranslation.belongsTo(Product, { foreignKey: 'product_id' });

  // Configurable product associations
  Product.belongsTo(Product, { as: 'parentProduct', foreignKey: 'parent_id' });
  Product.hasMany(Product, { as: 'variants', foreignKey: 'parent_id' });

  // ProductVariant associations (many-to-many through junction table)
  Product.belongsToMany(Product, {
    as: 'variantProducts',
    through: ProductVariant,
    foreignKey: 'parent_product_id',
    otherKey: 'variant_product_id'
  });
  Product.belongsToMany(Product, {
    as: 'parentProducts',
    through: ProductVariant,
    foreignKey: 'variant_product_id',
    otherKey: 'parent_product_id'
  });

  ProductVariant.belongsTo(Product, { as: 'parent', foreignKey: 'parent_product_id' });
  ProductVariant.belongsTo(Product, { as: 'variant', foreignKey: 'variant_product_id' });

  // Category associations
  Category.belongsTo(Store, { foreignKey: 'store_id' });
  Category.belongsTo(Category, { as: 'parent', foreignKey: 'parent_id' });
  Category.hasMany(Category, { as: 'children', foreignKey: 'parent_id' });

  // Attribute associations
  Attribute.belongsTo(Store, { foreignKey: 'store_id' });
  Attribute.hasMany(AttributeValue, { foreignKey: 'attribute_id', as: 'values' });

  // AttributeValue associations
  AttributeValue.belongsTo(Attribute, { foreignKey: 'attribute_id' });

  // ProductAttributeValue associations
  ProductAttributeValue.belongsTo(Product, { foreignKey: 'product_id' });
  ProductAttributeValue.belongsTo(Attribute, { foreignKey: 'attribute_id' });
  ProductAttributeValue.belongsTo(AttributeValue, { foreignKey: 'value_id', as: 'value' });

  // Product attribute values
  Product.hasMany(ProductAttributeValue, { foreignKey: 'product_id', as: 'attributeValues' });

  // AttributeSet associations
  AttributeSet.belongsTo(Store, { foreignKey: 'store_id' });
  AttributeSet.hasMany(Product, { foreignKey: 'attribute_set_id' });

  // Order associations
  Order.belongsTo(Store, { foreignKey: 'store_id' });
  Order.belongsTo(Customer, { as: 'customer', foreignKey: 'customer_id' });
  Order.hasMany(OrderItem, { foreignKey: 'order_id' });

  // OrderItem associations
  OrderItem.belongsTo(Order, { foreignKey: 'order_id' });
  OrderItem.belongsTo(Product, { foreignKey: 'product_id' });

  // Coupon associations
  Coupon.belongsTo(Store, { foreignKey: 'store_id' });

  // CmsPage associations
  CmsPage.belongsTo(Store, { foreignKey: 'store_id' });

  // CmsBlock associations
  CmsBlock.belongsTo(Store, { foreignKey: 'store_id' });

  // Tax associations
  Tax.belongsTo(Store, { foreignKey: 'store_id' });

  // ShippingMethod associations
  ShippingMethod.belongsTo(Store, { foreignKey: 'store_id' });

  // DeliverySettings associations
  DeliverySettings.belongsTo(Store, { foreignKey: 'store_id' });

  // Customer associations
  Customer.belongsTo(Store, { foreignKey: 'store_id' });
  Customer.hasMany(Order, { foreignKey: 'customer_id' });
  Store.hasMany(Customer, { foreignKey: 'store_id' });

  // Cart associations
  Cart.belongsTo(Store, { foreignKey: 'store_id' });
  Cart.belongsTo(User, { foreignKey: 'user_id' });
  Store.hasMany(Cart, { foreignKey: 'store_id' });

  // Wishlist associations
  Wishlist.belongsTo(Store, { foreignKey: 'store_id' });
  Wishlist.belongsTo(User, { foreignKey: 'user_id' });
  Wishlist.belongsTo(Product, { foreignKey: 'product_id' });
  Store.hasMany(Wishlist, { foreignKey: 'store_id' });
  Product.hasMany(Wishlist, { foreignKey: 'product_id' });

  // CustomerActivity associations
  CustomerActivity.belongsTo(Store, { foreignKey: 'store_id' });
  CustomerActivity.belongsTo(User, { foreignKey: 'user_id' });
  CustomerActivity.belongsTo(Product, { foreignKey: 'product_id' });
  Store.hasMany(CustomerActivity, { foreignKey: 'store_id' });

  // ABTest associations
  ABTest.belongsTo(Store, { foreignKey: 'store_id' });
  Store.hasMany(ABTest, { foreignKey: 'store_id' });

  // ABTestAssignment associations
  ABTestAssignment.belongsTo(ABTest, { foreignKey: 'test_id' });
  ABTestAssignment.belongsTo(Store, { foreignKey: 'store_id' });
  ABTestAssignment.belongsTo(User, { foreignKey: 'user_id' });
  ABTest.hasMany(ABTestAssignment, { foreignKey: 'test_id' });
  Store.hasMany(ABTestAssignment, { foreignKey: 'store_id' });

  // CustomAnalyticsEvent associations
  CustomAnalyticsEvent.belongsTo(Store, { foreignKey: 'store_id' });
  Store.hasMany(CustomAnalyticsEvent, { foreignKey: 'store_id' });

  // SeoSettings associations
  SeoSettings.belongsTo(Store, { foreignKey: 'store_id' });
  Store.hasOne(SeoSettings, { foreignKey: 'store_id' });

  // SeoTemplate associations
  SeoTemplate.belongsTo(Store, { foreignKey: 'store_id' });
  Store.hasMany(SeoTemplate, { foreignKey: 'store_id' });

  // Redirect associations
  Redirect.belongsTo(Store, { foreignKey: 'store_id' });
  Store.hasMany(Redirect, { foreignKey: 'store_id' });

  // CanonicalUrl associations
  CanonicalUrl.belongsTo(Store, { foreignKey: 'store_id' });
  CanonicalUrl.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
  Store.hasMany(CanonicalUrl, { foreignKey: 'store_id' });

  // ProductLabel associations
  ProductLabel.belongsTo(Store, { foreignKey: 'store_id' });
  Store.hasMany(ProductLabel, { foreignKey: 'store_id' });

  // PaymentMethod associations
  PaymentMethod.belongsTo(Store, { foreignKey: 'store_id' });
  Store.hasMany(PaymentMethod, { foreignKey: 'store_id' });

  // CookieConsentSettings associations
  CookieConsentSettings.belongsTo(Store, { foreignKey: 'store_id' });
  Store.hasOne(CookieConsentSettings, { foreignKey: 'store_id' });

  // ConsentLog associations
  ConsentLog.belongsTo(Store, { foreignKey: 'store_id' });
  ConsentLog.belongsTo(User, { foreignKey: 'user_id' });
  Store.hasMany(ConsentLog, { foreignKey: 'store_id' });

  // Address associations - support both Users and Customers
  Address.belongsTo(User, { foreignKey: 'user_id' });
  Address.belongsTo(Customer, { foreignKey: 'customer_id' });
  User.hasMany(Address, { foreignKey: 'user_id' });
  Customer.hasMany(Address, { foreignKey: 'customer_id' });

  // ProductTab associations
  ProductTab.belongsTo(Store, { foreignKey: 'store_id' });
  Store.hasMany(ProductTab, { foreignKey: 'store_id' });

  // StoreTeam associations
  StoreTeam.belongsTo(Store, { foreignKey: 'store_id' });
  StoreTeam.belongsTo(User, { foreignKey: 'user_id' });
  StoreTeam.belongsTo(User, { as: 'inviter', foreignKey: 'invited_by' });
  Store.hasMany(StoreTeam, { foreignKey: 'store_id' });
  User.hasMany(StoreTeam, { foreignKey: 'user_id' });

  // StoreInvitation associations
  StoreInvitation.belongsTo(Store, { foreignKey: 'store_id' });
  StoreInvitation.belongsTo(User, { as: 'inviter', foreignKey: 'invited_by' });
  StoreInvitation.belongsTo(User, { as: 'accepter', foreignKey: 'accepted_by' });
  Store.hasMany(StoreInvitation, { foreignKey: 'store_id' });
  User.hasMany(StoreInvitation, { as: 'sentInvitations', foreignKey: 'invited_by' });

  // IntegrationConfig associations - REMOVED (IntegrationConfig is now a pure service class, not a Sequelize model)

  // ImportStatistic associations - REMOVED (now a pure service class)

  // Plugin associations (plugins are platform-wide, no store association)
  
  // PluginConfiguration associations (store-specific plugin configs)
  PluginConfiguration.belongsTo(Plugin, { foreignKey: 'plugin_id', as: 'plugin' });
  PluginConfiguration.belongsTo(Store, { foreignKey: 'store_id', as: 'store' });
  PluginConfiguration.belongsTo(User, { foreignKey: 'last_configured_by', as: 'configuredBy' });
  
  Plugin.hasMany(PluginConfiguration, { foreignKey: 'plugin_id', as: 'storeConfigurations' });
  Store.hasMany(PluginConfiguration, { foreignKey: 'store_id', as: 'pluginConfigurations' });
  User.hasMany(PluginConfiguration, { foreignKey: 'last_configured_by', as: 'configuredPlugins' });
  
  // Note: SupabaseOAuthToken and ShopifyOAuthToken associations removed
  // These are now handled by integration_configs table via services
  
  // Master database associations
  // Subscription associations
  Subscription.belongsTo(Store, { foreignKey: 'store_id', as: 'store' });
  Store.hasMany(Subscription, { foreignKey: 'store_id', as: 'subscriptions' });

  // UsageMetric associations
  UsageMetric.belongsTo(Store, { foreignKey: 'store_id', as: 'store' });
  Store.hasMany(UsageMetric, { foreignKey: 'store_id', as: 'usageMetrics' });

  // CustomDomain associations
  CustomDomain.belongsTo(Store, { foreignKey: 'store_id', as: 'store' });
  Store.hasMany(CustomDomain, { foreignKey: 'store_id', as: 'customDomains' });

  // Credit system associations
  // Note: Credit model still uses Sequelize
  Credit.belongsTo(User, { foreignKey: 'user_id' });
  Credit.belongsTo(Store, { foreignKey: 'store_id' });
  User.hasMany(Credit, { foreignKey: 'user_id' });
  Store.hasMany(Credit, { foreignKey: 'store_id' });

  // Note: CreditTransaction, CreditUsage now use Supabase client - no Sequelize associations needed
  // Associations are handled at the database level via foreign keys

  // Note: Job and JobHistory models removed - now using job_queue table via masterDbClient
  // Associations are handled at the database level via foreign keys

  // CronJob associations
  CronJob.hasMany(CronJobExecution, { foreignKey: 'cron_job_id', as: 'executions', onDelete: 'CASCADE' });
  CronJob.belongsTo(Store, { foreignKey: 'store_id' });
  CronJob.belongsTo(User, { foreignKey: 'user_id' });

  // CronJobExecution associations
  CronJobExecution.belongsTo(CronJob, { foreignKey: 'cron_job_id', as: 'cronJob' });

  // Note: AkeneoSchedule now uses Supabase client - no Sequelize associations needed
  // Associations are handled at the database level via foreign keys

  // Phoenix Slot System associations
  SlotConfiguration.belongsTo(User, { foreignKey: 'user_id' });
  SlotConfiguration.belongsTo(Store, { foreignKey: 'store_id' });
  User.hasMany(SlotConfiguration, { foreignKey: 'user_id' });
  Store.hasMany(SlotConfiguration, { foreignKey: 'store_id' });

  // Email system associations
  EmailTemplate.belongsTo(Store, { foreignKey: 'store_id', as: 'store' });
  EmailTemplate.hasMany(EmailTemplateTranslation, { foreignKey: 'email_template_id', as: 'translationsData', onDelete: 'CASCADE' });
  EmailTemplate.hasMany(EmailSendLog, { foreignKey: 'email_template_id', as: 'emailSendLogs' });
  Store.hasMany(EmailTemplate, { foreignKey: 'store_id', as: 'emailTemplates' });

  EmailTemplateTranslation.belongsTo(EmailTemplate, { foreignKey: 'email_template_id', as: 'emailTemplate' });

  // Note: BrevoConfiguration associations removed - now handled by integration_configs via brevo-service.js

  EmailSendLog.belongsTo(Store, { foreignKey: 'store_id', as: 'store' });
  EmailSendLog.belongsTo(EmailTemplate, { foreignKey: 'email_template_id', as: 'emailTemplate' });
  Store.hasMany(EmailSendLog, { foreignKey: 'store_id', as: 'emailSendLogs' });

  // PDF template associations
  PdfTemplate.belongsTo(Store, { foreignKey: 'store_id', as: 'store' });
  PdfTemplate.hasMany(PdfTemplateTranslation, { foreignKey: 'pdf_template_id', as: 'translationsData', onDelete: 'CASCADE' });
  Store.hasMany(PdfTemplate, { foreignKey: 'store_id', as: 'pdfTemplates' });

  PdfTemplateTranslation.belongsTo(PdfTemplate, { foreignKey: 'pdf_template_id', as: 'pdfTemplate' });

};

// Initialize associations
defineAssociations();

module.exports = {
  User,
  Store,
  Product,
  ProductTranslation,
  ProductVariant,
  Category,
  Attribute,
  AttributeValue,
  ProductAttributeValue,
  AttributeSet,
  Order,
  OrderItem,
  Coupon,
  CmsPage,
  CmsBlock,
  Tax,
  ShippingMethod,
  DeliverySettings,
  LoginAttempt,
  Customer,
  Cart,
  Wishlist,
  Language,
  Translation,
  CustomerActivity,
  ABTest,
  ABTestAssignment,
  CustomAnalyticsEvent,
  SeoSettings,
  SeoTemplate,
  Redirect,
  CanonicalUrl,
  ProductLabel,
  PaymentMethod,
  CookieConsentSettings,
  ConsentLog,
  Address,
  ProductTab,
  StoreTeam,
  StoreInvitation,
  // IntegrationConfig - REMOVED from exports (import directly from models/IntegrationConfig.js)
  ImportStatistic,
  Plugin,
  PluginConfiguration,
  // Note: SupabaseOAuthToken and ShopifyOAuthToken are OBSOLETE - removed from exports
  // Use services: supabase-integration.js and shopify-integration.js
  MediaAsset,
  // Master database models
  Subscription,
  UsageMetric,
  CustomDomain,
  AkeneoCustomMapping,
  AkeneoSchedule,
  Credit,
  CreditTransaction,
  CreditUsage,
  ServiceCreditCost,
  CronJob,
  CronJobExecution,
  SlotConfiguration,
  // Email system models
  EmailTemplate,
  EmailTemplateTranslation,
  PdfTemplate,
  PdfTemplateTranslation,
  // Note: BrevoConfiguration is OBSOLETE - removed from exports
  // Use brevo-service.js which reads from integration_configs
  EmailSendLog,
  // Blacklist models
  BlacklistIP,
  BlacklistCountry,
  BlacklistEmail,
  BlacklistSettings,
};