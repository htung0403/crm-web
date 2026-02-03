-- Migration: Create service_departments junction table
-- Run this in Supabase SQL Editor

-- Create junction table for many-to-many relationship between services and departments
CREATE TABLE IF NOT EXISTS service_departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    commission_sale NUMERIC(5,2) DEFAULT 0,  -- % commission for sales
    commission_tech NUMERIC(5,2) DEFAULT 0,  -- % commission for technician
    is_primary BOOLEAN DEFAULT false,        -- primary department flag
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(service_id, department_id)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_service_departments_service ON service_departments(service_id);
CREATE INDEX IF NOT EXISTS idx_service_departments_department ON service_departments(department_id);

-- Migrate existing data from services.department column to new table
-- This will copy existing department assignments
INSERT INTO service_departments (service_id, department_id, commission_sale, commission_tech, is_primary)
SELECT 
    s.id as service_id,
    d.id as department_id,
    COALESCE(s.commission_sale, s.commission_rate, 0) as commission_sale,
    COALESCE(s.commission_tech, 0) as commission_tech,
    true as is_primary
FROM services s
JOIN departments d ON (
    s.department = d.id::text 
    OR s.department = d.name 
    OR s.department = d.code
)
WHERE s.department IS NOT NULL
ON CONFLICT (service_id, department_id) DO NOTHING;

-- Add comment for the table
COMMENT ON TABLE service_departments IS 'Junction table for many-to-many relationship between services and departments with custom commission rates';
