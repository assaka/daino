# Multi-Language Store Setup

Expand globally by offering your store in multiple languages, reaching customers in their preferred language.

---

## Overview

A multi-language store helps you:
- Reach international customers
- Improve conversion in new markets
- Build trust with localized content
- Compete in global marketplaces

DainoStore supports unlimited languages with AI-powered translation.

---

## Language Setup Basics

### Supported Languages

DainoStore supports 50+ languages including:

| Popular Languages | Asian Languages | European Languages |
|------------------|-----------------|-------------------|
| English | Japanese | French |
| Spanish | Chinese (Simplified) | German |
| Portuguese | Chinese (Traditional) | Italian |
| Arabic | Korean | Dutch |
| Russian | Thai | Polish |

### Primary vs Secondary Languages

**Primary language**: Your default store language
- All content created here first
- Source for translations
- Shown when no translation exists

**Secondary languages**: Additional languages you offer
- Translated from primary
- Customer can switch to these
- Separate URL or selector

---

## Enabling Multiple Languages

### Step 1: Add Languages

1. Go to **Settings > Languages**
2. Click **Add Language**
3. Select language from dropdown
4. Set display name (how customers see it)
5. Save

### Step 2: Configure Settings

| Setting | Options |
|---------|---------|
| URL format | Subdirectory (/es/), Subdomain (es.), or Parameter (?lang=es) |
| Default language | Shown when no preference detected |
| Auto-detect | Use browser language preference |
| Language selector | Position and style |

### Step 3: Enable on Storefront

1. Go to **Storefront Settings**
2. Find **Language Selector**
3. Choose position (header, footer)
4. Select style (dropdown, flags)
5. Save

---

## Translation Methods

### Manual Translation

For precise control:

1. Go to **Content > Translations**
2. Select content type (Products, Categories, Pages)
3. Choose item to translate
4. Enter translations for each field
5. Save

**Best for**:
- Critical marketing copy
- Legal pages
- Brand messaging

### AI Translation

For speed and scale:

1. Select items to translate
2. Click **AI Translate**
3. Choose target language
4. Review generated translations
5. Edit if needed
6. Save

**Best for**:
- Large product catalogs
- Initial translations
- Less critical content

### Import/Export

For external translation services:

1. Go to **Content > Translations**
2. Click **Export for Translation**
3. Select language and content
4. Download CSV/XLIFF file
5. Send to translators
6. Import completed file

---

## Content Types to Translate

### Products

| Field | Priority | Notes |
|-------|----------|-------|
| Title | High | Critical for SEO |
| Description | High | Customer decision factor |
| Short description | High | Shown in listings |
| Meta title | Medium | SEO |
| Meta description | Medium | SEO |
| Variant names | Medium | Size, color names |

### Categories

| Field | Priority |
|-------|----------|
| Name | High |
| Description | Medium |
| Meta title | Medium |
| Meta description | Medium |

### UI Labels

System text throughout your store:

- Navigation items
- Buttons (Add to Cart, Checkout)
- Form labels
- Error messages
- Email templates

### CMS Pages

Your custom content pages:

- About us
- Contact
- FAQ
- Policies
- Blog posts

---

## URL Structure

### Subdirectory (Recommended)

```
yourstore.com/         (English - default)
yourstore.com/es/      (Spanish)
yourstore.com/fr/      (French)
yourstore.com/de/      (German)
```

**Pros**: Easy to set up, good for SEO, single domain

### Subdomain

```
yourstore.com         (English)
es.yourstore.com      (Spanish)
fr.yourstore.com      (French)
```

**Pros**: Complete separation, can use different servers

### Query Parameter

```
yourstore.com?lang=en
yourstore.com?lang=es
```

**Pros**: Simplest implementation, no URL changes

---

## SEO for Multiple Languages

### Hreflang Tags

DainoStore automatically adds hreflang tags:

```html
<link rel="alternate" hreflang="en" href="https://store.com/product" />
<link rel="alternate" hreflang="es" href="https://store.com/es/product" />
<link rel="alternate" hreflang="fr" href="https://store.com/fr/product" />
```

These tell search engines which language version to show.

### Translated URLs

Option to translate URL slugs:

| Language | URL |
|----------|-----|
| English | /products/blue-t-shirt |
| Spanish | /productos/camiseta-azul |
| French | /produits/t-shirt-bleu |

**Enable in**: Settings > Languages > URL Translation

### Localized Sitemaps

DainoStore generates:
- Main sitemap with all languages
- Language-specific sitemaps
- Proper hreflang references

---

## Currency and Formatting

### Multi-Currency Display

Show prices in local currency:

1. Go to **Settings > Currencies**
2. Add supported currencies
3. Set exchange rates (manual or auto)
4. Configure rounding rules

### Number Formatting

Different regions use different formats:

| Region | Example |
|--------|---------|
| US | $1,234.56 |
| Germany | 1.234,56 EUR |
| France | 1 234,56 EUR |

DainoStore formats automatically based on language.

### Date Formatting

| Region | Format |
|--------|--------|
| US | MM/DD/YYYY |
| Europe | DD/MM/YYYY |
| Japan | YYYY/MM/DD |

---

## Translation Workflow

### Recommended Process

1. **Prioritize content**
   - Start with product titles and descriptions
   - Then categories and navigation
   - Finally UI labels and pages

2. **Use AI for first pass**
   - Bulk translate products
   - Generate UI translations

3. **Review critical content**
   - Have native speaker review
   - Focus on customer-facing copy

4. **Test thoroughly**
   - Browse store in each language
   - Check checkout flow
   - Verify emails

### Quality Checklist

- [ ] All products translated
- [ ] Categories translated
- [ ] Navigation correct
- [ ] Checkout labels work
- [ ] Emails translated
- [ ] No missing translations
- [ ] Currency displays correctly
- [ ] SEO tags in place

---

## Bulk Translation

### Translating Product Catalogs

For large catalogs:

1. Go to **Catalog > Products**
2. Select all or filter by untranslated
3. Click **Bulk Actions > Translate**
4. Choose target language
5. Select fields to translate
6. Start background job
7. Review when complete

### Translation Jobs

Jobs run in background:
- Progress shown in dashboard
- Can continue working
- Notified when complete

### Review Interface

After bulk translation:

1. Go to **Content > Translation Review**
2. Filter by language
3. See all pending translations
4. Accept, edit, or reject each
5. Bulk approve reviewed items

---

## Language Selector

### Placement Options

| Position | Best For |
|----------|----------|
| Header | Most visible, always accessible |
| Footer | Unobtrusive, less prominent |
| Sidebar | Good for some layouts |
| Modal | Full page selector |

### Selector Styles

**Dropdown**:
- Text: "English" with dropdown
- Compact: Uses less space

**Flags + Text**:
- Visual recognition
- Avoid for languages spanning countries

**Language codes**:
- EN | ES | FR
- Very compact

### Remembering Preference

DainoStore remembers language choice:
- Stored in cookie
- Synced with customer account
- Persists across sessions

---

## Testing Translations

### Preview Mode

Test without publishing:

1. Go to product/page
2. Click **Preview**
3. Select language from dropdown
4. Review translated content

### Test Orders

Place test orders in each language:

1. Switch to target language
2. Add products to cart
3. Go through checkout
4. Verify all text correct
5. Check confirmation email

### Common Issues

| Issue | Solution |
|-------|----------|
| Missing translation | Source text shows (add translation) |
| Wrong encoding | Check import file encoding |
| Truncated text | Adjust for longer languages |
| Layout broken | Some languages need more space |

---

## Email Translation

### Transactional Emails

Translate all email templates:

- Order confirmation
- Shipping notification
- Account emails
- Password reset

### Setting Up

1. Go to **Settings > Emails**
2. Select email template
3. Click **Translations** tab
4. Select language
5. Edit content
6. Save

### Variables

Variables work in all languages:
```
Order {order_number} confirmed
Pedido {order_number} confirmado
Commande {order_number} confirmee
```

---

## Advanced Configuration

### Fallback Languages

Set fallback hierarchy:

```
Swiss German -> German -> English
Canadian French -> French -> English
```

If translation missing, tries fallback.

### Language-Specific Settings

Different settings per language:

| Setting | Example |
|---------|---------|
| Currency | EUR for German, GBP for UK |
| Tax display | Inclusive in EU, exclusive in US |
| Shipping options | Region-specific |
| Payment methods | Local options |

### RTL Support

For right-to-left languages (Arabic, Hebrew):
- Automatic layout mirroring
- RTL CSS loaded
- Text alignment adjusted

---

## Best Practices

### Do

1. **Start with high-traffic languages** - Check analytics
2. **Localize, don't just translate** - Cultural context matters
3. **Test with native speakers** - Catch awkward phrasing
4. **Keep source updated** - Changes sync to translations
5. **Monitor search traffic** - Track international performance

### Don't

1. **Use machine translation blindly** - Always review
2. **Forget meta content** - SEO needs translation too
3. **Ignore cultural differences** - Colors, images, idioms
4. **Skip testing** - Verify before launch
5. **Neglect updates** - Keep translations current

---

## Measuring Success

### Key Metrics

Track per language:

| Metric | What It Shows |
|--------|---------------|
| Traffic | Visitors per language |
| Conversion rate | How well each converts |
| Bounce rate | Content quality indicator |
| Search rankings | SEO performance |

### Analytics Setup

1. Go to **Analytics > Settings**
2. Enable **Language dimension**
3. Create language-specific reports
4. Compare performance

---

## Next Steps

After setting up languages:

1. **Add priority languages** - Start with 1-2
2. **Translate products** - Bulk translate catalog
3. **Localize emails** - Translate templates
4. **Test thoroughly** - Full checkout flow
5. **Monitor and improve** - Track metrics

See our SEO Optimization Guide for multi-language SEO tips.
