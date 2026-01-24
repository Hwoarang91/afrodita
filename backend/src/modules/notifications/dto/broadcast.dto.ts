import { IsString, IsOptional, IsArray, IsEnum, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationChannel } from '../../../entities/notification.entity';
import { UserRole } from '../../../entities/user.entity';

export class BroadcastDto {
  @ApiProperty({ description: 'Заголовок сообщения' })
  @IsString()
  @MaxLength(500, { message: 'Заголовок не более 500 символов' })
  title: string;

  @ApiProperty({ description: 'Текст сообщения' })
  @IsString()
  @MaxLength(10000, { message: 'Текст сообщения не более 10000 символов' })
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

