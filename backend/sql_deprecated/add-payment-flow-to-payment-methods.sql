-- Add payment_flow column to payment_methods table to distinguish between online and offline payments
-- Online payments (stripe, paypal): require webhook confirmation before sending order email
-- Offline payments (bank_transfer, cash_on_delivery): can confirm order immediately

-- Add the payment_flow column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'payment_methods' AND column_name = 'payment_flow'
    ) THEN
        ALTER TABLE payment_methods
        ADD COLUMN payment_flow VARCHAR(20) DEFAULT 'offline' CHECK (payment_flow IN ('online', 'offline'));

        -- Set default values based on payment method type
        -- Online payment methods require webhook confirmation
        UPDATE payment_methods SET payment_flow = 'online'
        WHERE type IN ('stripe', 'paypal', 'credit_card', 'debit_card');

        -- Offline payment methods can confirm immediately
        UPDATE payment_methods SET payment_flow = 'offline'
        WHERE type IN ('bank_transfer', 'cash_on_delivery', 'other');

        RAISE NOTICE 'Added payment_flow column to payment_methods table';
    ELSE
        RAISE NOTICE 'payment_flow column already exists in payment_methods table';
    END IF;
END $$;

-- Add index for faster queries on payment_flow
CREATE INDEX IF NOT EXISTS idx_payment_methods_payment_flow ON payment_methods(payment_flow);

-- Add comment
COMMENT ON COLUMN payment_methods.payment_flow IS 'Payment flow type: online (requires webhook confirmation) or offline (immediate confirmation)';
