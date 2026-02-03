-- Add item_code column to order_items for QR code scanning
-- Each order item will have a unique code that can be encoded in a QR

ALTER TABLE order_items 
ADD COLUMN IF NOT EXISTS item_code VARCHAR(20) UNIQUE;

-- Generate item codes for existing records (run once)
DO $$
DECLARE
    r RECORD;
    new_code VARCHAR(20);
BEGIN
    FOR r IN SELECT id FROM order_items WHERE item_code IS NULL
    LOOP
        new_code := 'IT' || LPAD(FLOOR(RANDOM() * 10000000000)::TEXT, 10, '0');
        UPDATE order_items SET item_code = new_code WHERE id = r.id;
    END LOOP;
END $$;

-- Create index for fast lookup by item_code
CREATE INDEX IF NOT EXISTS idx_order_items_item_code ON order_items(item_code);

-- Also add item_code to technician_tasks for direct task lookup
ALTER TABLE technician_tasks 
ADD COLUMN IF NOT EXISTS item_code VARCHAR(20);

-- Create index for technician_tasks item_code
CREATE INDEX IF NOT EXISTS idx_technician_tasks_item_code ON technician_tasks(item_code);

-- Add comments
COMMENT ON COLUMN order_items.item_code IS 'Unique code for QR scanning, format: ITxxxxxxxxxx';
COMMENT ON COLUMN technician_tasks.item_code IS 'Code linked to order_items.item_code for QR lookup';
