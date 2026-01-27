import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiParam, ApiOkResponse, ApiNotFoundResponse } from '@nestjs/swagger';
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
  @ApiOkResponse({ description: 'Список автоматических ответов' })
  async findAll() {
    return await this.autoRepliesService.findAll();
  }

  @Get('active')
  @ApiOperation({ summary: 'Получить список активных автоматических ответов' })
  @ApiOkResponse({ description: 'Список активных автоматических ответов' })
  async findActive() {
    return await this.autoRepliesService.findActive();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Получить автоматический ответ по ID' })
  @ApiOkResponse({ description: 'Автоматический ответ' })
  @ApiNotFoundResponse({ description: 'Автоматический ответ не найден' })
  @ApiParam({ name: 'id', description: 'ID автоматического ответа' })
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
  @ApiParam({ name: 'id', description: 'ID автоматического ответа' })
  @ApiBody({ schema: { type: 'object', description: 'Частичное обновление: keyword, response, isActive' } })
  @ApiNotFoundResponse({ description: 'Автоматический ответ не найден' })
  async update(@Param('id') id: string, @Body() data: Partial<AutoReply>) {
    return await this.autoRepliesService.update(id, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Удалить автоматический ответ' })
  @ApiParam({ name: 'id', description: 'ID автоматического ответа' })
  @ApiNotFoundResponse({ description: 'Автоматический ответ не найден' })
  async delete(@Param('id') id: string) {
    await this.autoRepliesService.delete(id);
    return { success: true, message: 'Автоматический ответ удален' };
  }
}

