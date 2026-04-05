import { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { errorResponse, successResponse } from '../utils/response';
import { HTTP_STATUS } from '../config/constants';
import { logger } from '../utils/logger';
import ExcelJS from 'exceljs';

// Bypass IDE stale property checks for Prisma models
const p = prisma as any;

import { ClassManagementService } from '../services/class-management.service';

const classManagementService = new ClassManagementService();

/**
 * Class Controller - Quản lý lớp học dành cho Admin và Giáo viên
 */
export class ClassController {
    /**
     * Lấy tất cả lớp học (Dành cho Admin/Specialist)
     * GET /api/classes
     */
    async getAllClasses(_req: Request, res: Response) {
        try {
            const classes = await p.class.findMany({
                include: {
                    teacher: {
                        select: {
                            id: true,
                            name: true,
                            username: true,
                            avatarUrl: true,
                        }
                    },
                    _count: {
                        select: { students: true }
                    }
                },
                orderBy: { createdAt: 'desc' }
            });

            return successResponse(res, classes.map((c: any) => ({
                id: c.id,
                classCode: c.classCode,
                className: c.className,
                description: c.description,
                teacher: c.teacher,
                studentCount: c._count.students,
                status: c.status,
                createdAt: c.createdAt
            })), 'Tải danh sách lớp học thành công');
        } catch (error) {
            logger.error('Error in getAllClasses:', error);
            return errorResponse(res, 'Lỗi khi tải danh sách lớp học');
        }
    }

    /**
     * Tạo lớp học mới
     * POST /api/classes
     */
    async createClass(req: Request, res: Response) {
        try {
            const { className, classCode, description, teacherId } = req.body;

            if (!className || !teacherId) {
                return errorResponse(res, 'Tên lớp và giáo viên là bắt buộc', HTTP_STATUS.BAD_REQUEST);
            }

            // Kiểm tra classCode trùng (nếu có nhập)
            if (classCode) {
                const existingClass = await p.class.findUnique({ where: { classCode } });
                if (existingClass) {
                    return errorResponse(res, 'Mã lớp đã tồn tại', HTTP_STATUS.BAD_REQUEST);
                }
            }

            const newClass = await p.class.create({
                data: {
                    className,
                    classCode: classCode || `C${Math.floor(Date.now() / 1000)}`, // Auto-gen if empty
                    description,
                    teacherId
                },
                include: {
                    teacher: {
                        select: { name: true, username: true, avatarUrl: true }
                    }
                }
            });

            logger.info(`Class created: ${newClass.className} by ${ (req as any).user.username}`);
            return successResponse(res, newClass, 'Tạo lớp học thành công', HTTP_STATUS.CREATED);
        } catch (error) {
            logger.error('Error in createClass:', error);
            return errorResponse(res, 'Lỗi khi tạo lớp học');
        }
    }

    /**
     * Cập nhật thông tin lớp học
     * PUT /api/classes/:classId
     */
    async updateClass(req: Request, res: Response) {
        try {
            const { classId } = req.params;
            const { className, classCode, description, teacherId } = req.body;

            const updatedClass = await p.class.update({
                where: { id: classId },
                data: {
                    className,
                    classCode,
                    description,
                    teacherId
                },
                include: {
                    teacher: {
                        select: { name: true, username: true, avatarUrl: true }
                    }
                }
            });

            logger.info(`Class updated: ${updatedClass.id} by ${ (req as any).user.username}`);
            return successResponse(res, updatedClass, 'Cập nhật lớp học thành công');
        } catch (error) {
            logger.error('Error in updateClass:', error);
            return errorResponse(res, 'Lỗi khi cập nhật lớp học');
        }
    }

    /**
     * Xóa lớp học
     * DELETE /api/classes/:classId
     */
    async deleteClass(req: Request, res: Response) {
        try {
            const { classId } = req.params;

            // Kiểm tra sĩ số trước khi xóa
            const studentCount = await p.user.count({
                where: { studentClassId: classId }
            });

            if (studentCount > 0) {
                return errorResponse(res, 'Không thể xóa lớp đang có học viên. Vui lòng chuyển học viên sang lớp khác trước.', HTTP_STATUS.BAD_REQUEST);
            }

            await p.class.delete({
                where: { id: classId }
            });

            logger.info(`Class deleted: ${classId} by ${ (req as any).user.username}`);
            return successResponse(res, null, 'Xóa lớp học thành công');
        } catch (error) {
            logger.error('Error in deleteClass:', error);
            return errorResponse(res, 'Lỗi khi xóa lớp học');
        }
    }

    /**
     * Lấy danh sách lớp học của giáo viên hiện tại
     * GET /api/classes/my-classes
     */
    async getMyClasses(req: Request, res: Response) {
        try {
            const teacherId = (req as any).user.id;

            const classes = await p.class.findMany({
                where: { teacherId },
                include: {
                    _count: {
                        select: { students: true }
                    }
                },
                orderBy: { createdAt: 'desc' }
            });

            return res.json({
                success: true,
                data: classes.map((c: any) => ({
                    id: c.id,
                    classCode: c.classCode,
                    className: c.className,
                    description: c.description,
                    studentCount: c._count.students,
                    status: c.status,
                    createdAt: c.createdAt
                }))
            });
        } catch (error) {
            logger.error('Error in getMyClasses:', error);
            return errorResponse(res, 'Lỗi khi tải danh sách lớp học');
        }
    }

    /**
     * Lấy danh sách học viên trong lớp kèm điểm số dự kiến
     * GET /api/classes/:classId/students
     */
    async getClassStudents(req: Request, res: Response) {
        try {
            const { classId } = req.params;
            // 2. Kiểm tra quyền truy cập
            const user = (req as any).user;
            const isAdmin = user.role === 'ADMIN'; // Chỉ Admin mới có quyền xem mọi lớp

            const classInfo = await prisma.class.findUnique({
                where: { id: classId }
            });

            if (!classInfo) {
                return errorResponse(res, 'Không tìm thấy lớp học', HTTP_STATUS.NOT_FOUND);
            }

            if (!isAdmin && classInfo.teacherId !== user.id) {
                return errorResponse(res, 'Bạn không có quyền truy cập lớp học này', HTTP_STATUS.FORBIDDEN);
            }

            const students = await p.user.findMany({
                where: { studentClassId: classId, role: 'STUDENT' },
                select: {
                    id: true,
                    username: true,
                    name: true,
                    phoneNumber: true,
                    estimatedScore: true,
                    estimatedListening: true,
                    estimatedReading: true,
                    targetScore: true
                },
                orderBy: { username: 'asc' }
            });

            return successResponse(res, students, 'Tải danh sách học viên thành công');
        } catch (error) {
            logger.error('Error in getClassStudents:', error);
            return errorResponse(res, 'Lỗi khi tải danh sách học viên');
        }
    }

    /**
     * Xuất báo cáo Excel điểm số học viên trong lớp
     * GET /api/classes/:classId/export
     */
    async exportClassPerformance(req: Request, res: Response) {
        try {
            const { classId } = req.params;
            const teacherId = (req as any).user.id;

            const classInfo = await p.class.findUnique({
                where: { id: classId },
                include: {
                    students: {
                        where: { role: 'STUDENT' },
                        orderBy: { username: 'asc' }
                    }
                }
            });

            const user = (req as any).user;
            const isAdmin = user.role === 'ADMIN';

            if (!classInfo || (!isAdmin && classInfo.teacherId !== user.id)) {
                return errorResponse(res, 'Không tìm thấy lớp học hoặc không có quyền', HTTP_STATUS.FORBIDDEN);
            }

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Báo cáo điểm số');

            // Header
            worksheet.columns = [
                { header: 'STT', key: 'stt', width: 8, style: { alignment: { horizontal: 'center' } } },
                { header: 'Mã HV', key: 'username', width: 15 },
                { header: 'Họ và tên', key: 'name', width: 25 },
                { header: 'Số điện thoại', key: 'phoneNumber', width: 20 },
                { header: 'Listening (Dự kiến)', key: 'listening', width: 20, style: { alignment: { horizontal: 'center' } } },
                { header: 'Reading (Dự kiến)', key: 'reading', width: 20, style: { alignment: { horizontal: 'center' } } },
                { header: 'Tổng điểm', key: 'total', width: 15, style: { font: { bold: true }, alignment: { horizontal: 'center' } } },
                { header: 'Mục tiêu', key: 'target', width: 15, style: { alignment: { horizontal: 'center' } } }
            ];

            // Thêm dữ liệu
            (classInfo.students as any[]).forEach((student: any, index: number) => {
                worksheet.addRow({
                    stt: index + 1,
                    username: student.username || '-',
                    name: student.name,
                    phoneNumber: student.phoneNumber || '-',
                    listening: student.estimatedListening || 0,
                    reading: student.estimatedReading || 0,
                    total: student.estimatedScore || 0,
                    target: student.targetScore || '-'
                });
            });

            // Styling header
            const headerRow = worksheet.getRow(1);
            headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
            headerRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: '4F46E5' } // Blue-600
            };
            headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

            // Trả về file
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=Bao_cao_${classInfo.classCode}.xlsx`);

            await workbook.xlsx.write(res);
            logger.info(`Teacher ${teacherId} exported class ${classId} report`);
            return;
        } catch (error) {
            logger.error('Error in exportClassPerformance:', error);
            if (!res.headersSent) {
                return errorResponse(res, 'Lỗi khi xuất file Excel');
            }
            return;
        }
    }

    /**
     * Thay đổi trạng thái lớp học (ACTIVE/INACTIVE)
     * PATCH /api/classes/:classId/status
     */
    async toggleClassStatus(req: Request, res: Response) {
        try {
            const { classId } = req.params;
            const { status } = req.body;

            if (!['ACTIVE', 'INACTIVE'].includes(status)) {
                return errorResponse(res, 'Trạng thái không hợp lệ', HTTP_STATUS.BAD_REQUEST);
            }

            const updatedClass = await p.class.update({
                where: { id: classId },
                data: { status: status as any }
            });

            logger.info(`Class status updated: ${classId} to ${status} by ${(req as any).user.username}`);
            return successResponse(res, updatedClass, `Lớp học đã được ${status === 'ACTIVE' ? 'mở khóa' : 'đóng lại'} thành công`);
        } catch (error) {
            logger.error('Error in toggleClassStatus:', error);
            return errorResponse(res, 'Lỗi khi cập nhật trạng thái lớp học');
        }
    }

    /**
     * --- LỚP HỌC: QUẢN LÝ TÀI LIỆU ---
     */

    async getClassMaterials(req: Request, res: Response) {
        try {
            const { classId } = req.params;
            const user = (req as any).user;
            const userId = user.role === 'STUDENT' ? user.id : undefined;
            const materials = await classManagementService.getMaterials(classId, userId);
            return successResponse(res, materials, 'Tải danh sách tài liệu thành công');
        } catch (error: any) {
            return errorResponse(res, error.message || 'Lỗi khi tải tài liệu');
        }
    }

    async addClassMaterial(req: Request, res: Response) {
        try {
            const { classId } = req.params;
            const teacherId = (req as any).user.id;
            const dto = req.body;
            const file = req.file;

            const material = await classManagementService.addMaterial(classId, teacherId, dto, file);
            return successResponse(res, material, 'Thêm tài liệu thành công', HTTP_STATUS.CREATED);
        } catch (error: any) {
            return errorResponse(res, error.message || 'Lỗi khi thêm tài liệu');
        }
    }

    async deleteClassMaterial(req: Request, res: Response) {
        try {
            const { materialId } = req.params;
            const teacherId = (req as any).user.id;

            await classManagementService.deleteMaterial(materialId, teacherId);
            return successResponse(res, null, 'Xóa tài liệu thành công');
        } catch (error: any) {
            return errorResponse(res, error.message || 'Lỗi khi xóa tài liệu');
        }
    }

    async toggleMaterialStatus(req: Request, res: Response) {
        try {
            const { materialId } = req.params;
            const userId = (req as any).user.id;
            
            const progress = await classManagementService.toggleMaterialStatus(materialId, userId);
            return successResponse(res, progress, 'Cập nhật trạng thái thành công');
        } catch (error: any) {
            return errorResponse(res, error.message || 'Lỗi khi cập nhật trạng thái');
        }
    }

    /**
     * --- LỚP HỌC: QUẢN LÝ LỊCH HỌC ---
     */

    async getClassSessions(req: Request, res: Response) {
        try {
            const { classId } = req.params;
            const sessions = await classManagementService.getSessions(classId);
            return successResponse(res, sessions, 'Tải lịch học thành công');
        } catch (error: any) {
            return errorResponse(res, error.message || 'Lỗi khi tải lịch học');
        }
    }

    async addClassSession(req: Request, res: Response) {
        try {
            const { classId } = req.params;
            const teacherId = (req as any).user.id;
            const dto = req.body;

            const session = await classManagementService.addSession(classId, teacherId, dto);
            return successResponse(res, session, 'Thêm buổi học thành công', HTTP_STATUS.CREATED);
        } catch (error: any) {
            return errorResponse(res, error.message || 'Lỗi khi thêm buổi học');
        }
    }

    async deleteClassSession(req: Request, res: Response) {
        try {
            const { sessionId } = req.params;
            const teacherId = (req as any).user.id;

            await classManagementService.deleteSession(sessionId, teacherId);
            return successResponse(res, null, 'Xóa buổi học thành công');
        } catch (error: any) {
            return errorResponse(res, error.message || 'Lỗi khi xóa buổi học');
        }
    }
}

export const classController = new ClassController();
