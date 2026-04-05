import { Request, Response, NextFunction } from 'express';
import { NotificationService } from '../services/notification.service';

export const getNotifications = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const userId = (req as any).user.id;
        const notifications = await NotificationService.getNotifications(userId);
        const unreadCount = await NotificationService.getUnreadCount(userId);

        res.status(200).json({
            success: true,
            data: {
                notifications,
                unreadCount,
            },
        });
    } catch (error) {
        next(error);
    }
};

export const markRead = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const userId = (req as any).user.id;
        const { id } = req.params;

        if (id === 'all') {
            await NotificationService.markAllAsRead(userId);
        } else {
            await NotificationService.markAsRead(id, userId);
        }

        res.status(200).json({
            success: true,
            message: 'Đã cập nhật trạng thái thông báo',
        });
    } catch (error) {
        next(error);
    }
};
