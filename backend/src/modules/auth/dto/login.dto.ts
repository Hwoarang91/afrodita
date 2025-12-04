import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: 'Email адрес пользователя',
    example: 'admin@example.com',
  })
  @IsEmail({}, { message: 'Некорректный email адрес' })
  @IsNotEmpty({ message: 'Email обязателен' })
  email: string;

  @ApiProperty({
    description: 'Пароль пользователя',
    example: 'admin',
    minLength: 1,
  })
  @IsString({ message: 'Пароль должен быть строкой' })
  @IsNotEmpty({ message: 'Пароль обязателен' })
  @MinLength(1, { message: 'Пароль не может быть пустым' })
  password: string;
}

