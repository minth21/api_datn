import { MaterialType, MaterialCategory } from '@prisma/client';

export class CreateClassMaterialDto {
  title: string;
  description?: string;
  type: MaterialType;
  category?: MaterialCategory;
  url?: string;
}
