import { IsString, IsOptional, IsArray, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationChannel } from '../../../entities/notification.entity';
import { UserRole } from '@shared/types';

export class BroadcastDto {
  @ApiProperty({ description: 'Заголовок сообщения' })
  @IsString()
  title: string;

  @ApiProperty({ description: 'Текст сообщения' })
  @IsString()
  message: string;

  @ApiProperty({ 
    description: 'Канал отправки',
    enum: NotificationChannel,
    example: NotificationChannel.TELEGRAM,
  })
  @IsEnum(NotificationChannel)
  channel: NotificationChannel;

  @ApiPropertyOptional({ 
    description: 'Роль получателей',
    enum: UserRole,
  })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({ 
    description: 'Список ID пользователей для рассылки',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  userIds?: string[];
}

