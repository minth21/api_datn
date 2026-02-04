import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { errorResponse } from '../utils/response';
import { HTTP_STATUS, ERROR_MESSAGES } from '../config/constants';

/**
 * Global error handler middleware
 */
export const errorHandler = (
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    logger.error('Unhandled error:', err);

    errorResponse(
        res,
        ERROR_MESSAGES.INTERNAL_ERROR,
        HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
};

/**
 * 404 Not Found handler
 */
export const notFoundHandler = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    errorResponse(
        res,
        `Route ${req.method} ${req.path} not found`,
        HTTP_STATUS.NOT_FOUND
    );
};
