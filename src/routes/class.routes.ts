import express from 'express';
import { classController } from '../controllers/class.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleMiddleware } from '../middlewares/role.middleware';
import { Role } from '@prisma/client';

const router = express.Router();

/**
 * Class Routes - Dành cho Giáo viên và Admin
 */

// --- ADMIN & SPECIALIST ROUTES ---
// Lấy tất cả lớp học (Admin)
router.get('/', authMiddleware, roleMiddleware([Role.ADMIN, Role.SPECIALIST]), classController.getAllClasses);

// Tạo lớp học mới
router.post('/', authMiddleware, roleMiddleware([Role.ADMIN, Role.SPECIALIST]), classController.createClass);

// Cập nhật lớp học
router.put('/:classId', authMiddleware, roleMiddleware([Role.ADMIN, Role.SPECIALIST]), classController.updateClass);

// Xóa lớp học
router.delete('/:classId', authMiddleware, roleMiddleware([Role.ADMIN, Role.SPECIALIST]), classController.deleteClass);

// Thay đổi trạng thái lớp học (Khóa/Mở khóa)
router.patch('/:classId/status', authMiddleware, roleMiddleware([Role.ADMIN, Role.SPECIALIST]), classController.toggleClassStatus);



// --- TEACHER & SHARED ROUTES ---
// Lấy danh sách lớp học của tôi (TEACHER)
router.get('/my-classes', authMiddleware, roleMiddleware([('TEACHER' as unknown as Role), Role.ADMIN]), classController.getMyClasses);

// Lấy danh sách học viên trong lớp
router.get('/:classId/students', authMiddleware, roleMiddleware([('TEACHER' as unknown as Role), Role.ADMIN, Role.SPECIALIST]), classController.getClassStudents);

// Xuất báo cáo Excel điểm số học viên
router.get('/:classId/export', authMiddleware, roleMiddleware([('TEACHER' as unknown as Role), Role.ADMIN, Role.SPECIALIST]), classController.exportClassPerformance);


// --- LMS: MATERIALS ROUTES ---
import multer from 'multer';
const materialUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// Lấy tài liệu lớp (Dành cho HV, GV, ADMIN)
router.get('/:classId/materials', authMiddleware, classController.getClassMaterials);

// Thêm tài liệu (Chỉ GV lớp đó)
router.post('/:classId/materials', authMiddleware, roleMiddleware([('TEACHER' as unknown as Role)]), materialUpload.single('file'), classController.addClassMaterial);

// Xóa tài liệu (Chỉ GV lớp đó)
router.delete('/materials/:materialId', authMiddleware, roleMiddleware([('TEACHER' as unknown as Role)]), classController.deleteClassMaterial);

// Toggle trạng thái hoàn thành bài tập (Học viên)
router.patch('/materials/:materialId/toggle', authMiddleware, classController.toggleMaterialStatus);


// --- LMS: SESSIONS ROUTES (SCHEDULE) ---
// Lấy lịch học
router.get('/:classId/sessions', authMiddleware, classController.getClassSessions);

// Thêm buổi học
router.post('/:classId/sessions', authMiddleware, roleMiddleware([('TEACHER' as unknown as Role), Role.ADMIN]), classController.addClassSession);

// Xóa buổi học
router.delete('/sessions/:sessionId', authMiddleware, roleMiddleware([('TEACHER' as unknown as Role), Role.ADMIN]), classController.deleteClassSession);


export default router;
