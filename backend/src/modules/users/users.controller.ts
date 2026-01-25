import { Controller, Get, Post, Put, Delete, UseGuards, Request, Body, Query, Param } from '@nestjs/common';
import { AuthRequest } from '../../common/types/request.types';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { ReferralService } from './referral.service';
import { AuditService } from '../audit/audit.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { User, UserRole } from '../../entities/user.entity';
import { BodyMeasurement } from '../../entities/body-measurement.entity';
import { AuditAction } from '../../entities/audit-log.entity';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly referralService: ReferralService,
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
    @Request() req?: AuthRequest,
  ) {
    // Только админы могут видеть всех пользователей
    if (req?.user?.role !== 'admin') {
      throw new Error('Access denied');
    }
    return await this.usersService.findAll(role, search, page, limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Получение пользователя по ID (только для админов)' })
  async findById(@Request() req: AuthRequest, @Param('id') id: string) {
    // Только админы могут видеть других пользователей
    if (req?.user?.role !== 'admin') {
      throw new Error('Access denied');
    }
    return await this.usersService.findById(id);
  }

  @Get('me')
  @ApiOperation({ summary: 'Получение профиля текущего пользователя' })
  async getProfile(@Request() req: AuthRequest) {
    return await this.usersService.findById(req.user!.sub!);
  }

  @Put('me')
  @ApiOperation({ summary: 'Обновление профиля' })
  async updateProfile(@Request() req: AuthRequest, @Body() data: Partial<User>) {
    return await this.usersService.update(req.user!.sub!, data);
  }

  @Post()
  @ApiOperation({ summary: 'Создание пользователя (только для админов)' })
  async create(@Request() req: AuthRequest, @Body() data: Partial<User>) {
    if (req?.user?.role !== 'admin') {
      throw new Error('Access denied');
    }
    const user = await this.usersService.create(data);
    
    // Логируем действие
    await this.auditService.log(req.user!.sub!, AuditAction.USER_CREATED, {
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
  async updateUser(@Request() req: AuthRequest, @Param('id') id: string, @Body() data: Partial<User>) {
    // Только админы могут обновлять других пользователей
    if (req?.user?.role !== 'admin') {
      throw new Error('Access denied');
    }
    
    // Получаем старые данные для логирования изменений
    const oldUser = await this.usersService.findById(id);
    const updatedUser = await this.usersService.update(id, data);
    
    // Определяем изменения
    const changes: Record<string, { old: unknown; new: unknown }> = {};
    const dataObj = data as Record<string, unknown>;
    const oldObj = oldUser as unknown as Record<string, unknown>;
    Object.keys(dataObj).forEach((key) => {
      const o = oldObj[key];
      const n = dataObj[key];
      if (o !== n) {
        changes[key] = { old: o, new: n };
      }
    });
    
    // Логируем действие
    await this.auditService.log(req.user!.sub!, AuditAction.USER_UPDATED, {
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
  async delete(@Request() req: AuthRequest, @Param('id') id: string) {
    if (req?.user?.role !== 'admin') {
      throw new Error('Access denied');
    }
    try {
      // Получаем данные пользователя перед удалением для логирования
      const user = await this.usersService.findById(id);
      await this.usersService.delete(id);
      
      // Логируем действие
      await this.auditService.log(req.user!.sub!, AuditAction.USER_DELETED, {
        entityType: 'user',
        entityId: id,
        description: `Удален пользователь: ${user.firstName} ${user.lastName} (${user.role})`,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
      
      return { success: true, message: 'Пользователь успешно удален' };
    } catch (error: unknown) {
      throw error;
    }
  }

  @Get(':id/interaction-history')
  @ApiOperation({ summary: 'Получение истории взаимодействий с клиентом (только для админов)' })
  async getInteractionHistory(@Request() req: AuthRequest, @Param('id') id: string) {
    if (req?.user?.role !== 'admin') {
      throw new Error('Access denied');
    }
    return await this.usersService.getInteractionHistory(id);
  }

  @Get(':id/body-measurements')
  @ApiOperation({ summary: 'Получение всех замеров объемов тела клиента (только для админов)' })
  async getBodyMeasurements(@Request() req: AuthRequest, @Param('id') id: string) {
    if (req?.user?.role !== 'admin') {
      throw new Error('Access denied');
    }
    return await this.usersService.getBodyMeasurements(id);
  }

  @Get(':id/body-measurements/latest')
  @ApiOperation({ summary: 'Получение последнего замера объемов тела клиента (только для админов)' })
  async getLatestBodyMeasurement(@Request() req: AuthRequest, @Param('id') id: string) {
    if (req?.user?.role !== 'admin') {
      throw new Error('Access denied');
    }
    return await this.usersService.getLatestBodyMeasurement(id);
  }

  @Post(':id/body-measurements')
  @ApiOperation({ summary: 'Создание нового замера объемов тела (только для админов)' })
  async createBodyMeasurement(@Request() req: AuthRequest, @Param('id') id: string, @Body() data: Partial<BodyMeasurement>) {
    if (req?.user?.role !== 'admin') {
      throw new Error('Access denied');
    }
    const measurement = await this.usersService.createBodyMeasurement(id, data);
    
    await this.auditService.log(req.user!.sub!, AuditAction.USER_UPDATED, {
      entityType: 'body_measurement',
      entityId: measurement.id,
      description: `Создан новый замер объемов тела для клиента`,
      changes: data,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    
    return measurement;
  }

  @Put(':id/body-measurements/:measurementId')
  @ApiOperation({ summary: 'Обновление замера объемов тела (только для админов)' })
  async updateBodyMeasurement(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Param('measurementId') measurementId: string,
    @Body() data: Partial<BodyMeasurement>,
  ) {
    if (req?.user?.role !== 'admin') {
      throw new Error('Access denied');
    }
    const measurement = await this.usersService.updateBodyMeasurement(measurementId, id, data);
    
    await this.auditService.log(req.user!.sub!, AuditAction.USER_UPDATED, {
      entityType: 'body_measurement',
      entityId: measurementId,
      description: `Обновлен замер объемов тела для клиента`,
      changes: data,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    
    return measurement;
  }

  @Delete(':id/body-measurements/:measurementId')
  @ApiOperation({ summary: 'Удаление замера объемов тела (только для админов)' })
  async deleteBodyMeasurement(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Param('measurementId') measurementId: string,
  ) {
    if (req?.user?.role !== 'admin') {
      throw new Error('Access denied');
    }
    await this.usersService.deleteBodyMeasurement(measurementId, id);
    
    await this.auditService.log(req.user!.sub!, AuditAction.USER_DELETED, {
      entityType: 'body_measurement',
      entityId: measurementId,
      description: `Удален замер объемов тела для клиента`,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    
    return { success: true };
  }

  @Get('me/referral')
  @ApiOperation({ summary: 'Получение реферального кода текущего пользователя' })
  async getReferralCode(@Request() req: AuthRequest) {
    const userId = req.user!.sub!;
    const referralCode = await this.referralService.getOrGenerateReferralCode(userId);
    return { referralCode };
  }

  @Get('me/referral/stats')
  @ApiOperation({ summary: 'Получение статистики по рефералам текущего пользователя' })
  async getReferralStats(@Request() req: AuthRequest) {
    const userId = req.user!.sub!;
    return await this.referralService.getReferralStats(userId);
  }

  @Get(':id/referral/stats')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Получение статистики по рефералам пользователя (только для админов)' })
  async getClientReferralStats(@Param('id') id: string) {
    return await this.referralService.getReferralStats(id);
  }
}

