-- Migration: Add status tracking fields to order_products for managing products with multiple services
-- This enables automatic calculation of completion percentage and overall status based on workflow steps

-- =====================================================
-- 1. ADD TRACKING COLUMNS TO ORDER_PRODUCTS
-- =====================================================
ALTER TABLE order_products ADD COLUMN IF NOT EXISTS completion_percentage INTEGER DEFAULT 0;
ALTER TABLE order_products ADD COLUMN IF NOT EXISTS overall_status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE order_products ADD COLUMN IF NOT EXISTS earliest_started_at TIMESTAMPTZ;
ALTER TABLE order_products ADD COLUMN IF NOT EXISTS latest_completed_at TIMESTAMPTZ;
ALTER TABLE order_products ADD COLUMN IF NOT EXISTS estimated_completion_at TIMESTAMPTZ;
ALTER TABLE order_products ADD COLUMN IF NOT EXISTS total_workflow_steps INTEGER DEFAULT 0;
ALTER TABLE order_products ADD COLUMN IF NOT EXISTS completed_workflow_steps INTEGER DEFAULT 0;
ALTER TABLE order_products ADD COLUMN IF NOT EXISTS product_total_duration_minutes INTEGER;
ALTER TABLE order_products ADD COLUMN IF NOT EXISTS product_estimated_duration_minutes INTEGER;

-- Update overall_status check constraint
ALTER TABLE order_products DROP CONSTRAINT IF EXISTS order_products_overall_status_check;
ALTER TABLE order_products ADD CONSTRAINT order_products_overall_status_check 
    CHECK (overall_status IN ('pending', 'in_progress', 'partially_completed', 'completed', 'cancelled'));

-- =====================================================
-- 2. CREATE FUNCTION TO UPDATE ORDER_PRODUCT STATUS
-- =====================================================
CREATE OR REPLACE FUNCTION update_order_product_status()
RETURNS TRIGGER AS $$
DECLARE
  product_id UUID;
  total_steps INTEGER;
  completed_steps INTEGER;
  completion_pct INTEGER;
  overall_stat VARCHAR(20);
  earliest_start TIMESTAMPTZ;
  latest_complete TIMESTAMPTZ;
  total_estimated_minutes INTEGER;
  service_statuses TEXT[];
BEGIN
  -- Determine product_id from the changed step or service
  IF TG_TABLE_NAME = 'order_item_steps' THEN
    IF TG_OP = 'DELETE' THEN
      -- For DELETE, use OLD
      IF OLD.order_product_service_id IS NOT NULL THEN
        SELECT order_product_id INTO product_id
        FROM order_product_services
        WHERE id = OLD.order_product_service_id;
      END IF;
    ELSE
      -- For INSERT/UPDATE, use NEW
      IF NEW.order_product_service_id IS NOT NULL THEN
        SELECT order_product_id INTO product_id
        FROM order_product_services
        WHERE id = NEW.order_product_service_id;
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'order_product_services' THEN
    IF TG_OP = 'DELETE' THEN
      product_id := OLD.order_product_id;
    ELSE
      product_id := NEW.order_product_id;
    END IF;
  END IF;

  IF product_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Count total and completed steps for this product
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE status IN ('completed', 'skipped'))
  INTO total_steps, completed_steps
  FROM order_item_steps
  WHERE order_product_service_id IN (
    SELECT id FROM order_product_services WHERE order_product_id = product_id
  );

  -- Calculate completion percentage
  completion_pct := CASE 
    WHEN total_steps > 0 THEN (completed_steps * 100 / total_steps)
    ELSE 0
  END;

  -- Get service statuses to determine overall status
  SELECT ARRAY_AGG(status)
  INTO service_statuses
  FROM order_product_services
  WHERE order_product_id = product_id;

  -- Determine overall status based on services
  IF service_statuses IS NULL OR array_length(service_statuses, 1) = 0 THEN
    overall_stat := 'pending';
  ELSIF 'cancelled' = ALL(service_statuses) THEN
    overall_stat := 'cancelled';
  ELSIF 'completed' = ALL(service_statuses) THEN
    overall_stat := 'completed';
  ELSIF 'completed' = ANY(service_statuses) THEN
    overall_stat := 'partially_completed';
  ELSIF 'in_progress' = ANY(service_statuses) OR 'assigned' = ANY(service_statuses) THEN
    overall_stat := 'in_progress';
  ELSE
    overall_stat := 'pending';
  END IF;

  -- Get earliest start and latest completion times
  SELECT 
    MIN(started_at),
    MAX(completed_at)
  INTO earliest_start, latest_complete
  FROM order_product_services
  WHERE order_product_id = product_id;

  -- Calculate total estimated duration (sum of all step estimated_duration in minutes)
  SELECT COALESCE(SUM(estimated_duration), 0)
  INTO total_estimated_minutes
  FROM order_item_steps
  WHERE order_product_service_id IN (
    SELECT id FROM order_product_services WHERE order_product_id = product_id
  );

  -- Update order_product
  UPDATE order_products
  SET 
    completion_percentage = completion_pct,
    overall_status = overall_stat,
    total_workflow_steps = total_steps,
    completed_workflow_steps = completed_steps,
    earliest_started_at = earliest_start,
    latest_completed_at = latest_complete,
    product_estimated_duration_minutes = total_estimated_minutes,
    product_total_duration_minutes = CASE 
      WHEN earliest_start IS NOT NULL AND latest_complete IS NOT NULL 
      THEN EXTRACT(EPOCH FROM (latest_complete - earliest_start)) / 60
      ELSE NULL
    END,
    updated_at = NOW()
  WHERE id = product_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 3. CREATE TRIGGERS
-- =====================================================
-- Trigger on order_item_steps changes
DROP TRIGGER IF EXISTS trigger_update_order_product_status ON order_item_steps;
CREATE TRIGGER trigger_update_order_product_status
AFTER INSERT OR UPDATE OR DELETE ON order_item_steps
FOR EACH ROW EXECUTE FUNCTION update_order_product_status();

-- Trigger on order_product_services changes
DROP TRIGGER IF EXISTS trigger_update_order_product_from_service ON order_product_services;
CREATE TRIGGER trigger_update_order_product_from_service
AFTER INSERT OR UPDATE OR DELETE ON order_product_services
FOR EACH ROW EXECUTE FUNCTION update_order_product_status();

-- =====================================================
-- 4. INITIALIZE EXISTING PRODUCTS
-- =====================================================
-- Update all existing products with their current status
DO $$
DECLARE
  product_rec RECORD;
  total_steps INTEGER;
  completed_steps INTEGER;
  completion_pct INTEGER;
  overall_stat VARCHAR(20);
  earliest_start TIMESTAMPTZ;
  latest_complete TIMESTAMPTZ;
  total_estimated_minutes INTEGER;
  actual_duration_minutes INTEGER;
  service_statuses TEXT[];
BEGIN
  FOR product_rec IN SELECT id FROM order_products LOOP
    -- Count total and completed steps for this product
    SELECT 
      COUNT(*),
      COUNT(*) FILTER (WHERE status IN ('completed', 'skipped'))
    INTO total_steps, completed_steps
    FROM order_item_steps
    WHERE order_product_service_id IN (
      SELECT id FROM order_product_services WHERE order_product_id = product_rec.id
    );

    -- Calculate completion percentage
    completion_pct := CASE 
      WHEN total_steps > 0 THEN (completed_steps * 100 / total_steps)
      ELSE 0
    END;

    -- Get service statuses to determine overall status
    SELECT ARRAY_AGG(status)
    INTO service_statuses
    FROM order_product_services
    WHERE order_product_id = product_rec.id;

    -- Determine overall status based on services
    IF service_statuses IS NULL OR array_length(service_statuses, 1) = 0 THEN
      overall_stat := 'pending';
    ELSIF 'cancelled' = ALL(service_statuses) THEN
      overall_stat := 'cancelled';
    ELSIF 'completed' = ALL(service_statuses) THEN
      overall_stat := 'completed';
    ELSIF 'completed' = ANY(service_statuses) THEN
      overall_stat := 'partially_completed';
    ELSIF 'in_progress' = ANY(service_statuses) OR 'assigned' = ANY(service_statuses) THEN
      overall_stat := 'in_progress';
    ELSE
      overall_stat := 'pending';
    END IF;

    -- Get earliest start and latest completion times
    SELECT 
      MIN(started_at),
      MAX(completed_at)
    INTO earliest_start, latest_complete
    FROM order_product_services
    WHERE order_product_id = product_rec.id;

    -- Calculate total estimated duration (sum of all step estimated_duration in minutes)
    SELECT COALESCE(SUM(estimated_duration), 0)
    INTO total_estimated_minutes
    FROM order_item_steps
    WHERE order_product_service_id IN (
      SELECT id FROM order_product_services WHERE order_product_id = product_rec.id
    );

    -- Calculate actual duration if both times are available
    IF earliest_start IS NOT NULL AND latest_complete IS NOT NULL THEN
      actual_duration_minutes := EXTRACT(EPOCH FROM (latest_complete - earliest_start)) / 60;
    ELSE
      actual_duration_minutes := NULL;
    END IF;

    -- Update order_product
    UPDATE order_products
    SET 
      completion_percentage = completion_pct,
      overall_status = overall_stat,
      total_workflow_steps = total_steps,
      completed_workflow_steps = completed_steps,
      earliest_started_at = earliest_start,
      latest_completed_at = latest_complete,
      product_estimated_duration_minutes = total_estimated_minutes,
      product_total_duration_minutes = actual_duration_minutes,
      updated_at = NOW()
    WHERE id = product_rec.id;
  END LOOP;
END $$;

-- =====================================================
-- 5. COMMENTS
-- =====================================================
COMMENT ON COLUMN order_products.completion_percentage IS 'Phần trăm hoàn thành dựa trên số steps đã hoàn thành (0-100)';
COMMENT ON COLUMN order_products.overall_status IS 'Trạng thái tổng hợp: pending, in_progress, partially_completed, completed, cancelled';
COMMENT ON COLUMN order_products.earliest_started_at IS 'Thời điểm bắt đầu sớm nhất trong các dịch vụ';
COMMENT ON COLUMN order_products.latest_completed_at IS 'Thời điểm hoàn thành muộn nhất trong các dịch vụ';
COMMENT ON COLUMN order_products.total_workflow_steps IS 'Tổng số workflow steps của tất cả dịch vụ';
COMMENT ON COLUMN order_products.completed_workflow_steps IS 'Số workflow steps đã hoàn thành';
COMMENT ON COLUMN order_products.product_total_duration_minutes IS 'Tổng thời gian thực tế thực hiện (phút)';
COMMENT ON COLUMN order_products.product_estimated_duration_minutes IS 'Tổng thời gian ước tính (phút)';
