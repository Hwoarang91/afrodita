import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiParam, ApiOkResponse, ApiNotFoundResponse } from '@nestjs/swagger';
import { TemplatesService } from './templates.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../entities/user.entity';
import { NotificationType } from '../../entities/notification.entity';
import { CreateTemplateDto, UpdateTemplateDto, PreviewTemplateDto } from './dto/template.dto';

@ApiTags('templates')
@Controller('templates')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Get()
  @ApiOperation({ summary: 'Получение всех шаблонов' })
  @ApiOkResponse({ description: 'Список шаблонов' })
  async findAll() {
    return await this.templatesService.findAll();
  }

  @Get('variables/:type')
  @ApiOperation({ summary: 'Получение доступных переменных для типа уведомления' })
  @ApiOkResponse({ description: 'Объект { variables }' })
  @ApiParam({ name: 'type', description: 'Тип уведомления', enum: NotificationType })
  async getVariables(@Param('type') type: NotificationType) {
    return { variables: this.templatesService.getAvailableVariables(type) };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Получение шаблона по ID' })
  @ApiOkResponse({ description: 'Шаблон' })
  @ApiNotFoundResponse({ description: 'Шаблон не найден' })
  @ApiParam({ name: 'id', description: 'ID шаблона' })
  async findOne(@Param('id') id: string) {
    return await this.templatesService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Создание нового шаблона' })
  @ApiBody({ type: CreateTemplateDto, description: 'name, type, subject, body, sampleData' })
  async create(@Body() dto: CreateTemplateDto) {
    return await this.templatesService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Обновление шаблона' })
  @ApiParam({ name: 'id', description: 'ID шаблона' })
  @ApiBody({ type: UpdateTemplateDto, description: 'name, type, subject, body, sampleData (частично)' })
  @ApiNotFoundResponse({ description: 'Шаблон не найден' })
  async update(@Param('id') id: string, @Body() dto: UpdateTemplateDto) {
    return await this.templatesService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Удаление шаблона' })
  @ApiParam({ name: 'id', description: 'ID шаблона' })
  @ApiNotFoundResponse({ description: 'Шаблон не найден' })
  async delete(@Param('id') id: string) {
    await this.templatesService.delete(id);
    return { message: 'Шаблон удален' };
  }

  @Post(':id/preview')
  @ApiOperation({ summary: 'Предпросмотр шаблона с тестовыми данными' })
  @ApiParam({ name: 'id', description: 'ID шаблона' })
  @ApiBody({ type: PreviewTemplateDto, description: 'sampleData для подстановки в шаблон' })
  @ApiNotFoundResponse({ description: 'Шаблон не найден' })
  async preview(@Param('id') id: string, @Body() dto: PreviewTemplateDto) {
    return await this.templatesService.preview(id, dto.sampleData);
  }
}

