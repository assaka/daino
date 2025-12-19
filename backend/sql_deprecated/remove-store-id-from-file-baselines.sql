-- Remove store_id column from file_baselines table since baselines are global
-- Migration: remove-store-id-from-file-baselines

DO $$
BEGIN
    -- Check if store_id column exists before attempting to drop it
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'file_baselines' 
        AND column_name = 'store_id'
    ) THEN
        -- First, let's check if there are any constraints we need to drop
        -- Drop any foreign key constraints that might exist
        BEGIN
            ALTER TABLE file_baselines DROP CONSTRAINT IF EXISTS file_baselines_store_id_fkey;
        EXCEPTION
            WHEN undefined_object THEN NULL;
        END;
        
        -- Drop any indexes that might exist on store_id
        BEGIN
            DROP INDEX IF EXISTS idx_file_baselines_store_id;
        EXCEPTION
            WHEN undefined_object THEN NULL;
        END;
        
        -- Drop the unique constraint that includes store_id (if it exists)
        BEGIN
            ALTER TABLE file_baselines DROP CONSTRAINT IF EXISTS file_baselines_store_id_file_path_version_key;
        EXCEPTION
            WHEN undefined_object THEN NULL;
        END;
        
        -- Now drop the column
        ALTER TABLE file_baselines DROP COLUMN store_id;
        
        -- Create a new unique constraint on file_path and version only
        ALTER TABLE file_baselines 
        ADD CONSTRAINT file_baselines_file_path_version_key 
        UNIQUE (file_path, version);
        
        RAISE NOTICE 'Successfully removed store_id column from file_baselines table';
    ELSE
        RAISE NOTICE 'store_id column does not exist in file_baselines table - skipping';
    END IF;
END $$;