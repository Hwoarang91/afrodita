import { ApiProperty } from '@nestjs/swagger';

export enum QrTokenStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  EXPIRED = 'expired',
}

export class TelegramQrStatusResponseDto {
  @ApiProperty({
    description: 'Статус токена',
    enum: QrTokenStatus,
    example: QrTokenStatus.PENDING,
  })
  status: QrTokenStatus;

  @ApiProperty({
    description: 'Данные пользователя (если токен принят)',
    required: false,
  })
  user?: {
    id: string;
    phoneNumber: string;
    firstName?: string;
    lastName?: string;
    username?: string;
  };

  @ApiProperty({
    description: 'JWT токены (если токен принят)',
    required: false,
  })
  tokens?: {
    accessToken: string;
    refreshToken: string;
  };

  @ApiProperty({
    description: 'Время истечения QR-кода (Unix timestamp)',
    example: 1678886400,
    required: false,
  })
  expiresAt?: number;

  @ApiProperty({
    description: 'Оставшееся время до истечения QR-кода в секундах',
    example: 300,
    required: false,
  })
  timeRemaining?: number;
}

