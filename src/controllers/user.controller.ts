import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
// Bypass IDE stale property checks
const p = prisma as any;

/**
 * Upload user avatar
 * POST /api/users/avatar
 */
export const uploadUserAvatar = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const userId = req.user?.id;

        if (!userId) {
            res.status(401).json({
                success: false,
                message: 'Unauthorized',
            });
            return;
        }

        if (!req.file) {
            res.status(400).json({
                success: false,
                message: 'No file uploaded',
            });
            return;
        }

        // Get user's old avatar URL to delete from Cloudinary
        const user = await p.user.findUnique({
            where: { id: userId },
            select: { avatarUrl: true },
        });

        // Upload to Cloudinary
        const { uploadToCloudinary, deleteFromCloudinary, extractPublicId } = await import('../config/cloudinary.config');

        const uploadResult = await uploadToCloudinary(
            req.file.buffer,
            'toeic_practice/avatars'
        );

        const avatarUrl = uploadResult.secure_url;

        // Update user's avatar in database
        const updatedUser = await p.user.update({
            where: { id: userId },
            data: { avatarUrl },
            select: {
                id: true,
                username: true,
                name: true,
                email: true,
                phoneNumber: true,
                dateOfBirth: true,
                gender: true,
                avatarUrl: true,
                role: true,
                progress: true,
                targetScore: true,
                estimatedListening: true,
                estimatedReading: true,
                estimatedScore: true,
                totalAttempts: true,
                averageScore: true,
                highestScore: true,
                authProvider: true,
                status: true,
                createdAt: true,
                updatedAt: true,
                password: true,
            },
        });

        // Map to UserDto
        const userResponse = {
            ...updatedUser,
            hasPassword: !!(updatedUser as any).password,
        };
        delete (userResponse as any).password;

        // Delete old avatar from Cloudinary if exists
        if (user?.avatarUrl) {
            try {
                const publicId = extractPublicId(user.avatarUrl);
                if (publicId) {
                    await deleteFromCloudinary(publicId);
                }
            } catch (deleteError) {
                console.error('Error deleting old avatar:', deleteError);
                // Continue even if deletion fails
            }
        }

        res.status(200).json({
            success: true,
            message: 'Avatar uploaded successfully',
            user: updatedUser,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get all users
 * GET /api/users
 */
export const getUsers = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const role = req.query.role as string;
        const search = req.query.search as string;

        const skip = (page - 1) * limit;

        // Build filtering criteria
        const where: any = {};

        if (role && role !== 'ALL') {
            where.role = role;
        }

        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { username: { contains: search, mode: 'insensitive' } },
                { phoneNumber: { contains: search, mode: 'insensitive' } },
            ];
        }

        // Get total count for pagination
        const total = await p.user.count({ where });

        // Get users with pagination
        const users = await p.user.findMany({
            where,
            select: {
                id: true,
                username: true,
                name: true,
                email: true,
                phoneNumber: true,
                dateOfBirth: true,
                gender: true,
                avatarUrl: true,
                role: true,
                progress: true,
                targetScore: true,
                estimatedListening: true,
                estimatedReading: true,
                estimatedScore: true,
                totalAttempts: true,
                averageScore: true,
                highestScore: true,
                authProvider: true,
                status: true,
                createdAt: true,
                updatedAt: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
            skip,
            take: limit,
        });

        res.status(200).json({
            success: true,
            users,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get user by ID
 * GET /api/users/:id
 */
export const getUserById = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;

        const user = await p.user.findUnique({
            where: { id },
            select: {
                id: true,
                username: true,
                name: true,
                email: true,
                phoneNumber: true,
                dateOfBirth: true,
                gender: true,
                avatarUrl: true,
                role: true,
                progress: true,
                targetScore: true,
                estimatedListening: true,
                estimatedReading: true,
                estimatedScore: true,
                totalAttempts: true,
                averageScore: true,
                highestScore: true,
                authProvider: true,
                status: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        if (!user) {
            res.status(404).json({
                success: false,
                message: 'User not found',
            });
            return;
        }

        res.status(200).json({
            success: true,
            user,
        });
    } catch (error) {
        next(error);
    }
};


/**
 * Update current user profile
 * PATCH /api/users/me
 */
export const updateProfile = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const userId = req.user?.id;
        // Strict destructuring - ONLY allow these fields as per security requirement
        // name, email, phoneNumber, dateOfBirth, avatarUrl
        const { name, email, phoneNumber, dateOfBirth, avatarUrl, allowAiPushNotification } = req.body;

        if (!userId) {
            res.status(401).json({
                success: false,
                message: 'Unauthorized',
            });
            return;
        }

        const updatedUser = await p.user.update({
            where: { id: userId },
            data: {
                name: name || undefined,
                email: email || undefined,
                phoneNumber: phoneNumber || undefined,
                dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
                avatarUrl: typeof avatarUrl === 'string' ? avatarUrl : undefined,
                allowAiPushNotification: typeof allowAiPushNotification === 'boolean' ? allowAiPushNotification : undefined,
            },
            select: {
                id: true,
                username: true,
                name: true,
                email: true,
                phoneNumber: true,
                dateOfBirth: true,
                gender: true,
                avatarUrl: true,
                role: true,
                progress: true,
                targetScore: true,
                estimatedListening: true,
                estimatedReading: true,
                estimatedScore: true,
                authProvider: true,
                status: true,
                createdAt: true,
                updatedAt: true,
                password: true,
            },
        });

        const userResponse = {
            ...updatedUser,
            hasPassword: !!(updatedUser as any).password,
        };
        delete (userResponse as any).password;

        res.status(200).json({
            success: true,
            message: 'Cập nhật thông tin thành công',
            user: userResponse,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Update user by ID
 * PATCH /api/users/:id
 */
export const updateUserById = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const { name, username, email, phoneNumber, dateOfBirth, gender, avatarUrl, role, targetScore, allowAiPushNotification } = req.body;

        // Clean avatarUrl: ensure it is a string, ignore if it is an object
        const cleanAvatarUrl = typeof avatarUrl === 'string' ? avatarUrl : (avatarUrl === null ? null : undefined);

        const updatedUser = await p.user.update({
            where: { id },
            data: {
                name,
                username: username || undefined,
                email: email || undefined,
                phoneNumber,
                dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
                gender,
                avatarUrl: cleanAvatarUrl,
                role,
                targetScore: (targetScore && !isNaN(parseInt(targetScore.toString()))) ? parseInt(targetScore.toString()) : undefined,
                allowAiPushNotification: typeof allowAiPushNotification === 'boolean' ? allowAiPushNotification : undefined,
            },
            select: {
                id: true,
                username: true,
                name: true,
                email: true,
                phoneNumber: true,
                dateOfBirth: true,
                gender: true,
                avatarUrl: true,
                role: true,
                progress: true,
                targetScore: true,
                estimatedListening: true,
                estimatedReading: true,
                estimatedScore: true,
                authProvider: true,
                status: true,
                createdAt: true,
                updatedAt: true,
                password: true,
            },
        });

        const userResponse = {
            ...updatedUser,
            hasPassword: !!(updatedUser as any).password,
        };
        delete (userResponse as any).password;

        res.status(200).json({
            success: true,
            message: 'User updated successfully',
            user: userResponse,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Update user's TOEIC level
 * PATCH /api/users/level
 */
// updateUserLevel endpoint removed

/**
 * Create new user (Admin only)
 * POST /api/users
 */
export const createUser = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { name, username, email, password, phoneNumber, dateOfBirth, gender, avatarUrl, role, targetScore } = req.body;

        if (!username) {
            res.status(400).json({
                success: false,
                message: 'Mã người dùng (username) là bắt buộc',
            });
            return;
        }

        // Clean avatarUrl: ensure it is a string, ignore if it is an object
        const cleanAvatarUrl = typeof avatarUrl === 'string' ? avatarUrl : null;

        // Check if username already exists
        const existingUser = await p.user.findUnique({
            where: { username },
        });

        if (existingUser) {
            res.status(400).json({
                success: false,
                message: 'Mã người dùng đã được sử dụng',
            });
            return;
        }

        // Hash password
        const bcrypt = await import('bcrypt');
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const newUser = await p.user.create({
            data: {
                name,
                username,
                email,
                password: hashedPassword,
                phoneNumber,
                dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
                gender,
                avatarUrl: cleanAvatarUrl,
                role: role || 'STUDENT',
                targetScore: (targetScore && !isNaN(parseInt(targetScore.toString()))) ? parseInt(targetScore.toString()) : null,
            },
            select: {
                id: true,
                username: true,
                name: true,
                email: true,
                phoneNumber: true,
                dateOfBirth: true,
                gender: true,
                avatarUrl: true,
                role: true,
                progress: true,
                targetScore: true,
                estimatedListening: true,
                estimatedReading: true,
                estimatedScore: true,
                totalAttempts: true,
                averageScore: true,
                highestScore: true,
                authProvider: true,
                status: true,
                createdAt: true,
                updatedAt: true,
                password: true,
            },
        });

        const userResponse = {
            ...newUser,
            hasPassword: !!(newUser as any).password,
        };
        delete (userResponse as any).password;

        res.status(201).json({
            success: true,
            message: 'Tạo user thành công',
            user: userResponse,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Toggle user account status (ACTIVE/LOCKED)
 * PATCH /api/users/:id/status
 */
export const toggleUserStatus = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!['ACTIVE', 'LOCKED'].includes(status)) {
            res.status(400).json({
                success: false,
                message: 'Trạng thái không hợp lệ',
            });
            return;
        }

        await p.user.update({
            where: { id },
            data: { status: status as any },
        });

        res.status(200).json({
            success: true,
            message: `Tài khoản đã được ${status === 'ACTIVE' ? 'mở khóa' : 'khóa'} thành công`,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get Leaderboard (Top Students)
 * GET /api/users/leaderboard
 */
export const getLeaderboard = async (
    _req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const topStudents = await p.user.findMany({
            where: {
                role: 'STUDENT',
                status: 'ACTIVE',
                estimatedScore: { not: null }
            },
            select: {
                id: true,
                username: true,
                name: true,
                avatarUrl: true,
                estimatedScore: true,
                estimatedListening: true,
                estimatedReading: true,
                progress: true,
                createdAt: true
            },
            orderBy: {
                estimatedScore: 'desc'
            },
            take: 20
        });

        res.status(200).json({
            success: true,
            data: topStudents
        });
    } catch (error) {
        next(error);
    }
};
