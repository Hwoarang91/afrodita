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
import { ApiTags, ApiOperation, ApiParam, ApiQuery, ApiBody, ApiOkResponse, ApiNotFoundResponse } from '@nestjs/swagger';
import { ExtraServicesService } from './extra-services.service';
import { CreateExtraServiceDto } from './dto/create-extra-service.dto';
import { UpdateExtraServiceDto } from './dto/update-extra-service.dto';

@ApiTags('extra-services')
@Controller('extra-services')
export class ExtraServicesController {
  constructor(private readonly extraServicesService: ExtraServicesService) {}

  @Get()
  @ApiOperation({ summary: 'Список доп. услуг (для веб-приложения — только активные)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiOkResponse({ description: 'Список доп. услуг' })
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('isActive') isActive?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : undefined;
    const limitNum = limit ? parseInt(limit, 10) : undefined;
    const isActiveBool = isActive === 'true' ? true : isActive === 'false' ? false : undefined;

    if (pageNum !== undefined || isActiveBool === false) {
      return this.extraServicesService.findAll({
        page: pageNum ?? 1,
        limit: limitNum ?? 20,
        isActive: isActiveBool,
      });
    }
    return this.extraServicesService.findAllActive();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Доп. услуга по ID' })
  @ApiParam({ name: 'id', description: 'ID доп. услуги' })
  @ApiNotFoundResponse({ description: 'Не найдено' })
  async findById(@Param('id') id: string) {
    return this.extraServicesService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Создать доп. услугу' })
  @ApiBody({ type: CreateExtraServiceDto })
  async create(@Body() dto: CreateExtraServiceDto) {
    return this.extraServicesService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Обновить доп. услугу' })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: UpdateExtraServiceDto })
  @ApiNotFoundResponse({ description: 'Не найдено' })
  async update(@Param('id') id: string, @Body() dto: UpdateExtraServiceDto) {
    return this.extraServicesService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Удалить доп. услугу' })
  @ApiParam({ name: 'id' })
  @ApiNotFoundResponse({ description: 'Не найдено' })
  async delete(@Param('id') id: string) {
    await this.extraServicesService.delete(id);
  }
}
