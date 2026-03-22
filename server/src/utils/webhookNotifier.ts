/**
 * Webhook Notifier Utility
 * Fire-and-forget: Gửi event sang n8n khi có sự kiện trong CRM.
 * Không block response của API chính.
 */

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || '';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';

/**
 * Gửi webhook event sang n8n.
 * Fire-and-forget — không throw error, chỉ log.
 */
export async function fireWebhook(event: string, data: Record<string, any>): Promise<void> {
    if (!N8N_WEBHOOK_URL) {
        console.log(`[WebhookNotifier] N8N_WEBHOOK_URL chưa cấu hình, bỏ qua event: ${event}`);
        return;
    }

    const payload = {
        event,
        timestamp: new Date().toISOString(),
        data,
    };

    try {
        const response = await fetch(N8N_WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-webhook-secret': WEBHOOK_SECRET,
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            console.error(`[WebhookNotifier] n8n responded ${response.status} for event: ${event}`);
        } else {
            console.log(`[WebhookNotifier] ✅ Fired event: ${event}`);
        }
    } catch (err) {
        console.error(`[WebhookNotifier] ❌ Failed to fire event: ${event}`, err);
    }
}
