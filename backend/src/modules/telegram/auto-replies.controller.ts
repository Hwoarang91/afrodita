import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AutoRepliesService } from './auto-replies.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../entities/user.entity';
import { AutoReply } from '../../entities/auto-reply.entity';

@ApiTags('telegram')
@Controller('telegram/auto-replies')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class AutoRepliesController {
  constructor(private readonly autoRepliesService: AutoRepliesService) {}

  @Get()
  @ApiOperation({ summary: 'Получить список всех автоматических ответов' })
  async findAll() {
    return await this.autoRepliesService.findAll();
  }

  @Get('active')
  @ApiOperation({ summary: 'Получить список активных автоматических ответов' })
  async findActive() {
    return await this.autoRepliesService.findActive();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Получить автоматический ответ по ID' })
  async findOne(@Param('id') id: string) {
    return await this.autoRepliesService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Создать новый автоматический ответ' })
  async create(@Body() data: Parameters<AutoRepliesService['create']>[0]) {
    return await this.autoRepliesService.create(data);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Обновить автоматический ответ' })
  async update(@Param('id') id: string, @Body() data: Partial<AutoReply>) {
    return await this.autoRepliesService.update(id, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Удалить автоматический ответ' })
  async delete(@Param('id') id: string) {
    await this.autoRepliesService.delete(id);
    return { success: true, message: 'Автоматический ответ удален' };
  }
}

