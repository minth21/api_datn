import { Request, Response } from 'express';
import { PrismaClient, NotificationType } from '@prisma/client';
import { NotificationService } from '../services/notification.service';
import { successResponse, errorResponse } from '../utils/response';
import { HTTP_STATUS } from '../config/constants';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export class FeedbackController {
    /**
     * 1. Học viên gửi ý kiến lên Giáo viên
     * POST /api/feedbacks
     */
    static async sendFeedback(req: Request, res: Response) {
        try {
            const { classId, content, imageUrl } = req.body;
            const userId = (req as any).user.id;
            const userName = (req as any).user.name;

            if (!classId || !content) {
                return errorResponse(res, 'Vui lòng cung cấp classId và nội dung ý kiến', HTTP_STATUS.BAD_REQUEST);
            }

            // Kiểm tra lớp học và lấy TeacherId
            const targetClass = await prisma.class.findUnique({
                where: { id: classId },
                include: {
                    students: { where: { id: userId } }
                }
            });

            if (!targetClass) {
                return errorResponse(res, 'Không tìm thấy lớp học', HTTP_STATUS.NOT_FOUND);
            }

            // Kiểm tra học sinh có thuộc lớp này không (Bảo mật)
            if (targetClass.students.length === 0) {
                return errorResponse(res, 'Bạn không thuộc lớp học này để gửi ý kiến', HTTP_STATUS.FORBIDDEN);
            }

            // 1. Tạo Feedback trong DB
            const feedback = await (prisma as any).studentFeedback.create({
                data: {
                    classId,
                    userId,
                    teacherId: targetClass.teacherId,
                    content,
                    imageUrl,
                    status: 'PENDING'
                },
                include: {
                    class: { select: { className: true } }
                }
            });

            // 2. Gửi thông báo cho Giáo viên
            await NotificationService.createNotification({
                userId: targetClass.teacherId,
                title: `💬 Ý kiến mới từ học viên ${targetClass.className}`,
                content: `Học viên ${userName} gửi ý kiến: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`,
                type: 'STUDENT_FEEDBACK' as NotificationType,
                relatedId: feedback.id
            });

            // 3. Thông báo cho chính Học viên là đã gửi thành công
            await NotificationService.createNotification({
                userId: userId,
                title: '✅ Gửi ý kiến thành công',
                content: `Ý kiến của bạn đã được gửi tới Giáo viên phụ trách ${targetClass.className}.`,
                type: 'SYSTEM' as NotificationType,
                relatedId: feedback.id
            });

            return successResponse(res, feedback, 'Gửi ý kiến thành công');
        } catch (error) {
            logger.error('Error in sendFeedback:', error);
            return errorResponse(res, 'Lỗi khi gửi ý kiến');
        }
    }

    /**
     * 2. Lấy danh sách ý kiến (Phân quyền)
     * GET /api/feedbacks
     */
    static async getFeedbacks(req: Request, res: Response) {
        try {
            const user = (req as any).user;
            let feedbacks;

            if (user.role === 'TEACHER') {
                // Giáo viên chỉ thấy ý kiến gửi cho mình
                feedbacks = await (prisma as any).studentFeedback.findMany({
                    where: { teacherId: user.id },
                    include: {
                        user: { select: { name: true, avatarUrl: true } },
                        class: { select: { className: true, classCode: true } }
                    },
                    orderBy: { createdAt: 'desc' }
                });
            } else if (user.role === 'STUDENT') {
                // Học viên chỉ thấy ý kiến của chính mình
                feedbacks = await (prisma as any).studentFeedback.findMany({
                    where: { userId: user.id },
                    include: {
                        class: { select: { className: true } },
                        teacher: { select: { name: true } }
                    },
                    orderBy: { createdAt: 'desc' }
                });
            } else if (user.role === 'ADMIN') {
                // Admin thấy tất cả (để giám sát nếu cần)
                feedbacks = await (prisma as any).studentFeedback.findMany({
                    include: {
                        user: { select: { name: true } },
                        teacher: { select: { name: true } },
                        class: { select: { className: true } }
                    },
                    orderBy: { createdAt: 'desc' }
                });
            } else {
                return errorResponse(res, 'Bạn không có quyền truy cập', HTTP_STATUS.FORBIDDEN);
            }

            return successResponse(res, feedbacks, 'Tải danh sách ý kiến thành công');
        } catch (error) {
            logger.error('Error in getFeedbacks:', error);
            return errorResponse(res, 'Lỗi khi tải danh sách ý kiến');
        }
    }

    /**
     * 3. Giáo viên đánh dấu đã xử lý/phản hồi
     * PATCH /api/feedbacks/:id/resolve
     */
    static async resolveFeedback(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const teacherId = (req as any).user.id;

            // Tìm feedback và kiểm tra quyền sở hữu
            const existingFeedback = await (prisma as any).studentFeedback.findUnique({
                where: { id }
            });

            if (!existingFeedback) {
                return errorResponse(res, 'Không tìm thấy ý kiến', HTTP_STATUS.NOT_FOUND);
            }

            if (existingFeedback.teacherId !== teacherId && (req as any).user.role !== 'ADMIN') {
                return errorResponse(res, 'Bạn không có quyền xử lý ý kiến này', HTTP_STATUS.FORBIDDEN);
            }

            const feedback = await (prisma as any).studentFeedback.update({
                where: { id },
                data: { status: 'RESOLVED' },
                include: {
                    class: { select: { className: true } }
                }
            });

            // Gửi thông báo cho Học viên
            await NotificationService.createNotification({
                userId: feedback.userId,
                title: '🎉 Ý kiến của bạn đã được Giáo viên xử lý',
                content: `Giáo viên phụ trách lớp ${feedback.class.className} đã ghi nhận và xử lý ý kiến của bạn.`,
                type: 'FEEDBACK_RESOLVED' as NotificationType,
                relatedId: feedback.id
            });

            return successResponse(res, feedback, 'Đã đánh dấu xử lý ý kiến thành công');
        } catch (error) {
            logger.error('Error in resolveFeedback:', error);
            return errorResponse(res, 'Lỗi khi xử lý ý kiến');
        }
    }
}
