-- Migration: Add commission tracking columns to commissions table
-- Date: 2026-01-31
-- Purpose: Add columns for better commission tracking and reporting

-- Add order_id column to link commission to original order
ALTER TABLE commissions 
ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES orders(id) ON DELETE SET NULL;

-- Add commission_type column to distinguish between different types of commissions
ALTER TABLE commissions 
ADD COLUMN IF NOT EXISTS commission_type VARCHAR(50);

-- Add constraint for commission_type values
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'commissions_commission_type_check'
    ) THEN
        ALTER TABLE commissions 
        ADD CONSTRAINT commissions_commission_type_check 
        CHECK (commission_type IS NULL OR commission_type IN ('service', 'product', 'referral', 'bonus'));
    END IF;
END $$;

-- Add percentage column to store the commission rate
ALTER TABLE commissions 
ADD COLUMN IF NOT EXISTS percentage DECIMAL(5, 2) DEFAULT 0;

-- Add base_amount column to store the original amount the commission was calculated from
ALTER TABLE commissions 
ADD COLUMN IF NOT EXISTS base_amount DECIMAL(15, 2) DEFAULT 0;

-- Add index on commission_type for faster queries
CREATE INDEX IF NOT EXISTS idx_commissions_type ON commissions(commission_type);

-- ===== SALARY_RECORDS TABLE COLUMNS =====
-- Add missing columns to salary_records if not exists
ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS base_salary DECIMAL(15, 2) DEFAULT 0;
ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS hourly_rate DECIMAL(15, 2) DEFAULT 0;
ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS hourly_wage DECIMAL(15, 2) DEFAULT 0;
ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS overtime_pay DECIMAL(15, 2) DEFAULT 0;
ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS total_hours DECIMAL(10, 2) DEFAULT 176;
ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS overtime_hours DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS commission DECIMAL(15, 2) DEFAULT 0;
ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS kpi_achievement DECIMAL(5, 2) DEFAULT 0;
ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS bonus DECIMAL(15, 2) DEFAULT 0;
ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS social_insurance DECIMAL(15, 2) DEFAULT 0;
ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS health_insurance DECIMAL(15, 2) DEFAULT 0;
ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS personal_tax DECIMAL(15, 2) DEFAULT 0;
ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS deduction DECIMAL(15, 2) DEFAULT 0;
ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS gross_salary DECIMAL(15, 2) DEFAULT 0;
ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS net_salary DECIMAL(15, 2) DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN commissions.commission_type IS 'Type of commission: service (technician), product (sales), referral, bonus';
COMMENT ON COLUMN commissions.percentage IS 'Commission percentage rate (e.g., 12 for 12%)';
COMMENT ON COLUMN commissions.base_amount IS 'Original service/product price the commission was calculated from';
