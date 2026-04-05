import { PrismaClient, Role } from '@prisma/client';
import { getListeningScore, getReadingScore } from '../utils/score.util';

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
            { username: { contains: search, mode: 'insensitive' } },
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
                username: true,
                name: true,
                phoneNumber: true,
                dateOfBirth: true,
                avatarUrl: true,
                role: true,
                progress: true,
                targetScore: true,
                estimatedScore: true,
                estimatedListening: true,
                estimatedReading: true,
                createdAt: true,
                updatedAt: true,
            } as any,
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
            username: true,
            name: true,
            phoneNumber: true,
            avatarUrl: true,
            role: true,
            progress: true,
            targetScore: true,
            estimatedScore: true,
            estimatedListening: true,
            estimatedReading: true,
            createdAt: true,
            updatedAt: true,
        } as any,
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
            username: data.username,
            phoneNumber: data.phoneNumber,
            dateOfBirth: data.dateOfBirth,
            gender: data.gender,
            avatarUrl: data.avatarUrl,
            role: data.role,
            progress: data.progress,
            targetScore: data.targetScore,
        },
        select: {
            id: true,
            username: true,
            name: true,
            phoneNumber: true,
            dateOfBirth: true,
            gender: true,
            avatarUrl: true,
            role: true,
            progress: true,
            targetScore: true,
            estimatedScore: true,
            estimatedListening: true,
            estimatedReading: true,
            createdAt: true,
            updatedAt: true,
        } as any,
    });

    return updatedUser;
};


/**
 * Tính toán điểm TOEIC dự kiến dựa trên thành tích TỐT NHẤT (All-time Best) của từng Part
 */
export const calculateEstimatedScore = async (userId: string) => {
    // Chỉ tính cho role STUDENT
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true }
    });

    if (!user || user.role !== Role.STUDENT) return null;

    // 1. Lấy tất cả kết quả làm bài từ trước đến nay của user
    const results = await prisma.userPartProgress.findMany({
        where: { userId },
        include: { part: true }
    });

    // 2. Tìm điểm số CAO NHẤT cho từng Part
    const bestScoreByPart: Record<number, number> = {};
    results.forEach(res => {
        const pNum = res.part.partNumber;
        if (pNum >= 1 && pNum <= 7) {
            bestScoreByPart[pNum] = Math.max(bestScoreByPart[pNum] || 0, res.score);
        }
    });

    // 3. Tổng hợp số câu đúng cao nhất theo kỹ năng
    let totalListeningCorrect = 0; // Tổng Part 1, 2, 3, 4 (Tối đa 100)
    let totalReadingCorrect = 0;   // Tổng Part 5, 6, 7 (Tối đa 100)

    for (let i = 1; i <= 4; i++) {
        totalListeningCorrect += bestScoreByPart[i] || 0;
    }
    for (let i = 5; i <= 7; i++) {
        totalReadingCorrect += bestScoreByPart[i] || 0;
    }

    // Giới hạn an toàn 100 câu mỗi mảng
    totalListeningCorrect = Math.min(100, totalListeningCorrect);
    totalReadingCorrect = Math.min(100, totalReadingCorrect);

    // 4. Quy đổi điểm TOEIC từ bảng chuẩn (Không cần đợi đủ bộ)
    const estimatedL = getListeningScore(totalListeningCorrect);
    const estimatedR = getReadingScore(totalReadingCorrect);
    const totalEstimated = estimatedL + estimatedR;

    // 5. Cập nhật vào DB
    await prisma.user.update({
        where: { id: userId },
        data: {
            estimatedScore: totalEstimated,
            estimatedListening: estimatedL,
            estimatedReading: estimatedR
        } as any
    });

    console.log(`[Leaderboard Update] User ${userId}: L:${estimatedL} (Total:${totalListeningCorrect}), R:${estimatedR} (Total:${totalReadingCorrect}), Rank Score:${totalEstimated}`);

    return { totalEstimated, estimatedL, estimatedR, totalListeningCorrect, totalReadingCorrect };
};
