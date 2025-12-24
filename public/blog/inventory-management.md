# Inventory and Stock Management

Keep track of your inventory, prevent overselling, and optimize stock levels for maximum efficiency.

---

## Overview

Effective inventory management helps you:
- Avoid stockouts and lost sales
- Prevent overselling
- Optimize cash flow
- Improve fulfillment speed
- Make better purchasing decisions

---

## Inventory Basics

### Stock Tracking

Enable inventory tracking:

1. Go to **Catalog > Products**
2. Edit product
3. Go to **Inventory** tab
4. Enable **Track Inventory**
5. Set stock quantity

### Inventory Fields

| Field | Purpose |
|-------|---------|
| Stock Quantity | Current available units |
| Low Stock Threshold | Alert level |
| Allow Backorders | Sell when out of stock |
| Stock Status | In stock, Out of stock |

### Stock Status Options

| Status | Behavior |
|--------|----------|
| In Stock | Available for purchase |
| Out of Stock | Cannot purchase |
| On Backorder | Purchase, ships later |
| Pre-order | Purchase before available |

---

## Setting Up Inventory

### Product-Level Settings

For each product:

1. Edit product
2. Navigate to **Inventory**
3. Configure:

| Setting | Recommendation |
|---------|----------------|
| Track inventory | Enable |
| Quantity | Set current stock |
| Low stock alert | 10-20% of typical order |
| Allow backorders | Based on supplier capability |

### Variant Inventory

For products with variants:
- Each variant has separate stock
- Track by size, color, etc.
- View combined total

**Example**:
```
T-Shirt (Total: 150)
  - Small/Blue: 25
  - Medium/Blue: 30
  - Large/Blue: 20
  - Small/Red: 25
  - Medium/Red: 30
  - Large/Red: 20
```

---

## Stock Adjustments

### Manual Adjustments

Update stock manually:

1. Go to product
2. Click **Adjust Stock**
3. Enter:
   - Adjustment type (add/remove/set)
   - Quantity
   - Reason

### Adjustment Reasons

| Reason | When to Use |
|--------|-------------|
| Received | New inventory arrived |
| Returned | Customer return |
| Damaged | Unusable inventory |
| Theft/Loss | Missing inventory |
| Correction | Fix counting error |
| Transfer | Move between locations |

### Adjustment History

Track all changes:
- Who made change
- When changed
- Previous value
- New value
- Reason

---

## Bulk Inventory Updates

### CSV Import

Update many products at once:

1. Go to **Catalog > Import**
2. Select **Inventory Update**
3. Download template
4. Fill in SKU and quantity
5. Upload file

**Template format**:
```csv
sku,quantity,low_stock_threshold
SKU-001,50,10
SKU-002,100,20
SKU-003,0,5
```

### Bulk Edit

From product list:
1. Select products
2. Click **Bulk Edit**
3. Choose **Inventory**
4. Set new values
5. Apply

---

## Low Stock Alerts

### Setting Thresholds

Configure alerts:

1. Go to **Settings > Inventory**
2. Set default threshold
3. Or set per product

### Alert Options

| Alert | Channel |
|-------|---------|
| Email | To specified addresses |
| Dashboard | Badge notification |
| Report | Daily low stock report |

### Viewing Low Stock

1. Go to **Catalog > Products**
2. Filter by **Low Stock**
3. See all items below threshold

---

## Inventory Reports

### Stock Reports

| Report | Shows |
|--------|-------|
| Current Stock | All products with quantities |
| Low Stock | Items below threshold |
| Out of Stock | Zero inventory items |
| Stock Value | Inventory value at cost |
| Stock Movement | Changes over time |

### Generating Reports

1. Go to **Analytics > Inventory**
2. Select report type
3. Set date range
4. Filter as needed
5. Export if needed

### Stock Value

Calculate inventory value:
```
Stock Value = Quantity x Cost Price
```

Useful for:
- Financial reporting
- Insurance purposes
- Purchasing decisions

---

## Backorders

### Enabling Backorders

Allow purchases when out of stock:

1. Edit product
2. Enable **Allow Backorders**
3. Choose option:
   - Allow, notify customer
   - Allow, don't notify
   - Do not allow

### Backorder Management

Track backorders:
1. Go to **Orders**
2. Filter by **Backordered**
3. See orders waiting for stock

### Fulfilling Backorders

When stock arrives:
1. Update inventory
2. Process backordered orders
3. Ship and notify customers

---

## Multiple Locations

### Location Setup

For multiple warehouses:

1. Go to **Settings > Locations**
2. Add locations:
   - Name
   - Address
   - Priority

### Inventory by Location

Track stock per location:

| Product | Warehouse A | Warehouse B | Total |
|---------|-------------|-------------|-------|
| Blue Tee | 50 | 30 | 80 |
| Red Tee | 25 | 45 | 70 |

### Fulfillment Rules

Set which location ships:
- Nearest to customer
- Highest stock
- Specific priority
- Manual selection

---

## Inventory Sync

### Marketplace Sync

Sync with selling channels:

| Channel | Sync |
|---------|------|
| Amazon | Bi-directional |
| eBay | Bi-directional |
| Shopify | Import/export |
| POS | Real-time |

### Sync Settings

Configure per channel:
- Sync frequency
- Stock buffer (safety stock)
- Which products sync

### Buffer Stock

Reserve inventory:
```
Available Stock = Total Stock - Buffer

Total: 100
Buffer: 10
Available: 90
```

Prevents overselling across channels.

---

## Reorder Management

### Reorder Points

Set when to reorder:

| Field | Purpose |
|-------|---------|
| Reorder Point | When to order more |
| Reorder Quantity | How much to order |
| Lead Time | Days until delivery |

### Reorder Alerts

Get notified to reorder:
1. Go to **Settings > Inventory**
2. Enable reorder alerts
3. Set notification method
4. Configure per product

### Suggested Orders

System suggests orders based on:
- Current stock
- Sales velocity
- Lead time
- Reorder point

---

## Inventory Valuation

### Valuation Methods

| Method | Description |
|--------|-------------|
| FIFO | First in, first out |
| LIFO | Last in, first out |
| Average Cost | Weighted average |

### Setting Valuation

1. Go to **Settings > Inventory**
2. Choose valuation method
3. Apply to existing inventory

### Cost Tracking

Track product costs:
- Purchase cost
- Landing cost (shipping, duties)
- Average cost over time

---

## Cycle Counting

### What Is Cycle Counting?

Regular inventory verification:
- Count portion of inventory regularly
- More accurate than annual count
- Less disruptive to operations

### Setting Up Counts

1. Go to **Inventory > Cycle Counts**
2. Create count schedule
3. Assign products to cycles
4. Generate count sheets

### Performing Counts

1. Print count sheet
2. Physically count items
3. Enter counts
4. Review discrepancies
5. Adjust inventory

---

## Best Practices

### Stock Management

1. **Set realistic thresholds** - Based on sales velocity
2. **Regular counts** - Verify accuracy
3. **Track all movements** - Reason for every change
4. **Use safety stock** - Buffer for uncertainty
5. **Review regularly** - Monthly stock analysis

### Preventing Issues

| Issue | Prevention |
|-------|------------|
| Overselling | Real-time sync, buffers |
| Stockouts | Low stock alerts |
| Dead stock | Regular review, markdowns |
| Shrinkage | Security, cycle counts |

### Optimization

1. **ABC analysis** - Prioritize high-value items
2. **Demand forecasting** - Predict needs
3. **Supplier management** - Reliable lead times
4. **Just-in-time** - Reduce holding costs
5. **Automation** - Reduce manual errors

---

## Troubleshooting

### Inventory Discrepancies

**Causes**:
- Counting errors
- Unreported damage
- Theft
- System bugs
- Sync issues

**Solutions**:
- Perform physical count
- Review adjustment history
- Check sync logs
- Investigate patterns

### Overselling

**Immediate**:
- Contact affected customers
- Offer alternatives or refund
- Update inventory

**Prevention**:
- Enable stock tracking
- Set buffer stock
- Real-time sync
- Low stock alerts

### Sync Issues

**Check**:
- Connection status
- API limits
- Mapping correct
- Logs for errors

---

## Reports and Analytics

### Key Metrics

| Metric | Formula |
|--------|---------|
| Turnover Rate | Cost of Goods Sold / Average Inventory |
| Days of Supply | Current Stock / Daily Sales |
| Stockout Rate | Stockout Days / Total Days |
| Fill Rate | Orders Fulfilled / Total Orders |

### Inventory Dashboard

View at a glance:
- Total stock value
- Low stock items
- Out of stock count
- Turnover trends

---

## Next Steps

After setting up inventory:

1. **Enable tracking** - All products tracked
2. **Set thresholds** - Low stock alerts
3. **Connect channels** - Sync with marketplaces
4. **Schedule counts** - Regular verification
5. **Monitor reports** - Weekly review

See our Building Plugins guide for custom integrations.
