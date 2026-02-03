-- Lịch sử chuyển trạng thái Kanban: Sales, Workflow, After sale
-- Mỗi tab lưu riêng: ai chuyển, lúc nào, từ/đến trạng thái gì

-- 1. Sales tab: lịch sử chuyển bước Lên đơn (step1 -> step2 -> ... -> step5)
CREATE TABLE IF NOT EXISTS order_item_status_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    entity_type VARCHAR(30) NOT NULL CHECK (entity_type IN ('order_item', 'order_product_service', 'order_product')),
    entity_id UUID NOT NULL,
    from_status VARCHAR(50),
    to_status VARCHAR(50) NOT NULL,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_order_item_status_log_order ON order_item_status_log(order_id);
CREATE INDEX IF NOT EXISTS idx_order_item_status_log_created ON order_item_status_log(created_at DESC);

-- 2. After sale tab: lịch sử chuyển giai đoạn After sale (after1 -> after2 -> after3 -> after4)
CREATE TABLE IF NOT EXISTS order_after_sale_stage_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    from_stage VARCHAR(50),
    to_stage VARCHAR(50) NOT NULL,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_order_after_sale_stage_log_order ON order_after_sale_stage_log(order_id);
CREATE INDEX IF NOT EXISTS idx_order_after_sale_stage_log_created ON order_after_sale_stage_log(created_at DESC);

-- 3. Workflow tab: lịch sử hoàn thành/bắt đầu/bỏ qua bước quy trình (3 phòng)
CREATE TABLE IF NOT EXISTS order_workflow_step_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_item_step_id UUID NOT NULL REFERENCES order_item_steps(id) ON DELETE CASCADE,
    action VARCHAR(20) NOT NULL CHECK (action IN ('started', 'completed', 'skipped')),
    step_name VARCHAR(255),
    step_order INTEGER,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_order_workflow_step_log_step ON order_workflow_step_log(order_item_step_id);
CREATE INDEX IF NOT EXISTS idx_order_workflow_step_log_created ON order_workflow_step_log(created_at DESC);

COMMENT ON TABLE order_item_status_log IS 'Lịch sử chuyển bước Lên đơn (Sales Kanban): step1-step5';
COMMENT ON TABLE order_after_sale_stage_log IS 'Lịch sử chuyển giai đoạn After sale: after1-after4';
COMMENT ON TABLE order_workflow_step_log IS 'Lịch sử bước quy trình kỹ thuật: started/completed/skipped';
