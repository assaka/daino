# Enhanced Analytics Tracking Guide
## Anowave-Style Comprehensive Event Tracking

Complete guide for implementing comprehensive ecommerce analytics similar to Anowave (Magento GTM extension).

---

## 🎯 Overview

Your store now has **30+ tracking events** covering all aspects of ecommerce analytics:

- ✅ Enhanced Ecommerce (GA4 format)
- ✅ Product impressions & clicks
- ✅ Detailed cart tracking
- ✅ Checkout funnel tracking
- ✅ Purchase tracking
- ✅ Promotion tracking
- ✅ User engagement events
- ✅ Error tracking

---

## 📦 Implementation Guide

### 1. Product List / Category Page

```jsx
import { trackProductImpressions, trackProductClick } from '@/components/storefront/EnhancedDataLayerManager';

function CategoryPage() {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    // After products load, track impressions
    if (products.length > 0) {
      trackProductImpressions(products, 'Category Page - Electronics');
    }
  }, [products]);

  const handleProductClick = (product, index) => {
    // Track click before navigation
    trackProductClick(product, index, 'Category Page - Electronics');

    // Navigate to product
    navigate(`/product/${product.slug}`);
  };

  return (
    <div>
      {products.map((product, index) => (
        <ProductCard
          key={product.id}
          product={product}
          onClick={() => handleProductClick(product, index)}
        />
      ))}
    </div>
  );
}
```

**DataLayer Output:**
```javascript
{
  event: 'view_item_list',
  ecommerce: {
    item_list_name: 'Category Page - Electronics',
    items: [
      {
        item_id: 'product-uuid-1',
        item_name: 'Laptop Pro',
        item_brand: 'TechBrand',
        item_category: 'Electronics',
        price: 1299.99,
        index: 0,
        sku: 'LAPTOP-001'
      },
      // ... more products
    ]
  }
}
```

---

### 2. Product Detail Page

```jsx
import { trackProductView } from '@/components/storefront/EnhancedDataLayerManager';

function ProductPage() {
  const [product, setProduct] = useState(null);

  useEffect(() => {
    // After product loads, track view
    if (product) {
      trackProductView(product);
    }
  }, [product]);

  return <ProductDetails product={product} />;
}
```

**DataLayer Output:**
```javascript
{
  event: 'view_item',
  ecommerce: {
    currency: 'USD',
    value: 1299.99,
    items: [{
      item_id: 'product-uuid',
      item_name: 'Laptop Pro',
      item_brand: 'TechBrand',
      item_category: 'Electronics',
      item_variant: '16GB RAM / 512GB SSD',
      price: 1299.99,
      sku: 'LAPTOP-001',
      stock_status: 'in_stock'
    }]
  }
}
```

---

### 3. Add to Cart (Enhanced)

```jsx
import { trackAddToCart } from '@/components/storefront/EnhancedDataLayerManager';

function AddToCartButton({ product, selectedVariant }) {
  const handleAddToCart = async () => {
    const quantity = getQuantity();

    // Add to cart
    await addToCart(product, quantity, selectedVariant);

    // Track with full product data
    trackAddToCart(product, quantity, selectedVariant);
  };

  return <button onClick={handleAddToCart}>Add to Cart</button>;
}
```

**DataLayer Output:**
```javascript
{
  event: 'add_to_cart',
  ecommerce: {
    currency: 'USD',
    value: 1299.99,
    items: [{
      item_id: 'product-uuid',
      item_name: 'Laptop Pro',
      item_brand: 'TechBrand',
      item_category: 'Electronics',
      item_variant: '16GB RAM / 512GB SSD',
      variant_id: 'variant-uuid',
      quantity: 1,
      price: 1299.99,
      sku: 'LAPTOP-001'
    }]
  }
}
```

**Backend Storage:**
```javascript
{
  activity_type: 'add_to_cart',
  product_id: 'product-uuid',
  metadata: {
    product_name: 'Laptop Pro',
    product_sku: 'LAPTOP-001',
    product_price: 1299.99,
    quantity: 1,
    variant: {
      id: 'variant-uuid',
      name: '16GB RAM / 512GB SSD',
      options: ['16GB RAM', '512GB SSD']
    },
    cart_value: 1299.99,
    currency: 'USD',
    category: 'Electronics',
    brand: 'TechBrand'
  }
}
```

---

### 4. Cart Page

```jsx
import { trackViewCart } from '@/components/storefront/EnhancedDataLayerManager';

function CartPage() {
  const { cartItems, cartTotal } = useCart();

  useEffect(() => {
    if (cartItems.length > 0) {
      trackViewCart(cartItems, cartTotal);
    }
  }, [cartItems, cartTotal]);

  return <Cart items={cartItems} />;
}
```

---

### 5. Checkout Flow (Step Tracking)

```jsx
import {
  trackBeginCheckout,
  trackCheckoutStep,
  trackAddShippingInfo,
  trackAddPaymentInfo
} from '@/components/storefront/EnhancedDataLayerManager';

function CheckoutPage() {
  const [step, setStep] = useState(1);
  const { cartItems, cartTotal } = useCart();

  // Step 1: Begin checkout
  useEffect(() => {
    trackBeginCheckout(cartItems, cartTotal);
  }, []);

  // Step 2: Shipping info
  const handleShippingSubmit = (shippingData) => {
    trackCheckoutStep(2, 'Shipping Information', cartItems, cartTotal);
    trackAddShippingInfo(
      shippingData.method,
      shippingData.cost,
      cartItems,
      cartTotal
    );
    setStep(3);
  };

  // Step 3: Payment info
  const handlePaymentSelect = (paymentMethod) => {
    trackCheckoutStep(3, 'Payment Information', cartItems, cartTotal);
    trackAddPaymentInfo(paymentMethod, cartItems, cartTotal);
    setStep(4);
  };

  // Step 4: Review
  useEffect(() => {
    if (step === 4) {
      trackCheckoutStep(4, 'Review Order', cartItems, cartTotal);
    }
  }, [step]);

  return <CheckoutSteps />;
}
```

---

### 6. Order Success Page

```jsx
import { trackPurchase } from '@/components/storefront/EnhancedDataLayerManager';

function OrderSuccessPage() {
  const { order } = useOrder();

  useEffect(() => {
    if (order) {
      trackPurchase(order);
    }
  }, [order]);

  return <OrderConfirmation order={order} />;
}
```

---

### 7. Search Results

```jsx
import { trackSearch } from '@/components/storefront/EnhancedDataLayerManager';

function SearchResults() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [filters, setFilters] = useState({});

  const handleSearch = async (searchTerm) => {
    const searchResults = await performSearch(searchTerm);
    setResults(searchResults);

    // Track search with results count and filters
    trackSearch(searchTerm, searchResults.length, filters);
  };

  return <SearchComponent onSearch={handleSearch} />;
}
```

---

### 8. Wishlist

```jsx
import { trackAddToWishlist } from '@/components/storefront/EnhancedDataLayerManager';

function WishlistButton({ product }) {
  const handleAddToWishlist = async () => {
    await addToWishlist(product);

    // Track wishlist addition
    trackAddToWishlist(product);
  };

  return <button onClick={handleAddToWishlist}>♥ Add to Wishlist</button>;
}
```

---

### 9. Promotional Banners

```jsx
import { trackPromotionView, trackPromotionClick } from '@/components/storefront/EnhancedDataLayerManager';

function PromoBanner() {
  const promotions = [
    {
      id: 'summer-sale-2025',
      name: 'Summer Sale - 50% Off',
      creative: 'Hero Banner',
      position: 'home_hero',
      url: '/sale'
    }
  ];

  useEffect(() => {
    // Track when banner is shown
    trackPromotionView(promotions);
  }, []);

  const handleBannerClick = (promo) => {
    // Track click
    trackPromotionClick(promo);

    // Navigate
    navigate(promo.url);
  };

  return <Banner onClick={() => handleBannerClick(promotions[0])} />;
}
```

---

### 10. Newsletter Signup

```jsx
import { trackNewsletterSignup } from '@/components/storefront/EnhancedDataLayerManager';

function NewsletterForm({ location = 'footer' }) {
  const handleSubmit = async (email) => {
    await subscribeToNewsletter(email);

    // Track signup
    trackNewsletterSignup(location);
  };

  return <form onSubmit={handleSubmit}>...</form>;
}
```

---

### 11. Product Filters

```jsx
import { trackFilterApplied } from '@/components/storefront/EnhancedDataLayerManager';

function ProductFilters() {
  const handleFilterChange = (filterType, value, resultsCount) => {
    // Apply filter
    applyFilter(filterType, value);

    // Track filter usage
    trackFilterApplied(filterType, value, resultsCount);
  };

  return (
    <div>
      <select onChange={(e) => handleFilterChange('price', e.target.value, results.length)}>
        <option>$0 - $100</option>
        <option>$100 - $500</option>
      </select>
    </div>
  );
}
```

---

### 12. Quick View Modal

```jsx
import { trackQuickView } from '@/components/storefront/EnhancedDataLayerManager';

function QuickViewButton({ product }) {
  const handleQuickView = () => {
    // Track quick view
    trackQuickView(product);

    // Open modal
    openQuickViewModal(product);
  };

  return <button onClick={handleQuickView}>Quick View</button>;
}
```

---

### 13. Coupon Code

```jsx
import { trackCouponApplied } from '@/components/storefront/EnhancedDataLayerManager';

function CouponForm() {
  const { cartTotal } = useCart();

  const handleApplyCoupon = async (code) => {
    const result = await applyCoupon(code);

    if (result.success) {
      // Track successful coupon application
      trackCouponApplied(
        code,
        result.discount_amount,
        cartTotal
      );
    }
  };

  return <form onSubmit={handleApplyCoupon}>...</form>;
}
```

---

### 14. Video Tracking

```jsx
import {
  trackVideoPlay,
  trackVideoProgress,
  trackVideoComplete
} from '@/components/storefront/EnhancedDataLayerManager';

function ProductVideo({ videoUrl, videoTitle }) {
  const handlePlay = () => {
    trackVideoPlay(videoTitle, videoDuration);
  };

  const handleProgress = (percent) => {
    if (percent >= 25 && percent < 30) trackVideoProgress(videoTitle, 25);
    if (percent >= 50 && percent < 55) trackVideoProgress(videoTitle, 50);
    if (percent >= 75 && percent < 80) trackVideoProgress(videoTitle, 75);
  };

  const handleComplete = () => {
    trackVideoComplete(videoTitle);
  };

  return (
    <video
      onPlay={handlePlay}
      onTimeUpdate={handleProgress}
      onEnded={handleComplete}
    />
  );
}
```

---

## 🎨 Migration from Old DataLayerManager

Replace your imports:

```jsx
// ❌ OLD
import { trackAddToCart } from '@/components/storefront/DataLayerManager';

// ✅ NEW
import { trackAddToCart } from '@/components/storefront/EnhancedDataLayerManager';
```

**OR** update DataLayerManager.jsx with the new functions (recommended).

---

## 📊 Event Reference

### Product Events

| Event | Function | When to Use |
|-------|----------|-------------|
| `view_item_list` | `trackProductImpressions(products, 'List Name')` | Category/search results shown |
| `select_item` | `trackProductClick(product, index, 'List Name')` | Product clicked from list |
| `view_item` | `trackProductView(product)` | Product detail page viewed |
| `add_to_cart` | `trackAddToCart(product, qty, variant)` | Product added to cart |
| `remove_from_cart` | `trackRemoveFromCart(product, qty)` | Product removed from cart |
| `view_cart` | `trackViewCart(cartItems, total)` | Cart page viewed |
| `add_to_wishlist` | `trackAddToWishlist(product)` | Added to wishlist |

### Checkout Events

| Event | Function | When to Use |
|-------|----------|-------------|
| `begin_checkout` | `trackBeginCheckout(items, total)` | Checkout started |
| `checkout_progress` | `trackCheckoutStep(step, name, items, total)` | Checkout step completed |
| `add_shipping_info` | `trackAddShippingInfo(method, cost, items, total)` | Shipping selected |
| `add_payment_info` | `trackAddPaymentInfo(method, items, total)` | Payment selected |
| `purchase` | `trackPurchase(order)` | Order completed |

### Engagement Events

| Event | Function | When to Use |
|-------|----------|-------------|
| `search` | `trackSearch(query, count, filters)` | Product search |
| `filter_applied` | `trackFilterApplied(type, value, count)` | Filter changed |
| `sort_applied` | `trackSortApplied(by, order)` | Sort changed |
| `quick_view` | `trackQuickView(product)` | Quick view opened |
| `size_guide_viewed` | `trackSizeGuide(product)` | Size guide opened |
| `review_submitted` | `trackReviewSubmit(product, rating)` | Review posted |
| `share` | `trackProductShare(product, platform)` | Product shared |
| `coupon_applied` | `trackCouponApplied(code, discount, total)` | Coupon used |
| `newsletter_signup` | `trackNewsletterSignup(source)` | Newsletter subscribed |
| `chat_opened` | `trackChatOpened()` | Live chat opened |

### Promotion Events

| Event | Function | When to Use |
|-------|----------|-------------|
| `view_promotion` | `trackPromotionView(promotions)` | Banner shown |
| `select_promotion` | `trackPromotionClick(promotion)` | Banner clicked |

### Video Events

| Event | Function | When to Use |
|-------|----------|-------------|
| `video_start` | `trackVideoPlay(title, duration)` | Video started |
| `video_progress` | `trackVideoProgress(title, percent)` | 25%, 50%, 75% watched |
| `video_complete` | `trackVideoComplete(title)` | Video finished |

### Special Events

| Event | Function | When to Use |
|-------|----------|-------------|
| `scroll_depth` | Auto-tracked | 25%, 50%, 75%, 90%, 100% |
| `sign_up` | `trackUserRegistration(method)` | User registered |
| `login` | `trackUserLogin(method)` | User logged in |
| `exception` | `trackError(type, message, context)` | Error occurred |
| `page_not_found` | `track404(url)` | 404 page |

---

## 🔄 Complete Category Page Example

```jsx
import {
  trackProductImpressions,
  trackProductClick,
  trackFilterApplied,
  trackSortApplied,
  trackPromotionView
} from '@/components/storefront/EnhancedDataLayerManager';

function CategoryPage({ categorySlug }) {
  const [products, setProducts] = useState([]);
  const [filters, setFilters] = useState({});
  const [sort, setSort] = useState('featured');
  const [promotions, setPromotions] = useState([]);

  // Track promotions when page loads
  useEffect(() => {
    if (promotions.length > 0) {
      trackPromotionView(promotions);
    }
  }, [promotions]);

  // Track product impressions
  useEffect(() => {
    if (products.length > 0) {
      trackProductImpressions(products, `Category - ${categorySlug}`);
    }
  }, [products]);

  // Handle product click
  const handleProductClick = (product, index) => {
    trackProductClick(product, index, `Category - ${categorySlug}`);
    navigate(`/product/${product.slug}`);
  };

  // Handle filter change
  const handleFilterChange = (type, value) => {
    const newFilters = { ...filters, [type]: value };
    setFilters(newFilters);

    // Apply filter and get results
    const filteredProducts = applyFilters(products, newFilters);

    // Track filter applied
    trackFilterApplied(type, value, filteredProducts.length);
  };

  // Handle sort change
  const handleSortChange = (sortBy) => {
    setSort(sortBy);

    // Track sort applied
    trackSortApplied(sortBy, 'asc');
  };

  return (
    <div>
      {/* Promotions */}
      <PromoBanners promotions={promotions} />

      {/* Filters */}
      <Filters onChange={handleFilterChange} />

      {/* Sort */}
      <Sort value={sort} onChange={handleSortChange} />

      {/* Products */}
      <ProductGrid
        products={products}
        onProductClick={handleProductClick}
      />
    </div>
  );
}
```

---

## 🛒 Complete Product Card Example

```jsx
import {
  trackProductClick,
  trackQuickView,
  trackAddToWishlist
} from '@/components/storefront/EnhancedDataLayerManager';

function ProductCard({ product, index, listName }) {
  const handleClick = () => {
    trackProductClick(product, index, listName);
    navigate(`/product/${product.slug}`);
  };

  const handleQuickView = (e) => {
    e.stopPropagation();
    trackQuickView(product);
    openQuickViewModal(product);
  };

  const handleWishlist = (e) => {
    e.stopPropagation();
    trackAddToWishlist(product);
    addToWishlist(product);
  };

  return (
    <div onClick={handleClick}>
      <img src={product.image} />
      <h3>{product.name}</h3>
      <p>${product.price}</p>
      <button onClick={handleQuickView}>Quick View</button>
      <button onClick={handleWishlist}>♥</button>
    </div>
  );
}
```

---

## 🎯 GTM Integration

### GA4 Configuration

In Google Tag Manager, these events map directly to GA4:

| DataLayer Event | GA4 Event |
|-----------------|-----------|
| `view_item_list` | View Item List |
| `select_item` | Select Item |
| `view_item` | View Item |
| `add_to_cart` | Add to Cart |
| `remove_from_cart` | Remove from Cart |
| `view_cart` | View Cart |
| `begin_checkout` | Begin Checkout |
| `add_shipping_info` | Add Shipping Info |
| `add_payment_info` | Add Payment Info |
| `purchase` | Purchase |
| `view_promotion` | View Promotion |
| `select_promotion` | Select Promotion |

**No GTM configuration needed!** Event names match GA4 standards.

---

## 📈 Data Stored in Backend

### Customer Activity Table

All events stored with enhanced metadata:

```sql
SELECT
  activity_type,
  product_id,
  metadata->>'product_name' as product_name,
  metadata->>'quantity' as quantity,
  metadata->>'cart_value' as cart_value,
  metadata->>'variant' as variant_info,
  created_at
FROM customer_activities
WHERE activity_type = 'add_to_cart'
ORDER BY created_at DESC;
```

### Available in Admin

View in `/admin/customer-activity`:
- Filter by event type
- See full product details
- View variant information
- Export for analysis

---

## 🔍 Comparison with Anowave

### Anowave Features vs Your Implementation

| Feature | Anowave | Your System |
|---------|---------|-------------|
| Product Impressions | ✅ | ✅ |
| Product Clicks | ✅ | ✅ |
| Enhanced Product Data | ✅ | ✅ (brand, SKU, variant, stock) |
| Add to Cart Tracking | ✅ | ✅ (with full product data) |
| Remove from Cart | ✅ | ✅ (with full product data) |
| Checkout Steps | ✅ | ✅ (all steps tracked) |
| Purchase Tracking | ✅ | ✅ (with tax, shipping, coupon) |
| Promotion Tracking | ✅ | ✅ |
| User Engagement | ✅ | ✅ (30+ events) |
| Backend Storage | ❌ | ✅ (unified event bus) |
| A/B Testing | ❌ | ✅ |
| GDPR Compliance | Partial | ✅ (full consent integration) |

**You have MORE features than Anowave!**

---

## 🎉 Summary

Your analytics now tracks:

✅ **30+ Events** covering all ecommerce scenarios
✅ **Enhanced Product Data** (brand, SKU, variant, stock status)
✅ **Category List Tracking** (product impressions)
✅ **Complete Checkout Funnel** (all steps)
✅ **Promotion Tracking** (view + click)
✅ **User Engagement** (wishlist, reviews, share, filters)
✅ **Video Tracking** (play, progress, complete)
✅ **Error Tracking** (404s, exceptions)
✅ **Auto Scroll Tracking** (depth milestones)

**All events are:**
- Pushed to window.dataLayer (GTM ready)
- Sent to backend (stored in database)
- GDPR compliant (consent-aware)
- Viewable in `/admin/customer-activity`

Your tracking is now as comprehensive as (or better than) Anowave! 🚀
