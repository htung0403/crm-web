import { Router, Request, Response, NextFunction } from 'express';
import { checkAllSLA } from '../utils/slaManager.js';
import { ApiError } from '../middleware/errorHandler.js';
import { supabaseAdmin } from '../config/supabase.js';
import { autoLogKpiViolation } from '../utils/kpiViolationLogger.js';

const router = Router();

/**
 * Middleware: Verify CRON_SECRET to prevent unauthorized SLA triggers
 */
const verifyCronSecret = (req: Request, res: Response, next: NextFunction) => {
    const secret = req.headers['x-cron-secret'] || req.query.secret;
    const expectedSecret = process.env.CRON_SECRET;

    if (!expectedSecret) {
        console.error('[Cron] CRON_SECRET is not configured in .env');
        return next(); // If not configured, allow for now but log error
    }

    if (!secret || secret !== expectedSecret) {
        console.warn('[Cron] Unauthorized trigger attempt');
        throw new ApiError('Unauthorized - Invalid cron secret', 401);
    }

    next();
};

/**
 * GET /api/cron/check-sla
 * Trigger SLA scan via HTTP (for Cron-job.org or Render Cron)
 */
router.get('/check-sla', verifyCronSecret, async (req: Request, res: Response, next: NextFunction) => {
    try {
        console.log('[Cron] Manual SLA Check Triggered via HTTP');
        
        // Run the SLA check logic
        await checkAllSLA();
        
        res.json({
            status: 'success',
            message: 'SLA check completed',
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/cron/test-webhook
 * Trigger a dummy webhook to verify n8n integration
 */
router.get('/test-webhook', verifyCronSecret, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { fireWebhook } = await import('../utils/webhookNotifier.js');
        console.log('[Cron] Manual Webhook Test Triggered');
        
        const result = await fireWebhook('CRM_TEST_DEBUG', {
            message: 'Đây là tin nhắn test từ hệ thống CRM SLA Engine',
            triggered_by: 'Manual Trigger',
            tele_id_sale: '123456789', // Dummy ID for testing
            link_lead: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/leads/test-id`,
            server_time: new Date().toISOString()
        });
        
        res.json({
            status: result?.ok ? 'success' : 'failed',
            n8n_status: result?.status,
            message: result?.ok ? 'Test webhook fired successfully' : 'Failed to fire test webhook',
        });
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/cron/auto-payroll
 * Check if today is the last Sunday of the month, create payroll batch if so
 * Should be called daily via external cron
 */
router.get('/auto-payroll', verifyCronSecret, async (req: Request, res: Response, next: NextFunction) => {
    try {
        console.log('[Cron] Auto-Payroll Check Triggered');

        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;

        // Calculate last Sunday of current month
        const lastDay = new Date(year, month, 0);
        const dayOfWeek = lastDay.getDay();
        const lastSunday = new Date(lastDay);
        lastSunday.setDate(lastDay.getDate() - (dayOfWeek === 0 ? 0 : dayOfWeek));

        const isLastSunday = now.getDate() === lastSunday.getDate();

        if (!isLastSunday) {
            return res.json({
                status: 'skipped',
                message: `Hôm nay (${now.toISOString().split('T')[0]}) không phải chủ nhật cuối tháng (${lastSunday.toISOString().split('T')[0]})`,
            });
        }

        // Import supabase and create batch
        const { supabaseAdmin } = await import('../config/supabase.js');

        // Check if batch already exists
        const { data: existing } = await supabaseAdmin
            .from('payroll_batches')
            .select('id, code')
            .eq('month', month)
            .eq('year', year)
            .single();

        if (existing) {
            return res.json({
                status: 'already_exists',
                message: `Bảng lương tháng ${month}/${year} đã tồn tại: ${existing.code}`,
            });
        }

        // Create new batch
        const lastDayNum = new Date(year, month, 0).getDate();
        const { data: batch, error } = await supabaseAdmin
            .from('payroll_batches')
            .insert({
                code: '',
                name: `Bảng lương tháng ${month}/${year}`,
                month,
                year,
                pay_period: 'Hàng tháng',
                work_period_start: `${year}-${String(month).padStart(2, '0')}-01`,
                work_period_end: `${year}-${String(month).padStart(2, '0')}-${lastDayNum}`,
                status: 'pending',
                scope: 'Tất cả nhân viên',
            })
            .select()
            .single();

        if (error) {
            console.error('[Cron] Error creating payroll batch:', error);
            throw error;
        }

        console.log(`[Cron] Auto-created payroll batch: ${batch.code} for ${month}/${year}`);

        res.json({
            status: 'success',
            message: `Tự động tạo bảng lương tháng ${month}/${year}: ${batch.code}`,
            data: { batch },
        });
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/cron/check-partner-appointments
 * Check partner appointments:
 * 1. If appointment is today -> mark card with red border (handled by frontend)
 * 2. If appointment is tomorrow -> send notification to all managers/admins
 */
router.get('/check-partner-appointments', verifyCronSecret, async (req: Request, res: Response, next: NextFunction) => {
    try {
        console.log('[Cron] Partner Appointments Check Triggered');

        const now = new Date();
        
        // Calculate tomorrow's date range (00:00:00 to 23:59:59)
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        
        const dayAfterTomorrow = new Date(tomorrow);
        dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

        // Find partner requests with appointment_time tomorrow
        const { data: tomorrowAppointments, error: appointmentsError } = await supabaseAdmin
            .from('order_item_partner')
            .select(`
                id,
                status,
                metadata,
                order_item:order_items(id, item_name, order:orders(id, order_code)),
                order_product:order_products(id, name, order:orders(id, order_code)),
                order_product_service:order_product_services(id, order_product:order_products(name, order:orders(id, order_code)))
            `)
            .eq('status', 'partner_doing');

        if (appointmentsError) {
            throw new ApiError('Error fetching partner appointments: ' + appointmentsError.message, 500);
        }

        // Filter to only tomorrow's appointments
        const tomorrowItems = (tomorrowAppointments || []).filter((item: any) => {
            const appointmentTime = item.metadata?.appointment_time;
            if (!appointmentTime) return false;
            const aptDate = new Date(appointmentTime);
            return aptDate.getTime() >= tomorrow.getTime() && aptDate.getTime() < dayAfterTomorrow.getTime();
        });

        // Get all managers and admins
        const { data: managers, error: managersError } = await supabaseAdmin
            .from('users')
            .select('id, name, role')
            .in('role', ['admin', 'manager'])
            .eq('status', 'active');

        if (managersError) {
            throw new ApiError('Error fetching managers: ' + managersError.message, 500);
        }

// Create notifications for each tomorrow appointment
        const notifications: any[] = [];
        for (const item of tomorrowItems) {
            // Supabase returns relations as arrays, get first element
            const orderItem = Array.isArray(item.order_item) ? item.order_item[0] : item.order_item;
            const orderProduct = Array.isArray(item.order_product) ? item.order_product[0] : item.order_product;
            const orderProductService = Array.isArray(item.order_product_service) ? item.order_product_service[0] : item.order_product_service;
            const orderProd = orderProductService?.order_product;
            const orderProdFinal = Array.isArray(orderProd) ? orderProd[0] : orderProd;
            
            const itemName = orderItem?.item_name || 
                           orderProduct?.name || 
                           orderProdFinal?.name || 
                           'Sản phẩm';
            const orderObj = orderItem?.order || orderProduct?.order || orderProdFinal?.order;
            const orderObjFinal = Array.isArray(orderObj) ? orderObj[0] : orderObj;
            const orderCode = orderObjFinal?.order_code || 'N/A';
            const appointmentDate = new Date(item.metadata.appointment_time).toLocaleString('vi-VN', {
                hour: '2-digit',
                minute: '2-digit',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });

            for (const manager of (managers || [])) {
                notifications.push({
                    user_id: manager.id,
                    type: 'partner_appointment',
                    title: 'Nhắc lịch hẹn đối tác ngày mai',
                    message: `${itemName} (${orderCode}) có lịch hẹn đối tác vào ngày mai: ${appointmentDate}`,
                    data: {
                partner_request_id: item.id,
                order_code: orderCode,
                appointment_time: item.metadata.appointment_time,
                item_name: itemName
            },
                    is_read: false,
                    created_at: new Date().toISOString()
                });
            }
        }

        // Insert all notifications
        if (notifications.length > 0) {
            const { error: insertError } = await supabaseAdmin
                .from('notifications')
                .insert(notifications);

            if (insertError) {
                console.error('[Cron] Error inserting notifications:', insertError);
            } else {
                console.log(`[Cron] Created ${notifications.length} notifications for ${(managers || []).length} managers`);
            }
        }

        res.json({
            status: 'success',
            message: 'Partner appointments check completed',
            data: {
                tomorrow_appointments: tomorrowItems.length,
                managers_notified: (managers || []).length,
                notifications_created: notifications.length,
                appointments: tomorrowItems.map((item: any) => {
                    const oi = Array.isArray(item.order_item) ? item.order_item[0] : item.order_item;
                    const op = Array.isArray(item.order_product) ? item.order_product[0] : item.order_product;
                    return {
                        id: item.id,
                        appointment_time: item.metadata?.appointment_time,
                        item_name: oi?.item_name || op?.name || 'N/A'
                    };
                })
            },
            timestamp: now.toISOString()
        });
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/cron/check-debt-overdue
 * Detect orders at kiểm nợ stage with overdue debt (>10 days).
 * Auto-creates KPI violation logs for responsible sales.
 * Should be called daily via external cron.
 */
router.get('/check-debt-overdue', verifyCronSecret, async (req: Request, res: Response, next: NextFunction) => {
    try {
        console.log('[Cron] Debt Overdue Check Triggered');
        
        const now = new Date();
        const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
        
        // Find orders where:
        // - debt_start_at is set and older than 10 days
        // - remaining_debt > 0
        // - sales_id is set (someone is responsible)
        // - order is not cancelled
        const { data: overdueOrders, error } = await supabaseAdmin
            .from('orders')
            .select('id, order_code, sales_id, debt_start_at, remaining_debt, total_amount')
            .not('debt_start_at', 'is', null)
            .not('sales_id', 'is', null)
            .gt('remaining_debt', 0)
            .lt('debt_start_at', tenDaysAgo.toISOString())
            .neq('status', 'cancelled');
        
        if (error) {
            console.error('[Cron] Error fetching overdue orders:', error);
            throw error;
        }
        
        let violationsCreated = 0;
        const details: any[] = [];
        
        for (const order of (overdueOrders || [])) {
            const overdueDays = Math.floor(
                (now.getTime() - new Date(order.debt_start_at).getTime()) / (24 * 60 * 60 * 1000)
            );
            
            await autoLogKpiViolation({
                employeeId: order.sales_id,
                relatedOrderId: order.id,
                ruleCode: 'debt_overdue',
                ruleName: `Nợ quá hạn (${overdueDays} ngày) - ${order.order_code}`,
                deductPoint: 0,
                note: `Đơn ${order.order_code}: còn nợ ${order.remaining_debt?.toLocaleString('vi-VN')}đ, đã ${overdueDays} ngày kể từ kiểm nợ`
            });
            
            violationsCreated++;
            details.push({
                order_code: order.order_code,
                sales_id: order.sales_id,
                remaining_debt: order.remaining_debt,
                overdue_days: overdueDays
            });
        }
        
        console.log(`[Cron] Debt check complete: ${violationsCreated} violations logged`);
        
        res.json({
            status: 'success',
            message: `Checked debt overdue: ${(overdueOrders || []).length} overdue orders found`,
            data: {
                overdue_count: (overdueOrders || []).length,
                violations_created: violationsCreated,
                details
            },
            timestamp: now.toISOString()
        });
    } catch (err) {
        next(err);
    }
});

export { router as cronRouter };
