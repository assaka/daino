# TODO: Complete Store-Specific UI Labels Refactor

## Status: IN PROGRESS

This refactor makes UI labels store-specific instead of global. Each store can now have its own customized UI label translations.

## ✅ Completed

1. **Models Updated**:
   - `Translation` model now includes `store_id` (required)
   - `CreditUsage` model reverted to require `store_id` (all features are now store-specific)
   - New unique index: `(store_id, key, language_code)`

2. **Service Methods Updated**:
   - `translationService.getUILabels(storeId, languageCode)`
   - `translationService.getAllUILabels(storeId)`
   - `translationService.saveUILabel(storeId, key, languageCode, value, category, type)`
   - `translationService.saveBulkUILabels(storeId, labels)`
   - `translationService.deleteUILabel(storeId, key, languageCode)`

3. **Database Migration**:
   - SQL script created: `MIGRATION_UI_LABELS_STORE_SPECIFIC.sql`
   - Run this in Supabase SQL editor to migrate existing data

## ❌ TODO: Update All API Routes

All routes in `backend/src/routes/translations.js` that call translation service methods need to be updated to pass `store_id`:

### Routes to Update:

1. **GET `/api/translations/ui-labels`** (line 19)
   - Add `store_id` to query params
   - Update call: `getUILabels(storeId, lang)`

2. **GET `/api/translations/ui-labels/all`** (line 45)
   - Add `store_id` to query params
   - Update call: `getAllUILabels(storeId)`

3. **POST `/api/translations/ui-labels`** (line 65)
   - Add `store_id` to request body
   - Update call: `saveUILabel(storeId, key, language_code, value, category, type)`

4. **POST `/api/translations/ui-labels/bulk`** (line 100)
   - Add `store_id` to request body
   - Update call: `saveBulkUILabels(storeId, labels)`

5. **DELETE `/api/translations/ui-labels/:key/:languageCode`** (line 132)
   - Add `store_id` to request body or query
   - Update call: `deleteUILabel(storeId, key, languageCode)`

6. **POST `/api/translations/auto-translate-ui-label`** (line 320)
   - Add `store_id` to request body
   - Update all `saveUILabel` calls

7. **POST `/api/translations/ui-labels/translate-batch`** (line 393)
   - Add `store_id` to request body
   - Update all service calls

8. **POST `/api/translations/ui-labels/bulk-translate`** (line 655)
   - Add `store_id` to request body
   - Update background function `performUILabelsBulkTranslation` to accept and use `storeId`
   - Update all `getUILabels` and `saveUILabel` calls

9. **POST `/api/translations/wizard-execute`** (line 1726)
   - Already has `store_id`, update all service calls

## ❌ TODO: Update Frontend

All frontend components that call translation APIs need to pass `store_id`:

### Files to Update:

1. **`src/pages/admin/Translations.jsx`**:
   - `loadLabels()` - pass selectedStoreId
   - `handleSave()` - pass selectedStoreId
   - `handleAddTranslation()` - pass selectedStoreId
   - `handleDeleteLabel()` - pass selectedStoreId
   - `handleBulkTranslate()` - pass selectedStoreId

2. **`src/components/admin/BulkTranslateDialog.jsx`**:
   - Accept `storeId` prop
   - Pass it to `onTranslate` callback

3. **`src/contexts/TranslationContext.jsx`** (if used for fetching):
   - Update to accept/use store context

4. **Any storefront components** that fetch translations:
   - Pass current store's ID

## Database Migration Steps

1. **Backup your database first!**

2. **Run the SQL migration**:
   ```bash
   # In Supabase SQL Editor, run:
   # MIGRATION_UI_LABELS_STORE_SPECIFIC.sql
   ```

3. **Verify the migration**:
   ```sql
   -- Should return 0
   SELECT COUNT(*) FROM translations WHERE store_id IS NULL;

   -- Should show translations per store
   SELECT store_id, COUNT(*) FROM translations GROUP BY store_id;
   ```

## Testing Checklist

After completing all updates:

- [ ] Create a new UI label translation for a specific store
- [ ] Verify it only shows in that store
- [ ] Bulk translate UI labels for one store
- [ ] Verify credits are deducted correctly
- [ ] Verify email notification is sent
- [ ] Test with multiple stores
- [ ] Verify each store has independent translations

## Rollback Plan

If issues occur:

1. Restore database from backup
2. Revert code changes:
   ```bash
   git revert HEAD~3  # Adjust number as needed
   ```

## Estimated Time

- Routes update: ~2 hours
- Frontend update: ~1 hour
- Testing: ~1 hour
- **Total: ~4 hours**

## Notes

- This is a breaking change - all existing code that calls translation APIs will need updates
- Consider creating a feature flag to gradually roll this out
- Existing translations will be duplicated to all stores during migration
- Each store will then be able to customize independently
