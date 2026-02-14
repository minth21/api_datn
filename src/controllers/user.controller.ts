import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
        const user = await prisma.user.findUnique({
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
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: { avatarUrl },
            select: {
                id: true,
                email: true,
                name: true,
                phoneNumber: true,
                dateOfBirth: true,
                gender: true,
                avatarUrl: true,
                role: true,
                progress: true,
                targetScore: true,
                createdAt: true,
                updatedAt: true,
                password: true,
            },
        });

        // Map to UserDto
        const userResponse = {
            ...updatedUser,
            hasPassword: !!updatedUser.password,
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
                { email: { contains: search, mode: 'insensitive' } },
                { phoneNumber: { contains: search, mode: 'insensitive' } },
            ];
        }

        // Get total count for pagination
        const total = await prisma.user.count({ where });

        // Get users with pagination
        const users = await prisma.user.findMany({
            where,
            select: {
                id: true,
                email: true,
                name: true,
                phoneNumber: true,
                dateOfBirth: true,
                gender: true,
                avatarUrl: true,
                role: true,
                progress: true,
                targetScore: true,
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

        const user = await prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                email: true,
                name: true,
                phoneNumber: true,
                dateOfBirth: true,
                gender: true,
                avatarUrl: true,
                role: true,
                progress: true,
                targetScore: true,
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
        const { name, phoneNumber, dateOfBirth, gender, targetScore } = req.body;

        if (!userId) {
            res.status(401).json({
                success: false,
                message: 'Unauthorized',
            });
            return;
        }

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: {
                name,
                phoneNumber,
                dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
                gender,
                targetScore: targetScore ? parseInt(targetScore.toString()) : undefined,
            },
            select: {
                id: true,
                email: true,
                name: true,
                phoneNumber: true,
                dateOfBirth: true,
                gender: true,
                avatarUrl: true,
                role: true,
                progress: true,
                targetScore: true,
                createdAt: true,
                updatedAt: true,
                password: true,
            },
        });

        const userResponse = {
            ...updatedUser,
            hasPassword: !!updatedUser.password,
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
        const { name, email, phoneNumber, dateOfBirth, gender, avatarUrl, role, targetScore } = req.body;

        const updatedUser = await prisma.user.update({
            where: { id },
            data: {
                name,
                email,
                phoneNumber,
                dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
                gender,
                avatarUrl,
                role,
                // cefrLevel removed
                targetScore,
            },
            select: {
                id: true,
                email: true,
                name: true,
                phoneNumber: true,
                dateOfBirth: true,
                gender: true,
                avatarUrl: true,
                role: true,
                progress: true,
                targetScore: true,
                createdAt: true,
                updatedAt: true,
                password: true,
            },
        });

        const userResponse = {
            ...updatedUser,
            hasPassword: !!updatedUser.password,
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
        const { name, email, password, phoneNumber, dateOfBirth, gender, role, targetScore } = req.body;

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            res.status(400).json({
                success: false,
                message: 'Email đã được sử dụng',
            });
            return;
        }

        // Hash password
        const bcrypt = await import('bcrypt');
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const newUser = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                phoneNumber,
                dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
                gender,
                role: role || 'STUDENT', // Default to STUDENT if not provided
                // cefrLevel removed
                targetScore: targetScore ? parseInt(targetScore) : null,
            },
            select: {
                id: true,
                email: true,
                name: true,
                phoneNumber: true,
                dateOfBirth: true,
                gender: true,
                avatarUrl: true,
                role: true,
                progress: true,
                targetScore: true,
                createdAt: true,
                updatedAt: true,
                password: true,
            },
        });

        const userResponse = {
            ...newUser,
            hasPassword: !!newUser.password,
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
