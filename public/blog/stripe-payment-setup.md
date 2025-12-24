# Configuring Payments with Stripe

Accept credit cards, Apple Pay, Google Pay, and more with Stripe. This guide walks you through the complete setup process.

---

## Overview

Stripe is the recommended payment provider for DainoStore. It offers:
- Credit and debit card processing
- Digital wallets (Apple Pay, Google Pay)
- Local payment methods
- Automatic fraud prevention
- PCI compliance built-in

**Setup time**: 15-30 minutes

---

## What You Need

Before starting, prepare:

1. **Business information**
   - Business name and address
   - Tax ID or EIN (for US businesses)
   - Business type (sole proprietor, LLC, etc.)

2. **Bank account**
   - Account for receiving payouts
   - Routing and account numbers

3. **Personal identification**
   - Owner/representative details
   - ID verification may be required

---

## Step 1: Create a Stripe Account

### If You Don't Have Stripe

1. Go to [stripe.com](https://stripe.com)
2. Click **Start now**
3. Enter email and create password
4. Verify your email
5. Complete account setup

### Complete Your Profile

Stripe requires business verification:

1. Log into [Stripe Dashboard](https://dashboard.stripe.com)
2. Go to **Settings > Account details**
3. Fill in:
   - Business name
   - Business address
   - Business type
   - Industry/category
4. Add bank account for payouts
5. Verify identity if prompted

---

## Step 2: Connect Stripe to DainoStore

### Using Stripe Connect

DainoStore uses Stripe Connect for secure integration:

1. Go to **Settings > Payment Providers**
2. Click **Connect with Stripe**
3. You'll be redirected to Stripe
4. Review permissions and click **Authorize**
5. Return to DainoStore

### Verify Connection

After connecting:
- Status shows "Connected"
- Stripe account ID appears
- Test mode toggle is available

---

## Step 3: Configure Payment Settings

### Payment Methods

Enable the methods you want to accept:

| Method | Best For | Fees |
|--------|----------|------|
| Cards | All customers | 2.9% + $0.30 |
| Apple Pay | iOS users | Same as cards |
| Google Pay | Android users | Same as cards |
| Link | Returning customers | Same as cards |

To enable:
1. Go to **Settings > Payment Providers**
2. Click on **Stripe**
3. Toggle desired payment methods
4. Save changes

### Currency Settings

Configure your store currency:
1. Go to **Settings > General**
2. Set **Store Currency** (e.g., USD, EUR, GBP)
3. Enable multi-currency if needed

### Statement Descriptor

What appears on customer bank statements:
- Maximum 22 characters
- Use your business name
- Example: "YOURSTORE.COM"

---

## Step 4: Test Your Integration

### Enable Test Mode

Before going live:
1. Go to **Settings > Payment Providers**
2. Toggle **Test Mode** on
3. Use test card numbers for orders

### Test Card Numbers

| Card | Number | Result |
|------|--------|--------|
| Visa | 4242 4242 4242 4242 | Success |
| Visa (3D Secure) | 4000 0025 0000 3155 | Requires auth |
| Mastercard | 5555 5555 5555 4444 | Success |
| Declined | 4000 0000 0000 9995 | Insufficient funds |

Use any future date for expiry and any 3 digits for CVC.

### Place Test Orders

1. Add products to cart
2. Proceed to checkout
3. Enter test card details
4. Complete purchase
5. Verify order appears in admin

---

## Step 5: Go Live

### Disable Test Mode

When ready for real transactions:
1. Ensure Stripe account is fully verified
2. Go to **Settings > Payment Providers**
3. Toggle **Test Mode** off
4. Confirm the switch

### Pre-Launch Checklist

- [ ] Stripe account verified
- [ ] Bank account added for payouts
- [ ] Tax settings configured
- [ ] Refund policy published
- [ ] Test orders completed successfully
- [ ] Real card test (small amount, refund immediately)

---

## Understanding Stripe Fees

### Standard Pricing

| Type | Fee |
|------|-----|
| Card payments | 2.9% + $0.30 |
| International cards | +1.5% |
| Currency conversion | +1% |
| Disputes/chargebacks | $15 per dispute |

### Example Calculation

```
Order: $50.00
Card fee: (50 × 2.9%) + $0.30 = $1.75
You receive: $48.25
```

### Reducing Fees

- Encourage ACH/bank payments (0.8% capped at $5)
- Volume discounts available (contact Stripe)
- Pass fees to customers (if allowed in your region)

---

## Handling Payouts

### Payout Schedule

| Setting | When You Receive |
|---------|------------------|
| Standard | 2 business days |
| Weekly | Every Monday |
| Monthly | First of month |
| Manual | When you request |

Configure in Stripe Dashboard under **Settings > Payouts**.

### Minimum Payout

Default minimum is $1. Balances below this carry over.

### Payout Failures

If a payout fails:
1. Stripe notifies you
2. Check bank account details
3. Update if needed
4. Payout retries automatically

---

## Managing Disputes

### What Are Disputes?

Chargebacks occur when customers:
- Don't recognize the charge
- Claim item not received
- Report fraud

### Dispute Process

1. Stripe notifies you of dispute
2. Review order and evidence
3. Submit response in Stripe Dashboard
4. Wait for bank decision (60-90 days)

### Preventing Disputes

- Use clear statement descriptor
- Send tracking information
- Respond to customer inquiries quickly
- Require signature for high-value orders
- Keep good records

---

## Advanced Features

### Automatic Tax

Let Stripe calculate sales tax:
1. Go to Stripe Dashboard
2. Enable **Tax** feature
3. Configure tax settings in DainoStore
4. Tax added automatically at checkout

### Radar (Fraud Prevention)

Stripe Radar protects against fraud:
- Machine learning fraud detection
- Automatic blocking of suspicious cards
- Review rules customization

Included free with standard pricing.

### Customer Portal

Allow customers to manage payment methods:
- Save cards for faster checkout
- View billing history
- Update payment information

---

## Troubleshooting

### Connection Issues

**"Unable to connect to Stripe"**
- Check internet connection
- Verify Stripe account is active
- Try disconnecting and reconnecting

### Payment Failures

**"Card declined"**
- Customer should contact their bank
- Try a different card
- Check for fraud flags

**"Invalid card number"**
- Verify card details entered correctly
- Check card hasn't expired
- Try refreshing the page

### Payout Issues

**"Payout pending"**
- First payout may take 7-14 days
- Complete account verification
- Ensure bank details are correct

---

## Security Best Practices

1. **Never share API keys** - Keep secret keys private
2. **Use webhooks** - Real-time payment updates
3. **Enable 3D Secure** - Extra authentication layer
4. **Monitor dashboard** - Review transactions regularly
5. **Set up alerts** - Get notified of suspicious activity

---

## Common Questions

**Q: Can I use PayPal too?**
A: Yes, multiple payment providers can be active simultaneously.

**Q: What about PCI compliance?**
A: Stripe handles PCI compliance. Your store never touches card data.

**Q: How do I refund a payment?**
A: From the order page, click Refund. It processes through Stripe automatically.

**Q: Can I accept cryptocurrency?**
A: Not through Stripe directly. Consider additional payment providers.

---

## Next Steps

After setting up payments:

1. **Configure shipping** - Delivery methods and rates
2. **Set up taxes** - Tax rules for your regions
3. **Test checkout** - Complete test orders
4. **Go live** - Start accepting real payments

Need help? Visit **Settings > Help** for support options.
