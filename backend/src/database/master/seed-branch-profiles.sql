-- Branch Profile Seed Data for AI Store Intelligence
-- These profiles provide industry-specific knowledge for different store types
--
-- SAFE TO RE-RUN: This script deletes existing branch_profile entries before inserting

-- ============================================
-- CLEANUP: Remove existing branch profiles
-- ============================================
DELETE FROM ai_context_documents WHERE type = 'branch_profile';

-- ============================================
-- BRANCH PROFILES
-- ============================================

INSERT INTO ai_context_documents (type, title, content, category, tags, priority, mode, is_active, metadata) VALUES

-- FASHION / APPAREL
('branch_profile', 'Fashion Store Best Practices',
'FASHION & APPAREL STORE OPTIMIZATION:

ESSENTIAL PLUGINS:
- Size Chart: Critical for reducing returns (15-20% return reduction)
- Color Swatches: Visual variant selection improves conversions
- Outfit Builder / Complete the Look: Cross-sell complementary items
- Fabric Care Guide: Reduces customer service queries
- Style Quiz: Personalized recommendations increase AOV

KEY METRICS TO TRACK:
- Return rate by size/color
- Size chart engagement vs conversion
- Cross-sell attachment rate
- Seasonal category performance

COMMON ATTRIBUTES:
- Size (XS, S, M, L, XL, XXL or numeric)
- Color, Material/Fabric, Fit type
- Care instructions, Season

HIGH-VALUE FEATURES:
- Virtual try-on integration
- User-generated outfit photos
- Size recommendation based on previous purchases
- Wishlist for seasonal planning',
'fashion', '["clothing", "apparel", "size-chart", "color-swatch", "returns"]', 100, 'all', true,
'{"branch": "fashion", "suggested_plugins": ["size-chart", "color-swatch", "outfit-builder", "fabric-care", "style-quiz"], "key_attributes": ["size", "color", "material", "fit"], "typical_return_rate": "20-30%"}'),

('branch_profile', 'Fashion Marketing Insights',
'FASHION STORE MARKETING:

BEST PERFORMING CHANNELS:
- Instagram & Pinterest (visual platforms)
- Influencer partnerships
- Email for seasonal campaigns
- Google Shopping for branded searches

SEASONAL CONSIDERATIONS:
- Plan inventory 3-6 months ahead
- Pre-season email campaigns (2-4 weeks before)
- End-of-season clearance drives repeat purchases
- Holiday gift guides increase AOV

ADWORDS STRATEGY:
- Focus on branded + style terms ("summer maxi dress")
- Avoid generic terms ("cheap clothes") - low ROI
- Retargeting for cart abandonment critical
- Showcase specific products in shopping ads

EMAIL BEST PRACTICES:
- New arrival announcements
- Back-in-stock notifications
- Style inspiration content
- VIP early access to sales',
'fashion', '["marketing", "social", "email", "adwords", "seasonal"]', 90, 'all', true,
'{"branch": "fashion", "best_channels": ["instagram", "pinterest", "email"], "seasonal_planning_months": 6}'),

-- ELECTRONICS / TECH
('branch_profile', 'Electronics Store Best Practices',
'ELECTRONICS & TECH STORE OPTIMIZATION:

ESSENTIAL PLUGINS:
- Spec Comparison: Side-by-side product comparisons
- Compatibility Checker: "Will this work with my device?"
- Warranty Info Display: Build trust, reduce hesitation
- Tech Support Chat: Pre-sale technical questions
- Bundle Builder: Accessories and add-ons

KEY METRICS TO TRACK:
- Comparison tool usage to purchase rate
- Accessory attachment rate
- Support query volume by product
- Warranty upgrade conversion

COMMON ATTRIBUTES:
- Technical specifications (RAM, storage, screen size)
- Compatibility (OS, device models)
- Warranty period, Energy rating
- Connectivity options

HIGH-VALUE FEATURES:
- Expert reviews and ratings
- Video demonstrations
- Q&A section per product
- Trade-in program integration',
'electronics', '["tech", "gadgets", "specs", "compatibility", "warranty"]', 100, 'all', true,
'{"branch": "electronics", "suggested_plugins": ["spec-compare", "compatibility-checker", "warranty-display", "bundle-builder"], "key_attributes": ["specs", "compatibility", "warranty"], "typical_research_time": "high"}'),

('branch_profile', 'Electronics Marketing Insights',
'ELECTRONICS STORE MARKETING:

BEST PERFORMING CHANNELS:
- Google Search (high-intent research queries)
- YouTube reviews and unboxings
- Tech blogs and review sites
- Reddit and tech communities

PURCHASE BEHAVIOR:
- Long research cycle (days to weeks)
- Heavy comparison shopping
- Price sensitivity varies by segment
- Trust and reviews are critical

ADWORDS STRATEGY:
- Target specific model numbers
- Comparison keywords ("X vs Y")
- "Best [category] 2024" queries
- Remarketing for considered purchases

CONTENT STRATEGY:
- Detailed buying guides
- Comparison articles
- How-to and setup tutorials
- New release coverage',
'electronics', '["marketing", "search", "youtube", "reviews", "research"]', 90, 'all', true,
'{"branch": "electronics", "best_channels": ["google", "youtube", "review-sites"], "purchase_cycle": "long"}'),

-- FOOD & GROCERY
('branch_profile', 'Food & Grocery Store Best Practices',
'FOOD & GROCERY STORE OPTIMIZATION:

ESSENTIAL PLUGINS:
- Nutritional Info Display: Health-conscious shoppers
- Allergen Warnings: Legal compliance + trust
- Recipe Cards: Inspiration drives basket size
- Subscription/Auto-reorder: Recurring revenue
- Freshness Indicators: Build confidence

KEY METRICS TO TRACK:
- Subscription conversion and retention
- Average basket size
- Reorder rate
- Items per order

COMMON ATTRIBUTES:
- Nutritional values (calories, protein, etc.)
- Allergens (nuts, gluten, dairy, etc.)
- Dietary tags (vegan, organic, keto)
- Shelf life, Storage instructions

HIGH-VALUE FEATURES:
- Meal planning tools
- Shopping list builder
- Delivery time slot selection
- Substitution preferences',
'food', '["grocery", "nutrition", "allergens", "recipes", "subscription"]', 100, 'all', true,
'{"branch": "food", "suggested_plugins": ["nutrition-display", "allergen-warning", "recipe-cards", "subscription-reorder"], "key_attributes": ["nutrition", "allergens", "dietary"], "repeat_purchase_rate": "high"}'),

('branch_profile', 'Food Store Marketing Insights',
'FOOD & GROCERY MARKETING:

BEST PERFORMING CHANNELS:
- Local SEO (near me searches)
- Email for weekly deals
- Social media food photography
- Community and loyalty programs

PURCHASE BEHAVIOR:
- Frequent, recurring purchases
- Price comparison on staples
- Quality focus on fresh items
- Convenience is key differentiator

LOYALTY STRATEGY:
- Points on purchases
- Exclusive member pricing
- Early access to deals
- Birthday rewards

CONTENT STRATEGY:
- Recipe content drives traffic
- Seasonal meal planning
- Health and wellness tips
- Local sourcing stories',
'food', '["marketing", "local", "loyalty", "recipes", "email"]', 90, 'all', true,
'{"branch": "food", "best_channels": ["local-seo", "email", "social"], "purchase_frequency": "weekly"}'),

-- HOME & FURNITURE
('branch_profile', 'Home & Furniture Store Best Practices',
'HOME & FURNITURE STORE OPTIMIZATION:

ESSENTIAL PLUGINS:
- Room Visualizer: AR/3D placement in room
- Dimension Calculator: "Will it fit?"
- Assembly Guides: Reduce support queries
- Material Samples: Order swatches before purchase
- Delivery Scheduler: White glove service options

KEY METRICS TO TRACK:
- Visualizer usage to conversion
- Sample request to purchase rate
- Delivery satisfaction scores
- Assembly-related returns

COMMON ATTRIBUTES:
- Dimensions (HxWxD)
- Material, Color/Finish
- Weight, Assembly required
- Room type, Style category

HIGH-VALUE FEATURES:
- Room design consultation
- Bundle room sets
- Financing options display
- Delivery tracking',
'home', '["furniture", "decor", "dimensions", "assembly", "delivery"]', 100, 'all', true,
'{"branch": "home", "suggested_plugins": ["room-visualizer", "dimension-calculator", "assembly-guide", "material-samples"], "key_attributes": ["dimensions", "material", "assembly"], "avg_order_value": "high"}'),

-- BEAUTY & COSMETICS
('branch_profile', 'Beauty & Cosmetics Store Best Practices',
'BEAUTY & COSMETICS STORE OPTIMIZATION:

ESSENTIAL PLUGINS:
- Shade Finder: Match foundation/lipstick colors
- Ingredient List: Transparency for conscious consumers
- Skin Type Quiz: Personalized recommendations
- Virtual Try-On: AR makeup application
- Routine Builder: Cross-sell complementary products

KEY METRICS TO TRACK:
- Quiz completion to purchase rate
- Shade match accuracy (returns)
- Routine builder basket size
- Replenishment rate

COMMON ATTRIBUTES:
- Shade/Color, Skin type suitability
- Ingredients, Cruelty-free/Vegan
- Coverage level, Finish type
- Product size/volume

HIGH-VALUE FEATURES:
- Before/after galleries
- Expert tutorials
- Subscription for replenishment
- Loyalty program with samples',
'beauty', '["cosmetics", "skincare", "shade-finder", "ingredients", "virtual-tryon"]', 100, 'all', true,
'{"branch": "beauty", "suggested_plugins": ["shade-finder", "ingredient-list", "skin-quiz", "virtual-tryon", "routine-builder"], "key_attributes": ["shade", "skin_type", "ingredients"], "repurchase_rate": "high"}'),

-- SPORTS & FITNESS
('branch_profile', 'Sports & Fitness Store Best Practices',
'SPORTS & FITNESS STORE OPTIMIZATION:

ESSENTIAL PLUGINS:
- Size Guide by Sport: Sport-specific sizing
- Gear Finder Quiz: Match equipment to skill level
- Training Plans: Content that drives engagement
- Product Comparisons: Technical gear comparison
- Bundle Kits: Starter packs by activity

KEY METRICS TO TRACK:
- Quiz to purchase conversion
- Bundle attachment rate
- Seasonal sport category performance
- Equipment upgrade cycle

COMMON ATTRIBUTES:
- Size, Sport/Activity type
- Skill level (beginner/pro)
- Material/Technology
- Weather suitability

HIGH-VALUE FEATURES:
- Athlete endorsements
- User reviews with activity level
- Gear maintenance guides
- Training content integration',
'sports', '["fitness", "equipment", "sizing", "training", "bundles"]', 100, 'all', true,
'{"branch": "sports", "suggested_plugins": ["sport-size-guide", "gear-finder", "training-plans", "bundle-kits"], "key_attributes": ["size", "sport", "skill_level"], "seasonal_peaks": ["new-year", "summer"]}'),

-- B2B / WHOLESALE
('branch_profile', 'B2B & Wholesale Store Best Practices',
'B2B & WHOLESALE STORE OPTIMIZATION:

ESSENTIAL PLUGINS:
- Tiered Pricing Display: Volume discounts
- Quote Request: Custom pricing for large orders
- Quick Order Form: Reorder by SKU
- Account Management: Multi-user company accounts
- Invoice/Net Terms: Payment flexibility

KEY METRICS TO TRACK:
- Quote to order conversion
- Average order value by tier
- Reorder rate and frequency
- Account activation rate

COMMON ATTRIBUTES:
- SKU/Part number
- Minimum order quantity
- Lead time, Bulk pricing tiers
- Certifications/Compliance

HIGH-VALUE FEATURES:
- Dedicated account manager
- Custom catalogs per account
- PO upload for ordering
- Integration with ERP systems',
'b2b', '["wholesale", "bulk", "tiered-pricing", "quotes", "accounts"]', 100, 'all', true,
'{"branch": "b2b", "suggested_plugins": ["tiered-pricing", "quote-request", "quick-order", "multi-user-accounts"], "key_attributes": ["sku", "moq", "lead_time", "pricing_tier"], "sales_cycle": "longer"}');
