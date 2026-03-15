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
            email: true,
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
            email: data.email,
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
            email: true,
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
 * Tính toán điểm dự đoán TOEIC cho học viên
 */
export const calculateEstimatedScore = async (userId: string) => {
    // Chỉ tính cho role STUDENT
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true }
    });

    if (!user || user.role !== Role.STUDENT) return null;

    // 1. Lấy dữ liệu Listening (Part 1, 2, 3, 4)
    const listeningResults = await prisma.userPartProgress.findMany({
        where: {
            userId,
            part: {
                partNumber: { in: [1, 2, 3, 4] }
            }
        },
        include: { part: true }
    });

    // Gom nhóm theo partId để lấy kết quả tốt nhất/mới nhất cho mỗi part
    const bestListeningByPart: Record<string, { correct: number, total: number }> = {};
    listeningResults.forEach(res => {
        if (!bestListeningByPart[res.partId] || (res.score / res.totalQuestions) > (bestListeningByPart[res.partId].correct / bestListeningByPart[res.partId].total)) {
            bestListeningByPart[res.partId] = { correct: res.score, total: res.totalQuestions };
        }
    });

    let lCorrect = 0;
    let lTotal = 0;
    Object.values(bestListeningByPart).forEach(v => {
        lCorrect += v.correct;
        lTotal += v.total;
    });

    const lRatio = lTotal > 0 ? lCorrect / lTotal : 0;
    const estimatedL = getListeningScore(lRatio * 100);

    // 2. Lấy dữ liệu Reading (Part 5, 6, 7)
    const readingResults = await prisma.userPartProgress.findMany({
        where: {
            userId,
            part: {
                partNumber: { in: [5, 6, 7] }
            }
        },
        include: { part: true }
    });

    const bestReadingByPart: Record<string, { correct: number, total: number }> = {};
    readingResults.forEach(res => {
        if (!bestReadingByPart[res.partId] || (res.score / res.totalQuestions) > (bestReadingByPart[res.partId].correct / bestReadingByPart[res.partId].total)) {
            bestReadingByPart[res.partId] = { correct: res.score, total: res.totalQuestions };
        }
    });

    let rCorrect = 0;
    let rTotal = 0;
    Object.values(bestReadingByPart).forEach(v => {
        rCorrect += v.correct;
        rTotal += v.total;
    });

    const rRatio = rTotal > 0 ? rCorrect / rTotal : 0;
    const estimatedR = getReadingScore(rRatio * 100);

    const totalEstimated = estimatedL + estimatedR;

    // 3. Cập nhật vào User
    await prisma.user.update({
        where: { id: userId },
        data: {
            estimatedScore: totalEstimated,
            estimatedListening: estimatedL,
            estimatedReading: estimatedR
        } as any
    });

    return { totalEstimated, estimatedL, estimatedR };
};
