-- Add step1, step2, step3, step4, step5 to order_items.status and order_products.status check constraints

-- 1. Update order_items status check constraint
ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_status_check;
ALTER TABLE order_items ADD CONSTRAINT order_items_status_check 
    CHECK (status IN ('pending', 'assigned', 'in_progress', 'completed', 'cancelled', 'step1', 'step2', 'step3', 'step4', 'step5'));

-- 2. Update order_products status check constraint
ALTER TABLE order_products DROP CONSTRAINT order_products_status_check;
ALTER TABLE order_products ADD CONSTRAINT order_products_status_check 
    CHECK (status IN ('pending', 'processing', 'completed', 'delivered', 'cancelled', 'step1', 'step2', 'step3', 'step4', 'step5'));

-- 3. Update order_product_services status check constraint (for V2)
ALTER TABLE order_product_services DROP CONSTRAINT IF EXISTS order_product_services_status_check;
ALTER TABLE order_product_services ADD CONSTRAINT order_product_services_status_check 
    CHECK (status IN ('pending', 'assigned', 'in_progress', 'completed', 'cancelled', 'step1', 'step2', 'step3', 'step4', 'step5'));

-- 4. Add updated_at if missing
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE order_product_services ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 5. Ensure order_products has correct constraint
ALTER TABLE order_products DROP CONSTRAINT IF EXISTS order_products_status_check;
ALTER TABLE order_products ADD CONSTRAINT order_products_status_check 
    CHECK (status IN ('pending', 'processing', 'completed', 'delivered', 'cancelled', 'step1', 'step2', 'step3', 'step4', 'step5'));
