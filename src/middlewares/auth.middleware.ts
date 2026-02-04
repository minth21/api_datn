import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth/auth.service';
import { errorResponse } from '../utils/response';
import { HTTP_STATUS, ERROR_MESSAGES } from '../config/constants';
import { logger } from '../utils/logger';

/**
 * Middleware để xác thực token
 */
export const authMiddleware = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            errorResponse(res, ERROR_MESSAGES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED);
            return;
        }

        // Extract token from "Bearer <token>"
        const token = authHeader.replace('Bearer ', '');

        if (!token) {
            errorResponse(res, ERROR_MESSAGES.TOKEN_INVALID, HTTP_STATUS.UNAUTHORIZED);
            return;
        }

        // Validate token
        const user = await authService.validateToken(token);

        if (!user) {
            errorResponse(res, ERROR_MESSAGES.TOKEN_INVALID, HTTP_STATUS.UNAUTHORIZED);
            return;
        }

        // Attach user to request
        req.user = user;
        next();
    } catch (error) {
        logger.error('Auth middleware error:', error);
        errorResponse(res, ERROR_MESSAGES.INTERNAL_ERROR, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
};
