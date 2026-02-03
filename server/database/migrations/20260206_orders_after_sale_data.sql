-- After-sale data: ảnh hoàn thiện, kiểm nợ, ảnh đóng gói, giao hàng, nhắn HD & feedback
ALTER TABLE orders ADD COLUMN IF NOT EXISTS completion_photos JSONB DEFAULT '[]';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS debt_checked BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS debt_checked_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS debt_checked_notes TEXT;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS packaging_photos JSONB DEFAULT '[]';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_carrier VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_address TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_self_pickup BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_notes TEXT;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS hd_sent BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS hd_sent_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS feedback_requested BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS feedback_requested_at TIMESTAMPTZ;

COMMENT ON COLUMN orders.completion_photos IS 'URLs ảnh hoàn thiện (After1)';
COMMENT ON COLUMN orders.debt_checked IS 'Đã kiểm tra công nợ (After1)';
COMMENT ON COLUMN orders.packaging_photos IS 'URLs ảnh đóng gói (After2)';
COMMENT ON COLUMN orders.delivery_self_pickup IS 'Khách tự đến lấy (After2)';
COMMENT ON COLUMN orders.hd_sent IS 'Đã nhắn hướng dẫn (After3)';
COMMENT ON COLUMN orders.feedback_requested IS 'Đã xin feedback (After3)';
