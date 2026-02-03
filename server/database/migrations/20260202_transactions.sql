-- Migration: Create transactions table for Thu Chi
-- Date: 2026-02-02

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    
    -- Transaction type and category
    type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense')),
    category VARCHAR(100) NOT NULL,
    
    -- Amount and payment method
    amount DECIMAL(15, 2) NOT NULL,
    payment_method VARCHAR(20) DEFAULT 'cash' CHECK (payment_method IN ('cash', 'transfer', 'card')),
    
    -- Related order (optional - for order payments)
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    order_code VARCHAR(50),
    
    -- Details
    notes TEXT,
    image_url TEXT,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- Approval workflow
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'cancelled')),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    
    -- Meta
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_order_id ON transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_by ON transactions(created_by);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_transactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_transactions_updated_at ON transactions;
CREATE TRIGGER trigger_update_transactions_updated_at
    BEFORE UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_transactions_updated_at();

-- Function to generate transaction code
CREATE OR REPLACE FUNCTION generate_transaction_code(trans_type VARCHAR)
RETURNS VARCHAR AS $$
DECLARE
    prefix VARCHAR;
    next_num INTEGER;
    new_code VARCHAR;
BEGIN
    IF trans_type = 'income' THEN
        prefix := 'PT';  -- Phiếu Thu
    ELSE
        prefix := 'PC';  -- Phiếu Chi
    END IF;
    
    SELECT COALESCE(MAX(CAST(SUBSTRING(code FROM 3) AS INTEGER)), 0) + 1
    INTO next_num
    FROM transactions
    WHERE code LIKE prefix || '%';
    
    new_code := prefix || LPAD(next_num::TEXT, 6, '0');
    RETURN new_code;
END;
$$ LANGUAGE plpgsql;
