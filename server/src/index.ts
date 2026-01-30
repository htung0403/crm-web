import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

import { config } from './config/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authRouter } from './routes/auth.js';
import { usersRouter } from './routes/users.js';
import { leadsRouter } from './routes/leads.js';
import { customersRouter } from './routes/customers.js';
import { ordersRouter } from './routes/orders.js';
import { invoicesRouter } from './routes/invoices.js';
import { productsRouter } from './routes/products.js';
import { servicesRouter } from './routes/services.js';
import packagesRouter from './routes/packages.js';
import vouchersRouter from './routes/vouchers.js';
import { financeRouter } from './routes/finance.js';
import { kpiRouter } from './routes/kpi.js';
import { salaryRouter } from './routes/salary.js';
import { reportsRouter } from './routes/reports.js';
import { interactionsRouter } from './routes/interactions.js';
import technicianTasksRouter from './routes/technician-tasks.js';
import departmentsRouter from './routes/departments.js';
import { commissionsRouter } from './routes/commissions.js';
import orderItemsRouter from './routes/order-items.js';
import notificationsRouter from './routes/notifications.js';
import workflowsRouter from './routes/workflows.js';
import orderProductsRouter from './routes/order-products.js';

dotenv.config();

const app = express();

// Middleware
app.use(helmet());
app.use(cors({
    origin: config.cors.origin,
    credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: config.nodeEnv,
    });
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/leads', leadsRouter);
app.use('/api/customers', customersRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/invoices', invoicesRouter);
app.use('/api/products', productsRouter);
app.use('/api/services', servicesRouter);
app.use('/api/packages', packagesRouter);
app.use('/api/vouchers', vouchersRouter);
app.use('/api/finance', financeRouter);
app.use('/api/kpi', kpiRouter);
app.use('/api/salary', salaryRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/interactions', interactionsRouter);
app.use('/api/technician-tasks', technicianTasksRouter);
app.use('/api/departments', departmentsRouter);
app.use('/api/commissions', commissionsRouter);
app.use('/api/order-items', orderItemsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/workflows', workflowsRouter);
app.use('/api/order-products', orderProductsRouter);

// Error handling
app.use(errorHandler);

// Start server
app.listen(config.port, () => {
    console.log(`🚀 Server running on http://localhost:${config.port}`);
    console.log(`📊 Environment: ${config.nodeEnv}`);
});

export default app;
