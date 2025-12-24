# SEO Optimization Complete Guide

Master search engine optimization to drive organic traffic and increase visibility for your online store.

---

## Overview

SEO (Search Engine Optimization) helps your store:
- Rank higher in Google search results
- Drive free, organic traffic
- Build long-term visibility
- Reduce reliance on paid advertising

This guide covers technical SEO, on-page optimization, and content strategies.

---

## SEO Fundamentals

### How Search Engines Work

1. **Crawling**: Bots discover your pages
2. **Indexing**: Content stored in database
3. **Ranking**: Pages ordered by relevance

### Key Ranking Factors

| Factor | Impact | What It Means |
|--------|--------|---------------|
| Content quality | High | Relevant, valuable content |
| Backlinks | High | Links from other sites |
| User experience | High | Fast, mobile-friendly |
| Technical SEO | Medium | Clean code, structured data |
| Keywords | Medium | Matching search intent |

---

## Technical SEO

### Site Speed

Fast sites rank higher and convert better.

**Check your speed**:
1. Go to **Settings > Performance**
2. View Core Web Vitals scores
3. Identify improvement areas

**Optimization tips**:
- Enable image optimization (automatic)
- Use CDN for static assets
- Minimize JavaScript
- Enable caching

**Target metrics**:

| Metric | Good | Needs Work |
|--------|------|------------|
| LCP (Loading) | Under 2.5s | Over 4s |
| FID (Interactivity) | Under 100ms | Over 300ms |
| CLS (Stability) | Under 0.1 | Over 0.25 |

### Mobile Optimization

Google uses mobile-first indexing.

**DainoStore includes**:
- Responsive design
- Touch-friendly navigation
- Mobile-optimized checkout
- Fast mobile loading

**Test your store**:
1. Use Google's Mobile-Friendly Test
2. Check on actual devices
3. Verify checkout works

### Site Structure

Organize for crawlability:

```
Homepage
  |-- Categories
  |     |-- Subcategories
  |           |-- Products
  |-- Blog
  |     |-- Articles
  |-- Pages
        |-- About, Contact, etc.
```

**Best practices**:
- Keep important pages within 3 clicks
- Use logical hierarchy
- Create clear internal linking
- Avoid orphan pages

### XML Sitemaps

DainoStore auto-generates sitemaps:

```
yourstore.com/sitemap.xml (index)
yourstore.com/sitemap-products.xml
yourstore.com/sitemap-categories.xml
yourstore.com/sitemap-pages.xml
```

**Submit to search engines**:
1. Go to Google Search Console
2. Submit sitemap URL
3. Monitor indexing status

### Robots.txt

Controls what bots can crawl:

```
User-agent: *
Allow: /
Disallow: /admin/
Disallow: /cart/
Disallow: /checkout/
Sitemap: https://yourstore.com/sitemap.xml
```

**Configure in**: Settings > SEO > Robots.txt

---

## On-Page SEO

### Product Pages

**Title tags** (critical):
```
Format: [Product Name] - [Key Feature] | [Brand]
Length: 50-60 characters
Example: Organic Cotton T-Shirt - Soft & Breathable | EcoWear
```

**Meta descriptions**:
```
Format: [What it is] + [Key benefit] + [CTA]
Length: 150-160 characters
Example: Premium organic cotton t-shirt. Ultra-soft,
breathable, eco-friendly. Perfect for everyday comfort.
Free shipping on orders over $50.
```

**Product descriptions**:
- Include target keywords naturally
- Focus on benefits, not just features
- Use bullet points for scannability
- Add unique content (not manufacturer copy)

**Images**:
- Descriptive file names (blue-cotton-tshirt.jpg)
- Alt text with keywords
- Compress for fast loading
- Multiple angles

### Category Pages

**Optimize for broader terms**:
```
Title: Men's T-Shirts - Casual & Premium Styles | YourStore
Meta: Shop our collection of men's t-shirts. From casual
basics to premium cotton. Free shipping over $50.
```

**Add category content**:
- Introduction paragraph
- Buying guides
- Featured products
- FAQ section

### URL Structure

**Good URLs**:
```
/products/blue-cotton-t-shirt
/categories/mens-t-shirts
/blog/how-to-style-t-shirts
```

**Avoid**:
```
/products/12345
/category?id=67
/p?sku=ABC123
```

**Settings**: Go to Settings > SEO > URL Structure

---

## Keyword Strategy

### Finding Keywords

**Tools to use**:
- Google Keyword Planner (free)
- Ubersuggest (freemium)
- Ahrefs (paid)
- SEMrush (paid)

**Types of keywords**:

| Type | Example | Competition |
|------|---------|-------------|
| Head terms | t-shirts | Very high |
| Long-tail | organic cotton t-shirts for men | Lower |
| Product-specific | blue v-neck cotton t-shirt xl | Lowest |

### Keyword Mapping

Assign keywords to pages:

| Page | Primary Keyword | Secondary Keywords |
|------|-----------------|-------------------|
| Category: T-Shirts | men's t-shirts | casual t-shirts, cotton tees |
| Product: Blue Cotton | blue cotton t-shirt | organic blue tee, men's blue shirt |
| Blog: Style Guide | how to style t-shirts | t-shirt outfit ideas |

### Search Intent

Match content to intent:

| Intent | Example Query | Page Type |
|--------|---------------|-----------|
| Informational | how to wash cotton | Blog post |
| Commercial | best cotton t-shirts | Category + guide |
| Transactional | buy blue cotton t-shirt | Product page |
| Navigational | [brand] t-shirts | Brand category |

---

## Content SEO

### Product Descriptions

**Include**:
- Primary keyword in first paragraph
- Secondary keywords naturally
- Unique selling points
- Technical specifications
- Use cases

**Avoid**:
- Keyword stuffing
- Duplicate content
- Thin content (under 100 words)
- Manufacturer-only copy

### Blog Content

**Content ideas**:
- Buying guides
- How-to articles
- Style inspiration
- Industry news
- Customer stories

**Blog SEO checklist**:
- [ ] Keyword in title
- [ ] Keyword in URL
- [ ] Keyword in first 100 words
- [ ] Internal links to products
- [ ] External links to sources
- [ ] Images with alt text
- [ ] Headings (H2, H3) with keywords

### Schema Markup

Structured data for rich results:

**Product schema** (automatic):
```json
{
  "@type": "Product",
  "name": "Blue Cotton T-Shirt",
  "description": "...",
  "price": "29.99",
  "availability": "InStock",
  "review": {...}
}
```

**Enables**:
- Price in search results
- Star ratings
- Availability status
- FAQ rich results

---

## Link Building

### Internal Linking

Connect your pages:

| From | To | Why |
|------|------|-----|
| Category | Products | Help discovery |
| Product | Related products | Cross-selling |
| Blog | Products | Convert readers |
| Homepage | Categories | Main navigation |

**Anchor text tips**:
- Use descriptive text
- Vary anchor text
- Link naturally
- Avoid "click here"

### External Link Building

Earn links from other sites:

**Strategies**:
- Create linkable content (guides, research)
- Guest posting on industry blogs
- Partner collaborations
- PR and press coverage
- Industry directories

**Quality over quantity**:
- Links from relevant sites
- Higher domain authority
- Editorial placement
- Natural context

---

## Local SEO

For stores with physical locations:

### Google Business Profile

1. Claim your listing
2. Complete all information
3. Add photos
4. Collect reviews
5. Post updates

### Local Keywords

Include location terms:
```
Custom t-shirts Los Angeles
Best t-shirt shop in LA
T-shirts near me
```

### NAP Consistency

Name, Address, Phone must match everywhere:
- Website
- Google Business
- Social profiles
- Directories

---

## SEO Tools in DainoStore

### SEO Settings

1. Go to **Settings > SEO**
2. Configure global settings:
   - Default title format
   - Meta description template
   - Canonical URLs
   - Social media tags

### Page-Level SEO

For each product/page:

1. Edit the item
2. Go to **SEO** tab
3. Set:
   - Meta title
   - Meta description
   - URL slug
   - Canonical URL
   - Social image

### SEO Templates

Create templates for consistency:

**Product template**:
```
Title: {product_name} - {category} | {store_name}
Description: Buy {product_name}. {short_description}.
Free shipping on orders over ${shipping_threshold}.
```

**Category template**:
```
Title: {category_name} - Shop Online | {store_name}
Description: Browse our {category_name} collection.
{category_count} products available. {promo_text}
```

---

## Measuring SEO Success

### Key Metrics

| Metric | Tool | Target |
|--------|------|--------|
| Organic traffic | Analytics | Increasing |
| Keyword rankings | Search Console | Top 10 |
| Click-through rate | Search Console | Over 3% |
| Bounce rate | Analytics | Under 60% |
| Indexed pages | Search Console | All important pages |

### Google Search Console

Set up and monitor:

1. Add your site
2. Verify ownership
3. Submit sitemap
4. Monitor:
   - Indexing status
   - Search queries
   - Click data
   - Mobile usability

### Regular Audits

Monthly SEO checklist:
- [ ] Check Search Console for errors
- [ ] Review top-performing pages
- [ ] Identify declining pages
- [ ] Check page speed
- [ ] Review new backlinks
- [ ] Update stale content

---

## Common SEO Issues

### Duplicate Content

**Problem**: Same content on multiple URLs

**Solutions**:
- Set canonical URLs
- Use consistent URLs
- Implement redirects

### Thin Content

**Problem**: Pages with little value

**Solutions**:
- Add comprehensive descriptions
- Create buying guides
- Merge similar pages

### Missing Meta Tags

**Problem**: No custom meta tags

**Solutions**:
- Use SEO templates
- Add custom meta per page
- Audit all pages

### Slow Loading

**Problem**: Poor performance

**Solutions**:
- Optimize images
- Enable caching
- Use CDN
- Minimize code

---

## SEO Checklist

### Technical

- [ ] SSL enabled (HTTPS)
- [ ] Mobile-friendly design
- [ ] Fast loading (under 3s)
- [ ] XML sitemap submitted
- [ ] Robots.txt configured
- [ ] No broken links

### On-Page

- [ ] Unique title tags
- [ ] Meta descriptions written
- [ ] Header tags (H1, H2) used
- [ ] Images optimized with alt text
- [ ] Internal linking structure
- [ ] URL structure clean

### Content

- [ ] Keyword research done
- [ ] Unique product descriptions
- [ ] Category page content
- [ ] Blog/resource content
- [ ] Regular updates

---

## Next Steps

After implementing SEO basics:

1. **Audit current state** - Use Search Console
2. **Fix technical issues** - Speed, mobile, errors
3. **Optimize key pages** - Products and categories
4. **Create content** - Blog and guides
5. **Build links** - Outreach and partnerships

See our Product Feeds guide for Google Shopping optimization.
