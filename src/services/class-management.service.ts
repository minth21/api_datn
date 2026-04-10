import { prisma } from '../config/prisma';
import { CreateClassMaterialDto } from '../dto/class-management.dto';
import { uploadFileToCloudinary, saveAssetToDb } from '../config/cloudinary.config';
import { MaterialType } from '@prisma/client';

export class ClassManagementService {
  /**
   * --- MATERIALS MANAGEMENT ---
   */

  async getMaterials(classId: string, userId?: string) {
    const materials = await prisma.classMaterial.findMany({
      where: { classId },
      include: {
        userProgress: userId ? {
            where: { userId }
        } : undefined
      },
      orderBy: { createdAt: 'desc' },
    });

    return materials.map(m => {
        const { userProgress, ...rest } = m as any;
        return {
            ...rest,
            isCompleted: userProgress && userProgress.length > 0 ? userProgress[0].isCompleted : false
        };
    });
  }

  async addMaterial(classId: string, teacherId: string, dto: CreateClassMaterialDto, file?: Express.Multer.File) {
    // 1. Verify class ownership
    await this.verifyClassTeacher(classId, teacherId);

    let finalUrl = dto.url || '';

    // 2. Handle Case: Upload to Cloudinary (for PDF or Direct Video)
    if (file && (dto.type === MaterialType.PDF || dto.type === MaterialType.VIDEO)) {
      // Create subfolder based on type (e.g., class_materials/pdf)
      const subFolder = `class_materials/${dto.type.toLowerCase()}s`;
      const uploadRes = await uploadFileToCloudinary(file.buffer, subFolder);
      
      // Log to DB (Antigravity Audit Log)
      await saveAssetToDb(uploadRes, teacherId);
      
      finalUrl = uploadRes.secure_url;
    }

    // 3. Create Record
    return prisma.classMaterial.create({
      data: {
        title: dto.title,
        description: dto.description,
        type: dto.type,
        category: dto.category || 'MATERIAL',
        url: finalUrl,
        classId,
      },
    });
  }

  async deleteMaterial(materialId: string, teacherId: string) {
    const material = await prisma.classMaterial.findUnique({
      where: { id: materialId },
      include: { class: true },
    });

    if (!material) throw new Error('Không tìm thấy tài liệu');
    if ((material.class as any).teacherId !== teacherId) throw new Error('Không có quyền xóa');

    return prisma.classMaterial.delete({ where: { id: materialId } });
  }

  async toggleMaterialStatus(materialId: string, userId: string) {
    const progress = await prisma.userMaterialProgress.findUnique({
      where: { userId_materialId: { userId, materialId } }
    });

    if (progress) {
      return prisma.userMaterialProgress.update({
        where: { id: progress.id },
        data: { isCompleted: !progress.isCompleted }
      });
    } else {
      return prisma.userMaterialProgress.create({
        data: {
          userId,
          materialId,
          isCompleted: true
        }
      });
    }
  }

  /**
   * --- HELPERS ---
   */

  private async verifyClassTeacher(classId: string, teacherId: string) {
    const clazz = await prisma.class.findUnique({
      where: { id: classId },
      select: { teacherId: true },
    });

    if (!clazz) throw new Error('Không tìm thấy lớp học');
    if (clazz.teacherId !== teacherId) {
      throw new Error('Bạn không phải là giáo viên quản lý lớp này');
    }
  }
}
