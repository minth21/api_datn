import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient() as any;

export class NotificationService {
    /**
     * Tạo thông báo mới cho một người dùng cụ thể
     */
    static async createNotification(data: {
        userId: string;
        title: string;
        content: string;
        type: any;
        relatedId?: string;
    }) {
        try {
            return await prisma.notification.create({
                data: {
                    userId: data.userId,
                    title: data.title,
                    content: data.content,
                    type: data.type,
                    relatedId: data.relatedId,
                },
            });
        } catch (error) {
            console.error('Error creating notification:', error);
            // Không throw error để tránh làm gián đoạn luồng chính (ví dụ nộp bài)
            return null;
        }
    }

    /**
     * Lấy danh sách thông báo của người dùng
     */
    static async getNotifications(userId: string, limit: number = 20) {
        return await prisma.notification.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: limit,
        });
    }

    /**
     * Đếm số thông báo chưa đọc
     */
    static async getUnreadCount(userId: string) {
        return await prisma.notification.count({
            where: { userId, isRead: false },
        });
    }

    /**
     * Đánh dấu đã đọc
     */
    static async markAsRead(notificationId: string, userId: string) {
        return await prisma.notification.updateMany({
            where: { id: notificationId, userId },
            data: { isRead: true },
        });
    }

    /**
     * Đọc tất cả
     */
    static async markAllAsRead(userId: string) {
        return await prisma.notification.updateMany({
            where: { userId, isRead: false },
            data: { isRead: true },
        });
    }
}
