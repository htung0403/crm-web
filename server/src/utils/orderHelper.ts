import { supabaseAdmin } from '../config/supabase.js';

/**
 * Checks if an order meets the criteria for auto-completion:
 * 1. Fully paid (remaining_debt <= 0)
 * 2. All services/items are completed, cancelled, or skipped.
 *
 * If met, updates order status to 'done'.
 * Returns the final order status.
 */
export async function checkAndCompleteOrder(orderId: string): Promise<string> {
    try {
        // 1. Fetch Order with payment info
        const { data: order, error: orderError } = await supabaseAdmin
            .from('orders')
            .select('id, status, total_amount, paid_amount, remaining_debt')
            .eq('id', orderId)
            .single();

        if (orderError || !order) {
            console.error('checkAndCompleteOrder: Order not found', orderError);
            return 'unknown';
        }

        const currentStatus = order.status;
        // If already done, cancelled, or after_sale, we generally don't want to revert to done automatically
        // unless we want to allow re-completion from after_sale?
        // Let's assume if it's 'cancelled', we do nothing.
        // If it's 'after_sale', it's technically "more than done", so we leave it.
        // If it's 'done', we leave it.
        if (['done', 'after_sale', 'cancelled'].includes(currentStatus)) {
            return currentStatus;
        }

        // 2. Check Payment Condition
        // Logic: Paid >= Total OR remaining_debt <= 0
        const isPaid = (order.remaining_debt <= 0) || ((order.paid_amount || 0) >= (order.total_amount || 0));

        if (!isPaid) {
            return currentStatus; // Not paid enough, cannot complete
        }

        // 3. Check Services/Items Completion Condition
        // We need to check:
        // - order_items (Sale Items / V1 Service Items)
        // - order_products -> order_product_services (V2 Service Items)

        // Fetch order_items
        const { data: orderItems } = await supabaseAdmin
            .from('order_items')
            .select('id, status, item_type')
            .eq('order_id', orderId);

        // Fetch order_products -> services
        const { data: orderProducts } = await supabaseAdmin
            .from('order_products')
            .select(`
                id,
                services:order_product_services(
                    id, status, item_type,
                    steps:order_item_steps(id, status)
                )
            `)
            .eq('order_id', orderId);

        let allItemsCompleted = true;

        // Check V1 items (order_items)
        if (orderItems && orderItems.length > 0) {
            for (const item of orderItems) {
                // If it's a product, status is usually 'pending' or 'delivered'?
                // For now, let's assume 'completed' means done.
                // But for physical products, maybe 'delivered'?
                // The prompt focuses on "services".
                // Let's stick to the logic: "All services within the order are finished".
                if (item.item_type === 'service' || item.item_type === 'package') {
                    if (!['completed', 'cancelled', 'skipped'].includes(item.status)) {
                        allItemsCompleted = false;
                        break;
                    }
                }
            }
        }

        if (allItemsCompleted && orderProducts && orderProducts.length > 0) {
            for (const p of orderProducts) {
                if (p.services && Array.isArray(p.services)) {
                    for (const s of p.services) {
                        // Check service status
                        if (!['completed', 'cancelled', 'skipped'].includes(s.status)) {
                            // Double check steps if service status is not explicitly completed
                            // (Sometimes service status update lags behind steps?)
                            // But ideally service status IS the source of truth.
                            // Let's rely on service status first.
                            // If service status is 'in_progress' or 'pending', check if all steps are done?
                            // The existing logic updates service status to 'completed' when last step is done.
                            // So safely relying on service status is better.
                            allItemsCompleted = false;
                            break;
                        }

                        // Extra safety: Check steps if available?
                        // If service status says completed, steps should be done.
                        // If service is 'in_progress', but all steps are done (maybe update failed?), we might want to catch that.
                        // But simpler is to assume data consistency from other endpoints.
                    }
                }
                if (!allItemsCompleted) break;
            }
        }

        if (allItemsCompleted) {
            // Both conditions met!
            const { error: updateError } = await supabaseAdmin
                .from('orders')
                .update({
                    status: 'done',
                    completed_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', orderId);

            if (updateError) {
                console.error('checkAndCompleteOrder: Failed to update status', updateError);
                return currentStatus;
            }

            // Record commissions for Sales and Technicians
            await recordCommissions(orderId);

            return 'done';
        }

        return currentStatus;

    } catch (error) {
        console.error('checkAndCompleteOrder: Unexpected error', error);
        return 'unknown';
    }
}

/**
 * Records commissions for an order when it is completed.
 * This handles both Sales (5% of total) and Technicians (based on service rates).
 */
export async function recordCommissions(orderId: string): Promise<void> {
    try {
        console.log(`[Commission] Starting recording for order: ${orderId}`);

        // 1. Fetch existing commissions for this order to avoid duplicates
        const { data: existingCommissions, error: existingError } = await supabaseAdmin
            .from('commissions')
            .select('user_id, amount, notes, commission_type')
            .eq('order_id', orderId);

        if (existingError) {
            console.error('[Commission] Error fetching existing commissions:', existingError);
            // Continue, but might risk duplicates
        }

        const hasCommission = (userId: string, type: string, notesPart: string) => {
            return (existingCommissions || []).some(c =>
                c.user_id === userId &&
                c.commission_type === type &&
                (c.notes || '').includes(notesPart)
            );
        };

        // 2. Fetch Order details
        const { data: order, error: orderError } = await supabaseAdmin
            .from('orders')
            .select(`
                id, 
                order_code, 
                total_amount, 
                sales_id,
                sales:users!orders_sales_id_fkey(id, name, commission)
            `)
            .eq('id', orderId)
            .single();

        if (orderError || !order) {
            console.error('[Commission] Order not found or error:', orderError);
            return;
        }

        // 3. Record Sales Commission
        if (order.sales_id && !hasCommission(order.sales_id, 'product', `Hoa hồng Sales cho đơn hàng ${order.order_code}`)) {
            const salesPerson = order.sales as any;
            // Use user's commission rate or default to 5%
            const commissionRate = (salesPerson?.commission || 5) / 100;
            const amount = Math.floor(order.total_amount * commissionRate);

            if (amount > 0) {
                const { error: saleCommError } = await supabaseAdmin
                    .from('commissions')
                    .insert({
                        user_id: order.sales_id,
                        order_id: order.id,
                        commission_type: 'product',
                        amount: amount,
                        percentage: (salesPerson?.commission || 5),
                        base_amount: order.total_amount,
                        status: 'pending',
                        notes: `Hoa hồng Sales cho đơn hàng ${order.order_code}`
                    });

                if (saleCommError) {
                    console.error('[Commission] Error recording sales commission:', saleCommError.message);
                } else {
                    console.log(`[Commission] Recorded Sales commission for ${order.sales_id}: ${amount}`);
                }
            }
        }

        // 4. Record Technician Commissions (V2 Service Technicians)
        const { data: orderProducts, error: opError } = await supabaseAdmin
            .from('order_products')
            .select(`
                id,
                order_product_services (
                    id,
                    item_name,
                    unit_price,
                    technicians:order_product_service_technicians (
                        technician_id,
                        commission
                    )
                )
            `)
            .eq('order_id', orderId);

        if (opError) {
            console.error('[Commission] Error fetching V2 products:', opError.message);
        } else if (orderProducts) {
            for (const product of orderProducts) {
                const services = product.order_product_services || [];
                for (const service of services as any[]) {
                    const technicians = service.technicians || [];
                    const servicePrice = service.unit_price || 0;

                    for (const tech of technicians) {
                        const note = `Hoa hồng KTV cho dịch vụ ${service.item_name} (Đơn ${order.order_code})`;
                        if (hasCommission(tech.technician_id, 'service', note)) continue;

                        let commissionRate = tech.commission;

                        // FALLBACK: If commission is 0 or null, fetch from user profile
                        if (!commissionRate || commissionRate <= 0) {
                            const { data: userData } = await supabaseAdmin
                                .from('users')
                                .select('commission')
                                .eq('id', tech.technician_id)
                                .single();
                            commissionRate = userData?.commission || 0;
                        }

                        if (commissionRate > 0) {
                            const techCommission = Math.floor((servicePrice * commissionRate) / 100);

                            const { error: techCommError } = await supabaseAdmin
                                .from('commissions')
                                .insert({
                                    user_id: tech.technician_id,
                                    order_id: order.id,
                                    commission_type: 'service',
                                    amount: techCommission,
                                    percentage: commissionRate,
                                    base_amount: servicePrice,
                                    status: 'pending',
                                    notes: note
                                });

                            if (techCommError) {
                                console.error(`[Commission] Error recording tech commission for ${tech.technician_id}:`, techCommError.message);
                            } else {
                                console.log(`[Commission] Recorded Tech commission for ${tech.technician_id}: ${techCommission} (Rate: ${commissionRate}%)`);
                            }
                        }
                    }
                }
            }
        }

        // 5. Record Technician Commissions (V1 items)
        const { data: orderItems, error: oiError } = await supabaseAdmin
            .from('order_items')
            .select('id, technician_id, commission_tech_amount, commission_tech_rate, total_price, item_name')
            .eq('order_id', orderId);

        if (oiError) {
            console.error('[Commission] Error fetching V1 items:', oiError.message);
        } else if (orderItems) {
            for (const item of orderItems) {
                if (item.technician_id && item.commission_tech_amount > 0) {
                    const note = `Hoa hồng KTV cho hạng mục ${item.item_name} (Đơn ${order.order_code} - V1)`;
                    if (hasCommission(item.technician_id, 'service', note)) continue;

                    const { error: techCommError } = await supabaseAdmin
                        .from('commissions')
                        .insert({
                            user_id: item.technician_id,
                            order_id: order.id,
                            commission_type: 'service',
                            amount: item.commission_tech_amount,
                            percentage: item.commission_tech_rate,
                            base_amount: item.total_price,
                            status: 'pending',
                            notes: note
                        });

                    if (techCommError) {
                        console.error(`[Commission] Error recording V1 tech commission for ${item.technician_id}:`, techCommError.message);
                    } else {
                        console.log(`[Commission] Recorded V1 Tech commission for ${item.technician_id}: ${item.commission_tech_amount}`);
                    }
                }
            }
        }

    } catch (error) {
        console.error('[Commission] Unexpected error in recordCommissions:', error);
    }
}
