import { IsString, IsEnum, IsOptional, IsBoolean, IsArray, IsObject, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType, NotificationChannel } from '../../../entities/notification.entity';

export class CreateTemplateDto {
  @ApiProperty({ description: 'Название шаблона' })
  @IsString()
  @MaxLength(200, { message: 'Название шаблона не более 200 символов' })
  name: string;

  @ApiProperty({ enum: NotificationType, description: 'Тип уведомления' })
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiProperty({ enum: NotificationChannel, description: 'Канал отправки' })
  @IsEnum(NotificationChannel)
  channel: NotificationChannel;

  @ApiProperty({ description: 'Тема/заголовок (для Handlebars)' })
  @IsString()
  @MaxLength(500, { message: 'Тема не более 500 символов' })
  subject: string;

  @ApiProperty({ description: 'Тело сообщения (для Handlebars)' })
  @IsString()
  @MaxLength(20000, { message: 'Тело шаблона не более 20000 символов' })
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
  @MaxLength(200, { message: 'Название шаблона не более 200 символов' })
  name?: string;

  @ApiPropertyOptional({ description: 'Тема/заголовок (для Handlebars)' })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Тема не более 500 символов' })
  subject?: string;

  @ApiPropertyOptional({ description: 'Тело сообщения (для Handlebars)' })
  @IsOptional()
  @IsString()
  @MaxLength(20000, { message: 'Тело шаблона не более 20000 символов' })
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

