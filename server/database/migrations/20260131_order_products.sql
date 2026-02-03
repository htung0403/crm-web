-- Migration: Thiết kế lại hệ thống đơn hàng cho dịch vụ vệ sinh giày/túi
-- Mô hình mới: Order → OrderProducts (sản phẩm khách) → Services/Packages

-- =====================================================
-- 1. ORDER_PRODUCTS TABLE
-- =====================================================
-- Bảng lưu sản phẩm khách hàng mang đến (giày, túi, ví, ...)
CREATE TABLE IF NOT EXISTS order_products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_code VARCHAR(50) UNIQUE NOT NULL,  -- Mã QR unique
    
    -- Thông tin sản phẩm
    name VARCHAR(255) NOT NULL,                -- "Giày Nike Air Max", "Túi Gucci"
    type VARCHAR(100),                         -- giày, túi, ví, thắt lưng, dép
    brand VARCHAR(100),                        -- Nike, Gucci, LV, Adidas
    color VARCHAR(50),                         -- Đen, Trắng, Nâu
    size VARCHAR(50),                          -- 40, 41, M, L
    material VARCHAR(100),                     -- Da thật, Da tổng hợp, Vải
    
    -- Tình trạng
    condition_before TEXT,                     -- Mô tả tình trạng khi nhận
    images JSONB DEFAULT '[]',                 -- Mảng URL ảnh chụp sản phẩm
    
    -- Ghi chú và trạng thái
    notes TEXT,
    status VARCHAR(20) DEFAULT 'pending' 
        CHECK (status IN ('pending', 'processing', 'completed', 'delivered', 'cancelled')),
    
    -- Timestamps
    received_at TIMESTAMPTZ DEFAULT NOW(),     -- Thời điểm nhận sản phẩm
    completed_at TIMESTAMPTZ,                  -- Thời điểm hoàn thành tất cả dịch vụ
    delivered_at TIMESTAMPTZ,                  -- Thời điểm giao trả khách
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_order_products_order ON order_products(order_id);
CREATE INDEX IF NOT EXISTS idx_order_products_code ON order_products(product_code);
CREATE INDEX IF NOT EXISTS idx_order_products_status ON order_products(status);

-- =====================================================
-- 2. ORDER_PRODUCT_SERVICES TABLE
-- =====================================================
-- Bảng lưu các dịch vụ/gói cho từng sản phẩm khách
CREATE TABLE IF NOT EXISTS order_product_services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_product_id UUID NOT NULL REFERENCES order_products(id) ON DELETE CASCADE,
    
    -- Dịch vụ hoặc Gói (chỉ 1 trong 2)
    service_id UUID REFERENCES services(id),
    package_id UUID REFERENCES packages(id),
    
    -- Thông tin
    item_name VARCHAR(255) NOT NULL,           -- Tên dịch vụ/gói
    item_type VARCHAR(20) NOT NULL CHECK (item_type IN ('service', 'package')),
    unit_price DECIMAL(15,2) NOT NULL DEFAULT 0,
    
    -- Phân công và trạng thái
    technician_id UUID REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'pending' 
        CHECK (status IN ('pending', 'assigned', 'in_progress', 'completed', 'cancelled')),
    
    -- Timing
    assigned_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    -- Ghi chú
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraint: phải có service_id hoặc package_id
    CONSTRAINT service_or_package CHECK (
        (service_id IS NOT NULL AND package_id IS NULL) OR
        (service_id IS NULL AND package_id IS NOT NULL)
    )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_order_product_services_product ON order_product_services(order_product_id);
CREATE INDEX IF NOT EXISTS idx_order_product_services_service ON order_product_services(service_id);
CREATE INDEX IF NOT EXISTS idx_order_product_services_package ON order_product_services(package_id);
CREATE INDEX IF NOT EXISTS idx_order_product_services_technician ON order_product_services(technician_id);
CREATE INDEX IF NOT EXISTS idx_order_product_services_status ON order_product_services(status);

-- =====================================================
-- 3. TRIGGERS FOR UPDATED_AT
-- =====================================================
CREATE OR REPLACE FUNCTION update_order_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_order_products_updated_at ON order_products;
CREATE TRIGGER trigger_order_products_updated_at
    BEFORE UPDATE ON order_products
    FOR EACH ROW
    EXECUTE FUNCTION update_order_products_updated_at();

-- =====================================================
-- 4. COMMENTS
-- =====================================================
COMMENT ON TABLE order_products IS 'Sản phẩm khách hàng mang đến để vệ sinh/bảo dưỡng (giày, túi, ví, ...)';
COMMENT ON TABLE order_product_services IS 'Các dịch vụ/gói dịch vụ cho từng sản phẩm khách';
COMMENT ON COLUMN order_products.product_code IS 'Mã QR unique cho từng sản phẩm';
COMMENT ON COLUMN order_products.images IS 'JSON array chứa URLs ảnh sản phẩm';
COMMENT ON COLUMN order_products.condition_before IS 'Mô tả tình trạng sản phẩm khi nhận từ khách';
