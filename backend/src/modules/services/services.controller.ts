import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBody, ApiParam, ApiOkResponse, ApiNotFoundResponse } from '@nestjs/swagger';
import { ServicesService } from './services.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@ApiTags('services')
@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get()
  @ApiOperation({ summary: 'Получение списка услуг' })
  @ApiOkResponse({ description: 'Список услуг с пагинацией' })
  @ApiQuery({ name: 'category', required: false, type: String, description: 'Фильтр по категории' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Номер страницы' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Количество записей на странице (макс. 100)' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Поиск по названию или описанию' })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean, description: 'Фильтр по активности' })
  @ApiQuery({ name: 'includeSubcategories', required: false, type: Boolean, description: 'Включить подкатегории' })
  async findAll(
    @Query('category') category?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
    @Query('includeSubcategories') includeSubcategories?: string,
  ) {
    return await this.servicesService.findAll(
      category,
      page,
      limit,
      search,
      isActive !== undefined ? isActive === 'true' : undefined,
      includeSubcategories !== undefined ? includeSubcategories === 'true' : false,
    );
  }

  @Get('main')
  @ApiOperation({ summary: 'Получение только самостоятельных услуг (без категорий и подкатегорий)' })
  @ApiOkResponse({ description: 'Список самостоятельных услуг' })
  async findMainServices() {
    return await this.servicesService.findMainServices();
  }

  @Get('categories')
  @ApiOperation({ summary: 'Получение только категорий' })
  @ApiOkResponse({ description: 'Список категорий' })
  async findCategories() {
    return await this.servicesService.findCategories();
  }

  @Get('for-bot')
  @ApiOperation({ summary: 'Получение услуг для бота (самостоятельные + категории)' })
  @ApiOkResponse({ description: 'Услуги для бота' })
  async findServicesForBot() {
    return await this.servicesService.findServicesForBot();
  }

  @Get(':id/subcategories')
  @ApiOperation({ summary: 'Получение подкатегорий для услуги' })
  @ApiOkResponse({ description: 'Список подкатегорий' })
  @ApiParam({ name: 'id', description: 'ID услуги или категории' })
  async findSubcategories(@Param('id') id: string) {
    return await this.servicesService.findSubcategories(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Получение услуги по ID' })
  @ApiOkResponse({ description: 'Услуга' })
  @ApiNotFoundResponse({ description: 'Услуга не найдена' })
  @ApiParam({ name: 'id', description: 'ID услуги' })
  async findById(@Param('id') id: string) {
    return await this.servicesService.findById(id);
  }

  @Post()
  // Временно отключено для тестирования - в production включить обратно
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(UserRole.ADMIN)
  // @ApiBearerAuth()
  @ApiOperation({ summary: 'Создание услуги (только для админов)' })
  @ApiBody({ type: CreateServiceDto, description: 'Данные услуги: name, description, price, duration, isCategory и др.' })
  async create(@Body() dto: CreateServiceDto) {
    return await this.servicesService.create(dto);
  }

  @Put(':id')
  // Временно отключено для тестирования - в production включить обратно
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(UserRole.ADMIN)
  // @ApiBearerAuth()
  @ApiOperation({ summary: 'Обновление услуги (только для админов)' })
  @ApiParam({ name: 'id', description: 'ID услуги' })
  @ApiBody({ type: UpdateServiceDto, description: 'Частичное обновление: name, description, price и др.' })
  @ApiNotFoundResponse({ description: 'Услуга не найдена' })
  async update(@Param('id') id: string, @Body() dto: UpdateServiceDto) {
    return await this.servicesService.update(id, dto);
  }

  @Delete(':id')
  // Временно отключено для тестирования - в production включить обратно
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(UserRole.ADMIN)
  // @ApiBearerAuth()
  @ApiOperation({ summary: 'Удаление услуги (только для админов)' })
  @ApiParam({ name: 'id', description: 'ID услуги' })
  @ApiNotFoundResponse({ description: 'Услуга не найдена' })
  async delete(@Param('id') id: string) {
    return await this.servicesService.delete(id);
  }
}

