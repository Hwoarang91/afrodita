import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsOptional } from 'class-validator';

export class DeactivateSessionDto {
  @ApiProperty({ description: 'ID сессии для деактивации' })
  @IsUUID()
  sessionId: string;
}

export class SessionInfoDto {
  @ApiProperty({ description: 'ID сессии' })
  id: string;

  @ApiProperty({ description: 'Номер телефона' })
  phoneNumber: string | null;

  @ApiProperty({ description: 'IP адрес' })
  ipAddress: string | null;

  @ApiProperty({ description: 'User Agent' })
  userAgent: string | null;

  @ApiProperty({ description: 'Активна ли сессия' })
  isActive: boolean;

  @ApiProperty({ description: 'Дата последнего использования' })
  lastUsedAt: Date | null;

  @ApiProperty({ description: 'Дата создания' })
  createdAt: Date;

  @ApiProperty({ description: 'ID владельца сессии (для админа)', required: false })
  userId?: string;

  @ApiProperty({ description: 'Email владельца сессии (для админа)', required: false })
  userEmail?: string | null;
}

