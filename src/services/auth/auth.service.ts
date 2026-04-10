import {
    LoginDto,
    LoginResponseDto,
    UserDto,
    RegisterDto,
    PasswordResetResponseDto,
    ApiResponse,
    ChangePasswordDto
} from '../../dto/auth/auth.dto';
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '../../config/constants';
import { logger } from '../../utils/logger';
import { prisma } from '../../config/prisma';
import bcrypt from 'bcrypt';
import { User } from '@prisma/client';
import { generateToken, verifyToken } from '../../utils/jwt';
// import { emailService } from '../email/email.service';

const SALT_ROUNDS = 10;

/**
 * Auth Service - Xử lý business logic cho authentication với PostgreSQL
 */
export class AuthService {
    /**
     * Đăng nhập với email và password
     */
    async login(loginDto: LoginDto): Promise<LoginResponseDto> {
        const { username, password } = loginDto;

        logger.info(`Login attempt for username: ${username}`);

        try {
            // Tìm user trong database bằng username
            const user = await prisma.user.findUnique({
                where: { username },
            });

            if (!user) {
                logger.warn(`Login failed: User not found - ${username}`);
                return {
                    success: false,
                    message: ERROR_MESSAGES.INVALID_CREDENTIALS,
                };
            }

            // Check if account is locked
            if (user.status === 'LOCKED') {
                logger.warn(`Login failed: Account locked - ${username}`);
                return {
                    success: false,
                    message: 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Admin.',
                };
            }

            // Verify password and Auth Provider
            if (user.authProvider === 'GOOGLE') {
                logger.warn(`Login failed: Account linked to Google - ${username}`);
                return {
                    success: false,
                    message: 'Tài khoản này được liên kết với Google. Vui lòng sử dụng tính năng Đăng nhập bằng Google.',
                };
            }

            // Handle Local accounts that might not have a password (legacy data)
            if (!user.password) {
                logger.warn(`Login failed: Account has no password - ${username}`);
                return {
                    success: false,
                    message: ERROR_MESSAGES.INVALID_CREDENTIALS,
                };
            }
            const isPasswordValid = await bcrypt.compare(password, user.password);

            if (!isPasswordValid) {
                logger.warn(`Login failed: Invalid password - ${username}`);
                return {
                    success: false,
                    message: ERROR_MESSAGES.INVALID_CREDENTIALS,
                };
            }

            // Tạo UserDto (loại bỏ password)
            const userDto: UserDto = this.mapUserToDto(user);

            // Generate JWT token
            const token = generateToken({
                userId: user.id,
                username: user.username,
                role: user.role,
            });

            logger.info(`Login successful for user ID: ${user.username}`);

            return {
                success: true,
                message: SUCCESS_MESSAGES.LOGIN_SUCCESS,
                user: userDto,
                token,
            };
        } catch (error) {
            logger.error('Login error:', error);
            return {
                success: false,
                message: 'Đã xảy ra lỗi khi đăng nhập',
            };
        }
    }

    /**
     * Đăng ký user mới
     */
    async register(_registerDto: RegisterDto): Promise<LoginResponseDto> {
        return {
            success: false,
            message: 'Vui lòng liên hệ Trung tâm để được cấp tài khoản',
        };
    }


    /**
     * Validate token và trả về user
     */
    async validateToken(token: string): Promise<UserDto | null> {
        logger.debug(`Validating JWT token`);

        try {
            // Verify JWT token
            const decoded = verifyToken(token);

            if (!decoded) {
                logger.warn(`Invalid or expired token`);
                return null;
            }

            // Get user from database with class information
            const user = await prisma.user.findUnique({
                where: { id: decoded.userId },
                include: {
                    studentClass: {
                        include: {
                            teacher: {
                                select: { name: true }
                            }
                        }
                    }
                }
            });

            if (!user) {
                logger.warn(`Token valid but user not found: ${decoded.userId}`);
                return null;
            }

            return this.mapUserToDto(user);
        } catch (error) {
            logger.error('Token validation error:', error);
            return null;
        }
    }

    // ============================================
    // PASSWORD RESET METHODS
    // ============================================

    async requestPasswordReset(username: string): Promise<PasswordResetResponseDto> {
        logger.info(`Password reset requested for username: ${username}`);
        try {
            // Logic reset password qua email tạm thời vô hiệu hóa do đã xóa trường email
            // Bạn có thể đăng ký lại logic này bằng cách sử dụng username hoặc một cơ chế khác
            return {
                success: false,
                message: 'Chức năng reset mật khẩu qua email hiện chưa khả dụng. Vui lòng liên hệ Admin.',
            };
        } catch (error) {
            logger.error('Request password reset error:', error);
            return {
                success: false,
                message: 'Đã xảy ra lỗi khi xử lý yêu cầu. Vui lòng thử lại sau.',
            };
        }
    }

    /**
     * Xác thực OTP code (optional - có thể verify luôn khi reset)
     */
    async verifyResetCode(code: string): Promise<PasswordResetResponseDto> {
        logger.info(`Verifying reset code: ${code}`);

        try {
            // Validate code format (6 digits)
            if (!/^\d{6}$/.test(code)) {
                return {
                    success: false,
                    message: 'Mã OTP không hợp lệ. Vui lòng nhập 6 chữ số.',
                };
            }

            // Tìm token trong database
            const resetToken = await prisma.passwordResetToken.findFirst({
                where: {
                    code,
                    used: false,
                },
            });

            if (!resetToken) {
                logger.warn(`Reset code not found or already used: ${code}`);
                return {
                    success: false,
                    message: 'Mã OTP không hợp lệ hoặc đã được sử dụng.',
                };
            }

            // Kiểm tra thời gian hết hạn
            if (new Date() > resetToken.expiresAt) {
                logger.warn(`Reset code expired: ${code}`);
                return {
                    success: false,
                    message: 'Mã OTP đã hết hạn. Vui lòng yêu cầu mã mới.',
                };
            }

            logger.info(`Reset code verified successfully: ${code}`);

            return {
                success: true,
                message: 'Mã OTP hợp lệ.',
            };
        } catch (error) {
            logger.error('Verify reset code error:', error);
            return {
                success: false,
                message: 'Đã xảy ra lỗi khi xác thực mã OTP.',
            };
        }
    }

    /**
     * Reset password với OTP code
     */
    async resetPassword(code: string, newPassword: string): Promise<PasswordResetResponseDto> {
        logger.info(`Attempting to reset password with code: ${code}`);

        try {
            // Validate code format (6 digits)
            if (!/^\d{6}$/.test(code)) {
                return {
                    success: false,
                    message: 'Mã OTP không hợp lệ. Vui lòng nhập 6 chữ số.',
                };
            }

            // Validate password length
            if (newPassword.length < 8) {
                return {
                    success: false,
                    message: 'Mật khẩu phải có ít nhất 8 ký tự.',
                };
            }

            // Tìm token trong database
            const resetToken = await prisma.passwordResetToken.findFirst({
                where: {
                    code,
                    used: false,
                },
                include: {
                    user: true,
                },
            });

            if (!resetToken) {
                logger.warn(`Reset code not found or already used: ${code}`);
                return {
                    success: false,
                    message: 'Mã OTP không hợp lệ hoặc đã được sử dụng.',
                };
            }

            // Kiểm tra thời gian hết hạn
            if (new Date() > resetToken.expiresAt) {
                logger.warn(`Reset code expired: ${code}`);
                return {
                    success: false,
                    message: 'Mã OTP đã hết hạn. Vui lòng yêu cầu mã mới.',
                };
            }

            // Hash password mới
            const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

            // Update password và mark token as used trong một transaction
            await prisma.$transaction([
                prisma.user.update({
                    where: { id: resetToken.userId },
                    data: { password: hashedPassword },
                }),
                prisma.passwordResetToken.update({
                    where: { id: resetToken.id },
                    data: { used: true },
                }),
            ]);

            logger.info(`Password reset successful for user ID: ${resetToken.user.username}`);

            return {
                success: true,
                message: 'Mật khẩu đã được đặt lại thành công. Bạn có thể đăng nhập bằng mật khẩu mới.',
            };
        } catch (error) {
            logger.error('Reset password error:', error);
            return {
                success: false,
                message: 'Đã xảy ra lỗi khi đặt lại mật khẩu. Vui lòng thử lại sau.',
            };
        }
    }

    /**
     * Đăng nhập với Google ID Token
     */
    async googleLogin(idToken: string): Promise<LoginResponseDto> {
        const { OAuth2Client } = require('google-auth-library');
        const client = new OAuth2Client();

        try {
            logger.info(`Verifying Google ID Token`);
            // Hardcoded Client ID to match Flutter app
            const CLIENT_ID = '112210310564-j3r1bsrtohpb30d53vfao2kp7knchfrl.apps.googleusercontent.com';

            const ticket = await client.verifyIdToken({
                idToken,
                audience: CLIENT_ID,
            });
            const payload = ticket.getPayload();

            if (!payload) {
                logger.error('Google Login failed: No payload returned from verification');
                return {
                    success: false,
                    message: 'Invalid Google Token',
                };
            }

            const { email, name, picture } = payload;

            if (!email) {
                return {
                    success: false,
                    message: 'Email not found in Google Token',
                };
            }

            logger.info(`Google Login attempt for email: ${email}`);

            let user = await prisma.user.findFirst({
                where: { username: email }, // Sử dụng email làm username cho Google users
            });

            if (!user) {
                logger.info(`Creating new user from Google Login: ${email}`);
                user = await prisma.user.create({
                    data: {
                        username: email,
                        name: name || 'Google User',
                        avatarUrl: picture,
                        password: null, // Explicitly null for Google auth
                        authProvider: 'GOOGLE',
                        role: 'STUDENT',
                    },
                });
            } else {
                if (!user.avatarUrl && picture) {
                    user = await prisma.user.update({
                        where: { id: user.id },
                        data: { avatarUrl: picture },
                    });
                }
            }

            // Check if account is locked
            if (user.status === 'LOCKED') {
                logger.warn(`Google Login failed: Account locked - ${user.username}`);
                return {
                    success: false,
                    message: 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Admin.',
                };
            }

            const token = generateToken({
                userId: user.id,
                username: user.username,
                role: user.role,
            });

            const userDto: UserDto = this.mapUserToDto(user);

            return {
                success: true,
                message: SUCCESS_MESSAGES.LOGIN_SUCCESS,
                user: userDto,
                token,
            };
        } catch (error) {
            logger.error('Google Login error:', error);
            return {
                success: false,
                message: `Google Login failed: ${(error as any).message || error}`,
            };
        }
    }

    /**
     * Change password
     */
    async changePassword(userId: string, changePasswordDto: ChangePasswordDto): Promise<ApiResponse> {
        const { oldPassword, newPassword } = changePasswordDto;

        try {
            const user = await prisma.user.findUnique({
                where: { id: userId },
            });

            if (!user) {
                return { success: false, message: 'Người dùng không tồn tại' };
            }

            // Nếu user đã có password (manual user), yêu cầu oldPassword
            if (user.password) {
                if (!oldPassword) {
                    return { success: false, message: 'Vui lòng nhập mật khẩu hiện tại' };
                }

                const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
                if (!isPasswordValid) {
                    return { success: false, message: 'Mật khẩu hiện tại không chính xác' };
                }
            }

            // Hash password mới
            const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

            await prisma.user.update({
                where: { id: userId },
                data: { password: hashedPassword },
            });

            return { success: true, message: 'Đổi mật khẩu thành công' };
        } catch (error) {
            logger.error('Change password error:', error);
            return { success: false, message: 'Đã xảy ra lỗi khi đổi mật khẩu' };
        }
    }

    /**
     * Helper: Map User model to UserDto (exclude password)
     */
    private mapUserToDto(user: User): UserDto {
        return {
            id: user.id,
            username: user.username,
            name: user.name,
            role: user.role,
            authProvider: user.authProvider,
            isFirstLogin: user.isFirstLogin ?? true, // Bất buộc đổi mật khẩu lần đầu
            phoneNumber: user.phoneNumber || undefined,
            dateOfBirth: user.dateOfBirth?.toISOString() || undefined,
            gender: user.gender || undefined,
            avatarUrl: user.avatarUrl || undefined,
            targetScore: user.targetScore || undefined,
            estimatedScore: user.estimatedScore || undefined,
            estimatedListening: user.estimatedListening || undefined,
            estimatedReading: user.estimatedReading || undefined,
            progress: user.progress || 0,
            hasPassword: !!user.password,
            createdAt: user.createdAt.toISOString(),
            totalTestsTaken: user.totalAttempts || 0,
            averageScore: user.averageScore || 0,
            classId: (user as any).studentClass?.id || undefined,
            className: (user as any).studentClass?.className || undefined,
            teacherName: (user as any).studentClass?.teacher?.name || undefined,
        };
    }

    /**
     * Thực hiện đổi mật khẩu lần đầu đăng nhập
     * Chỉ cho phép nếu isFirstLogin === true
     */
    async changeFirstPassword(userId: string, newPassword: string): Promise<ApiResponse> {
        try {
            const user = await prisma.user.findUnique({ where: { id: userId } });

            if (!user) {
                return { success: false, message: 'Người dùng không tồn tại' };
            }

            if (!user.isFirstLogin) {
                return { success: false, message: 'Tài khoản đã đổi mật khẩu. Vui lòng dùng chức năng Đổi mật khẩu thông thường.' };
            }

            if (!newPassword || newPassword.length < 8) {
                return { success: false, message: 'Mật khẩu mới phải có ít nhất 8 ký tự.' };
            }

            const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

            await prisma.user.update({
                where: { id: userId },
                data: {
                    password: hashedPassword,
                    isFirstLogin: false,
                } as any,
            });

            logger.info(`User ${userId} completed first-login password change.`);
            return { success: true, message: 'Đổi mật khẩu thành công. Chào mừng bạn đến với hệ thống!' };
        } catch (error) {
            logger.error('changeFirstPassword error:', error);
            return { success: false, message: 'Đã xảy ra lỗi khi đổi mật khẩu' };
        }
    }

    /**
     * Đổi mật khẩu chủ động (Voluntary Change Password)
     * Yêu cầu mật khẩu hiện tại
     */
    async updatePassword(userId: string, currentPassword: string, newPassword: string): Promise<ApiResponse> {
        try {
            const user = await prisma.user.findUnique({
                where: { id: userId },
            });

            if (!user) {
                return { success: false, message: 'Người dùng không tồn tại' };
            }

            // Kiểm tra mật khẩu hiện tại
            if (!user.password) {
                return { success: false, message: 'Tài khoản này chưa có mật khẩu (Đăng nhập Google). Không thể sử dụng tính năng này.' };
            }

            const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
            if (!isPasswordValid) {
                return { success: false, message: 'Mật khẩu hiện tại không chính xác' };
            }

            if (newPassword.length < 8) {
                return { success: false, message: 'Mật khẩu mới phải có ít nhất 8 ký tự.' };
            }

            // Hash password mới
            const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

            await prisma.user.update({
                where: { id: userId },
                data: {
                    password: hashedPassword,
                    isFirstLogin: false // Nếu chủ động đổi thì cũng coi như xong lần đầu
                } as any,
            });

            return { success: true, message: 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại.' };
        } catch (error) {
            logger.error('Update password error:', error);
            return { success: false, message: 'Đã xảy ra lỗi khi đổi mật khẩu' };
        }
    }
}

// Export singleton instance
export const authService = new AuthService();
