import { supabaseAdmin } from '../config/supabase.js';
import { fireWebhook } from './webhookNotifier.js';

// Rule 2 configuration
const SLA_CYCLES = [3, 60, 180, 300, 420, 1440, 2880, 3120, 4020, 5160, 6600];
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Storage for tracking which alerts have been sent to avoid spamming
const firedAlerts = new Set<string>();

/**
 * Calculates effective passed minutes, considering Off-Hours pause
 * Off hours: 00:00 (24:00) to 06:30
 */
function getEffectivePassedMinutes(startTime: Date, isOldCustomer: boolean): number {
    const now = new Date();
    
    // If it's a new customer, don't pause. Just return actual differences
    if (!isOldCustomer) {
        return (now.getTime() - startTime.getTime()) / 60000;
    }

    // For old customers, we need to subtract the time spent in 00:00-06:30 blocks
    let passedMs = now.getTime() - startTime.getTime();
    if (passedMs < 0) return 0;

    // Advanced but fast approximation: 
    // We walk day by day from startTime to now, finding intersection with 00:00-06:30 for each day
    let totalPauseMs = 0;
    
    // Clone to iterate
    let currentDay = new Date(startTime);
    currentDay.setHours(0, 0, 0, 0); // start of first day
    
    const endDay = new Date(now);
    endDay.setHours(0, 0, 0, 0);

    while (currentDay.getTime() <= endDay.getTime()) {
        const pauseStart = new Date(currentDay);
        pauseStart.setHours(0, 0, 0, 0);
        
        const pauseEnd = new Date(currentDay);
        pauseEnd.setHours(6, 30, 0, 0);

        // Find intersection of [pauseStart, pauseEnd] and [startTime, now]
        const intersectStart = Math.max(pauseStart.getTime(), startTime.getTime());
        const intersectEnd = Math.min(pauseEnd.getTime(), now.getTime());

        if (intersectStart < intersectEnd) {
            totalPauseMs += (intersectEnd - intersectStart);
        }

        // Move to next day
        currentDay.setDate(currentDay.getDate() + 1);
    }

    return (passedMs - totalPauseMs) / 60000;
}

/**
 * Main checking loop for SLA rules
 */
export async function checkAllSLA() {
    try {
        const now = new Date();
        
        // Fetch all assigned leads that are not finished
        // We probably shouldn't track leads in 'chot_don' or 'huy'
        const { data: leads, error } = await supabaseAdmin
            .from('leads')
            .select(`
                id, 
                name, 
                phone, 
                created_at, 
                t_last_inbound, 
                t_last_outbound, 
                last_actor, 
                assigned_to, 
                pipeline_stage, 
                appointment_time, 
                assign_state,
                assigned_to_user: users!leads_assigned_to_fkey(name, email, telegram_chat_id)
            `)
            .eq('assign_state', 'assigned')
            .not('assigned_to', 'is', null)
            .not('pipeline_stage', 'in', '("chot_don", "huy")');

        if (error || !leads) {
            console.error('[SLAManager] Error fetching leads', error);
            return;
        }

        const updates: Promise<any>[] = [];

        for (const lead of leads) {
            const createdAt = new Date(lead.created_at);
            const isOldCustomer = (now.getTime() - createdAt.getTime()) > (24 * 60 * 60 * 1000);

            // Rule 5: Appointments
            if (lead.appointment_time) {
                const appointTime = new Date(lead.appointment_time);
                const msUntilAppoint = appointTime.getTime() - now.getTime();
                const minUntilAppoint = msUntilAppoint / 60000;

                // Fire warning at 10 minutes before
                const remKey = `APPOINT_${lead.id}_${appointTime.getTime()}`;
                if (minUntilAppoint > 0 && minUntilAppoint <= 10 && !firedAlerts.has(remKey)) {
                    fireWebhook('APPOINTMENT_REMIND', {
                        lead_id: lead.id,
                        lead_name: lead.name,
                        sale_id: lead.assigned_to,
                        tele_id_sale: Array.isArray(lead.assigned_to_user) ? lead.assigned_to_user[0]?.telegram_chat_id : (lead.assigned_to_user as any)?.telegram_chat_id,
                        link_lead: `${FRONTEND_URL}/leads/${lead.id}`,
                        appointment_time: lead.appointment_time,
                        minutes_left: Math.round(minUntilAppoint)
                    });
                    firedAlerts.add(remKey);
                }

                // If appointment time is reached (within the last 2 minutes to prevent endless looping)
                if (minUntilAppoint <= 0 && minUntilAppoint > -2) {
                    const resetKey = `APPOINT_RES_${lead.id}_${appointTime.getTime()}`;
                    if (!firedAlerts.has(resetKey)) {
                        console.log(`[SLAManager] Appointment reached for ${lead.id}, resetting SLA to 3 mins`);
                        await supabaseAdmin.from('leads').update({
                            t_last_inbound: now.toISOString(),
                            last_message_time: now.toISOString(),
                            last_actor: 'lead',
                            updated_at: now.toISOString()
                        }).eq('id', lead.id);
                        firedAlerts.add(resetKey);
                        // Skip other checks since we just updated it
                        continue; 
                    }
                }
            }

            // Figure out who spoke last and when
            const lastIn = lead.t_last_inbound ? new Date(lead.t_last_inbound) : null;
            const lastOut = lead.t_last_outbound ? new Date(lead.t_last_outbound) : null;
            
            // If nobody spoke? Default to creation time as inbound
            const effectiveStart = (lastIn && (!lastOut || lastIn > lastOut)) ? lastIn : lastOut;
            const actor = (lastIn && (!lastOut || lastIn > lastOut)) ? 'lead' : 'sale';

            if (!effectiveStart) continue;

            const passedMin = getEffectivePassedMinutes(effectiveStart, isOldCustomer);

            if (actor === 'lead') {
                // RULE 1: Customer replied, we wait for sale.
                // Reset SLA is 3 minutes.
                const SLA_MIN = 3;
                const timeLeft = SLA_MIN - passedMin;
                
                const warnKey = `WARN_3M_${lead.id}_${effectiveStart.getTime()}`;
                const reclaimKey = `RECLAIM_${lead.id}_${effectiveStart.getTime()}`;

                if (timeLeft <= 1.5 && timeLeft > 0 && !firedAlerts.has(warnKey)) {
                    // Warning at 90s
                    fireWebhook('SLA_WARNING', {
                        lead_id: lead.id,
                        lead_name: lead.name,
                        sale_id: lead.assigned_to,
                        sale_name: Array.isArray(lead.assigned_to_user) ? lead.assigned_to_user[0]?.name : (lead.assigned_to_user as any)?.name,
                        tele_id_sale: Array.isArray(lead.assigned_to_user) ? lead.assigned_to_user[0]?.telegram_chat_id : (lead.assigned_to_user as any)?.telegram_chat_id,
                        link_lead: `${FRONTEND_URL}/leads/${lead.id}`,
                        rule: 'Speed 3M',
                        time_left_sec: Math.round(timeLeft * 60)
                    });
                    firedAlerts.add(warnKey);
                }

                if (timeLeft <= 0 && !firedAlerts.has(reclaimKey)) {
                    // Reclaim!
                    console.log(`[SLAManager] Reclaiming lead ${lead.id} due to SLA breach`);
                    
                    // Fire webhook
                    fireWebhook('SLA_RECLAIM', {
                        lead_id: lead.id,
                        lead_name: lead.name,
                        sale_id: lead.assigned_to,
                        sale_name: Array.isArray(lead.assigned_to_user) ? lead.assigned_to_user[0]?.name : (lead.assigned_to_user as any)?.name,
                        tele_id_sale: Array.isArray(lead.assigned_to_user) ? lead.assigned_to_user[0]?.telegram_chat_id : (lead.assigned_to_user as any)?.telegram_chat_id,
                        link_lead: `${FRONTEND_URL}/leads/${lead.id}`,
                        wait_minutes: Math.round(passedMin)
                    });

                    // Database Update
                    await supabaseAdmin.from('leads').update({
                        assigned_to: null,
                        assign_state: 'unassigned',
                        updated_at: now.toISOString()
                    }).eq('id', lead.id);

                    // Add log note
                    try {
                        await supabaseAdmin.from('lead_activities').insert({
                            lead_id: lead.id,
                            activity_type: 'owner_unassigned',
                            content: 'Lead đã bị thu hồi do quá hạn trả lời 3 phút (SLA Engine)',
                            user_name: 'Hệ thống'
                        });
                    } catch (e) {}

                    firedAlerts.add(reclaimKey);
                }

            } else {
                // RULE 2: Sale replied, waiting for customer within SLA Cycles
                // 3, 60, 180, 300, 420, 1440, 2880...
                
                // Find next milestone
                let nextMilestone = SLA_CYCLES.find(m => m > passedMin);
                
                if (nextMilestone) {
                    const timeLeft = nextMilestone - passedMin;
                    const warnKey = `WARN_CYC_${lead.id}_${nextMilestone}_${effectiveStart.getTime()}`;
                    
                    // Warning threshold
                    let warnThreshold = 45; // default 45 minutes
                    if (nextMilestone === 3) {
                        warnThreshold = 1.5; // 90 seconds for 3m milestone
                    }

                    if (timeLeft <= warnThreshold && timeLeft > 0 && !firedAlerts.has(warnKey)) {
                        fireWebhook('SLA_WARNING', {
                            lead_id: lead.id,
                            lead_name: lead.name,
                            sale_id: lead.assigned_to,
                            sale_name: Array.isArray(lead.assigned_to_user) ? lead.assigned_to_user[0]?.name : (lead.assigned_to_user as any)?.name,
                            tele_id_sale: Array.isArray(lead.assigned_to_user) ? lead.assigned_to_user[0]?.telegram_chat_id : (lead.assigned_to_user as any)?.telegram_chat_id,
                            link_lead: `${FRONTEND_URL}/leads/${lead.id}`,
                            rule: `Cycle ${nextMilestone}M`,
                            minutes_passed: Math.round(passedMin),
                            time_left_min: Math.round(timeLeft)
                        });
                        firedAlerts.add(warnKey);
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
