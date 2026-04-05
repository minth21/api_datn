
import { Request, Response } from 'express';
import { authService } from '../../services/auth/auth.service';
import { LoginDto } from '../../dto/auth/auth.dto';
import { successResponse, errorResponse } from '../../utils/response';
import { HTTP_STATUS } from '../../config/constants';
import { logger } from '../../utils/logger';

/**
 * Auth Controller - Xử lý HTTP requests cho authentication
 */
export class AuthController {
    /**
     * POST /api/auth/login
     * Đăng nhập
     */
    async login(req: Request, res: Response): Promise<void> {
        try {
            const loginDto: LoginDto = req.body;

            const result = await authService.login(loginDto);

            if (!result.success) {
                errorResponse(res, result.message || 'Login failed', HTTP_STATUS.UNAUTHORIZED);
                return;
            }

            // Trả về response với user và token
            res.status(HTTP_STATUS.OK).json(result);
        } catch (error) {
            logger.error('Login error:', error);
            errorResponse(res, 'Internal server error', HTTP_STATUS.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * POST /api/auth/register
     * Đăng ký tài khoản mới (Bị Khóa)
     */
    async register(_req: Request, res: Response): Promise<void> {
        errorResponse(res, 'Vui lòng liên hệ Trung tâm để được cấp tài khoản', HTTP_STATUS.FORBIDDEN);
    }


    /**
     * GET /api/auth/me
     * Lấy thông tin user hiện tại (cần token)
     */
    async getCurrentUser(req: Request, res: Response): Promise<void> {
        try {
            // User đã được attach vào request bởi authMiddleware
            const user = req.user;

            if (!user) {
                errorResponse(res, 'User not found', HTTP_STATUS.NOT_FOUND);
                return;
            }

            successResponse(res, { user }, 'User retrieved successfully');
        } catch (error) {
            logger.error('Get current user error:', error);
            errorResponse(res, 'Internal server error', HTTP_STATUS.INTERNAL_SERVER_ERROR);
        }
    }

    // ============================================
    // PASSWORD RESET ENDPOINTS
    // ============================================

    /**
     * POST /api/auth/forgot-password
     * Vô hiệu hóa tính năng quên mật khẩu
     */
    async forgotPassword(_req: Request, res: Response): Promise<void> {
        errorResponse(res, 'Chức năng Quên mật khẩu đã bị vô hiệu hóa. Vui lòng liên hệ Trung tâm.', HTTP_STATUS.FORBIDDEN);
    }

    /**
     * POST /api/auth/verify-reset-code
     * Vô hiệu hóa
     */
    async verifyResetCode(_req: Request, res: Response): Promise<void> {
        errorResponse(res, 'Chức năng đã bị vô hiệu hóa.', HTTP_STATUS.FORBIDDEN);
    }

    /**
     * POST /api/auth/reset-password
     * Vô hiệu hóa
     */
    async resetPassword(_req: Request, res: Response): Promise<void> {
        errorResponse(res, 'Chức năng đã bị vô hiệu hóa.', HTTP_STATUS.FORBIDDEN);
    }
    /**
     * Google Login entry
     */
    async googleLogin(req: Request, res: Response): Promise<void> {
        try {
            const { idToken } = req.body;

            if (!idToken) {
                errorResponse(res, 'Google ID Token là bắt buộc', HTTP_STATUS.BAD_REQUEST);
                return;
            }

            const result = await authService.googleLogin(idToken);

            if (!result.success) {
                errorResponse(res, result.message || 'Google Login failed', HTTP_STATUS.UNAUTHORIZED);
                return;
            }

            res.status(HTTP_STATUS.OK).json(result);
        } catch (error) {
            logger.error('Google Login error:', error);
            errorResponse(res, 'Internal server error', HTTP_STATUS.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * PATCH /api/auth/change-password
     * Đổi mật khẩu
     */
    async changePassword(req: Request, res: Response): Promise<void> {
        try {
            const userId = (req.user as any).id;
            const changePasswordDto = req.body;

            const result = await authService.changePassword(userId, changePasswordDto);

            if (!result.success) {
                res.status(HTTP_STATUS.BAD_REQUEST).json(result);
                return;
            }

            res.status(HTTP_STATUS.OK).json(result);
        } catch (error) {
            logger.error('Change password error:', error);
            errorResponse(res, 'Internal server error', HTTP_STATUS.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * POST /api/auth/change-first-password
     * Đổi mật khẩu lần đầu - bắt buộc với non-ADMIN users
     */
    async changeFirstPassword(req: Request, res: Response): Promise<void> {
        try {
            const userId = (req.user as any).id;
            const { newPassword } = req.body;

            if (!newPassword) {
                errorResponse(res, 'Mật khẩu mới là bắt buộc', HTTP_STATUS.BAD_REQUEST);
                return;
            }

            const result = await authService.changeFirstPassword(userId, newPassword);

            if (!result.success) {
                res.status(HTTP_STATUS.BAD_REQUEST).json(result);
                return;
            }

            res.status(HTTP_STATUS.OK).json(result);
        } catch (error) {
            logger.error('Change first password error:', error);
            errorResponse(res, 'Internal server error', HTTP_STATUS.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * POST /api/auth/update-password
     * Đổi mật khẩu chủ động (yêu cầu mật khẩu hiện tại)
     */
    async updatePassword(req: Request, res: Response): Promise<void> {
        try {
            const userId = (req.user as any).id;
            const { currentPassword, newPassword } = req.body;

            if (!currentPassword || !newPassword) {
                errorResponse(res, 'Mật khẩu hiện tại và mật khẩu mới là bắt buộc', HTTP_STATUS.BAD_REQUEST);
                return;
            }

            const result = await authService.updatePassword(userId, currentPassword, newPassword);

            if (!result.success) {
                res.status(HTTP_STATUS.BAD_REQUEST).json(result);
                return;
            }

            res.status(HTTP_STATUS.OK).json(result);
        } catch (error) {
            logger.error('Update password controller error:', error);
            errorResponse(res, 'Internal server error', HTTP_STATUS.INTERNAL_SERVER_ERROR);
        }
    }
}

// Export singleton instance
export const authController = new AuthController();
