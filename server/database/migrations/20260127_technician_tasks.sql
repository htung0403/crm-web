-- Migration: Create technician_tasks table
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS technician_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_code VARCHAR(50) UNIQUE NOT NULL,
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    order_item_id UUID REFERENCES order_items(id) ON DELETE CASCADE,
    service_id UUID REFERENCES services(id),
    customer_id UUID REFERENCES customers(id),
    technician_id UUID REFERENCES users(id),
    service_name VARCHAR(255) NOT NULL,
    quantity INTEGER DEFAULT 1,
    status VARCHAR(50) DEFAULT 'pending', -- pending, assigned, in_progress, completed, cancelled
    priority VARCHAR(20) DEFAULT 'normal', -- low, normal, high, urgent
    scheduled_date DATE,
    scheduled_time TIME,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_minutes INTEGER, -- actual duration in minutes
    notes TEXT,
    customer_feedback TEXT,
    rating INTEGER, -- 1-5 stars
    assigned_by UUID REFERENCES users(id),
    assigned_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tech_tasks_status ON technician_tasks(status);
CREATE INDEX IF NOT EXISTS idx_tech_tasks_technician ON technician_tasks(technician_id);
CREATE INDEX IF NOT EXISTS idx_tech_tasks_order ON technician_tasks(order_id);
CREATE INDEX IF NOT EXISTS idx_tech_tasks_scheduled ON technician_tasks(scheduled_date);

-- Grant permissions (if using RLS)
-- ALTER TABLE technician_tasks ENABLE ROW LEVEL SECURITY;
