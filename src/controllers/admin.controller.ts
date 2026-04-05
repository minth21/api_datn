import { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import bcrypt from 'bcrypt';
import { logger } from '../utils/logger';
import { errorResponse } from '../utils/response';
import { HTTP_STATUS } from '../config/constants';

/**
 * Admin Controller - Quản lý các tác vụ dành cho Admin và Specialist
 */
export class AdminController {
    /**
     * Tạo tài khoản nhân viên/học viên tự động (Sinh mã & Mật khẩu mặc định)
     * POST /api/admin/users/auto
     */
    async createUserAuto(req: Request, res: Response) {
        try {
            const { name, phoneNumber, role, studentClassId, gender } = req.body;
            logger.info(`Incoming createUserAuto request: ${JSON.stringify(req.body)}`);

            // Kiểm tra role hợp lệ để tự sinh mã
            const validRoles = ['STUDENT', 'TEACHER', 'SPECIALIST'];
            if (!validRoles.includes(role)) {
                return errorResponse(res, 'Vai trò không hỗ trợ tạo mã tự động', HTTP_STATUS.BAD_REQUEST);
            }

            // Xác định tiền tố dựa trên Role
            const prefixMap: { [key: string]: string } = {
                'STUDENT': 'HV',
                'TEACHER': 'GV',
                'SPECIALIST': 'CV'
            };
            const prefix = prefixMap[role];

            // Tìm mã lớn nhất hiện tại của Role đó
            const lastUser = await prisma.user.findFirst({
                where: {
                    role: role as any,
                    username: {
                        startsWith: prefix,
                    },
                },
                orderBy: {
                    username: 'desc',
                },
            });

            let nextCode = `${prefix}001`;
            if (lastUser && lastUser.username) {
                // Lấy phần số từ mã cũ (VD: GV045 -> 45)
                const lastNum = parseInt(lastUser.username.replace(prefix, ''));
                if (!isNaN(lastNum)) {
                    nextCode = `${prefix}${(lastNum + 1).toString().padStart(3, '0')}`;
                }
            }

            // Hash mật khẩu mặc định
            const defaultPassword = 'toeic2026';
            const hashedPassword = await bcrypt.hash(defaultPassword, 10);

            // Tạo user
            const newUser = await prisma.user.create({
                data: {
                    name,
                    phoneNumber,
                    password: hashedPassword,
                    role: role as any,
                    username: nextCode,
                    gender: gender || null,
                    studentClassId: role === 'STUDENT' ? (studentClassId || null) : null,
                },
                select: {
                    id: true,
                    name: true,
                    role: true,
                    username: true,
                    createdAt: true
                }
            });

            logger.info(`Admin created auto-account: ${newUser.username} (${newUser.name})`);

            return res.status(HTTP_STATUS.CREATED).json({
                success: true,
                message: `Tạo tài khoản ${role} thành công`,
                data: {
                    user: newUser,
                    defaultPassword
                }
            });
        } catch (error: any) {
            logger.error('Error in createUserAuto:', error.message, error.stack);
            return errorResponse(res, `Lỗi hệ thống: ${error.message || 'Không xác định'}`);
        }
    }
}

export const adminController = new AdminController();
