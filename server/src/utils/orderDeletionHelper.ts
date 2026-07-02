import { supabaseAdmin } from '../config/supabase.js';
import { ApiError } from '../middleware/errorHandler.js';

type DeleteOrderCascadeOptions = {
    allowStatuses?: string[];
};

export async function deleteOrderCascade(orderId: string, options: DeleteOrderCascadeOptions = {}) {
    const { data: order, error: orderError } = await supabaseAdmin
        .from('orders')
        .select('id, order_code, status')
        .eq('id', orderId)
        .single();

    if (orderError || !order) {
        throw new ApiError('Không tìm thấy đơn hàng', 404);
    }

    if (options.allowStatuses?.length && !options.allowStatuses.includes(order.status)) {
        throw new ApiError(`Không thể xóa đơn hàng ở trạng thái ${order.status}`, 400);
    }

    const { data: orderItems, error: orderItemsError } = await supabaseAdmin
        .from('order_items')
        .select('id, product_id, quantity, item_type')
        .eq('order_id', orderId);

    if (orderItemsError) {
        throw new ApiError('Không thể lấy danh sách hạng mục đơn hàng', 500);
    }

    const { data: orderProducts, error: orderProductsError } = await supabaseAdmin
        .from('order_products')
        .select('id')
        .eq('order_id', orderId);

    if (orderProductsError) {
        throw new ApiError('Không thể lấy danh sách sản phẩm đơn hàng', 500);
    }

    const orderItemIds = (orderItems || []).map(item => item.id);
    const orderProductIds = (orderProducts || []).map(product => product.id);

    const { data: orderServices, error: orderServicesError } = orderProductIds.length > 0
        ? await supabaseAdmin
            .from('order_product_services')
            .select('id')
            .in('order_product_id', orderProductIds)
        : { data: [], error: null };

    if (orderServicesError) {
        throw new ApiError('Không thể lấy danh sách dịch vụ đơn hàng', 500);
    }

    const orderServiceIds = (orderServices || []).map(service => service.id);

    const stepQueries: Promise<any>[] = [];
    if (orderItemIds.length > 0) {
        stepQueries.push(
            supabaseAdmin.from('order_item_steps').select('id').in('order_item_id', orderItemIds),
        );
    }
    if (orderServiceIds.length > 0) {
        stepQueries.push(
            supabaseAdmin.from('order_item_steps').select('id').in('order_product_service_id', orderServiceIds),
        );
    }

    const stepResults = await Promise.all(stepQueries);
    const orderStepIds = stepResults.flatMap(result => (result.data || []).map((step: { id: string }) => step.id));

    const { data: invoices, error: invoicesError } = await supabaseAdmin
        .from('invoices')
        .select('id')
        .eq('order_id', orderId);

    if (invoicesError) {
        throw new ApiError('Không thể lấy danh sách hóa đơn của đơn hàng', 500);
    }

    const invoiceIds = (invoices || []).map(invoice => invoice.id);

    for (const item of orderItems || []) {
        if (!item.product_id || item.item_type !== 'product') continue;

        try {
            const { data: product } = await supabaseAdmin
                .from('products')
                .select('stock')
                .eq('id', item.product_id)
                .single();

            if (product) {
                const restoredStock = (product.stock || 0) + (Number(item.quantity) || 0);
                await supabaseAdmin
                    .from('products')
                    .update({ stock: restoredStock })
                    .eq('id', item.product_id);
            }
        } catch (error) {
            console.error('[OrderDeleteCascade] Error restoring stock:', error);
        }
    }

    if (orderStepIds.length > 0) {
        const { error } = await supabaseAdmin
            .from('order_workflow_step_log')
            .delete()
            .in('order_item_step_id', orderStepIds);
        if (error) throw new ApiError('Không thể xóa log quy trình của đơn hàng', 500);
    }

    if (orderItemIds.length > 0) {
        const [techniciansDelete, salesDelete] = await Promise.all([
            supabaseAdmin.from('order_item_technicians').delete().in('order_item_id', orderItemIds),
            supabaseAdmin.from('order_item_sales').delete().in('order_item_id', orderItemIds),
        ]);

        if (techniciansDelete.error || salesDelete.error) {
            throw new ApiError('Không thể xóa phân công của hạng mục đơn hàng', 500);
        }
    }

    if (orderServiceIds.length > 0) {
        const [techniciansDelete, salesDelete] = await Promise.all([
            supabaseAdmin
                .from('order_product_service_technicians')
                .delete()
                .in('order_product_service_id', orderServiceIds),
            supabaseAdmin
                .from('order_product_service_sales')
                .delete()
                .in('order_product_service_id', orderServiceIds),
        ]);

        if (techniciansDelete.error || salesDelete.error) {
            throw new ApiError('Không thể xóa phân công của dịch vụ đơn hàng', 500);
        }
    }

    if (orderStepIds.length > 0) {
        const { error } = await supabaseAdmin
            .from('order_item_steps')
            .delete()
            .in('id', orderStepIds);
        if (error) throw new ApiError('Không thể xóa các bước quy trình của đơn hàng', 500);
    }

    const technicianTaskDeleteQueries: Promise<any>[] = [
        supabaseAdmin.from('technician_tasks').delete().eq('order_id', orderId),
    ];
    if (orderItemIds.length > 0) {
        technicianTaskDeleteQueries.push(
            supabaseAdmin.from('technician_tasks').delete().in('order_item_id', orderItemIds),
        );
    }
    if (orderProductIds.length > 0) {
        technicianTaskDeleteQueries.push(
            supabaseAdmin.from('technician_tasks').delete().in('order_product_id', orderProductIds),
        );
    }
    if (orderServiceIds.length > 0) {
        technicianTaskDeleteQueries.push(
            supabaseAdmin.from('technician_tasks').delete().in('order_product_service_id', orderServiceIds),
        );
    }

    const technicianTaskDeletes = await Promise.all(technicianTaskDeleteQueries);
    if (technicianTaskDeletes.some(result => result.error)) {
        throw new ApiError('Không thể xóa công việc kỹ thuật liên quan đơn hàng', 500);
    }

    const paymentDeleteQueries: Promise<any>[] = [
        supabaseAdmin.from('transactions').delete().eq('order_id', orderId),
        supabaseAdmin.from('payment_records').delete().eq('order_id', orderId),
    ];
    if (invoiceIds.length > 0) {
        paymentDeleteQueries.push(
            supabaseAdmin.from('finance_transactions').delete().in('invoice_id', invoiceIds),
        );
    }

    const paymentDeletes = await Promise.all(paymentDeleteQueries);
    if (paymentDeletes.some(result => result.error)) {
        throw new ApiError('Không thể xóa chứng từ thanh toán liên quan đơn hàng', 500);
    }

    if (invoiceIds.length > 0) {
        const { error } = await supabaseAdmin.from('invoices').delete().eq('order_id', orderId);
        if (error) throw new ApiError('Không thể xóa hóa đơn liên quan đơn hàng', 500);
    }

    if (orderServiceIds.length > 0) {
        const { error } = await supabaseAdmin
            .from('order_product_services')
            .delete()
            .in('id', orderServiceIds);
        if (error) throw new ApiError('Không thể xóa dịch vụ của đơn hàng', 500);
    }

    if (orderProductIds.length > 0) {
        const { error } = await supabaseAdmin.from('order_products').delete().eq('order_id', orderId);
        if (error) throw new ApiError('Không thể xóa sản phẩm của đơn hàng', 500);
    }

    if (orderItemIds.length > 0) {
        const { error } = await supabaseAdmin.from('order_items').delete().eq('order_id', orderId);
        if (error) throw new ApiError('Không thể xóa hạng mục của đơn hàng', 500);
    }

    const { error: deleteOrderError } = await supabaseAdmin.from('orders').delete().eq('id', orderId);
    if (deleteOrderError) {
        throw new ApiError('Không thể xóa đơn hàng', 500);
    }

    return order;
}
