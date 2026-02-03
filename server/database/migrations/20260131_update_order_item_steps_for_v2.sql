-- Migration: Update order_item_steps to support V2 services (order_product_services)
-- Run this in Supabase SQL Editor

-- 1. Add order_product_service_id column
ALTER TABLE order_item_steps 
ADD COLUMN IF NOT EXISTS order_product_service_id UUID REFERENCES order_product_services(id) ON DELETE CASCADE;

-- 2. Make order_item_id nullable (since V2 steps won't have it)
ALTER TABLE order_item_steps 
ALTER COLUMN order_item_id DROP NOT NULL;

-- 3. Add constraint to ensure one and only one source is set
-- Note: We use a name 'check_step_source' for the constraint
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_step_source') THEN
        ALTER TABLE order_item_steps
        ADD CONSTRAINT check_step_source CHECK (
            (order_item_id IS NOT NULL AND order_product_service_id IS NULL) OR
            (order_item_id IS NULL AND order_product_service_id IS NOT NULL)
        );
    END IF;
END $$;

-- 4. status enum check update (if needed, but existing values seem compatible)
-- 'pending', 'assigned', 'in_progress', 'completed', 'skipped' match typical flow.

-- 5. Create index for performance
CREATE INDEX IF NOT EXISTS idx_order_item_steps_service_v2 ON order_item_steps(order_product_service_id);

-- 6. Comments
COMMENT ON COLUMN order_item_steps.order_product_service_id IS 'Liên kết đến dịch vụ trong đơn hàng V2';
