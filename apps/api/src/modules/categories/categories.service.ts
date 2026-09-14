import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Category } from '@kitty/shared-types';
import { IsNull, Repository } from 'typeorm';
import { AppError } from '../../common/app-error';
import { toCategory } from '../../common/mappers';
import { CategoryEntity } from '../../entities';
import type { CreateCategoryBody, UpdateCategoryBody } from './dto/category.dto';

/** Built-in categories, stored with a NULL groupId so every group sees them. */
export const SYSTEM_CATEGORIES = [
  { name: 'Food', icon: 'utensils', color: '#F97316', sortOrder: 1 },
  { name: 'Groceries', icon: 'shopping-basket', color: '#22C55E', sortOrder: 2 },
  { name: 'Travel', icon: 'plane', color: '#0EA5E9', sortOrder: 3 },
  { name: 'Transport', icon: 'car', color: '#6366F1', sortOrder: 4 },
  { name: 'Entertainment', icon: 'party-popper', color: '#EC4899', sortOrder: 5 },
  { name: 'Bills', icon: 'receipt', color: '#EF4444', sortOrder: 6 },
  { name: 'Shopping', icon: 'shopping-bag', color: '#A855F7', sortOrder: 7 },
];

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(CategoryEntity) private readonly categories: Repository<CategoryEntity>,
  ) {}

  /** @description Returns the system categories plus the group's own categories. */
  async findAll(groupId: string): Promise<Category[]> {
    const rows = await this.categories.find({
      where: [{ groupId: IsNull() }, { groupId }],
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
    return rows.map(toCategory);
  }

  /** @description Creates a group category, appended after the existing ones in sort order. */
  async create(groupId: string, body: CreateCategoryBody): Promise<Category> {
    const max = await this.categories
      .createQueryBuilder('c')
      .select('COALESCE(MAX(c.sort_order), 0)', 'max')
      .where('c.group_id = :groupId', { groupId })
      .getRawOne<{ max: string }>();

    const entity = this.categories.create({
      groupId,
      name: body.name.trim(),
      icon: body.icon,
      color: body.color ?? '#94A3B8',
      sortOrder: Number(max?.max ?? 0) + 1,
    });
    await this.categories.save(entity);
    return toCategory(entity);
  }

  async update(groupId: string, id: string, body: UpdateCategoryBody): Promise<Category> {
    const entity = await this.mustOwn(groupId, id);
    if (body.name !== undefined) entity.name = body.name.trim();
    if (body.icon !== undefined) entity.icon = body.icon;
    if (body.color !== undefined) entity.color = body.color;
    await this.categories.save(entity);
    return toCategory(entity);
  }

  /**
   * @description Soft-deletes a group category. Expenses keep their reference so
   * history retains its classification.
   */
  async remove(groupId: string, id: string): Promise<void> {
    const entity = await this.mustOwn(groupId, id);
    await this.categories.softRemove(entity);
  }

  /**
   * @description Loads a category the group is allowed to modify.
   * @throws {AppError} When missing, a system category, or owned by another group.
   */
  private async mustOwn(groupId: string, id: string): Promise<CategoryEntity> {
    const entity = await this.categories.findOne({ where: { id } });
    if (!entity) throw AppError.notFound('CATEGORY_NOT_FOUND', 'Không tìm thấy danh mục');
    if (entity.groupId === null) {
      throw AppError.forbidden('SYSTEM_CATEGORY_READONLY', 'Không sửa được danh mục hệ thống');
    }
    if (entity.groupId !== groupId) {
      throw AppError.forbidden('WRONG_GROUP', 'Danh mục không thuộc nhóm này');
    }
    return entity;
  }
}
