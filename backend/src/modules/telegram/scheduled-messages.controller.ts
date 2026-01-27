import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiParam, ApiOkResponse, ApiNotFoundResponse } from '@nestjs/swagger';
import { ScheduledMessagesService } from './scheduled-messages.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../entities/user.entity';
import { ScheduledMessage } from '../../entities/scheduled-message.entity';

@ApiTags('telegram')
@Controller('telegram/scheduled-messages')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class ScheduledMessagesController {
  constructor(private readonly scheduledMessagesService: ScheduledMessagesService) {}

  @Get()
  @ApiOperation({ summary: 'Получить список всех запланированных сообщений' })
  @ApiOkResponse({ description: 'Список запланированных сообщений' })
  async findAll() {
    return await this.scheduledMessagesService.findAll();
  }

  @Get('pending')
  @ApiOperation({ summary: 'Получить список ожидающих отправки сообщений' })
  @ApiOkResponse({ description: 'Список ожидающих сообщений' })
  async findPending() {
    return await this.scheduledMessagesService.findPending();
  }

  @Get('chat/:chatId')
  @ApiOperation({ summary: 'Получить запланированные сообщения для конкретного чата' })
  @ApiOkResponse({ description: 'Список запланированных сообщений чата' })
  @ApiParam({ name: 'chatId', description: 'ID чата' })
  async findByChatId(@Param('chatId') chatId: string) {
    return await this.scheduledMessagesService.findByChatId(chatId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Получить запланированное сообщение по ID' })
  @ApiOkResponse({ description: 'Запланированное сообщение' })
  @ApiNotFoundResponse({ description: 'Запланированное сообщение не найдено' })
  @ApiParam({ name: 'id', description: 'ID запланированного сообщения' })
  async findOne(@Param('id') id: string) {
    return await this.scheduledMessagesService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Создать новое запланированное сообщение' })
  @ApiBody({ schema: { type: 'object', description: 'chatId, message, scheduledAt, recurringConfig? и др.' } })
  async create(@Body() data: Parameters<ScheduledMessagesService['create']>[0]) {
    return await this.scheduledMessagesService.create(data);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Обновить запланированное сообщение' })
  @ApiParam({ name: 'id', description: 'ID запланированного сообщения' })
  @ApiBody({ schema: { type: 'object', description: 'Частичное обновление: chatId, message, scheduledAt, status и др.' } })
  @ApiNotFoundResponse({ description: 'Запланированное сообщение не найдено' })
  async update(@Param('id') id: string, @Body() data: Partial<ScheduledMessage>) {
    return await this.scheduledMessagesService.update(id, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Удалить запланированное сообщение' })
  @ApiParam({ name: 'id', description: 'ID запланированного сообщения' })
  @ApiNotFoundResponse({ description: 'Запланированное сообщение не найдено' })
  async delete(@Param('id') id: string) {
    await this.scheduledMessagesService.delete(id);
    return { success: true, message: 'Запланированное сообщение удалено' };
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Отменить запланированное сообщение' })
  @ApiParam({ name: 'id', description: 'ID запланированного сообщения' })
  @ApiNotFoundResponse({ description: 'Запланированное сообщение не найдено' })
  async cancel(@Param('id') id: string) {
    return await this.scheduledMessagesService.cancel(id);
  }
}

