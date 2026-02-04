-- CRM Database Schema for Supabase
-- Consolidated from migrations (current as of 2026-02-02)

-- =====================================================
-- EXTENSIONS & CONFIGURATION
-- =====================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. UTILITY FUNCTIONS
-- =====================================================
-- Trigger function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 2. CORE TABLES (Departments, Users, Workflows)
-- =====================================================

-- DEPARTMENTS
CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    manager_id UUID, -- Circular reference handled later or allowed null
    status VARCHAR(50) DEFAULT 'active', -- active, inactive
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- WORKFLOWS
CREATE TABLE workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,          -- QT001, QT002...
    name VARCHAR(255) NOT NULL,                 -- "Quy trình lắp đặt camera"
    description TEXT,
    status VARCHAR(50) DEFAULT 'active',        -- active, inactive
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- USERS
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    avatar TEXT,
    role VARCHAR(50) NOT NULL DEFAULT 'sale', -- sale, tech, accountant, manager, admin
    
    -- Department link
    department VARCHAR(100), -- Legacy string field
    department_id UUID REFERENCES departments(id),
    
    status VARCHAR(50) DEFAULT 'active', -- active, inactive
    last_login TIMESTAMPTZ,
    
    -- HR & Salary Fields
    base_salary DECIMAL(15, 2) DEFAULT 0,
    hourly_rate DECIMAL(12, 2) DEFAULT 0, -- For part-time/hourly calculations
    
    -- New employee fields (Consolidated)
    salary DECIMAL(15, 2) DEFAULT 0, -- Duplicate of base_salary? Keeping from migration
    commission DECIMAL(5, 2) DEFAULT 0, -- Default commission percentage
    bank_account VARCHAR(50),
    bank_name VARCHAR(100),
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Update FKs that depend on Users
ALTER TABLE departments ADD CONSTRAINT fk_departments_manager FOREIGN KEY (manager_id) REFERENCES users(id);
ALTER TABLE workflows ADD CONSTRAINT fk_workflows_creator FOREIGN KEY (created_by) REFERENCES users(id);

-- WORKFLOW STEPS
CREATE TABLE workflow_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    department_id UUID NOT NULL REFERENCES departments(id),
    step_order INTEGER NOT NULL,                -- 1, 2, 3...
    name VARCHAR(255),
    description TEXT,
    estimated_duration NUMERIC(10,2) DEFAULT 1,  -- ngày
    is_required BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(workflow_id, step_order)
);

-- =====================================================
-- 3. CRM TABLES (Customers, Leads, Activity)
-- =====================================================

-- CUSTOMERS
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    type VARCHAR(50) DEFAULT 'individual', -- individual, company
    company VARCHAR(255),
    tax_code VARCHAR(50),
    address TEXT,
    source VARCHAR(100),
    status VARCHAR(50) DEFAULT 'active', -- active, inactive, vip
    
    assigned_to UUID REFERENCES users(id),
    lead_id UUID,
    
    last_contact TIMESTAMPTZ,
    notes TEXT,
    tags TEXT[],
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- LEADS
CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Core info
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    company VARCHAR(255),
    address TEXT,
    
    -- Source & Tracking
    source VARCHAR(100), -- Legacy
    channel VARCHAR(100), -- facebook, zalo, website, referral, etc.
    lead_id VARCHAR(100), -- External ID (e.g. Facebook)
    lead_type VARCHAR(50),
    
    -- Facebook specifics
    fb_thread_id VARCHAR(255),
    fb_profile_name VARCHAR(255),
    fb_profile_pic TEXT,
    fb_link TEXT,
    link_message TEXT,
    last_message_mid VARCHAR(255),
    last_message_text TEXT,
    last_message_time TIMESTAMPTZ,
    last_actor VARCHAR(50), -- lead, sale
    
    -- Status & Pipeline
    status VARCHAR(50) DEFAULT 'new', -- Legacy status
    pipeline_stage VARCHAR(50) DEFAULT 'xac_dinh_nhu_cau',
    sla_state VARCHAR(50) DEFAULT 'ok',
    
    -- Assignment
    assigned_to UUID REFERENCES users(id),
    sale_token VARCHAR(100),
    owner_sale VARCHAR(100),
    customer_id UUID REFERENCES customers(id),
    
    -- Timing
    appointment_time TIMESTAMPTZ,
    t_due TIMESTAMPTZ,
    t_last_inbound TIMESTAMPTZ,
    t_last_outbound TIMESTAMPTZ,
    next_followup_time TIMESTAMPTZ,
    
    -- Notes & History
    notes TEXT, -- Legacy
    care_note TEXT,
    followup_step INTEGER DEFAULT 0,
    round_index INTEGER DEFAULT 0,
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    converted_at TIMESTAMPTZ,
    last_contact TIMESTAMPTZ
);

ALTER TABLE customers ADD CONSTRAINT fk_customers_lead FOREIGN KEY (lead_id) REFERENCES leads(id);

-- Check constraints for Leads
ALTER TABLE leads ADD CONSTRAINT leads_pipeline_stage_check 
    CHECK (pipeline_stage IS NULL OR pipeline_stage IN (
        'xac_dinh_nhu_cau', 'hen_gui_anh', 'dam_phan_gia', 'hen_qua_ship', 'chot_don', 'fail'
    ));

-- LEAD ACTIVITIES
CREATE TABLE lead_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL, -- status_change, note, call, email, meeting, etc.
    old_status VARCHAR(50),
    new_status VARCHAR(50),
    content TEXT,
    created_by UUID REFERENCES users(id),
    created_by_name VARCHAR(255),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- NOTIFICATIONS
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    data JSONB,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- INTERACTIONS (Legacy/General)
CREATE TABLE interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES customers(id),
    lead_id UUID REFERENCES leads(id),
    type VARCHAR(50) NOT NULL, -- call, email, meeting, message, note, task
    subject VARCHAR(255) NOT NULL,
    content TEXT,
    result VARCHAR(50), 
    duration INTEGER, -- minutes
    next_action TEXT,
    next_action_date DATE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 4. CATALOG (Products, Services, Packages)
-- =====================================================

-- PRODUCTS
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    price DECIMAL(15, 2) NOT NULL,
    cost DECIMAL(15, 2) DEFAULT 0,
    unit VARCHAR(50) DEFAULT 'cái',
    description TEXT,
    stock INTEGER DEFAULT 0,
    image TEXT, -- Storage URL
    
    -- Commission
    commission_sale DECIMAL(5, 2) DEFAULT 0,
    commission_tech DECIMAL(5, 2) DEFAULT 0,
    
    status VARCHAR(50) DEFAULT 'active',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- SERVICES
CREATE TABLE services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    price DECIMAL(15, 2) NOT NULL,
    duration INTEGER, -- minutes
    description TEXT,
    image TEXT,
    
    -- Organization
    workflow_id UUID REFERENCES workflows(id),
    department VARCHAR(100), -- Legacy
    department_id UUID REFERENCES departments(id), -- Primary department
    
    -- Commission
    commission_rate DECIMAL(5, 2) DEFAULT 5, -- Legacy
    commission_sale DECIMAL(5, 2) DEFAULT 0,
    commission_tech DECIMAL(5, 2) DEFAULT 0,
    
    status VARCHAR(50) DEFAULT 'active',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- SERVICE DEPARTMENTS (Junction)
CREATE TABLE service_departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    commission_sale NUMERIC(5,2) DEFAULT 0,
    commission_tech NUMERIC(5,2) DEFAULT 0,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(service_id, department_id)
);

-- PACKAGES
CREATE TABLE packages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(15, 2) NOT NULL,
    original_price DECIMAL(15, 2),
    validity_days INTEGER,
    image TEXT,
    
    commission_sale DECIMAL(5, 2) DEFAULT 0,
    commission_tech DECIMAL(5, 2) DEFAULT 0,
    
    status VARCHAR(50) DEFAULT 'active',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE package_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    package_id UUID REFERENCES packages(id) ON DELETE CASCADE,
    service_id UUID REFERENCES services(id),
    quantity INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- VOUCHERS
CREATE TABLE vouchers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50), -- percentage, fixed
    value DECIMAL(15, 2) NOT NULL,
    min_order_value DECIMAL(15, 2) DEFAULT 0,
    max_discount DECIMAL(15, 2),
    quantity INTEGER DEFAULT 0,
    used_count INTEGER DEFAULT 0,
    start_date DATE,
    end_date DATE,
    image TEXT,
    status VARCHAR(50) DEFAULT 'active',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 5. ORDERS SYSTEM (V1 & V2)
-- =====================================================

-- ORDERS
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_code VARCHAR(50) UNIQUE NOT NULL,
    customer_id UUID REFERENCES customers(id),
    sales_id UUID REFERENCES users(id),
    
    -- Financials
    subtotal DECIMAL(15, 2) DEFAULT 0,
    discount DECIMAL(15, 2) DEFAULT 0, 
    discount_type VARCHAR(20) DEFAULT 'amount',
    discount_value DECIMAL(15, 2) DEFAULT 0,
    surcharges JSONB DEFAULT '[]'::jsonb,
    surcharges_amount DECIMAL(15, 2) DEFAULT 0,
    total_amount DECIMAL(15, 2) DEFAULT 0,
    paid_amount DECIMAL(15, 2) DEFAULT 0,
    remaining_debt DECIMAL(15, 2) DEFAULT 0,
    
    -- Status
    status VARCHAR(50) DEFAULT 'pending', -- pending, confirmed, processing, completed, cancelled
    payment_status VARCHAR(20) DEFAULT 'unpaid', -- unpaid, partial, paid
    confirmed_at TIMESTAMPTZ, -- when manager confirms order (status -> confirmed)
    due_at TIMESTAMPTZ, -- deadline for delivery / KPI (SLA: còn X ngày / trễ X ngày)
    after_sale_stage VARCHAR(50) NULL CHECK (after_sale_stage IS NULL OR after_sale_stage IN ('after1', 'after2', 'after3', 'after4')),
    completion_photos JSONB DEFAULT '[]',
    debt_checked BOOLEAN DEFAULT false,
    debt_checked_at TIMESTAMPTZ,
    debt_checked_notes TEXT,
    packaging_photos JSONB DEFAULT '[]',
    delivery_carrier VARCHAR(255),
    delivery_address TEXT,
    delivery_self_pickup BOOLEAN DEFAULT false,
    delivery_notes TEXT,
    hd_sent BOOLEAN DEFAULT false,
    hd_sent_at TIMESTAMPTZ,
    feedback_requested BOOLEAN DEFAULT false,
    feedback_requested_at TIMESTAMPTZ,
    
    notes TEXT,
    completed_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ORDER ITEMS (V1)
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    service_id UUID REFERENCES services(id),
    item_type VARCHAR(50), 
    item_code VARCHAR(20) UNIQUE,
    item_name VARCHAR(255),
    
    quantity INTEGER DEFAULT 1,
    unit_price DECIMAL(15, 2),
    total_price DECIMAL(15, 2),
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'in_progress', 'completed', 'cancelled', 'step1', 'step2', 'step3', 'step4', 'step5')),
    technician_id UUID REFERENCES users(id),
    assigned_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    -- Commission
    commission_sale_rate DECIMAL(5,2) DEFAULT 0,
    commission_tech_rate DECIMAL(5,2) DEFAULT 0,
    commission_sale_amount DECIMAL(15,2) DEFAULT 0,
    commission_tech_amount DECIMAL(15,2) DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ORDER PRODUCTS (V2)
CREATE TABLE order_products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_code VARCHAR(50) UNIQUE NOT NULL,
    
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100),
    brand VARCHAR(100),
    color VARCHAR(50),
    size VARCHAR(50),
    material VARCHAR(100),
    
    condition_before TEXT,
    images JSONB DEFAULT '[]',
    notes TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'delivered', 'cancelled', 'step1', 'step2', 'step3', 'step4', 'step5')),
    
    received_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ORDER PRODUCT SERVICES (V2)
CREATE TABLE order_product_services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_product_id UUID NOT NULL REFERENCES order_products(id) ON DELETE CASCADE,
    
    service_id UUID REFERENCES services(id),
    package_id UUID REFERENCES packages(id),
    
    item_name VARCHAR(255) NOT NULL,
    item_type VARCHAR(20) NOT NULL CHECK (item_type IN ('service', 'package')),
    unit_price DECIMAL(15,2) NOT NULL DEFAULT 0,
    
    technician_id UUID REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'in_progress', 'completed', 'cancelled', 'step1', 'step2', 'step3', 'step4', 'step5')),
    
    assigned_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT service_or_package CHECK (
        (service_id IS NOT NULL AND package_id IS NULL) OR
        (service_id IS NULL AND package_id IS NOT NULL)
    )
);

-- ORDER PRODUCT SERVICE TECHNICIANS (V2)
CREATE TABLE order_product_service_technicians (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_product_service_id UUID NOT NULL REFERENCES order_product_services(id) ON DELETE CASCADE,
    technician_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    commission DECIMAL(5,2) DEFAULT 0,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    assigned_by UUID REFERENCES users(id),
    
    status VARCHAR(20) DEFAULT 'assigned' CHECK (status IN ('assigned', 'in_progress', 'completed', 'cancelled')),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(order_product_service_id, technician_id)
);

-- ORDER ITEM STEPS
CREATE TABLE order_item_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    order_item_id UUID REFERENCES order_items(id) ON DELETE CASCADE,
    order_product_service_id UUID REFERENCES order_product_services(id) ON DELETE CASCADE,
    
    workflow_step_id UUID REFERENCES workflow_steps(id) ON DELETE SET NULL,
    step_order INTEGER NOT NULL,
    step_name VARCHAR(255) NOT NULL,
    department_id UUID REFERENCES departments(id),
    
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'in_progress', 'completed', 'skipped')),
    technician_id UUID REFERENCES users(id),
    
    estimated_duration NUMERIC(10,2) DEFAULT 1,  -- ngày
    assigned_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT check_step_source CHECK (
        (order_item_id IS NOT NULL AND order_product_service_id IS NULL) OR
        (order_item_id IS NULL AND order_product_service_id IS NOT NULL)
    )
);

-- ORDER ITEM ACCESSORIES (Mua phụ kiện) - V1 order_items or V2 order_product_services
CREATE TABLE IF NOT EXISTS order_item_accessories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_item_id UUID REFERENCES order_items(id) ON DELETE CASCADE,
    order_product_service_id UUID REFERENCES order_product_services(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL CHECK (status IN ('need_buy', 'bought', 'waiting_ship', 'shipped', 'delivered_to_tech')),
    notes TEXT,
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_accessory_source CHECK (
        (order_item_id IS NOT NULL AND order_product_service_id IS NULL)
        OR (order_item_id IS NULL AND order_product_service_id IS NOT NULL)
    )
);
CREATE INDEX IF NOT EXISTS idx_order_item_accessories_order_product_service ON order_item_accessories(order_product_service_id);

-- ORDER ITEM PARTNER (Gửi Đối Tác) - V1 order_items or V2 order_product_services
CREATE TABLE IF NOT EXISTS order_item_partner (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_item_id UUID REFERENCES order_items(id) ON DELETE CASCADE,
    order_product_service_id UUID REFERENCES order_product_services(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL CHECK (status IN ('ship_to_partner', 'partner_doing', 'ship_back', 'done')),
    notes TEXT,
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_partner_source CHECK (
        (order_item_id IS NOT NULL AND order_product_service_id IS NULL)
        OR (order_item_id IS NULL AND order_product_service_id IS NOT NULL)
    )
);
CREATE INDEX IF NOT EXISTS idx_order_item_partner_order_product_service ON order_item_partner(order_product_service_id);

-- ORDER EXTENSION REQUESTS (Xin gia hạn)
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

-- ORDER KANBAN LOGS (lịch sử chuyển trạng thái từng tab Kanban)
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

-- TECHNICIAN TASKS
CREATE TABLE technician_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_code VARCHAR(50) UNIQUE NOT NULL,
    
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    order_item_id UUID REFERENCES order_items(id) ON DELETE CASCADE,
    item_code VARCHAR(20),
    
    service_id UUID REFERENCES services(id),
    customer_id UUID REFERENCES customers(id),
    technician_id UUID REFERENCES users(id),
    
    service_name VARCHAR(255) NOT NULL,
    quantity INTEGER DEFAULT 1,
    status VARCHAR(50) DEFAULT 'pending',
    priority VARCHAR(20) DEFAULT 'normal',
    
    scheduled_date DATE,
    scheduled_time TIME,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_minutes INTEGER,
    
    notes TEXT,
    customer_feedback TEXT,
    rating INTEGER,
    
    assigned_by UUID REFERENCES users(id),
    assigned_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 6. FINANCE & HR
-- =====================================================

-- INVOICES (Legacy)
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_code VARCHAR(50) UNIQUE NOT NULL,
    order_id UUID REFERENCES orders(id),
    customer_id UUID REFERENCES customers(id),
    subtotal DECIMAL(15, 2) DEFAULT 0,
    discount DECIMAL(15, 2) DEFAULT 0,
    total_amount DECIMAL(15, 2) DEFAULT 0,
    payment_method VARCHAR(50),
    status VARCHAR(50) DEFAULT 'draft',
    notes TEXT,
    paid_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- TRANSACTIONS
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) NOT NULL UNIQUE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense')),
    category VARCHAR(100) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    payment_method VARCHAR(20) DEFAULT 'cash' CHECK (payment_method IN ('cash', 'transfer', 'card')),
    
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    order_code VARCHAR(50),
    
    notes TEXT,
    image_url TEXT,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'cancelled')),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- FINANCE TRANSACTIONS (Legacy)
CREATE TABLE finance_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    type VARCHAR(50) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    category VARCHAR(100) NOT NULL,
    description TEXT,
    customer_id UUID REFERENCES customers(id),
    invoice_id UUID REFERENCES invoices(id),
    supplier VARCHAR(255),
    payment_method VARCHAR(50),
    status VARCHAR(50) DEFAULT 'pending',
    notes TEXT,
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- PAYMENT RECORDS
CREATE TABLE payment_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    order_code VARCHAR(50) NOT NULL,
    
    content VARCHAR(255) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    payment_method VARCHAR(20) DEFAULT 'cash',
    
    image_url TEXT,
    notes TEXT,
    
    transaction_type VARCHAR(20) DEFAULT 'income',
    transaction_category VARCHAR(100) DEFAULT 'Thanh toán đơn hàng',
    transaction_status VARCHAR(20) DEFAULT 'approved',
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- COMMISSIONS
CREATE TABLE commissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    invoice_id UUID REFERENCES invoices(id),
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    
    commission_type VARCHAR(50) CHECK (commission_type IN ('service', 'product', 'referral', 'bonus')),
    amount DECIMAL(15, 2) NOT NULL,
    
    rate DECIMAL(5, 2),
    percentage DECIMAL(5, 2) DEFAULT 0,
    base_amount DECIMAL(15, 2) DEFAULT 0,
    
    status VARCHAR(50) DEFAULT 'pending',
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- SALARY RECORDS
CREATE TABLE salary_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    
    base_salary DECIMAL(15, 2) DEFAULT 0,
    hourly_rate DECIMAL(15, 2) DEFAULT 0,
    hourly_wage DECIMAL(15, 2) DEFAULT 0,
    
    total_hours DECIMAL(10, 2) DEFAULT 0,
    overtime_hours DECIMAL(10, 2) DEFAULT 0,
    overtime_pay DECIMAL(15, 2) DEFAULT 0,
    
    commission DECIMAL(15, 2) DEFAULT 0,
    kpi_achievement DECIMAL(5, 2) DEFAULT 0,
    bonus DECIMAL(15, 2) DEFAULT 0,
    
    social_insurance DECIMAL(15, 2) DEFAULT 0,
    health_insurance DECIMAL(15, 2) DEFAULT 0,
    personal_tax DECIMAL(15, 2) DEFAULT 0,
    deduction DECIMAL(15, 2) DEFAULT 0,
    
    gross_salary DECIMAL(15, 2) DEFAULT 0,
    net_salary DECIMAL(15, 2) DEFAULT 0,
    
    status VARCHAR(50) DEFAULT 'draft',
    payment_method VARCHAR(50),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    paid_by UUID REFERENCES users(id),
    paid_at TIMESTAMPTZ,
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, month, year)
);

-- KPI RECORDS
CREATE TABLE kpi_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    target_type VARCHAR(50) DEFAULT 'revenue',
    target DECIMAL(15, 2) NOT NULL,
    actual DECIMAL(15, 2) DEFAULT 0,
    achievement_rate DECIMAL(5, 2) DEFAULT 0,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, month, year, target_type)
);

-- TIMESHEETS
CREATE TABLE timesheets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    work_date DATE NOT NULL,
    check_in TIMESTAMPTZ,
    check_out TIMESTAMPTZ,
    hours_worked DECIMAL(5, 2) DEFAULT 0,
    overtime_hours DECIMAL(5, 2) DEFAULT 0,
    notes TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, work_date)
);

-- =====================================================
-- 7. TRIGGERS & INDEXES
-- =====================================================

CREATE TRIGGER trigger_update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_update_leads_updated_at BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_update_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_update_services_updated_at BEFORE UPDATE ON services FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_update_order_products_updated_at BEFORE UPDATE ON order_products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_update_order_item_steps_updated_at BEFORE UPDATE ON order_item_steps FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_update_transactions_updated_at BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_update_payment_records_updated_at BEFORE UPDATE ON payment_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_update_salary_records_updated_at BEFORE UPDATE ON salary_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- KEY INDEXES
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_pipeline_stage ON leads(pipeline_stage);
CREATE INDEX idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX idx_customers_search ON customers(phone, email, code);
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_products_order ON order_products(order_id);
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_salary_records_period ON salary_records(user_id, month, year);

-- =====================================================
-- 8. HELPER FUNCTIONS
-- =====================================================
CREATE OR REPLACE FUNCTION generate_transaction_code(trans_type VARCHAR)
RETURNS VARCHAR AS $$
DECLARE
    prefix VARCHAR;
    next_num INTEGER;
    new_code VARCHAR;
BEGIN
    IF trans_type = 'income' THEN
        prefix := 'PT';
    ELSE
        prefix := 'PC';
    END IF;
    
    SELECT COALESCE(MAX(CAST(SUBSTRING(code FROM 3) AS INTEGER)), 0) + 1
    INTO next_num
    FROM transactions
    WHERE code LIKE prefix || '%';
    
    new_code := prefix || LPAD(next_num::TEXT, 6, '0');
    RETURN new_code;
END;
$$ LANGUAGE plpgsql;

