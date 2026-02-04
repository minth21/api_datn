import { Request, Response, NextFunction } from 'express';

/**
 * Middleware để kiểm tra user có role ADMIN không
 * Phải dùng sau authMiddleware
 */
export const adminMiddleware = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    const user = req.user;

    if (!user) {
        res.status(401).json({
            success: false,
            message: 'Unauthorized - Vui lòng đăng nhập',
        });
        return;
    }

    if (user.role !== 'ADMIN') {
        res.status(403).json({
            success: false,
            message: 'Forbidden - Bạn không có quyền truy cập',
        });
        return;
    }

    next();
};
