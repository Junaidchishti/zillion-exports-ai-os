import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { seedDatabase } from './db/seed.js';
import { processExpiredLocks } from './services/lock-service.js';

import authRoutes from './routes/auth-routes.js';
import agentRoutes from './routes/agent-routes.js';
import cuttingRoutes from './routes/cutting-routes.js';
import productionRoutes from './routes/production-routes.js';
import approvalRoutes from './routes/approval-routes.js';
import qrRoutes from './routes/qr-routes.js';
import financeRoutes from './routes/finance-routes.js';
import auditRoutes from './routes/audit-routes.js';
import notificationRoutes from './routes/notification-routes.js';
import orderRoutes from './routes/order-routes.js';
import storeRoutes from './routes/store-routes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  }
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'HEALTHY',
    system: 'Zillion Exports AI Factory Operating System',
    timestamp: new Date().toISOString(),
    version: '1.0.0-production',
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/store', storeRoutes);
app.use('/api/cutting', cuttingRoutes);
app.use('/api/production', productionRoutes);
app.use('/api/approvals', approvalRoutes);
app.use('/api/qr', qrRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/notifications', notificationRoutes);

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled Express Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message || 'An unexpected error occurred in the factory operating system.',
  });
});

// Start Server and Database
async function bootstrap() {
  try {
    console.log('Initializing Zillion Exports Central Database & Seed Data...');
    await seedDatabase();

    // Start background lock manager (checks every 60 seconds)
    setInterval(async () => {
      try {
        const lockedCount = await processExpiredLocks();
        if (lockedCount > 0) {
          console.log(`[LockManager] Automatically locked ${lockedCount} expired records past 1-hour grace window.`);
        }
      } catch (e) {
        console.error('LockManager tick error:', e);
      }
    }, 60000);

    app.listen(PORT, () => {
      console.log(`=============================================================`);
      console.log(`  ZILLION EXPORTS — AI FACTORY OPERATING SYSTEM (BACKEND)   `);
      console.log(`  Running on: http://localhost:${PORT}                       `);
      console.log(`  Single Source of Truth: Normalized SQLite in WAL / WASM    `);
      console.log(`  All 10 Departmental Agents: ONLINE                         `);
      console.log(`  CEO / GM Command & Intelligence Layer: ONLINE              `);
      console.log(`=============================================================`);
    });
  } catch (error) {
    console.error('Failed to bootstrap Zillion Exports server:', error);
    process.exit(1);
  }
}

bootstrap();
