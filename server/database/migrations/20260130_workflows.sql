-- Migration: Create workflows and workflow_steps tables
-- Run this in Supabase SQL Editor

-- =====================================================
-- 1. WORKFLOWS TABLE
-- =====================================================
-- Bảng lưu thông tin quy trình làm việc
CREATE TABLE IF NOT EXISTS workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,          -- QT001, QT002...
    name VARCHAR(255) NOT NULL,                 -- "Quy trình lắp đặt camera"
    description TEXT,
    status VARCHAR(50) DEFAULT 'active',        -- active, inactive
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(status);
CREATE INDEX IF NOT EXISTS idx_workflows_code ON workflows(code);

-- =====================================================
-- 2. WORKFLOW_STEPS TABLE
-- =====================================================
-- Bảng lưu các bước trong quy trình (liên kết đến phòng ban)
CREATE TABLE IF NOT EXISTS workflow_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    department_id UUID NOT NULL REFERENCES departments(id),
    step_order INTEGER NOT NULL,                -- Thứ tự bước: 1, 2, 3...
    name VARCHAR(255),                          -- Tên bước (optional, nếu khác tên phòng ban)
    description TEXT,
    estimated_duration INTEGER DEFAULT 60,      -- Thời gian ước tính (phút)
    is_required BOOLEAN DEFAULT true,           -- Bước bắt buộc?
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(workflow_id, step_order)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_workflow_steps_workflow ON workflow_steps(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_department ON workflow_steps(department_id);

-- =====================================================
-- 3. LINK SERVICES TO WORKFLOWS
-- =====================================================
-- Thêm cột workflow_id vào bảng services
ALTER TABLE services ADD COLUMN IF NOT EXISTS workflow_id UUID REFERENCES workflows(id);

-- Create index
CREATE INDEX IF NOT EXISTS idx_services_workflow ON services(workflow_id);

-- =====================================================
-- 4. COMMENTS
-- =====================================================
COMMENT ON TABLE workflows IS 'Bảng lưu thông tin quy trình làm việc';
COMMENT ON TABLE workflow_steps IS 'Bảng lưu các bước trong quy trình, mỗi bước tương ứng với 1 phòng ban';
COMMENT ON COLUMN workflow_steps.step_order IS 'Thứ tự thực hiện của bước trong quy trình';
COMMENT ON COLUMN workflow_steps.estimated_duration IS 'Thời gian ước tính hoàn thành bước (phút)';
COMMENT ON COLUMN services.workflow_id IS 'Quy trình áp dụng cho dịch vụ này';
