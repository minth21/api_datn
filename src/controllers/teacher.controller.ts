import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 1. Lấy danh sách các lớp do Giáo viên quản lý
 * GET /api/teacher/classes
 */
export const getTeacherClasses = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        // Lấy ID giáo viên từ token (middleware Auth)
        const teacherId = (req as any).user.id; 

        const classes = await prisma.class.findMany({
            where: { 
                teacherId: teacherId,
                status: 'ACTIVE' // Khớp với ClassStatus enum
            },
            include: {
                _count: {
                    select: { students: true } // Đếm số lượng học viên
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.status(200).json({ success: true, data: classes });
    } catch (error) {
        next(error);
    }
};

/**
 * 2. Lấy danh sách học viên trong một lớp cụ thể
 * GET /api/teacher/classes/:classId/students
 */
export const getClassStudents = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { classId } = req.params;
        const teacherId = (req as any).user.id;

        // 2.1 Bảo mật: Kiểm tra giáo viên có đang quản lý lớp này không
        const checkClass = await prisma.class.findFirst({
            where: { id: classId, teacherId: teacherId }
        });

        if (!checkClass) {
            res.status(403).json({ success: false, message: 'Bạn không có quyền truy cập lớp này' });
            return;
        }

        // 2.2 Query học viên khớp chuẩn DB (studentClassId, progress, estimatedScore)
        const students = await (prisma as any).user.findMany({
            where: { 
                studentClassId: classId, // Cột lưu ID lớp của học viên
                role: 'STUDENT',
                status: 'ACTIVE'
            },
            select: {
                id: true,
                username: true,
                name: true,
                avatarUrl: true,
                progress: true,             // Tiến độ % ôn tập
                estimatedScore: true,       // Điểm TOEIC dự kiến tổng
                estimatedListening: true,   // Điểm Listening dự kiến
                estimatedReading: true,     // Điểm Reading dự kiến
                averageScore: true,         // Điểm trung bình tất cả lần làm
                totalAttempts: true,        // Tổng số lần làm bài
                lastActiveAt: true          // Lần cuối online
            },
            orderBy: { name: 'asc' }
        });

        res.status(200).json({ success: true, data: students });
    } catch (error) {
        next(error);
    }
};

/**
 * 3. Lấy lịch sử làm bài của một học viên cụ thể (để vẽ biểu đồ)
 * GET /api/teacher/students/:studentId/progress
 */
export const getStudentProgress = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { studentId } = req.params;
        const user = (req as any).user;
        const isAdmin = user.role === 'ADMIN';

        // 1. Kiểm tra quyền truy cập (Admin hoặc GV của lớp chứa học viên này)
        if (!isAdmin) {
            const student = await prisma.user.findUnique({
                where: { id: studentId },
                select: { studentClassId: true }
            });

            if (!student || !student.studentClassId) {
                res.status(404).json({ success: false, message: 'Không tìm thấy học viên hoặc học viên chưa vào lớp' });
                return;
            }

            const checkClass = await prisma.class.findFirst({
                where: { id: student.studentClassId, teacherId: user.id }
            });

            if (!checkClass) {
                res.status(403).json({ success: false, message: 'Bạn không có quyền truy cập dữ liệu của học viên này' });
                return;
            }
        }

        // Lấy lịch sử từ bảng TestAttempt
        const history = await prisma.testAttempt.findMany({
            where: { userId: studentId },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                startTime: true,
                durationSeconds: true, // Thời gian làm bài tính bằng giây
                totalScore: true,
                listeningScore: true,
                readingScore: true,
                correctCount: true,
                totalQuestions: true,
                aiAnalysis: true,      // Nhận xét của AI đã được lưu sẵn
                createdAt: true,
                test: {
                    select: { title: true } // Lấy tên đề bài gốc
                },
                part: {
                    select: { partName: true } // Nếu làm từng phần lẻ
                }
            }
        });

        res.status(200).json({ success: true, data: history });
    } catch (error) {
        next(error);
    }
};

/**
 * 4. Lấy chi tiết một bài thi để Giáo viên xuất Phiếu điểm (Report Card)
 * GET /api/teacher/attempts/:attemptId
 */
export const getAttemptDetailForReport = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { attemptId } = req.params;

        const attempt = await prisma.testAttempt.findUnique({
            where: { id: attemptId },
            include: {
                user: {
                    select: { name: true, username: true, avatarUrl: true, studentClassId: true }
                },
                test: { select: { title: true } },
                part: { select: { partName: true, partNumber: true } },
                details: {
                    include: {
                        question: {
                            select: {
                                questionNumber: true,
                                topic_tag: true,
                                correctAnswer: true,
                                explanation: true,
                                analysis: true
                            }
                        }
                    },
                    orderBy: {
                        question: { questionNumber: 'asc' }
                    }
                }
            }
        });

        if (!attempt) {
            res.status(404).json({ success: false, message: 'Không tìm thấy lượt làm bài' });
            return;
        }

        // Kiểm tra quyền
        const user = (req as any).user;
        const isAdmin = user.role === 'ADMIN';
        if (!isAdmin) {
            const checkClass = await prisma.class.findFirst({
                where: { id: attempt.user.studentClassId as string, teacherId: user.id }
            });
            if (!checkClass) {
                res.status(403).json({ success: false, message: 'Bạn không có quyền xem chi tiết bài làm này' });
                return;
            }
        }

        res.status(200).json({ success: true, data: attempt });
    } catch (error) {
        next(error);
    }
};

/**
 * 5. Xuất báo cáo Excel lịch sử học viên
 * GET /api/teacher/students/:studentId/export-excel
 */
export const exportStudentHistoryExcel = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { studentId } = req.params;
        const user = (req as any).user;
        const isAdmin = user.role === 'ADMIN';

        // Kiểm tra quyền (Admin hoặc GV phụ trách)
        if (!isAdmin) {
            const student = await prisma.user.findUnique({
                where: { id: studentId },
                select: { studentClassId: true }
            });
            if (!student || !student.studentClassId) {
                res.status(404).json({ success: false, message: 'Không tìm thấy học viên hoặc học viên chưa vào lớp' });
                return;
            }
            const checkClass = await prisma.class.findFirst({
                where: { id: student.studentClassId, teacherId: user.id }
            });
            if (!checkClass) {
                res.status(403).json({ success: false, message: 'Bạn không có quyền xuất dữ liệu này' });
                return;
            }
        }

        const { ExportService } = await import('../services/export.service');
        const exportService = new ExportService();

        const buffer = await exportService.generateStudentHistoryExcel(studentId);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Practice_History_${studentId}.xlsx`);
        res.send(buffer);
    } catch (error) {
        next(error);
    }
};

/**
 * 6. Xuất báo cáo PDF lịch sử học viên
 * GET /api/teacher/students/:studentId/export-pdf
 */
export const exportStudentHistoryPdf = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { studentId } = req.params;
        const user = (req as any).user;
        const isAdmin = user.role === 'ADMIN';

        // Kiểm tra quyền
        if (!isAdmin) {
            const student = await prisma.user.findUnique({
                where: { id: studentId },
                select: { studentClassId: true }
            });
            if (!student || !student.studentClassId) {
                res.status(404).json({ success: false, message: 'Không tìm thấy học viên hoặc học viên chưa vào lớp' });
                return;
            }
            const checkClass = await prisma.class.findFirst({
                where: { id: student.studentClassId, teacherId: user.id }
            });
            if (!checkClass) {
                res.status(403).json({ success: false, message: 'Bạn không có quyền xuất dữ liệu PDF này' });
                return;
            }
        }

        const { ExportService } = await import('../services/export.service');
        const exportService = new ExportService();

        const pdfDoc = await exportService.generateStudentHistoryPdf(studentId);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Practice_History_${studentId}.pdf`);
        
        pdfDoc.pipe(res);
        pdfDoc.end();
    } catch (error) {
        next(error);
    }
};

/**
 * 7. Cập nhật ghi chú của Giáo viên cho một bài làm
 * PATCH /api/teacher/attempts/:attemptId/note
 */
export const updateTeacherNote = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { attemptId } = req.params;
        const { teacherNote } = req.body;
        const teacherId = (req as any).user.id;

        // Bảo mật: Kiểm tra bài làm này có thuộc về học viên trong lớp của giáo viên này không
        const attempt = await prisma.testAttempt.findUnique({
            where: { id: attemptId },
            include: {
                user: {
                    select: { studentClassId: true }
                }
            }
        });

        if (!attempt) {
            res.status(404).json({ success: false, message: 'Không tìm thấy lượt làm bài' });
            return;
        }

        // Kiểm tra quyền sở hữu lớp
        const checkClass = await prisma.class.findFirst({
            where: { 
                id: attempt.user.studentClassId as string, 
                teacherId: teacherId 
            }
        });

        if (!checkClass && (req as any).user.role !== 'ADMIN') {
            res.status(403).json({ success: false, message: 'Bạn không có quyền chỉnh sửa ghi chú cho bài làm này' });
            return;
        }

        const updatedAttempt = await prisma.testAttempt.update({
            where: { id: attemptId },
            data: { teacherNote }
        });

        res.status(200).json({ 
            success: true, 
            message: 'Cập nhật ghi chú thành công', 
            data: updatedAttempt 
        });
    } catch (error) {
        next(error);
    }
};
