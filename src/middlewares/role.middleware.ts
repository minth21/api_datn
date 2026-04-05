import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';

/**
 * Middleware để kiểm tra user có thuộc một trong các roles cho phép không
 * Phải dùng sau authMiddleware
 */
export const roleMiddleware = (allowedRoles: Role[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        const user = req.user;

        if (!user) {
            res.status(401).json({
                success: false,
                message: 'Unauthorized - Vui lòng đăng nhập',
            });
            return;
        }

        if (!allowedRoles.includes(user.role)) {
            res.status(403).json({
                success: false,
                message: 'Forbidden - Bạn không có quyền thực hiện hành động này',
            });
            return;
        }

        next();
    };
};
