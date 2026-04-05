import { Request, Response } from 'express';
import { PrismaClient, NotificationType } from '@prisma/client';
import { NotificationService } from '../services/notification.service';
import { successResponse, errorResponse } from '../utils/response';
import { HTTP_STATUS } from '../config/constants';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export class ComplaintController {
    /**
     * 1. Giáo viên gửi góp ý về bài thi
     * POST /api/complaints
     */
    static async sendComplaint(req: Request, res: Response) {
        try {
            const { testId, content } = req.body;
            const userId = (req as any).user.id;
            const userName = (req as any).user.name;

            if (!testId || !content) {
                return errorResponse(res, 'Vui lòng cung cấp ID bài thi và nội dung góp ý', HTTP_STATUS.BAD_REQUEST);
            }

            // 1. Tạo khiếu nại trong DB
            const complaint = await (prisma as any).testComplaint.create({
                data: {
                    testId,
                    userId,
                    content,
                    status: 'PENDING'
                },
                include: {
                    test: { select: { title: true } }
                }
            });

            // 2. Tìm tất cả ADMIN và SPECIALIST để gửi thông báo
            const staffMembers = await prisma.user.findMany({
                where: {
                    role: { in: ['ADMIN', 'SPECIALIST'] }
                },
                select: { id: true }
            });

            // 3. Gửi thông báo cho từng người
            const notificationTitle = `🚩 Góp ý mới về bài thi: ${complaint.test.title}`;
            const notificationContent = `Giáo viên ${userName} vừa gửi góp ý mới: "${content}"`;

            const notificationPromises = staffMembers.map(staff => 
                NotificationService.createNotification({
                    userId: staff.id,
                    title: notificationTitle,
                    content: notificationContent,
                    type: 'TEST_COMPLAINT' as NotificationType,
                    relatedId: complaint.testId
                })
            );

            await Promise.all(notificationPromises);

            // 4. Thông báo cho chính GV là đã gửi thành công
            await NotificationService.createNotification({
                userId: userId,
                title: '✅ Gửi góp ý thành công',
                content: `Góp ý của bạn về bài thi "${complaint.test.title}" đã được chuyển tới Admin và Chuyên viên.`,
                type: 'SYSTEM' as NotificationType,
                relatedId: complaint.id
            });

            return successResponse(res, complaint, 'Gửi góp ý thành công');
        } catch (error) {
            logger.error('Error in sendComplaint:', error);
            return errorResponse(res, 'Lỗi khi gửi góp ý');
        }
    }

    /**
     * 2. Lấy danh sách góp ý (Phân quyền)
     * GET /api/complaints
     */
    static async getComplaints(req: Request, res: Response) {
        try {
            const user = (req as any).user;
            const isAdminOrSpecialist = ['ADMIN', 'SPECIALIST'].includes(user.role);

            const complaints = await (prisma as any).testComplaint.findMany({
                where: isAdminOrSpecialist ? {} : { userId: user.id },
                include: {
                    test: { select: { title: true } },
                    user: { select: { name: true, role: true } }
                },
                orderBy: { createdAt: 'desc' }
            });

            return successResponse(res, complaints, 'Tải danh sách góp ý thành công');
        } catch (error) {
            logger.error('Error in getComplaints:', error);
            return errorResponse(res, 'Lỗi khi tải danh sách góp ý');
        }
    }

    /**
     * 3. Chuyên viên/Admin xử lý xong góp ý
     * PATCH /api/complaints/:id/resolve
     */
    static async resolveComplaint(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const user = (req as any).user;

            if (!['ADMIN', 'SPECIALIST'].includes(user.role)) {
                return errorResponse(res, 'Bạn không có quyền thực hiện hành động này', HTTP_STATUS.FORBIDDEN);
            }

            const complaint = await (prisma as any).testComplaint.update({
                where: { id },
                data: { status: 'RESOLVED' },
                include: {
                    test: { select: { title: true } }
                }
            });

            // Gửi thông báo cho GV đã gửi góp ý
            await NotificationService.createNotification({
                userId: complaint.userId,
                title: '🎉 Góp ý bài thi đã được xử lý',
                content: `Nội dung góp ý của bạn về bài thi "${complaint.test.title}" đã được Admin/Chuyên viên xử lý xong. Cảm ơn sự hợp tác của bạn!`,
                type: 'COMPLAINT_RESOLVED' as NotificationType,
                relatedId: complaint.testId
            });

            return successResponse(res, complaint, 'Đã đánh dấu đã xử lý góp ý');
        } catch (error) {
            logger.error('Error in resolveComplaint:', error);
            return errorResponse(res, 'Lỗi khi xử lý góp ý');
        }
    }
}
