import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Get all parts of a test
 * GET /api/tests/:testId/parts
 */
export const getPartsByTestId = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { testId } = req.params;
        const status = req.query.status as string;

        const role = (req as any).user?.role;
        const isAdminOrSpecialist = role === 'ADMIN' || role === 'SPECIALIST';

        const where: any = { testId };
        
        if (isAdminOrSpecialist) {
            if (status && status !== 'ALL') {
                where.status = status;
            }
            // Nếu không truyền status hoặc status === 'ALL', admin được xem tất cả (không filter status)
        } else {
            // Students only see ACTIVE
            where.status = 'ACTIVE';
        }

        const parts = await prisma.part.findMany({
            where,
            include: {
                _count: {
                    select: {
                        questions: true,
                    },
                },
            },
            orderBy: {
                partNumber: 'asc',
            },
        });

        // Add completedQuestions count
        const partsWithProgress = parts.map(part => ({
            ...part,
            completedQuestions: part._count.questions,
        }));

        res.status(200).json({
            success: true,
            parts: partsWithProgress,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get part by ID
 * GET /api/parts/:partId
 */
export const getPartById = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { partId } = req.params;

        const part = await prisma.part.findUnique({
            where: { id: partId },
        });

        if (!part) {
            res.status(404).json({
                success: false,
                message: 'Không tìm thấy Part',
            });
            return;
        }

        res.status(200).json({
            success: true,
            part,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Create new part
 * POST /api/tests/:testId/parts
 */
export const createPart = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { testId } = req.params;
        const { partNumber, partName, totalQuestions, instructions, instructionImgUrl, orderIndex, timeLimit } = req.body;

        // Validate totalQuestions
        const totalQuestionsNum = parseInt(totalQuestions);
        if (totalQuestionsNum <= 0) {
            res.status(400).json({
                success: false,
                message: 'Tổng số câu hỏi phải lớn hơn 0',
            });
            return;
        }

        // Check if part number already exists
        const existingPart = await prisma.part.findFirst({
            where: {
                testId,
                partNumber: parseInt(partNumber),
            },
        });

        if (existingPart) {
            res.status(400).json({
                success: false,
                message: `Part ${partNumber} đã tồn tại trong test này`,
            });
            return;
        }

        // Validate instructions for Reading Parts (5, 6, 7)
        const pNum = parseInt(partNumber);
        if ([5, 6, 7].includes(pNum)) {
            if (!instructions || instructions.trim() === '' || instructions === '<p><br></p>') {
                res.status(400).json({
                    success: false,
                    message: `Vui lòng nhập hướng dẫn (instructions) cho Part ${pNum}`,
                });
                return;
            }
        }

        const newPart = await prisma.part.create({
            data: {
                testId,
                partNumber: parseInt(partNumber),
                partName,
                totalQuestions: totalQuestionsNum,
                instructions: instructions || null,
                instructionImgUrl: instructionImgUrl || null,
                status: 'PENDING' as any, // Default to PENDING for new parts
                orderIndex: orderIndex !== undefined ? parseInt(orderIndex) : parseInt(partNumber),
                timeLimit: timeLimit ? parseInt(timeLimit) : null,
            },
        });

        res.status(201).json({
            success: true,
            message: 'Part được tạo thành công',
            part: newPart,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Update part
 * PATCH /api/parts/:partId
 */
export const updatePart = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { partId } = req.params;
        const { partNumber, partName, totalQuestions, instructions, instructionImgUrl, orderIndex, timeLimit } = req.body;

        // Validate totalQuestions if provided
        if (totalQuestions !== undefined) {
            const totalQuestionsNum = parseInt(totalQuestions);
            if (totalQuestionsNum <= 0) {
                res.status(400).json({
                    success: false,
                    message: 'Tổng số câu hỏi phải lớn hơn 0',
                });
                return;
            }
        }

        // Validate instructions for Reading Parts (5, 6, 7) if it's being updated or if we can determine the part number
        // We'll check the provided instructions against the part number (either provided in body or existing in DB)
        const currentPart = await prisma.part.findUnique({ where: { id: partId } });
        if (!currentPart) {
            res.status(404).json({ success: false, message: 'Không tìm thấy Part' });
            return;
        }

        const pNum = partNumber ? parseInt(partNumber) : currentPart.partNumber;
        if ([5, 6, 7].includes(pNum)) {
            // Only validate if instructions is provided in the body or if we're checking its existence
            const finalInstructions = instructions !== undefined ? instructions : currentPart.instructions;
            if (!finalInstructions || finalInstructions.trim() === '' || finalInstructions === '<p><br></p>') {
                res.status(400).json({
                    success: false,
                    message: `Part ${pNum} bắt buộc phải có hướng dẫn (instructions)`,
                });
                return;
            }
        }

        const updatedPart = await prisma.part.update({
            where: { id: partId },
            data: {
                partNumber: partNumber ? parseInt(partNumber) : undefined,
                partName,
                totalQuestions: totalQuestions ? parseInt(totalQuestions) : undefined,
                instructions: instructions !== undefined ? instructions : undefined,
                instructionImgUrl: instructionImgUrl !== undefined ? instructionImgUrl : undefined,
                orderIndex: orderIndex !== undefined ? parseInt(orderIndex) : undefined,
                timeLimit: timeLimit !== undefined ? (timeLimit ? parseInt(timeLimit) : null) : undefined,
                audioUrl: req.body.audioUrl, // Add audioUrl support
            },
        });

        res.status(200).json({
            success: true,
            message: 'Part được cập nhật thành công',
            part: updatedPart,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Delete part
 * DELETE /api/parts/:partId
 */
export const deletePart = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { partId } = req.params;
        const user = (req as any).user;

        if (user.role !== 'ADMIN') {
            res.status(403).json({
                success: false,
                message: 'Chỉ ADMIN mới có quyền xóa phần thi.',
            });
            return;
        }

        // Check if part has questions
        const part = await prisma.part.findUnique({
            where: { id: partId },
            include: {
                _count: {
                    select: {
                        questions: true,
                    },
                },
            },
        });

        if (!part) {
            res.status(404).json({
                success: false,
                message: 'Không tìm thấy Part',
            });
            return;
        }

        if (part._count.questions > 0) {
            res.status(400).json({
                success: false,
                message: `Không thể xóa Part vì còn ${part._count.questions} câu hỏi. Vui lòng xóa câu hỏi trước.`,
            });
            return;
        }

        await prisma.part.delete({
            where: { id: partId },
        });

        // Cleanup Cloudinary assets
        const { cleanupCloudinaryAssets } = await import('../config/cloudinary.config');
        cleanupCloudinaryAssets(part.instructionImgUrl);
        cleanupCloudinaryAssets(part.audioUrl);

        res.status(200).json({
            success: true,
            message: 'Part đã được xóa thành công',
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Approve a part (ADMIN only)
 * Cascades to all questions and checks if test should be auto-published
 * PATCH /api/parts/:partId/approve
 */
export const approvePart = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { partId } = req.params;
        const user = (req as any).user;

        if (user.role !== 'ADMIN') {
            res.status(403).json({
                success: false,
                message: 'Chào bạn, chỉ ADMIN mới có quyền duyệt phần thi. Vui lòng liên hệ quản trị viên.',
            });
            return;
        }

        // 1. Get Part info including testId
        const part = await prisma.part.findUnique({
            where: { id: partId },
            select: { id: true, testId: true, partName: true }
        });

        if (!part) {
            res.status(404).json({ success: false, message: 'Không tìm thấy Part' });
            return;
        }

        // 2. Execute atomic approval
        await prisma.$transaction(async (tx) => {
            // A. Update Part status and reset rejectReason
            await tx.part.update({
                where: { id: partId },
                data: { 
                    status: 'ACTIVE' as any,
                    rejectReason: null
                },
            });

            // B. Cascade to all Questions in this part
            await (tx.question as any).updateMany({
                where: { partId },
                data: { status: 'ACTIVE' as any },
            });

            // C. Auto-publish Test Check: If ALL parts of this test are ACTIVE, set Test to ACTIVE
            const allParts = await tx.part.findMany({
                where: { testId: part.testId },
                select: { id: true, status: true }
            });

            const remainingPending = allParts.filter(p => p.id !== partId && p.status !== 'ACTIVE');
            
            if (remainingPending.length === 0) {
                await tx.test.update({
                    where: { id: part.testId },
                    data: { status: 'ACTIVE' as any }
                });
            }
        });

        res.status(200).json({
            success: true,
            message: `Đã duyệt thành công "${part.partName}"!`,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Reject a part (ADMIN only)
 * PATCH /api/parts/:partId/reject
 */
export const rejectPart = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { partId } = req.params;
        const { reason } = req.body;
        const user = (req as any).user;

        if (user.role !== 'ADMIN') {
            res.status(403).json({ success: false, message: 'Chỉ ADMIN mới có quyền từ chối phần thi.' });
            return;
        }

        if (!reason || reason.trim() === '') {
            res.status(400).json({ success: false, message: 'Vui lòng cung cấp lý do từ chối.' });
            return;
        }

        const updatedPart = await prisma.part.update({
            where: { id: partId },
            data: { 
                status: 'REJECTED' as any,
                rejectReason: reason
            },
        });

        res.status(200).json({
            success: true,
            message: 'Đã từ chối phần thi và gửi yêu cầu sửa đổi cho chuyên viên.',
            part: updatedPart,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Toggle part lock status (ACTIVE <-> LOCKED)
 * PATCH /api/parts/:partId/toggle-lock
 */
export const togglePartLock = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { partId } = req.params;
        const user = (req as any).user;

        if (user.role !== 'ADMIN') {
            res.status(403).json({
                success: false,
                message: 'Chỉ ADMIN mới có quyền Khóa/Mở khóa phần thi.',
            });
            return;
        }

        const part = await prisma.part.findUnique({
            where: { id: partId },
        });

        if (!part) {
            res.status(404).json({ success: false, message: 'Không tìm thấy Part' });
            return;
        }

        if ((part.status as any) === 'PENDING' || (part.status as any) === 'REJECTED') {
            res.status(400).json({ 
                success: false, 
                message: 'Phần thi đang chờ duyệt hoặc bị từ chối, vui lòng phê duyệt lần đầu trước khi thay đổi trạng thái khóa.' 
            });
            return;
        }

        const newStatus = part.status === 'ACTIVE' ? 'LOCKED' : 'ACTIVE';

        const updatedPart = await prisma.part.update({
            where: { id: partId },
            data: { status: newStatus as any },
        });

        res.status(200).json({
            success: true,
            message: `Đã ${newStatus === 'ACTIVE' ? 'mở khóa' : 'khóa'} phần thi thành công`,
            part: updatedPart,
        });
    } catch (error) {
        next(error);
    }
};
