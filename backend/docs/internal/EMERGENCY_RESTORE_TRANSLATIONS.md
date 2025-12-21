# EMERGENCY: Restore Lost Translations

## The Problem
The migration deleted all translations because:
1. The `INSERT ... ON CONFLICT DO NOTHING` likely failed due to existing unique index
2. The `DELETE WHERE store_id IS NULL` then removed all old records
3. Result: Empty translations table

## IMMEDIATE RECOVERY OPTIONS

### Option 1: Supabase Point-in-Time Recovery (RECOMMENDED)

1. Go to Supabase Dashboard
2. Navigate to: **Database → Backups**
3. Find a backup from **before** you ran the migration (within last few hours)
4. Click **"Restore to point in time"**
5. Select the timestamp just before the migration
6. Confirm restore

**This is the safest and fastest option!**

### Option 2: Check Supabase Transaction Log

If backups aren't available:

```sql
-- Try to see recent DELETE operations
SELECT * FROM pg_stat_statements
WHERE query LIKE '%DELETE%translations%'
ORDER BY calls DESC
LIMIT 10;
```

### Option 3: Start Fresh with Default Translations

If you can't restore, I'll help you create a script to populate default English translations for all stores.

## After Recovery: Run THIS Safer Migration

Once translations are restored, use this corrected migration:

```sql
-- SAFER MIGRATION SCRIPT
-- Run each step separately and verify before continuing

-- Step 1: Add column (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'translations' AND column_name = 'store_id'
  ) THEN
    ALTER TABLE translations ADD COLUMN store_id UUID REFERENCES stores(id);
  END IF;
END $$;

-- Step 2: VERIFY - should show store_id column
SELECT column_name, is_nullable FROM information_schema.columns
WHERE table_name = 'translations' AND column_name IN ('key', 'language_code', 'store_id');

-- Step 3: Drop the old unique index FIRST (this is what caused the conflict)
DROP INDEX IF EXISTS translations_key_language_unique;

-- Step 4: VERIFY - index should be gone
SELECT indexname FROM pg_indexes WHERE tablename = 'translations';

-- Step 5: Copy translations to ALL stores
DO $$
DECLARE
    store_record RECORD;
    translation_record RECORD;
    inserted_count INTEGER := 0;
BEGIN
    RAISE NOTICE 'Starting migration...';

    FOR store_record IN SELECT id, name FROM stores ORDER BY name
    LOOP
        RAISE NOTICE 'Processing store: %', store_record.name;

        FOR translation_record IN
            SELECT key, language_code, value, category, type
            FROM translations
            WHERE store_id IS NULL
        LOOP
            BEGIN
                INSERT INTO translations (
                    id, store_id, key, language_code, value, category, type, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(),
                    store_record.id,
                    translation_record.key,
                    translation_record.language_code,
                    translation_record.value,
                    translation_record.category,
                    translation_record.type,
                    NOW(),
                    NOW()
                );
                inserted_count := inserted_count + 1;
            EXCEPTION WHEN unique_violation THEN
                -- Skip duplicates silently
                NULL;
            END;
        END LOOP;
    END LOOP;

    RAISE NOTICE 'Inserted % translations', inserted_count;
END $$;

-- Step 6: VERIFY - should show translations for each store
SELECT s.name, COUNT(t.id) as translation_count
FROM stores s
LEFT JOIN translations t ON t.store_id = s.id
GROUP BY s.id, s.name
ORDER BY translation_count DESC;

-- Step 7: ONLY DELETE if Step 6 shows translations exist!
-- DELETE FROM translations WHERE store_id IS NULL;

-- Step 8: Make store_id required
-- ALTER TABLE translations ALTER COLUMN store_id SET NOT NULL;

-- Step 9: Create new unique index
-- CREATE UNIQUE INDEX translations_store_key_language_unique
-- ON translations(store_id, key, language_code);

-- Step 10: Add store_id index
-- CREATE INDEX translations_store_id_index ON translations(store_id);
```

## Next Steps

1. **First**: Try Supabase backup restore
2. **Then**: Run the safer migration script above
3. **Verify**: Each step before proceeding to the next

Let me know which option you want to pursue!
