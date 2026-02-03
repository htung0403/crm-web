-- Migration: Hỗ trợ nhiều kỹ thuật viên cho mỗi dịch vụ
-- Tạo bảng junction cho quan hệ many-to-many giữa order_product_services và users (technicians)

-- =====================================================
-- 1. ORDER_PRODUCT_SERVICE_TECHNICIANS TABLE
-- =====================================================
-- Bảng lưu nhiều kỹ thuật viên cho mỗi dịch vụ
CREATE TABLE IF NOT EXISTS order_product_service_technicians (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_product_service_id UUID NOT NULL REFERENCES order_product_services(id) ON DELETE CASCADE,
    technician_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Thông tin phân công
    commission DECIMAL(5,2) DEFAULT 0,           -- Phần trăm hoa hồng cho kỹ thuật viên này
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    assigned_by UUID REFERENCES users(id),
    
    -- Trạng thái công việc của kỹ thuật viên này
    status VARCHAR(20) DEFAULT 'assigned' 
        CHECK (status IN ('assigned', 'in_progress', 'completed', 'cancelled')),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    -- Ghi chú
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Mỗi kỹ thuật viên chỉ được phân công 1 lần cho mỗi dịch vụ
    UNIQUE(order_product_service_id, technician_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_opst_service ON order_product_service_technicians(order_product_service_id);
CREATE INDEX IF NOT EXISTS idx_opst_technician ON order_product_service_technicians(technician_id);
CREATE INDEX IF NOT EXISTS idx_opst_status ON order_product_service_technicians(status);

-- =====================================================
-- 2. ENABLE RLS (nếu cần)
-- =====================================================
-- ALTER TABLE order_product_service_technicians ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 3. COMMENTS
-- =====================================================
COMMENT ON TABLE order_product_service_technicians IS 'Bảng junction lưu nhiều kỹ thuật viên cho mỗi dịch vụ';
COMMENT ON COLUMN order_product_service_technicians.commission IS 'Phần trăm hoa hồng cho kỹ thuật viên này (0-100)';
