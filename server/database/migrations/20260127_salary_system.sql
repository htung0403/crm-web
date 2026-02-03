-- Salary Records Table
-- Stores monthly salary information for each employee

-- Create salary_records table
CREATE TABLE IF NOT EXISTS salary_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    year INTEGER NOT NULL CHECK (year >= 2020 AND year <= 2100),
    
    -- Base salary info
    base_salary DECIMAL(15, 2) DEFAULT 0,
    hourly_rate DECIMAL(12, 2) DEFAULT 0,
    hourly_wage DECIMAL(15, 2) DEFAULT 0,
    overtime_pay DECIMAL(15, 2) DEFAULT 0,
    total_hours DECIMAL(8, 2) DEFAULT 0,
    overtime_hours DECIMAL(8, 2) DEFAULT 0,
    
    -- Commission breakdown
    service_commission DECIMAL(15, 2) DEFAULT 0,
    product_commission DECIMAL(15, 2) DEFAULT 0,
    referral_commission DECIMAL(15, 2) DEFAULT 0,
    commission DECIMAL(15, 2) DEFAULT 0,
    
    -- KPI & Bonus
    kpi_achievement DECIMAL(5, 2) DEFAULT 0,
    bonus DECIMAL(15, 2) DEFAULT 0,
    
    -- Deductions
    social_insurance DECIMAL(15, 2) DEFAULT 0,
    health_insurance DECIMAL(15, 2) DEFAULT 0,
    personal_tax DECIMAL(15, 2) DEFAULT 0,
    advances DECIMAL(15, 2) DEFAULT 0,
    other_deductions DECIMAL(15, 2) DEFAULT 0,
    deduction DECIMAL(15, 2) DEFAULT 0,
    
    -- Final amounts
    gross_salary DECIMAL(15, 2) DEFAULT 0,
    net_salary DECIMAL(15, 2) DEFAULT 0,
    
    -- Status and workflow
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'approved', 'paid', 'locked')),
    payment_method VARCHAR(50),
    telegram_sent BOOLEAN DEFAULT FALSE,
    
    -- Approval tracking
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    paid_by UUID REFERENCES users(id),
    paid_at TIMESTAMPTZ,
    
    -- Audit fields
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint: one salary record per user per month/year
    UNIQUE(user_id, month, year)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_salary_records_user_id ON salary_records(user_id);
CREATE INDEX IF NOT EXISTS idx_salary_records_period ON salary_records(year, month);
CREATE INDEX IF NOT EXISTS idx_salary_records_status ON salary_records(status);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_salary_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_salary_records_updated_at ON salary_records;
CREATE TRIGGER trigger_salary_records_updated_at
    BEFORE UPDATE ON salary_records
    FOR EACH ROW
    EXECUTE FUNCTION update_salary_records_updated_at();

-- Create commissions table if not exists (for tracking individual commissions)
CREATE TABLE IF NOT EXISTS commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    
    commission_type VARCHAR(50) NOT NULL CHECK (commission_type IN ('service', 'product', 'referral', 'bonus')),
    amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
    percentage DECIMAL(5, 2) DEFAULT 0,
    base_amount DECIMAL(15, 2) DEFAULT 0,
    
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
    notes TEXT,
    
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commissions_user_id ON commissions(user_id);
CREATE INDEX IF NOT EXISTS idx_commissions_status ON commissions(status);

-- Create timesheets table if not exists (for tracking working hours)
CREATE TABLE IF NOT EXISTS timesheets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    work_date DATE NOT NULL,
    
    check_in TIMESTAMPTZ,
    check_out TIMESTAMPTZ,
    hours_worked DECIMAL(5, 2) DEFAULT 0,
    overtime_hours DECIMAL(5, 2) DEFAULT 0,
    
    notes TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, work_date)
);

CREATE INDEX IF NOT EXISTS idx_timesheets_user_id ON timesheets(user_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_work_date ON timesheets(work_date);

-- Add hourly_rate and base_salary to users table if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'hourly_rate') THEN
        ALTER TABLE users ADD COLUMN hourly_rate DECIMAL(12, 2) DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'base_salary') THEN
        ALTER TABLE users ADD COLUMN base_salary DECIMAL(15, 2) DEFAULT 0;
    END IF;
END $$;

-- Comments for documentation
COMMENT ON TABLE salary_records IS 'Monthly salary records for employees';
COMMENT ON TABLE commissions IS 'Individual commission transactions';
COMMENT ON TABLE timesheets IS 'Daily timesheet records for tracking work hours';
