-- Migration: Add department column to services table
-- Run this in Supabase SQL Editor

-- Add department column to services table
ALTER TABLE services ADD COLUMN IF NOT EXISTS department VARCHAR(100);

-- Add comment for the column
COMMENT ON COLUMN services.department IS 'Technical department that performs this service';
