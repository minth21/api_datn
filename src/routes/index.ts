import { Router } from 'express';
import authRoutes from './auth/auth.routes';
import userRoutes from './user.routes';
import testRoutes from './test.routes';
import partRoutes from './part.routes';
import questionRoutes from './question.routes';
import uploadRoutes from './upload.routes';
import aiRoutes from './ai.routes';
import dashboardRoutes from './dashboard.routes';
import practiceRoutes from './practice.routes';

const router = Router();

// Mount routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/tests', testRoutes);
router.use('/', partRoutes);
router.use('/', questionRoutes);
router.use('/upload', uploadRoutes);
router.use('/ai', aiRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/practice', practiceRoutes);

// Health check endpoint
router.get('/health', (_req, res) => {
    res.json({
        success: true,
        message: 'TOEIC-TEST API is running',
        timestamp: new Date().toISOString(),
    });
});

export default router;
