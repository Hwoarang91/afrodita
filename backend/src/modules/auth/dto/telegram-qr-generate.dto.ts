import { ApiProperty } from '@nestjs/swagger';

export class TelegramQrGenerateResponseDto {
  @ApiProperty({
    description: 'ID токена для QR-кода',
    example: 'abc123def456',
  })
  tokenId: string;

  @ApiProperty({
    description: 'URL для QR-кода (tg://login?token=...)',
    example: 'tg://login?token=abc123def456',
  })
  qrUrl: string;

  @ApiProperty({
    description: 'Время истечения токена (Unix timestamp)',
    example: 1701234567,
  })
  expiresAt: number;
}

