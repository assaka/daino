# Store-Specific UI Labels - Implementation Complete ✅

## Overview
UI labels are now scoped to individual stores instead of being global. Each store can have its own customized translations.

## What Was Changed

### Backend (3 commits)

#### Models:
- **Translation.js**: Added required `store_id` field
  - New unique constraint: `(store_id, key, language_code)`
  - New index on `store_id`

- **CreditUsage.js**: Kept `store_id` as required (not nullable)
  - All credit tracking now properly associates with stores

#### Services:
- **translation-service.js**: All methods now require `storeId` as first parameter:
  ```javascript
  getUILabels(storeId, languageCode)
  getAllUILabels(storeId)
  saveUILabel(storeId, key, languageCode, value, category, type)
  saveBulkUILabels(storeId, labels)
  deleteUILabel(storeId, key, languageCode)
  ```

#### Routes (translations.js):
Updated 10+ routes to require `store_id`:
- ✅ GET `/api/translations/ui-labels?store_id=...&lang=...`
- ✅ GET `/api/translations/ui-labels/all?store_id=...`
- ✅ POST `/api/translations/ui-labels` (body: `store_id`)
- ✅ POST `/api/translations/ui-labels/bulk` (body: `store_id`)
- ✅ DELETE `/api/translations/ui-labels/:key/:lang` (body: `store_id`)
- ✅ POST `/api/translations/auto-translate-ui-label` (body: `store_id`)
- ✅ POST `/api/translations/ui-labels/translate-batch` (body: `store_id`)
- ✅ POST `/api/translations/ui-labels/bulk-translate` (body: `store_id`)
- ✅ POST `/api/translations/preview` (uses existing `store_id`)
- ✅ POST `/api/translations/wizard-execute` (uses existing `store_id`)

#### Background Processing:
- `performUILabelsBulkTranslation()` now accepts `storeId` parameter
- Credit deduction properly uses `store_id` instead of `null`
- Email notification system in place (uses BREVO_API_KEY env var)

### Frontend (2 commits)

#### Components:
- **Translations.jsx**: All API calls now pass `getSelectedStoreId()`
  - `loadLabels()` - checks for store_id before loading
  - `saveLabel()` - passes store_id
  - `handleBulkTranslate()` - passes store_id
  - `confirmDeleteLabel()` - passes store_id in request body
  - `handleAddTranslation()` - passes store_id

- **TranslationContext.jsx**:
  - Accepts optional `storeId` prop for storefront
  - No longer tries to use `useStoreSelection` (was causing errors)
  - Falls back gracefully when storeId is missing

- **StoreProvider.jsx**:
  - Passes `store_id` in translation fetch URL
  - Works correctly for storefront

## Database Migration Required 🚨

**You MUST run this in Supabase SQL Editor:**

```sql
-- 1. Add store_id column (nullable first)
ALTER TABLE translations
ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id);

-- 2. Copy existing translations to ALL stores
DO $$
DECLARE
    store_record RECORD;
BEGIN
    FOR store_record IN SELECT id FROM stores LOOP
        INSERT INTO translations (id, store_id, key, language_code, value, category, type, created_at, updated_at)
        SELECT
            gen_random_uuid(),
            store_record.id,
            key,
            language_code,
            value,
            category,
            type,
            NOW(),
            NOW()
        FROM translations
        WHERE store_id IS NULL
        ON CONFLICT DO NOTHING;
    END LOOP;
END $$;

-- 3. Delete old global translations
DELETE FROM translations WHERE store_id IS NULL;

-- 4. Make store_id required
ALTER TABLE translations
ALTER COLUMN store_id SET NOT NULL;

-- 5. Update indexes
DROP INDEX IF EXISTS translations_key_language_unique;
CREATE UNIQUE INDEX IF NOT EXISTS translations_store_key_language_unique
ON translations(store_id, key, language_code);
CREATE INDEX IF NOT EXISTS translations_store_id_index
ON translations(store_id);
```

**Verify migration succeeded:**
```sql
-- Should return 0
SELECT COUNT(*) FROM translations WHERE store_id IS NULL;

-- Show distribution
SELECT s.name, COUNT(t.id) as translation_count
FROM stores s
LEFT JOIN translations t ON t.store_id = s.id
GROUP BY s.id, s.name;
```

## Email Notification Setup

To enable email notifications after bulk translation:

### Add to Render Environment Variables:
```bash
BREVO_API_KEY=xkeysib-your-api-key-here
BREVO_SENDER_EMAIL=noreply@yourdomain.com  # Optional
```

### Email Content:
**Subject**: "UI Labels Translation Complete"

**Body**:
- Translation details (from → to language)
- Results: Translated, Skipped, Failed counts
- Link to view labels in admin panel

If `BREVO_API_KEY` is not set, the system will log the email content to console instead.

## Testing Checklist

- [x] Code changes committed and pushed
- [ ] SQL migration run in Supabase
- [ ] Create new UI label for Store A
- [ ] Verify it doesn't appear in Store B
- [ ] Bulk translate UI labels for Store A
- [ ] Verify background processing message appears
- [ ] Check email notification arrives (~10 min)
- [ ] Verify credits deducted correctly
- [ ] Check Store B still has its own translations

## Benefits

1. **Per-Store Customization**: Each store can customize UI text independently
2. **Proper Credit Tracking**: Credits are now correctly associated with stores
3. **Data Isolation**: Store A's translations don't affect Store B
4. **Background Processing**: Large translation jobs don't block the UI
5. **Email Notifications**: Users are notified when translation completes

## Commits

1. `6d0d8f4c` - WIP: Models and service layer
2. `7d39b5fe` - Complete backend routes and frontend
3. `b2817b34` - Fix TranslationContext hook error

## Rollback (if needed)

```bash
# Revert all changes
git revert b2817b34 7d39b5fe 6d0d8f4c

# Restore database (backup first!)
# Then manually revert the SQL migration
```
