-- Migration: Add payment and discount fields to orders table
-- Date: 2026-02-02

-- Add discount type column (amount or percent)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_type VARCHAR(20) DEFAULT 'amount';

-- Add original discount value (before calculation)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_value DECIMAL(15, 2) DEFAULT 0;

-- Add surcharges as JSONB array
ALTER TABLE orders ADD COLUMN IF NOT EXISTS surcharges JSONB DEFAULT '[]'::jsonb;

-- Add total surcharges amount
ALTER TABLE orders ADD COLUMN IF NOT EXISTS surcharges_amount DECIMAL(15, 2) DEFAULT 0;

-- Add paid amount (amount customer has paid)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(15, 2) DEFAULT 0;

-- Add remaining debt (total - paid)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS remaining_debt DECIMAL(15, 2) DEFAULT 0;

-- Add payment status (unpaid, partial, paid)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'unpaid';

-- Add index for payment status for quick filtering
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);

-- Update existing orders to have correct payment status based on existing data
UPDATE orders 
SET 
    paid_amount = COALESCE(paid_amount, 0),
    remaining_debt = COALESCE(total_amount, 0) - COALESCE(paid_amount, 0),
    payment_status = CASE 
        WHEN COALESCE(paid_amount, 0) >= COALESCE(total_amount, 0) THEN 'paid'
        WHEN COALESCE(paid_amount, 0) > 0 THEN 'partial'
        ELSE 'unpaid'
    END
WHERE payment_status IS NULL OR discount_type IS NULL;
