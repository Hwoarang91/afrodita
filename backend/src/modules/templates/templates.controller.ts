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
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
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
  async findAll() {
    return await this.templatesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Получение шаблона по ID' })
  async findOne(@Param('id') id: string) {
    return await this.templatesService.findOne(id);
  }

  @Get('variables/:type')
  @ApiOperation({ summary: 'Получение доступных переменных для типа уведомления' })
  async getVariables(@Param('type') type: NotificationType) {
    return { variables: this.templatesService.getAvailableVariables(type) };
  }

  @Post()
  @ApiOperation({ summary: 'Создание нового шаблона' })
  async create(@Body() dto: CreateTemplateDto) {
    return await this.templatesService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Обновление шаблона' })
  async update(@Param('id') id: string, @Body() dto: UpdateTemplateDto) {
    return await this.templatesService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Удаление шаблона' })
  async delete(@Param('id') id: string) {
    await this.templatesService.delete(id);
    return { message: 'Шаблон удален' };
  }

  @Post(':id/preview')
  @ApiOperation({ summary: 'Предпросмотр шаблона с тестовыми данными' })
  async preview(@Param('id') id: string, @Body() dto: PreviewTemplateDto) {
    return await this.templatesService.preview(id, dto.sampleData);
  }
}

