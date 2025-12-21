import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Length } from 'class-validator';

export class TelegramPhoneVerifyDto {
  @ApiProperty({
    description: 'Номер телефона в международном формате',
    example: '+79991234567',
  })
  @IsString({ message: 'Номер телефона должен быть строкой' })
  @IsNotEmpty({ message: 'Номер телефона обязателен' })
  phoneNumber: string;

  @ApiProperty({
    description: 'Код подтверждения, полученный в SMS',
    example: '12345',
  })
  @IsString({ message: 'Код должен быть строкой' })
  @IsNotEmpty({ message: 'Код обязателен' })
  @Length(5, 6, { message: 'Код должен содержать 5-6 цифр' })
  code: string;

  @ApiProperty({
    description: 'Phone code hash, полученный при запросе кода',
    example: 'abc123def456',
  })
  @IsString({ message: 'Phone code hash должен быть строкой' })
  @IsNotEmpty({ message: 'Phone code hash обязателен' })
  phoneCodeHash: string;
}

