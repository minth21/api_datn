import { Request, Response } from 'express';
import { logger } from '../utils/logger';

/**
 * GET /api/ai-jobs/:id
 * Get the status and progress of an AI batch job
 */
export const getJobStatus = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        logger.info(`Checking status for job ${id}`);
        
        res.status(404).json({
            success: false,
            message: 'Tính năng này đang được bảo trì hoặc không tồn tại',
        });
    } catch (error: any) {
        logger.error('Error fetching job status:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Lỗi khi lấy trạng thái job',
        });
    }
};

/**
 * POST /api/ai-jobs/:id/retry
 * Retry failed items in a batch job
 */
export const retryJob = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        logger.info(`Retrying job ${id}`);

        res.status(404).json({
            success: false,
            message: 'Tính năng này đang được bảo trì hoặc không tồn tại',
        });
    } catch (error: any) {
        logger.error('Error retrying job:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Lỗi khi retry job',
        });
    }
};
