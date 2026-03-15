import { Request, Response, NextFunction } from 'express';

type AllowedRole = 'ADMIN' | 'SPECIALIST' | 'REVIEWER' | 'STUDENT';

/**
 * Roles Guard for Express - applies NestJS Guard pattern
 * @param roles Array of allowed roles for the route
 *
 * Usage:
 *   // @Roles('ADMIN', 'SPECIALIST')  ← intent annotation
 *   router.delete('/tests/:id', authMiddleware, rolesGuard(['ADMIN', 'SPECIALIST']), deleteTest);
 */
export const rolesGuard = (roles: AllowedRole[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        const user = req.user;

        if (!user) {
            res.status(401).json({
                success: false,
                message: 'Unauthorized: Bạn chưa đăng nhập.',
            });
            return;
        }

        if (!roles.includes(user.role as AllowedRole)) {
            res.status(403).json({
                success: false,
                message: `Forbidden: Role "${user.role}" không có quyền thực hiện thao tác này.`,
            });
            return;
        }

        next();
    };
};
