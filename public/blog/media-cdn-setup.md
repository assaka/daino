# Media and CDN Configuration

Optimize your store's images and files with CDN delivery for faster loading worldwide.

---

## Overview

Proper media configuration:
- Speeds up page loading
- Reduces bandwidth costs
- Improves SEO rankings
- Enhances user experience
- Scales globally

---

## CDN Basics

### What is a CDN?

A Content Delivery Network:
- Distributes files globally
- Serves from nearest location
- Caches content at edge
- Reduces server load

### How It Works

```
Customer (New York)
    |
CDN Edge (New York) <- Cache
    |
Origin Server (California)
```

First request goes to origin, subsequent requests served from edge.

---

## Default CDN

### Built-in CDN

DainoStore includes CDN by default:
- Automatic image optimization
- Global edge network
- SSL included
- No configuration needed

### Default Features

| Feature | Included |
|---------|----------|
| Image optimization | Yes |
| WebP conversion | Yes |
| Lazy loading | Yes |
| Global distribution | Yes |
| SSL | Yes |

---

## Cloudflare Integration

### Why Cloudflare?

Extended CDN features:
- Advanced caching
- DDoS protection
- Web Application Firewall
- Analytics
- Custom rules

### Setup Process

1. Go to **Settings > CDN**
2. Click **Connect Cloudflare**
3. Enter API credentials:
   - API Token
   - Zone ID
4. Verify connection
5. Enable features

### Cloudflare Settings

| Setting | Purpose |
|---------|---------|
| Cache Level | Caching aggressiveness |
| Browser TTL | Client cache time |
| Edge TTL | CDN cache time |
| Polish | Image optimization |
| Minify | Code minification |

---

## Image Optimization

### Automatic Optimization

Images are automatically:
- Compressed (quality maintained)
- Converted to WebP (when supported)
- Resized for device
- Lazy loaded

### Optimization Settings

Configure in **Settings > Media**:

| Setting | Options |
|---------|---------|
| Quality | 60-100 (80 default) |
| Format | Auto, WebP, JPEG |
| Max dimensions | 4096px default |
| Lazy loading | Enable/disable |

### Responsive Images

Automatic srcset generation:

```html
<img
  srcset="
    image-400.webp 400w,
    image-800.webp 800w,
    image-1200.webp 1200w
  "
  sizes="(max-width: 600px) 400px, 800px"
/>
```

---

## Storage Configuration

### Default Storage

Files stored on DainoStore servers:
- Secure storage
- Automatic backup
- CDN delivery

### External Storage

Connect your own storage:

**Cloudflare R2**:
```
Endpoint: https://account.r2.cloudflarestorage.com
Access Key: [your key]
Secret Key: [your secret]
Bucket: [bucket name]
```

**AWS S3**:
```
Region: us-east-1
Access Key: [your key]
Secret Key: [your secret]
Bucket: [bucket name]
```

### Storage Setup

1. Go to **Settings > Media > Storage**
2. Select provider
3. Enter credentials
4. Test connection
5. Migrate existing files (optional)

---

## File Management

### Uploading Files

Multiple upload methods:
- Admin interface upload
- Drag and drop
- URL import
- API upload

### Supported Formats

| Type | Formats |
|------|---------|
| Images | JPG, PNG, GIF, WebP, SVG |
| Documents | PDF, DOC, DOCX |
| Video | MP4, WebM |
| Audio | MP3, WAV |

### File Limits

| Setting | Default | Max |
|---------|---------|-----|
| Image size | 10MB | 50MB |
| Document size | 25MB | 100MB |
| Video size | 100MB | 500MB |

---

## Cache Configuration

### Cache Rules

Control what gets cached:

| Content | Cache Time |
|---------|------------|
| Images | 1 year |
| CSS/JS | 1 month |
| HTML | No cache |
| API | No cache |

### Cache Headers

DainoStore sets appropriate headers:

```
Cache-Control: public, max-age=31536000
ETag: "abc123"
Last-Modified: Mon, 01 Jan 2024 00:00:00 GMT
```

### Purging Cache

Clear cached content:

1. Go to **Settings > CDN**
2. Click **Purge Cache**
3. Options:
   - Purge all
   - Purge by URL
   - Purge by tag

---

## Performance Metrics

### Monitoring

Track CDN performance:

| Metric | Good | Needs Work |
|--------|------|------------|
| Cache hit rate | 90%+ | Under 70% |
| Response time | Under 100ms | Over 500ms |
| Bandwidth saved | 60%+ | Under 40% |

### Analytics Dashboard

View in **Analytics > Performance**:
- Request volume
- Bandwidth usage
- Cache ratio
- Error rate
- Geographic distribution

---

## Image Transformations

### On-the-Fly Transformations

Transform images via URL parameters:

```
/images/product.jpg?w=400&h=300&fit=cover
```

### Available Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| w | Width | w=400 |
| h | Height | h=300 |
| fit | Fit mode | fit=cover |
| q | Quality | q=80 |
| f | Format | f=webp |

### Fit Modes

| Mode | Behavior |
|------|----------|
| cover | Fill dimensions, crop excess |
| contain | Fit within dimensions |
| fill | Stretch to dimensions |
| inside | Fit inside, no upscale |

---

## Video Optimization

### Video Hosting

For product videos:

1. Upload to **Media Library**
2. Automatic encoding
3. Adaptive streaming (HLS)
4. CDN delivery

### Video Settings

| Setting | Recommendation |
|---------|----------------|
| Format | MP4 with H.264 |
| Resolution | 1080p max |
| Bitrate | 4-8 Mbps |
| Length | Under 2 minutes |

### Embedding

```html
<video controls>
  <source src="/media/video.mp4" type="video/mp4">
</video>
```

---

## Security

### Access Control

Protect media files:

| Option | Use Case |
|--------|----------|
| Public | Product images |
| Signed URLs | Temporary access |
| Token auth | Authenticated only |

### Signed URLs

Generate temporary access:

```javascript
const signedUrl = await media.sign('/private/file.pdf', {
  expiresIn: 3600  // 1 hour
});
```

### Hotlink Protection

Prevent unauthorized embedding:

1. Go to **Settings > CDN > Security**
2. Enable **Hotlink Protection**
3. Add allowed domains
4. Save

---

## Troubleshooting

### Images Not Loading

**Check**:
- File exists in media library
- Correct URL path
- No cache issues
- CDN status

### Slow Loading

**Solutions**:
- Enable lazy loading
- Reduce image quality
- Use appropriate sizes
- Check CDN status

### Cache Not Updating

**Try**:
- Purge specific URL
- Wait for TTL expiry
- Check cache headers
- Verify CDN config

---

## Best Practices

### Images

1. **Optimize before upload** - Pre-compress large files
2. **Use appropriate sizes** - Don't use 4000px for thumbnails
3. **Add alt text** - Accessibility and SEO
4. **Use lazy loading** - For below-fold images
5. **Consider WebP** - Smaller file sizes

### CDN

1. **Set proper TTLs** - Balance freshness and caching
2. **Use cache tags** - Granular purging
3. **Monitor metrics** - Catch issues early
4. **Test globally** - Check from different regions
5. **Document changes** - Track configuration

### Storage

1. **Organize files** - Logical folder structure
2. **Clean up unused** - Remove old files
3. **Back up regularly** - Important assets
4. **Secure sensitive** - Use access controls
5. **Monitor usage** - Stay within limits

---

## Advanced Configuration

### Custom CDN

Use your own CDN:

1. Go to **Settings > CDN > Custom**
2. Configure:
   - Origin URL
   - CDN domain
   - SSL certificate
3. Update DNS
4. Test delivery

### Multi-Region Storage

For global performance:

```javascript
{
  regions: [
    { name: 'us', bucket: 'store-us' },
    { name: 'eu', bucket: 'store-eu' },
    { name: 'asia', bucket: 'store-asia' }
  ],
  routing: 'geo'  // Route by location
}
```

---

## Next Steps

After configuring media:

1. **Test performance** - PageSpeed Insights
2. **Monitor metrics** - Cache hit rate
3. **Optimize images** - Reduce sizes
4. **Set up backups** - Critical assets
5. **Document config** - For team

See our API Integration Patterns guide for advanced integrations.
