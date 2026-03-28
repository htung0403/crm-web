import React, { useState, useEffect, useMemo } from 'react';
import { Clock, Zap, AlertCircle } from 'lucide-react';
import { SLA_CYCLES } from './constants';
import { cn } from '@/lib/utils';

interface SLACountdownProps {
    lead: {
        id: string;
        created_at: string;
        t_last_inbound?: string;
        t_last_outbound?: string;
        appointment_time?: string;
        pipeline_stage?: string;
        assigned_to?: string | null;
    };
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

/**
 * SLACountdown Component
 * Implements Rule 1, 2, 3 and 6 of the CRM Operating Rules.
 */
export function SLACountdown({ lead, size = 'md', className }: SLACountdownProps) {
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const slaData = useMemo(() => {
        // Only show for assigned leads that are not finished or cancelled
        if (!lead.assigned_to || lead.pipeline_stage === 'chot_don' || lead.pipeline_stage === 'fail') {
            return null;
        }

        const createdAt = new Date(lead.created_at);
        const lastIn = lead.t_last_inbound ? new Date(lead.t_last_inbound) : null;
        const lastOut = lead.t_last_outbound ? new Date(lead.t_last_outbound) : null;
        const appointTime = lead.appointment_time ? new Date(lead.appointment_time) : null;
        
        // Rule 3: Define "Old Customer" as Lead created > 24 hours ago
        const isOldCustomer = (now.getTime() - createdAt.getTime()) > (24 * 60 * 60 * 1000);

        // Logic for Rule 3: Off-Hours Pause (00:00 - 06:30)
        const getEffectivePassedMinutes = (startTime: Date) => {
            if (!isOldCustomer) return (now.getTime() - startTime.getTime()) / 60000;
            
            let passedMs = now.getTime() - startTime.getTime();
            if (passedMs < 0) return 0;

            let totalPauseMs = 0;
            let currentDay = new Date(startTime);
            currentDay.setHours(0, 0, 0, 0);
            
            const endDay = new Date(now);
            endDay.setHours(0, 0, 0, 0);

            while (currentDay.getTime() <= endDay.getTime()) {
                const pauseStart = new Date(currentDay);
                pauseStart.setHours(0, 0, 0, 0);
                const pauseEnd = new Date(currentDay);
                pauseEnd.setHours(6, 30, 0, 0);

                const intersectStart = Math.max(pauseStart.getTime(), startTime.getTime());
                const intersectEnd = Math.min(pauseEnd.getTime(), now.getTime());

                if (intersectStart < intersectEnd) {
                    totalPauseMs += (intersectEnd - intersectStart);
                }
                currentDay.setDate(currentDay.getDate() + 1);
            }
            return (passedMs - totalPauseMs) / 60000;
        };

        // Rule 5: Appointment logic (already handled by t_last_inbound in backend, 
        // but we can show time until appointment if needed)
        
        // Determine last interaction actor
        const effectiveStart = (lastIn && (!lastOut || lastIn > lastOut)) ? lastIn : (lastOut || createdAt);
        const actor = (lastIn && (!lastOut || lastIn > lastOut)) ? 'lead' : 'sale';
        
        const passedMin = getEffectivePassedMinutes(effectiveStart);
        
        let targetMin = 0;
        let label = '';
        let isSpeedRule = false;

        if (actor === 'lead') {
            // Rule 1: Reset SLA to 3 mins when customer speaks
            targetMin = 3;
            label = 'Sale cần rep';
            isSpeedRule = true;
        } else {
            // Rule 2: Wait for customer in cycles
            const nextMilestone = SLA_CYCLES.find(m => m > passedMin) || SLA_CYCLES[SLA_CYCLES.length - 1];
            targetMin = nextMilestone;
            label = 'Đợi khách';
            if (nextMilestone === 3) isSpeedRule = true;
        }

        const remainingSec = Math.max(-999999, (targetMin - passedMin) * 60);
        const totalSec = targetMin * 60;
        const ratio = remainingSec / totalSec;

        let colorClass = 'bg-emerald-500 text-white';
        let isBlinking = false;

        // Rule 6: Color logic
        if (remainingSec <= 0) {
            colorClass = 'bg-red-600 text-white';
            isBlinking = true;
        } else if (ratio <= 0.5) {
            // Yellow phase (< 50%)
            colorClass = 'bg-amber-500 text-white';
            
            // Blinking phase (last 90s for 3m, or last 45m for others)
            const blinkThreshold = isSpeedRule ? 90 : 2700;
            if (remainingSec <= blinkThreshold) {
                colorClass = 'bg-red-500 text-white';
                isBlinking = true;
            }
        }

        const formatTime = (seconds: number) => {
            const absSec = Math.abs(seconds);
            const h = Math.floor(absSec / 3600);
            const m = Math.floor((absSec % 3600) / 60);
            const s = Math.floor(absSec % 60);
            
            const prefix = seconds < 0 ? '-' : '';
            if (h > 0) return `${prefix}${h}h${m}p`;
            return `${prefix}${m}:${s.toString().padStart(2, '0')}`;
        };

        return {
            remainingTime: formatTime(remainingSec),
            label,
            colorClass,
            isBlinking,
            isOverdue: remainingSec <= 0,
            isSpeedRule
        };
    }, [lead, now]);

    if (!slaData) return null;

    const sizeClasses = {
        sm: 'px-1.5 py-0.5 text-[9px] gap-1',
        md: 'px-2 py-1 text-xs gap-1.5',
        lg: 'px-3 py-1.5 text-[13px] gap-2'
    };

    return (
        <div className={cn(
            "inline-flex items-center font-bold rounded-lg shadow-sm transition-all duration-300",
            slaData.colorClass,
            slaData.isBlinking && "animate-pulse ring-2 ring-red-300 ring-offset-1",
            sizeClasses[size],
            className
        )}>
            {slaData.isSpeedRule ? (
                <Zap className={cn("shrink-0", size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
            ) : (
                <Clock className={cn("shrink-0", size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
            )}
            
            <span className="tabular-nums">
                {slaData.remainingTime}
            </span>
            
            <span className="opacity-90 font-medium border-l border-white/30 pl-1.5 ml-0.5 uppercase tracking-tighter">
                {slaData.label}
            </span>
        </div>
    );
}
