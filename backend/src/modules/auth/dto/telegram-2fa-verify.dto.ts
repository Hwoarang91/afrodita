import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class Telegram2FAVerifyDto {
  @ApiProperty({
    description: 'Номер телефона',
    example: '+79991234567',
  })
  @IsString({ message: 'Номер телефона должен быть строкой' })
  @IsNotEmpty({ message: 'Номер телефона обязателен' })
  phoneNumber: string;

  @ApiProperty({
    description: 'Пароль двухфакторной аутентификации',
    example: 'my2fapassword',
  })
  @IsString({ message: 'Пароль должен быть строкой' })
  @IsNotEmpty({ message: 'Пароль обязателен' })
  @MinLength(1, { message: 'Пароль не может быть пустым' })
  password: string;

  @ApiProperty({
    description: 'Phone code hash из предыдущего запроса',
    example: 'abc123def456',
  })
  @IsString({ message: 'Phone code hash должен быть строкой' })
  @IsNotEmpty({ message: 'Phone code hash обязателен' })
  phoneCodeHash: string;
}

