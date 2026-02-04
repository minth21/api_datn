import { Response } from 'express';
import { HTTP_STATUS } from '../config/constants';
import { ApiResponse } from '../dto/auth.dto';

/**
 * Chuẩn hóa response thành công
 */
export const successResponse = <T>(
    res: Response,
    data: T,
    message?: string,
    statusCode: number = HTTP_STATUS.OK
): Response => {
    const response: ApiResponse<T> = {
        success: true,
        message,
        data,
    };
    return res.status(statusCode).json(response);
};

/**
 * Chuẩn hóa response lỗi
 */
export const errorResponse = (
    res: Response,
    error: string,
    statusCode: number = HTTP_STATUS.BAD_REQUEST
): Response => {
    const response: ApiResponse = {
        success: false,
        error,
    };
    return res.status(statusCode).json(response);
};
