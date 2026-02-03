-- Migration: Add Facebook profile and follow-up fields to leads
-- Date: 2026-02-02

-- =====================================================
-- ADD NEW COLUMNS TO LEADS TABLE
-- =====================================================

-- Facebook profile info
ALTER TABLE leads ADD COLUMN IF NOT EXISTS fb_profile_name VARCHAR(255);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS fb_profile_pic TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS fb_link TEXT;

-- Follow-up scheduling
ALTER TABLE leads ADD COLUMN IF NOT EXISTS next_followup_time TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS care_note TEXT;

-- =====================================================
-- CREATE INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_leads_next_followup_time ON leads(next_followup_time);

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON COLUMN leads.fb_profile_name IS 'Facebook profile name';
COMMENT ON COLUMN leads.fb_profile_pic IS 'Facebook profile picture URL';
COMMENT ON COLUMN leads.fb_link IS 'Direct link to Facebook profile';
COMMENT ON COLUMN leads.next_followup_time IS 'Scheduled time for next follow-up contact';
COMMENT ON COLUMN leads.care_note IS 'Notes about customer care requirements';
