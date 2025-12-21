## GDPR Consent Integration with Analytics

Complete guide for cookie consent and GDPR compliance in the analytics system.

---

## Overview

Your analytics system now fully respects user cookie consent choices. All tracking (customer activity, heatmap interactions, A/B tests) is consent-aware and GDPR compliant.

### Key Features

✅ **Consent-Aware Tracking** - Events respect user consent choices
✅ **PII Sanitization** - Removes personal data if consent not given
✅ **Right to be Forgotten** - API endpoints for data deletion
✅ **Data Portability** - Export all user data
✅ **Consent Audit Trail** - Complete history of consent changes
✅ **Script Sanitization** - XSS protection for GTM custom scripts

---

## Architecture

```
User → Cookie Consent Banner
         ↓
    Accept/Reject
         ↓
localStorage: cookie_consent = ["analytics", "marketing"]
         ↓
Frontend: useC ookieConsent() hook
         ↓
API Request + X-Cookie-Consent Header
         ↓
Backend: consentMiddleware
         ↓
Check Consent → Sanitize Data if needed
         ↓
Event Bus → Database
```

---

## Frontend Implementation

### 1. Using the Consent Hook

```jsx
import { useCookieConsent } from '../hooks/useCookieConsent';

function AnalyticsWidget() {
  const {
    hasConsent,
    hasAnalyticsConsent,
    hasMarketingConsent,
    getConsentHeader
  } = useCookieConsent();

  if (!hasAnalyticsConsent) {
    return <div>Analytics disabled by user preference</div>;
  }

  return <AnalyticsDashboard />;
}
```

### 2. Conditional Rendering Based on Consent

```jsx
import { ConsentGate } from '../hooks/useCookieConsent';

function ProductPage() {
  return (
    <div>
      <ProductDetails />

      {/* Only show heatmap tracking if user consented */}
      <ConsentGate category="analytics" fallback={null}>
        <HeatmapTracker />
      </ConsentGate>

      {/* Only show marketing pixels if user consented */}
      <ConsentGate category="marketing" fallback={null}>
        <FacebookPixel />
        <GoogleAds />
      </ConsentGate>
    </div>
  );
}
```

### 3. Making Consent-Aware API Calls

```jsx
import { useConsentAwareFetch } from '../hooks/useCookieConsent';

function trackEvent() {
  const fetchWithConsent = useConsentAwareFetch();

  // Automatically adds X-Cookie-Consent header
  await fetchWithConsent('/api/customer-activity', {
    method: 'POST',
    body: JSON.stringify({
      activity_type: 'product_view',
      // ...
    })
  });
}
```

### 4. Tracking Consent Changes

```jsx
function CookieConsentBanner() {
  const { updateConsent } = useCookieConsent();

  const handleAcceptAll = () => {
    const allCategories = ['necessary', 'analytics', 'marketing', 'functional'];
    updateConsent(allCategories); // Automatically tracked!
  };

  const handleRejectAll = () => {
    updateConsent(['necessary']); // Only essential cookies
  };
}
```

---

## Backend Implementation

### 1. Consent Middleware

The consent middleware automatically:
- Checks consent from `X-Cookie-Consent` header
- Sanitizes PII if consent not given
- Logs consent violations

```javascript
// Applied automatically to analytics routes
router.use(attachConsentInfo);
router.post('/', sanitizeEventData, async (req, res) => {
  // req.analyticsConsent = true/false
  // req.body has been sanitized if no consent
});
```

### 2. What Gets Sanitized

If user has **NOT** consented to analytics:

```javascript
{
  session_id: "session_123",        // ✅ Kept (anonymous)
  store_id: "store-uuid",           // ✅ Kept
  activity_type: "product_view",    // ✅ Kept
  page_url: "/products/widget",     // ✅ Kept

  user_id: null,                    // ❌ Removed
  ip_address: null,                 // ❌ Removed
  user_agent: "redacted"            // ❌ Redacted
}
```

This allows basic anonymous analytics while respecting privacy.

---

## GDPR API Endpoints

### 1. Delete User Data (Right to be Forgotten)

```http
POST /api/gdpr/delete-data
Content-Type: application/json

{
  "session_id": "session_123",
  "user_id": "user-uuid",
  "store_id": "store-uuid"
}

Response:
{
  "success": true,
  "deleted": {
    "customer_activities": 1247,
    "heatmap_interactions": 3891,
    "heatmap_sessions": 42,
    "ab_test_assignments": 15,
    "consent_logs": 5
  },
  "total_records_deleted": 5200
}
```

### 2. Export User Data (Right to Data Portability)

```http
GET /api/gdpr/export-data?session_id=session_123&store_id=store-uuid

Response:
{
  "success": true,
  "data": {
    "export_date": "2025-01-07T10:30:00Z",
    "identifiers": {
      "session_id": "session_123",
      "user_id": null,
      "store_id": "store-uuid"
    },
    "data": {
      "customer_activities": [...],
      "heatmap_interactions": [...],
      "heatmap_sessions": [...],
      "ab_test_assignments": [...],
      "consent_logs": [...]
    },
    "summary": {
      "total_customer_activities": 1247,
      ...
    }
  }
}
```

### 3. Anonymize Data (Alternative to Deletion)

```http
POST /api/gdpr/anonymize-data
Content-Type: application/json

{
  "session_id": "session_123",
  "store_id": "store-uuid"
}

Response:
{
  "success": true,
  "anonymized": {
    "customer_activities": 1247,
    "heatmap_interactions": 3891,
    ...
  },
  "total_records_anonymized": 5200
}
```

**Anonymization keeps statistical data but removes**:
- User IDs
- IP addresses
- User agents
- All metadata

### 4. Get Consent History

```http
GET /api/gdpr/consent-history?session_id=session_123&store_id=store-uuid

Response:
{
  "success": true,
  "data": [
    {
      "id": "log-1",
      "consent_given": true,
      "categories_accepted": ["analytics", "marketing"],
      "country_code": "DE",
      "consent_method": "accept_all",
      "page_url": "/products",
      "created_at": "2025-01-07T10:00:00Z"
    },
    {
      "id": "log-2",
      "consent_given": false,
      "categories_accepted": ["necessary"],
      "consent_method": "reject_all",
      "created_at": "2025-01-01T09:00:00Z"
    }
  ]
}
```

---

## Cookie Categories

Your system supports these categories:

| Category | ID | Description |
|----------|-------|-------------|
| **Necessary** | `necessary` or `necessary_cookies` | Essential for site operation (always enabled) |
| **Analytics** | `analytics` or `analytics_cookies` | Usage tracking, heatmaps, A/B tests |
| **Marketing** | `marketing` or `marketing_cookies` | Advertising, retargeting pixels |
| **Functional** | `functional` or `functional_cookies` | Enhanced features (chat, recommendations) |

---

## Security: GTM Script Sanitization

### XSS Protection

Custom GTM scripts are now sanitized before execution:

```javascript
// ❌ BLOCKED - Contains dangerous patterns
const maliciousScript = `
  <script>alert('XSS')</script>
  document.cookie = "steal=data";
`;

// ✅ ALLOWED - Valid GTM script
const validScript = `
  window.dataLayer = window.dataLayer || [];
  dataLayer.push({
    'event': 'page_view',
    'page_title': document.title
  });
`;
```

### What's Blocked

- HTML tags (`<script>`, `<img>`, etc.)
- `javascript:` protocol
- Event handlers (`onclick=`, `onerror=`)
- `eval()` and `Function()` constructor
- Cookie access (`document.cookie`)
- `document.write()`
- `.innerHTML` / `.outerHTML`
- Dynamic imports/require

### What's Allowed

- `dataLayer.push(...)`
- `gtag(...)`
- `window.dataLayer`
- GTM-specific functions
- Standard JavaScript (if/else, loops, etc.)

### Backend Validation

Scripts are validated before being saved:

```javascript
const { validateGTMScript } = require('../utils/scriptValidator');

const result = validateGTMScript(userScript);

if (!result.valid) {
  return res.status(400).json({
    error: 'Invalid GTM script',
    details: result.errors
  });
}

// Save result.sanitized to database
```

---

## GDPR Mode

### Auto Country Detection

```javascript
// In CookieConsentBanner.jsx
const country = await getUserCountry(); // Uses ipapi.co

if (isGDPRCountry(country)) {
  // Show consent banner (opt-in required)
  showBanner = true;
} else {
  // No banner (implied consent)
  showBanner = false;
}
```

### GDPR Countries

EU/EEA countries where consent is required:
- AT, BE, BG, HR, CY, CZ, DK, EE, FI, FR
- DE, GR, HU, IE, IT, LV, LT, LU, MT, NL
- PL, PT, RO, SK, SI, ES, SE

### Consent Expiry

Default: **365 days**

```javascript
// Stored in localStorage
{
  "cookie_consent": ["analytics", "marketing"],
  "cookie_consent_expiry": "2026-01-07T10:00:00Z"
}
```

After expiry, banner shows again.

---

## Compliance Checklist

### GDPR Requirements

- [x] **Consent before tracking** - Analytics only runs with consent
- [x] **Granular consent** - Separate categories (analytics, marketing, etc.)
- [x] **Easy to withdraw** - Users can change preferences anytime
- [x] **Audit trail** - All consent changes logged
- [x] **Right to access** - Export endpoint provided
- [x] **Right to be forgotten** - Delete endpoint provided
- [x] **Data minimization** - PII removed if no consent
- [x] **Consent expiry** - Re-ask after 12 months

### Additional Compliance

- [x] **CCPA** - Delete/export endpoints satisfy CCPA
- [x] **PECR** - Cookie consent before non-essential cookies
- [x] **ePrivacy** - Consent for cookies and tracking

---

## Privacy Policy Integration

### Linking to Privacy Policy

```jsx
// CookieConsentBanner automatically links to privacy policy
<Link to={createCmsPageUrl(store?.slug, 'privacy-policy')}>
  Privacy Policy
</Link>
```

### Privacy Policy Should Include

1. **What data is collected**
   - Customer activities (page views, clicks)
   - Heatmap data (mouse movements, scrolls)
   - A/B test assignments

2. **Why it's collected**
   - Improve user experience
   - Analyze website performance
   - Test new features

3. **How long it's stored**
   - Default: 90 days for heatmaps
   - A/B test data: Until test completes
   - Consent logs: 3 years (legal requirement)

4. **How to request deletion**
   - Contact form or email
   - We respond within 30 days

5. **Third parties**
   - Google Tag Manager (if enabled)
   - Google Analytics (if configured)
   - Facebook Pixel (if configured)

---

## Testing Consent Integration

### 1. Test Frontend Consent

```javascript
// Open browser console
localStorage.setItem('cookie_consent', JSON.stringify(['analytics']));
window.dispatchEvent(new CustomEvent('consentChanged', {
  detail: { consent: ['analytics'] }
}));

// Check if analytics are tracking
```

### 2. Test Backend Sanitization

```bash
# Request without consent header
curl -X POST http://localhost:3001/api/customer-activity \
  -H "Content-Type: application/json" \
  -d '{"session_id":"test", "store_id":"uuid", "activity_type":"page_view", "user_id":"user-123"}'

# Check that user_id was removed in database

# Request with consent header
curl -X POST http://localhost:3001/api/customer-activity \
  -H "Content-Type: application/json" \
  -H "X-Cookie-Consent: [\"analytics\"]" \
  -d '{"session_id":"test", "store_id":"uuid", "activity_type":"page_view", "user_id":"user-123"}'

# Check that user_id was kept
```

### 3. Test GDPR Endpoints

```bash
# Delete all data for a session
curl -X POST http://localhost:3001/api/gdpr/delete-data \
  -H "Content-Type: application/json" \
  -d '{"session_id":"test", "store_id":"uuid"}'

# Export data
curl -X GET "http://localhost:3001/api/gdpr/export-data?session_id=test&store_id=uuid"
```

---

## Best Practices

### 1. Always Check Consent Before Tracking

```jsx
const { hasAnalyticsConsent } = useCookieConsent();

const trackPageView = () => {
  if (!hasAnalyticsConsent) {
    console.log('Skipping analytics - no consent');
    return;
  }

  // Track event
};
```

### 2. Use Consent Header in All API Calls

```javascript
const { getConsentHeader } = useCookieConsent();

fetch('/api/customer-activity', {
  headers: {
    'X-Cookie-Consent': getConsentHeader()
  }
});
```

### 3. Provide Clear Consent Options

```jsx
// ✅ Good - Clear categories
<Switch label="Analytics Cookies">
  <p>Help us improve by tracking how you use our site</p>
</Switch>

// ❌ Bad - Vague
<Switch label="Performance">
  <p>Some cookies</p>
</Switch>
```

### 4. Make It Easy to Withdraw Consent

```jsx
// Add "Cookie Settings" link in footer
<Link to="/cookie-settings">Manage Cookie Preferences</Link>
```

### 5. Log Consent Changes

```javascript
// Automatically logged by useCookieConsent hook
updateConsent(['analytics']); // Creates audit log entry
```

---

## Troubleshooting

### Analytics Not Tracking

1. Check consent in localStorage:
   ```javascript
   JSON.parse(localStorage.getItem('cookie_consent'))
   ```

2. Verify consent header is sent:
   ```javascript
   // In browser DevTools → Network tab
   // Look for X-Cookie-Consent header
   ```

3. Check backend logs:
   ```
   [CONSENT] Event data sanitized - no analytics consent
   ```

### GTM Script Blocked

1. Check browser console for errors:
   ```
   ❌ Custom GTM script failed security validation and was blocked
   ```

2. Validate script:
   ```javascript
   const { validateGTMScript } = require('./utils/scriptValidator');
   console.log(validateGTMScript(yourScript));
   ```

3. Common issues:
   - Contains HTML tags
   - Uses eval() or document.write()
   - Too long (>10KB)
   - Doesn't reference dataLayer

### GDPR Deletion Not Working

1. Check if records exist:
   ```sql
   SELECT COUNT(*) FROM customer_activities WHERE session_id = 'test';
   ```

2. Verify deletion response:
   ```json
   {
     "deleted": {
       "customer_activities": 0  // ← Nothing to delete
     }
   }
   ```

3. Try with correct identifiers (session_id, user_id, or store_id)

---

## Summary

✅ **Complete GDPR compliance** with consent tracking
✅ **PII protection** via automatic sanitization
✅ **Data rights** (access, delete, portability)
✅ **Security** with GTM script validation
✅ **Audit trail** of all consent changes

Your analytics system now respects user privacy while still providing valuable insights!
