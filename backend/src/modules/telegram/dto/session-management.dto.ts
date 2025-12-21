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

  @ApiProperty({
    description: 'Статус сессии',
    enum: ['active', 'invalid', 'revoked', 'initializing'],
    example: 'active',
  })
  status: 'active' | 'invalid' | 'revoked' | 'initializing';

  @ApiProperty({ description: 'Причина невалидности сессии (если status = invalid)', required: false })
  invalidReason?: string | null;

  @ApiProperty({ description: 'ID датацентра (DC)', required: false })
  dcId?: number | null;

  @ApiProperty({ description: 'Дата последнего использования' })
  lastUsedAt: Date | null;

  @ApiProperty({ description: 'Дата создания' })
  createdAt: Date;

  @ApiProperty({ description: 'ID владельца сессии (для админа)', required: false })
  userId?: string;

  @ApiProperty({ description: 'Email владельца сессии (для админа)', required: false })
  userEmail?: string | null;

  @ApiProperty({ description: 'Является ли эта сессия текущей (используется для API)', required: false })
  isCurrent?: boolean;
}

