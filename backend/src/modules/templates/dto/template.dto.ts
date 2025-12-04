import { IsString, IsEnum, IsOptional, IsBoolean, IsArray, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType, NotificationChannel } from '../../../entities/notification.entity';

export class CreateTemplateDto {
  @ApiProperty({ description: 'Название шаблона' })
  @IsString()
  name: string;

  @ApiProperty({ enum: NotificationType, description: 'Тип уведомления' })
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiProperty({ enum: NotificationChannel, description: 'Канал отправки' })
  @IsEnum(NotificationChannel)
  channel: NotificationChannel;

  @ApiProperty({ description: 'Тема/заголовок (для Handlebars)' })
  @IsString()
  subject: string;

  @ApiProperty({ description: 'Тело сообщения (для Handlebars)' })
  @IsString()
  body: string;

  @ApiPropertyOptional({ description: 'Список доступных переменных', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  variables?: string[];

  @ApiPropertyOptional({ description: 'Активен ли шаблон', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateTemplateDto {
  @ApiPropertyOptional({ description: 'Название шаблона' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Тема/заголовок (для Handlebars)' })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional({ description: 'Тело сообщения (для Handlebars)' })
  @IsOptional()
  @IsString()
  body?: string;

  @ApiPropertyOptional({ description: 'Список доступных переменных', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  variables?: string[];

  @ApiPropertyOptional({ description: 'Активен ли шаблон' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class PreviewTemplateDto {
  @ApiProperty({ description: 'Тестовые данные для подстановки в шаблон' })
  @IsObject()
  sampleData: Record<string, any>;
}

