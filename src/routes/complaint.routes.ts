import express from 'express';
import { ComplaintController } from '../controllers/complaint.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleMiddleware } from '../middlewares/role.middleware';

const router = express.Router();

// Tất cả các route yêu cầu đăng nhập
router.use(authMiddleware);

// 1. Giáo viên gửi góp ý
router.post('/', roleMiddleware(['TEACHER']), ComplaintController.sendComplaint);

// 2. Lấy danh sách góp ý (GV xem của mình, AD/CV xem tất cả)
router.get('/', roleMiddleware(['ADMIN', 'SPECIALIST', 'TEACHER']), ComplaintController.getComplaints);

// 3. Admin/CV xử lý góp ý
router.patch('/:id/resolve', roleMiddleware(['ADMIN', 'SPECIALIST']), ComplaintController.resolveComplaint);

export default router;
