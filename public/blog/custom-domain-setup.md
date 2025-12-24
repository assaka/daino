# Custom Domain Setup

Connect your own domain to your DainoStore for a professional, branded shopping experience.

---

## Overview

Using a custom domain:
- Builds brand credibility
- Improves customer trust
- Better for SEO
- Professional appearance
- Easier to remember

---

## Before You Start

### What You Need

1. **A registered domain**
   - Purchase from registrar (Namecheap, GoDaddy, Google Domains)
   - Already own a domain? Great!

2. **Access to DNS settings**
   - Login to your domain registrar
   - Ability to add DNS records

3. **DainoStore active subscription**
   - Custom domains on paid plans
   - Free SSL certificate included

---

## Domain Options

### Primary Domain

Your main store address:
```
www.yourstore.com
yourstore.com
```

### Subdomain

Part of existing domain:
```
shop.yourcompany.com
store.yourbrand.com
```

### Multiple Domains

Point multiple domains to one store:
```
yourstore.com (primary)
yourstore.co.uk (redirect)
your-store.com (redirect)
```

---

## Setting Up Your Domain

### Step 1: Add Domain in DainoStore

1. Go to **Settings > Domains**
2. Click **Add Domain**
3. Enter your domain name
4. Select as primary or additional
5. Click **Add**

### Step 2: Get DNS Records

After adding, you'll see required DNS records:

**For root domain (yourstore.com)**:
```
Type: A
Name: @
Value: [IP address shown]
```

**For www subdomain**:
```
Type: CNAME
Name: www
Value: [hostname shown]
```

**Or use CNAME flattening if supported**:
```
Type: CNAME
Name: @
Value: stores.dainostore.com
```

### Step 3: Configure DNS at Registrar

Log into your domain registrar and add the records.

**Example for common registrars**:

**Namecheap**:
1. Go to Domain List
2. Click Manage
3. Advanced DNS tab
4. Add A Record and CNAME

**GoDaddy**:
1. My Products > Domains
2. DNS Settings
3. Add Record

**Cloudflare**:
1. Select domain
2. DNS tab
3. Add records (proxy status: DNS only)

**Google Domains**:
1. DNS settings
2. Custom records
3. Add records

---

## DNS Configuration Details

### A Records

Point domain to IP address:

| Setting | Value |
|---------|-------|
| Type | A |
| Host/Name | @ (or blank) |
| Value | IP from DainoStore |
| TTL | 3600 (or Auto) |

### CNAME Records

Point subdomain to hostname:

| Setting | Value |
|---------|-------|
| Type | CNAME |
| Host/Name | www |
| Value | stores.dainostore.com |
| TTL | 3600 (or Auto) |

### Verification Record

Sometimes needed for verification:

| Setting | Value |
|---------|-------|
| Type | TXT |
| Host/Name | @ |
| Value | verification string |
| TTL | 3600 |

---

## SSL Certificate

### Automatic SSL

DainoStore provides free SSL:
- Automatic provisioning
- Auto-renewal
- Covers www and root

### SSL Provisioning Process

1. DNS records verified
2. Certificate requested
3. Certificate issued (usually minutes)
4. HTTPS enabled

### Checking SSL Status

1. Go to **Settings > Domains**
2. View domain status
3. SSL shows: Pending, Active, or Error

### SSL Troubleshooting

If SSL fails:
- Verify DNS records correct
- Wait for DNS propagation (up to 48 hours)
- Check no CAA records blocking issuance
- Contact support if persists

---

## Domain Verification

### Verification Steps

1. Add domain in DainoStore
2. Add DNS records
3. Click **Verify Domain**
4. System checks DNS
5. Status updates

### Verification Status

| Status | Meaning |
|--------|---------|
| Pending | Waiting for DNS |
| Verified | DNS correct |
| Error | DNS not found |
| Active | Fully working |

### DNS Propagation

DNS changes take time:
- Typically 15-30 minutes
- Can take up to 48 hours
- Check with DNS lookup tools

---

## WWW vs Non-WWW

### Choose One

Pick primary version:
- `www.yourstore.com` (with www)
- `yourstore.com` (without www)

### Configure Redirect

Other version redirects to primary:

1. Go to **Settings > Domains**
2. Select primary version
3. Enable redirect from other

### Which to Choose?

| Option | Pros |
|--------|------|
| With www | Traditional, cookie isolation |
| Without www | Shorter, modern |

Both work fine - just be consistent.

---

## Multiple Domains

### Adding Additional Domains

1. Go to **Settings > Domains**
2. Click **Add Domain**
3. Mark as "Additional"
4. Configure DNS
5. Set redirect behavior

### Redirect Options

| Option | Behavior |
|--------|----------|
| Redirect to primary | 301 redirect |
| Serve content | Same content, different URL |
| Region-specific | Different content per domain |

### Common Setups

**International**:
```
yourstore.com (US - primary)
yourstore.co.uk (UK - redirect or localized)
yourstore.de (Germany - redirect or localized)
```

**Brand variations**:
```
yourstore.com (primary)
your-store.com (redirect)
yourstoreonline.com (redirect)
```

---

## Subdomains

### Setting Up Subdomains

For `shop.yourcompany.com`:

1. Add subdomain in DainoStore
2. Add CNAME at registrar:
   ```
   Type: CNAME
   Name: shop
   Value: stores.dainostore.com
   ```
3. Verify and activate

### Common Subdomain Uses

| Subdomain | Use |
|-----------|-----|
| shop | Store on company site |
| store | E-commerce section |
| buy | Purchase portal |
| order | Ordering system |

---

## Email Configuration

### SPF Record

For email deliverability:

```
Type: TXT
Name: @
Value: v=spf1 include:_spf.dainostore.com ~all
```

### DKIM Record

Add DKIM for authentication:

```
Type: CNAME
Name: dainostore._domainkey
Value: [provided by DainoStore]
```

### DMARC Record

Optional but recommended:

```
Type: TXT
Name: _dmarc
Value: v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com
```

---

## Troubleshooting

### Domain Not Connecting

**Check**:
1. DNS records correct?
2. Propagation complete?
3. No typos in values?
4. Correct record types?

**Tools**:
- whatsmydns.net
- dnschecker.org
- dig command

### SSL Not Working

**Causes**:
- DNS not verified yet
- CAA records blocking
- Domain misconfigured

**Solutions**:
- Wait for propagation
- Check CAA records
- Verify DNS setup
- Contact support

### Mixed Content Warnings

**Issue**: HTTP content on HTTPS page

**Fix**:
- Update image URLs to HTTPS
- Check embedded content
- Review custom code

### Redirect Loop

**Issue**: Page keeps redirecting

**Check**:
- SSL settings at registrar
- Cloudflare SSL mode
- Redirect settings in DainoStore

---

## Best Practices

### Before Launch

1. **Test thoroughly** - All pages work
2. **Check SSL** - Green padlock shows
3. **Update links** - Internal links use new domain
4. **Verify email** - Transactional emails work
5. **Test checkout** - Complete test purchase

### SEO Considerations

1. **Redirect old domain** - 301 redirect if changing
2. **Update Search Console** - Add new property
3. **Submit sitemap** - New domain sitemap
4. **Update backlinks** - Where possible

### Ongoing

1. **Monitor SSL** - Auto-renews but verify
2. **Keep DNS stable** - Don't remove records
3. **Check annually** - Domain renewal
4. **Review redirects** - Still working

---

## Common Questions

**Q: How long until my domain works?**
A: Usually 15-30 minutes. Can take up to 48 hours for DNS propagation.

**Q: Do I need to buy SSL separately?**
A: No, free SSL included with DainoStore.

**Q: Can I use a domain I own elsewhere?**
A: Yes, just update DNS records. Don't need to transfer.

**Q: What happens to my free subdomain?**
A: It still works. Consider redirecting to custom domain.

**Q: Can I change my domain later?**
A: Yes, add new domain and update primary.

---

## Next Steps

After connecting your domain:

1. **Verify SSL** - Ensure secure connection
2. **Update branding** - Emails, social links
3. **Configure email** - SPF, DKIM records
4. **Test everything** - Full site check
5. **Update marketing** - New domain in materials

See our CMS Pages guide for content management.
