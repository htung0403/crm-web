-- Add status and timing columns to order_items table
-- This allows tracking the processing status of each item independently

-- Add status column with enum check
ALTER TABLE order_items 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending' 
CHECK (status IN ('pending', 'assigned', 'in_progress', 'completed', 'cancelled'));

-- Add assigned_at column to track when technician was assigned
ALTER TABLE order_items 
ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE;

-- Add started_at column to track when work began
ALTER TABLE order_items 
ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE;

-- Add completed_at column to track when work finished
ALTER TABLE order_items 
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;

-- Create index for status queries
CREATE INDEX IF NOT EXISTS idx_order_items_status ON order_items(status);

-- Add comments for documentation
COMMENT ON COLUMN order_items.status IS 'Processing status: pending, assigned, in_progress, completed, cancelled';
COMMENT ON COLUMN order_items.assigned_at IS 'Timestamp when the technician was assigned to this item';
COMMENT ON COLUMN order_items.started_at IS 'Timestamp when the technician started working on this item';
COMMENT ON COLUMN order_items.completed_at IS 'Timestamp when the technician completed this item';

-- Update existing items based on order status and technician assignment
UPDATE order_items oi
SET 
    status = CASE 
        WHEN o.status = 'completed' THEN 'completed'
        WHEN o.status = 'cancelled' THEN 'cancelled'
        WHEN oi.technician_id IS NOT NULL AND o.status = 'processing' THEN 'in_progress'
        WHEN oi.technician_id IS NOT NULL THEN 'assigned'
        ELSE 'pending'
    END,
    assigned_at = CASE WHEN oi.technician_id IS NOT NULL THEN o.created_at ELSE NULL END,
    started_at = CASE WHEN oi.technician_id IS NOT NULL AND o.status = 'processing' THEN o.updated_at ELSE NULL END,
    completed_at = CASE WHEN o.status = 'completed' THEN o.completed_at ELSE NULL END
FROM orders o
WHERE oi.order_id = o.id;
