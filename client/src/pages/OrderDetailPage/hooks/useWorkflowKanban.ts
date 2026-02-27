import { useMemo, useCallback } from 'react';
import type { Order, OrderItem } from '@/hooks/useOrders';
import type { WorkflowKanbanGroup, TechRoom, StepDeadlineInfo, CurrentStepInfo } from '../types';
import { getTechRoomByStepOrder, getTechRoomByDepartmentName } from '@/components/orders/constants';

export function useWorkflowKanban(
    order: Order | null,
    allWorkflowSteps: any[]
) {
    // Nhóm theo sản phẩm (product + các dịch vụ) cho Kanban Tiến trình/Quy trình
    const workflowKanbanGroups = useMemo((): WorkflowKanbanGroup[] => {
        const items = order?.items || [];
        const groups: WorkflowKanbanGroup[] = [];

        // Use a Set to track processed IDs to handle flat items correctly
        const processedIds = new Set<string>();

        // 1. Group Customer Items (Products and their nested services)
        items.forEach((item: any, index) => {
            if (item.is_customer_item && item.item_type === 'product' && !processedIds.has(item.id)) {
                processedIds.add(item.id);

                // Find services that belong to this product
                // In flat list, services usually follow the product
                const services: OrderItem[] = [];
                let j = index + 1;
                while (j < items.length) {
                    const next = items[j];
                    // Stop if we hit another customer product
                    if (next.is_customer_item && next.item_type === 'product') break;

                    // If it's a service/package, it belongs to the previous product
                    if (next.item_type === 'service' || next.item_type === 'package') {
                        services.push(next);
                        processedIds.add(next.id);
                    }
                    j++;
                }
                groups.push({ product: item, services });
            }
        });

        // 2. Add remaining items as standalone groups (Sale items or leftover services)
        items.forEach((item) => {
            if (!processedIds.has(item.id)) {
                if (item.item_type === 'product') {
                    groups.push({ product: item, services: [] });
                } else if (item.item_type === 'service' || item.item_type === 'package') {
                    groups.push({ product: null, services: [item] });
                }
                processedIds.add(item.id);
            }
        });

        return groups;
    }, [order?.items]);

    // Current step for an item (in_progress or first pending/assigned) for "Xác nhận hoàn thành bước"
    const getItemCurrentStep = useCallback((itemId: string): CurrentStepInfo | null => {
        const steps = allWorkflowSteps.filter((s: any) => s.item_id === itemId || s.order_item_id === itemId || s.order_product_service_id === itemId);
        const inProgress = steps.find((s: any) => s.status === 'in_progress');
        const firstPending = steps.find((s: any) => s.status === 'pending' || s.status === 'assigned');
        const step = inProgress || firstPending;
        return step ? { id: step.id, step_name: step.step_name, status: step.status, department: step.department } : null;
    }, [allWorkflowSteps]);

    // Hạn hoàn thành bước dịch vụ: từ started_at + estimated_duration (ngày) của bước hiện tại
    const getStepDeadlineDisplay = useCallback((itemId: string): StepDeadlineInfo => {
        const steps = allWorkflowSteps.filter((s: any) => s.item_id === itemId || s.order_item_id === itemId || s.order_product_service_id === itemId);

        if (steps.length === 0) {
            return { label: 'Chờ quy trình', dueAt: null };
        }

        const inProgress = steps.find((s: any) => s.status === 'in_progress');
        const firstPending = steps.find((s: any) => s.status === 'pending' || s.status === 'assigned');
        const step = inProgress || firstPending;

        if (!step) {
            // All steps completed or cancelled
            const allCompleted = steps.every(s => s.status === 'completed' || s.status === 'skipped');
            if (allCompleted) return { label: 'Đã hoàn thành', dueAt: null };
            return { label: 'N/A', dueAt: null };
        }

        const days = Number(step.estimated_duration) || 0;
        const baseAt = step.started_at || order?.confirmed_at || order?.created_at;

        if (!baseAt || days <= 0) return { label: 'Chưa có hạn', dueAt: null };

        const base = new Date(baseAt);
        const dueAt = new Date(base);
        dueAt.setDate(dueAt.getDate() + days);
        const diff = Math.ceil((dueAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        const label = diff < 0 ? `Trễ ${Math.abs(diff)} ngày` : `Còn ${diff} ngày`;
        return { label, dueAt };
    }, [allWorkflowSteps, order?.confirmed_at, order?.created_at]);

    // Compute current tech room: ưu tiên department của bước (Bộ phận: Dán đế → Phòng Dán đế), fallback step_order
    const getItemCurrentTechRoom = useCallback((itemId: string): TechRoom => {
        const item = order?.items?.find(i => i.id === itemId);
        if (item?.status === 'cancelled') return 'fail';
        if (item?.status === 'completed' || item?.status === 'done') return 'done';

        const steps = allWorkflowSteps.filter((s: any) => s.item_id === itemId || s.order_item_id === itemId || s.order_product_service_id === itemId);
        if (steps.length === 0) return 'waiting';

        const inProgress = steps.find((s: any) => s.status === 'in_progress');
        const firstPending = steps.find((s: any) => s.status === 'pending' || s.status === 'assigned');
        const step = inProgress || firstPending;

        if (!step) {
            // Check if all steps are completed or skipped
            const allFinished = steps.every(s => s.status === 'completed' || s.status === 'skipped');
            if (allFinished) return 'done';
            return 'waiting';
        }

        const roomByDept = getTechRoomByDepartmentName(step?.department?.name);
        if (roomByDept) return roomByDept;
        const order_val = step?.step_order ?? 1;
        return getTechRoomByStepOrder(order_val);
    }, [allWorkflowSteps, order?.items]);

    // Phòng hiện tại = phòng của dịch vụ đang có bước hiện tại (lead), để card nằm đúng cột với bước đang hiển thị
    const getGroupCurrentTechRoom = useCallback((group: WorkflowKanbanGroup): TechRoom => {
        // 1. Tìm dịch vụ đang có bước hiện tại (in_progress hoặc pending/assigned)
        const activeService = group.services.find((s) => getItemCurrentStep(s.id));
        if (activeService) return getItemCurrentTechRoom(activeService.id);

        // 2. Nếu không có bước nào hiện tại, tìm dịch vụ chưa hoàn thành/huỷ (đang 'waiting')
        const waitingService = group.services.find((s) => {
            const room = getItemCurrentTechRoom(s.id);
            return room !== 'done' && room !== 'fail';
        });
        if (waitingService) return getItemCurrentTechRoom(waitingService.id);

        // 3. Nếu tất cả đã hoàn thành/huỷ, lấy room của dịch vụ cuối cùng (có thể là 'done' hoặc 'fail')
        const leadItem = group.services[group.services.length - 1] ?? group.services[0];
        if (!leadItem) return 'waiting';
        return getItemCurrentTechRoom(leadItem.id);
    }, [getItemCurrentTechRoom, getItemCurrentStep]);

    return {
        workflowKanbanGroups,
        getItemCurrentStep,
        getStepDeadlineDisplay,
        getItemCurrentTechRoom,
        getGroupCurrentTechRoom,
    };
}
