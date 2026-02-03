-- Migration: Create order_item_steps table for tracking workflow progress
-- This table stores the individual workflow steps for each order item

-- =====================================================
-- 1. ORDER_ITEM_STEPS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS order_item_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    workflow_step_id UUID REFERENCES workflow_steps(id) ON DELETE SET NULL,
    step_order INTEGER NOT NULL,
    step_name VARCHAR(255) NOT NULL,
    department_id UUID REFERENCES departments(id),
    
    -- Assignment & Status
    status VARCHAR(20) DEFAULT 'pending' 
        CHECK (status IN ('pending', 'assigned', 'in_progress', 'completed', 'skipped')),
    technician_id UUID REFERENCES users(id),
    
    -- Timing
    estimated_duration INTEGER DEFAULT 60,  -- minutes
    assigned_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    -- Additional info
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(order_item_id, step_order)
);

-- =====================================================
-- 2. INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_order_item_steps_order_item ON order_item_steps(order_item_id);
CREATE INDEX IF NOT EXISTS idx_order_item_steps_status ON order_item_steps(status);
CREATE INDEX IF NOT EXISTS idx_order_item_steps_technician ON order_item_steps(technician_id);
CREATE INDEX IF NOT EXISTS idx_order_item_steps_department ON order_item_steps(department_id);

-- =====================================================
-- 3. TRIGGER FOR UPDATED_AT
-- =====================================================
CREATE OR REPLACE FUNCTION update_order_item_steps_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_order_item_steps_updated_at ON order_item_steps;
CREATE TRIGGER trigger_order_item_steps_updated_at
    BEFORE UPDATE ON order_item_steps
    FOR EACH ROW
    EXECUTE FUNCTION update_order_item_steps_updated_at();

-- =====================================================
-- 4. COMMENTS
-- =====================================================
COMMENT ON TABLE order_item_steps IS 'Bảng lưu các bước xử lý cho từng order item theo workflow';
COMMENT ON COLUMN order_item_steps.step_order IS 'Thứ tự thực hiện của bước';
COMMENT ON COLUMN order_item_steps.status IS 'Trạng thái: pending, assigned, in_progress, completed, skipped';
COMMENT ON COLUMN order_item_steps.estimated_duration IS 'Thời gian ước tính (phút)';
