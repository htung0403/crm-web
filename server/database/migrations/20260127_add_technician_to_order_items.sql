-- Add technician_id column to order_items table
-- This allows assigning a technician to each service item in an order

ALTER TABLE order_items 
ADD COLUMN IF NOT EXISTS technician_id UUID REFERENCES users(id);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_order_items_technician_id ON order_items(technician_id);

-- Add comments
COMMENT ON COLUMN order_items.technician_id IS 'Technician assigned to perform this service';
