import { ApiProperty } from '@nestjs/swagger';

export class TelegramSessionStatusDto {
  @ApiProperty({ 
    description: 'Имеет ли пользователь Telegram сессию',
    example: true 
  })
  hasSession: boolean;

  @ApiProperty({ 
    description: 'Статус Telegram сессии',
    enum: ['initializing', 'active', 'invalid', 'revoked', 'expired', 'not_found'],
    example: 'active',
    required: false,
  })
  status?: 'initializing' | 'active' | 'invalid' | 'revoked' | 'expired' | 'not_found';

  @ApiProperty({ 
    description: 'ID активной сессии',
    example: '550e8400-e29b-41d4-a716-446655440000',
    required: false,
  })
  sessionId?: string | null;

  @ApiProperty({ 
    description: 'Номер телефона сессии',
    example: '+79001234567',
    required: false,
  })
  phoneNumber?: string | null;

  @ApiProperty({ 
    description: 'Причина невалидности сессии',
    example: 'AUTH_KEY_UNREGISTERED',
    required: false,
  })
  invalidReason?: string | null;

  @ApiProperty({ 
    description: 'Timestamp создания сессии (в секундах)',
    example: 1700000000,
    required: false,
  })
  createdAt?: number | null;

  @ApiProperty({ 
    description: 'Timestamp последнего использования (в секундах)',
    example: 1700000000,
    required: false,
  })
  lastUsedAt?: number | null;
}

