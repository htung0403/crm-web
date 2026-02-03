-- Migration: Add lead_activities table for tracking lead history
-- Date: 2026-01-28

-- =====================================================
-- LEAD ACTIVITIES TABLE (History/Timeline)
-- =====================================================
CREATE TABLE IF NOT EXISTS lead_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    
    -- Activity type: status_change, note, call, email, meeting, etc.
    activity_type VARCHAR(50) NOT NULL,
    
    -- For status changes
    old_status VARCHAR(50),
    new_status VARCHAR(50),
    
    -- Content (for notes, call logs, etc.)
    content TEXT,
    
    -- Who performed this activity
    created_by UUID REFERENCES users(id),
    created_by_name VARCHAR(255),
    
    -- Metadata (JSON for flexible additional data)
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_lead_activities_lead_id ON lead_activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_activities_type ON lead_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_lead_activities_created_at ON lead_activities(created_at DESC);

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE lead_activities IS 'Tracks all activities/history for leads including status changes, notes, calls, etc.';
COMMENT ON COLUMN lead_activities.activity_type IS 'Type: status_change, note, call, email, meeting, task, system';
COMMENT ON COLUMN lead_activities.old_status IS 'Previous status (for status_change type)';
COMMENT ON COLUMN lead_activities.new_status IS 'New status (for status_change type)';
COMMENT ON COLUMN lead_activities.content IS 'Activity content/notes';
COMMENT ON COLUMN lead_activities.metadata IS 'Additional data in JSON format';
