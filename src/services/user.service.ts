import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Lấy danh sách tất cả người dùng với phân trang và tìm kiếm
 */
export const getAllUsers = async (
    page: number = 1,
    limit: number = 10,
    search?: string,
    role?: Role
) => {
    const skip = (page - 1) * limit;

    // Xây dựng điều kiện tìm kiếm
    const where: any = {};

    if (search) {
        where.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
        ];
    }

    if (role) {
        where.role = role;
    }

    // Lấy tổng số users và danh sách users
    const [total, users] = await Promise.all([
        prisma.user.count({ where }),
        prisma.user.findMany({
            where,
            skip,
            take: limit,
            select: {
                id: true,
                email: true,
                name: true,
                phoneNumber: true,
                dateOfBirth: true,
                gender: true,
                avatarUrl: true,
                role: true,
                toeicLevel: true,
                targetScore: true,
                createdAt: true,
                updatedAt: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
        }),
    ]);

    return {
        users,
        pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        },
    };
};

/**
 * Lấy thông tin chi tiết của 1 user
 */
export const getUserById = async (id: string) => {
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
            toeicLevel: true,
            targetScore: true,
            createdAt: true,
            updatedAt: true,
        },
    });

    return user;
};

/**
 * Cập nhật thông tin user
 */
export const updateUser = async (id: string, data: any) => {
    const updatedUser = await prisma.user.update({
        where: { id },
        data: {
            name: data.name,
            email: data.email,
            phoneNumber: data.phoneNumber,
            dateOfBirth: data.dateOfBirth,
            gender: data.gender,
            avatarUrl: data.avatarUrl,
            role: data.role,
            toeicLevel: data.toeicLevel,
            targetScore: data.targetScore,
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
            toeicLevel: true,
            targetScore: true,
            createdAt: true,
            updatedAt: true,
        },
    });

    return updatedUser;
};

