# Managing Orders Like a Pro

Master your order workflow, from processing new orders to handling refunds and keeping customers informed every step of the way.

---

## Overview

Efficient order management keeps customers happy and your business running smoothly. This guide covers the complete order lifecycle.

**What you'll learn:**
- Processing new orders
- Updating order status
- Handling refunds and cancellations
- Automating order communications
- Troubleshooting common issues

---

## Order Workflow

A typical order follows this path:

```
New Order
    |
Pending Payment (if not prepaid)
    |
Processing
    |
Shipped
    |
Delivered
```

Each status triggers specific actions and customer notifications.

---

## Processing New Orders

### Finding New Orders

1. Go to **Orders** in the admin panel
2. Filter by **Status: New**
3. Orders are sorted by date (newest first)

### Order Details

Click any order to see:

| Section | Information |
|---------|-------------|
| Customer | Name, email, phone |
| Items | Products, quantities, prices |
| Shipping | Delivery address, method |
| Payment | Method, status, transaction ID |
| Notes | Customer comments, internal notes |

### Quick Actions

From the order list, you can:
- Mark as processing
- Mark as shipped
- Print packing slip
- Print invoice
- Send customer email

---

## Updating Order Status

### Status Options

| Status | Meaning | When to Use |
|--------|---------|-------------|
| New | Just received | Automatically set |
| Pending Payment | Awaiting payment | Unpaid orders |
| Processing | Being prepared | After payment confirmed |
| Shipped | In transit | After handoff to carrier |
| Delivered | Received by customer | After delivery confirmation |
| Completed | Finalized | Order fulfilled |
| Cancelled | Cancelled | Customer or admin cancelled |
| Refunded | Money returned | After refund processed |

### Changing Status

1. Open the order
2. Click the status dropdown
3. Select new status
4. Add optional notes
5. Click **Update**

Customer notification is sent automatically (if enabled).

### Bulk Status Updates

For multiple orders:
1. Select orders using checkboxes
2. Click **Bulk Actions**
3. Choose **Update Status**
4. Select the new status
5. Confirm

---

## Shipping and Tracking

### Adding Tracking Information

1. Open the order
2. Go to **Shipping** section
3. Enter:
   - Carrier (UPS, FedEx, USPS, etc.)
   - Tracking number
   - Estimated delivery date (optional)
4. Click **Save**

### Automatic Tracking Emails

When you add tracking:
- Customer receives "Order Shipped" email
- Email includes tracking link
- Status updates to "Shipped"

### Supported Carriers

DainoStore auto-generates tracking links for:
- UPS
- FedEx
- USPS
- DHL
- Royal Mail
- Canada Post
- Australia Post
- Custom carriers (enter tracking URL)

---

## Handling Refunds

### Full Refunds

1. Open the order
2. Click **Refund** button
3. Select **Full Refund**
4. Add refund reason
5. Click **Process Refund**

The payment provider (Stripe) processes the refund automatically.

### Partial Refunds

1. Open the order
2. Click **Refund**
3. Enter the refund amount
4. Specify which items (optional)
5. Add reason
6. Process

### Refund Timeline

| Payment Method | Refund Time |
|----------------|-------------|
| Credit Card | 5-10 business days |
| PayPal | 3-5 business days |
| Bank Transfer | 3-7 business days |

### Restocking Options

When refunding, choose:
- **Restock items**: Return items to inventory
- **Don't restock**: Item damaged/returned differently

---

## Cancellations

### Customer-Requested Cancellation

1. Verify order hasn't shipped
2. Open the order
3. Click **Cancel Order**
4. Process refund (if paid)
5. Confirm cancellation

### Automatic Cancellation

Set up rules in **Settings > Orders**:
- Cancel unpaid orders after X days
- Cancel pending orders automatically
- Send cancellation notification

### Prevention Tips

- Offer order editing window
- Provide self-service cancellation in customer portal
- Confirm orders before processing high-value items

---

## Order Communication

### Email Types

| Email | Trigger | Content |
|-------|---------|---------|
| Order Confirmation | Order placed | Order details, summary |
| Payment Received | Payment confirmed | Thank you, next steps |
| Order Processing | Status changed | Currently preparing |
| Order Shipped | Tracking added | Tracking link, ETA |
| Order Delivered | Delivery confirmed | Review request |

### Customizing Emails

1. Go to **Settings > Email Templates**
2. Select email type
3. Edit subject and content
4. Use variables: `{order_number}`, `{customer_name}`
5. Preview and save

### Resending Emails

To resend any order email:
1. Open the order
2. Click **Actions** menu
3. Select **Resend Email**
4. Choose email type
5. Send

---

## Order Notes

### Internal Notes

Add notes visible only to your team:
1. Open order
2. Scroll to **Notes** section
3. Add note with **Internal** checked
4. Save

Use for:
- Special handling instructions
- Customer requests
- Issue tracking

### Customer-Visible Notes

Notes shown to customer:
- Uncheck "Internal" when adding
- Appears in order emails
- Visible in customer account

---

## Order Reports

### Available Reports

Go to **Analytics > Orders** for:

| Report | Shows |
|--------|-------|
| Daily Orders | Volume trends |
| Revenue | Sales by period |
| Order Value | Average order value |
| Products | Top selling items |
| Fulfillment | Processing times |

### Export Orders

1. Go to **Orders**
2. Filter by date/status
3. Click **Export**
4. Choose format (CSV, Excel)
5. Download

---

## Common Issues and Solutions

### Payment Failed

**Symptom**: Order shows "Payment Failed"

**Solution**:
1. Check payment gateway logs
2. Contact customer for alternative payment
3. Resend payment link
4. Or cancel order

### Wrong Address

**Before shipping**:
1. Edit order
2. Update shipping address
3. Note the change
4. Proceed normally

**After shipping**:
1. Contact carrier for redirect
2. If not possible, arrange re-shipment
3. Consider covering costs

### Stock Issues

**Symptom**: Ordered item now out of stock

**Solution**:
1. Contact customer immediately
2. Offer alternatives:
   - Wait for restock
   - Substitute product
   - Partial fulfillment + refund
   - Full cancellation

---

## Automation Tips

### Save Time With

**Order Rules**:
- Auto-mark paid orders as "Processing"
- Auto-archive completed orders after 30 days
- Auto-cancel unpaid orders after 7 days

**Quick Actions**:
- Set up keyboard shortcuts
- Use bulk operations
- Create saved filters

**Integrations**:
- Connect shipping providers for auto-tracking
- Use fulfillment services
- Sync with inventory management

---

## Best Practices

1. **Process orders daily** - Same-day processing improves satisfaction
2. **Keep customers informed** - Send updates at each step
3. **Document everything** - Use notes for special situations
4. **Handle issues fast** - Quick resolution builds trust
5. **Monitor metrics** - Track processing times and issues

---

## Next Steps

- Set up **email templates** for consistent communication
- Configure **shipping methods** for accurate delivery estimates
- Enable **order notifications** to stay on top of new orders
- Review **automation settings** to streamline workflow

Need help? Check our support resources in **Settings > Help**.
