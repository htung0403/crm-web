-- Support Mua phụ kiện / Gửi Đối Tác for V2 items (order_product_services)
-- Allow order_item_accessories and order_item_partner to reference either order_items or order_product_services

-- 1. order_item_accessories: add order_product_service_id, make order_item_id nullable
ALTER TABLE order_item_accessories
    ADD COLUMN IF NOT EXISTS order_product_service_id UUID REFERENCES order_product_services(id) ON DELETE CASCADE;
ALTER TABLE order_item_accessories
    ALTER COLUMN order_item_id DROP NOT NULL;
ALTER TABLE order_item_accessories
    DROP CONSTRAINT IF EXISTS chk_accessory_source;
ALTER TABLE order_item_accessories
    ADD CONSTRAINT chk_accessory_source CHECK (
        (order_item_id IS NOT NULL AND order_product_service_id IS NULL)
        OR (order_item_id IS NULL AND order_product_service_id IS NOT NULL)
    );
CREATE INDEX IF NOT EXISTS idx_order_item_accessories_order_product_service ON order_item_accessories(order_product_service_id);

-- 2. order_item_partner: same
ALTER TABLE order_item_partner
    ADD COLUMN IF NOT EXISTS order_product_service_id UUID REFERENCES order_product_services(id) ON DELETE CASCADE;
ALTER TABLE order_item_partner
    ALTER COLUMN order_item_id DROP NOT NULL;
ALTER TABLE order_item_partner
    DROP CONSTRAINT IF EXISTS chk_partner_source;
ALTER TABLE order_item_partner
    ADD CONSTRAINT chk_partner_source CHECK (
        (order_item_id IS NOT NULL AND order_product_service_id IS NULL)
        OR (order_item_id IS NULL AND order_product_service_id IS NOT NULL)
    );
CREATE INDEX IF NOT EXISTS idx_order_item_partner_order_product_service ON order_item_partner(order_product_service_id);
