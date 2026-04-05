import { Router } from 'express';
import { 
    getTeacherClasses, 
    getClassStudents, 
    getStudentProgress, 
    getAttemptDetailForReport,
    exportStudentHistoryExcel,
    exportStudentHistoryPdf,
    updateTeacherNote
} from '../controllers/teacher.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// Tất cả các route giáo viên đều yêu cầu đăng nhập
router.use(authMiddleware);

// 1. Lấy danh sách lớp
router.get('/classes', getTeacherClasses);

// 2. Lấy danh sách học viên trong lớp
router.get('/classes/:classId/students', getClassStudents);

// 3. Lấy lịch sử tiến bộ của học viên
router.get('/students/:studentId/progress', getStudentProgress);

// 4. Lấy chi tiết bài làm để xuất phiếu điểm
router.get('/attempts/:attemptId', getAttemptDetailForReport);

// 5. Xuất báo cáo Excel/PDF
router.get('/students/:studentId/export-excel', exportStudentHistoryExcel);
router.get('/students/:studentId/export-pdf', exportStudentHistoryPdf);

// 6. Quản lý ghi chú bài làm
router.patch('/attempts/:attemptId/note', updateTeacherNote);

export default router;
