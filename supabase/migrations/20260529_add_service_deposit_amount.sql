-- Cọc theo từng dịch vụ (order_product_services)
ALTER TABLE public.order_product_services
    ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC(15, 2) DEFAULT 0;

COMMENT ON COLUMN public.order_product_services.deposit_amount IS 'Số tiền khách cọc cho dịch vụ này khi tạo đơn';
