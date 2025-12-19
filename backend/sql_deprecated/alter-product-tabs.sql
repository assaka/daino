-- Alter existing product_tabs table to add missing columns
-- This handles the case where product_tabs table exists but is missing new columns

-- Add tab_type column if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'product_tabs' AND column_name = 'tab_type'
    ) THEN
        ALTER TABLE product_tabs ADD COLUMN tab_type VARCHAR(20) DEFAULT 'text' NOT NULL;
        ALTER TABLE product_tabs ADD CONSTRAINT check_tab_type CHECK (tab_type IN ('text', 'description', 'attributes', 'attribute_sets'));
    END IF;
END $$;

-- Add content column if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'product_tabs' AND column_name = 'content'
    ) THEN
        ALTER TABLE product_tabs ADD COLUMN content TEXT;
    END IF;
END $$;

-- Add attribute_ids column if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'product_tabs' AND column_name = 'attribute_ids'
    ) THEN
        ALTER TABLE product_tabs ADD COLUMN attribute_ids JSONB DEFAULT '[]';
    END IF;
END $$;

-- Add attribute_set_ids column if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'product_tabs' AND column_name = 'attribute_set_ids'
    ) THEN
        ALTER TABLE product_tabs ADD COLUMN attribute_set_ids JSONB DEFAULT '[]';
    END IF;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_product_tabs_tab_type ON product_tabs(tab_type);

SELECT 'Product tabs table columns added successfully!' as message;