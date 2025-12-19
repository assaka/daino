-- Migration: Create customer records for existing guest orders
-- This migration creates customer records for orders that don't have customer_id

-- Create customers for guest orders and update order customer_id
WITH guest_orders AS (
  SELECT DISTINCT 
    store_id,
    customer_email,
    -- Extract first name from billing or shipping address
    CASE 
      WHEN billing_address->>'full_name' IS NOT NULL AND billing_address->>'full_name' != '' 
      THEN SPLIT_PART(billing_address->>'full_name', ' ', 1)
      WHEN shipping_address->>'full_name' IS NOT NULL AND shipping_address->>'full_name' != ''
      THEN SPLIT_PART(shipping_address->>'full_name', ' ', 1)
      ELSE 'Guest'
    END as first_name,
    -- Extract last name from billing or shipping address
    CASE 
      WHEN billing_address->>'full_name' IS NOT NULL AND billing_address->>'full_name' != '' 
      THEN CASE 
        WHEN array_length(string_to_array(billing_address->>'full_name', ' '), 1) > 1
        THEN array_to_string(array_remove(string_to_array(billing_address->>'full_name', ' '), string_to_array(billing_address->>'full_name', ' ')[1]), ' ')
        ELSE 'Customer'
      END
      WHEN shipping_address->>'full_name' IS NOT NULL AND shipping_address->>'full_name' != ''
      THEN CASE 
        WHEN array_length(string_to_array(shipping_address->>'full_name', ' '), 1) > 1
        THEN array_to_string(array_remove(string_to_array(shipping_address->>'full_name', ' '), string_to_array(shipping_address->>'full_name', ' ')[1]), ' ')
        ELSE 'Customer'
      END
      ELSE 'Customer'
    END as last_name,
    customer_phone,
    SUM(total_amount) as total_spent,
    COUNT(*) as total_orders,
    MAX(created_at) as last_order_date
  FROM orders 
  WHERE customer_id IS NULL 
    AND customer_email IS NOT NULL 
    AND customer_email != ''
  GROUP BY store_id, customer_email, first_name, last_name, customer_phone
),
inserted_customers AS (
  INSERT INTO customers (
    id,
    store_id,
    email,
    first_name,
    last_name,
    phone,
    total_spent,
    total_orders,
    last_order_date,
    notes,
    created_at,
    updated_at
  )
  SELECT 
    gen_random_uuid(),
    store_id,
    customer_email,
    first_name,
    last_name,
    customer_phone,
    total_spent,
    total_orders,
    last_order_date,
    'Auto-created from existing guest order',
    NOW(),
    NOW()
  FROM guest_orders
  ON CONFLICT (store_id, email) DO UPDATE SET
    total_spent = customers.total_spent + EXCLUDED.total_spent,
    total_orders = customers.total_orders + EXCLUDED.total_orders,
    last_order_date = GREATEST(customers.last_order_date, EXCLUDED.last_order_date),
    updated_at = NOW()
  RETURNING id, email, store_id
)
-- Update orders with the new customer IDs
UPDATE orders 
SET customer_id = (
  SELECT c.id 
  FROM customers c 
  WHERE c.store_id = orders.store_id 
    AND c.email = orders.customer_email
)
WHERE customer_id IS NULL 
  AND customer_email IS NOT NULL 
  AND customer_email != '';

-- Report on the migration
SELECT 
  'Migration completed' as status,
  COUNT(*) as orders_updated
FROM orders 
WHERE customer_id IS NOT NULL;