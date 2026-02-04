import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { errorResponse } from '../utils/response';
import { HTTP_STATUS } from '../config/constants';

/**
 * Middleware để validate request data
 */
export const validateRequest = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        const errorMessages = errors.array().map((err) => err.msg).join(', ');
        errorResponse(res, errorMessages, HTTP_STATUS.BAD_REQUEST);
        return;
    }

    next();
};
