-- Migration: Update leads table with new CRM fields
-- Date: 2026-01-28

-- =====================================================
-- ADD NEW COLUMNS TO LEADS TABLE
-- =====================================================

-- External identifiers
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_id VARCHAR(100);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_type VARCHAR(50);

-- Channel & Messaging
ALTER TABLE leads ADD COLUMN IF NOT EXISTS channel VARCHAR(100);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS fb_thread_id VARCHAR(255);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS link_message TEXT;

-- Last message info
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_message_mid VARCHAR(255);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_message_text TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_message_time TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_actor VARCHAR(50);

-- Pipeline & Status
ALTER TABLE leads ADD COLUMN IF NOT EXISTS pipeline_stage VARCHAR(50);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS followup_step INTEGER DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS round_index INTEGER DEFAULT 0;

-- Assignment (using token instead of UUID for external systems)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS sale_token VARCHAR(100);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS owner_sale VARCHAR(100);

-- Timing & SLA
ALTER TABLE leads ADD COLUMN IF NOT EXISTS appointment_time TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS t_due TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS t_last_inbound TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS t_last_outbound TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS sla_state VARCHAR(50) DEFAULT 'ok';

-- Rename notes to note (optional - keep both for compatibility)
-- ALTER TABLE leads RENAME COLUMN notes TO note;

-- Migrate source to channel if needed
-- UPDATE leads SET channel = source WHERE channel IS NULL AND source IS NOT NULL;

-- =====================================================
-- CREATE INDEXES FOR NEW COLUMNS
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_leads_channel ON leads(channel);
CREATE INDEX IF NOT EXISTS idx_leads_pipeline_stage ON leads(pipeline_stage);
CREATE INDEX IF NOT EXISTS idx_leads_sla_state ON leads(sla_state);
CREATE INDEX IF NOT EXISTS idx_leads_sale_token ON leads(sale_token);
CREATE INDEX IF NOT EXISTS idx_leads_lead_id ON leads(lead_id);
CREATE INDEX IF NOT EXISTS idx_leads_fb_thread_id ON leads(fb_thread_id);
CREATE INDEX IF NOT EXISTS idx_leads_t_due ON leads(t_due);

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON COLUMN leads.lead_id IS 'External lead ID (e.g., from Facebook)';
COMMENT ON COLUMN leads.lead_type IS 'Type of lead: individual, company, etc.';
COMMENT ON COLUMN leads.channel IS 'Lead source channel: facebook, zalo, website, referral, etc.';
COMMENT ON COLUMN leads.fb_thread_id IS 'Facebook Messenger thread ID';
COMMENT ON COLUMN leads.link_message IS 'Direct link to the conversation/message';
COMMENT ON COLUMN leads.last_message_mid IS 'ID of the last message';
COMMENT ON COLUMN leads.last_message_text IS 'Content of the last message';
COMMENT ON COLUMN leads.last_message_time IS 'Timestamp of the last message';
COMMENT ON COLUMN leads.last_actor IS 'Who sent the last message: lead or sale';
COMMENT ON COLUMN leads.pipeline_stage IS 'Current stage in the sales pipeline';
COMMENT ON COLUMN leads.followup_step IS 'Current follow-up step number';
COMMENT ON COLUMN leads.round_index IS 'Number of contact rounds';
COMMENT ON COLUMN leads.sale_token IS 'Token/ID of assigned salesperson';
COMMENT ON COLUMN leads.owner_sale IS 'Token/ID of lead owner';
COMMENT ON COLUMN leads.appointment_time IS 'Scheduled appointment time';
COMMENT ON COLUMN leads.t_due IS 'Deadline for handling this lead';
COMMENT ON COLUMN leads.t_last_inbound IS 'Timestamp of last inbound message';
COMMENT ON COLUMN leads.t_last_outbound IS 'Timestamp of last outbound message';
COMMENT ON COLUMN leads.sla_state IS 'SLA status: ok, warning, overdue';

-- =====================================================
-- PIPELINE STAGE VALUES
-- =====================================================
-- Valid pipeline_stage values:
-- 'xac_dinh_nhu_cau' - Xác định nhu cầu (Orange)
-- 'hen_gui_anh'      - Hẹn gửi ảnh (Gray)
-- 'dam_phan_gia'     - Đàm phán giá (Purple)
-- 'hen_qua_ship'     - Hẹn qua hoặc ship (Gray)
-- 'chot_don'         - Chốt đơn (Green)
-- 'fail'             - Fail - khách rời (Red)

-- Add check constraint for pipeline_stage
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'leads_pipeline_stage_check'
    ) THEN
        ALTER TABLE leads ADD CONSTRAINT leads_pipeline_stage_check 
        CHECK (pipeline_stage IS NULL OR pipeline_stage IN (
            'xac_dinh_nhu_cau',
            'hen_gui_anh',
            'dam_phan_gia',
            'hen_qua_ship',
            'chot_don',
            'fail'
        ));
    END IF;
END $$;

-- Set default pipeline_stage for new leads
ALTER TABLE leads ALTER COLUMN pipeline_stage SET DEFAULT 'xac_dinh_nhu_cau';

COMMENT ON COLUMN leads.pipeline_stage IS 'Sales pipeline stage: xac_dinh_nhu_cau, hen_gui_anh, dam_phan_gia, hen_qua_ship, chot_don, fail';

-- =====================================================
-- MIGRATE OLD STATUS TO NEW PIPELINE_STAGE
-- =====================================================
-- Map old status values to new pipeline_stage values

UPDATE leads SET pipeline_stage = 'xac_dinh_nhu_cau' 
WHERE pipeline_stage IS NULL AND status IN ('new', 'contacted');

UPDATE leads SET pipeline_stage = 'hen_gui_anh' 
WHERE pipeline_stage IS NULL AND status = 'nurturing';

UPDATE leads SET pipeline_stage = 'dam_phan_gia' 
WHERE pipeline_stage IS NULL AND status = 'qualified';

UPDATE leads SET pipeline_stage = 'chot_don' 
WHERE pipeline_stage IS NULL AND status IN ('converted', 'closed', 'won');

UPDATE leads SET pipeline_stage = 'fail' 
WHERE pipeline_stage IS NULL AND status IN ('lost', 'fail');

-- Default: any remaining null pipeline_stage gets first stage
UPDATE leads SET pipeline_stage = 'xac_dinh_nhu_cau' 
WHERE pipeline_stage IS NULL;

-- Also sync status column for consistency
UPDATE leads SET status = pipeline_stage WHERE status != pipeline_stage;
