import { Request, Response } from 'express';
import { aiBatchJobService } from '../services/ai-job.service';
import { logger } from '../utils/logger';

/**
 * GET /api/ai-jobs/:id
 * Get the status and progress of an AI batch job
 */
export const getJobStatus = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const job = await aiBatchJobService.getJobStatus(id);

        if (!job) {
            res.status(404).json({
                success: false,
                message: 'Job không tồn tại',
            });
            return;
        }

        res.status(200).json({
            success: true,
            data: job,
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
        const job = await aiBatchJobService.retryJob(id);

        if (!job) {
            res.status(404).json({
                success: false,
                message: 'Job không tồn tại hoặc đang xử lý',
            });
            return;
        }

        res.status(200).json({
            success: true,
            message: 'Đã bắt đầu xử lý lại các câu lỗi',
            data: job,
        });
    } catch (error: any) {
        logger.error('Error retrying job:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Lỗi khi retry job',
        });
    }
};
