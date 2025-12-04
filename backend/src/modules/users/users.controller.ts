import { Controller, Get, Post, Put, Delete, UseGuards, Request, Body, Query, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { AuditService } from '../audit/audit.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserRole } from '../../entities/user.entity';
import { AuditAction } from '../../entities/audit-log.entity';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Получение списка пользователей (только для админов)' })
  @ApiQuery({ name: 'role', required: false, enum: UserRole, description: 'Фильтр по роли' })
  @ApiQuery({ name: 'search', required: false, description: 'Поиск по имени, телефону, email' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Номер страницы' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Количество записей на странице' })
  async findAll(
    @Query('role') role?: UserRole,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Request() req?: any,
  ) {
    // Только админы могут видеть всех пользователей
    if (req?.user?.role !== 'admin') {
      throw new Error('Access denied');
    }
    return await this.usersService.findAll(
      role,
      search,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Получение пользователя по ID (только для админов)' })
  async findById(@Request() req, @Param('id') id: string) {
    // Только админы могут видеть других пользователей
    if (req?.user?.role !== 'admin') {
      throw new Error('Access denied');
    }
    return await this.usersService.findById(id);
  }

  @Get('me')
  @ApiOperation({ summary: 'Получение профиля текущего пользователя' })
  async getProfile(@Request() req) {
    return await this.usersService.findById(req.user.sub);
  }

  @Put('me')
  @ApiOperation({ summary: 'Обновление профиля' })
  async updateProfile(@Request() req, @Body() data: any) {
    return await this.usersService.update(req.user.sub, data);
  }

  @Post()
  @ApiOperation({ summary: 'Создание пользователя (только для админов)' })
  async create(@Request() req, @Body() data: any) {
    if (req?.user?.role !== 'admin') {
      throw new Error('Access denied');
    }
    const user = await this.usersService.create(data);
    
    // Логируем действие
    await this.auditService.log(req.user.sub, AuditAction.USER_CREATED, {
      entityType: 'user',
      entityId: user.id,
      description: `Создан пользователь: ${user.firstName} ${user.lastName} (${user.role})`,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    
    return user;
  }

  @Put(':id')
  @ApiOperation({ summary: 'Обновление пользователя (только для админов)' })
  async updateUser(@Request() req, @Param('id') id: string, @Body() data: any) {
    // Только админы могут обновлять других пользователей
    if (req?.user?.role !== 'admin') {
      throw new Error('Access denied');
    }
    
    // Получаем старые данные для логирования изменений
    const oldUser = await this.usersService.findById(id);
    const updatedUser = await this.usersService.update(id, data);
    
    // Определяем изменения
    const changes: Record<string, any> = {};
    Object.keys(data).forEach((key) => {
      if (oldUser[key] !== data[key]) {
        changes[key] = { old: oldUser[key], new: data[key] };
      }
    });
    
    // Логируем действие
    await this.auditService.log(req.user.sub, AuditAction.USER_UPDATED, {
      entityType: 'user',
      entityId: id,
      description: `Обновлен пользователь: ${updatedUser.firstName} ${updatedUser.lastName}`,
      changes,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    
    return updatedUser;
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Удаление пользователя (только для админов)' })
  async delete(@Request() req, @Param('id') id: string) {
    if (req?.user?.role !== 'admin') {
      throw new Error('Access denied');
    }
    try {
      // Получаем данные пользователя перед удалением для логирования
      const user = await this.usersService.findById(id);
      await this.usersService.delete(id);
      
      // Логируем действие
      await this.auditService.log(req.user.sub, AuditAction.USER_DELETED, {
        entityType: 'user',
        entityId: id,
        description: `Удален пользователь: ${user.firstName} ${user.lastName} (${user.role})`,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
      
      return { success: true, message: 'Пользователь успешно удален' };
    } catch (error: any) {
      throw error;
    }
  }

  @Get(':id/interaction-history')
  @ApiOperation({ summary: 'Получение истории взаимодействий с клиентом (только для админов)' })
  async getInteractionHistory(@Request() req, @Param('id') id: string) {
    if (req?.user?.role !== 'admin') {
      throw new Error('Access denied');
    }
    return await this.usersService.getInteractionHistory(id);
  }
}

