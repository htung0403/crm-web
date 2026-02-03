-- Add confirmed_at to orders: timestamp when manager confirms the order (status -> 'confirmed')
ALTER TABLE orders ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
