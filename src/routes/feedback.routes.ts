import { Router } from 'express';
import { FeedbackController } from '../controllers/feedback.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleMiddleware } from '../middlewares/role.middleware';

const router = Router();

// Tất cả các route đều yêu cầu đăng nhập
router.use(authMiddleware);

// 1. Học viên gửi ý kiến (Chỉ STUDENT)
router.post('/', roleMiddleware(['STUDENT'] as any[]), FeedbackController.sendFeedback);

// 2. Lấy danh sách ý kiến (GV xem của lớp, HV xem của mình, Admin xem hết)
router.get('/', roleMiddleware(['ADMIN', 'TEACHER', 'STUDENT'] as any[]), FeedbackController.getFeedbacks);

// 3. GV xử lý xong ý kiến (Chỉ TEACHER hoặc ADMIN)
router.patch('/:id/resolve', roleMiddleware(['ADMIN', 'TEACHER'] as any[]), FeedbackController.resolveFeedback);

export default router;
