import { Router } from 'express';
import authRoutes from './auth/auth.routes';
import userRoutes from './user.routes';
import testRoutes from './test.routes';
import partRoutes from './part.routes';
import questionRoutes from './question.routes';
import uploadRoutes from './upload.routes';
import aiRoutes from './ai.routes';
import dashboardRoutes from './dashboard.routes';
import studentDashboardRoutes from './student-dashboard.routes';
import practiceRoutes from './practice.routes';
import flashcardRoutes from './flashcard.routes';
import adminRoutes from './admin.routes';
import classRoutes from './class.routes';
import recommendationRoutes from './recommendation.routes';
import teacherRoutes from './teacher.routes';
import notificationRoutes from './notification.routes';
import complaintRoutes from './complaint.routes';
import feedbackRoutes from './feedback.routes';

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
router.use('/dashboard', studentDashboardRoutes);
router.use('/practice', practiceRoutes);
router.use('/', flashcardRoutes);
router.use('/admin', adminRoutes);
router.use('/classes', classRoutes);
router.use('/recommendations', recommendationRoutes);
router.use('/teacher', teacherRoutes);
router.use('/notifications', notificationRoutes);
router.use('/complaints', complaintRoutes);
router.use('/feedbacks', feedbackRoutes);

// Health check endpoint
router.get('/health', (_req, res) => {
    res.json({
        success: true,
        message: 'TOEIC-TEST API is running',
        timestamp: new Date().toISOString(),
    });
});

export default router;
