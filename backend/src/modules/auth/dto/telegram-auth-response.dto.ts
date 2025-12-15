import { ApiProperty } from '@nestjs/swagger';

export class TelegramAuthResponseDto {
  @ApiProperty({
    description: 'Успешна ли авторизация',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Требуется ли 2FA',
    example: false,
  })
  requires2FA?: boolean;

  @ApiProperty({
    description: 'Данные пользователя',
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
    description: 'JWT токены',
    required: false,
  })
  tokens?: {
    accessToken: string;
    refreshToken: string;
  };
}

