# Catalyst Platform Roadmap

> Last updated: December 2025

## Overview

This roadmap outlines planned features and integrations for the Catalyst e-commerce platform, covering both the Admin Panel and Webshop/Storefront experiences.

---

## Table of Contents

- [Phase 1: Foundation](#phase-1-foundation-q1-2025)
- [Phase 2: Marketplace Expansion](#phase-2-marketplace-expansion-q2-2025)
- [Phase 3: Social Commerce](#phase-3-social-commerce-q3-2025)
- [Phase 4: Enterprise & Data](#phase-4-enterprise--data-q4-2025)
- [Admin Panel Features](#admin-panel-features)
- [Webshop Features](#webshop-features)
- [Integrations](#integrations)
- [Platform Improvements](#platform-improvements)

---

## Phase 1: Foundation (Q1 2025)

### Core Commerce Features

| Feature | Priority | Status | Description |
|---------|----------|--------|-------------|
| Subscription/Recurring Orders | High | Planned | Recurring billing for subscription products via Stripe |
| Gift Card System | High | Planned | Sell & redeem digital gift cards with balance tracking |
| Back-in-Stock Notifications | High | Planned | Email customers when out-of-stock items return |
| Social Login | High | Planned | Google, Apple, Facebook login for faster checkout |

### Feed Management

| Feature | Priority | Status | Description |
|---------|----------|--------|-------------|
| Feed Manager UI | High | Planned | Central hub for managing all product feeds |
| Rules Engine | High | Planned | If/then rules for feed customization |
| Google Shopping Feed (Enhanced) | High | Planned | Full Google Merchant Center integration |
| Facebook/Meta Catalog Sync | High | Planned | Auto-sync products to Meta Commerce |

### Email Marketing

| Feature | Priority | Status | Description |
|---------|----------|--------|-------------|
| Klaviyo Deep Integration | High | Planned | Predictive analytics, flows sync, revenue attribution |
| Abandoned Cart Automation | Medium | Planned | Auto-emails for cart recovery |

---

## Phase 2: Marketplace Expansion (Q2 2025)

### Amazon Integration

| Feature | Priority | Status | Description |
|---------|----------|--------|-------------|
| Product Listing Sync | High | Planned | Push products with category mapping |
| Inventory Sync | High | Planned | Real-time stock sync to prevent overselling |
| Order Import | High | Planned | Pull Amazon orders for unified fulfillment |
| FBA Support | Medium | Planned | Fulfilled by Amazon inventory sync |
| Pricing Rules | Medium | Planned | Auto-adjust Amazon prices with margin rules |
| Buy Box Monitoring | Low | Planned | Track Buy Box status and repricing alerts |

### eBay Integration

| Feature | Priority | Status | Description |
|---------|----------|--------|-------------|
| Listing Templates | High | Planned | Map products to eBay categories |
| Order Sync | High | Planned | Import orders, sync tracking numbers |
| Inventory Sync | High | Planned | Real-time stock updates |
| Auction + Fixed Price | Medium | Planned | Support both listing types |
| Returns Handling | Medium | Planned | Sync return requests to RMA |

### Bol.com Integration

| Feature | Priority | Status | Description |
|---------|----------|--------|-------------|
| Product Feed | High | Planned | Map to Bol categories with EAN validation |
| Order/Inventory Sync | High | Planned | Bidirectional sync |
| LVB Support | Medium | Planned | Logistiek via Bol.com fulfillment |

### Customer Features

| Feature | Priority | Status | Description |
|---------|----------|--------|-------------|
| B2B Portal | High | Planned | Company accounts, quote requests, bulk pricing |
| Loyalty Program Builder | High | Planned | Points system, tiers, rewards, referrals |
| Product Q&A | Medium | Planned | Customer questions with merchant answers |

---

## Phase 3: Social Commerce (Q3 2025)

### TikTok Shop

| Feature | Priority | Status | Description |
|---------|----------|--------|-------------|
| Product Catalog Sync | High | Planned | Sync products to TikTok Shop |
| Live Shopping | High | Planned | Product links during livestreams |
| Affiliate Marketplace | Medium | Planned | Connect with TikTok creators |
| Pixel Integration | Medium | Planned | Conversion tracking |

### Instagram Shopping (Enhanced)

| Feature | Priority | Status | Description |
|---------|----------|--------|-------------|
| Catalog Sync | High | Planned | Auto-sync products to Instagram Shop |
| Product Tagging | High | Planned | Enable tags in posts/stories/reels |
| Shopping Insights | Medium | Planned | Pull Instagram shopping analytics |
| UGC Import | Medium | Planned | Import customer photos from tagged posts |

### Pinterest

| Feature | Priority | Status | Description |
|---------|----------|--------|-------------|
| Product Pins | High | Planned | Rich pins with pricing, availability |
| Catalog Sync | High | Planned | Auto-update Pinterest catalog |
| Shopping Ads Feed | Medium | Planned | Product feed for Pinterest ads |

### Additional Features

| Feature | Priority | Status | Description |
|---------|----------|--------|-------------|
| Multi-warehouse Inventory | High | Planned | Stock per location, auto-routing orders |
| Returns & RMA Portal | High | Planned | Return requests, refund automation |
| Affiliate/Referral System | Medium | Planned | Track affiliates, commission payouts |
| AR Product Preview | Medium | Planned | 3D/AR view for products |

---

## Phase 4: Enterprise & Data (Q4 2025)

### Data Warehouse Integrations

| Feature | Priority | Status | Description |
|---------|----------|--------|-------------|
| BigQuery Export | High | Planned | Export data for BI/analytics |
| Snowflake Sync | High | Planned | Data warehouse integration |
| Custom Webhooks Builder | High | Planned | Real-time event streaming |
| Fivetran Connector | Medium | Planned | Standard data connector |

### ERP/Accounting

| Feature | Priority | Status | Description |
|---------|----------|--------|-------------|
| QuickBooks Integration | High | Planned | Invoice sync, expense tracking |
| Xero Integration | High | Planned | Accounting sync |
| Exact Online | Medium | Planned | NL/EU accounting integration |
| Moneybird | Medium | Planned | NL invoicing |

### Enterprise Features

| Feature | Priority | Status | Description |
|---------|----------|--------|-------------|
| Vendor/Marketplace Mode | High | Planned | Multi-vendor with seller dashboards |
| Mobile Admin App | High | Planned | React Native app for order management |
| Advanced Reports Builder | Medium | Planned | Drag-drop report builder |
| POS Integration | Medium | Planned | Connect to physical stores |

---

## Admin Panel Features

### High Priority

| Feature | Description | Phase |
|---------|-------------|-------|
| Subscription/Recurring Orders | Let merchants sell subscriptions with recurring billing | Phase 1 |
| B2B Portal | Company accounts, net payment terms, quote requests, approval workflows | Phase 2 |
| Multi-warehouse Inventory | Stock per location, auto-routing, transfer orders | Phase 3 |
| AI Product Descriptions | Auto-generate SEO product copy using Claude | Phase 1 |
| Bulk Operations | Mass edit prices, categories, attributes via CSV | Phase 1 |
| Advanced Pricing Rules | Quantity breaks, customer group pricing, time-based pricing | Phase 2 |

### Medium Priority

| Feature | Description | Phase |
|---------|-------------|-------|
| Loyalty Program Builder | Points system, tiers, rewards, referral bonuses | Phase 2 |
| Gift Card System | Sell & redeem digital gift cards | Phase 1 |
| Inventory Forecasting | AI predictions for restock timing | Phase 3 |
| Returns & RMA Portal | Return requests, refund automation | Phase 3 |
| Mobile Admin App | React Native app for on-the-go management | Phase 4 |
| Advanced Reports Builder | Drag-drop builder, scheduled exports | Phase 4 |
| Affiliate/Referral System | Track affiliates, commission payouts | Phase 3 |
| Review Moderation + UGC | Photo/video reviews, Q&A, incentivized reviews | Phase 2 |

### Nice to Have

| Feature | Description | Phase |
|---------|-------------|-------|
| Vendor/Marketplace Mode | Multi-vendor marketplace with payouts | Phase 4 |
| POS Integration | Connect to physical stores | Phase 4 |
| Live Chat Dashboard | Support chat integrated with CRM | Future |

---

## Webshop Features

### High Priority

| Feature | Description | Phase |
|---------|-------------|-------|
| PWA / Mobile App | Offline browsing, push notifications, home screen install | Phase 2 |
| Social Login | Google, Apple, Facebook login | Phase 1 |
| Product Comparison | Compare 2-4 products side-by-side | Phase 2 |
| Guest Checkout Improvements | One-click checkout, saved payment methods | Phase 1 |
| Advanced Search | Autocomplete, typo tolerance, visual search | Phase 2 |
| Product Q&A | Customer questions with merchant answers | Phase 2 |
| Back-in-Stock Notifications | Email when items return | Phase 1 |

### Medium Priority

| Feature | Description | Phase |
|---------|-------------|-------|
| AR Product Preview | 3D/AR view for furniture, glasses, etc. | Phase 3 |
| Wishlist Sharing | Share wishlists via link, gift registry | Phase 2 |
| Recently Viewed | Persistent recently viewed products | Phase 1 |
| Product Bundles | "Frequently bought together" with discount | Phase 2 |
| Subscription UI | Subscribe & save on products | Phase 1 |
| Gift Message & Wrapping | Add gift notes at checkout | Phase 2 |
| Store Locator | Map with physical pickup locations | Phase 3 |
| Delivery Date Selection | Choose preferred delivery date/time | Phase 2 |

### Nice to Have

| Feature | Description | Phase |
|---------|-------------|-------|
| Live Shopping/Video | Livestream selling events | Future |
| Gamification | Spin-to-win, scratch cards | Future |
| Voice Search | Voice-activated product search | Future |
| Size Recommender | AI size suggestions | Future |

---

## Integrations

### Marketplaces

| Platform | Priority | Phase | Status |
|----------|----------|-------|--------|
| Amazon | High | Phase 2 | Planned |
| eBay | High | Phase 2 | Planned |
| Bol.com | High | Phase 2 | Planned |
| Kaufland | Medium | Phase 3 | Planned |
| Zalando | Medium | Phase 3 | Planned |
| Cdiscount | Medium | Future | Planned |
| Allegro | Low | Future | Planned |
| Etsy | Low | Future | Planned |

### Social Commerce

| Platform | Priority | Phase | Status |
|----------|----------|-------|--------|
| Instagram Shopping | High | Phase 3 | In Progress |
| Facebook/Meta Commerce | High | Phase 1 | In Progress |
| TikTok Shop | High | Phase 3 | Planned |
| Pinterest | Medium | Phase 3 | Planned |
| WhatsApp Business | Medium | Phase 3 | Planned |

### Email & Marketing

| Integration | Priority | Phase | Status |
|-------------|----------|-------|--------|
| Klaviyo | High | Phase 1 | Planned |
| Mailchimp | Medium | Phase 2 | Existing |
| Omnisend | Medium | Phase 2 | Planned |
| ActiveCampaign | Low | Phase 3 | Planned |
| Postmark | Medium | Phase 2 | Planned |

### SMS & Push

| Integration | Priority | Phase | Status |
|-------------|----------|-------|--------|
| Twilio | High | Phase 2 | Planned |
| Web Push Notifications | High | Phase 2 | Planned |
| Attentive | Medium | Phase 3 | Planned |
| MessageBird | Medium | Phase 3 | Planned |

### Data & Analytics

| Integration | Priority | Phase | Status |
|-------------|----------|-------|--------|
| BigQuery | High | Phase 4 | Planned |
| Snowflake | High | Phase 4 | Planned |
| Elasticsearch | Medium | Phase 3 | Planned |
| Fivetran Connector | Medium | Phase 4 | Planned |
| Airbyte Source | Low | Future | Planned |

### ERP & Accounting

| Integration | Priority | Phase | Status |
|-------------|----------|-------|--------|
| QuickBooks | High | Phase 4 | Planned |
| Xero | High | Phase 4 | Planned |
| Exact Online | Medium | Phase 4 | Planned |
| Moneybird | Medium | Phase 4 | Planned |
| SAP Business One | Low | Future | Planned |
| NetSuite | Low | Future | Planned |

### PIM/DAM

| Integration | Priority | Phase | Status |
|-------------|----------|-------|--------|
| Akeneo (Enhanced) | High | Phase 2 | In Progress |
| Pimcore | Medium | Phase 3 | Planned |
| Contentful | Medium | Phase 3 | Planned |
| Salsify | Low | Future | Planned |

---

## Feed Management Hub

Central feed manager for all marketplace and advertising channels.

### Core Features

| Feature | Description | Priority |
|---------|-------------|----------|
| Feed Templates | Pre-built templates for Google, Facebook, Amazon, etc. | High |
| Visual Field Mapping | Drag-drop mapper for field transformations | High |
| Rules Engine | If/then rules for excluding products, modifying prices | High |
| Category Mapping | Map categories to marketplace taxonomies | High |
| Feed Scheduling | Hourly/daily feed generation | High |
| Feed Validation | Check for errors before publishing | High |
| Performance Analytics | Track clicks, sales per channel | Medium |
| Price Rules per Channel | Different margins per marketplace | Medium |
| Stock Rules | Reserve stock, set thresholds per channel | Medium |

### Supported Feed Formats

| Format | Channels |
|--------|----------|
| Google Shopping XML | Google Merchant Center |
| Facebook CSV | Meta Commerce Manager |
| Amazon Flat File | Amazon Seller Central |
| eBay File Exchange | eBay bulk uploads |
| Bol.com XML | Bol.com Partner Platform |
| Custom XML/JSON/CSV | Any channel |

---

## Platform Improvements

### Security & Compliance

| Feature | Priority | Phase |
|---------|----------|-------|
| Two-Factor Auth (2FA) | High | Phase 1 |
| Audit Log | High | Phase 2 |
| SOC 2 Compliance | Medium | Phase 4 |
| PCI DSS Level 1 | Medium | Phase 3 |

### Developer Experience

| Feature | Priority | Phase |
|---------|----------|-------|
| GraphQL API | High | Phase 3 |
| Webhooks Management UI | High | Phase 2 |
| API Rate Limit Dashboard | Medium | Phase 2 |
| SDK for Custom Apps | Medium | Phase 3 |

### Infrastructure

| Feature | Priority | Phase |
|---------|----------|-------|
| White-label Mobile App | Medium | Phase 4 |
| Multi-region Deployment | Medium | Phase 4 |
| Edge Caching | Medium | Phase 3 |

### Automation

| Feature | Priority | Phase |
|---------|----------|-------|
| Zapier Integration | High | Phase 2 |
| Make (Integromat) | Medium | Phase 2 |
| n8n Self-hosted | Low | Phase 3 |

---

## Status Legend

| Status | Description |
|--------|-------------|
| Planned | On roadmap, not yet started |
| In Progress | Currently being developed |
| Beta | Available for testing |
| Released | Available to all users |
| Future | Considered for future phases |

---

## Contributing

Have a feature request? Contact the product team or submit feedback through the admin panel.

---

*This roadmap is subject to change based on customer feedback and market conditions.*
