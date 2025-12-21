# 🛒 How to Configure Amazon Marketplace Integration

Complete step-by-step guide to connect your DainoStore store to Amazon and start exporting products.

---

## 📋 **What You'll Need**

Before you begin, gather these credentials from Amazon:

1. **Seller ID** (also called Merchant ID)
2. **MWS Auth Token**
3. **AWS Access Key ID**
4. **AWS Secret Access Key**
5. **Marketplace ID** (varies by country)

**Estimated Setup Time:** 15-20 minutes

---

## 🔑 **Step 1: Get Your Amazon Credentials**

### **A. Get Your Seller ID**

1. Go to [Amazon Seller Central](https://sellercentral.amazon.com)
2. Log in with your seller account
3. Click **Settings** (gear icon) in top right
4. Click **Account Info**
5. Look for **Merchant Token** or **Seller ID**
   - Format: Starts with "A" followed by numbers (e.g., `A1234567890ABC`)
6. Copy this ID - you'll need it!

### **B. Get Your MWS Auth Token**

1. In Seller Central, go to **Settings** → **User Permissions**
2. Click on **Amazon MWS Developer Permissions**
3. Click **Visit Amazon MWS** or go to [MWS Authorization](https://sellercentral.amazon.com/apps/authorize/consent)
4. Click **I want to authorize a developer...**
5. Enter developer information:
   - **Developer Name:** Your company name
   - **Developer ID:** `987654321` (or your actual MWS Developer ID if you have one)
6. Click **Next**
7. You'll see your **MWS Auth Token**
   - Format: `amzn.mws.xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
8. **IMPORTANT:** Copy and save this token immediately - you can't retrieve it later!

### **C. Get AWS Access Keys (for MWS API)**

1. Go to [AWS IAM Console](https://console.aws.amazon.com/iam/)
2. Click **Users** → **Add User**
3. User name: `amazon-mws-api-user`
4. Access type: **Programmatic access** (checked)
5. Click **Next: Permissions**
6. Attach policy: **AmazonMWSFullAccess** (or create custom policy)
7. Click **Next** through remaining steps
8. **Download credentials** or copy:
   - **Access Key ID:** Starts with `AKIA...`
   - **Secret Access Key:** Long string (only shown once!)

**⚠️ CRITICAL:** Save your Secret Access Key immediately - AWS won't show it again!

### **D. Determine Your Marketplace ID**

Choose based on where you sell:

| Country/Region | Marketplace ID | Region Code |
|----------------|----------------|-------------|
| 🇺🇸 United States | `ATVPDKIKX0DER` | US |
| 🇨🇦 Canada | `A2EUQ1WTGCTBG2` | CA |
| 🇲🇽 Mexico | `A1AM78C64UM0Y8` | MX |
| 🇬🇧 United Kingdom | `A1F83G8C2ARO7P` | UK |
| 🇩🇪 Germany | `A1PA6795UKMFR9` | DE |
| 🇫🇷 France | `A13V1IB3VIYZZH` | FR |
| 🇮🇹 Italy | `APJ6JRA9NG5V4` | IT |
| 🇪🇸 Spain | `A1RKKUPIHCS9HS` | ES |
| 🇯🇵 Japan | `A1VC38T7YXB528` | JP |
| 🇦🇺 Australia | `A39IBJ37TRP1C6` | AU |
| 🇮🇳 India | `A21TJRUUN4KGV` | IN |

---

## 🔧 **Step 2: Configure in DainoStore**

### **Access the Marketplace Hub**

1. Log in to your DainoStore admin panel
2. Navigate to: **Import & Export** → **Marketplace Hub**
3. Click the **Amazon** tab

### **Enter Your Credentials**

Fill in the configuration form:

**Seller ID:**
```
A1234567890ABC
```

**MWS Auth Token:**
```
amzn.mws.xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

**AWS Access Key ID:**
```
AKIAIOSFODNN7EXAMPLE
```

**AWS Secret Access Key:**
```
wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
```

**Marketplace:**
```
ATVPDKIKX0DER  (for US)
```

**Region:**
```
US
```

### **Click "Save Configuration"**

You should see a success message: ✅ "Amazon configuration saved successfully!"

---

## ⚡ **Step 3: Configure AI Optimization (Optional)**

DainoStore includes AI-powered features that Channable doesn't have!

### **Enable AI Optimization:**

Toggle these settings based on your needs:

**✅ Optimize Titles & Descriptions**
- AI rewrites titles for maximum Amazon SEO
- Generates compelling descriptions
- Adds relevant keywords
- **Benefit:** ~23% better conversion rates

**☐ Auto-translate**
- Automatically translate products to marketplace language
- Useful if selling internationally (e.g., US products → Spanish for Amazon Mexico)
- **Benefit:** Expand to international markets easily

**Price Adjustment:**
```
+10%  (Example: Add 10% markup for Amazon fees)
```
- Automatically adjust prices on export
- Accounts for Amazon fees, shipping, etc.

### **Click "Save Configuration"** again to save AI settings

---

## 📦 **Step 4: Export Your First Products**

### **A. Select Products to Export**

1. Click **"Select Products"** button
2. This takes you to `/admin/products`
3. Select products you want to export
4. Return to Marketplace Hub

*Note: Future versions will have inline product selector*

### **B. Start the Export**

1. In Marketplace Hub → Amazon tab
2. Ensure AI Optimization is configured as desired
3. Click **"Export Selected Products"** button
4. You'll see a success message with Job ID

### **C. Monitor Progress**

The page will show real-time progress:

```
🔄 Active Jobs (1)
┌─────────────────────────────────────────┐
│ Amazon Export #1234                      │
│ AI optimizing: Blue Widget (15/30)       │
│ ━━━━━━━━━━━━━━━░░░░░░░░░░ 50%          │
└─────────────────────────────────────────┘
```

Progress stages:
1. **Fetching products** (0-20%)
2. **Transforming data** (20-40%)
3. **AI optimizing** (40-70%) - Only if enabled
4. **Translating** (70-85%) - Only if enabled
5. **Generating feeds** (85-100%)

---

## 📥 **Step 5: Download & Submit Feeds to Amazon**

Once the export job completes:

### **Download the Generated Feeds**

The export creates 4 XML feeds:

1. **Product Feed** - Product listings with titles, descriptions, etc.
2. **Inventory Feed** - Stock quantities
3. **Price Feed** - Pricing information
4. **Image Feed** - Product images

### **Submit to Amazon**

**Method 1: Via Seller Central (Manual)**
1. Go to [Amazon Seller Central](https://sellercentral.amazon.com)
2. Navigate to **Inventory** → **Add Products via Upload**
3. Choose **Upload your inventory file**
4. Upload the **Product Feed XML** first
5. Wait for processing (10-30 minutes)
6. Upload **Inventory Feed**
7. Upload **Price Feed**
8. Upload **Image Feed**

**Method 2: Via MWS API (Automatic - Coming Soon)**
- Future versions will auto-submit feeds via API
- No manual upload needed

---

## ✅ **Step 6: Verify Your Products**

After Amazon processes your feeds (typically 10-30 minutes):

1. Go to **Seller Central** → **Inventory** → **Manage Inventory**
2. You should see your products listed
3. Check for any errors or warnings
4. Fix any issues and re-export if needed

---

## 🎯 **Best Practices**

### **Product Data Quality**

Before exporting, ensure your products have:

✅ **Required Fields:**
- Product SKU (unique)
- Title (under 200 characters)
- At least one product identifier (UPC, EAN, ASIN, or ISBN)
- Price
- Stock quantity
- At least one image

✅ **Recommended Fields:**
- Brand name
- Detailed description
- Multiple images (5-8 recommended)
- Product dimensions and weight
- Bullet points (features)

### **AI Optimization Tips**

For best AI results:
1. Provide detailed product descriptions in your catalog
2. Include product features and specifications
3. Add high-quality images
4. Specify brand and manufacturer

The AI uses this data to create optimized listings!

### **Pricing Strategy**

Consider these when setting price adjustment:

- **Amazon fees:** ~15% (referral + FBA fees)
- **Shipping costs:** If not using FBA
- **Competition:** Check competitor pricing
- **Profit margin:** Your desired margin

**Example:** If your cost is $10, and you want 30% margin after 15% Amazon fees:
```
Base price: $10
Desired margin: 30% = $3
Amazon fees: 15%
Price adjustment: +50% = $15
Final price: $15.00
After fees (15%): $12.75
Your profit: $2.75 (27.5% margin)
```

---

## 🔄 **Ongoing Sync**

### **Inventory Sync**

Keep your Amazon inventory updated:

1. Go to Marketplace Hub → Amazon
2. Click **"Sync Inventory"** button
3. This updates stock quantities on Amazon
4. Job runs in background (survives deployment!)

**Recommended:** Schedule automatic syncs (coming soon)

### **Price Updates**

To update prices:
1. Update prices in your DainoStore catalog
2. Re-export products to Amazon
3. Only price feed will be submitted

---

## 🆘 **Troubleshooting**

### **Problem: "Insufficient Credits"**

**Solution:** AI optimization uses credits. Either:
- Disable AI optimization temporarily
- Purchase more credits
- Optimize only important products

### **Problem: "Missing Product Identifier"**

**Solution:** Amazon requires UPC, EAN, ASIN, or ISBN. Either:
- Add UPCs to your products
- Request UPC exemption from Amazon (for private label)
- Use ASIN if relisting existing Amazon products

### **Problem: "Title Too Long"**

**Solution:** Amazon limits titles to 200 characters. Either:
- Enable AI optimization (auto-truncates intelligently)
- Manually shorten titles in your catalog
- The system will auto-truncate if over limit

### **Problem: "Export Job Stuck"**

**Solution:**
1. Check job status: Go to job ID in active jobs
2. Wait - large catalogs can take 10-20 minutes
3. If truly stuck (>30 min), contact support
4. Jobs survive deployments - they'll resume!

### **Problem: "Invalid AWS Credentials"**

**Solution:**
- Verify Access Key ID and Secret Key are correct
- Ensure IAM user has MWS permissions
- Check if keys are expired
- Generate new keys if needed

---

## 💡 **Pro Tips**

### **1. Test with Small Batch First**
- Export 5-10 products first
- Verify they appear correctly on Amazon
- Then export your full catalog

### **2. Use AI Optimization Strategically**
- Enable for high-value or complex products
- Disable for simple products to save credits
- AI generates better titles, descriptions, and keywords

### **3. Optimize Product Data Before Export**
- Add detailed descriptions in DainoStore
- Upload high-quality images
- Fill in all attributes
- Better input = better AI output!

### **4. Monitor Job Progress**
- Keep Marketplace Hub tab open during export
- Watch for errors in real-time
- Jobs show exactly which product is processing

### **5. Download Feeds for Records**
- Save generated XML feeds
- Useful for troubleshooting Amazon rejections
- Can manually edit if needed

---

## 🚀 **Advanced Features**

### **Category Mapping**

Map your DainoStore categories to Amazon categories:

```javascript
export_settings: {
  category_mapping: {
    "Electronics": "Amazon Electronics",
    "Clothing": "Amazon Apparel"
  }
}
```

*Coming soon: AI-suggested category mapping!*

### **Scheduled Exports**

Set up automatic exports:

*Coming soon: Configure sync frequency (hourly, daily, weekly)*

### **Multi-Marketplace**

Sell on multiple Amazon marketplaces:
1. Configure separate credentials for each marketplace
2. Set different marketplace IDs (US, UK, DE, etc.)
3. Enable auto-translate for local languages

---

## 📞 **Need Help?**

- **Documentation:** See `QUEUE_SYSTEM_IMPLEMENTATION.md`
- **API Reference:** `/api/amazon/*` endpoints
- **Support:** Create an issue on GitHub

---

## 🎉 **You're Ready!**

Once configured, you can:
- ✅ Export products to Amazon with one click
- ✅ AI-optimize listings automatically
- ✅ Sync inventory in real-time
- ✅ Track progress with live updates
- ✅ Scale to hundreds of products
- ✅ Jobs survive deployments

**Happy selling on Amazon!** 🚀

---

*Last updated: 2025-11-13*
*DainoStore Version: 2.0+*
