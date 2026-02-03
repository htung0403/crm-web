-- Migration: Add image column to products, services, service_packages, and vouchers tables
-- Date: 2026-01-29
-- Description: Adds image URL storage for all sellable items

-- Add image column to products table (if not exists)
ALTER TABLE products ADD COLUMN IF NOT EXISTS image TEXT;

-- Add image column to services table
ALTER TABLE services ADD COLUMN IF NOT EXISTS image TEXT;

-- Add image column to service_packages table
ALTER TABLE service_packages ADD COLUMN IF NOT EXISTS image TEXT;

-- Add image column to vouchers table
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS image TEXT;

-- Add comments for documentation
COMMENT ON COLUMN products.image IS 'URL of the product image stored in Supabase Storage';
COMMENT ON COLUMN services.image IS 'URL of the service image stored in Supabase Storage';
COMMENT ON COLUMN service_packages.image IS 'URL of the package image stored in Supabase Storage';
COMMENT ON COLUMN vouchers.image IS 'URL of the voucher image stored in Supabase Storage';
