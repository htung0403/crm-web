-- Migration: Đổi estimated_duration từ phút sang ngày
-- workflow_steps và order_item_steps: lưu số ngày (NUMERIC), dữ liệu cũ chuyển phút -> ngày (chia 1440)

-- =====================================================
-- 1. WORKFLOW_STEPS: phút -> ngày
-- =====================================================
ALTER TABLE workflow_steps
    ALTER COLUMN estimated_duration TYPE NUMERIC(10,2) USING (estimated_duration::numeric / 1440.0);

ALTER TABLE workflow_steps
    ALTER COLUMN estimated_duration SET DEFAULT 1;

COMMENT ON COLUMN workflow_steps.estimated_duration IS 'Thời gian ước tính hoàn thành bước (ngày)';

-- =====================================================
-- 2. ORDER_ITEM_STEPS: phút -> ngày
-- =====================================================
ALTER TABLE order_item_steps
    ALTER COLUMN estimated_duration TYPE NUMERIC(10,2) USING (estimated_duration::numeric / 1440.0);

ALTER TABLE order_item_steps
    ALTER COLUMN estimated_duration SET DEFAULT 1;

COMMENT ON COLUMN order_item_steps.estimated_duration IS 'Thời gian ước tính (ngày)';
