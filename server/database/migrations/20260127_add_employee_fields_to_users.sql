-- Migration: Add employee fields to users table
-- Run this in Supabase SQL Editor

-- Add employee-related columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS salary DECIMAL(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS commission DECIMAL(5, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS bank_account VARCHAR(50),
ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100);

-- Add comment for documentation
COMMENT ON COLUMN users.salary IS 'Monthly base salary';
COMMENT ON COLUMN users.commission IS 'Default commission percentage';
COMMENT ON COLUMN users.bank_account IS 'Bank account number for salary payment';
COMMENT ON COLUMN users.bank_name IS 'Bank name for salary payment';
