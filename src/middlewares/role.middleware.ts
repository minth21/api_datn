import { Request, Response, NextFunction } from 'express';

/**
 * Middleware để kiểm tra user có role nằm trong danh sách cho phép không
 * Phai dùng sau authMiddleware
 */
export const roleMiddleware = (allowedRoles: string[]) => {
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
                message: 'Forbidden - Bạn không có quyền thực hiện hành động này (Yêu cầu: ' + allowedRoles.join('/') + ')',
            });
            return;
        }

        next();
    };
};
