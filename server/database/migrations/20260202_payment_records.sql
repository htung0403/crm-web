-- Migration: Create payment_records table for order payments
-- Date: 2026-02-02

-- Create payment_records table
CREATE TABLE IF NOT EXISTS payment_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    order_code VARCHAR(50) NOT NULL,
    
    -- Payment details
    content VARCHAR(255) NOT NULL,  -- e.g., "Đặt cọc", "Thanh toán đợt 1", "Thanh toán hết"
    amount DECIMAL(15, 2) NOT NULL,
    payment_method VARCHAR(20) DEFAULT 'cash',  -- cash, transfer, card
    
    -- Proof/Receipt
    image_url TEXT,  -- QR code or receipt image
    notes TEXT,
    
    -- Finance integration
    transaction_type VARCHAR(20) DEFAULT 'income',  -- income (thu)
    transaction_category VARCHAR(100) DEFAULT 'Thanh toán đơn hàng',
    transaction_status VARCHAR(20) DEFAULT 'approved',  -- pending, approved, cancelled
    
    -- Meta
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_payment_records_order_id ON payment_records(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_records_order_code ON payment_records(order_code);
CREATE INDEX IF NOT EXISTS idx_payment_records_created_at ON payment_records(created_at);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_payment_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_payment_records_updated_at ON payment_records;
CREATE TRIGGER trigger_update_payment_records_updated_at
    BEFORE UPDATE ON payment_records
    FOR EACH ROW
    EXECUTE FUNCTION update_payment_records_updated_at();
