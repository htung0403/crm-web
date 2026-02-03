-- Chăm sóc / Bảo hành: flow + stage trên orders, lịch sử chuyển bước

-- 1. Cột trên orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS care_warranty_flow VARCHAR(20) NULL
    CHECK (care_warranty_flow IS NULL OR care_warranty_flow IN ('warranty', 'care'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS care_warranty_stage VARCHAR(50) NULL
    CHECK (care_warranty_stage IS NULL OR care_warranty_stage IN ('war1', 'war2', 'war3', 'care6', 'care12', 'care-custom'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS care_warranty_started_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN orders.care_warranty_flow IS 'warranty = Bảo hành (Khách chê), care = Chăm sóc (Khách khen)';
COMMENT ON COLUMN orders.care_warranty_stage IS 'war1-war3 (Bảo hành), care6/care12/care-custom (Chăm sóc)';

-- 2. Bảng log lịch sử chuyển bước Chăm sóc/Bảo hành
CREATE TABLE IF NOT EXISTS order_care_warranty_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    from_stage VARCHAR(50),
    to_stage VARCHAR(50) NOT NULL,
    flow_type VARCHAR(20) NOT NULL CHECK (flow_type IN ('warranty', 'care')),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_order_care_warranty_log_order ON order_care_warranty_log(order_id);
CREATE INDEX IF NOT EXISTS idx_order_care_warranty_log_created ON order_care_warranty_log(created_at DESC);

COMMENT ON TABLE order_care_warranty_log IS 'Lịch sử chuyển bước Chăm sóc/Bảo hành: war1-war3, care6/care12/care-custom';
