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
 * Tính toán điểm TOEIC dự kiến dựa trên KỶ LỤC CÁ NHÂN (Best All-time Raw) của từng Part
 * Logic: Sum(Max_P1..P4) -> TOEIC_L | Sum(Max_P5..P7) -> TOEIC_R
 */
export const calculateEstimatedScore = async (userId: string) => {
    // Chỉ tính cho role STUDENT
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true }
    });

    if (!user || user.role !== Role.STUDENT) return null;

    // 1. Lấy kỷ lục (Hao nhất) của từng Part
    const bestScores = await prisma.userPartProgress.groupBy({
        by: ['partId'],
        where: { userId },
        _max: {
            score: true
        }
    });

    // 2. Fetch Part Numbers để phân loại Listening/Reading
    const partIds = bestScores.map(bs => bs.partId);
    const parts = await prisma.part.findMany({
        where: { id: { in: partIds } },
        select: { id: true, partNumber: true }
    });

    // Map PartID -> PartNumber
    const partNumMap: Record<string, number> = {};
    parts.forEach(p => partNumMap[p.id] = p.partNumber);

    // 3. Tính tổng câu đúng theo cụm (Max 100 mỗi cụm)
    let totalListeningRaw = 0; // P1, 2, 3, 4
    let totalReadingRaw = 0;    // P5, 6, 7

    bestScores.forEach(bs => {
        const pNum = partNumMap[bs.partId];
        const maxScore = bs._max.score || 0;

        if (pNum >= 1 && pNum <= 4) {
            totalListeningRaw += maxScore;
        } else if (pNum >= 5 && pNum <= 7) {
            totalReadingRaw += maxScore;
        }
    });

    // Giới hạn an toàn (Trường hợp dữ liệu rác > 100 câu)
    totalListeningRaw = Math.min(100, totalListeningRaw);
    totalReadingRaw = Math.min(100, totalReadingRaw);

    // 4. Quy đổi điểm TOEIC từ bảng chuẩn (Không scaling lẻ tẻ nữa)
    const estimatedL = getListeningScore(totalListeningRaw);
    const estimatedR = getReadingScore(totalReadingRaw);
    const totalEstimated = estimatedL + estimatedR;

    // 5. Cập nhật vào DB (User board)
    await prisma.user.update({
        where: { id: userId },
        data: {
            estimatedScore: totalEstimated,
            estimatedListening: estimatedL,
            estimatedReading: estimatedR,
            highestScore: { set: Math.max(0, totalEstimated) } // Cập nhật luôn kỷ lục tổng
        } as any
    });

    console.log(`[Score Upgrade] User ${userId}: Raw_L:${totalListeningRaw} -> ${estimatedL}, Raw_R:${totalReadingRaw} -> ${estimatedR}, Total:${totalEstimated}`);

    return { totalEstimated, estimatedL, estimatedR, totalListeningRaw, totalReadingRaw };
};
