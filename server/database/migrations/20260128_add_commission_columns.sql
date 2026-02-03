-- Migration: Add commission columns to products, services, and packages tables
-- Date: 2026-01-28

-- Add commission columns to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS commission_sale DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS commission_tech DECIMAL(5,2) DEFAULT 0;

-- Add commission columns to services table (if not exists)
ALTER TABLE services 
ADD COLUMN IF NOT EXISTS commission_sale DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS commission_tech DECIMAL(5,2) DEFAULT 0;

-- Migrate existing commission_rate to commission_sale for services
UPDATE services 
SET commission_sale = commission_rate 
WHERE commission_rate IS NOT NULL AND commission_rate > 0 AND commission_sale = 0;

-- Add commission columns to packages table
ALTER TABLE packages 
ADD COLUMN IF NOT EXISTS commission_sale DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS commission_tech DECIMAL(5,2) DEFAULT 0;

-- Add comments for documentation
COMMENT ON COLUMN products.commission_sale IS 'Commission percentage for sales staff';
COMMENT ON COLUMN products.commission_tech IS 'Commission percentage for technicians';
COMMENT ON COLUMN services.commission_sale IS 'Commission percentage for sales staff';
COMMENT ON COLUMN services.commission_tech IS 'Commission percentage for technicians';
COMMENT ON COLUMN packages.commission_sale IS 'Commission percentage for sales staff';
COMMENT ON COLUMN packages.commission_tech IS 'Commission percentage for technicians';
