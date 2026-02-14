import { Router } from 'express';
import { body } from 'express-validator';
import { authController } from '../../controllers/auth/auth.controller';
import { validateRequest } from '../../middlewares/validate.middleware';
import { authMiddleware } from '../../middlewares/auth.middleware';

const router = Router();

/**
 * @route   POST /api/auth/login
 * @desc    Đăng nhập
 * @access  Public
 */
router.post(
    '/login',
    [
        body('email')
            .isEmail()
            .withMessage('Email không hợp lệ')
            .normalizeEmail(),
        body('password')
            .notEmpty()
            .withMessage('Password không được để trống')
            .isLength({ min: 6 })
            .withMessage('Password phải có ít nhất 6 ký tự'),
        validateRequest,
    ],
    authController.login.bind(authController)
);

/**
 * @route   POST /api/auth/register
 * @desc    Đăng ký tài khoản mới
 * @access  Public
 */
router.post(
    '/register',
    [
        body('name')
            .notEmpty()
            .withMessage('Tên không được để trống')
            .trim()
            .isLength({ min: 2 })
            .withMessage('Tên phải có ít nhất 2 ký tự'),
        body('email')
            .isEmail()
            .withMessage('Email không hợp lệ')
            .normalizeEmail(),
        body('password')
            .notEmpty()
            .withMessage('Password không được để trống')
            .isLength({ min: 6 })
            .withMessage('Password phải có ít nhất 6 ký tự'),
        validateRequest,
    ],
    authController.register.bind(authController)
);



/**
 * @route   POST /api/auth/google
 * @desc    Đăng nhập bằng Google
 * @access  Public
 */
router.post(
    '/google',
    [
        body('idToken')
            .notEmpty()
            .withMessage('Google ID Token là bắt buộc'),
        validateRequest,
    ],
    authController.googleLogin.bind(authController)
);

/**
 * @route   GET /api/auth/me
 * @desc    Lấy thông tin user hiện tại
 * @access  Private (cần token)
 */
router.get(
    '/me',
    authMiddleware,
    authController.getCurrentUser.bind(authController)
);

// ============================================
// PASSWORD RESET ROUTES
// ============================================

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Yêu cầu reset password - Gửi OTP qua email
 * @access  Public
 */
router.post(
    '/forgot-password',
    [
        body('email')
            .isEmail()
            .withMessage('Email không hợp lệ')
            .normalizeEmail(),
        validateRequest,
    ],
    authController.forgotPassword.bind(authController)
);

/**
 * @route   POST /api/auth/verify-reset-code
 * @desc    Xác thực OTP code (optional)
 * @access  Public
 */
router.post(
    '/verify-reset-code',
    [
        body('code')
            .notEmpty()
            .withMessage('Mã OTP không được để trống')
            .isLength({ min: 6, max: 6 })
            .withMessage('Mã OTP phải có 6 chữ số')
            .isNumeric()
            .withMessage('Mã OTP chỉ được chứa số'),
        validateRequest,
    ],
    authController.verifyResetCode.bind(authController)
);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password với OTP code
 * @access  Public
 */
router.post(
    '/reset-password',
    [
        body('code')
            .notEmpty()
            .withMessage('Mã OTP không được để trống')
            .isLength({ min: 6, max: 6 })
            .withMessage('Mã OTP phải có 6 chữ số')
            .isNumeric()
            .withMessage('Mã OTP chỉ được chứa số'),
        body('newPassword')
            .notEmpty()
            .withMessage('Mật khẩu mới không được để trống')
            .isLength({ min: 8 })
            .withMessage('Mật khẩu mới phải có ít nhất 8 ký tự'),
        validateRequest,
    ],
    authController.resetPassword.bind(authController)
);

/**
 * @route   PATCH /api/auth/change-password
 * @desc    Đổi mật khẩu (cần token)
 * @access  Private
 */
router.patch(
    '/change-password',
    authMiddleware,
    [
        body('newPassword')
            .notEmpty()
            .withMessage('Mật khẩu mới không được để trống')
            .isLength({ min: 8 })
            .withMessage('Mật khẩu mới phải có ít nhất 8 ký tự'),
        validateRequest,
    ],
    authController.changePassword.bind(authController)
);

export default router;
