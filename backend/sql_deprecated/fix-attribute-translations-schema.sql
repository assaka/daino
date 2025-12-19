-- Fix attribute_translations table schema
-- Problem: attribute_id was incorrectly set as PRIMARY KEY with auto-generated UUID
-- Solution: Add proper id column, make attribute_id a foreign key, add unique constraint

-- Step 1: Rename old table if it exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'attribute_translations') THEN
    ALTER TABLE attribute_translations RENAME TO attribute_translations_old;
  END IF;
END $$;

-- Step 2: Create new attribute_translations table with correct schema
CREATE TABLE IF NOT EXISTS attribute_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attribute_id UUID NOT NULL,
  language_code VARCHAR(10) NOT NULL,
  label VARCHAR(255),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(attribute_id, language_code)
);

-- Step 3: Migrate data from old table if it exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'attribute_translations_old') THEN
    -- Insert old data into new table (attribute_id in old table contains actual attribute IDs if any translations exist)
    INSERT INTO attribute_translations (attribute_id, language_code, label, description, created_at, updated_at)
    SELECT attribute_id, language_code, label, description, created_at, updated_at
    FROM attribute_translations_old
    WHERE attribute_id IN (SELECT id FROM attributes)
    ON CONFLICT (attribute_id, language_code) DO NOTHING;

    -- Drop old table
    DROP TABLE attribute_translations_old;
  END IF;
END $$;

-- Step 4: Add foreign key constraint (only if attributes table exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_attribute_translations_attribute_id'
  ) THEN
    ALTER TABLE attribute_translations
    ADD CONSTRAINT fk_attribute_translations_attribute_id
    FOREIGN KEY (attribute_id) REFERENCES attributes(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not add foreign key constraint: %', SQLERRM;
END $$;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_attribute_translations_attribute_id ON attribute_translations(attribute_id);
CREATE INDEX IF NOT EXISTS idx_attribute_translations_language ON attribute_translations(language_code);

-- ============================================
-- Fix attribute_value_translations table schema
-- Same issue: attribute_value_id was incorrectly set as PRIMARY KEY
-- ============================================

-- Step 1: Rename old table if it exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'attribute_value_translations') THEN
    ALTER TABLE attribute_value_translations RENAME TO attribute_value_translations_old;
  END IF;
END $$;

-- Step 2: Create new attribute_value_translations table with correct schema
CREATE TABLE IF NOT EXISTS attribute_value_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attribute_value_id UUID NOT NULL,
  language_code VARCHAR(10) NOT NULL,
  value VARCHAR(255),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(attribute_value_id, language_code)
);

-- Step 3: Migrate data from old table if it exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'attribute_value_translations_old') THEN
    -- Insert old data into new table
    INSERT INTO attribute_value_translations (attribute_value_id, language_code, value, description, created_at, updated_at)
    SELECT attribute_value_id, language_code, value, description, created_at, updated_at
    FROM attribute_value_translations_old
    WHERE attribute_value_id IN (SELECT id FROM attribute_values)
    ON CONFLICT (attribute_value_id, language_code) DO NOTHING;

    -- Drop old table
    DROP TABLE attribute_value_translations_old;
  END IF;
END $$;

-- Step 4: Add foreign key constraint (only if attribute_values table exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_attribute_value_translations_value_id'
  ) THEN
    ALTER TABLE attribute_value_translations
    ADD CONSTRAINT fk_attribute_value_translations_value_id
    FOREIGN KEY (attribute_value_id) REFERENCES attribute_values(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not add foreign key constraint: %', SQLERRM;
END $$;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_attribute_value_translations_value_id ON attribute_value_translations(attribute_value_id);
CREATE INDEX IF NOT EXISTS idx_attribute_value_translations_language ON attribute_value_translations(language_code);
