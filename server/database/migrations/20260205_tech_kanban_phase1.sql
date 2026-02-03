-- Phase 1: Kanban Kỹ thuật - due_at, accessories, partner, extension requests
-- 1. Add orders.due_at for SLA (còn X ngày / trễ X ngày)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ;

-- 2. Order item accessories (Mua phụ kiện: Cần mua → Đã mua → Chờ ship → Ship tới → Giao kỹ thuật)
CREATE TABLE IF NOT EXISTS order_item_accessories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL CHECK (status IN ('need_buy', 'bought', 'waiting_ship', 'shipped', 'delivered_to_tech')),
    notes TEXT,
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_order_item_accessories_order_item ON order_item_accessories(order_item_id);

-- 3. Order item partner (Gửi Đối Tác: Ship đối tác → Đối tác làm → Ship về Shop → Done)
CREATE TABLE IF NOT EXISTS order_item_partner (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL CHECK (status IN ('ship_to_partner', 'partner_doing', 'ship_back', 'done')),
    notes TEXT,
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_order_item_partner_order_item ON order_item_partner(order_item_id);

-- 4. Order extension requests (Xin gia hạn)
CREATE TABLE IF NOT EXISTS order_extension_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    requested_by UUID NOT NULL REFERENCES users(id),
    reason TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'sale_contacted', 'manager_approved', 'notified_tech', 'kpi_recorded')),
    customer_result TEXT,
    new_due_at TIMESTAMPTZ,
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    valid_reason BOOLEAN DEFAULT false,
    kpi_late_recorded BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_order_extension_requests_order ON order_extension_requests(order_id);

COMMENT ON COLUMN orders.due_at IS 'Deadline for order delivery / KPI (used for SLA display: còn X ngày / trễ X ngày)';
COMMENT ON TABLE order_item_accessories IS 'Mua phụ kiện flow: need_buy → bought → waiting_ship → shipped → delivered_to_tech';
COMMENT ON TABLE order_item_partner IS 'Gửi Đối Tác flow: ship_to_partner → partner_doing → ship_back → done';
COMMENT ON TABLE order_extension_requests IS 'Xin gia hạn: requested → sale_contacted → manager_approved → notified_tech → kpi_recorded';
