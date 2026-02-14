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
import { emailService } from '../email/email.service';

const SALT_ROUNDS = 10;

/**
 * Auth Service - Xử lý business logic cho authentication với PostgreSQL
 */
export class AuthService {
    /**
     * Đăng nhập với email và password
     */
    async login(loginDto: LoginDto): Promise<LoginResponseDto> {
        const { email, password } = loginDto;

        logger.info(`Login attempt for email: ${email}`);

        try {
            // Tìm user trong database
            const user = await prisma.user.findUnique({
                where: { email },
            });

            if (!user) {
                logger.warn(`Login failed: User not found - ${email}`);
                return {
                    success: false,
                    message: ERROR_MESSAGES.INVALID_CREDENTIALS,
                };
            }

            // Verify password
            const isPasswordValid = await bcrypt.compare(password, user.password);

            if (!isPasswordValid) {
                logger.warn(`Login failed: Invalid password - ${email}`);
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
                email: user.email,
                role: user.role,
            });

            logger.info(`Login successful for user: ${user.email}`);

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
    async register(registerDto: RegisterDto): Promise<LoginResponseDto> {
        const { name, email, password, phoneNumber, dateOfBirth, gender } = registerDto;

        logger.info(`Register attempt for email: ${email}`);

        try {
            // Kiểm tra email đã tồn tại chưa
            const existingUser = await prisma.user.findUnique({
                where: { email },
            });

            if (existingUser) {
                logger.warn(`Registration failed: Email already exists - ${email}`);
                return {
                    success: false,
                    message: 'Email đã được sử dụng',
                };
            }

            // Hash password
            const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

            // Tạo user mới trong database
            const newUser = await prisma.user.create({
                data: {
                    email,
                    password: hashedPassword,
                    name,
                    phoneNumber,
                    dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
                    gender: gender as any, // Cast to Gender enum if provided
                    role: 'STUDENT',
                    // cefrLevel removed
                },
            });

            // Tạo UserDto (loại bỏ password)
            const userDto: UserDto = this.mapUserToDto(newUser);

            // Generate JWT token
            const token = generateToken({
                userId: newUser.id,
                email: newUser.email,
                role: newUser.role,
            });

            logger.info(`Registration successful for user: ${newUser.email}`);

            return {
                success: true,
                message: 'Đăng ký thành công!',
                user: userDto,
                token,
            };
        } catch (error) {
            logger.error('Registration error:', error);
            return {
                success: false,
                message: 'Đã xảy ra lỗi khi đăng ký',
            };
        }
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

            // Get user from database
            const user = await prisma.user.findUnique({
                where: { id: decoded.userId },
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

    /**
     * Yêu cầu reset password - Gửi OTP qua email
     */
    async requestPasswordReset(email: string): Promise<PasswordResetResponseDto> {
        logger.info(`Password reset requested for email: ${email}`);

        try {
            // Tìm user theo email
            const user = await prisma.user.findUnique({
                where: { email },
            });

            // Không tiết lộ thông tin email có tồn tại hay không (security best practice)
            if (!user) {
                logger.warn(`Password reset requested for non-existent email: ${email}`);
                // Vẫn trả về success để tránh email enumeration
                return {
                    success: true,
                    message: 'Nếu email tồn tại trong hệ thống, bạn sẽ nhận được mã OTP trong vòng vài phút.',
                };
            }

            // Tạo mã OTP 6 số ngẫu nhiên
            const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

            // Tính thời gian hết hạn (15 phút)
            const expiresAt = new Date();
            expiresAt.setMinutes(expiresAt.getMinutes() + 15);

            // Lưu OTP vào database
            await prisma.passwordResetToken.create({
                data: {
                    userId: user.id,
                    code: otpCode,
                    expiresAt,
                    used: false,
                },
            });

            // Gửi email chứa OTP
            const emailSent = await emailService.sendPasswordResetEmail(
                user.email,
                otpCode,
                user.name
            );

            if (!emailSent) {
                logger.error(`Failed to send password reset email to ${email}`);
                return {
                    success: false,
                    message: 'Không thể gửi email. Vui lòng thử lại sau.',
                };
            }

            logger.info(`Password reset OTP sent successfully to ${email}`);

            return {
                success: true,
                message: 'Mã OTP đã được gửi đến email của bạn. Vui lòng kiểm tra hộp thư.',
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

            logger.info(`Password reset successful for user: ${resetToken.user.email}`);

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

            let user = await prisma.user.findUnique({
                where: { email },
            });

            if (!user) {
                logger.info(`Creating new user from Google Login: ${email}`);
                user = await prisma.user.create({
                    data: {
                        email,
                        name: name || 'Google User',
                        avatarUrl: picture,
                        // @ts-ignore - Prisma client types might be stale due to EPERM during generation
                        password: null, // Explicitly set to null for Google auth
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

            const token = generateToken({
                userId: user.id,
                email: user.email,
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
            email: user.email,
            name: user.name,
            role: user.role,
            phoneNumber: user.phoneNumber || undefined,
            dateOfBirth: user.dateOfBirth?.toISOString() || undefined,
            gender: user.gender || undefined,
            avatarUrl: user.avatarUrl || undefined,
            targetScore: user.targetScore || undefined,
            progress: user.progress || 0,
            hasPassword: !!user.password,
            createdAt: user.createdAt.toISOString(),
            // Default values for now (will be updated when we add test results)
            totalTestsTaken: 0,
            averageScore: 0,
        };
    }
}

// Export singleton instance
export const authService = new AuthService();
