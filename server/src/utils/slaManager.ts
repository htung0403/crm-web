import { supabaseAdmin } from '../config/supabase.js';
import { fireWebhook } from './webhookNotifier.js';

export const SLA_CYCLES = [3, 60, 180, 300, 420, 1440, 2880, 3120, 4020, 5160, 6600];
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

const firedAlerts = new Set<string>();

/**
 * Tính toán mốc Deadline mới dựa trên cơ chế Pause khi xuyên màn đêm 00:00 -> 06:30
 */
export function calculateDeadline(now: Date, ruleMinutes: number, isRule0: boolean): Date {
    let current = new Date(now.getTime());
    let remaining = ruleMinutes;
    
    let iters = 0;
    while(remaining > 0 && iters < 20000) {
        current = new Date(current.getTime() + 60000); // Tiến thêm 1 phút
        iters++;
        
        // Ngoại trừ Rule 0 (3 phút) chạy xuyên đêm, các Rule khác Pause ban đêm
        if (!isRule0) {
            const utcHours = current.getUTCHours();
            const vnHours = (utcHours + 7) % 24; // UTC+7
            const vnMin = current.getUTCMinutes();
            const timeInMin = vnHours * 60 + vnMin;
            
            // Khung 00:00 đến 06:30 (390 phút) -> Pause SLA không giảm remaining
            if (timeInMin >= 0 && timeInMin < 390) {
                continue;
            }
        }
        remaining--;
    }
    return current;
}

/**
 * Tính số phút "hiệu lực" còn lại bằng cách nháp ngược logic Shift, 
 * loại trừ khung giờ nghỉ đêm.
 */
export function getVirtualTimeLeft(now: Date, deadline: Date, isRule0: boolean): number {
    if (now.getTime() >= deadline.getTime()) return 0;
    
    let current = new Date(now.getTime());
    let virtualMinutes = 0;
    let iters = 0;
    
    while(current.getTime() < deadline.getTime() && iters < 20000) {
        current = new Date(current.getTime() + 60000);
        iters++;
        
        let isPaused = false;
        if (!isRule0) {
            const utcHours = current.getUTCHours();
            const vnHours = (utcHours + 7) % 24;
            const vnMin = current.getUTCMinutes();
            const t = vnHours * 60 + vnMin;
            if (t >= 0 && t < 390) {
                isPaused = true;
            }
        }
        if (!isPaused) {
            virtualMinutes++;
        }
    }
    return virtualMinutes;
}

/**
 * Kiểm tra xem cú Follow-up của Sale có hợp lệ không (có nằm trong khung 10p, 30p cuối không)
 */
export function is_valid_followup(ruleIndex: number, timeLeftMinutes: number): boolean {
    const rule = SLA_CYCLES[ruleIndex] || 3;
    if (ruleIndex === 0 || rule === 3) return true;
    if (ruleIndex === 1 || rule === 60) return timeLeftMinutes <= 10;
    return timeLeftMinutes <= 30; // Các mốc >= 180 phút
}

/**
 * Xử lý khi Khách Nhắn (Rule 1)
 */
export async function on_customer_message(lead: any) {
    const now = new Date();
    const nextRule = SLA_CYCLES[0];
    const deadline = calculateDeadline(now, nextRule, true); // Rule 3 phút chạy xuyên đêm
    
    await supabaseAdmin.from('leads').update({
        last_actor: 'lead',
        t_last_inbound: now.toISOString(),
        last_message_time: now.toISOString(),
        current_rule_index: 0,
        current_deadline_at: deadline.toISOString(),
        sla_state: 'ACTIVE',
        appointment_time: null, // Xoá sạch lịch hẹn vì có tương tác mới
        updated_at: now.toISOString()
    }).eq('id', lead.id);
}

/**
 * Di chuyển SLA sang mốc tiếp theo
 */
export async function move_to_next_rule(lead: any, saleId: string | null = null, fromCron: boolean = false) {
    const now = new Date();
    const nextIndex = (lead.current_rule_index || 0) + 1;
    
    if (nextIndex >= SLA_CYCLES.length) {
        await supabaseAdmin.from('leads').update({
            sla_state: 'FINISHED',
            updated_at: now.toISOString()
        }).eq('id', lead.id);
        return;
    }
    
    const nextRule = SLA_CYCLES[nextIndex];
    const deadline = calculateDeadline(now, nextRule, nextIndex === 0);
    
    const updates: any = {
        current_rule_index: nextIndex,
        current_deadline_at: deadline.toISOString(),
        updated_at: now.toISOString()
    };
    
    if (!fromCron) {
        updates.last_valid_followup_at = now.toISOString();
    }
    
    if (saleId) {
        updates.last_actor = 'sale';
        updates.t_last_outbound = now.toISOString();
        updates.last_message_time = now.toISOString();
    }
    
    await supabaseAdmin.from('leads').update(updates).eq('id', lead.id);
}

/**
 * Xử lý khi Sale Nhắn (Rule 2 + Rule 4)
 */
export async function on_sale_message(lead: any, saleId: string, saleName: string) {
    // Check Giành khách (Rule 4)
    if (lead.assigned_to && saleId !== lead.assigned_to) {
        await trigger_intrusion(lead, saleId, saleName);
        return;
    }
    
    if (['PAUSED_APPOINTMENT', 'FINISHED', 'RECLAIMED', 'STOPPED'].includes(lead.sla_state || '')) {
        // Chỉ lưu vết tin nhắn, không tác động Rule khi bị Pause/Stop
        await supabaseAdmin.from('leads').update({
            last_actor: 'sale',
            t_last_outbound: new Date().toISOString(),
            last_message_time: new Date().toISOString()
        }).eq('id', lead.id);
        return; 
    }
    
    const now = new Date();
    const currDeadline = new Date(lead.current_deadline_at || now);
    
    // Bug Fix: Phải dùng Virtual Time vì deadline có thể đã bị dịch sang sáng hôm sau
    const isRule0 = (lead.current_rule_index || 0) === 0;
    const timeLeftMins = getVirtualTimeLeft(now, currDeadline, isRule0);
    
    if (is_valid_followup(lead.current_rule_index || 0, timeLeftMins)) {
        await move_to_next_rule(lead, saleId);
    } else {
        // Sai khung -> Không hợp lệ -> Trôi tiếp chờ cron
        await supabaseAdmin.from('leads').update({
            last_actor: 'sale',
            t_last_outbound: now.toISOString(),
            last_message_time: now.toISOString(),
            updated_at: now.toISOString()
        }).eq('id', lead.id);
    }
}

export async function on_lead_assigned(leadId: string, saleId: string) {
    const now = new Date();
    const deadline = calculateDeadline(now, SLA_CYCLES[0], true);
    await supabaseAdmin.from('leads').update({
        current_rule_index: 0,
        current_deadline_at: deadline.toISOString(),
        sla_state: 'ACTIVE',
        updated_at: now.toISOString()
    }).eq('id', leadId);
}

export async function trigger_intrusion(lead: any, intruder_id: string, intruder_name: string) {
    fireWebhook('INTRUSION_DETECTED', {
        lead_id: lead.id,
        lead_name: lead.name,
        owner_id: lead.assigned_to,
        owner_name: lead.owner_sale || 'System',
        tele_id_sale: lead.assigned_to_user?.telegram_chat_id || null,
        intruder_id: intruder_id,
        intruder_name: intruder_name,
        tele_id_vi_pham: null,
        link_lead: `${FRONTEND_URL}/leads/${lead.id}`
    });
}

/**
 * Cronjob thay thế hoàn toàn cho checkAllSLAũ
 */
export async function checkSlaCron() {
    try {
        const now = new Date();
        
        // Fetch leads đang vận hành SLA (không ở trạng thái chốt/hủy)
        const { data: leads, error } = await supabaseAdmin
            .from('leads')
            .select(`
                id, name, assigned_to, appointment_time, sla_state, current_deadline_at, current_rule_index, appointment_reminded_at, pipeline_stage, assigned_to_user: users!leads_assigned_to_fkey(name, telegram_chat_id)
            `)
            .eq('assign_state', 'assigned')
            .not('assigned_to', 'is', null)
            .not('pipeline_stage', 'in', '("chot_don", "huy", "fail")');

        if (error || !leads) return;

        for (const lead of leads) {
            const saleUser = Array.isArray(lead.assigned_to_user) ? lead.assigned_to_user[0] : lead.assigned_to_user;
            const saleName = saleUser?.name || 'Ẩn danh';
            const teleIdSale = saleUser?.telegram_chat_id || null;

            // Xử lý Lịch Hẹn (Rule 5)
            if (lead.sla_state === 'PAUSED_APPOINTMENT' && lead.appointment_time) {
                const appointTime = new Date(lead.appointment_time);
                const msUntilAppoint = appointTime.getTime() - now.getTime();
                const minUntilAppoint = msUntilAppoint / 60000;

                // 1. Remind 10 min before
                if (minUntilAppoint > 0 && minUntilAppoint <= 10 && !lead.appointment_reminded_at) {
                    fireWebhook('APPOINTMENT_REMIND', {
                        lead_id: lead.id,
                        lead_name: lead.name,
                        sale_id: lead.assigned_to,
                        tele_id_sale: teleIdSale,
                        link_lead: `${FRONTEND_URL}/leads/${lead.id}`,
                        appointment_time: lead.appointment_time,
                        minutes_left: Math.round(minUntilAppoint)
                    });
                    await supabaseAdmin.from('leads').update({
                        appointment_reminded_at: now.toISOString()
                    }).eq('id', lead.id);
                }

                // 2. Đúng giờ hẹn: Reset về mốc 3 phút (ACTIVE)
                if (minUntilAppoint <= 0 && minUntilAppoint > -2) {
                    const deadline = calculateDeadline(now, SLA_CYCLES[0], true);
                    await supabaseAdmin.from('leads').update({
                        current_rule_index: 0,
                        current_deadline_at: deadline.toISOString(),
                        last_message_time: now.toISOString(),
                        t_last_inbound: now.toISOString(),
                        last_actor: 'lead',
                        sla_state: 'ACTIVE',
                        updated_at: now.toISOString(),
                        appointment_time: null, // Xoá hẹn sau khi kích nổ để tránh lặp
                        appointment_reminded_at: null
                    }).eq('id', lead.id);
                }
                continue;
            }

            // Theo dõi trạng thái ACTIVE
            if (lead.sla_state === 'ACTIVE' && lead.current_deadline_at) {
                const deadline = new Date(lead.current_deadline_at);
                const timeLeft = (deadline.getTime() - now.getTime()) / 60000;
                
                const ruleIndex = lead.current_rule_index || 0;
                const currentMilestone = SLA_CYCLES[ruleIndex] || 3;

                // Cảnh báo sớm
                const warnKey = `WARN_${lead.id}_R${ruleIndex}`;
                let warnThreshold = currentMilestone * 0.15;
                if (currentMilestone === 3) warnThreshold = 1.5; // 90s cho mốc 3p

                if (timeLeft <= warnThreshold && timeLeft > 0 && !firedAlerts.has(warnKey)) {
                    fireWebhook('SLA_WARNING', {
                        lead_id: lead.id,
                        lead_name: lead.name,
                        sale_id: lead.assigned_to,
                        sale_name: saleName,
                        tele_id_sale: teleIdSale,
                        link_lead: `${FRONTEND_URL}/leads/${lead.id}`,
                        rule: `Cycle ${currentMilestone}M`,
                        time_left_min: Math.round(timeLeft)
                    });
                    firedAlerts.add(warnKey);
                }

                // Thủng SLA
                if (timeLeft <= 0) {
                    if (ruleIndex === 0) {
                        // RECLAIM
                        fireWebhook('SLA_RECLAIM', {
                            lead_id: lead.id,
                            lead_name: lead.name,
                            sale_id: lead.assigned_to,
                            old_sale_name: saleName,
                            old_tele_id_sale: teleIdSale,
                            link_lead: `${FRONTEND_URL}/leads/${lead.id}`
                        });
                        await supabaseAdmin.from('leads').update({
                            assigned_to: null,
                            assign_state: 'unassigned',
                            sla_state: 'RECLAIMED',
                            updated_at: now.toISOString()
                        }).eq('id', lead.id);
                        
                        const { error: logErr } = await supabaseAdmin.from('lead_activities').insert({
                            lead_id: lead.id,
                            activity_type: 'owner_unassigned',
                            content: 'Lead đã bị Thu Hồi do Sale bỏ lỡ mốc SLA 3 phút (State Machine)',
                            user_name: 'Hệ thống'
                        });
                        if (logErr) console.error('[SLAManager] log error', logErr);
                    } else {
                        // Phạt cảnh cáo và cưỡng ép chuyển mốc
                        fireWebhook('SLA_WARNING', {
                            lead_id: lead.id,
                            lead_name: lead.name,
                            sale_name: saleName,
                            tele_id_sale: teleIdSale,
                            link_lead: `${FRONTEND_URL}/leads/${lead.id}`,
                            rule: `Quá hạn Cycle ${currentMilestone}M`,
                            time_left_min: 0
                        });
                        await move_to_next_rule(lead, null, true);
                    }
                }
            }
        }
    } catch (err) {
        console.error('[SLAManager] Cron check failed', err);
    }
}

// Memory cleanup for alerts cache once a day
setInterval(() => {
    firedAlerts.clear();
}, 24 * 60 * 60 * 1000);

// Export them with original name too for backward compatibility in index.ts if needed
export { checkSlaCron as checkAllSLA };
