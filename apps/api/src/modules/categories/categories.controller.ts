import {
  Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, UseGuards,
} from '@nestjs/common';
import type { Category } from '@kitty/shared-types';
import { GroupMemberGuard } from '../../common/guards/group-member.guard';
import { CategoriesService } from './categories.service';
import { CreateCategoryBody, UpdateCategoryBody } from './dto/category.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Categories')
@ApiBearerAuth('token')
@Controller('groups/:gid/categories')
@UseGuards(GroupMemberGuard)
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  findAll(@Param('gid', ParseUUIDPipe) gid: string): Promise<Category[]> {
    return this.categories.findAll(gid);
  }

  @Post()
  create(
    @Param('gid', ParseUUIDPipe) gid: string,
    @Body() body: CreateCategoryBody,
  ): Promise<Category> {
    return this.categories.create(gid, body);
  }

  @Patch(':cid')
  update(
    @Param('gid', ParseUUIDPipe) gid: string,
    @Param('cid', ParseUUIDPipe) cid: string,
    @Body() body: UpdateCategoryBody,
  ): Promise<Category> {
    return this.categories.update(gid, cid, body);
  }

  @Delete(':cid')
  @HttpCode(204)
  remove(
    @Param('gid', ParseUUIDPipe) gid: string,
    @Param('cid', ParseUUIDPipe) cid: string,
  ): Promise<void> {
    return this.categories.remove(gid, cid);
  }
}
