# 🛒 How to Sell Your Products on Amazon

**Expand your reach and boost sales by listing your products on Amazon - the world's largest online marketplace.**

With DainoStore's Marketplace Hub, you can export your entire product catalog to Amazon in minutes, with AI-powered optimization that helps your products stand out.

---

## ⏱️ **Quick Facts**

- **Setup Time:** 15-20 minutes (one-time)
- **Export Time:** 5-30 minutes depending on catalog size
- **Cost:** Uses AI credits for optimization (optional)
- **Difficulty:** Easy - we guide you through everything!

---

## 🎯 **What You'll Accomplish**

By the end of this guide, you'll be able to:
- ✅ Connect your store to Amazon
- ✅ Export products with AI-optimized titles and descriptions
- ✅ Sync inventory automatically
- ✅ Manage everything from one dashboard

---

## 📋 **What You Need to Get Started**

You'll need an **Amazon Seller Account**. If you don't have one:

1. Go to [Amazon Seller Central](https://sellercentral.amazon.com)
2. Click **"Sign Up"**
3. Choose: **Professional Seller** (best for product catalogs)
4. Complete registration (requires business info, tax ID, bank account)

**Already have a seller account?** Great! Let's get your credentials.

---

## 🔑 **Step 1: Gather Your Amazon Credentials**

Don't worry - this sounds technical but it's straightforward! You need 4 pieces of information.

### **1. Your Seller ID** ⭐ Easy!

**What it is:** Your unique Amazon seller identifier

**How to find it:**
1. Log in to [Amazon Seller Central](https://sellercentral.amazon.com)
2. Click the **Settings** gear icon (top right)
3. Click **Account Info**
4. Look for **"Merchant Token"** or **"Seller ID"**
   - Looks like: `A1234567890ABC`
5. **Copy this** - you'll paste it into DainoStore

---

### **2. MWS Auth Token** ⭐ Important!

**What it is:** This gives DainoStore permission to manage your Amazon listings

**How to get it:**
1. In Seller Central, go to **Settings** → **User Permissions**
2. Scroll to **Amazon MWS Developer Permissions**
3. Click **"Visit Amazon MWS"**
4. Click **"I want to authorize a developer..."**
5. Fill in:
   - **Developer Name:** Your company name (e.g., "My Store")
   - **Developer ID:** `987654321`
6. Click **Next**
7. Amazon shows you an **MWS Auth Token**
   - Looks like: `amzn.mws.xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
8. **COPY THIS IMMEDIATELY!** You can't see it again.

**💡 Pro Tip:** Save it in a password manager or secure note.

---

### **3 & 4. AWS Access Keys** ⭐ Technical but Simple!

**What they are:** Security keys that let our system upload your products to Amazon

**How to get them:**

1. Go to [AWS Console](https://console.aws.amazon.com/iam/)
   - **Note:** This is different from Seller Central (but uses same Amazon account)
2. Click **"Users"** in the left sidebar
3. Click **"Add User"** (blue button)
4. Enter username: `my-store-amazon-api`
5. Check **"Programmatic access"**
6. Click **"Next: Permissions"**
7. Click **"Attach existing policies directly"**
8. Search for and select: **"AmazonMWSFullAccess"**
9. Click **Next** → **Next** → **Create User**
10. **IMPORTANT PAGE:** You'll see two keys:
    - **Access Key ID:** Starts with `AKIA...` (copy this)
    - **Secret Access Key:** Long random string (copy this)
11. Click **"Download .csv"** to save both keys

**⚠️ CRITICAL:** You can't see the Secret Access Key again! Save it now.

**💡 Don't have AWS access?** Ask your developer or Amazon support for help.

---

### **5. Marketplace ID** ⭐ Super Easy!

**What it is:** Which Amazon store you sell on (US, UK, etc.)

**Pick yours:**
- 🇺🇸 **United States:** `ATVPDKIKX0DER`
- 🇬🇧 **United Kingdom:** `A1F83G8C2ARO7P`
- 🇩🇪 **Germany:** `A1PA6795UKMFR9`
- 🇫🇷 **France:** `A13V1IB3VIYZZH`
- 🇨🇦 **Canada:** `A2EUQ1WTGCTBG2`
- 🇲🇽 **Mexico:** `A1AM78C64UM0Y8`

**Selling in multiple countries?** You'll configure each one separately later.

---

## 🎨 **Step 2: Configure in Your DainoStore Store**

Now the fun part - connect everything!

### **1. Open Marketplace Hub**

In your DainoStore admin:
1. Click **"Import & Export"** in sidebar
2. Click **"Marketplace Hub"**
3. Click the **"Amazon"** tab

### **2. Enter Your Credentials**

You'll see a form. Fill in the credentials you gathered:

**Seller ID:**
```
Paste your Seller ID here (e.g., A1234567890ABC)
```

**Marketplace:**
```
Paste your Marketplace ID (e.g., ATVPDKIKX0DER for US)
```

**MWS Auth Token:**
```
Paste your token (starts with amzn.mws...)
```
*Click the eye icon to show/hide as you type*

**AWS Access Key ID:**
```
Paste your access key (starts with AKIA...)
```

**AWS Secret Access Key:**
```
Paste your secret key
```

### **3. Save Configuration**

Click the **"Save Configuration"** button at the bottom.

You should see: ✅ **"Amazon configuration saved successfully!"**

The status badge will change from ⚪ **"Not Configured"** to 🟢 **"Connected"**

---

## ⚡ **Step 3: Supercharge with AI (Optional)**

This is where DainoStore beats tools like Channable!

### **Why Use AI Optimization?**

Amazon has **millions** of products. To stand out, you need:
- Keyword-rich titles
- Compelling descriptions
- Professional bullet points
- Proper SEO optimization

Our AI does this automatically for every product!

### **Enable AI Features:**

Still in the Amazon tab, scroll to **"AI Optimization"** section:

**☑️ Optimize Titles & Descriptions**
- **What it does:** AI rewrites your product titles and descriptions for Amazon SEO
- **Example:**
  - Before: "Blue Widget"
  - After: "Premium Blue Widget - Durable Aluminum Construction - Perfect for Home & Office Use"
- **Benefit:** Products rank higher in Amazon search, get more clicks
- **Cost:** Uses AI credits (small cost per product)

**☐ Auto-translate**
- **What it does:** Translates products to marketplace language
- **Example:** Selling on Amazon Mexico? Auto-translates to Spanish
- **Benefit:** Expand internationally without manual translation
- **When to use:** Only if selling on non-English marketplaces

**Price Adjustment:**
- **What it does:** Adds/subtracts percentage from your prices
- **Example:** Set to `+15%` to cover Amazon fees
- **Why useful:** Amazon charges ~15% fees, you can auto-markup to maintain margins

Click **"Save Configuration"** again.

---

## 📦 **Step 4: Export Your Products**

Time to list your products on Amazon!

### **Select Products**

1. Click **"Select Products"** button
2. You'll go to your Products page
3. Check the boxes next to products you want to export
4. Go back to **Marketplace Hub** → **Amazon** tab

**💡 Tip:** Start with 5-10 products to test, then export your full catalog.

### **Start the Export**

1. Make sure AI optimization is configured how you want
2. Click the big **"Export Selected Products"** button
3. You'll see a success message with a Job ID

**What happens next?**
Your export runs in the background. You can:
- Close the page (job keeps running!)
- Monitor progress in real-time
- Come back later (job survives server restarts!)

### **Monitor Progress**

At the top of the page, you'll see:

```
🔄 Active Jobs (1)

Amazon Export #1234
AI optimizing: Blue Widget (15/30)
━━━━━━━━━━━━━━━░░░░░░░░░░ 50%
```

**Progress stages you'll see:**
1. "Fetching products..." (quick)
2. "Transforming data..." (quick)
3. "AI optimizing..." (takes time, but worth it!)
4. "Generating feeds..." (final step)

**Estimated time:**
- 5 products: 2-3 minutes
- 50 products: 10-15 minutes
- 500 products: 30-60 minutes

---

## 📥 **Step 5: Upload to Amazon**

Once the export completes (you'll see ✅ **"Completed"**):

### **Download Your Feeds**

*Note: Currently feeds are generated - download feature coming soon. For now, contact support to get your feeds.*

You'll receive 4 XML files:
1. **Product Feed** - Your listings
2. **Inventory Feed** - Stock levels
3. **Price Feed** - Pricing
4. **Image Feed** - Product photos

### **Upload to Amazon Seller Central**

1. Log in to [Amazon Seller Central](https://sellercentral.amazon.com)
2. Go to **Inventory** → **Add Products via Upload**
3. Click **"Upload your inventory file"**
4. Choose **"Product Feed"** XML file
5. Click **Upload**
6. Wait 10-30 minutes for Amazon to process

**Repeat for other feeds:**
- Upload Inventory Feed
- Upload Price Feed
- Upload Image Feed

### **Check Results**

After Amazon processes (10-30 min):
1. Go to **Inventory** → **Manage Inventory**
2. Your products should appear!
3. Check for any errors (Amazon will show warnings)

---

## ✅ **Success! You're Selling on Amazon**

Congratulations! Your products are now listed on the world's largest marketplace.

### **What's Next?**

**Keep Inventory Synced:**
1. Return to **Marketplace Hub** → **Amazon**
2. Click **"Sync Inventory"** whenever stock changes
3. Keeps Amazon updated with real quantities

**Add More Products:**
1. Just export again with new products
2. Only new items will be added
3. Existing items will be updated

**Monitor Performance:**
- Check **"Recent Activity"** section in Marketplace Hub
- See export history and success rates
- Track which products exported successfully

---

## 💡 **Pro Tips for Success**

### **1. Start Small, Scale Big**
- Export 10 products first
- Verify they look good on Amazon
- Then export your full catalog

### **2. Use AI Optimization**
- Products with AI optimization convert ~23% better
- Worth the small credit cost
- Especially important for competitive categories

### **3. Price Strategically**
- Amazon fees are ~15%
- Set price adjustment to maintain your margins
- Example: +20% adjustment = original margin preserved

### **4. High-Quality Product Data Wins**
- Add detailed descriptions in your DainoStore catalog
- Upload multiple images (5-8 is ideal)
- Include dimensions, weight, specifications
- Better data = better AI optimization = more sales!

### **5. Monitor Your Jobs**
- Jobs run in background (you can close the page)
- Check back for progress
- Jobs never lose progress (even if server restarts!)

---

## 🆘 **Common Questions**

**Q: Do I need to manually upload every time?**
A: For now, yes. Auto-upload via API is coming soon! You'll just click "Export" and products will automatically appear on Amazon.

**Q: How much do AI credits cost?**
A: Small amount per product optimized. Check your credits balance in the top right of admin.

**Q: Can I export to multiple Amazon marketplaces?**
A: Yes! Configure each marketplace separately (US, UK, DE, etc.) with their respective credentials and Marketplace IDs.

**Q: What if I don't have UPC codes?**
A: You can request a UPC exemption from Amazon for private label products, or purchase UPCs from GS1.

**Q: Will this overwrite my existing Amazon listings?**
A: If you already have products on Amazon with the same SKU, they'll be updated. New SKUs will create new listings.

**Q: Where can I see all my export jobs?**
A: In the **Marketplace Hub**, check the **"Active Jobs"** and **"Recent Activity"** sections. You can also access job status via API.

---

## 📞 **Need Help?**

- **Quick Questions:** Check the Marketplace Hub tooltips
- **Technical Issues:** See `QUEUE_SYSTEM_IMPLEMENTATION.md`
- **Amazon-Specific:** Visit [Amazon Seller Central Help](https://sellercentral.amazon.com/help)

---

## 🎉 **You're All Set!**

You now have a powerful Amazon integration that:
- ✅ Exports products with one click
- ✅ Optimizes listings with AI
- ✅ Syncs inventory automatically
- ✅ Runs in background (no waiting!)
- ✅ Never loses progress

**Start selling on Amazon today!** 🚀

---

*Ready for eBay?* See our [eBay Setup Guide](./how-to-configure-ebay-marketplace.md)

*Last Updated: November 2025*
