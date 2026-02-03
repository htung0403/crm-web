-- Thêm trạng thái "Đã hoàn thiện kỹ thuật" (tech_completed) cho đơn hàng.
-- Trạng thái khi kỹ thuật viên đã hoàn thành tất cả các bước quy trình của dịch vụ.

-- Bỏ constraint cũ (nếu có) rồi thêm constraint mới bao gồm tech_completed
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE orders ADD CONSTRAINT orders_status_check
    CHECK (status IS NULL OR status IN (
        'pending',
        'confirmed',
        'processing',
        'tech_completed',
        'completed',
        'cancelled'
    ));

COMMENT ON COLUMN orders.status IS 'pending=Đơn nháp, confirmed=Đã xác nhận, processing=Đang thực hiện, tech_completed=Đã hoàn thiện kỹ thuật, completed=Hoàn thành, cancelled=Đã huỷ';
