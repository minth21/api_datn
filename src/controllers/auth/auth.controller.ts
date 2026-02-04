import { Request, Response } from 'express';
import { authService } from '../../services/auth/auth.service';
import { LoginDto } from '../../dto/auth/auth.dto';
import { successResponse, errorResponse } from '../../utils/response';
import { HTTP_STATUS, SUCCESS_MESSAGES } from '../../config/constants';
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
     * Đăng ký tài khoản mới
     */
    async register(req: Request, res: Response): Promise<void> {
        try {
            const {
                name,
                email,
                password,
                phoneNumber,
                dateOfBirth,
                gender,
                role,
                cefrLevel
            } = req.body;

            const result = await authService.register({
                name,
                email,
                password,
                phoneNumber,
                dateOfBirth,
                gender,
                role,
                cefrLevel
            });

            if (!result.success) {
                errorResponse(res, result.message || 'Registration failed', HTTP_STATUS.BAD_REQUEST);
                return;
            }

            // Trả về response với user và token
            res.status(HTTP_STATUS.CREATED).json(result);
        } catch (error) {
            logger.error('Register error:', error);
            errorResponse(res, 'Internal server error', HTTP_STATUS.INTERNAL_SERVER_ERROR);
        }
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
     * Yêu cầu reset password - Gửi OTP email
     */
    async forgotPassword(req: Request, res: Response): Promise<void> {
        try {
            const { email } = req.body;

            if (!email) {
                errorResponse(res, 'Email là bắt buộc', HTTP_STATUS.BAD_REQUEST);
                return;
            }

            const result = await authService.requestPasswordReset(email);

            res.status(HTTP_STATUS.OK).json(result);
        } catch (error) {
            logger.error('Forgot password error:', error);
            errorResponse(res, 'Internal server error', HTTP_STATUS.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * POST /api/auth/verify-reset-code
     * Xác thực OTP code (optional)
     */
    async verifyResetCode(req: Request, res: Response): Promise<void> {
        try {
            const { code } = req.body;

            if (!code) {
                errorResponse(res, 'Mã OTP là bắt buộc', HTTP_STATUS.BAD_REQUEST);
                return;
            }

            const result = await authService.verifyResetCode(code);

            res.status(HTTP_STATUS.OK).json(result);
        } catch (error) {
            logger.error('Verify reset code error:', error);
            errorResponse(res, 'Internal server error', HTTP_STATUS.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * POST /api/auth/reset-password
     * Reset password với OTP code
     */
    async resetPassword(req: Request, res: Response): Promise<void> {
        try {
            const { code, newPassword } = req.body;

            if (!code || !newPassword) {
                errorResponse(res, 'Mã OTP và mật khẩu mới là bắt buộc', HTTP_STATUS.BAD_REQUEST);
                return;
            }

            const result = await authService.resetPassword(code, newPassword);

            if (!result.success) {
                res.status(HTTP_STATUS.BAD_REQUEST).json(result);
                return;
            }

            res.status(HTTP_STATUS.OK).json(result);
        } catch (error) {
            logger.error('Reset password error:', error);
            errorResponse(res, 'Internal server error', HTTP_STATUS.INTERNAL_SERVER_ERROR);
        }
    }
}

// Export singleton instance
export const authController = new AuthController();
