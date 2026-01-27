import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiBody, ApiParam, ApiOkResponse, ApiNotFoundResponse } from '@nestjs/swagger';
import { ContactRequestsService } from './contact-requests.service';
import { CreateContactRequestDto } from './dto/create-contact-request.dto';
import { UpdateContactRequestDto } from './dto/update-contact-request.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../entities/user.entity';

@ApiTags('contact-requests')
@Controller('contact-requests')
export class ContactRequestsController {
  constructor(private readonly contactRequestsService: ContactRequestsService) {}

  @Post()
  @ApiOperation({ summary: 'Создание заявки обратной связи (публичный endpoint)' })
  @ApiBody({ type: CreateContactRequestDto, description: 'name, email, phone, message' })
  async create(@Body() createDto: CreateContactRequestDto) {
    return await this.contactRequestsService.create(createDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Получение списка заявок' })
  @ApiOkResponse({ description: 'Список заявок с пагинацией' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Номер страницы' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Записей на странице (макс. 100)' })
  @ApiQuery({ name: 'status', required: false, enum: ['new', 'processed'], description: 'Фильтр по статусу' })
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: 'new' | 'processed',
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return await this.contactRequestsService.findAll(pageNum, limitNum, status);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Получение заявки по ID' })
  @ApiOkResponse({ description: 'Заявка' })
  @ApiNotFoundResponse({ description: 'Заявка не найдена' })
  @ApiParam({ name: 'id', description: 'ID заявки' })
  async findOne(@Param('id') id: string) {
    return await this.contactRequestsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Обновление заявки' })
  @ApiParam({ name: 'id', description: 'ID заявки' })
  @ApiBody({ type: UpdateContactRequestDto, description: 'status, comment (частично)' })
  @ApiNotFoundResponse({ description: 'Заявка не найдена' })
  async update(@Param('id') id: string, @Body() updateDto: UpdateContactRequestDto) {
    return await this.contactRequestsService.update(id, updateDto);
  }

  @Patch(':id/read')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Отметить заявку как прочитанную' })
  @ApiParam({ name: 'id', description: 'ID заявки' })
  @ApiNotFoundResponse({ description: 'Заявка не найдена' })
  async markAsRead(@Param('id') id: string) {
    return await this.contactRequestsService.markAsRead(id);
  }

  @Patch(':id/processed')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Отметить заявку как обработанную' })
  @ApiParam({ name: 'id', description: 'ID заявки' })
  @ApiNotFoundResponse({ description: 'Заявка не найдена' })
  async markAsProcessed(@Param('id') id: string) {
    return await this.contactRequestsService.markAsProcessed(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Удаление заявки' })
  @ApiParam({ name: 'id', description: 'ID заявки' })
  @ApiNotFoundResponse({ description: 'Заявка не найдена' })
  async remove(@Param('id') id: string) {
    await this.contactRequestsService.remove(id);
    return { message: 'Заявка успешно удалена' };
  }

  @Post('bulk-delete')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Массовое удаление заявок' })
  @ApiBody({ schema: { type: 'object', required: ['ids'], properties: { ids: { type: 'array', items: { type: 'string' } } } } })
  async bulkDelete(@Body() body: { ids: string[] }) {
    await this.contactRequestsService.bulkDelete(body.ids);
    return { message: `Успешно удалено ${body.ids.length} заявок` };
  }
}

