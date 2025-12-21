# Conversion Guide: heatmap.js and payments.js

## Remaining Files (2 files - 16 model uses)

These are the final 2 files requiring Sequelize to Supabase conversion. Both are complex and require special handling.

---

## 1. heatmap.js (12 model uses) - Analytics Endpoints

### Current Status:
- ✅ `/api/heatmap/track` - Working (uses eventBus, no models)
- ✅ `/api/heatmap/track-batch` - Working (uses eventBus, no models)
- ❌ Analytics endpoints - Use Sequelize models with static methods

### Model Uses:
1. `HeatmapInteraction.getHeatmapData()` - Static method (line 167)
2. `HeatmapSession.getSessionAnalytics()` - Static method (line 204)
3. `HeatmapInteraction.findAll()` with aggregations (line 233)
4. `HeatmapInteraction.sequelize.fn()` - COUNT, DISTINCT (lines 242-243)
5. `HeatmapInteraction.getHeatmapSummary()` - Static method with raw SQL (line 283)
6. `HeatmapSession.getTopPages()` - Static method (line 320)
7. `HeatmapInteraction.findAll()` for interaction list (line 382)
8. `HeatmapInteraction.findAll()` with complex aggregations (line 440)
9. Multiple `HeatmapInteraction.sequelize.fn()` calls (lines 448-451)
10. `HeatmapInteraction.sequelize.fn()` in ORDER BY (line 454)
11. `HeatmapInteraction.findAll()` for sessions (line 510)
12. Uses `connection.models` destructuring in multiple places

### Conversion Strategy:

#### Step 1: Inline Static Methods
Replace static method calls with direct Supabase queries in the route:

```javascript
// OLD
const heatmapData = await HeatmapInteraction.getHeatmapData(storeId, pageUrl, options);

// NEW
const tenantDb = await ConnectionManager.getStoreConnection(storeId);

let query = tenantDb
  .from('heatmap_interactions')
  .select('x_coordinate, y_coordinate, viewport_width, viewport_height, interaction_type, device_type, time_on_element, timestamp_utc')
  .eq('store_id', storeId)
  .eq('page_url', pageUrl)
  .in('interaction_type', interactionTypes)
  .in('device_type', deviceTypes)
  .order('timestamp_utc', { ascending: false });

if (startDate) {
  query = query.gte('timestamp_utc', startDate.toISOString());
}
if (endDate) {
  query = query.lte('timestamp_utc', endDate.toISOString());
}

const { data: interactions } = await query;

// Normalize coordinates in JavaScript
const heatmapData = interactions.map(interaction => {
  const scaleX = viewportWidth / interaction.viewport_width;
  const scaleY = viewportHeight / interaction.viewport_height;
  return {
    ...interaction,
    normalized_x: Math.round(interaction.x_coordinate * scaleX),
    normalized_y: Math.round(interaction.y_coordinate * scaleY)
  };
});
```

#### Step 2: Convert Aggregations to RPC or Multiple Queries
For complex aggregations like getHeatmapSummary(), either:

**Option A: Use Supabase RPC (Postgres Function)**
```sql
CREATE OR REPLACE FUNCTION get_heatmap_summary(
  p_store_id UUID,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ,
  p_group_by TEXT
)
RETURNS TABLE (
  page_url TEXT,
  interaction_type TEXT,
  interaction_count BIGINT,
  unique_sessions BIGINT,
  avg_time_on_element NUMERIC,
  desktop_count BIGINT,
  mobile_count BIGINT,
  tablet_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    page_url,
    interaction_type,
    COUNT(*) as interaction_count,
    COUNT(DISTINCT session_id) as unique_sessions,
    AVG(time_on_element) as avg_time_on_element,
    COUNT(CASE WHEN device_type = 'desktop' THEN 1 END) as desktop_count,
    COUNT(CASE WHEN device_type = 'mobile' THEN 1 END) as mobile_count,
    COUNT(CASE WHEN device_type = 'tablet' THEN 1 END) as tablet_count
  FROM heatmap_interactions
  WHERE store_id = p_store_id
    AND timestamp_utc BETWEEN p_start_date AND p_end_date
  GROUP BY page_url, interaction_type
  ORDER BY interaction_count DESC;
END;
$$ LANGUAGE plpgsql;
```

Then call from Supabase:
```javascript
const { data } = await tenantDb.rpc('get_heatmap_summary', {
  p_store_id: storeId,
  p_start_date: startDate.toISOString(),
  p_end_date: endDate.toISOString(),
  p_group_by: groupBy
});
```

**Option B: Fetch and Aggregate in JavaScript**
```javascript
// Fetch all interactions
const { data: interactions } = await tenantDb
  .from('heatmap_interactions')
  .select('page_url, interaction_type, session_id, time_on_element, device_type')
  .eq('store_id', storeId)
  .gte('timestamp_utc', startDate.toISOString())
  .lte('timestamp_utc', endDate.toISOString());

// Group and aggregate in JavaScript
const summary = {};
interactions.forEach(i => {
  const key = `${i.page_url}:${i.interaction_type}`;
  if (!summary[key]) {
    summary[key] = {
      page_url: i.page_url,
      interaction_type: i.interaction_type,
      interaction_count: 0,
      unique_sessions: new Set(),
      time_sum: 0,
      desktop_count: 0,
      mobile_count: 0,
      tablet_count: 0
    };
  }
  summary[key].interaction_count++;
  summary[key].unique_sessions.add(i.session_id);
  summary[key].time_sum += i.time_on_element || 0;
  summary[key][`${i.device_type}_count`]++;
});

// Convert to array and calculate averages
const result = Object.values(summary).map(s => ({
  ...s,
  unique_sessions: s.unique_sessions.size,
  avg_time_on_element: s.interaction_count > 0 ? s.time_sum / s.interaction_count : 0
}));
```

### Recommendation:
Use **Option A (RPC)** for better performance on large datasets.

---

## 2. payments.js (4 model uses) - Critical Payment Processing

### Current Status:
- Uses Sequelize models: Order, OrderItem, Product, Store, Customer
- Uses Sequelize transactions: `sequelize.transaction()`
- Purpose: Stripe webhook handlers, order creation

### Model Uses:
1. Line 1360: Stripe checkout.session.completed webhook
2. Line 1932: Stripe Connect webhook
3. Line 2326: createPreliminaryOrder() function
4. Line 2522: createOrderFromCheckoutSession() function

### Critical Issue:
All 4 uses are in **transactional contexts** - Sequelize transactions ensure atomicity when creating orders with multiple OrderItems.

### Conversion Strategy:

#### Challenge: Supabase Transactions
Supabase doesn't support multi-statement transactions via the JavaScript client. Options:

**Option A: Use Postgres Transaction via RPC**
Create a stored procedure that handles the entire order creation atomically.

**Option B: Sequential Operations with Error Recovery**
```javascript
// OLD (Sequelize with transaction)
const transaction = await sequelize.transaction();
try {
  const order = await Order.create({ ...orderData }, { transaction });
  await OrderItem.bulkCreate(items, { transaction });
  await transaction.commit();
} catch (error) {
  await transaction.rollback();
  throw error;
}

// NEW (Supabase with error recovery)
let orderId = null;
try {
  // 1. Create order
  const { data: order, error: orderError } = await tenantDb
    .from('orders')
    .insert(orderData)
    .select()
    .single();

  if (orderError) throw orderError;
  orderId = order.id;

  // 2. Create order items
  const itemsData = items.map(item => ({ ...item, order_id: orderId }));
  const { error: itemsError } = await tenantDb
    .from('order_items')
    .insert(itemsData);

  if (itemsError) throw itemsError;

  return order;
} catch (error) {
  // Cleanup on error
  if (orderId) {
    await tenantDb.from('orders').delete().eq('id', orderId);
  }
  throw error;
}
```

**Option C: Accept Eventual Consistency**
If partial order creation is acceptable temporarily, use sequential operations without rollback.

### Recommendation:
Use **Option B (Sequential with cleanup)** for simplicity, or **Option A (RPC)** for true atomicity.

### Specific Conversions Needed:

#### 1. Order.findOne() → Supabase
```javascript
const { data: existingOrder } = await tenantDb
  .from('orders')
  .select('*')
  .eq('payment_reference', session.id)
  .maybeSingle();
```

#### 2. Order.create() → Supabase
```javascript
const { data: order, error } = await tenantDb
  .from('orders')
  .insert({
    store_id,
    customer_id,
    order_number,
    // ... all order fields
  })
  .select()
  .single();
```

#### 3. OrderItem.bulkCreate() → Supabase
```javascript
const orderItems = items.map(item => ({
  order_id: order.id,
  product_id: item.product_id,
  quantity: item.quantity,
  // ... all item fields
}));

const { error: itemsError } = await tenantDb
  .from('order_items')
  .insert(orderItems);
```

#### 4. Product.findByPk() → Supabase
```javascript
const { data: product } = await tenantDb
  .from('products')
  .select('*')
  .eq('id', productId)
  .single();
```

#### 5. Customer.findOne() → Supabase
```javascript
const { data: customer } = await tenantDb
  .from('customers')
  .select('*')
  .eq('id', customerId)
  .maybeSingle();
```

---

## Testing Checklist

### After Converting heatmap.js:
- [ ] Test `/api/heatmap/data` endpoint
- [ ] Test `/api/heatmap/analytics` endpoint
- [ ] Test `/api/heatmap/stats` endpoint
- [ ] Verify aggregation results match previous behavior

### After Converting payments.js:
- [ ] Test Stripe checkout webhook (create test payment)
- [ ] Verify order creation in database
- [ ] Verify order items are created
- [ ] Test partial failure scenarios (cleanup works)
- [ ] Verify no duplicate orders on retries

---

## Estimated Effort

- **heatmap.js**: 4-5 hours
  - Extract 4 static methods
  - Rewrite 6 aggregation queries
  - Test analytics endpoints

- **payments.js**: 3-4 hours
  - Remove transaction dependencies
  - Implement error recovery
  - Extensive testing with Stripe

**Total**: ~7-9 hours for complete conversion

---

## Priority

1. **payments.js** - HIGH (critical for revenue)
2. **heatmap.js** - MEDIUM (analytics, not critical)

Recommend converting payments.js first to ensure payment processing stability.
