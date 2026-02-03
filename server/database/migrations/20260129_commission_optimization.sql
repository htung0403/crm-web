-- Migration: Optimize commission calculation by storing commission values in order_items
-- Date: 2026-01-29

-- Add commission columns to order_items table
ALTER TABLE order_items 
ADD COLUMN IF NOT EXISTS commission_sale_rate DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS commission_tech_rate DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS commission_sale_amount DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS commission_tech_amount DECIMAL(15,2) DEFAULT 0;

-- Create index for faster aggregation queries
CREATE INDEX IF NOT EXISTS idx_order_items_technician ON order_items(technician_id);

-- Create view for employee commission summary
CREATE OR REPLACE VIEW v_employee_commissions AS
SELECT 
    o.sales_id as user_id,
    u.name as user_name,
    'sale' as role_type,
    o.id as order_id,
    o.order_code,
    o.status as order_status,
    oi.id as order_item_id,
    oi.item_name,
    oi.item_type,
    oi.total_price,
    oi.commission_sale_rate as commission_rate,
    oi.commission_sale_amount as commission_amount,
    o.created_at,
    o.completed_at
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
JOIN users u ON u.id = o.sales_id
WHERE o.sales_id IS NOT NULL AND oi.commission_sale_amount > 0

UNION ALL

SELECT 
    oi.technician_id as user_id,
    u.name as user_name,
    'technician' as role_type,
    o.id as order_id,
    o.order_code,
    o.status as order_status,
    oi.id as order_item_id,
    oi.item_name,
    oi.item_type,
    oi.total_price,
    oi.commission_tech_rate as commission_rate,
    oi.commission_tech_amount as commission_amount,
    o.created_at,
    o.completed_at
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
JOIN users u ON u.id = oi.technician_id
WHERE oi.technician_id IS NOT NULL AND oi.commission_tech_amount > 0;

-- Add comments
COMMENT ON COLUMN order_items.commission_sale_rate IS 'Commission percentage for sales staff';
COMMENT ON COLUMN order_items.commission_tech_rate IS 'Commission percentage for technicians';
COMMENT ON COLUMN order_items.commission_sale_amount IS 'Calculated commission amount for sales staff';
COMMENT ON COLUMN order_items.commission_tech_amount IS 'Calculated commission amount for technicians';
COMMENT ON VIEW v_employee_commissions IS 'Aggregated view of all employee commissions from orders';
