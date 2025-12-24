# 🏷️ How to Sell Your Products on eBay

**Reach millions of buyers worldwide by listing your products on eBay - one of the world's largest online marketplaces.**

With DainoStore's Marketplace Hub, you can create professional eBay listings in minutes, complete with AI-enhanced descriptions that sell!

---

## ⏱️ **Quick Facts**

- **Setup Time:** 10-15 minutes (one-time)
- **Export Time:** 5-20 minutes depending on catalog size
- **Cost:** Uses AI credits for optimization (optional)
- **Difficulty:** Easy - we'll walk you through it!

---

## 🎯 **What You'll Accomplish**

By the end of this guide, you'll be able to:
- ✅ Connect your store to eBay
- ✅ Create listings with AI-optimized descriptions
- ✅ Export products in bulk
- ✅ Manage everything from one dashboard

---

## 📋 **What You Need to Get Started**

You'll need an **eBay Seller Account** and **eBay Developer Account**.

### **Don't have these yet?**

**eBay Seller Account:**
1. Go to [eBay](https://www.ebay.com)
2. Click **"Sell"** in top navigation
3. Click **"Create an eBay account"**
4. Complete registration (free for individuals, fees apply when you sell)

**eBay Developer Account:**
1. Go to [eBay Developers Program](https://developer.ebay.com)
2. Click **"Join Now"** or **"Sign In"**
3. Sign in with your eBay seller account
4. Accept the Developer Terms
5. You're now a developer! (No coding required)

---

## 🔑 **Step 1: Get Your eBay API Credentials**

You need 4 credentials from eBay. Follow these steps carefully:

### **Create an Application**

1. Log in to [eBay Developer Console](https://developer.ebay.com/my/keys)
2. Click **"Create an Application"** (or "Application Keys")
3. Choose **"Production Keys"** (not Sandbox)
4. Fill in:
   - **Application Title:** "My Store - Product Export"
   - **Contact Email:** Your email
5. Click **"Create"**

### **Get Your Keys**

You'll now see your application keys:

**1. App ID (Client ID)**
```
YourApp-YourStor-PRD-1234567890-abcdefgh
```
**Copy this!**

**2. Cert ID (Client Secret)**
```
PRD-1234567890abcdef-1234-5678-9abc-defg
```
**Copy this!**

**3. Dev ID**
```
12345678-1234-5678-9abc-123456789012
```
**Copy this!**

### **Get Your Auth Token (User Token)**

This is the most important one!

1. Still in Developer Console, find your application
2. Click **"User Tokens"** or **"Get a User Token"**
3. Select **"Auth'n'Auth"** (Authentication & Authorization)
4. You'll be redirected to eBay
5. Click **"Agree"** to grant permissions
6. eBay shows you a **User Token**
   - Long string of random characters
7. **COPY THIS IMMEDIATELY!** It's only shown once.

**⚠️ CRITICAL:** Save all 4 credentials in a secure location!

---

## 🎨 **Step 2: Configure in Your DainoStore Store**

### **1. Open Marketplace Hub**

In your DainoStore admin:
1. Click **"Import & Export"** in sidebar
2. Click **"Marketplace Hub"**
3. Click the **"eBay"** tab

### **2. Enter Your Credentials**

Fill in the form with the credentials you gathered:

**App ID (Client ID):**
```
Paste your App ID here
```

**Cert ID (Client Secret):**
```
Paste your Cert ID here
```

**Dev ID:**
```
Paste your Dev ID here
```

**Auth Token:**
```
Paste your User Token here
```

### **3. Save Configuration**

Click **"Save Configuration"**

You should see: ✅ **"eBay configuration saved successfully!"**

The status badge changes from ⚪ **"Not Configured"** to 🟢 **"Connected"**

---

## ⚡ **Step 3: Configure Listing Settings**

### **AI Optimization (Recommended!)**

Toggle this ON for better listings:

**☑️ AI Optimization**
- **What it does:** Creates professional HTML descriptions
- **Features:**
  - Eye-catching formatting
  - Professional layout
  - Feature bullet points
  - Shipping and return policy sections
  - Call-to-action
- **Result:** Listings that convert better!

### **Listing Format**

Choose your selling format:

**Fixed Price** (Recommended)
- Set a fixed "Buy It Now" price
- Most common for e-commerce sellers
- Buyers purchase immediately

**Auction**
- Start with low price, buyers bid up
- Good for unique items or testing market value
- Takes longer to sell

### **Listing Duration**

How long listings stay active:

- **30 days** (Recommended) - Auto-renews until sold
- **7 days** - Good for auctions
- **Good 'Til Cancelled** - Stays active indefinitely

---

## 📦 **Step 4: Create Your eBay Listings**

### **Select Products**

1. Click **"Select Products"** button
2. Go to your Products page
3. Select products to list on eBay
4. Return to **Marketplace Hub** → **eBay** tab

**💡 Start with 3-5 products to test!**

### **Start the Export**

1. Make sure AI optimization is enabled (recommended!)
2. Check your listing format and duration
3. Click **"Create eBay Listings"** button
4. You'll see a success message

### **Monitor Progress**

Watch real-time progress:

```
🔄 Active Jobs (1)

eBay Export #5678
Processing: Blue Widget (5/15)
━━━━━━━━░░░░░░░░░░░░░ 33%
```

**What happens:**
1. Products are transformed to eBay format
2. AI creates optimized HTML descriptions (if enabled)
3. Images are prepared
4. Listings are generated

**Time:** Usually 1-2 minutes per product with AI optimization

---

## 📥 **Step 5: Review & Publish on eBay**

Once export completes:

### **Download Listing Data**

*Note: Download feature coming soon. Currently generated listings are prepared for you.*

### **Create Listings on eBay**

**Option 1: Via eBay Seller Hub (Current)**
1. Log in to [eBay Seller Hub](https://www.ebay.com/sh/lst/active)
2. Click **"Create listing"**
3. Use the data from our export:
   - Copy optimized title
   - Paste AI-generated HTML description
   - Add images (we provide URLs)
   - Set price
4. Click **"List item"**

**Option 2: Bulk Upload**
- Use eBay's File Exchange
- Upload CSV with all product data
- Faster for large catalogs

**Option 3: API Auto-Upload (Coming Soon!)**
- One click → listings appear on eBay automatically
- No manual work needed

---

## ✅ **Success! You're Selling on eBay**

Your products are now ready to sell to millions of eBay buyers!

### **What's Next?**

**Monitor Your Listings:**
1. Check **"Recent Activity"** in Marketplace Hub
2. See which products were exported
3. Track success rates

**Update Inventory:**
- When stock changes, re-export to update quantities
- Coming soon: Auto-sync inventory!

**Add More Products:**
- Just select new products and export again
- Can update existing listings too

---

## 💡 **Pro Tips for eBay Success**

### **1. Use AI Optimization**

eBay buyers love detailed, professional listings. Our AI creates:
- **Compelling titles** with key search terms
- **Professional HTML descriptions** that look great
- **Feature highlights** in bullet points
- **Shipping and return policies** automatically included

**Result:** Higher conversion rates and better buyer confidence!

### **2. Competitive Pricing**

Consider eBay's fees when pricing:
- **Final Value Fee:** ~13% of sale price
- **Payment Processing:** ~3%
- **Total:** ~16% in fees

**Example pricing:**
```
Your cost: $10
Desired profit: $5
eBay fees: 16%
Selling price: $10 + $5 + $2.40 (fees) = $17.40
```

Use DainoStore's price adjustment to auto-calculate!

### **3. Great Photos = More Sales**

- Upload 5-12 images (eBay allows up to 12 free)
- Show product from multiple angles
- Include lifestyle shots if possible
- High resolution (1600px minimum)

### **4. Start with Buy It Now**

For e-commerce sellers, **Fixed Price** listings work best:
- Buyers purchase immediately
- No waiting for auction to end
- Easier to manage inventory
- Better for bulk selling

### **5. Use Good 'Til Cancelled**

Set listings to **Good 'Til Cancelled** (GTC):
- Stays active until sold
- Auto-renews every 30 days
- Less work managing expired listings

---

## 🎯 **Understanding eBay Categories**

eBay has thousands of categories. Our system:
- Automatically suggests categories based on your product data
- Uses AI to map your categories to eBay categories
- You can override suggestions if needed

**Common Categories:**
- Electronics → eBay Electronics
- Clothing → Clothing, Shoes & Accessories
- Home & Garden → Home & Garden
- Toys → Toys & Hobbies

---

## 🔄 **Keeping Listings Updated**

### **Update Prices**

When you change prices in DainoStore:
1. Re-export affected products
2. Listings update on eBay
3. No need to manually edit each listing!

### **Update Inventory**

When stock changes:
1. Go to Marketplace Hub → eBay
2. Click **"Sync Inventory"** (coming soon)
3. Or re-export products
4. eBay quantities update automatically

### **Update Descriptions**

Made product improvements?
1. Update in your DainoStore catalog
2. Re-export to eBay
3. Listings get refreshed with new info

---

## 🆘 **Troubleshooting**

### **Problem: "Invalid eBay Credentials"**

**Solutions:**
- Double-check all 4 credentials are correct
- Make sure you used **Production** keys (not Sandbox)
- Verify User Token hasn't expired
- Generate new token if needed

### **Problem: "Export Job Failed"**

**Check:**
- Do products have all required fields? (title, price, images)
- Are images accessible (public URLs)?
- Is title under 80 characters?

### **Problem: "eBay Rejected My Listing"**

**Common reasons:**
- Title too long (eBay max: 80 characters)
- Prohibited words in title (e.g., "free shipping" - use item specifics instead)
- Missing category
- Invalid price (too low or too high)

**Solution:** Our AI auto-fixes most issues! Enable AI optimization.

---

## 📊 **Where to Find the Queue Dashboard**

Track all your background jobs (not just eBay!):

### **Built-in Job Monitoring:**

**1. Marketplace Hub (Quick View)**
- Location: **Import & Export → Marketplace Hub**
- Shows: Active jobs with progress bars
- Updates: Real-time
- Best for: Checking current exports

**2. API Endpoints (Advanced)**

For developers or custom dashboards:

```
GET /api/background-jobs/status
```
Returns overall queue statistics

```
GET /api/background-jobs/{jobId}/status
```
Returns specific job progress

```
GET /api/background-jobs/store/{storeId}
```
Returns all jobs for your store

**3. Coming Soon: Dedicated Job Dashboard**
- Full-screen job monitor
- Filter by type (exports, imports, translations)
- Detailed logs and error messages
- Performance analytics

---

## 💰 **eBay Fee Calculator**

Plan your pricing with eBay fees in mind:

| Sale Price | Final Value Fee (13%) | Payment Fee (3%) | Total Fees | You Keep |
|------------|----------------------|------------------|------------|----------|
| $10 | $1.30 | $0.30 | $1.60 | $8.40 |
| $25 | $3.25 | $0.75 | $4.00 | $21.00 |
| $50 | $6.50 | $1.50 | $8.00 | $42.00 |
| $100 | $13.00 | $3.00 | $16.00 | $84.00 |

**Use price adjustment** in DainoStore to auto-add markup!

---

## 🎉 **You're Ready to Sell!**

You now have:
- ✅ eBay integration configured
- ✅ AI-powered listing creation
- ✅ Professional HTML descriptions
- ✅ Background job processing
- ✅ Progress tracking

**Start selling on eBay today!** 🚀

---

## 🌟 **Why DainoStore Beats Other Tools**

**vs. Channable:**
- ✅ AI product optimization (they don't have this!)
- ✅ Auto-translation
- ✅ Deployment-resilient jobs
- ✅ Real-time progress tracking
- ✅ Built into your e-commerce platform

**vs. Manual eBay Uploads:**
- ✅ Bulk create hundreds of listings
- ✅ Consistent formatting
- ✅ Professional HTML descriptions
- ✅ One-click updates

**vs. Other Feed Management:**
- ✅ No monthly subscription fees
- ✅ Unlimited products
- ✅ AI enhancement included
- ✅ All-in-one solution

---

*Need Amazon setup?* See our [Amazon Setup Guide](./how-to-configure-amazon-marketplace.md)

*Last Updated: November 2025*
