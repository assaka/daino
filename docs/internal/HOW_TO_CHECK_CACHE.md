# How to Check If Cache is Working

**Simple step-by-step guide for Firefox**

---

## ⚡ Quick Test (2 Minutes After Deployment)

### Step 1: Test the Cache Test Endpoint

**Open in Firefox:**
```
https://backend.dainostore.com/api/cache-test/test
```

You'll see JSON like:
```json
{
  "success": true,
  "message": "Cache test endpoint",
  "timestamp": "2025-11-08T17:40:00.000Z",
  "random": 0.7453829,
  "note": "If X-Cache header appears, caching is working!"
}
```

### Step 2: Check Headers in Firefox

1. **Right-click** on the page → **Inspect** (or press F12)
2. Click **"Network"** tab
3. Click **"Reload"** icon or press **Ctrl+R**
4. Click on the **"test"** request in the list
5. Click **"Headers"** sub-tab (on the right)
6. Scroll down to **"Response Headers"**

**Look for:**
```
Response Headers:
  x-cache: MISS
```

### Step 3: Reload and Check Again

1. Press **Ctrl+R** to reload
2. Click the **"test"** request again
3. Check **Response Headers**

**Should now see:**
```
Response Headers:
  x-cache: HIT  ← Cache working! ✅
```

**ALSO check the JSON:**
- The `random` number should be **the same** as before
- The `timestamp` should be **the same** as before
- This proves the response came from cache!

---

## 🎯 Test Real Product Endpoint

### Once cache-test works, test products:

**Step 1:** In Firefox, open:
```
https://backend.dainostore.com/api/public/products?limit=5
```

**Step 2:** F12 → Network tab → Reload (Ctrl+R)

**Step 3:** Click the "products" request → Headers tab

**Should see:**
```
x-cache: MISS  (first time)
```

**Step 4:** Reload again within 3 minutes

**Should see:**
```
x-cache: HIT   (cached!)
```

---

## 📊 Check Cache Stats

**Open this URL:**
```
https://backend.dainostore.com/health/cache
```

**Before using cache:**
```json
{
  "redis": {
    "connected": true,
    "keys": 0  ← Empty
  }
}
```

**After visiting products/test endpoints:**
```json
{
  "redis": {
    "connected": true,
    "keys": 3  ← Growing! ✅
  },
  "stats": {
    "redis": {
      "keys": 3
    }
  }
}
```

**If keys count increases → cache is working!**

---

## 🔍 Visual Guide for Firefox

### Finding x-cache Header:

```
Firefox DevTools → Network Tab:

┌────────────────────────────────────────────────────┐
│ Filter URLs: [test________________]  🔍  🗑️  ⚙️   │
├────────────┬────────┬──────┬───────┬──────────────┤
│ File       │ Status │ Type │  Size │ Transferred  │
├────────────┼────────┼──────┼───────┼──────────────┤
│ test       │ 200    │ json │ 1.2KB │ 1.2KB        │ ← Click this
└────────────┴────────┴──────┴───────┴──────────────┘

Right Panel (after clicking):
┌────────────────────────────────────────────────────┐
│ [Headers] [Response] [Cookies] [Timings]          │
├────────────────────────────────────────────────────┤
│ Response Headers:                                  │
│ ├─ content-type: application/json                 │
│ ├─ date: Sat, 08 Nov 2025 17:40:00 GMT           │
│ └─ x-cache: MISS  ← Look for this!               │
└────────────────────────────────────────────────────┘
```

---

## 🐛 Troubleshooting

### If you DON'T see x-cache header:

**Check 1: Is backend deployed?**
```bash
# Check deployment status
# Go to: dashboard.render.com → daino-backend → Events
# Should show: "Deploy live" (green checkmark)
```

**Check 2: Is Redis connected?**
```
Visit: https://backend.dainostore.com/health/cache
Should show: "connected": true
```

**Check 3: Check backend logs**
```
Render Dashboard → daino-backend → Logs
Look for:
  ✅ Redis: Connected successfully
  ❌ Error loading cache middleware
```

**Check 4: Try the test endpoint**
```
The /api/cache-test/test endpoint SHOULD work
If it doesn't, cache middleware isn't loading
```

---

## ⏰ Deployment Timeline

- **Pushed code:** Just now
- **Render detects push:** ~30 seconds
- **Build starts:** ~1 minute
- **Build completes:** ~2-3 minutes
- **Service restarts:** ~3-4 minutes
- **Ready to test:** ~5 minutes total

**Check again in 5 minutes!**

---

## 📋 Quick Checklist

After 5 minutes, do this:

- [ ] Visit: https://backend.dainostore.com/api/cache-test/test
- [ ] F12 → Network tab → Reload
- [ ] Click "test" request → Headers
- [ ] Look for `x-cache: MISS`
- [ ] Reload again (Ctrl+R)
- [ ] Check headers → Should see `x-cache: HIT`
- [ ] Note the `random` number is identical (proves caching)
- [ ] Check /health/cache → keys count should be > 0

---

## ✅ Success Criteria

**Cache IS working if:**
- ✅ You see `x-cache: HIT` on second request
- ✅ Random number stays the same
- ✅ `/health/cache` shows keys > 0
- ✅ Response time is 80-90% faster on HIT

**Cache NOT working if:**
- ❌ No `x-cache` header at all
- ❌ Always `x-cache: MISS`
- ❌ Random number changes each time
- ❌ `/health/cache` shows keys = 0

---

## 🎯 What to Do Next

**If cache works:**
1. ✅ Test real endpoints (/api/public/products)
2. ✅ Monitor cache hit rate in /health/cache
3. ✅ Check Render logs for "Cache hit" messages

**If cache doesn't work:**
1. Share the error from Render logs (daino-backend → Logs)
2. Check if Redis is connected (/health/cache)
3. I'll help debug

---

**Set a timer for 5 minutes, then test the cache endpoint!** ⏰

🔗 Test URL: https://backend.dainostore.com/api/cache-test/test

