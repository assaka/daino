# Plugin Architecture Implementation Plan
## AI-Powered Plugin System with Magento-Inspired Events

---

## 🎯 Executive Summary

Build a comprehensive plugin system for the e-commerce platform that enables:
- **AI-powered plugin generation** using existing DainoStoreAIStudio
- **Magento-inspired hooks & events** using existing HookSystem & EventSystem
- **Dynamic admin navigation** loaded from database
- **Widget integration** with existing slot editor
- **Multi-tenant architecture** with master marketplace + per-tenant databases
- **Marketplace** for sharing and monetizing plugins

---

## 🗄️ DATABASE ARCHITECTURE

### Master Database (Shared Across All Tenants)

```sql
-- ==========================================
-- PLUGIN MARKETPLACE
-- ==========================================

-- Main plugin catalog
CREATE TABLE plugin_marketplace (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  version TEXT NOT NULL,
  description TEXT,
  author_id UUID NOT NULL,
  category TEXT, -- 'payments', 'shipping', 'reviews', 'marketing', etc.

  -- ==========================================
  -- PRICING CONFIGURATION
  -- ==========================================
  pricing_model TEXT NOT NULL DEFAULT 'free', -- 'free', 'one_time', 'subscription', 'freemium', 'custom'
  base_price DECIMAL(10,2) DEFAULT 0.00, -- One-time purchase price
  currency TEXT DEFAULT 'USD',

  -- Subscription pricing
  monthly_price DECIMAL(10,2), -- Monthly subscription price
  yearly_price DECIMAL(10,2), -- Yearly subscription price (usually discounted)

  -- Custom pricing tiers (JSONB for flexibility)
  -- Example: [{"tier": "starter", "price": 29, "features": ["feature1", "feature2"]}, ...]
  pricing_tiers JSONB,

  -- Revenue sharing
  revenue_share_percentage DECIMAL(5,2) DEFAULT 70.00, -- Creator gets 70%, platform 30%

  -- License configuration
  license_type TEXT DEFAULT 'per_store', -- 'per_store', 'unlimited', 'per_user'

  -- Trial options
  has_trial BOOLEAN DEFAULT false,
  trial_days INTEGER DEFAULT 0,

  -- ==========================================
  -- MARKETPLACE METRICS
  -- ==========================================
  downloads INTEGER DEFAULT 0,
  active_installations INTEGER DEFAULT 0,
  rating DECIMAL DEFAULT 0.0,
  reviews_count INTEGER DEFAULT 0,
  total_revenue DECIMAL(12,2) DEFAULT 0.00,

  -- Full plugin source code and configuration
  source_code_template JSONB NOT NULL, -- Complete plugin structure
  manifest JSONB NOT NULL, -- Plugin metadata

  -- Screenshots and media
  icon_url TEXT,
  screenshots JSONB, -- Array of image URLs

  -- Documentation
  documentation_url TEXT,
  changelog TEXT,

  -- Status
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'archived'

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_marketplace_category ON plugin_marketplace(category);
CREATE INDEX idx_marketplace_status ON plugin_marketplace(status);
CREATE INDEX idx_marketplace_downloads ON plugin_marketplace(downloads DESC);
CREATE INDEX idx_marketplace_rating ON plugin_marketplace(rating DESC);

-- Plugin version history
CREATE TABLE plugin_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id UUID NOT NULL REFERENCES plugin_marketplace(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  changelog TEXT,
  release_date TIMESTAMP DEFAULT NOW(),

  -- Version-specific code
  hooks_code JSONB,
  events_code JSONB,
  scripts_code JSONB,
  widgets_code JSONB,
  navigation_items JSONB,

  -- Compatibility
  min_platform_version TEXT,
  max_platform_version TEXT,
  dependencies JSONB, -- Other plugins this version depends on

  is_latest BOOLEAN DEFAULT false,

  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(plugin_id, version)
);

CREATE INDEX idx_versions_plugin ON plugin_versions(plugin_id);
CREATE INDEX idx_versions_latest ON plugin_versions(is_latest) WHERE is_latest = true;

-- ==========================================
-- ADMIN NAVIGATION REGISTRY (SOURCE OF TRUTH)
-- ==========================================

CREATE TABLE admin_navigation_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Navigation item identity
  key TEXT UNIQUE NOT NULL, -- 'dashboard', 'products', 'ekomi-reviews'
  label TEXT NOT NULL, -- 'Dashboard', 'Products', 'Ekomi Reviews'
  icon TEXT, -- Lucide icon name: 'home', 'package', 'star'
  route TEXT NOT NULL, -- '/admin', '/admin/products', '/admin/ekomi'

  -- Hierarchy
  parent_key TEXT, -- NULL for root items, 'plugins' for nested under plugins
  order_position INTEGER DEFAULT 100,

  -- Permissions
  required_permission TEXT, -- 'admin', 'products.manage', etc.

  -- Source
  is_core BOOLEAN DEFAULT false, -- true for built-in, false for plugins
  plugin_id UUID, -- NULL for core, plugin ID for plugin items

  -- Organization
  category TEXT, -- 'main', 'settings', 'plugins', 'tools'

  -- Visibility
  is_visible BOOLEAN DEFAULT true,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  FOREIGN KEY (plugin_id) REFERENCES plugin_marketplace(id) ON DELETE CASCADE
);

CREATE INDEX idx_nav_core ON admin_navigation_registry(is_core);
CREATE INDEX idx_nav_plugin ON admin_navigation_registry(plugin_id) WHERE plugin_id IS NOT NULL;
CREATE INDEX idx_nav_parent ON admin_navigation_registry(parent_key);
CREATE INDEX idx_nav_order ON admin_navigation_registry(order_position);

-- ==========================================
-- PLUGIN LICENSES
-- ==========================================

CREATE TABLE plugin_licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id UUID NOT NULL REFERENCES plugin_marketplace(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL, -- Which tenant owns this license

  -- License details
  license_key TEXT UNIQUE NOT NULL,
  license_type TEXT NOT NULL, -- 'trial', 'basic', 'pro', 'enterprise'

  -- Pricing & Payment
  pricing_model TEXT NOT NULL, -- 'free', 'one_time', 'subscription'
  purchase_date TIMESTAMP DEFAULT NOW(),
  amount_paid DECIMAL(10,2),
  currency TEXT DEFAULT 'USD',

  -- Subscription details (if applicable)
  billing_interval TEXT, -- 'month', 'year', NULL for one-time
  subscription_status TEXT, -- 'active', 'cancelled', 'expired', 'past_due'
  next_billing_date TIMESTAMP,
  subscription_id TEXT, -- Stripe subscription ID

  -- Payment tracking
  stripe_customer_id TEXT,
  stripe_payment_intent_id TEXT,
  last_payment_date TIMESTAMP,

  -- Validity
  expires_at TIMESTAMP, -- NULL for lifetime licenses
  is_active BOOLEAN DEFAULT true,

  -- Limits
  max_installations INTEGER DEFAULT 1,
  current_installations INTEGER DEFAULT 0,

  -- Cancellation
  cancelled_at TIMESTAMP,
  cancellation_reason TEXT,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_licenses_plugin ON plugin_licenses(plugin_id);
CREATE INDEX idx_licenses_tenant ON plugin_licenses(tenant_id);
CREATE INDEX idx_licenses_active ON plugin_licenses(is_active) WHERE is_active = true;

-- ==========================================
-- PLUGIN REVIEWS
-- ==========================================

CREATE TABLE plugin_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id UUID NOT NULL REFERENCES plugin_marketplace(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,

  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review TEXT,

  -- Verification
  is_verified_purchase BOOLEAN DEFAULT false,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(plugin_id, tenant_id, user_id)
);

CREATE INDEX idx_reviews_plugin ON plugin_reviews(plugin_id);
CREATE INDEX idx_reviews_rating ON plugin_reviews(rating);
```

---

### Tenant Database (Per-Tenant Isolation)

```sql
-- ==========================================
-- INSTALLED PLUGINS
-- ==========================================

CREATE TABLE plugins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Plugin identity
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  version TEXT NOT NULL,

  -- Link to marketplace
  marketplace_plugin_id UUID, -- References master.plugin_marketplace.id

  -- Status
  status TEXT DEFAULT 'active', -- 'active', 'inactive', 'error', 'updating'

  -- Configuration
  manifest JSONB NOT NULL, -- Plugin structure and metadata
  config_data JSONB, -- Tenant-specific settings

  -- Installation tracking
  installed_at TIMESTAMP DEFAULT NOW(),
  installed_by UUID,
  enabled_at TIMESTAMP,
  last_error TEXT,

  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_plugins_marketplace ON plugins(marketplace_plugin_id);
CREATE INDEX idx_plugins_status ON plugins(status);
CREATE INDEX idx_plugins_slug ON plugins(slug);

-- ==========================================
-- PLUGIN HOOKS
-- ==========================================

CREATE TABLE plugin_hooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id UUID NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,

  -- Hook details
  hook_name TEXT NOT NULL, -- 'cart.add_item', 'product.save', 'order.create'
  hook_type TEXT NOT NULL, -- 'filter' (transforms data) or 'action' (side effect)
  handler_code TEXT NOT NULL, -- Actual JavaScript function code

  -- Execution
  priority INTEGER DEFAULT 10, -- Lower = higher priority
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  description TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_hooks_plugin ON plugin_hooks(plugin_id);
CREATE INDEX idx_hooks_name ON plugin_hooks(hook_name);
CREATE INDEX idx_hooks_active ON plugin_hooks(is_active) WHERE is_active = true;

-- ==========================================
-- PLUGIN EVENTS (MAGENTO-STYLE)
-- ==========================================

CREATE TABLE plugin_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id UUID NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,

  -- Event details
  event_name TEXT NOT NULL, -- 'order.created', 'customer.login', 'product.view'
  event_location TEXT, -- Magento-style: 'checkout.onepage.controller.success.action'
  handler_code TEXT NOT NULL, -- Event listener function

  -- Execution
  priority INTEGER DEFAULT 10,
  is_active BOOLEAN DEFAULT true,
  is_async BOOLEAN DEFAULT false, -- Run asynchronously?

  -- Metadata
  description TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_events_plugin ON plugin_events(plugin_id);
CREATE INDEX idx_events_name ON plugin_events(event_name);
CREATE INDEX idx_events_active ON plugin_events(is_active) WHERE is_active = true;

-- ==========================================
-- PLUGIN SCRIPTS
-- ==========================================

CREATE TABLE plugin_scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id UUID NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,

  -- Script details
  script_name TEXT NOT NULL,
  script_type TEXT NOT NULL, -- 'frontend', 'backend', 'admin'
  script_code TEXT NOT NULL,

  -- Loading
  load_location TEXT, -- 'head', 'body-start', 'body-end'
  load_order INTEGER DEFAULT 100,

  -- Dependencies
  dependencies JSONB, -- Libraries or other scripts needed

  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_scripts_plugin ON plugin_scripts(plugin_id);
CREATE INDEX idx_scripts_type ON plugin_scripts(script_type);

-- ==========================================
-- PLUGIN WIDGETS (FOR SLOT EDITOR)
-- ==========================================

CREATE TABLE plugin_widgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id UUID NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,

  -- Widget identity
  widget_name TEXT NOT NULL, -- 'EkomiReviews', 'GiftPopup'
  display_name TEXT NOT NULL, -- 'Ekomi Product Reviews', 'Gift Product Popup'

  -- Component
  component_code TEXT NOT NULL, -- React component code

  -- Configuration
  config_schema JSONB, -- JSON Schema for widget configuration
  default_config JSONB, -- Default configuration values

  -- Display in slot editor
  icon TEXT, -- Lucide icon name
  category TEXT, -- 'Reviews', 'Marketing', 'Popups', etc.
  description TEXT,
  preview_image_url TEXT,

  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_widgets_plugin ON plugin_widgets(plugin_id);
CREATE INDEX idx_widgets_category ON plugin_widgets(category);
CREATE INDEX idx_widgets_active ON plugin_widgets(is_active) WHERE is_active = true;

-- ==========================================
-- ADMIN NAVIGATION CONFIG (TENANT OVERRIDES)
-- ==========================================

CREATE TABLE admin_navigation_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References master.admin_navigation_registry.key
  nav_item_key TEXT NOT NULL,

  -- Tenant customizations
  is_enabled BOOLEAN DEFAULT true, -- Can disable items
  custom_label TEXT, -- Can rename
  custom_order INTEGER, -- Can reorder
  custom_icon TEXT, -- Can change icon
  parent_key TEXT, -- Can move to different parent

  -- Badges/counters
  badge_text TEXT,
  badge_color TEXT,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(nav_item_key)
);

CREATE INDEX idx_nav_config_key ON admin_navigation_config(nav_item_key);
CREATE INDEX idx_nav_config_enabled ON admin_navigation_config(is_enabled);

-- ==========================================
-- PLUGIN DATA STORAGE
-- ==========================================

CREATE TABLE plugin_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id UUID NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,

  -- Key-value storage
  data_key TEXT NOT NULL,
  data_value JSONB NOT NULL,

  -- Metadata
  data_type TEXT, -- 'config', 'cache', 'user_data'

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(plugin_id, data_key)
);

CREATE INDEX idx_plugin_data_plugin ON plugin_data(plugin_id);
CREATE INDEX idx_plugin_data_key ON plugin_data(data_key);
CREATE INDEX idx_plugin_data_type ON plugin_data(data_type);
```

---

## 🔄 MASTER-TENANT RELATIONSHIP FLOW

```
┌──────────────────────────────────────────────────────────────┐
│                     MASTER DATABASE                          │
│                  (Shared - All Tenants)                      │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  📦 plugin_marketplace                                       │
│     ├─ All available plugins                                 │
│     ├─ Source code templates                                 │
│     ├─ Metadata, pricing, ratings                           │
│     └─ Approved/published plugins                           │
│                                                               │
│  📋 plugin_versions                                          │
│     ├─ Version history                                       │
│     ├─ Updates & patches                                     │
│     └─ Compatibility info                                    │
│                                                               │
│  🧭 admin_navigation_registry ⭐ (SOURCE OF TRUTH)           │
│     ├─ Core navigation items (Dashboard, Products, etc)     │
│     ├─ Plugin navigation items (Ekomi, Gift Manager, etc)   │
│     ├─ Hierarchy & ordering                                  │
│     └─ Referenced by ALL tenants                             │
│                                                               │
│  🔑 plugin_licenses                                          │
│     ├─ Which tenant can use which plugin                     │
│     ├─ License validation                                    │
│     └─ Expiry dates                                          │
│                                                               │
└──────────────────────────────────────────────────────────────┘
                             │
          ┌──────────────────┼──────────────────┐
          ▼                  ▼                  ▼
   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
   │ TENANT A DB │    │ TENANT B DB │    │ TENANT C DB │
   │  (Isolated) │    │  (Isolated) │    │  (Isolated) │
   ├─────────────┤    ├─────────────┤    ├─────────────┤
   │             │    │             │    │             │
   │ plugins     │    │ plugins     │    │ plugins     │
   │ ├─ Ekomi    │    │ ├─ Gift     │    │ ├─ Ekomi    │
   │ ├─ Gift     │    │ └─ Stripe   │    │ └─ Custom   │
   │ └─ Custom   │    │             │    │             │
   │             │    │             │    │             │
   │ plugin_     │    │ plugin_     │    │ plugin_     │
   │ hooks       │    │ hooks       │    │ hooks       │
   │ events      │    │ events      │    │ events      │
   │ scripts     │    │ scripts     │    │ scripts     │
   │ widgets     │    │ widgets     │    │ widgets     │
   │ data        │    │ data        │    │ data        │
   │             │    │             │    │             │
   │ admin_nav   │    │ admin_nav   │    │ admin_nav   │
   │ _config     │    │ _config     │    │ _config     │
   │ ├─ Custom   │    │ ├─ Reorder  │    │ ├─ Hide     │
   │ └─ Overrides│    │ └─ Rename   │    │ └─ some     │
   │             │    │             │    │             │
   └─────────────┘    └─────────────┘    └─────────────┘
```

### Data Flow Examples

**1. Plugin Installation:**
```
1. Tenant browses marketplace
   → Query: master.plugin_marketplace

2. Tenant clicks "Install Ekomi Plugin"
   → Check: master.plugin_licenses (has license?)
   → Copy: master.plugin_marketplace → tenant.plugins
   → Insert: tenant.plugin_hooks (Ekomi hooks)
   → Insert: tenant.plugin_events (Ekomi events)
   → Insert: tenant.plugin_widgets (Ekomi widgets)
   → Register: master.admin_navigation_registry (if new)
   → Enable: tenant.admin_navigation_config

3. Tenant sees new menu item "Ekomi Reviews" in sidebar
```

**2. Admin Sidebar Loading:**
```
1. User opens admin panel
   → Frontend: GET /api/admin/navigation

2. Backend queries:
   a) tenant.plugins (which plugins installed?)
   b) master.admin_navigation_registry (get core + plugin nav)
   c) tenant.admin_navigation_config (tenant overrides?)

3. Backend merges:
   - Core items (Dashboard, Products, etc)
   - Plugin items (only for installed plugins)
   - Apply tenant customizations (rename, reorder, hide)

4. Return hierarchical tree → Frontend renders sidebar
```

**3. Widget Rendering in Slot Editor:**
```
1. User opens slot editor
   → Frontend: GET /api/plugins/widgets

2. Backend queries:
   a) tenant.plugins (active plugins)
   b) tenant.plugin_widgets (available widgets)

3. Return widget list with:
   - Widget name, icon, category
   - Config schema
   - Preview image

4. Frontend shows widgets in component palette:
   - Built-in components (ProductCard, etc)
   - [Separator] Plugin Widgets
   - Ekomi Reviews Widget
   - Gift Popup Widget

5. User drags widget → Stored in slot config
6. Frontend renders → PluginWidgetRenderer loads component code
```

---

## 💰 PRICING & MONETIZATION ARCHITECTURE

### Pricing Models

```javascript
// src/constants/PluginPricing.js

export const PRICING_MODELS = {
  FREE: 'free',              // No cost
  ONE_TIME: 'one_time',      // Single payment, lifetime access
  SUBSCRIPTION: 'subscription', // Recurring monthly/yearly
  FREEMIUM: 'freemium',      // Free base + paid features
  CUSTOM: 'custom'           // Custom pricing tiers
};

export const LICENSE_TYPES = {
  PER_STORE: 'per_store',    // Each tenant pays separately
  UNLIMITED: 'unlimited',     // One price, unlimited installs
  PER_USER: 'per_user'       // Price based on admin user count
};

export const BILLING_INTERVALS = {
  MONTHLY: 'month',
  YEARLY: 'year'
};

export const SUBSCRIPTION_STATUS = {
  ACTIVE: 'active',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
  PAST_DUE: 'past_due',
  TRIALING: 'trialing'
};

// Revenue share configuration
export const REVENUE_SHARE = {
  CREATOR_PERCENTAGE: 70,    // Creator gets 70%
  PLATFORM_PERCENTAGE: 30    // Platform gets 30%
};
```

### Pricing Configuration UI (PluginBuilder Step)

```jsx
// src/components/admin/plugins/PricingConfigurationStep.jsx
import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectItem } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { DollarSign, TrendingUp, Package, Zap } from 'lucide-react';
import { PRICING_MODELS, LICENSE_TYPES, REVENUE_SHARE } from '@/constants/PluginPricing';

export default function PricingConfigurationStep({ pluginData, onUpdate }) {
  const [pricingModel, setPricingModel] = useState(pluginData.pricingModel || 'free');
  const [pricing, setPricing] = useState({
    basePrice: pluginData.basePrice || 0,
    monthlyPrice: pluginData.monthlyPrice || 0,
    yearlyPrice: pluginData.yearlyPrice || 0,
    currency: pluginData.currency || 'USD',
    licenseType: pluginData.licenseType || 'per_store',
    tiers: pluginData.pricingTiers || [],
    hasTrial: pluginData.hasTrial || false,
    trialDays: pluginData.trialDays || 14
  });

  const handlePricingModelChange = (model) => {
    setPricingModel(model);
    onUpdate({ ...pluginData, pricingModel: model });
  };

  const handlePricingChange = (updates) => {
    const newPricing = { ...pricing, ...updates };
    setPricing(newPricing);
    onUpdate({ ...pluginData, ...newPricing });
  };

  const calculateRevenue = (price) => {
    return (price * REVENUE_SHARE.CREATOR_PERCENTAGE / 100).toFixed(2);
  };

  const calculateYearlyDiscount = () => {
    if (pricing.monthlyPrice && pricing.yearlyPrice) {
      const monthlyTotal = pricing.monthlyPrice * 12;
      const discount = ((monthlyTotal - pricing.yearlyPrice) / monthlyTotal * 100);
      return discount.toFixed(0);
    }
    return 0;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold mb-2">Monetization Settings</h3>
        <p className="text-sm text-muted-foreground">
          Configure how you want to charge for your plugin. You'll receive {REVENUE_SHARE.CREATOR_PERCENTAGE}%
          of all sales after platform fees.
        </p>
      </div>

      {/* Pricing Model Selection */}
      <Card className="p-4">
        <Label className="text-base font-medium mb-3 block">Pricing Model</Label>
        <RadioGroup value={pricingModel} onValueChange={handlePricingModelChange}>
          <div className="space-y-3">
            {/* Free */}
            <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
              <RadioGroupItem value="free" id="free" className="mt-1" />
              <Label htmlFor="free" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2 mb-1">
                  <Package className="w-4 h-4 text-green-600" />
                  <span className="font-medium">Free</span>
                  <Badge variant="secondary" className="text-xs">Most Popular</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  No charge. Great for building reputation, getting feedback, and community contributions.
                </p>
              </Label>
            </div>

            {/* One-Time */}
            <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
              <RadioGroupItem value="one_time" id="one_time" className="mt-1" />
              <Label htmlFor="one_time" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="w-4 h-4 text-blue-600" />
                  <span className="font-medium">One-Time Purchase</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Single payment for lifetime access. Best for feature-complete plugins.
                </p>
              </Label>
            </div>

            {/* Subscription */}
            <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
              <RadioGroupItem value="subscription" id="subscription" className="mt-1" />
              <Label htmlFor="subscription" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-purple-600" />
                  <span className="font-medium">Subscription</span>
                  <Badge variant="outline" className="text-xs">Recurring Revenue</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Monthly or yearly recurring payments. Great for ongoing support and updates.
                </p>
              </Label>
            </div>

            {/* Custom Tiers */}
            <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
              <RadioGroupItem value="custom" id="custom" className="mt-1" />
              <Label htmlFor="custom" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="w-4 h-4 text-orange-600" />
                  <span className="font-medium">Custom Tiers</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Multiple pricing tiers with different feature sets (Starter, Pro, Enterprise).
                </p>
              </Label>
            </div>
          </div>
        </RadioGroup>
      </Card>

      {/* One-Time Pricing Form */}
      {pricingModel === 'one_time' && (
        <Card className="p-4">
          <Label className="text-base font-medium mb-3 block">One-Time Price</Label>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Select
                value={pricing.currency}
                onValueChange={(v) => handlePricingChange({ currency: v })}
              >
                <SelectItem value="USD">USD $</SelectItem>
                <SelectItem value="EUR">EUR €</SelectItem>
                <SelectItem value="GBP">GBP £</SelectItem>
              </Select>
              <Input
                type="number"
                placeholder="49.00"
                value={pricing.basePrice}
                onChange={(e) => handlePricingChange({ basePrice: parseFloat(e.target.value) || 0 })}
                className="flex-1"
              />
            </div>
            {pricing.basePrice > 0 && (
              <Alert className="bg-green-50 border-green-200">
                <DollarSign className="w-4 h-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  You'll receive <span className="font-semibold">${calculateRevenue(pricing.basePrice)}</span> per sale
                  ({REVENUE_SHARE.CREATOR_PERCENTAGE}% of ${pricing.basePrice})
                </AlertDescription>
              </Alert>
            )}
          </div>
        </Card>
      )}

      {/* Subscription Pricing Form */}
      {pricingModel === 'subscription' && (
        <Card className="p-4">
          <Label className="text-base font-medium mb-3 block">Subscription Pricing</Label>
          <div className="space-y-4">
            {/* Monthly Price */}
            <div>
              <Label className="text-sm mb-2 block">Monthly Price</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">$</span>
                <Input
                  type="number"
                  placeholder="9.99"
                  value={pricing.monthlyPrice}
                  onChange={(e) => handlePricingChange({ monthlyPrice: parseFloat(e.target.value) || 0 })}
                />
                <span className="text-sm text-muted-foreground">/month</span>
              </div>
              {pricing.monthlyPrice > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  You earn ${calculateRevenue(pricing.monthlyPrice)}/month per subscriber
                </p>
              )}
            </div>

            {/* Yearly Price */}
            <div>
              <Label className="text-sm mb-2 block">Yearly Price (optional discount)</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">$</span>
                <Input
                  type="number"
                  placeholder="99.00"
                  value={pricing.yearlyPrice}
                  onChange={(e) => handlePricingChange({ yearlyPrice: parseFloat(e.target.value) || 0 })}
                />
                <span className="text-sm text-muted-foreground">/year</span>
              </div>
              {pricing.monthlyPrice && pricing.yearlyPrice && (
                <p className="text-xs text-green-600 mt-1">
                  {calculateYearlyDiscount()}% discount for yearly •
                  You earn ${calculateRevenue(pricing.yearlyPrice)}/year per subscriber
                </p>
              )}
            </div>

            {/* Trial Option */}
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <Label className="text-sm font-medium">Offer Free Trial</Label>
                <p className="text-xs text-muted-foreground">Let users try before they buy</p>
              </div>
              <input
                type="checkbox"
                checked={pricing.hasTrial}
                onChange={(e) => handlePricingChange({ hasTrial: e.target.checked })}
                className="w-4 h-4"
              />
            </div>

            {pricing.hasTrial && (
              <div>
                <Label className="text-sm mb-2 block">Trial Duration (days)</Label>
                <Input
                  type="number"
                  value={pricing.trialDays}
                  onChange={(e) => handlePricingChange({ trialDays: parseInt(e.target.value) || 14 })}
                  min="1"
                  max="90"
                />
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Custom Tiers */}
      {pricingModel === 'custom' && (
        <Card className="p-4">
          <Label className="text-base font-medium mb-3 block">Pricing Tiers</Label>
          <PricingTiersBuilder
            tiers={pricing.tiers}
            onUpdate={(tiers) => handlePricingChange({ tiers })}
          />
        </Card>
      )}

      {/* License Type */}
      {pricingModel !== 'free' && (
        <Card className="p-4">
          <Label className="text-base font-medium mb-3 block">License Type</Label>
          <Select
            value={pricing.licenseType}
            onValueChange={(v) => handlePricingChange({ licenseType: v })}
          >
            <SelectItem value="per_store">
              <div className="py-1">
                <div className="font-medium">Per Store</div>
                <div className="text-xs text-muted-foreground">Each tenant pays separately</div>
              </div>
            </SelectItem>
            <SelectItem value="unlimited">
              <div className="py-1">
                <div className="font-medium">Unlimited</div>
                <div className="text-xs text-muted-foreground">One purchase, install anywhere</div>
              </div>
            </SelectItem>
            <SelectItem value="per_user">
              <div className="py-1">
                <div className="font-medium">Per User</div>
                <div className="text-xs text-muted-foreground">Pricing based on admin user count</div>
              </div>
            </SelectItem>
          </Select>
        </Card>
      )}

      {/* Revenue Share Info */}
      <Alert>
        <DollarSign className="w-4 h-4" />
        <AlertDescription>
          <div className="font-medium mb-1">Revenue Share</div>
          <p className="text-sm">
            Platform takes {REVENUE_SHARE.PLATFORM_PERCENTAGE}% for hosting, payment processing,
            marketplace fees, and customer support. You keep {REVENUE_SHARE.CREATOR_PERCENTAGE}% of all sales.
          </p>
        </AlertDescription>
      </Alert>
    </div>
  );
}

// Pricing Tiers Builder Component
function PricingTiersBuilder({ tiers = [], onUpdate }) {
  const addTier = () => {
    onUpdate([...tiers, {
      id: Date.now().toString(),
      name: '',
      price: 0,
      billingInterval: 'month',
      features: []
    }]);
  };

  const updateTier = (index, updates) => {
    const updated = [...tiers];
    updated[index] = { ...updated[index], ...updates };
    onUpdate(updated);
  };

  const removeTier = (index) => {
    onUpdate(tiers.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      {tiers.map((tier, index) => (
        <div key={tier.id} className="p-3 border rounded-lg space-y-2">
          <div className="flex items-center justify-between">
            <Input
              placeholder="Tier name (e.g., Starter, Pro)"
              value={tier.name}
              onChange={(e) => updateTier(index, { name: e.target.value })}
              className="flex-1 mr-2"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => removeTier(index)}
            >
              Remove
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              placeholder="Price"
              value={tier.price}
              onChange={(e) => updateTier(index, { price: parseFloat(e.target.value) || 0 })}
            />
            <Select
              value={tier.billingInterval}
              onValueChange={(v) => updateTier(index, { billingInterval: v })}
            >
              <SelectItem value="month">Monthly</SelectItem>
              <SelectItem value="year">Yearly</SelectItem>
              <SelectItem value="one_time">One-Time</SelectItem>
            </Select>
          </div>
        </div>
      ))}
      <Button variant="outline" onClick={addTier} className="w-full">
        Add Tier
      </Button>
    </div>
  );
}
```

### Plugin Purchase Service

```javascript
// backend/src/services/PluginPurchaseService.js
import { masterDB, tenantDB } from '../database/connections.js';
import stripeService from './StripeService.js';
import pluginManager from '../core/PluginManager.js';
import { v4 as uuidv4 } from 'uuid';

class PluginPurchaseService {

  /**
   * Purchase a plugin from marketplace
   */
  async purchasePlugin(marketplacePluginId, tenantId, selectedPlan, userId) {
    try {
      // 1. Get plugin details
      const plugin = await this.getMarketplacePlugin(marketplacePluginId);

      // 2. Check if already purchased
      const existingLicense = await this.checkExistingLicense(marketplacePluginId, tenantId);
      if (existingLicense) {
        throw new Error('Plugin already purchased');
      }

      // 3. Calculate pricing
      const pricingDetails = this.calculatePricing(plugin, selectedPlan);

      // 4. Process payment
      let paymentResult;
      if (pricingDetails.amount > 0) {
        if (plugin.pricing_model === 'subscription') {
          paymentResult = await this.createSubscription(plugin, tenantId, pricingDetails, userId);
        } else {
          paymentResult = await this.processOneTimePayment(plugin, tenantId, pricingDetails, userId);
        }
      }

      // 5. Create license
      const license = await this.createLicense(
        marketplacePluginId,
        tenantId,
        plugin,
        pricingDetails,
        paymentResult,
        userId
      );

      // 6. Install plugin to tenant
      await pluginManager.installFromMarketplace(marketplacePluginId, tenantId, userId);

      // 7. Update marketplace metrics
      await this.updateMarketplaceMetrics(marketplacePluginId, pricingDetails.amount);

      // 8. Distribute revenue
      await this.recordRevenue(plugin.author_id, pricingDetails.amount, plugin.revenue_share_percentage);

      return {
        success: true,
        license,
        paymentResult
      };

    } catch (error) {
      console.error('Purchase failed:', error);
      throw error;
    }
  }

  /**
   * Calculate pricing based on selected plan
   */
  calculatePricing(plugin, selectedPlan) {
    let amount = 0;
    let billingInterval = null;

    if (plugin.pricing_model === 'free') {
      return { amount: 0, billingInterval: null, currency: 'USD' };
    }

    if (plugin.pricing_model === 'one_time') {
      amount = plugin.base_price;
    } else if (plugin.pricing_model === 'subscription') {
      if (selectedPlan === 'monthly') {
        amount = plugin.monthly_price;
        billingInterval = 'month';
      } else if (selectedPlan === 'yearly') {
        amount = plugin.yearly_price;
        billingInterval = 'year';
      }
    } else if (plugin.pricing_model === 'custom') {
      const tier = plugin.pricing_tiers.find(t => t.id === selectedPlan);
      if (!tier) throw new Error('Invalid pricing tier');
      amount = tier.price;
      billingInterval = tier.billingInterval === 'one_time' ? null : tier.billingInterval;
    }

    return {
      amount,
      billingInterval,
      currency: plugin.currency || 'USD'
    };
  }

  /**
   * Process one-time payment via Stripe
   */
  async processOneTimePayment(plugin, tenantId, pricingDetails, userId) {
    const paymentIntent = await stripeService.createPaymentIntent({
      amount: Math.round(pricingDetails.amount * 100), // Convert to cents
      currency: pricingDetails.currency.toLowerCase(),
      metadata: {
        type: 'plugin_purchase',
        pluginId: plugin.id,
        pluginName: plugin.name,
        tenantId,
        userId,
        creatorId: plugin.author_id,
        revenueShare: plugin.revenue_share_percentage
      }
    });

    return {
      paymentIntentId: paymentIntent.id,
      type: 'one_time'
    };
  }

  /**
   * Create subscription via Stripe
   */
  async createSubscription(plugin, tenantId, pricingDetails, userId) {
    // Create or get Stripe customer
    const customer = await stripeService.getOrCreateCustomer(tenantId, userId);

    // Create subscription
    const subscription = await stripeService.createSubscription({
      customerId: customer.id,
      priceAmount: Math.round(pricingDetails.amount * 100),
      currency: pricingDetails.currency.toLowerCase(),
      interval: pricingDetails.billingInterval,
      metadata: {
        type: 'plugin_subscription',
        pluginId: plugin.id,
        pluginName: plugin.name,
        tenantId,
        userId,
        creatorId: plugin.author_id,
        revenueShare: plugin.revenue_share_percentage
      }
    });

    return {
      subscriptionId: subscription.id,
      customerId: customer.id,
      type: 'subscription',
      nextBillingDate: new Date(subscription.current_period_end * 1000)
    };
  }

  /**
   * Create license record
   */
  async createLicense(marketplacePluginId, tenantId, plugin, pricingDetails, paymentResult, userId) {
    const licenseKey = this.generateLicenseKey();

    const license = await masterDB.query(`
      INSERT INTO plugin_licenses (
        id,
        plugin_id,
        tenant_id,
        license_key,
        license_type,
        pricing_model,
        amount_paid,
        currency,
        billing_interval,
        subscription_status,
        subscription_id,
        stripe_customer_id,
        stripe_payment_intent_id,
        next_billing_date,
        is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, true)
      RETURNING *
    `, [
      uuidv4(),
      marketplacePluginId,
      tenantId,
      licenseKey,
      plugin.license_type,
      plugin.pricing_model,
      pricingDetails.amount,
      pricingDetails.currency,
      pricingDetails.billingInterval,
      paymentResult?.type === 'subscription' ? 'active' : null,
      paymentResult?.subscriptionId || null,
      paymentResult?.customerId || null,
      paymentResult?.paymentIntentId || null,
      paymentResult?.nextBillingDate || null
    ]);

    return license.rows[0];
  }

  /**
   * Record revenue distribution
   */
  async recordRevenue(creatorId, amount, revenueSharePercentage) {
    const creatorAmount = (amount * revenueSharePercentage / 100).toFixed(2);
    const platformAmount = (amount * (100 - revenueSharePercentage) / 100).toFixed(2);

    // TODO: Record in revenue tracking table
    // This would integrate with accounting/payout systems

    console.log(`Revenue: Creator ${creatorId} gets $${creatorAmount}, Platform gets $${platformAmount}`);
  }

  /**
   * Update marketplace metrics
   */
  async updateMarketplaceMetrics(pluginId, revenue) {
    await masterDB.query(`
      UPDATE plugin_marketplace
      SET
        active_installations = active_installations + 1,
        total_revenue = total_revenue + $1,
        updated_at = NOW()
      WHERE id = $2
    `, [revenue, pluginId]);
  }

  /**
   * Generate unique license key
   */
  generateLicenseKey() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const segments = 4;
    const segmentLength = 4;

    let key = '';
    for (let i = 0; i < segments; i++) {
      for (let j = 0; j < segmentLength; j++) {
        key += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      if (i < segments - 1) key += '-';
    }

    return key; // Format: XXXX-XXXX-XXXX-XXXX
  }

  /**
   * Get marketplace plugin
   */
  async getMarketplacePlugin(pluginId) {
    const result = await masterDB.query(`
      SELECT * FROM plugin_marketplace WHERE id = $1 AND status = 'approved'
    `, [pluginId]);

    if (!result.rows[0]) {
      throw new Error('Plugin not found in marketplace');
    }

    return result.rows[0];
  }

  /**
   * Check existing license
   */
  async checkExistingLicense(pluginId, tenantId) {
    const result = await masterDB.query(`
      SELECT * FROM plugin_licenses
      WHERE plugin_id = $1 AND tenant_id = $2 AND is_active = true
    `, [pluginId, tenantId]);

    return result.rows[0] || null;
  }
}

export default new PluginPurchaseService();
```

---

## 🛠️ BACKEND CORE SYSTEMS

### 1. AdminNavigationService.js

```javascript
// backend/src/services/AdminNavigationService.js
import { masterDB, tenantDB } from '../database/connections.js';

class AdminNavigationService {

  /**
   * Get complete navigation for a tenant
   * Merges: Master registry + Tenant config + Installed plugins
   */
  async getNavigationForTenant(tenantId) {
    try {
      // 1. Get tenant's installed & active plugins
      const installedPlugins = await tenantDB(tenantId).query(`
        SELECT marketplace_plugin_id
        FROM plugins
        WHERE status = 'active' AND marketplace_plugin_id IS NOT NULL
      `);

      const pluginIds = installedPlugins.rows.map(p => p.marketplace_plugin_id);

      // 2. Get navigation items from master registry
      // Include: Core items + items from tenant's installed plugins
      const navQuery = pluginIds.length > 0
        ? `SELECT * FROM admin_navigation_registry
           WHERE (is_core = true OR plugin_id = ANY($1))
             AND is_visible = true
           ORDER BY order_position ASC`
        : `SELECT * FROM admin_navigation_registry
           WHERE is_core = true AND is_visible = true
           ORDER BY order_position ASC`;

      const navItems = await masterDB.query(
        navQuery,
        pluginIds.length > 0 ? [pluginIds] : []
      );

      // 3. Get tenant's customizations
      const tenantConfig = await tenantDB(tenantId).query(`
        SELECT * FROM admin_navigation_config
      `);

      // 4. Merge and apply customizations
      const merged = this.mergeNavigation(
        navItems.rows,
        tenantConfig.rows
      );

      // 5. Build hierarchical tree
      const tree = this.buildNavigationTree(merged);

      return tree;

    } catch (error) {
      console.error('Failed to load navigation:', error);
      throw error;
    }
  }

  /**
   * Apply tenant customizations to navigation items
   */
  mergeNavigation(masterItems, tenantConfig) {
    const configMap = new Map(
      tenantConfig.map(c => [c.nav_item_key, c])
    );

    return masterItems.map(item => {
      const config = configMap.get(item.key);

      if (!config) {
        // No customization - use master item as-is
        return item;
      }

      // Apply tenant overrides
      return {
        ...item,
        label: config.custom_label || item.label,
        order: config.custom_order ?? item.order_position,
        icon: config.custom_icon || item.icon,
        parentKey: config.parent_key || item.parent_key,
        isEnabled: config.is_enabled ?? true,
        badge: config.badge_text ? {
          text: config.badge_text,
          color: config.badge_color
        } : null
      };
    }).filter(item => item.isEnabled !== false);
  }

  /**
   * Build hierarchical navigation tree
   */
  buildNavigationTree(items) {
    const tree = [];
    const itemMap = new Map();

    // First pass: Create map of all items with empty children
    items.forEach(item => {
      itemMap.set(item.key, {
        ...item,
        children: []
      });
    });

    // Second pass: Build hierarchy
    items.forEach(item => {
      const node = itemMap.get(item.key);

      if (item.parentKey && itemMap.has(item.parentKey)) {
        // Add as child to parent
        itemMap.get(item.parentKey).children.push(node);
      } else {
        // Add as root item
        tree.push(node);
      }
    });

    // Sort children by order
    tree.forEach(item => this.sortChildren(item));

    return tree;
  }

  /**
   * Recursively sort children by order
   */
  sortChildren(item) {
    if (item.children && item.children.length > 0) {
      item.children.sort((a, b) => (a.order || 0) - (b.order || 0));
      item.children.forEach(child => this.sortChildren(child));
    }
  }

  /**
   * Register plugin navigation items in master DB
   * Called during plugin installation
   */
  async registerPluginNavigation(pluginId, navItems) {
    for (const item of navItems) {
      await masterDB.query(`
        INSERT INTO admin_navigation_registry
        (key, label, icon, route, parent_key, order_position, is_core, plugin_id, category)
        VALUES ($1, $2, $3, $4, $5, $6, false, $7, $8)
        ON CONFLICT (key) DO UPDATE SET
          label = EXCLUDED.label,
          icon = EXCLUDED.icon,
          route = EXCLUDED.route,
          updated_at = NOW()
      `, [
        item.key,
        item.label,
        item.icon,
        item.route,
        item.parentKey || null,
        item.order || 100,
        pluginId,
        item.category || 'plugins'
      ]);
    }
  }

  /**
   * Enable plugin navigation for tenant
   * Called during plugin installation
   */
  async enablePluginNavigationForTenant(tenantId, navKeys) {
    for (const key of navKeys) {
      await tenantDB(tenantId).query(`
        INSERT INTO admin_navigation_config (nav_item_key, is_enabled)
        VALUES ($1, true)
        ON CONFLICT (nav_item_key) DO NOTHING
      `, [key]);
    }
  }

  /**
   * Seed core navigation items
   * Run once to populate master DB
   */
  async seedCoreNavigation() {
    const coreItems = [
      { key: 'dashboard', label: 'Dashboard', icon: 'home', route: '/admin', order: 1, category: 'main' },
      { key: 'products', label: 'Products', icon: 'package', route: '/admin/products', order: 2, category: 'main' },
      { key: 'orders', label: 'Orders', icon: 'shopping-cart', route: '/admin/orders', order: 3, category: 'main' },
      { key: 'customers', label: 'Customers', icon: 'users', route: '/admin/customers', order: 4, category: 'main' },
      { key: 'analytics', label: 'Analytics', icon: 'bar-chart', route: '/admin/analytics', order: 5, category: 'main' },
      { key: 'plugins', label: 'Plugins', icon: 'puzzle', route: '/admin/plugins', order: 10, category: 'tools' },
      { key: 'settings', label: 'Settings', icon: 'settings', route: '/admin/settings', order: 99, category: 'settings' }
    ];

    for (const item of coreItems) {
      await masterDB.query(`
        INSERT INTO admin_navigation_registry
        (key, label, icon, route, order_position, is_core, category)
        VALUES ($1, $2, $3, $4, $5, true, $6)
        ON CONFLICT (key) DO NOTHING
      `, [item.key, item.label, item.icon, item.route, item.order, item.category]);
    }

    console.log('✅ Core navigation seeded');
  }
}

export default new AdminNavigationService();
```

### 2. PluginManager.js (Extends ExtensionSystem)

```javascript
// backend/src/core/PluginManager.js
import { ExtensionSystem } from './ExtensionSystem.js';
import hookSystem from './HookSystem.js';
import eventSystem from './EventSystem.js';
import versionSystem from './VersionSystem.js';
import AdminNavigationService from '../services/AdminNavigationService.js';
import WidgetRegistry from './WidgetRegistry.js';
import { masterDB, tenantDB } from '../database/connections.js';

class PluginManager extends ExtensionSystem {

  /**
   * Create a new plugin from structure
   */
  async createPlugin(pluginData, tenantId, userId) {
    try {
      // Validate structure
      this.validatePluginStructure(pluginData);

      // Compile plugin code
      const compiled = await this.compilePlugin(pluginData);

      // Store in tenant DB
      const plugin = await tenantDB(tenantId).query(`
        INSERT INTO plugins
        (name, slug, version, manifest, config_data, installed_by)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [
        compiled.name,
        compiled.slug,
        compiled.version,
        compiled.manifest,
        compiled.config || {},
        userId
      ]);

      // Install hooks
      await this.installHooks(plugin.rows[0].id, compiled.hooks, tenantId);

      // Install events
      await this.installEvents(plugin.rows[0].id, compiled.events, tenantId);

      // Install widgets
      await this.installWidgets(plugin.rows[0].id, compiled.widgets, tenantId);

      // Install scripts
      await this.installScripts(plugin.rows[0].id, compiled.scripts, tenantId);

      return plugin.rows[0];

    } catch (error) {
      console.error('Failed to create plugin:', error);
      throw error;
    }
  }

  /**
   * Publish plugin to marketplace
   */
  async publishToMarketplace(pluginId, tenantId, publishData) {
    try {
      // Get plugin from tenant DB
      const plugin = await tenantDB(tenantId).query(`
        SELECT * FROM plugins WHERE id = $1
      `, [pluginId]);

      if (!plugin.rows[0]) {
        throw new Error('Plugin not found');
      }

      // Create release with VersionSystem
      const release = await versionSystem.createRelease({
        name: plugin.rows[0].name,
        version: plugin.rows[0].version,
        description: publishData.description,
        changes: [], // TODO: Track changes
        storeId: tenantId,
        createdBy: publishData.userId,
        type: 'minor'
      });

      // Publish release
      await versionSystem.publishRelease(release.id);

      // Insert into marketplace
      const marketplacePlugin = await masterDB.query(`
        INSERT INTO plugin_marketplace
        (name, slug, version, description, author_id, category, price, license_type, source_code_template, manifest)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `, [
        plugin.rows[0].name,
        plugin.rows[0].slug,
        plugin.rows[0].version,
        publishData.description,
        publishData.userId,
        publishData.category,
        publishData.price || 0,
        publishData.licenseType || 'free',
        plugin.rows[0].manifest, // Full source code
        plugin.rows[0].manifest
      ]);

      // Register navigation if plugin has navigation items
      if (plugin.rows[0].manifest.navigation) {
        await AdminNavigationService.registerPluginNavigation(
          marketplacePlugin.rows[0].id,
          plugin.rows[0].manifest.navigation
        );
      }

      return marketplacePlugin.rows[0];

    } catch (error) {
      console.error('Failed to publish plugin:', error);
      throw error;
    }
  }

  /**
   * Install plugin from marketplace to tenant
   */
  async installFromMarketplace(marketplacePluginId, tenantId, userId) {
    try {
      // Get plugin from marketplace
      const plugin = await masterDB.query(`
        SELECT * FROM plugin_marketplace WHERE id = $1
      `, [marketplacePluginId]);

      if (!plugin.rows[0]) {
        throw new Error('Plugin not found in marketplace');
      }

      // Check license
      if (plugin.rows[0].price > 0) {
        const license = await masterDB.query(`
          SELECT * FROM plugin_licenses
          WHERE plugin_id = $1 AND tenant_id = $2 AND is_active = true
        `, [marketplacePluginId, tenantId]);

        if (!license.rows[0]) {
          throw new Error('No valid license found. Please purchase the plugin first.');
        }
      }

      // Install to tenant DB
      const installed = await tenantDB(tenantId).query(`
        INSERT INTO plugins
        (name, slug, version, marketplace_plugin_id, manifest, installed_by)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [
        plugin.rows[0].name,
        plugin.rows[0].slug,
        plugin.rows[0].version,
        marketplacePluginId,
        plugin.rows[0].manifest,
        userId
      ]);

      const installedPlugin = installed.rows[0];
      const manifest = plugin.rows[0].manifest;

      // Install hooks
      if (manifest.hooks) {
        await this.installHooks(installedPlugin.id, manifest.hooks, tenantId);
      }

      // Install events
      if (manifest.events) {
        await this.installEvents(installedPlugin.id, manifest.events, tenantId);
      }

      // Install widgets
      if (manifest.widgets) {
        await this.installWidgets(installedPlugin.id, manifest.widgets, tenantId);

        // Register widgets with WidgetRegistry
        for (const widget of manifest.widgets) {
          WidgetRegistry.registerWidget(installedPlugin.id, widget);
        }
      }

      // Install scripts
      if (manifest.scripts) {
        await this.installScripts(installedPlugin.id, manifest.scripts, tenantId);
      }

      // Enable navigation for tenant
      if (manifest.navigation) {
        const navKeys = manifest.navigation.map(n => n.key);
        await AdminNavigationService.enablePluginNavigationForTenant(tenantId, navKeys);
      }

      // Load plugin into runtime
      await this.loadPluginIntoRuntime(installedPlugin, manifest, tenantId);

      // Emit event
      eventSystem.emit('plugin.installed', {
        pluginId: installedPlugin.id,
        tenantId,
        userId
      });

      return installedPlugin;

    } catch (error) {
      console.error('Failed to install plugin:', error);
      throw error;
    }
  }

  /**
   * Load plugin into runtime (register hooks, events)
   */
  async loadPluginIntoRuntime(plugin, manifest, tenantId) {
    // Register hooks with HookSystem
    if (manifest.hooks) {
      for (const hook of manifest.hooks) {
        const handler = this.compileHandlerCode(hook.code, tenantId);
        hookSystem.register(hook.name, handler, hook.priority || 10);
      }
    }

    // Register events with EventSystem
    if (manifest.events) {
      for (const event of manifest.events) {
        const listener = this.compileHandlerCode(event.code, tenantId);
        eventSystem.on(event.name, listener, event.priority || 10);
      }
    }
  }

  /**
   * Compile handler code into executable function
   * SECURITY: Execute in sandboxed environment
   */
  compileHandlerCode(code, tenantId) {
    // TODO: Implement proper sandboxing (VM2, isolated-vm, etc.)
    // For now, use Function constructor with limited scope
    try {
      return new Function('data', 'context', `
        'use strict';
        ${code}
      `);
    } catch (error) {
      console.error('Failed to compile handler code:', error);
      throw new Error('Invalid plugin code');
    }
  }

  /**
   * Validate plugin structure
   */
  validatePluginStructure(pluginData) {
    if (!pluginData.name) throw new Error('Plugin name is required');
    if (!pluginData.version) throw new Error('Plugin version is required');
    if (!pluginData.manifest) throw new Error('Plugin manifest is required');

    // Validate manifest structure
    const manifest = pluginData.manifest;

    if (manifest.hooks) {
      if (!Array.isArray(manifest.hooks)) {
        throw new Error('Manifest.hooks must be an array');
      }
      manifest.hooks.forEach((hook, i) => {
        if (!hook.name) throw new Error(`Hook ${i}: name is required`);
        if (!hook.code) throw new Error(`Hook ${i}: code is required`);
      });
    }

    if (manifest.events) {
      if (!Array.isArray(manifest.events)) {
        throw new Error('Manifest.events must be an array');
      }
      manifest.events.forEach((event, i) => {
        if (!event.name) throw new Error(`Event ${i}: name is required`);
        if (!event.code) throw new Error(`Event ${i}: code is required`);
      });
    }

    return true;
  }

  /**
   * Compile plugin - prepare for storage
   */
  async compilePlugin(pluginData) {
    return {
      name: pluginData.name,
      slug: pluginData.slug || pluginData.name.toLowerCase().replace(/\s+/g, '-'),
      version: pluginData.version,
      manifest: pluginData.manifest,
      config: pluginData.config || {},
      hooks: pluginData.manifest.hooks || [],
      events: pluginData.manifest.events || [],
      widgets: pluginData.manifest.widgets || [],
      scripts: pluginData.manifest.scripts || []
    };
  }

  // Helper methods for installing components

  async installHooks(pluginId, hooks, tenantId) {
    for (const hook of hooks) {
      await tenantDB(tenantId).query(`
        INSERT INTO plugin_hooks
        (plugin_id, hook_name, hook_type, handler_code, priority, description)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        pluginId,
        hook.name,
        hook.type || 'filter',
        hook.code,
        hook.priority || 10,
        hook.description || ''
      ]);
    }
  }

  async installEvents(pluginId, events, tenantId) {
    for (const event of events) {
      await tenantDB(tenantId).query(`
        INSERT INTO plugin_events
        (plugin_id, event_name, event_location, handler_code, priority, is_async, description)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        pluginId,
        event.name,
        event.location || '',
        event.code,
        event.priority || 10,
        event.async || false,
        event.description || ''
      ]);
    }
  }

  async installWidgets(pluginId, widgets, tenantId) {
    for (const widget of widgets) {
      await tenantDB(tenantId).query(`
        INSERT INTO plugin_widgets
        (plugin_id, widget_name, display_name, component_code, config_schema, default_config, icon, category, description)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        pluginId,
        widget.name,
        widget.displayName || widget.name,
        widget.code,
        widget.configSchema || {},
        widget.defaultConfig || {},
        widget.icon || 'box',
        widget.category || 'General',
        widget.description || ''
      ]);
    }
  }

  async installScripts(pluginId, scripts, tenantId) {
    for (const script of scripts) {
      await tenantDB(tenantId).query(`
        INSERT INTO plugin_scripts
        (plugin_id, script_name, script_type, script_code, load_location, load_order, dependencies)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        pluginId,
        script.name,
        script.type || 'frontend',
        script.code,
        script.loadLocation || 'body-end',
        script.order || 100,
        script.dependencies || []
      ]);
    }
  }
}

export default new PluginManager();
```

### 3. PluginExecutor.js

```javascript
// backend/src/core/PluginExecutor.js
import hookSystem from './HookSystem.js';
import eventSystem from './EventSystem.js';
import { tenantDB } from '../database/connections.js';

class PluginExecutor {

  /**
   * Execute a hook - delegates to HookSystem
   */
  executeHook(hookName, data, context = {}) {
    return hookSystem.apply(hookName, data, context);
  }

  /**
   * Execute async hook
   */
  async executeHookAsync(hookName, data, context = {}) {
    return hookSystem.applyAsync(hookName, data, context);
  }

  /**
   * Execute action hook (no return value)
   */
  doHook(hookName, ...args) {
    return hookSystem.do(hookName, ...args);
  }

  /**
   * Execute async action hook
   */
  async doHookAsync(hookName, ...args) {
    return hookSystem.doAsync(hookName, ...args);
  }

  /**
   * Dispatch event - delegates to EventSystem
   */
  dispatchEvent(eventName, payload) {
    return eventSystem.emit(eventName, payload);
  }

  /**
   * Dispatch async event
   */
  async dispatchEventAsync(eventName, payload) {
    return eventSystem.emitAsync(eventName, payload);
  }

  /**
   * Load widget component code for rendering
   */
  async loadWidget(widgetId, tenantId) {
    try {
      const widget = await tenantDB(tenantId).query(`
        SELECT * FROM plugin_widgets WHERE id = $1 AND is_active = true
      `, [widgetId]);

      if (!widget.rows[0]) {
        throw new Error('Widget not found');
      }

      // Return compiled component
      return {
        id: widget.rows[0].id,
        name: widget.rows[0].widget_name,
        displayName: widget.rows[0].display_name,
        componentCode: widget.rows[0].component_code,
        configSchema: widget.rows[0].config_schema,
        defaultConfig: widget.rows[0].default_config
      };

    } catch (error) {
      console.error('Failed to load widget:', error);
      throw error;
    }
  }

  /**
   * Get all available widgets for slot editor
   */
  async getAvailableWidgets(tenantId) {
    try {
      const widgets = await tenantDB(tenantId).query(`
        SELECT w.*, p.name as plugin_name
        FROM plugin_widgets w
        JOIN plugins p ON w.plugin_id = p.id
        WHERE w.is_active = true AND p.status = 'active'
        ORDER BY w.category, w.display_name
      `);

      return widgets.rows.map(w => ({
        id: w.id,
        name: w.widget_name,
        displayName: w.display_name,
        icon: w.icon,
        category: w.category,
        description: w.description,
        pluginName: w.plugin_name,
        configSchema: w.config_schema,
        previewImage: w.preview_image_url
      }));

    } catch (error) {
      console.error('Failed to get widgets:', error);
      throw error;
    }
  }
}

export default new PluginExecutor();
```

### 4. WidgetRegistry.js

```javascript
// backend/src/core/WidgetRegistry.js

class WidgetRegistry {
  constructor() {
    this.widgets = new Map();
  }

  /**
   * Register a widget for runtime use
   */
  registerWidget(pluginId, widgetDefinition) {
    const widgetId = `${pluginId}:${widgetDefinition.name}`;

    this.widgets.set(widgetId, {
      id: widgetId,
      pluginId,
      name: widgetDefinition.name,
      displayName: widgetDefinition.displayName,
      componentCode: widgetDefinition.code,
      configSchema: widgetDefinition.configSchema,
      defaultConfig: widgetDefinition.defaultConfig,
      icon: widgetDefinition.icon,
      category: widgetDefinition.category
    });

    console.log(`✅ Widget registered: ${widgetId}`);
  }

  /**
   * Get widget by ID
   */
  getWidget(widgetId) {
    return this.widgets.get(widgetId);
  }

  /**
   * Get all registered widgets
   */
  getAllWidgets() {
    return Array.from(this.widgets.values());
  }

  /**
   * Get widgets by plugin
   */
  getWidgetsByPlugin(pluginId) {
    return Array.from(this.widgets.values())
      .filter(w => w.pluginId === pluginId);
  }

  /**
   * Unregister plugin widgets
   */
  unregisterPluginWidgets(pluginId) {
    const toRemove = [];

    for (const [widgetId, widget] of this.widgets) {
      if (widget.pluginId === pluginId) {
        toRemove.push(widgetId);
      }
    }

    toRemove.forEach(id => this.widgets.delete(id));

    console.log(`🗑️ Unregistered ${toRemove.length} widgets from plugin ${pluginId}`);
  }
}

export default new WidgetRegistry();
```

### 5. AIPluginGenerator.js

```javascript
// backend/src/services/AIPluginGenerator.js

class AIPluginGenerator {

  /**
   * Analyze user prompt and extract requirements
   */
  async analyzePrompt(prompt) {
    // TODO: Use AI to analyze prompt
    // For now, simple keyword matching

    const requirements = {
      type: 'unknown',
      hooks: [],
      events: [],
      widgets: [],
      navigation: [],
      database: []
    };

    // Detect type
    if (prompt.includes('popup') || prompt.includes('modal')) {
      requirements.type = 'popup';
      requirements.widgets.push('Modal Widget');
    }

    if (prompt.includes('review') || prompt.includes('rating')) {
      requirements.type = 'reviews';
      requirements.widgets.push('Reviews Widget');
    }

    // Detect hooks
    if (prompt.includes('cart') || prompt.includes('add to cart')) {
      requirements.hooks.push('cart.add_item');
    }

    if (prompt.includes('product')) {
      requirements.hooks.push('product.view');
      requirements.events.push('product.loaded');
    }

    // Detect navigation needs
    if (prompt.includes('admin') || prompt.includes('settings')) {
      requirements.navigation.push({
        label: 'Plugin Settings',
        route: '/admin/plugin-settings'
      });
    }

    return requirements;
  }

  /**
   * Design plugin architecture based on requirements
   */
  async designArchitecture(requirements) {
    const architecture = {
      name: requirements.name || 'Untitled Plugin',
      version: '1.0.0',
      hooks: [],
      events: [],
      widgets: [],
      scripts: [],
      navigation: []
    };

    // Add hooks
    requirements.hooks.forEach(hookName => {
      architecture.hooks.push({
        name: hookName,
        type: 'filter',
        code: this.generateHookTemplate(hookName),
        priority: 10
      });
    });

    // Add events
    requirements.events.forEach(eventName => {
      architecture.events.push({
        name: eventName,
        code: this.generateEventTemplate(eventName),
        priority: 10
      });
    });

    // Add widgets
    requirements.widgets.forEach(widgetType => {
      architecture.widgets.push({
        name: widgetType.replace(/\s+/g, ''),
        displayName: widgetType,
        code: this.generateWidgetTemplate(widgetType),
        configSchema: {},
        icon: 'box'
      });
    });

    // Add navigation
    architecture.navigation = requirements.navigation;

    return architecture;
  }

  /**
   * Generate complete plugin code
   */
  async generateCode(architecture) {
    return {
      name: architecture.name,
      version: architecture.version,
      manifest: {
        hooks: architecture.hooks,
        events: architecture.events,
        widgets: architecture.widgets,
        scripts: architecture.scripts,
        navigation: architecture.navigation
      }
    };
  }

  // Template generators

  generateHookTemplate(hookName) {
    return `
// Hook: ${hookName}
function ${hookName.replace(/\./g, '_')}Handler(data, context) {
  // Your code here
  console.log('Hook executed:', '${hookName}', data);

  // Transform and return data
  return data;
}
    `.trim();
  }

  generateEventTemplate(eventName) {
    return `
// Event: ${eventName}
function ${eventName.replace(/\./g, '_')}Listener(payload) {
  // Your code here
  console.log('Event received:', '${eventName}', payload);

  // Perform actions
}
    `.trim();
  }

  generateWidgetTemplate(widgetType) {
    return `
import React from 'react';

export default function ${widgetType.replace(/\s+/g, '')}({ config }) {
  return (
    <div className="plugin-widget">
      <h3>${widgetType}</h3>
      <p>Configure your widget here</p>
    </div>
  );
}
    `.trim();
  }
}

export default new AIPluginGenerator();
```

---

## 🎨 FRONTEND IMPLEMENTATION

### 1. AdminSidebar.jsx (Dynamic Navigation)

```jsx
// src/components/admin/AdminSidebar.jsx
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import apiClient from '@/api/client';
import * as Icons from 'lucide-react';

export default function AdminSidebar() {
  const [navigation, setNavigation] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const location = useLocation();

  useEffect(() => {
    loadNavigation();
  }, []);

  const loadNavigation = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/admin/navigation');

      if (response.success) {
        setNavigation(response.navigation);
      } else {
        throw new Error(response.error || 'Failed to load navigation');
      }
    } catch (err) {
      console.error('Failed to load navigation:', err);
      setError(err.message);

      // Fallback to minimal navigation
      setNavigation([
        { key: 'dashboard', label: 'Dashboard', icon: 'Home', route: '/admin', children: [] },
        { key: 'products', label: 'Products', icon: 'Package', route: '/admin/products', children: [] }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const getIcon = (iconName) => {
    const Icon = Icons[iconName] || Icons.Box;
    return <Icon className="w-5 h-5" />;
  };

  const renderNavItem = (item, depth = 0) => {
    const isActive = location.pathname === item.route ||
                    location.pathname.startsWith(item.route + '/');
    const hasChildren = item.children && item.children.length > 0;

    return (
      <div key={item.key} className="nav-item-wrapper">
        <Link
          to={item.route}
          className={`
            flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors
            ${isActive
              ? 'bg-primary text-primary-foreground font-medium'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }
            ${depth > 0 ? `ml-${depth * 4} text-sm` : ''}
          `}
        >
          {getIcon(item.icon)}
          <span className="flex-1">{item.label}</span>
          {item.badge && (
            <Badge
              variant="secondary"
              className="ml-auto"
              style={item.badge.color ? { backgroundColor: item.badge.color } : {}}
            >
              {item.badge.text}
            </Badge>
          )}
        </Link>

        {hasChildren && (
          <div className="mt-1 space-y-1">
            {item.children.map(child => renderNavItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <aside className="w-64 h-screen bg-background border-r p-4">
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-10 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </aside>
    );
  }

  if (error) {
    return (
      <aside className="w-64 h-screen bg-background border-r p-4">
        <div className="text-sm text-destructive p-4 bg-destructive/10 rounded-lg">
          Failed to load navigation. Using fallback.
        </div>
        <nav className="mt-4 space-y-2">
          {navigation.map(item => renderNavItem(item))}
        </nav>
      </aside>
    );
  }

  return (
    <aside className="w-64 h-screen bg-background border-r flex flex-col">
      {/* Logo/Header */}
      <div className="p-4 border-b">
        <h2 className="text-xl font-bold">Admin Panel</h2>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 overflow-y-auto space-y-2">
        {navigation.map(item => renderNavItem(item))}
      </nav>
    </aside>
  );
}
```

### 2. PluginCodeEditorWrapper.jsx

```jsx
// src/components/admin/plugins/PluginCodeEditorWrapper.jsx
import { useState, useEffect } from 'react';
import FileTreeNavigator from '@/components/editor/ai-context/FileTreeNavigator';
import CodeEditor from '@/components/editor/ai-context/CodeEditor';
import DainoStoreAIStudio from '@/components/admin/DainoStoreAIStudio';
import DiffPreviewSystem from '@/components/editor/ai-context/DiffPreviewSystem';
import FileTabs from './FileTabs';

export default function PluginCodeEditorWrapper({ plugin, onSave }) {
  const [openFiles, setOpenFiles] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [fileContents, setFileContents] = useState(new Map());

  useEffect(() => {
    // Initialize with manifest.json
    if (plugin && openFiles.length === 0) {
      const manifestFile = {
        name: 'manifest.json',
        path: 'manifest.json',
        language: 'json',
        content: JSON.stringify(plugin.manifest, null, 2)
      };
      setOpenFiles([manifestFile]);
      setActiveFile(manifestFile);
    }
  }, [plugin]);

  const adaptPluginFilesForTree = () => {
    if (!plugin) return null;

    const tree = {
      name: plugin.name,
      type: 'folder',
      children: []
    };

    // Hooks folder
    if (plugin.manifest?.hooks?.length > 0) {
      tree.children.push({
        name: 'hooks',
        type: 'folder',
        path: 'hooks',
        children: plugin.manifest.hooks.map((hook, i) => ({
          name: `${hook.name}.js`,
          type: 'file',
          path: `hooks/${hook.name}.js`,
          content: hook.code,
          metadata: hook
        }))
      });
    }

    // Events folder
    if (plugin.manifest?.events?.length > 0) {
      tree.children.push({
        name: 'events',
        type: 'folder',
        path: 'events',
        children: plugin.manifest.events.map((event, i) => ({
          name: `${event.name}.js`,
          type: 'file',
          path: `events/${event.name}.js`,
          content: event.code,
          metadata: event
        }))
      });
    }

    // Widgets folder
    if (plugin.manifest?.widgets?.length > 0) {
      tree.children.push({
        name: 'widgets',
        type: 'folder',
        path: 'widgets',
        children: plugin.manifest.widgets.map((widget, i) => ({
          name: `${widget.name}.jsx`,
          type: 'file',
          path: `widgets/${widget.name}.jsx`,
          content: widget.code,
          metadata: widget
        }))
      });
    }

    // Scripts folder
    if (plugin.manifest?.scripts?.length > 0) {
      tree.children.push({
        name: 'scripts',
        type: 'folder',
        path: 'scripts',
        children: plugin.manifest.scripts.map((script, i) => ({
          name: script.name,
          type: 'file',
          path: `scripts/${script.name}`,
          content: script.code,
          metadata: script
        }))
      });
    }

    // Admin folder
    if (plugin.manifest?.navigation?.length > 0) {
      tree.children.push({
        name: 'admin',
        type: 'folder',
        path: 'admin',
        children: [
          {
            name: 'navigation.json',
            type: 'file',
            path: 'admin/navigation.json',
            content: JSON.stringify(plugin.manifest.navigation, null, 2)
          }
        ]
      });
    }

    // Manifest
    tree.children.push({
      name: 'manifest.json',
      type: 'file',
      path: 'manifest.json',
      content: JSON.stringify(plugin.manifest, null, 2)
    });

    return tree;
  };

  const handleFileSelect = (file) => {
    if (file.type !== 'file') return;

    // Check if already open
    const existing = openFiles.find(f => f.path === file.path);
    if (existing) {
      setActiveFile(existing);
      return;
    }

    // Open new file
    const newFile = {
      name: file.name,
      path: file.path,
      language: file.name.endsWith('.json') ? 'json' :
                file.name.endsWith('.jsx') ? 'javascript' : 'javascript',
      content: file.content || '',
      original: file.content || '',
      metadata: file.metadata
    };

    setOpenFiles(prev => [...prev, newFile]);
    setActiveFile(newFile);
  };

  const handleCodeChange = (newCode) => {
    if (!activeFile) return;

    setActiveFile(prev => ({ ...prev, content: newCode }));
    setOpenFiles(prev => prev.map(f =>
      f.path === activeFile.path ? { ...f, content: newCode } : f
    ));
  };

  const handleTabClose = (file) => {
    setOpenFiles(prev => prev.filter(f => f.path !== file.path));

    if (activeFile?.path === file.path) {
      const remaining = openFiles.filter(f => f.path !== file.path);
      setActiveFile(remaining[remaining.length - 1] || null);
    }
  };

  const handleSave = () => {
    // Collect all changes
    const updatedPlugin = { ...plugin };

    openFiles.forEach(file => {
      if (file.path.startsWith('hooks/')) {
        const hookName = file.path.replace('hooks/', '').replace('.js', '');
        const hookIndex = updatedPlugin.manifest.hooks.findIndex(h => h.name === hookName);
        if (hookIndex >= 0) {
          updatedPlugin.manifest.hooks[hookIndex].code = file.content;
        }
      } else if (file.path.startsWith('events/')) {
        const eventName = file.path.replace('events/', '').replace('.js', '');
        const eventIndex = updatedPlugin.manifest.events.findIndex(e => e.name === eventName);
        if (eventIndex >= 0) {
          updatedPlugin.manifest.events[eventIndex].code = file.content;
        }
      } else if (file.path.startsWith('widgets/')) {
        const widgetName = file.path.replace('widgets/', '').replace('.jsx', '');
        const widgetIndex = updatedPlugin.manifest.widgets.findIndex(w => w.name === widgetName);
        if (widgetIndex >= 0) {
          updatedPlugin.manifest.widgets[widgetIndex].code = file.content;
        }
      } else if (file.path === 'manifest.json') {
        try {
          updatedPlugin.manifest = JSON.parse(file.content);
        } catch (error) {
          console.error('Invalid manifest JSON');
        }
      }
    });

    onSave(updatedPlugin);
  };

  return (
    <div className="h-full flex bg-background">
      {/* LEFT: File Tree */}
      <div className="w-64 border-r">
        <FileTreeNavigator
          files={adaptPluginFilesForTree()}
          onFileSelect={handleFileSelect}
          selectedFile={activeFile}
          showDetails={false}
        />
      </div>

      {/* CENTER: Code Editor */}
      <div className="flex-1 flex flex-col">
        {/* File Tabs */}
        <FileTabs
          openFiles={openFiles}
          activeFile={activeFile}
          onSwitch={setActiveFile}
          onClose={handleTabClose}
        />

        {/* Editor */}
        {activeFile ? (
          <>
            <CodeEditor
              value={activeFile.content}
              onChange={handleCodeChange}
              language={activeFile.language}
              fileName={activeFile.name}
              enableDiffDetection={true}
              originalCode={activeFile.original}
            />

            {activeFile.content !== activeFile.original && (
              <DiffPreviewSystem
                originalCode={activeFile.original}
                modifiedCode={activeFile.content}
                fileName={activeFile.name}
                onPublish={handleSave}
              />
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Select a file to edit
          </div>
        )}
      </div>

      {/* RIGHT: AI Assistant */}
      <DainoStoreAIStudio initialContext="plugins" />
    </div>
  );
}
```

### 3. FileTabs.jsx

```jsx
// src/components/admin/plugins/FileTabs.jsx
import { X, FileText, FileCode } from 'lucide-react';

export default function FileTabs({ openFiles, activeFile, onSwitch, onClose }) {
  const getFileIcon = (fileName) => {
    if (fileName.endsWith('.json')) return <FileText className="w-3 h-3" />;
    if (fileName.endsWith('.jsx') || fileName.endsWith('.js')) return <FileCode className="w-3 h-3" />;
    return <FileText className="w-3 h-3" />;
  };

  return (
    <div className="flex border-b bg-muted/50 overflow-x-auto">
      {openFiles.map(file => {
        const isActive = activeFile?.path === file.path;
        const isModified = file.content !== file.original;

        return (
          <div
            key={file.path}
            className={`
              flex items-center gap-2 px-4 py-2 border-r cursor-pointer
              min-w-[150px] max-w-[200px]
              ${isActive
                ? 'bg-background border-b-2 border-primary text-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }
            `}
            onClick={() => onSwitch(file)}
          >
            {getFileIcon(file.name)}
            <span className="flex-1 text-sm truncate">
              {file.name}
              {isModified && <span className="text-orange-500 ml-1">•</span>}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose(file);
              }}
              className="hover:text-destructive transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
```

### 4. Slot Editor Integration

```jsx
// src/pages/admin/SlotEditor.jsx (Extended)
import { useEffect, useState } from 'react';
import apiClient from '@/api/client';
import PluginWidgetRenderer from '@/components/plugins/PluginWidgetRenderer';

export default function SlotEditor({ pageType }) {
  const [components, setComponents] = useState([]);
  const [slots, setSlots] = useState([]);

  useEffect(() => {
    loadComponents();
  }, []);

  const loadComponents = async () => {
    // Load built-in components
    const builtIn = getBuiltInComponents();

    // Load plugin widgets
    const response = await apiClient.get('/plugins/widgets');
    const pluginWidgets = response.widgets || [];

    // Combine
    setComponents([
      ...builtIn,
      { separator: true, label: 'Plugin Widgets' },
      ...pluginWidgets.map(widget => ({
        type: `plugin-widget:${widget.id}`,
        name: widget.displayName,
        icon: widget.icon,
        category: widget.category,
        description: widget.description,
        configSchema: widget.configSchema,
        isPluginWidget: true,
        badge: 'Plugin'
      }))
    ]);
  };

  const renderComponent = (component) => {
    if (component.type?.startsWith('plugin-widget:')) {
      const widgetId = component.type.replace('plugin-widget:', '');
      return (
        <PluginWidgetRenderer
          widgetId={widgetId}
          config={component.config || {}}
          slotData={component.slotData || {}}
        />
      );
    }

    // Render built-in component
    return <RegularComponent {...component} />;
  };

  return (
    <div className="slot-editor">
      {/* Component Palette */}
      <div className="palette">
        {components.map((comp, i) =>
          comp.separator ? (
            <div key={i} className="separator">
              <span>{comp.label}</span>
            </div>
          ) : (
            <DraggableComponent key={i} component={comp} />
          )
        )}
      </div>

      {/* Canvas */}
      <div className="canvas">
        {slots.map(slot => renderComponent(slot))}
      </div>
    </div>
  );
}
```

### 5. PluginWidgetRenderer.jsx

```jsx
// src/components/plugins/PluginWidgetRenderer.jsx
import { useState, useEffect } from 'react';
import apiClient from '@/api/client';
import { Alert } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';

export default function PluginWidgetRenderer({ widgetId, config, slotData }) {
  const [Widget, setWidget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadWidget();
  }, [widgetId]);

  const loadWidget = async () => {
    try {
      setLoading(true);

      const response = await apiClient.get(`/plugins/widgets/${widgetId}`);

      if (!response.success) {
        throw new Error(response.error || 'Failed to load widget');
      }

      // Compile widget component from code
      const componentCode = response.widget.componentCode;
      const compiledComponent = compileWidgetComponent(componentCode);

      setWidget(() => compiledComponent);
    } catch (err) {
      console.error('Failed to load widget:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const compileWidgetComponent = (code) => {
    // SECURITY NOTE: This is a simplified example
    // In production, use proper sandboxing (iframe, web worker, etc.)
    try {
      // Create a safe scope
      const scope = {
        React: require('react'),
        useState: require('react').useState,
        useEffect: require('react').useEffect,
        // Add other safe globals
      };

      // Compile code
      const func = new Function(...Object.keys(scope), `
        return ${code};
      `);

      return func(...Object.values(scope));
    } catch (error) {
      console.error('Failed to compile widget:', error);
      throw new Error('Invalid widget code');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <p>Failed to load plugin widget: {error}</p>
      </Alert>
    );
  }

  if (!Widget) {
    return (
      <Alert>
        <p>Widget not found</p>
      </Alert>
    );
  }

  // Render the plugin widget with error boundary
  return (
    <ErrorBoundary>
      <Widget config={config} slotData={slotData} />
    </ErrorBoundary>
  );
}

// Error boundary for plugin widgets
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <Alert variant="destructive">
          <p>Widget crashed: {this.state.error?.message}</p>
        </Alert>
      );
    }

    return this.props.children;
  }
}
```

---

## 📋 MAGENTO EVENT SYSTEM CONSTANTS

```javascript
// src/constants/PluginEvents.js

export const PLUGIN_EVENTS = {
  // Product Events
  'product.before_save': {
    description: 'Before product is saved to database',
    location: 'backend/src/controllers/ProductController.js:save',
    payload: { product: 'Product object before save' }
  },
  'product.after_save': {
    description: 'After product is saved to database',
    location: 'backend/src/controllers/ProductController.js:save',
    payload: { product: 'Saved product object', isNew: 'boolean' }
  },
  'product.view': {
    description: 'When product page is rendered',
    location: 'frontend/src/pages/ProductDetail.jsx',
    payload: { product: 'Product object', user: 'Current user' }
  },
  'product.list': {
    description: 'When product list is rendered',
    location: 'frontend/src/pages/Category.jsx',
    payload: { products: 'Array of products', filters: 'Applied filters' }
  },

  // Cart Events
  'cart.add_item': {
    description: 'When item is added to cart',
    location: 'frontend/src/contexts/CartContext.jsx:addToCart',
    payload: { product: 'Product object', quantity: 'number', cart: 'Current cart' }
  },
  'cart.remove_item': {
    description: 'When item is removed from cart',
    location: 'frontend/src/contexts/CartContext.jsx:removeFromCart',
    payload: { productId: 'string', cart: 'Current cart' }
  },
  'cart.update_quantity': {
    description: 'When cart item quantity is updated',
    location: 'frontend/src/contexts/CartContext.jsx:updateQuantity',
    payload: { productId: 'string', oldQuantity: 'number', newQuantity: 'number' }
  },
  'cart.before_checkout': {
    description: 'Before checkout process starts',
    location: 'frontend/src/pages/Checkout.jsx:handleCheckout',
    payload: { cart: 'Cart object', user: 'Current user' }
  },

  // Order Events
  'order.before_create': {
    description: 'Before order is created',
    location: 'backend/src/controllers/OrderController.js:create',
    payload: { orderData: 'Order data object', user: 'User object' }
  },
  'order.after_create': {
    description: 'After order is created',
    location: 'backend/src/controllers/OrderController.js:create',
    payload: { order: 'Created order object', user: 'User object' }
  },
  'order.status_change': {
    description: 'When order status changes',
    location: 'backend/src/controllers/OrderController.js:updateStatus',
    payload: { order: 'Order object', oldStatus: 'string', newStatus: 'string' }
  },
  'order.cancel': {
    description: 'When order is cancelled',
    location: 'backend/src/controllers/OrderController.js:cancel',
    payload: { order: 'Order object', reason: 'Cancellation reason' }
  },

  // Customer Events
  'customer.login': {
    description: 'After customer logs in',
    location: 'backend/src/controllers/AuthController.js:login',
    payload: { user: 'User object', session: 'Session data' }
  },
  'customer.register': {
    description: 'After customer registration',
    location: 'backend/src/controllers/AuthController.js:register',
    payload: { user: 'New user object' }
  },
  'customer.before_save': {
    description: 'Before customer data is saved',
    location: 'backend/src/controllers/CustomerController.js:update',
    payload: { user: 'User object', changes: 'Changed fields' }
  },
  'customer.after_save': {
    description: 'After customer data is saved',
    location: 'backend/src/controllers/CustomerController.js:update',
    payload: { user: 'Updated user object' }
  },

  // Page/UI Events
  'page.render_before': {
    description: 'Before page renders',
    location: 'frontend/src/App.jsx',
    payload: { route: 'Current route', user: 'Current user' }
  },
  'page.render_after': {
    description: 'After page renders',
    location: 'frontend/src/App.jsx',
    payload: { route: 'Current route', user: 'Current user' }
  },
  'widget.render': {
    description: 'When a widget is rendered',
    location: 'frontend/src/components/*',
    payload: { widgetType: 'string', config: 'Widget config' }
  },

  // Admin Events
  'admin.page_load': {
    description: 'When admin page loads',
    location: 'frontend/src/pages/admin/*',
    payload: { page: 'Page identifier', user: 'Admin user' }
  }
};

export const PLUGIN_HOOKS = {
  // Product Hooks
  'product.price': {
    description: 'Filter product price',
    type: 'filter',
    location: 'frontend/src/components/ProductCard.jsx',
    params: { price: 'number', product: 'Product object' },
    returns: 'Modified price (number)'
  },
  'product.data': {
    description: 'Filter product data before display',
    type: 'filter',
    location: 'frontend/src/pages/ProductDetail.jsx',
    params: { product: 'Product object' },
    returns: 'Modified product object'
  },

  // Cart Hooks
  'cart.item_price': {
    description: 'Filter cart item price',
    type: 'filter',
    location: 'frontend/src/contexts/CartContext.jsx',
    params: { price: 'number', item: 'Cart item object' },
    returns: 'Modified price (number)'
  },
  'cart.total': {
    description: 'Filter cart total',
    type: 'filter',
    location: 'frontend/src/contexts/CartContext.jsx',
    params: { total: 'number', cart: 'Cart object' },
    returns: 'Modified total (number)'
  },

  // Checkout Hooks
  'checkout.fields': {
    description: 'Filter checkout form fields',
    type: 'filter',
    location: 'frontend/src/pages/Checkout.jsx',
    params: { fields: 'Array of field objects' },
    returns: 'Modified fields array'
  },

  // Email Hooks
  'email.content': {
    description: 'Filter email content before sending',
    type: 'filter',
    location: 'backend/src/services/EmailService.js',
    params: { content: 'Email HTML/text', type: 'Email type', data: 'Email data' },
    returns: 'Modified email content'
  }
};
```

---

## 🚀 IMPLEMENTATION PRIORITY

### Phase 1: Foundation (Week 1-2)
1. ✅ Create database schemas (master + tenant)
2. ✅ Seed core navigation items
3. ✅ Create AdminNavigationService
4. ✅ Update AdminSidebar to load from API
5. ✅ Define Magento event constants

### Phase 2: Core Plugin System (Week 3-4)
6. ✅ Extend ExtensionSystem → PluginManager
7. ✅ Create PluginExecutor (leverage HookSystem & EventSystem)
8. ✅ Create WidgetRegistry
9. ✅ Create PluginDataService
10. ✅ Plugin installation/uninstallation flow

### Phase 3: Frontend Tools (Week 5-6)
11. ✅ Create PluginCodeEditorWrapper
12. ✅ Adapt FileTreeNavigator for plugins
13. ✅ Adapt DainoStoreAIStudio for plugins mode
14. ✅ Create FileTabs component
15. ✅ Create HookEventSelector

### Phase 4: Widget Integration (Week 7)
16. ✅ Create PluginWidgetRenderer
17. ✅ Extend slot editor for plugin widgets
18. ✅ Widget loading and sandboxing

### Phase 5: AI Generation (Week 8)
19. ✅ Create AIPluginGenerator
20. ✅ Integrate with DainoStoreAIStudio
21. ✅ Test AI-powered plugin creation

### Phase 6: Marketplace (Week 9-10)
22. ✅ Create marketplace routes
23. ✅ Integrate VersionSystem
24. ✅ Payment integration (Stripe)
25. ✅ License management

### Phase 7: Examples & Documentation (Week 11-12)
26. ✅ Build Gift Product Popup plugin
27. ✅ Build Ekomi Reviews Widget plugin
28. ✅ Create PLUGIN_DEVELOPMENT_GUIDE.md
29. ✅ Write comprehensive tests

---

## ✅ SUCCESS CRITERIA

- ✅ Admin navigation loads dynamically from database
- ✅ Plugins can register navigation items
- ✅ Tenants can customize navigation (rename, reorder, hide)
- ✅ Plugin widgets appear in slot editor component palette
- ✅ Widgets render correctly with configuration
- ✅ AI can generate complete plugins from prompts
- ✅ Manual code editing works in multi-file editor
- ✅ Hooks and events execute correctly
- ✅ Marketplace allows browsing and installation
- ✅ Multi-tenant isolation works perfectly
- ✅ Example plugins demonstrate all features

---

**Ready to build! 🚀**