import { Router, Request, Response, NextFunction } from 'express';
import { checkAllSLA } from '../utils/slaManager.js';
import { ApiError } from '../middleware/errorHandler.js';

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

export { router as cronRouter };
