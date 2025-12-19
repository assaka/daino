-- Add sort_order column to product_labels table
-- This allows controlling the display order of labels when multiple labels match a product

-- Add sort_order column if it doesn't exist
DO $ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'product_labels' AND column_name = 'sort_order'
    ) THEN
        ALTER TABLE product_labels ADD COLUMN sort_order INTEGER DEFAULT 0 NOT NULL;
        
        -- Create index for better performance when ordering
        CREATE INDEX IF NOT EXISTS idx_product_labels_sort_order ON product_labels(sort_order);
        
        -- Update existing labels to have sort_order = priority for consistency
        UPDATE product_labels SET sort_order = priority WHERE sort_order = 0;
        
        RAISE NOTICE 'Added sort_order column to product_labels table';
    ELSE
        RAISE NOTICE 'sort_order column already exists in product_labels table';
    END IF;
END $;

SELECT 'Migration completed: add-sort-order-to-product-labels' as message;