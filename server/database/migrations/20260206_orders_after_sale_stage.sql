-- After-sale pipeline stage for orders (Kiểm nợ & Ảnh → Đóng gói & Giao hàng → Nhắn HD & Feedback → Lưu Trữ)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS after_sale_stage VARCHAR(50) NULL;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_after_sale_stage_check;
ALTER TABLE orders ADD CONSTRAINT orders_after_sale_stage_check
    CHECK (after_sale_stage IS NULL OR after_sale_stage IN ('after1', 'after2', 'after3', 'after4'));
COMMENT ON COLUMN orders.after_sale_stage IS 'After-sale pipeline: after1=Kiểm nợ & Ảnh, after2=Đóng gói & Giao hàng, after3=Nhắn HD & Feedback, after4=Lưu Trữ';
